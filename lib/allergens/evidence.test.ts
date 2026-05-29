import { describe, expect, it } from "vitest";
import { findMention, findPeanutMention } from "@/lib/allergens/evidence";
import { ALLERGEN_PROFILES } from "@/lib/allergens/profile";

describe("findPeanutMention", () => {
  it("finds the German plural with umlaut, preserving the original casing", () => {
    expect(
      findPeanutMention("Rosinen, Cashewkerne, Erdnüsse, Mandeln."),
    ).toBe("Erdnüsse");
  });

  it("finds English and French forms", () => {
    expect(findPeanutMention("Contains peanuts and salt")).toBe("peanuts");
    expect(findPeanutMention("arachides grillées")).toBe("arachides");
  });

  it("returns null when no peanut mention is present", () => {
    expect(findPeanutMention("Reis, Himbeere, Meersalz.")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(findPeanutMention("")).toBeNull();
  });
});

describe("findMention (profile-driven fallback)", () => {
  it("finds a milk term preserving the original token", () => {
    expect(
      findMention("Zucker, Magermilchpulver, Salz", ALLERGEN_PROFILES.milk),
    ).toBe("Magermilchpulver");
  });

  it("matches despite ß without breaking offsets", () => {
    expect(
      findMention("Weizenmehl, Sojaeiweiß, Zucker", ALLERGEN_PROFILES.soy),
    ).toBe("Sojaeiweiß");
  });

  it("matches diacritics by folding each token", () => {
    expect(
      findMention("Sucre, sésame grillé", ALLERGEN_PROFILES.sesame),
    ).toBe("sésame");
  });

  it("returns null when the allergen is absent", () => {
    expect(findMention("Reis, Wasser, Salz", ALLERGEN_PROFILES.fish)).toBeNull();
  });

  it("spans consecutive tokens for a multi-word keyword", () => {
    expect(
      findMention(
        "Schokolade, Brazil nut, Zucker",
        ALLERGEN_PROFILES["tree-nuts"],
      ),
    ).toBe("Brazil nut");
    expect(
      findMention("Wein, Sulfur dioxide, Aromen", ALLERGEN_PROFILES.sulphites),
    ).toBe("Sulfur dioxide");
  });

  it("still prefers a single-token match over a wider window", () => {
    expect(
      findMention("Zucker, Haselnuss, Salz", ALLERGEN_PROFILES["tree-nuts"]),
    ).toBe("Haselnuss");
  });
});
