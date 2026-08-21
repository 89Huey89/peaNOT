import { beforeEach, describe, expect, it } from "vitest";
import {
  isFavoriteBarcode,
  readAllFavorites,
  recordFavoriteCheck,
  sanitizeFavoriteStore,
  toggleFavorite,
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
