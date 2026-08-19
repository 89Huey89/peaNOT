import type { AllergenStatus, OffProductFields } from "@/lib/types";
import { hasValidCheckDigit, isRestrictedCirculationCode } from "@/lib/barcode";

/**
 * A caveat qualifies an otherwise clean result. Caveats never turn a hit into
 * an all-clear — they only ever make a result less reassuring, which is why
 * they are attached to NEIN/KEINE_DATEN and never to JA/SPUREN.
 */
export type CaveatKey = "restricted-code" | "checksum-mismatch" | "traces-unknown";

export interface CaveatCopy {
  /** Heading of the caveat card. */
  title: string;
  /** Full explanation shown on the result screen. */
  detail: string;
  /** One clause, folded into the verdict detail line. */
  short: string;
}

export const CAVEATS: Record<CaveatKey, CaveatCopy> = {
  "restricted-code": {
    title: "Barcode ist nicht eindeutig",
    detail:
      "Dieser Code stammt aus dem Nummernbereich für Handels-Eigencodes (z. B. Lidl, Aldi, Metzgerei-Waage). Solche Codes sind nicht weltweit eindeutig: derselbe Code kann in einem anderen Land oder bei einem anderen Händler für ein völlig anderes Produkt vergeben sein. Vergleiche Foto, Marke und Zutaten mit deiner Packung.",
    short: "Der Barcode ist ein Handels-Eigencode und nicht weltweit eindeutig.",
  },
  "checksum-mismatch": {
    title: "Prüfziffer passt nicht",
    detail:
      "Die letzte Ziffer dieses Codes passt nicht zur GS1-Prüfregel. Entweder wurde der Barcode falsch gelesen oder es ist kein Standard-Barcode. Der gefundene Eintrag kann zu einem anderen Produkt gehören — bitte neu scannen oder die Ziffern von Hand prüfen.",
    short: "Die Prüfziffer des Codes passt nicht.",
  },
  "traces-unknown": {
    title: "Keine Spurenangabe hinterlegt",
    detail:
      "Der Datensatz enthält kein Feld zu möglichen Spuren. „Kann Spuren von … enthalten“ ist eine freiwillige Herstellerangabe und in der Datenbank häufig gar nicht erfasst. Fehlende Spuren heißen hier also nicht geprüft spurenfrei — die Angabe auf der Packung entscheidet.",
    short: "Zu möglichen Spuren ist im Datensatz nichts hinterlegt.",
  },
};

/**
 * Collect the caveats that apply to a lookup. Fail-safe by construction: a
 * JA/SPUREN verdict is never qualified, and every caveat below can only
 * downgrade an all-clear, never upgrade a warning.
 */
export function detectCaveats(
  barcode: string,
  status: AllergenStatus,
  fields: OffProductFields | null,
): CaveatKey[] {
  if (status === "JA" || status === "SPUREN") return [];

  const keys: CaveatKey[] = [];

  // Both say "this record may not be your product"; the checksum failure is
  // the stronger signal, so it stands in for the prefix warning.
  if (!hasValidCheckDigit(barcode)) {
    keys.push("checksum-mismatch");
  } else if (isRestrictedCirculationCode(barcode)) {
    keys.push("restricted-code");
  }

  // Only meaningful where the absence of traces was read as an all-clear.
  if (status === "NEIN" && fields !== null && fields.traces_tags.length === 0) {
    keys.push("traces-unknown");
  }

  return keys;
}

/** Verdict detail line for a qualified all-clear. */
export function caveatSummary(keys: CaveatKey[]): string {
  return keys.map((key) => CAVEATS[key].short).join(" ");
}
