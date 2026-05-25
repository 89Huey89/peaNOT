import { describe, expect, it } from "vitest";
import {
  extractBrand,
  extractProductName,
  hasUsableData,
  normalizeOffProduct,
} from "@/lib/off/normalize";

describe("normalizeOffProduct", () => {
  it("populates all fields from a full product", () => {
    expect(
      normalizeOffProduct({
        allergens_tags: ["en:peanuts"],
        traces_tags: ["en:milk"],
        ingredients_tags: ["en:sugar"],
        ingredients_text: "Sugar, peanuts",
      }),
    ).toEqual({
      allergens_tags: ["en:peanuts"],
      traces_tags: ["en:milk"],
      ingredients_tags: ["en:sugar"],
      ingredients_text: "Sugar, peanuts",
    });
  });

  it("defaults missing arrays and text", () => {
    expect(normalizeOffProduct({})).toEqual({
      allergens_tags: [],
      traces_tags: [],
      ingredients_tags: [],
      ingredients_text: "",
    });
  });

  it("prefers German ingredient text", () => {
    expect(
      normalizeOffProduct({
        ingredients_text: "Sugar, peanuts",
        ingredients_text_de: "Zucker, Erdnüsse",
      }).ingredients_text,
    ).toBe("Zucker, Erdnüsse");
  });

  it("coerces malformed input safely", () => {
    expect(
      normalizeOffProduct({
        allergens_tags: "not-an-array",
        ingredients_tags: [1, "en:sugar", null],
        ingredients_text: 42,
      }),
    ).toEqual({
      allergens_tags: [],
      traces_tags: [],
      ingredients_tags: ["en:sugar"],
      ingredients_text: "",
    });
  });

  it("handles null/undefined input", () => {
    expect(normalizeOffProduct(null)).toEqual({
      allergens_tags: [],
      traces_tags: [],
      ingredients_tags: [],
      ingredients_text: "",
    });
  });
});

describe("extractProductName", () => {
  it("prefers German name", () => {
    expect(
      extractProductName({ product_name: "Peanut Bar", product_name_de: "Erdnussriegel" }),
    ).toBe("Erdnussriegel");
  });

  it("falls back to generic name then empty string", () => {
    expect(extractProductName({ product_name: "Peanut Bar" })).toBe("Peanut Bar");
    expect(extractProductName({})).toBe("");
  });
});

describe("extractBrand", () => {
  it("returns the first brand", () => {
    expect(extractBrand({ brands: "Ferrero, Nutella" })).toBe("Ferrero");
    expect(extractBrand({})).toBe("");
  });
});

describe("hasUsableData", () => {
  it("is false when everything is empty", () => {
    expect(
      hasUsableData({
        allergens_tags: [],
        traces_tags: [],
        ingredients_tags: [],
        ingredients_text: "",
      }),
    ).toBe(false);
  });

  it("is true with any data present", () => {
    expect(
      hasUsableData({
        allergens_tags: [],
        traces_tags: [],
        ingredients_tags: [],
        ingredients_text: "Sugar",
      }),
    ).toBe(true);
  });
});
