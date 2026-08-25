import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  resolvedHistoryPersonId,
  resolvedHistoryPersonName,
  useHistory,
  type HistoryEntry,
} from "@/components/useHistory";
import type { ProductResult } from "@/lib/types";

const KEY = "peanot.history.v1";

// Single-person household fixture used by every test that isn't explicitly
// about a *second* person — `firstPersonId` always equals ICH.id here, the
// same way it always would in app/page.tsx when prefs.persons has exactly
// one entry (see that file's own comment on firstPersonId).
const ICH = { id: "p1", name: "Ich" };
const BEN = { id: "p2", name: "Ben" };

function product(partial: Partial<ProductResult>): ProductResult {
  return {
    barcode: "4011200296908",
    productName: "Reiswaffel",
    brand: "dm Bio",
    status: "NEIN",
    ...partial,
  };
}

describe("useHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts empty and becomes ready after mount", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.history).toEqual([]);
  });

  it("records a scan and persists it to localStorage", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      result.current.record(
        product({ status: "JA", productName: "Studentenfutter" }),
        ICH,
        ICH.id,
      ),
    );

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      name: "Studentenfutter",
      brand: "dm Bio",
      verdict: "danger",
      personId: ICH.id,
      personName: ICH.name,
    });

    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].verdict).toBe("danger");
    expect(stored[0].personId).toBe(ICH.id);
    expect(stored[0].personName).toBe(ICH.name);
  });

  it("hydrates existing history from localStorage on mount", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 1, barcode: "1", name: "Alt", brand: "X", verdict: "safe" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0]?.name).toBe("Alt");
  });

  it("collapses a repeat scan of the same barcode at the top", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "A" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "111", productName: "A" }), ICH, ICH.id));

    expect(result.current.history).toHaveLength(1);
  });

  it("Befund 06: collapses a repeat scan anywhere in the list, not only at the top", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Five distinct products, as if checking a stack of familiar staples
    // before a shopping trip, then re-scanning the *first* of them last —
    // it is no longer adjacent to its own previous entry.
    act(() =>
      result.current.record(product({ barcode: "111", productName: "Erdnuss-Riegel" }), ICH, ICH.id),
    );
    act(() => result.current.record(product({ barcode: "222", productName: "B" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "333", productName: "C" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "444", productName: "D" }), ICH, ICH.id));
    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Erdnuss-Riegel", status: "JA" }),
        ICH,
        ICH.id,
      ),
    );

    expect(result.current.history).toHaveLength(4);
    // The re-scan wins with its fresh verdict and jumps to the top — the
    // stale "111" row lower in the list is gone, not a second copy of it.
    expect(result.current.history[0]).toMatchObject({ barcode: "111", verdict: "danger" });
    expect(result.current.history.filter((h) => h.barcode === "111")).toHaveLength(1);
    expect(result.current.history.map((h) => h.barcode)).toEqual(["111", "444", "333", "222"]);
  });

  it("keeps distinct barcodes as separate, newest-first entries", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "First" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" }), ICH, ICH.id));

    expect(result.current.history.map((h) => h.name)).toEqual(["Second", "First"]);
  });

  it("falls back to a placeholder name and brand when missing", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      result.current.record(
        product({ productName: null, brand: null, status: "KEINE_DATEN" }),
        ICH,
        ICH.id,
      ),
    );

    expect(result.current.history[0]).toMatchObject({
      name: "Unbekanntes Produkt",
      brand: "—",
      verdict: "unknown",
    });
  });

  it("removes a single entry by id and persists the rest", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "First" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" }), ICH, ICH.id));

    const removedId = result.current.history.find((h) => h.name === "First")!.id;
    act(() => result.current.remove(removedId));

    expect(result.current.history.map((h) => h.name)).toEqual(["Second"]);
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.map((h: { name: string }) => h.name)).toEqual(["Second"]);
  });

  it("clears history and empties storage", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({}), ICH, ICH.id));
    act(() => result.current.clear());

    expect(result.current.history).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([]);
  });

  it("restores a removed entry, preserving its ts/id and sort position", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "First" }), ICH, ICH.id));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" }), ICH, ICH.id));

    const removed = result.current.history.find((h) => h.name === "First")!;
    act(() => result.current.remove(removed.id));
    expect(result.current.history.map((h) => h.name)).toEqual(["Second"]);

    act(() => result.current.restore(removed));

    // Older ts sorts back below the newer entry, not onto the top.
    expect(result.current.history).toEqual([
      expect.objectContaining({ name: "Second" }),
      removed,
    ]);
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.map((h: { id: string }) => h.id)).toEqual([
      result.current.history[0]!.id,
      removed.id,
    ]);
  });

  it("does not duplicate an entry that is restored while already present", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "Only" }), ICH, ICH.id));
    const entry = result.current.history[0]!;

    act(() => result.current.restore(entry));

    expect(result.current.history).toHaveLength(1);
  });

  it("Befund 06: restore() does not create a barcode duplicate when a fresh scan landed while undo was pending", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "Alt" }), ICH, ICH.id));
    const removed = result.current.history[0]!;
    act(() => result.current.remove(removed.id));
    expect(result.current.history).toEqual([]);

    // A fresh scan of the very same barcode lands while "Rückgängig" is
    // still showing (HistoryScreen keeps `removed` around for a few
    // seconds in its own state).
    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Neu", status: "JA" }),
        ICH,
        ICH.id,
      ),
    );
    expect(result.current.history).toHaveLength(1);

    // Undo fires — must not resurrect the old row alongside the new one.
    act(() => result.current.restore(removed));

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({ name: "Neu", verdict: "danger" });
  });

  it("importEntries (F1) merges an imported list in, newest-first and deduped", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "Lokal" }), ICH, ICH.id));
    const local = result.current.history[0]!;

    act(() =>
      result.current.importEntries([
        local, // re-imported unchanged — must not duplicate
        { id: "h_2_222", ts: local.ts + 1, barcode: "222", name: "Importiert", brand: "Y", verdict: "danger" },
      ]),
    );

    expect(result.current.history.map((h) => h.name)).toEqual(["Importiert", "Lokal"]);
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.map((h: { name: string }) => h.name)).toEqual(["Importiert", "Lokal"]);
  });

  it("Befund 06: importEntries() collapses a barcode duplicate that mergeHistory's id-based merge would let through", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "Lokal" }), ICH, ICH.id));
    const local = result.current.history[0]!;

    // Different id and ts than the local entry, and the *same* personId —
    // mergeHistory's id/barcode+ts key would treat this as a *distinct* row,
    // even though it is the same barcode for the same person. The newer of
    // the two (this one) must win, and only one "111" row must remain.
    act(() =>
      result.current.importEntries([
        {
          id: "h_other_111",
          ts: local.ts + 1000,
          barcode: "111",
          name: "Importiert-Neuer",
          brand: "Z",
          verdict: "danger",
          personId: ICH.id,
          personName: ICH.name,
        },
      ]),
    );

    const barcode111 = result.current.history.filter((h) => h.barcode === "111");
    expect(barcode111).toHaveLength(1);
    expect(barcode111[0]).toMatchObject({ name: "Importiert-Neuer" });
  });

  it("Befund 02: filters out an entry with a verdict string VERDICT doesn't know, keeping the valid entries around it", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 3, barcode: "1", name: "Gut 1", brand: "X", verdict: "safe" },
        { id: "h2", ts: 2, barcode: "2", name: "Kaputt", brand: "X", verdict: "not-a-real-verdict" },
        { id: "h3", ts: 1, barcode: "3", name: "Gut 2", brand: "X", verdict: "danger" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.history.map((h) => h.name)).toEqual(["Gut 1", "Gut 2"]);
  });

  it("Befund 02: filters out an entry missing a required field, keeping the valid entries around it", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 2, barcode: "1", name: "Gut 1", brand: "X", verdict: "safe" },
        // Missing "verdict" entirely.
        { id: "h2", ts: 1, barcode: "2", name: "Kaputt", brand: "X" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.history.map((h) => h.name)).toEqual(["Gut 1"]);
  });

  it("Befund 02: filters out a non-object element, keeping the valid entries around it", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 2, barcode: "1", name: "Gut 1", brand: "X", verdict: "safe" },
        "this-is-not-an-entry",
        null,
        42,
        { id: "h2", ts: 1, barcode: "2", name: "Gut 2", brand: "X", verdict: "trace" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.history.map((h) => h.name)).toEqual(["Gut 1", "Gut 2"]);
  });

  it("Befund 02: falls back to an empty history when the stored value isn't an array at all", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.history).toEqual([]);
  });

  it("caps history at 200 entries, still deduplicated by barcode", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    for (let i = 0; i < 205; i++) {
      act(() =>
        result.current.record(product({ barcode: String(i), productName: `P${i}` }), ICH, ICH.id),
      );
    }

    expect(result.current.history).toHaveLength(200);
    // Newest scans survive, oldest ones were pushed out.
    expect(result.current.history[0]).toMatchObject({ name: "P204" });
    expect(result.current.history.map((h) => h.barcode)).not.toContain("0");

    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(200);
  });
});

