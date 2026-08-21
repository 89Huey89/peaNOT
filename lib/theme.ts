// Direction A — "Bold Stamp" palette: warm cream paper + ink, swappable accent.
// Light + dark variants share the same shape; `OUTER` colors the area around the
// phone-width app column (and behind safe-area insets).

export const PAL_LIGHT = {
  BG: "#f3ead8", // warm cream
  PAPER: "#fffdf6", // card paper
  INK: "#16140f", // ink black
  DIM: "#6b6555",
  GREEN: "#1f6b3a",
  RED: "#c4321f",
  // Amber is the fill/border/dot color, so it has to clear the 3:1 non-text
  // floor against cream (3.48:1), paper (4.09:1) and its own `${AMBER}12` card
  // tint (3.23:1) — the tightest pairing, since a dashed amber frame sits right
  // on that tint. Anything lighter fails there.
  AMBER: "#b46b04",
  // Still short of the 4.5:1 small-text floor, so amber *text* (kickers, chip
  // labels, the stamp word) uses AMBER_TEXT: 5.15:1 on BG / 6.04:1 on PAPER.
  // Undimmed — an opacity below 1 hands the contrast straight back.
  AMBER_TEXT: "#8a5606",
  // Foreground for a glyph/mark/banner sitting on a solid GREEN/RED/AMBER
  // fill. White reads fine against light mode's dark, saturated fills.
  FILL_TEXT: "#fff",
  OUTER: "#e7dcc4",
} as const;

export const PAL_DARK = {
  BG: "#16140f", // ink-dark paper
  PAPER: "#221f18", // raised card
  INK: "#f3ead8", // warm cream text
  DIM: "#a59d89",
  GREEN: "#5cbd7e",
  RED: "#ef6450",
  AMBER: "#e3a13a",
  // Dark mode's AMBER is already >8:1 on BG/PAPER as text, so no separate
  // darker token is needed here — it exists only to balance PAL_LIGHT's shape.
  AMBER_TEXT: "#e3a13a",
  // Dark mode's fills (GREEN/RED/AMBER) are bright pastels: white text on them
  // falls to ~2.2-3.2:1. Ink-dark clears >7:1 on all three.
  FILL_TEXT: "#16140f",
  OUTER: "#0c0b08",
} as const;

export const ACCENTS = {
  mustard: "#d68a1a",
  clay: "#c2502e",
  olive: "#5b6b1f",
} as const;

export type Accent = keyof typeof ACCENTS;
export type ThemeMode = "light" | "dark" | "system";

export type Palette = { [K in keyof typeof PAL_LIGHT]: string } & { ACCENT: string };

export function palette(accent: Accent = "mustard", mode: "light" | "dark" = "light"): Palette {
  const base = mode === "dark" ? PAL_DARK : PAL_LIGHT;
  return { ...base, ACCENT: ACCENTS[accent] ?? ACCENTS.mustard };
}
