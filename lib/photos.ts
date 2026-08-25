// Feature E — a photo of the ingredients list, kept per barcode.
//
// KEINE_DATEN always ends the same way today: pick up the pack, read the
// label yourself, and forget everything again by the next shop. A photo
// taken once and kept against the barcode pays that reading cost exactly
// once. This module is the storage layer only — components/usePhoto.ts
// wraps it into component state the same way components/useNote.ts and
// components/usePackMatch.ts wrap lib/notes.ts and lib/packmatch.ts.
//
// IMPORTANT — this store is a memory aid, never evidence. Nothing in this
// file (or anywhere downstream of it) runs OCR on the photo, reads its
// pixels, or feeds it into a verdict. A barcode's recipe and packaging can
// change while the EAN stays the same — the exact risk lib/caveats.ts warns
// about for restricted-circulation codes — so a photo from months ago is a
// reminder of what this family once read, not proof of what's in today's
// pack. See isPhotoStale below for how that honesty is surfaced in the UI.

/** One saved photo: the barcode it belongs to, the (already-shrunk) image
 * data, and when it was captured. */
export interface StoredPhoto {
  barcode: string;
  blob: Blob;
  /** Epoch milliseconds of capture — ages the photo out visually (see
   * isPhotoStale) and orders the FIFO cap (see MAX_PHOTOS). */
  ts: number;
}

const DB_NAME = "peanot-photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

/** Keep the most recently captured photos only, mirroring the caps
 * lib/notes.ts and lib/favorites.ts already use — a family re-buys a
 * realistic number of staples, not thousands, so this is a generous
 * backstop against unbounded IndexedDB growth, not a normal-use limit. */
export const MAX_PHOTOS = 50;

// A photo is *this family's own* record of one specific pack they held —
// more immediate than an OFF database entry, but exposed to exactly the same
// risk: a product can be reformulated, or a barcode reused, without the
// photo ever knowing. lib/time.ts's isDataStale gives an OFF record two full
// years before flagging it, because that entry is maintained by strangers
// and edited only occasionally. A self-taken photo deserves a much shorter
// fuse: six months is roughly two purchase cycles for a staple product —
// long enough that the photo has usually already paid for itself by saving
// a re-read, short enough that "snap it once, trust it forever" never
// quietly becomes the habit.
export const PHOTO_STALE_MS = 180 * 24 * 60 * 60 * 1000;

/** Whether a saved photo is old enough that the pack in hand, not the photo,
 * should decide — see PHOTO_STALE_MS for why six months. */
export function isPhotoStale(ts: number, now: number = Date.now()): boolean {
  return now - ts > PHOTO_STALE_MS;
}

// Long edge a resized photo is capped to. An iPhone photo is typically
// 3000-4000px on its long edge — nothing on a printed ingredients list needs
// more than a fraction of that to stay legible when zoomed, and 50 photos at
// full camera resolution would make this store itself a multi-hundred-MB
// liability. 1600px is generous rather than tight: dense small print (the
// kind this feature exists for) stays readable, while typically cutting
// linear size by more than half and file size by an order of magnitude once
// re-encoded as JPEG.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

// ---------------------------------------------------------------------------
// IndexedDB plumbing. Every exported function here is Promise-based and
// never throws: a missing IndexedDB (jsdom, Safari Private Mode), a blocked
// upgrade, or a quota error all resolve to "no photo" / "not saved", exactly
// like the rest of peaNOT's local-only stores degrade on a missing
// localStorage.
// ---------------------------------------------------------------------------

/** Test-only seam: jsdom has no IndexedDB at all, so the FIFO/read/write
 * logic below is exercised in lib/photos.test.ts against a small hand-built
 * fake IDBFactory injected here, instead of requiring a real browser. Pass
 * undefined to go back to whatever the ambient `window.indexedDB` is (which
 * in jsdom is also nothing — see ambientFactory). */
let injectedFactory: IDBFactory | undefined;
let cachedDb: IDBDatabase | null = null;
let cachedDbPromise: Promise<IDBDatabase | null> | null = null;

