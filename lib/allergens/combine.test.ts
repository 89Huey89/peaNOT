import { describe, expect, it } from "vitest";
import { combineStatus, detectAllergens } from "@/lib/allergens/combine";
import { getProfiles } from "@/lib/allergens/profile";
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

describe("combineStatus (worst case wins)", () => {
  it("returns KEINE_DATEN for an empty set", () => {
    expect(combineStatus([])).toBe("KEINE_DATEN");
  });

  it("lets JA dominate everything", () => {
    expect(combineStatus(["NEIN", "SPUREN", "JA", "KEINE_DATEN"])).toBe("JA");
  });

  it("prefers SPUREN over NEIN/KEINE_DATEN when no JA", () => {
    expect(combineStatus(["NEIN", "SPUREN", "KEINE_DATEN"])).toBe("SPUREN");
  });

  it("is NEIN only when every allergen is clean", () => {
    expect(combineStatus(["NEIN", "NEIN"])).toBe("NEIN");
  });

  it("falls back to KEINE_DATEN when a clean check is mixed with unknown", () => {
    expect(combineStatus(["NEIN", "KEINE_DATEN"])).toBe("KEINE_DATEN");
  });
});

describe("detectAllergens", () => {
  it("produces one hit per profile and an overall verdict", () => {
    const { overall, hits } = detectAllergens(
      fields({
        allergens_tags: ["en:milk"],
        ingredients_text: "Zucker, Milch, Sojalecithin",
      }),
      getProfiles(["peanut", "milk", "soy"]),
    );
    expect(hits.map((h) => h.key)).toEqual(["peanut", "milk", "soy"]);
    expect(hits.find((h) => h.key === "milk")?.status).toBe("JA");
    expect(hits.find((h) => h.key === "soy")?.status).toBe("JA");
    expect(hits.find((h) => h.key === "peanut")?.status).toBe("NEIN");
    expect(overall).toBe("JA");
  });

  it("populates the evidence mention for hits found in text", () => {
    const { hits } = detectAllergens(
      fields({ ingredients_text: "Zucker, Sojamehl, Salz" }),
      getProfiles(["soy"]),
    );
    expect(hits[0]?.found).toBe("Sojamehl");
  });

  it("does not attach evidence for clean allergens", () => {
    const { hits } = detectAllergens(
      fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
      getProfiles(["peanut"]),
    );
    expect(hits[0]?.status).toBe("NEIN");
    expect(hits[0]?.found).toBeNull();
  });
});
