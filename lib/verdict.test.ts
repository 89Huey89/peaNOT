import { describe, expect, it } from "vitest";
import { statusToVerdict, VERDICT, verdictColor, verdictGlyph } from "@/lib/verdict";
import { palette } from "@/lib/theme";

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

describe("VERDICT copy", () => {
  it("has German labels for every verdict", () => {
    expect(VERDICT.safe.label).toBe("Keine Erdnuss");
    expect(VERDICT.danger.label).toBe("Erdnuss enthalten");
    expect(VERDICT.trace.label).toBe("Spuren möglich");
    expect(VERDICT.unknown.label).toBe("Unbekannt");
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