export function __setIndexedDBForTests(factory: IDBFactory | undefined): void {
  injectedFactory = factory;
  cachedDb = null;
  cachedDbPromise = null;
}

function ambientFactory(): IDBFactory | undefined {
  if (typeof window === "undefined") return undefined;
  return window.indexedDB;
}

/** Open (and cache) the one IndexedDB connection this module uses. Resolves
 * null on anything that goes wrong — missing API, a blocked/failed open, a
 * synchronous throw from a locked-down environment — never rejects. */
function openDb(): Promise<IDBDatabase | null> {
  if (cachedDb) return Promise.resolve(cachedDb);
  if (cachedDbPromise) return cachedDbPromise;
  const factory = injectedFactory ?? ambientFactory();
  if (!factory) return Promise.resolve(null);

  const promise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "barcode" });
        }
      } catch {
        // Fall through to onerror/onsuccess below — a failed upgrade
        // eventually surfaces as one of those, never as a throw here.
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab (this same app open twice) can force a version change
      // out from under us — drop the handle rather than keep serving reads
      // and writes against a connection the browser is closing.
      db.onversionchange = () => {
        try {
          db.close();
        } catch {
          /* already closing */
        }
        if (cachedDb === db) cachedDb = null;
      };
      db.onclose = () => {
        if (cachedDb === db) cachedDb = null;
      };
      cachedDb = db;
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  cachedDbPromise = promise;
  void promise.then(() => {
    cachedDbPromise = null;
  });
  return promise;
}

type StoreResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Run one operation against the photo store inside its own transaction,
 * resolving `{ ok: true, value }` once the transaction commits, or
 * `{ ok: false }` on absolutely anything going wrong (no IndexedDB, a
 * synchronous throw, a request error, an aborted/failed transaction). Every
 * exported read/write below funnels through here, so there is exactly one
 * place that has to get "never throw" right.
 */
function runInStore<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<StoreResult<T>> {
  return openDb()
    .then((db) => {
      if (!db) return { ok: false as const };
      return new Promise<StoreResult<T>>((resolve) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch {
          resolve({ ok: false });
          return;
        }
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          resolve({ ok: false });
        };
        const succeed = (value: T) => {
          if (settled) return;
          settled = true;
          resolve({ ok: true, value });
        };
        tx.onerror = fail;
        tx.onabort = fail;

        let request: IDBRequest<T> | void;
        try {
          request = op(tx.objectStore(STORE_NAME));
        } catch {
          fail();
          return;
        }
        if (request) {
          request.onerror = fail;
          // Wait for the transaction to actually commit before handing the
          // result back — no observable difference for today's single-op
          // transactions, but it keeps "resolved means durable" honest.
          tx.oncomplete = () => succeed(request!.result);
        } else {
          tx.oncomplete = () => succeed(undefined as T);
        }
      });
    })
    .catch(() => ({ ok: false }));
}

/** Validate an arbitrary (already-deserialized) IndexedDB value into a
 * well-formed StoredPhoto, dropping anything malformed — same defensive
 * shape as lib/notes.ts's sanitizeNoteStore, just for one record instead of
 * a whole JSON blob (IndexedDB stores structured values directly, so there's
 * no JSON.parse step, but a stale schema or a corrupted entry is still
 * worth guarding against). */
function sanitizeStoredPhoto(value: unknown): StoredPhoto | null {
  if (value === null || typeof value !== "object") return null;
  const { barcode, blob, ts } = value as Record<string, unknown>;
  if (typeof barcode !== "string" || typeof ts !== "number") return null;
  if (typeof Blob !== "undefined" && !(blob instanceof Blob)) return null;
  return { barcode, blob: blob as Blob, ts };
}

/** The saved photo for a barcode, or null when there is none — including
 * when IndexedDB itself isn't available. Callers can't (and shouldn't)
 * distinguish those two cases: both mean "show the capture button". */
