import { offProductUrl } from "@/lib/off/link";

/**
 * Plain-text share body for the "Teilen" button (F6). Callers pass exactly
 * the label/detail already shown on the result card — never re-derived here
 * — so a shared message can never drift from what the screen itself says:
 * a partial result's caveat wording, an unknown result's "kann nicht
 * ausgeschlossen werden", a pack-mismatch note, all carry over unchanged.
 * Never a bare "sicher" divorced from the fail-safe framing behind it.
 */
export interface ShareInput {
  productName: string | null;
  brand: string | null;
  barcode: string;
  /** Verdict label as shown on the result card (e.g. "Keine Erdnuss (Vorbehalt)"). */
  label: string;
  /** The explanatory line as shown on the result card. */
  detail: string;
}

export function buildShareText(input: ShareInput): string {
  const name = input.productName?.trim() || "Unbekanntes Produkt";
  const brand = input.brand?.trim();
  return [
    `peaNOT-Check: ${name}${brand ? ` · ${brand}` : ""}`,
    `EAN ${input.barcode}`,
    `${input.label} — ${input.detail}`,
    offProductUrl(input.barcode),
  ].join("\n");
}
