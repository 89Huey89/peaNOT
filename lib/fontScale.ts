// "Größere Schrift" (Profile setting) — a coarse, opt-in text scale for the
// reading path (Ergebnis/Scan/Verlauf), since neither iOS Dynamic Type nor
// Safari's page zoom reaches an installed standalone PWA (see README/a11y
// review). Off by default; never affects verdict logic, only presentation.
export type FontScale = "normal" | "gross" | "sehr-gross";

export const FONT_SCALES: FontScale[] = ["normal", "gross", "sehr-gross"];

export const FONT_SCALE_LABEL: Record<FontScale, string> = {
  normal: "Normal",
  gross: "Groß",
  "sehr-gross": "Sehr groß",
};

export const FONT_SCALE_FACTOR: Record<FontScale, number> = {
  normal: 1,
  gross: 1.15,
  "sehr-gross": 1.3,
};
