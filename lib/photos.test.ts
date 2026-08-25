import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_PHOTOS,
  PHOTO_STALE_MS,
  __setIndexedDBForTests,
  deletePhoto,
  isPhotoStale,
  readPhoto,
  savePhoto,
  shrinkPhoto,
  writePhoto,
} from "@/lib/photos";

// jsdom has no IndexedDB at all, so the read/write/FIFO/error-path logic in
// lib/photos.ts is exercised here against a small hand-built fake IDBFactory
// instead of requiring a real browser — per the task's own instruction to
// test via injection rather than demand a real IndexedDB. It only implements
// the sliver of the API lib/photos.ts actually calls (open/transaction/
// get/put/delete/getAll), not the whole spec.

class FakeRequest<T> {
  result: T | undefined;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  _resolve(value: T): void {
    this.result = value;
    this.onsuccess?.();
  }
  _reject(): void {
    this.onerror?.();
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private pending = 0;
  private failed = false;

  constructor(
    private data: Map<string, unknown>,
    private opts: { alwaysFail?: boolean } = {},
  ) {}

  private finishOne(): void {
    this.pending -= 1;
    if (this.pending === 0) {
      queueMicrotask(() => {
        if (this.failed) this.onabort?.();
        else this.oncomplete?.();
      });
    }
  }

  private track<T>(run: () => T): FakeRequest<T> {
    const req = new FakeRequest<T>();
    this.pending += 1;
    queueMicrotask(() => {
      if (this.opts.alwaysFail) {
        this.failed = true;
        req._reject();
        this.finishOne();
        return;
      }
      try {
        const value = run();
        req._resolve(value);
      } catch {
        this.failed = true;
        req._reject();
      }
      this.finishOne();
    });
    return req;
  }

  objectStore(_name: string) {
    return {
      get: (key: string) => this.track(() => this.data.get(key)),
      put: (value: { barcode: string }) =>
        this.track(() => {
          this.data.set(value.barcode, value);
          return value.barcode;
        }),
      delete: (key: string) =>
        this.track(() => {
          this.data.delete(key);
          return undefined;
        }),
      getAll: () => this.track(() => Array.from(this.data.values())),
    };
  }
}

class FakeDB {
  data = new Map<string, unknown>();
  onclose: (() => void) | null = null;
  onversionchange: (() => void) | null = null;
  private storeNames = new Set<string>();
  objectStoreNames = { contains: (name: string) => this.storeNames.has(name) };

  constructor(
    private opts: { failTransactions?: boolean; throwOnTransaction?: boolean } = {},
  ) {}

  createObjectStore(name: string) {
    this.storeNames.add(name);
    return {} as IDBObjectStore;
  }

  close(): void {
    /* no-op for the fake */
  }

  transaction(_storeNames: string | string[], _mode: IDBTransactionMode) {
    if (this.opts.throwOnTransaction) throw new Error("fake: transaction() unavailable");
    return new FakeTransaction(this.data, { alwaysFail: this.opts.failTransactions });
  }
}

interface FakeIDBOptions {
  failOpen?: boolean;
  blockOpen?: boolean;
  failTransactions?: boolean;
  throwOnTransaction?: boolean;
}

class FakeIDBFactory {
  private dbs = new Map<string, FakeDB>();

  constructor(private opts: FakeIDBOptions = {}) {}

