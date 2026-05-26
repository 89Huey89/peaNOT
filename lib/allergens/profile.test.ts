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

describe("allergen registry", () => {
  it("covers the 14 EU major allergens with unique keys", () => {
    expect(ALLERGEN_KEYS).toHaveLength(14);
    expect(new Set(ALLERGEN_KEYS).size).toBe(14);
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
