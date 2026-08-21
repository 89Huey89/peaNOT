import { describe, expect, it } from "vitest";
import { PAL_DARK, PAL_LIGHT } from "@/lib/theme";

// WCAG relative luminance / contrast, so the palette's contrast claims are
// pinned by the suite instead of living only in comments.
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const WEIGHTS = [0.2126, 0.7152, 0.0722];

function byteAt(hex: string, i: number): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return Number.parseInt(full.slice(i * 2, i * 2 + 2), 16);
}

function luminance(hex: string): number {
  return WEIGHTS.reduce((sum, w, i) => sum + w * channel(byteAt(hex, i)), 0);
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Flatten `${COLOR}12`-style tints (the app's card backgrounds) onto a base. */
function tint(hex: string, alphaHex: string, base: string): string {
  const alpha = Number.parseInt(alphaHex, 16) / 255;
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const mixed = Math.round(byteAt(hex, i) * alpha + byteAt(base, i) * (1 - alpha));
    out += mixed.toString(16).padStart(2, "0");
  }
  return out;
}

const TEXT = 4.5; // WCAG 1.4.3, small text
const NON_TEXT = 3; // WCAG 1.4.11, borders/dots/graphical objects

describe("palette contrast", () => {
  it.each([
    ["light", PAL_LIGHT],
    ["dark", PAL_DARK],
  ])("keeps %s amber text readable on both paper tones", (_mode, P) => {
    expect(ratio(P.AMBER_TEXT, P.BG)).toBeGreaterThanOrEqual(TEXT);
    expect(ratio(P.AMBER_TEXT, P.PAPER)).toBeGreaterThanOrEqual(TEXT);
    // Amber text also sits inside amber-tinted cards (offline, vorbehalt).
    expect(ratio(P.AMBER_TEXT, tint(P.AMBER, "12", P.BG))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ["light", PAL_LIGHT],
    ["dark", PAL_DARK],
  ])("keeps %s amber usable as a border or dot", (_mode, P) => {
    expect(ratio(P.AMBER, P.BG)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(ratio(P.AMBER, P.PAPER)).toBeGreaterThanOrEqual(NON_TEXT);
    // Tightest pairing: a dashed amber frame around its own tinted card.
    expect(ratio(P.AMBER, tint(P.AMBER, "12", P.BG))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each([
    ["light", PAL_LIGHT],
    ["dark", PAL_DARK],
  ])("keeps %s verdict text readable on the page", (_mode, P) => {
    for (const c of [P.INK, P.GREEN, P.RED] as const) {
      expect(ratio(c, P.BG)).toBeGreaterThanOrEqual(TEXT);
      expect(ratio(c, P.PAPER)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it.each([
    ["light", PAL_LIGHT],
    ["dark", PAL_DARK],
  ])("keeps %s glyphs legible on a solid verdict fill", (_mode, P) => {
    for (const fill of [P.GREEN, P.RED, P.AMBER] as const) {
      expect(ratio(P.FILL_TEXT, fill)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });
});