  open(name: string, _version: number) {
    const req = {
      result: undefined as FakeDB | undefined,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onblocked: null as (() => void) | null,
    };
    queueMicrotask(() => {
      if (this.opts.failOpen) {
        req.onerror?.();
        return;
      }
      if (this.opts.blockOpen) {
        req.onblocked?.();
        return;
      }
      let db = this.dbs.get(name);
      const isNew = !db;
      if (!db) {
        db = new FakeDB({
          failTransactions: this.opts.failTransactions,
          throwOnTransaction: this.opts.throwOnTransaction,
        });
        this.dbs.set(name, db);
      }
      req.result = db;
      if (isNew) req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req as unknown as IDBOpenDBRequest;
  }

  /** Test helper: reach past writePhoto's own validation and corrupt a
   * stored record in place, so sanitizeStoredPhoto's defensive dropping can
   * be exercised without lib/photos.ts exposing any internals for it. */
  corrupt(barcode: string): void {
    const [db] = this.dbs.values();
    db?.data.set(barcode, { barcode, ts: "not-a-number" });
  }
}

function fakeFactory(opts: FakeIDBOptions = {}): IDBFactory {
  return new FakeIDBFactory(opts) as unknown as IDBFactory;
}

describe("lib/photos without IndexedDB (jsdom's actual environment)", () => {
  afterEach(() => __setIndexedDBForTests(undefined));

  // The single most important behavior: jsdom (like Safari Private Mode,
  // like an ancient WebKit) simply has no IndexedDB. Every call must resolve
  // to "nothing here" instead of throwing, so the result screen never
  // crashes just because this feature's storage isn't available.
  it("readPhoto resolves null instead of throwing", async () => {
    await expect(readPhoto("4001")).resolves.toBeNull();
  });

  it("writePhoto resolves null instead of throwing", async () => {
    await expect(writePhoto("4001", new Blob(["x"], { type: "image/jpeg" }))).resolves.toBeNull();
  });

  it("savePhoto (shrink + write) resolves null instead of throwing", async () => {
    await expect(
      savePhoto("4001", new Blob(["x"], { type: "image/jpeg" })),
    ).resolves.toBeNull();
  });

  it("deletePhoto resolves without throwing even with nothing to delete", async () => {
    await expect(deletePhoto("4001")).resolves.toBeUndefined();
  });

  // jsdom also has no createImageBitmap/OffscreenCanvas — shrinkPhoto must
  // fall back to the original blob rather than fail the whole capture.
  it("shrinkPhoto returns the original blob unchanged when createImageBitmap is unavailable", async () => {
    const original = new Blob(["ingredients photo"], { type: "image/jpeg" });
    const result = await shrinkPhoto(original);
    expect(result).toBe(original);
  });
});

describe("lib/photos age threshold (isPhotoStale)", () => {
  it("is not stale just under the threshold", () => {
    expect(isPhotoStale(Date.now() - (PHOTO_STALE_MS - 60_000))).toBe(false);
  });

  it("is stale just over the threshold", () => {
    expect(isPhotoStale(Date.now() - (PHOTO_STALE_MS + 60_000))).toBe(true);
  });

  it("uses a six-month (180 day) threshold", () => {
    expect(PHOTO_STALE_MS).toBe(180 * 24 * 60 * 60 * 1000);
  });
});

describe("lib/photos read/write/delete against a fake IndexedDB", () => {
  afterEach(() => __setIndexedDBForTests(undefined));

  it("round-trips a saved photo", async () => {
    __setIndexedDBForTests(fakeFactory());
    const blob = new Blob(["hello"], { type: "image/jpeg" });

    const saved = await writePhoto("4001", blob, 1000);
    expect(saved).toEqual({ barcode: "4001", blob, ts: 1000 });

    const read = await readPhoto("4001");
    expect(read).not.toBeNull();
    expect(read?.barcode).toBe("4001");
    expect(read?.ts).toBe(1000);
    expect(read?.blob).toBe(blob);
  });

  it("returns null for a barcode that was never saved", async () => {
    __setIndexedDBForTests(fakeFactory());
    await writePhoto("4001", new Blob(["x"]), 1000);

    expect(await readPhoto("9999")).toBeNull();
  });

  it("overwrites the existing photo (and timestamp) for the same barcode", async () => {
    __setIndexedDBForTests(fakeFactory());
    await writePhoto("4001", new Blob(["old"]), 1000);
    const newBlob = new Blob(["new"]);
    await writePhoto("4001", newBlob, 2000);

    const read = await readPhoto("4001");
    expect(read?.ts).toBe(2000);
    expect(read?.blob).toBe(newBlob);
  });

  it("deletes a stored photo", async () => {
    __setIndexedDBForTests(fakeFactory());
    await writePhoto("4001", new Blob(["x"]), 1000);

    await deletePhoto("4001");

    expect(await readPhoto("4001")).toBeNull();
  });

  it("drops a malformed record instead of surfacing it", async () => {
    const factory = new FakeIDBFactory();
    __setIndexedDBForTests(factory as unknown as IDBFactory);
    await writePhoto("bad", new Blob(["placeholder"]), 1000);
    factory.corrupt("bad");

    expect(await readPhoto("bad")).toBeNull();
  });
});

describe("lib/photos FIFO cap (MAX_PHOTOS)", () => {
  afterEach(() => __setIndexedDBForTests(undefined));

  it("evicts the oldest photo first once the cap is exceeded", async () => {
    __setIndexedDBForTests(fakeFactory());
    for (let i = 0; i < MAX_PHOTOS; i++) {
      await writePhoto(`b${i}`, new Blob([`${i}`]), i);
    }
    // Still within the cap: nothing evicted yet.
    expect(await readPhoto("b0")).not.toBeNull();

    // One more push, over the cap by one — the single oldest entry goes.
    await writePhoto("newest", new Blob(["n"]), MAX_PHOTOS);

    expect(await readPhoto("b0")).toBeNull();
    expect(await readPhoto("b1")).not.toBeNull();
    expect(await readPhoto("newest")).not.toBeNull();
  });

  it("never lets the store grow past MAX_PHOTOS even across many writes", async () => {
    __setIndexedDBForTests(fakeFactory());
    for (let i = 0; i < MAX_PHOTOS + 10; i++) {
      await writePhoto(`b${i}`, new Blob([`${i}`]), i);
    }

    let remaining = 0;
    for (let i = 0; i < MAX_PHOTOS + 10; i++) {
      if ((await readPhoto(`b${i}`)) !== null) remaining += 1;
    }
    expect(remaining).toBe(MAX_PHOTOS);
    // And it kept the newest ones, not an arbitrary subset.
    expect(await readPhoto(`b${MAX_PHOTOS + 9}`)).not.toBeNull();
    expect(await readPhoto("b0")).toBeNull();
  });
});

describe("lib/photos error paths never throw", () => {
  afterEach(() => __setIndexedDBForTests(undefined));

  it("resolves null when the underlying transaction fails (e.g. quota exceeded)", async () => {
    __setIndexedDBForTests(fakeFactory({ failTransactions: true }));

    await expect(writePhoto("4001", new Blob(["x"]))).resolves.toBeNull();
    await expect(readPhoto("4001")).resolves.toBeNull();
    await expect(deletePhoto("4001")).resolves.toBeUndefined();
  });

  it("resolves null when opening the database itself fails", async () => {
    __setIndexedDBForTests(fakeFactory({ failOpen: true }));

    await expect(readPhoto("4001")).resolves.toBeNull();
    await expect(writePhoto("4001", new Blob(["x"]))).resolves.toBeNull();
  });

  it("resolves null when the upgrade is blocked by another tab", async () => {
    __setIndexedDBForTests(fakeFactory({ blockOpen: true }));

    await expect(readPhoto("4001")).resolves.toBeNull();
  });

  it("resolves null when transaction() itself throws synchronously", async () => {
    __setIndexedDBForTests(fakeFactory({ throwOnTransaction: true }));

    await expect(writePhoto("4001", new Blob(["x"]))).resolves.toBeNull();
  });
});
