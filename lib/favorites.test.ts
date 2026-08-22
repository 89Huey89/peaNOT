import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFavoriteBarcode,
  readAllFavorites,
  readFavoriteStore,
  recordFavoriteCheck,
  sanitizeFavoriteStore,
  subscribeFavorites,
  toggleFavorite,
  writeFavoriteStore,
} from "@/lib/favorites";

const INFO = { name: "Reiswaffel", brand: "dm Bio", verdict: "safe" as const, ts: 1_000 };

describe("favorite storage (F2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is not a favorite until starred", () => {
    expect(isFavoriteBarcode("20137946")).toBe(false);
    expect(readAllFavorites()).toEqual([]);
  });

  it("stars a barcode and remembers it across reads", () => {
    const entry = toggleFavorite("20137946", INFO, 5_000);

    expect(entry).toEqual({ barcode: "20137946", addedAt: 5_000, ...INFO });
    expect(isFavoriteBarcode("20137946")).toBe(true);
    expect(readAllFavorites()).toEqual([entry]);
  });

  it("un-stars an already-favorited barcode on a second toggle", () => {
    toggleFavorite("20137946", INFO, 5_000);
    const result = toggleFavorite("20137946", INFO, 6_000);

    expect(result).toBeNull();
    expect(isFavoriteBarcode("20137946")).toBe(false);
    expect(readAllFavorites()).toEqual([]);
  });

  it("orders favorites most-recently-starred first", () => {
    toggleFavorite("111", { ...INFO, name: "Erst" }, 1_000);
    toggleFavorite("222", { ...INFO, name: "Zweit" }, 2_000);
    toggleFavorite("333", { ...INFO, name: "Dritt" }, 3_000);

    expect(readAllFavorites().map((f) => f.name)).toEqual(["Dritt", "Zweit", "Erst"]);
  });

  it("keeps only the newest 50 favorites", () => {
    for (let i = 0; i < 55; i++) {
      toggleFavorite(`code-${i}`, { ...INFO, name: `Produkt ${i}` }, 1_000 + i);
    }

    expect(isFavoriteBarcode("code-54")).toBe(true);
    expect(isFavoriteBarcode("code-5")).toBe(true);
    expect(isFavoriteBarcode("code-4")).toBe(false);
    expect(isFavoriteBarcode("code-0")).toBe(false);
    expect(readAllFavorites()).toHaveLength(50);
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("peanot.favorites.v1", "{not json");
    expect(readAllFavorites()).toEqual([]);
    toggleFavorite("20137946", INFO, 1_000);
    expect(readAllFavorites()).toHaveLength(1);
  });

  describe("recordFavoriteCheck", () => {
    it("refreshes verdict and ts for an already-favorited barcode", () => {
      toggleFavorite("20137946", INFO, 1_000);

      recordFavoriteCheck("20137946", "danger", 9_000);

      const [entry] = readAllFavorites();
      expect(entry).toMatchObject({ verdict: "danger", ts: 9_000, addedAt: 1_000 });
      // Name/brand and the original starred-at time are untouched.
      expect(entry).toMatchObject({ name: "Reiswaffel", brand: "dm Bio" });
    });

    it("is a no-op for a barcode that was never favorited", () => {
      recordFavoriteCheck("20137946", "danger", 9_000);

      expect(readAllFavorites()).toEqual([]);
    });

    it("is a no-op for a barcode that was un-favorited again", () => {
      toggleFavorite("20137946", INFO, 1_000);
      toggleFavorite("20137946", INFO, 2_000); // un-star

      recordFavoriteCheck("20137946", "danger", 9_000);

      expect(readAllFavorites()).toEqual([]);
    });
  });
});

describe("sanitizeFavoriteStore", () => {
  it("drops malformed entries and keeps valid ones", () => {
    expect(
      sanitizeFavoriteStore({
        good: { name: "Ok", brand: "X", verdict: "safe", ts: 1, addedAt: 2 },
        badVerdict: { name: "Ok", brand: "X", verdict: "maybe", ts: 1, addedAt: 2 },
        missingTs: { name: "Ok", brand: "X", verdict: "safe", addedAt: 2 },
        badName: { name: 1, brand: "X", verdict: "safe", ts: 1, addedAt: 2 },
      }),
    ).toEqual({ good: { barcode: "good", name: "Ok", brand: "X", verdict: "safe", ts: 1, addedAt: 2 } });
  });

  it("returns an empty store for non-object input", () => {
    expect(sanitizeFavoriteStore(null)).toEqual({});
    expect(sanitizeFavoriteStore([1, 2])).toEqual({});
    expect(sanitizeFavoriteStore("nope")).toEqual({});
  });
});

describe("readFavoriteStore / writeFavoriteStore (F1 export/import)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readFavoriteStore returns the raw barcode-keyed record, not the sorted array", () => {
    toggleFavorite("111", INFO, 1_000);
    toggleFavorite("222", { ...INFO, name: "Zweit" }, 2_000);

    expect(readFavoriteStore()).toEqual({
      "111": { barcode: "111", addedAt: 1_000, ...INFO },
      "222": { barcode: "222", addedAt: 2_000, ...INFO, name: "Zweit" },
    });
  });

  it("writeFavoriteStore replaces the store and re-applies the 50-entry prune", () => {
    const bloated: Record<string, ReturnType<typeof readFavoriteStore>[string]> = {};
    for (let i = 0; i < 55; i++) {
      bloated[`code-${i}`] = { barcode: `code-${i}`, ...INFO, addedAt: i };
    }

    writeFavoriteStore(bloated);

    expect(Object.keys(readFavoriteStore())).toHaveLength(50);
    expect("code-54" in readFavoriteStore()).toBe(true);
    expect("code-4" in readFavoriteStore()).toBe(false);
  });
});

describe("subscribeFavorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("notifies a subscriber on toggle, recheck, and a direct writeFavoriteStore (F1 import)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);

    toggleFavorite("111", INFO, 1_000);
    expect(listener).toHaveBeenCalledTimes(1);

    recordFavoriteCheck("111", "danger", 2_000);
    expect(listener).toHaveBeenCalledTimes(2);

    writeFavoriteStore({});
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it("does not notify a no-op recheck of a barcode that isn't favorited", () => {
    const listener = vi.fn();
    subscribeFavorites(listener);

    recordFavoriteCheck("999", "danger", 1_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying once unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);
    unsubscribe();

    toggleFavorite("111", INFO, 1_000);

    expect(listener).not.toHaveBeenCalled();
  });
});
