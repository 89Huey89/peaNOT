import type { PeanutStatus } from "@/lib/types";
import type { Palette } from "@/lib/theme";

// The result UI speaks in four "verdicts"; the detection engine speaks in four
// statuses. This is the single place that maps between them.
export type Verdict = "safe" | "danger" | "trace" | "unknown";

export function statusToVerdict(status: PeanutStatus): Verdict {
  switch (status) {
    case "NEIN":
      return "safe";
    case "JA":
      return "danger";
    case "SPUREN":
      return "trace";
    default:
      return "unknown";
  }
}

interface VerdictCopy {
  colorKey: "GREEN" | "RED" | "AMBER" | "DIM";
  label: string; // short, for lists
  tag: string; // mono kicker on the verdict bar
  headline: string; // italic Fraunces sentence
  title: string; // big Fraunces verdict
  detail: string; // explanatory line
  stampWord: string;
  stampSub: string;
}

export const VERDICT: Record<Verdict, VerdictCopy> = {
  safe: {
    colorKey: "GREEN",
    label: "Keine Erdnuss",
    tag: "keine erdnuss",
    headline: "Geprüft. Du kannst beruhigt sein.",
    title: "Keine Erdnuss.",
    detail: "Keine Hinweise in Zutaten oder Allergenliste.",
    stampWord: "safe",
    stampSub: "peanut · free",
  },
  danger: {
    colorKey: "RED",
    label: "Erdnuss enthalten",
    tag: "enthält erdnuss",
    headline: "Achtung. Bitte nicht essen.",
    title: "Erdnuss enthalten.",
    detail: "In der Zutatenliste explizit aufgeführt.",
    stampWord: "stop",
    stampSub: "enthält · peanut",
  },
  trace: {
    colorKey: "AMBER",
    label: "Spuren möglich",
    tag: "spuren möglich",
    headline: "Vorsicht. Hier sind Spuren möglich.",
    title: "Spuren möglich.",
    detail: "Hersteller-Hinweis auf mögliche Spuren.",
    stampWord: "achtung",
    stampSub: "traces · peanut",
  },
  unknown: {
    colorKey: "DIM",
    label: "Unbekannt",
    tag: "keine daten",
    headline: "Dieses Produkt kennen wir noch nicht.",
    title: "Keine Daten.",
    detail: "Wir haben kein Profil zu diesem Barcode.",
    stampWord: "unklar",
    stampSub: "no · data",
  },
};

export function verdictColor(verdict: Verdict, P: Palette): string {
  return P[VERDICT[verdict].colorKey];
}
