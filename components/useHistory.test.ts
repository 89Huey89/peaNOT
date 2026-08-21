import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useHistory } from "@/components/useHistory";
import type { ProductResult } from "@/lib/types";

const KEY = "peanot.history.v1";

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

    act(() => result.current.record(product({ status: "JA", productName: "Studentenfutter" })));

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      name: "Studentenfutter",
      brand: "dm Bio",
      verdict: "danger",
    });

    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].verdict).toBe("danger");
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

    act(() => result.current.record(product({ barcode: "111", productName: "A" })));
    act(() => result.current.record(product({ barcode: "111", productName: "A" })));

    expect(result.current.history).toHaveLength(1);
  });

  it("keeps distinct barcodes as separate, newest-first entries", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "First" })));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" })));

    expect(result.current.history.map((h) => h.name)).toEqual(["Second", "First"]);
  });

  it("falls back to a placeholder name and brand when missing", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      result.current.record(product({ productName: null, brand: null, status: "KEINE_DATEN" })),
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

    act(() => result.current.record(product({ barcode: "111", productName: "First" })));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" })));

    const removedId = result.current.history.find((h) => h.name === "First")!.id;
    act(() => result.current.remove(removedId));

    expect(result.current.history.map((h) => h.name)).toEqual(["Second"]);
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.map((h: { name: string }) => h.name)).toEqual(["Second"]);
  });

  it("clears history and empties storage", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({})));
    act(() => result.current.clear());

    expect(result.current.history).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([]);
  });

  it("restores a removed entry, preserving its ts/id and sort position", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "First" })));
    act(() => result.current.record(product({ barcode: "222", productName: "Second" })));

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

    act(() => result.current.record(product({ barcode: "111", productName: "Only" })));
    const entry = result.current.history[0]!;

    act(() => result.current.restore(entry));

    expect(result.current.history).toHaveLength(1);
  });

  it("importEntries (F1) merges an imported list in, newest-first and deduped", async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(product({ barcode: "111", productName: "Lokal" })));
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
});