describe("useHistory person attribution (F part 2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores who a scan was checked for", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111" }), BEN, ICH.id));

    expect(result.current.history[0]).toMatchObject({ personId: BEN.id, personName: BEN.name });
  });

  it("a rescan for a DIFFERENT person adds a new row instead of overwriting the first person's row", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Erdnuss-Riegel", status: "NEIN" }),
        ICH,
        ICH.id,
      ),
    );
    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Erdnuss-Riegel", status: "JA" }),
        BEN,
        ICH.id,
      ),
    );

    const rows = result.current.history.filter((h) => h.barcode === "111");
    expect(rows).toHaveLength(2);
    expect(rows.find((h) => h.personId === ICH.id)).toMatchObject({ verdict: "safe" });
    expect(rows.find((h) => h.personId === BEN.id)).toMatchObject({ verdict: "danger" });
  });

  it("a rescan for the SAME person still collapses to one row (dedup unaffected)", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", status: "NEIN" }), BEN, ICH.id));
    act(() => result.current.record(product({ barcode: "111", status: "JA" }), BEN, ICH.id));

    const rows = result.current.history.filter((h) => h.barcode === "111");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verdict: "danger", personId: BEN.id });
  });

  it("single-person household: a legacy row with no personId at all still gets replaced by a rescan, exactly like before this feature", async () => {
    // Pre-existing history written before F(part2) shipped — no personId,
    // and the household has (and always had) exactly one person, so
    // firstPersonId === the active person's own id.
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 1, barcode: "111", name: "Alt", brand: "X", verdict: "safe" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Neu", status: "JA" }),
        ICH,
        ICH.id, // firstPersonId === ICH.id: the only person there has ever been
      ),
    );

    // Still one row — the legacy row was replaced, not left as a stray
    // duplicate, matching the pre-F(part2) barcode-only dedup exactly.
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      name: "Neu",
      verdict: "danger",
      personId: ICH.id,
    });
  });

  it("multi-person household: a legacy row is NOT overwritten by a different person's rescan", async () => {
    // The legacy row here is attributed to `firstPersonId` (ICH.id) by
    // convention — Ben rescanning the same barcode must add his own row,
    // never silently claim/replace a row that isn't provably his.
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 1, barcode: "111", name: "Alt", brand: "X", verdict: "safe" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    act(() =>
      result.current.record(
        product({ barcode: "111", productName: "Neu", status: "JA" }),
        BEN,
        ICH.id, // firstPersonId is ICH, not Ben
      ),
    );

    const rows = result.current.history.filter((h) => h.barcode === "111");
    expect(rows).toHaveLength(2);
    expect(rows.some((h) => h.personId === undefined && h.name === "Alt")).toBe(true);
    expect(rows.some((h) => h.personId === BEN.id && h.name === "Neu")).toBe(true);
  });

  it("does not lose old history entries that predate person attribution", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "h1", ts: 2, barcode: "111", name: "Alt 1", brand: "X", verdict: "safe" },
        { id: "h2", ts: 1, barcode: "222", name: "Alt 2", brand: "Y", verdict: "danger" },
      ]),
    );

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history.map((h) => h.name)).toEqual(["Alt 1", "Alt 2"]);
    expect(result.current.history.every((h) => h.personId === undefined)).toBe(true);
  });

  it("the 200-entry cap still applies once entries carry a person", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    for (let i = 0; i < 205; i++) {
      act(() =>
        result.current.record(product({ barcode: String(i), productName: `P${i}` }), ICH, ICH.id),
      );
    }

    expect(result.current.history).toHaveLength(200);
    expect(result.current.history[0]).toMatchObject({ name: "P204", personId: ICH.id });
  });

  it("restore() re-inserts an entry without conflating it with a different person's row for the same barcode", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111" }), ICH, ICH.id));
    const ichRow = result.current.history[0]!;
    act(() => result.current.remove(ichRow.id));
    act(() => result.current.record(product({ barcode: "111" }), BEN, ICH.id));

    act(() => result.current.restore(ichRow));

    const rows = result.current.history.filter((h) => h.barcode === "111");
    expect(rows).toHaveLength(2);
    expect(rows.some((h) => h.personId === ICH.id)).toBe(true);
    expect(rows.some((h) => h.personId === BEN.id)).toBe(true);
  });
});

describe("resolvedHistoryPersonId / resolvedHistoryPersonName", () => {
  const modern: HistoryEntry = {
    id: "h1",
    ts: 1,
    barcode: "111",
    name: "X",
    brand: "Y",
    verdict: "safe",
    personId: BEN.id,
    personName: BEN.name,
  };
  const legacy: HistoryEntry = {
    id: "h2",
    ts: 1,
    barcode: "222",
    name: "X",
    brand: "Y",
    verdict: "safe",
  };

  it("resolves a modern entry to its own stored person, ignoring the fallback", () => {
    expect(resolvedHistoryPersonId(modern, ICH.id)).toBe(BEN.id);
    expect(resolvedHistoryPersonName(modern, ICH.name)).toBe(BEN.name);
  });

  it("resolves a legacy (personId-less) entry to the given fallback", () => {
    expect(resolvedHistoryPersonId(legacy, ICH.id)).toBe(ICH.id);
    expect(resolvedHistoryPersonName(legacy, ICH.name)).toBe(ICH.name);
  });
});
