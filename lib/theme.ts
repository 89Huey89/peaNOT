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
  AMBER: "#c97c0a",
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
