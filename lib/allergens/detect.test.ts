import { describe, expect, it } from "vitest";
import {
  detectAllergen,
  detectPeanut,
  tagMatches,
  textContainsKeyword,
} from "@/lib/allergens/detect";
import { PEANUT_PROFILE, type AllergenProfile } from "@/lib/allergens/profile";
import type { OffProductFields } from "@/lib/types";

function fields(partial: Partial<OffProductFields> = {}): OffProductFields {
  return {
    allergens_tags: [],
    traces_tags: [],
    ingredients_tags: [],
    ingredients_text: "",
    ...partial,
  };
}

describe("tagMatches", () => {
  it("matches exact positive tags", () => {
    expect(tagMatches(["en:milk", "en:peanuts"], PEANUT_PROFILE.positiveTags)).toBe(true);
  });

  it("matches hyphen-prefixed derivatives", () => {
    expect(tagMatches(["en:peanut-oil"], PEANUT_PROFILE.positiveTags)).toBe(true);
  });

  it("is robust to case and whitespace", () => {
    expect(tagMatches([" EN:PEANUTS "], PEANUT_PROFILE.positiveTags)).toBe(true);
  });

  it("does not match unrelated tags", () => {
    expect(tagMatches(["en:tree-nuts", "en:nuts"], PEANUT_PROFILE.positiveTags)).toBe(false);
  });
});

describe("textContainsKeyword", () => {
  it("returns false for empty text", () => {
    expect(textContainsKeyword("", PEANUT_PROFILE.textKeywords)).toBe(false);
  });

  it("matches multilingual peanut terms", () => {
    for (const text of [
      "Sugar, peanuts, salt",
      "Enthält Erdnüsse",
      "huile d'arachide",
      "cacahuète grillée",
      "ERDNUSS",
    ]) {
      expect(textContainsKeyword(text, PEANUT_PROFILE.textKeywords)).toBe(true);
    }
  });
});

describe("detectPeanut", () => {
  it("returns KEINE_DATEN for null input", () => {
    expect(detectPeanut(null)).toEqual({ status: "KEINE_DATEN", reason: "insufficient-data" });
  });

  it("returns KEINE_DATEN when no allergen and no ingredient data exist", () => {
    expect(detectPeanut(fields())).toEqual({
      status: "KEINE_DATEN",
      reason: "insufficient-data",
    });
  });

  it("returns JA from allergens_tags", () => {
    expect(detectPeanut(fields({ allergens_tags: ["en:peanuts"] }))).toEqual({
      status: "JA",
      reason: "tag-allergen",
    });
  });

  it("returns JA from ingredients_tags", () => {
    expect(detectPeanut(fields({ ingredients_tags: ["en:sugar", "en:peanut"] }))).toEqual({
      status: "JA",
      reason: "tag-ingredient",
    });
  });

  it("returns JA from ingredients_text keyword", () => {
    expect(
      detectPeanut(fields({ ingredients_text: "Zucker, Erdnüsse, Salz" })),
    ).toEqual({ status: "JA", reason: "text-keyword" });
  });

  it("returns SPUREN when peanut is only in traces", () => {
    expect(
      detectPeanut(
        fields({ traces_tags: ["en:peanuts"], ingredients_text: "Zucker, Salz" }),
      ),
    ).toEqual({ status: "SPUREN", reason: "tag-traces" });
  });

  it("prioritizes JA over SPUREN when peanut is in both allergens and traces", () => {
    expect(
      detectPeanut(
        fields({ allergens_tags: ["en:peanuts"], traces_tags: ["en:peanuts"] }),
      ),
    ).toEqual({ status: "JA", reason: "tag-allergen" });
  });

  it("returns NEIN when data exists and no peanut hint is found", () => {
    expect(
      detectPeanut(
        fields({
          allergens_tags: ["en:milk"],
          ingredients_text: "Zucker, Milch, Salz",
          ingredients_tags: ["en:sugar", "en:milk"],
        }),
      ),
    ).toEqual({ status: "NEIN", reason: "clean" });
  });

  it("returns NEIN for tree nuts that are not peanuts", () => {
    expect(
      detectPeanut(
        fields({ allergens_tags: ["en:nuts"], traces_tags: ["en:tree-nuts"] }),
      ),
    ).toEqual({ status: "NEIN", reason: "clean" });
  });
});

describe("detectAllergen extensibility", () => {
  const HAZELNUT: AllergenProfile = {
    key: "hazelnut",
    positiveTags: ["en:hazelnut", "en:hazelnuts"],
    textKeywords: ["hazelnut", "haselnuss", "noisette"],
  };

  it("works with a different allergen profile", () => {
    expect(
      detectAllergen(fields({ ingredients_text: "Zucker, Haselnüsse" }), HAZELNUT),
    ).toEqual({ status: "JA", reason: "text-keyword" });
    expect(
      detectAllergen(fields({ ingredients_text: "Zucker, Erdnüsse" }), HAZELNUT),
    ).toEqual({ status: "NEIN", reason: "clean" });
  });
});
