import { describe, expect, it } from "vitest";
import {
  statusToVerdict,
  VERDICT,
  verdictColor,
  verdictCopy,
  verdictGlyph,
} from "@/lib/verdict";
import { palette } from "@/lib/theme";
import { getProfiles } from "@/lib/allergens/profile";
import type { AllergenHit } from "@/lib/types";

describe("statusToVerdict", () => {
  it.each([
    ["NEIN", "safe"],
    ["JA", "danger"],
    ["SPUREN", "trace"],
    ["KEINE_DATEN", "unknown"],
  ] as const)("maps %s to %s", (status, verdict) => {
    expect(statusToVerdict(status)).toBe(verdict);
  });
});

describe("verdictColor", () => {
  const P = palette("mustard");
  it("uses palette colors per verdict", () => {
    expect(verdictColor("safe", P)).toBe(P.GREEN);
    expect(verdictColor("danger", P)).toBe(P.RED);
    expect(verdictColor("trace", P)).toBe(P.AMBER);
    expect(verdictColor("unknown", P)).toBe(P.DIM);
  });
});

describe("verdictCopy single selection", () => {
  const peanut = getProfiles(["peanut"]);

  it("reads like the original peanut wording", () => {
    expect(verdictCopy("safe", peanut).label).toBe("Keine Erdnuss");
    expect(verdictCopy("danger", peanut).title).toBe("Erdnuss enthalten.");
    expect(verdictCopy("trace", peanut).title).toBe("Spuren möglich.");
  });

  it("uses the chosen allergen's name", () => {
    const milk = getProfiles(["milk"]);
    expect(verdictCopy("danger", milk).title).toBe("Milch enthalten.");
    expect(verdictCopy("unknown", milk).detail).toContain("Milch");
  });

  it("carries visual fields through from VERDICT", () => {
    expect(verdictCopy("safe", peanut).headline).toBe(VERDICT.safe.headline);
    expect(verdictCopy("danger", peanut).stampWord).toBe(VERDICT.danger.stampWord);
  });
});

describe("verdictCopy multi selection", () => {
  const profiles = getProfiles(["peanut", "milk", "soy"]);

  it("names the offending allergens on a hit", () => {
    const hits: AllergenHit[] = [
      { key: "peanut", label: "Erdnuss", status: "NEIN" },
      { key: "milk", label: "Milch", status: "JA" },
      { key: "soy", label: "Soja", status: "JA" },
    ];
    const detail = verdictCopy("danger", profiles, hits).detail;
    expect(detail).toContain("Milch");
    expect(detail).toContain("Soja");
    expect(detail).not.toContain("Erdnuss");
  });

  it("lists possible traces", () => {
    const hits: AllergenHit[] = [
      { key: "peanut", label: "Erdnuss", status: "SPUREN" },
      { key: "milk", label: "Milch", status: "NEIN" },
    ];
    expect(verdictCopy("trace", profiles, hits).detail).toContain("Erdnuss");
  });

  it("uses a generic all-clear title", () => {
    expect(verdictCopy("safe", profiles).title).toBe("Alles frei.");
  });
});

describe("verdictGlyph", () => {
  it("returns a distinct, non-color cue per verdict", () => {
    const glyphs = [
      verdictGlyph("safe"),
      verdictGlyph("danger"),
      verdictGlyph("trace"),
      verdictGlyph("unknown"),
    ];
    expect(new Set(glyphs).size).toBe(4);
    glyphs.forEach((g) => expect(g).not.toBe(""));
  });
});
