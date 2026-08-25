import { describe, expect, it } from "vitest";
import {
  isWatchDue,
  pruneAcknowledged,
  recallMatchKey,
  selectNewHits,
  selectWatchCandidates,
  WATCH_CANDIDATES_MAX,
  WATCH_HISTORY_LIMIT,
  WATCH_INTERVAL_MS,
  type WatchResult,
} from "@/lib/recalls/watch";
import type { RecallMatch } from "@/lib/types";

function favorite(barcode: string, name = "Name", brand = "Marke") {
  return { barcode, name, brand };
}
function history(barcode: string, ts: number, name = "Name", brand = "Marke") {
  return { barcode, name, brand, ts };
}
function match(partial: Partial<RecallMatch> & { title: string }): RecallMatch {
  return { link: null, publishedDate: null, ...partial };
}

describe("selectWatchCandidates", () => {
  it("includes every favorite and the most recent history entries", () => {
    const favorites = [favorite("1"), favorite("2")];
    const hist = [history("3", 100), history("4", 200)];

    const result = selectWatchCandidates(favorites, hist);

    expect(result.map((c) => c.barcode).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("deduplicates by barcode, favorites winning over a history duplicate", () => {
    const favorites = [favorite("1", "Favorit-Name", "Favorit-Marke")];
    const hist = [history("1", 100, "History-Name", "History-Marke")];

    const result = selectWatchCandidates(favorites, hist);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ barcode: "1", name: "Favorit-Name", brand: "Favorit-Marke" });
  });

  it("takes only the newest WATCH_HISTORY_LIMIT history entries before deduping", () => {
    const hist = Array.from({ length: WATCH_HISTORY_LIMIT + 5 }, (_, i) =>
      history(String(i), i),
    );

    const result = selectWatchCandidates([], hist);

    // The oldest entries (lowest ts, lowest index here) must be the ones
    // dropped, not an arbitrary subset.
    const barcodes = result.map((c) => c.barcode);
    expect(barcodes).toHaveLength(WATCH_HISTORY_LIMIT);
    expect(barcodes).not.toContain("0");
    expect(barcodes).toContain(String(WATCH_HISTORY_LIMIT + 4));
  });

  it("caps the total number of candidates", () => {
    const favorites = Array.from({ length: WATCH_CANDIDATES_MAX + 10 }, (_, i) =>
      favorite(String(i)),
    );

    const result = selectWatchCandidates(favorites, []);

    expect(result).toHaveLength(WATCH_CANDIDATES_MAX);
  });

  it("returns an empty list for no favorites and no history", () => {
    expect(selectWatchCandidates([], [])).toEqual([]);
  });
});

describe("isWatchDue", () => {
  it("is due on the very first check (lastCheckedAt null)", () => {
    expect(isWatchDue(null, Date.now())).toBe(true);
  });

  it("is not due before the interval has elapsed", () => {
    const now = 1_000_000;
    expect(isWatchDue(now - WATCH_INTERVAL_MS + 1000, now)).toBe(false);
  });

  it("is due once the interval has fully elapsed", () => {
    const now = 1_000_000;
    expect(isWatchDue(now - WATCH_INTERVAL_MS, now)).toBe(true);
  });

  it("respects a custom interval", () => {
    expect(isWatchDue(1000, 1500, 400)).toBe(true);
    expect(isWatchDue(1000, 1200, 400)).toBe(false);
  });
});

describe("recallMatchKey", () => {
  it("differs for two notices on the same barcode with different titles", () => {
    const a = recallMatchKey("1", match({ title: "Notice A" }));
    const b = recallMatchKey("1", match({ title: "Notice B" }));
    expect(a).not.toBe(b);
  });

  it("differs for the same notice text on two different barcodes", () => {
    const a = recallMatchKey("1", match({ title: "Notice" }));
    const b = recallMatchKey("2", match({ title: "Notice" }));
    expect(a).not.toBe(b);
  });

  it("is stable for the same barcode + notice", () => {
    const m = match({ title: "Notice", publishedDate: 123, link: "https://x" });
    expect(recallMatchKey("1", m)).toBe(recallMatchKey("1", m));
  });

  it("differs when only publishedDate differs (a re-issued notice)", () => {
    const a = recallMatchKey("1", match({ title: "Notice", publishedDate: 1 }));
    const b = recallMatchKey("1", match({ title: "Notice", publishedDate: 2 }));
    expect(a).not.toBe(b);
  });
});

describe("selectNewHits", () => {
  const noticeA = match({ title: "Notice A", publishedDate: 1 });
  const noticeB = match({ title: "Notice B", publishedDate: 2 });

  function results(overrides: Partial<WatchResult> = {}): WatchResult[] {
    return [
      { barcode: "1", name: "Produkt", brand: "Marke", matches: [noticeA], ...overrides },
    ];
  }

  it("surfaces a match that has not been acknowledged", () => {
    const hits = selectNewHits(results(), new Set());
    expect(hits).toEqual([{ barcode: "1", name: "Produkt", brand: "Marke", match: noticeA }]);
  });

  it("hides a match once its key has been acknowledged", () => {
    const acknowledged = new Set([recallMatchKey("1", noticeA)]);
    expect(selectNewHits(results(), acknowledged)).toEqual([]);
  });

  it("still surfaces a different, newer notice for the same acknowledged barcode", () => {
    const acknowledged = new Set([recallMatchKey("1", noticeA)]);
    const hits = selectNewHits(results({ matches: [noticeA, noticeB] }), acknowledged);

    expect(hits).toEqual([{ barcode: "1", name: "Produkt", brand: "Marke", match: noticeB }]);
  });

  it("returns nothing for a product with no matches", () => {
    expect(selectNewHits(results({ matches: [] }), new Set())).toEqual([]);
  });
});

describe("pruneAcknowledged", () => {
  it("leaves the map untouched when under the cap", () => {
    const map = { a: 1, b: 2 };
    expect(pruneAcknowledged(map, 5)).toEqual(map);
  });

  it("keeps only the newest entries once over the cap", () => {
    const map = { old: 1, mid: 2, new: 3 };
    expect(pruneAcknowledged(map, 2)).toEqual({ new: 3, mid: 2 });
  });
});