export async function readPhoto(barcode: string): Promise<StoredPhoto | null> {
  const result = await runInStore<unknown>("readonly", (store) => store.get(barcode));
  return result.ok ? sanitizeStoredPhoto(result.value) : null;
}

/** Delete the surplus once the store holds more than MAX_PHOTOS entries,
 * oldest first (FIFO) — housekeeping only, so a partial prune (one delete
 * among several fails) is an acceptable outcome, never something the user
 * waits on or sees an error for. */
async function pruneOverCap(): Promise<void> {
  const result = await runInStore<unknown[]>("readonly", (store) => store.getAll());
  if (!result.ok) return;
  const all = result.value
    .map(sanitizeStoredPhoto)
    .filter((entry): entry is StoredPhoto => entry !== null);
  if (all.length <= MAX_PHOTOS) return;
  const surplus = all.sort((a, b) => a.ts - b.ts).slice(0, all.length - MAX_PHOTOS);
  await Promise.all(surplus.map((entry) => deletePhoto(entry.barcode)));
}

/** Save (or overwrite) the photo for a barcode, then enforce the FIFO cap.
 * Returns the entry that ended up stored, or null when the write itself
 * failed (no IndexedDB, quota exceeded, blocked upgrade, …) — the caller
 * (components/usePhoto.ts) turns that into a visible error, per F-E's
 * "never fail silently" requirement. Takes an already-resized blob; see
 * shrinkPhoto for the resize step, and savePhoto below for the combined
 * convenience the hook actually calls. */
export async function writePhoto(
  barcode: string,
  blob: Blob,
  now: number = Date.now(),
): Promise<StoredPhoto | null> {
  const entry: StoredPhoto = { barcode, blob, ts: now };
  const result = await runInStore<void>("readwrite", (store) => {
    store.put(entry);
  });
  if (!result.ok) return null;
  await pruneOverCap();
  return entry;
}

/** Remove the photo for a barcode. Best-effort like everywhere else here —
 * if IndexedDB is unavailable there is nothing stored to remove anyway. */
export async function deletePhoto(barcode: string): Promise<void> {
  await runInStore<void>("readwrite", (store) => {
    store.delete(barcode);
  });
}

// ---------------------------------------------------------------------------
// Resizing. Runs before a photo ever reaches writePhoto.
// ---------------------------------------------------------------------------

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  } catch {
    /* canvas construction unavailable */
  }
  return null;
}

async function canvasToJpegBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<Blob | null> {
  try {
    if ("convertToBlob" in canvas) {
      return await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    }
    return await new Promise<Blob | null>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
  } catch {
    return null;
  }
}

/**
 * Downscale + recompress a captured photo to MAX_EDGE_PX on its long edge,
 * as a JPEG. Uses createImageBitmap + canvas (OffscreenCanvas where
 * available, a plain <canvas> otherwise) — both widely supported on iOS
 * Safari. Where either is missing (older WebKit, or jsdom under test), the
 * original blob is returned unchanged: a bigger stored file beats losing the
 * whole feature, and nothing here should ever make F-E fail outright just
 * because the fast path wasn't available.
 */
export async function shrinkPhoto(source: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return source;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return source;
  }
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) return source;
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = makeCanvas(width, height);
    if (!canvas) return source;
    const ctx = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return source;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const jpeg = await canvasToJpegBlob(canvas);
    return jpeg ?? source;
  } catch {
    return source;
  } finally {
    try {
      bitmap.close();
    } catch {
      /* releasing the bitmap is a courtesy, not something worth surfacing */
    }
  }
}

/**
 * The one call components/usePhoto.ts actually makes on capture: shrink then
 * store. Split out from writePhoto so lib/photos.test.ts can exercise the
 * storage/FIFO logic with plain, already-small test blobs, without needing
 * createImageBitmap to exist.
 */
export async function savePhoto(
  barcode: string,
  source: Blob,
  now: number = Date.now(),
): Promise<StoredPhoto | null> {
  let blob: Blob;
  try {
    blob = await shrinkPhoto(source);
  } catch {
    blob = source;
  }
  return writePhoto(barcode, blob, now);
}
