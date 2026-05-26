// Direction A — "Bold Stamp" palette: warm cream paper + ink, swappable accent.

export const PAL_BASE = {
  BG: "#f3ead8", // warm cream
  PAPER: "#fffdf6", // card paper
  INK: "#16140f", // ink black
  DIM: "#6b6555",
  GREEN: "#1f6b3a",
  RED: "#c4321f",
  AMBER: "#c97c0a",
} as const;

export const ACCENTS = {
  mustard: "#d68a1a",
  clay: "#c2502e",
  olive: "#5b6b1f",
} as const;

export type Accent = keyof typeof ACCENTS;

export type Palette = typeof PAL_BASE & { ACCENT: string };

export function palette(accent: Accent = "mustard"): Palette {
  return { ...PAL_BASE, ACCENT: ACCENTS[accent] ?? ACCENTS.mustard };
}
