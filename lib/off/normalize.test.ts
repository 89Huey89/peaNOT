import { describe, expect, it } from "vitest";
import {
  extractBrand,
  extractImageUrl,
  extractProductName,
  extractRecordMetadata,
  hasUsableData,
  normalizeOffProduct,
  offThumbUrl,
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

describe("extractRecordMetadata", () => {
  it("reads OFF timestamp and revision metadata", () => {
    expect(
      extractRecordMetadata({ last_modified_t: "1750000000", rev: 12 }),
    ).toEqual({ dataLastModified: 1750000000, dataRevision: 12 });
  });

  it("ignores missing or malformed metadata", () => {
    expect(extractRecordMetadata({ last_modified_t: "unknown", rev: -1 })).toEqual({});
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

describe("extractImageUrl", () => {
  it("prefers the small front image", () => {
    expect(
      extractImageUrl({
        image_front_small_url: "https://img/front-small.jpg",
        image_front_url: "https://img/front.jpg",
        image_url: "https://img/any.jpg",
      }),
    ).toBe("https://img/front-small.jpg");
  });

  it("falls back through the chain then to an empty string", () => {
    expect(extractImageUrl({ image_url: "https://img/any.jpg" })).toBe(
      "https://img/any.jpg",
    );
    expect(extractImageUrl({})).toBe("");
  });
});

describe("offThumbUrl", () => {
  it("downsizes known OFF renditions to 100px", () => {
    const base = "https://images.openfoodfacts.org/images/products/401/120/029/6908/front_de.3";
    expect(offThumbUrl(`${base}.200.jpg`)).toBe(`${base}.100.jpg`);
    expect(offThumbUrl(`${base}.400.jpg`)).toBe(`${base}.100.jpg`);
    expect(offThumbUrl(`${base}.full.jpg`)).toBe(`${base}.100.jpg`);
  });

  it("preserves a trailing query string", () => {
    expect(offThumbUrl("https://img/front_de.3.200.jpg?rev=7")).toBe(
      "https://img/front_de.3.100.jpg?rev=7",
    );
  });

  it("returns the input unchanged when the pattern doesn't match", () => {
    expect(offThumbUrl("https://img/any.png")).toBe("https://img/any.png");
    expect(offThumbUrl("")).toBe("");
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
