import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRecallWatch } from "@/components/useRecallWatch";
import { recallMatchKey, WATCH_INTERVAL_MS } from "@/lib/recalls/watch";
import type { RecallMatch } from "@/lib/types";

const KEY = "peanot.recallwatch.v1";

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

const favoriteA = { barcode: "4011200296908", name: "ültje Erdnüsse", brand: "ültje" };

describe("useRecallWatch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOnLine(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setOnLine(true);
  });

  it("never polls while offline", async () => {
    setOnLine(false);
    vi.stubGlobal("fetch", vi.fn());

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.hits).toEqual([]);
  });

  it("does not poll again within the throttle window", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ lastCheckedAt: Date.now() - 1000, acknowledged: {}, lastResults: [] }),
    );
    vi.stubGlobal("fetch", vi.fn());

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("polls once the throttle window has elapsed, and shows a fresh hit", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        lastCheckedAt: Date.now() - WATCH_INTERVAL_MS - 1,
        acknowledged: {},
        lastResults: [],
      }),
    );
    const match: RecallMatch = {
      title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
      link: "https://www.lebensmittelwarnung.de/x",
      publishedDate: 1_700_000_000_000,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ status: "ok", results: { [favoriteA.barcode]: [match] } }),
      ),
    );

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));

    await waitFor(() => expect(result.current.hits).toHaveLength(1));
    expect(result.current.hits[0]).toEqual({
      barcode: favoriteA.barcode,
      name: favoriteA.name,
      brand: favoriteA.brand,
      match,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/recalls",
      expect.objectContaining({ method: "POST" }),
    );

    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.lastCheckedAt).toBeGreaterThan(0);
  });

  it("does not poll at all when there is nothing to watch (no favorites, no history)", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { result } = renderHook(() => useRecallWatch([], []));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the previous hits instead of clearing them when a poll comes back unavailable", async () => {
    const match: RecallMatch = { title: "Alte Meldung", link: null, publishedDate: 1 };
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        lastCheckedAt: Date.now() - WATCH_INTERVAL_MS - 1,
        acknowledged: {},
        lastResults: [
          { barcode: favoriteA.barcode, name: favoriteA.name, brand: favoriteA.brand, matches: [match] },
        ],
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "unavailable" })));

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // Give the in-flight promise a tick to resolve and update state.
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(KEY)!);
      expect(stored.lastCheckedAt).toBeGreaterThan(Date.now() - 1000);
    });

    expect(result.current.hits).toEqual([
      { barcode: favoriteA.barcode, name: favoriteA.name, brand: favoriteA.brand, match },
    ]);
  });

  it("acknowledging a hit hides it and persists the acknowledgement", async () => {
    const match: RecallMatch = { title: "Notice", link: null, publishedDate: 1 };
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        lastCheckedAt: Date.now(), // inside the throttle window: no poll needed for this test
        acknowledged: {},
        lastResults: [
          { barcode: favoriteA.barcode, name: favoriteA.name, brand: favoriteA.brand, matches: [match] },
        ],
      }),
    );

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));
    await waitFor(() => expect(result.current.hits).toHaveLength(1));

    act(() => result.current.acknowledge(favoriteA.barcode, match));

    expect(result.current.hits).toEqual([]);
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.acknowledged[recallMatchKey(favoriteA.barcode, match)]).toBeTypeOf("number");
  });

  it("a new notice for the same product resurfaces even after the old one was acknowledged", async () => {
    const oldMatch: RecallMatch = { title: "Alte Meldung", link: null, publishedDate: 1 };
    const newMatch: RecallMatch = { title: "Neue Meldung", link: null, publishedDate: 2 };
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        lastCheckedAt: Date.now(),
        acknowledged: { [recallMatchKey(favoriteA.barcode, oldMatch)]: Date.now() },
        lastResults: [
          {
            barcode: favoriteA.barcode,
            name: favoriteA.name,
            brand: favoriteA.brand,
            matches: [oldMatch, newMatch],
          },
        ],
      }),
    );

    const { result } = renderHook(() => useRecallWatch([favoriteA], []));

    await waitFor(() =>
      expect(result.current.hits).toEqual([
        { barcode: favoriteA.barcode, name: favoriteA.name, brand: favoriteA.brand, match: newMatch },
      ]),
    );
  });

  it("ignores a malformed stored state instead of throwing", async () => {
    window.localStorage.setItem(KEY, "{not json");

    const { result } = renderHook(() => useRecallWatch([], []));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.hits).toEqual([]);
  });
});
