import { describe, expect, it } from "vitest";
import { buildAllergenChecklist } from "@/lib/allergens/checklist";
import { ALLERGEN_LIST, getProfiles } from "@/lib/allergens/profile";
import { normalizeText } from "@/lib/text";

describe("buildAllergenChecklist", () => {
  it("returns one entry per profile, in input order", () => {
    const out = buildAllergenChecklist(getProfiles(["soy", "peanut"]));
    expect(out.map((c) => c.key)).toEqual(["soy", "peanut"]);
    expect(out.map((c) => c.label)).toEqual(["Soja", "Erdnuss"]);
  });

  it("capitalizes each word of a multi-word keyword", () => {
    const [peanut] = buildAllergenChecklist(getProfiles(["peanut"]));
    expect(peanut!.terms).toContain("Ground Nut");
    expect(peanut!.terms).toContain("Erdnuss");
    expect(peanut!.terms).not.toContain("ground nut");
  });

  it("deduplicates case-insensitively while keeping first-seen order", () => {
    const [checklist] = buildAllergenChecklist([
      {
        key: "test",
        label: "Test",
        positiveTags: ["en:test"],
        textKeywords: ["milch", "Milch".toLowerCase(), "sahne", "milch"],
      },
    ]);
    expect(checklist!.terms).toEqual(["Milch", "Sahne"]);
  });

  it("never returns an empty terms list for a real profile", () => {
    for (const checklist of buildAllergenChecklist(ALLERGEN_LIST)) {
      expect(checklist.terms.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty array for an empty selection", () => {
    expect(buildAllergenChecklist([])).toEqual([]);
  });

  it("only rearranges casing/spacing — never invents or drops a matched substring", () => {
    for (const profile of ALLERGEN_LIST) {
      const [checklist] = buildAllergenChecklist([profile]);
      for (const term of checklist!.terms) {
        // Reversing the display formatting must land back on a normalized
        // keyword this profile actually matches against ingredient text —
        // the checklist can never show a word the engine doesn't look for.
        expect(profile.textKeywords).toContain(normalizeText(term).replace(/-/g, " "));
      }
    }
  });
});
