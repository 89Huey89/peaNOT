import { describe, expect, it } from "vitest";
import {
  ALLERGEN_KEYS,
  ALLERGEN_LIST,
  ALLERGEN_PROFILES,
  getProfile,
  getProfiles,
  PEANUT_PROFILE,
} from "@/lib/allergens/profile";
import { normalizeText } from "@/lib/text";

// The 14 EU major allergen groups, plus the individual tree nuts broken out of
// the "tree-nuts" group so a user can pick the specific nut they react to.
const EU_ALLERGEN_KEYS = [
  "peanut",
  "tree-nuts",
  "soy",
  "gluten",
  "milk",
  "eggs",
  "sesame",
  "fish",
  "crustaceans",
  "molluscs",
  "celery",
  "mustard",
  "lupin",
  "sulphites",
];
const INDIVIDUAL_NUT_KEYS = [
  "hazelnut",
  "almond",
  "walnut",
  "cashew",
  "pistachio",
  "pecan",
  "brazilnut",
  "macadamia",
];

describe("allergen registry", () => {
  it("covers the 14 EU groups plus the individual tree nuts, with unique keys", () => {
    for (const key of [...EU_ALLERGEN_KEYS, ...INDIVIDUAL_NUT_KEYS]) {
      expect(ALLERGEN_KEYS).toContain(key);
    }
    expect(ALLERGEN_KEYS).toHaveLength(
      EU_ALLERGEN_KEYS.length + INDIVIDUAL_NUT_KEYS.length,
    );
    expect(new Set(ALLERGEN_KEYS).size).toBe(ALLERGEN_KEYS.length);
  });

  it("keeps peanut as the back-compat default profile", () => {
    expect(PEANUT_PROFILE).toBe(ALLERGEN_PROFILES.peanut);
    expect(getProfile("peanut")?.key).toBe("peanut");
  });

  it("gives every profile a label and non-empty match lists", () => {
    for (const p of ALLERGEN_LIST) {
      expect(ALLERGEN_KEYS).toContain(p.key);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.positiveTags.length).toBeGreaterThan(0);
      expect(p.textKeywords.length).toBeGreaterThan(0);
      expect(p.positiveTags.every((t) => t.startsWith("en:"))).toBe(true);
    }
  });

  it("stores text keywords already normalized (ascii-folded)", () => {
    for (const p of ALLERGEN_LIST) {
      for (const kw of p.textKeywords) {
        expect(normalizeText(kw)).toBe(kw);
      }
    }
  });
});

describe("getProfiles", () => {
  it("preserves input order and drops unknown keys", () => {
    expect(getProfiles(["soy", "bogus", "milk"]).map((p) => p.key)).toEqual([
      "soy",
      "milk",
    ]);
  });

  it("returns an empty array for all-unknown input", () => {
    expect(getProfiles(["nope"])).toEqual([]);
  });
});
