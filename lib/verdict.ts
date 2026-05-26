import type { AllergenHit, PeanutStatus } from "@/lib/types";
import type { Palette } from "@/lib/theme";
import type { AllergenProfile } from "@/lib/allergens/profile";

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

// Visual + allergen-neutral copy. `label` is the short, allergen-neutral word
// used in history/scan lists; the allergen-specific words (tag/title/detail and
// an allergen-aware label) are produced by verdictCopy() from the selection.
interface VerdictVisual {
  colorKey: "GREEN" | "RED" | "AMBER" | "DIM";
  label: string; // short, neutral, for lists
  headline: string; // italic Fraunces sentence
  stampWord: string;
  stampSub: string;
}

export const VERDICT: Record<Verdict, VerdictVisual> = {
  safe: {
    colorKey: "GREEN",
    label: "Sicher",
    headline: "Geprüft. Du kannst beruhigt sein.",
    stampWord: "safe",
    stampSub: "all · clear",
  },
  danger: {
    colorKey: "RED",
    label: "Treffer",
    headline: "Achtung. Bitte nicht essen.",
    stampWord: "stop",
    stampSub: "stop · alert",
  },
  trace: {
    colorKey: "AMBER",
    label: "Spuren möglich",
    headline: "Vorsicht. Hier sind Spuren möglich.",
    stampWord: "achtung",
    stampSub: "spuren",
  },
  unknown: {
    colorKey: "DIM",
    label: "Unbekannt",
    headline: "Dieses Produkt kennen wir noch nicht.",
    stampWord: "unklar",
    stampSub: "no · data",
  },
};

export interface VerdictCopy extends VerdictVisual {
  tag: string; // mono kicker on the verdict bar
  title: string; // big Fraunces verdict
  detail: string; // explanatory line
}

function joinLabels(hits: AllergenHit[], status: PeanutStatus): string {
  return hits
    .filter((h) => h.status === status)
    .map((h) => h.label)
    .join(", ");
}

/**
 * Build the allergen-aware verdict copy. Single selection reads like the
 * original peanut wording ("Keine Erdnuss."); multi selection summarizes across
 * the chosen allergens, naming the offenders from the per-allergen hits.
 */
export function verdictCopy(
  verdict: Verdict,
  profiles: AllergenProfile[],
  hits: AllergenHit[] = [],
): VerdictCopy {
  const visual = VERDICT[verdict];
  const single = profiles.length === 1 ? profiles[0] : undefined;

  let copy: { label: string; tag: string; title: string; detail: string };

  if (single) {
    const label = single.label;
    const lower = label.toLowerCase();
    copy = {
      safe: {
        label: `Keine ${label}`,
        tag: `keine ${lower}`,
        title: `Keine ${label}.`,
        detail: "Keine Hinweise in Zutaten oder Allergenliste.",
      },
      danger: {
        label: `${label} enthalten`,
        tag: `enthält ${lower}`,
        title: `${label} enthalten.`,
        detail: "In der Zutatenliste explizit aufgeführt.",
      },
      trace: {
        label: "Spuren möglich",
        tag: "spuren möglich",
        title: "Spuren möglich.",
        detail: `Hersteller-Hinweis auf mögliche Spuren von ${label}.`,
      },
      unknown: {
        label: "Unbekannt",
        tag: "keine daten",
        title: "Keine Daten.",
        detail: `Wir können ${label} nicht ausschließen.`,
      },
    }[verdict];
  } else {
    const danger = joinLabels(hits, "JA");
    const traces = joinLabels(hits, "SPUREN");
    copy = {
      safe: {
        label: "Alles frei",
        tag: "alles frei",
        title: "Alles frei.",
        detail: "Keine deiner Allergene gefunden.",
      },
      danger: {
        label: "Treffer",
        tag: "treffer",
        title: "Treffer.",
        detail: danger ? `Enthält: ${danger}.` : "Enthält eines deiner Allergene.",
      },
      trace: {
        label: "Spuren möglich",
        tag: "spuren möglich",
        title: "Spuren möglich.",
        detail: traces
          ? `Mögliche Spuren: ${traces}.`
          : "Hersteller-Hinweis auf mögliche Spuren.",
      },
      unknown: {
        label: "Unbekannt",
        tag: "keine daten",
        title: "Keine Daten.",
        detail: "Wir können deine Allergene nicht ausschließen.",
      },
    }[verdict];
  }

  return { ...visual, ...copy };
}

export function verdictColor(verdict: Verdict, P: Palette): string {
  return P[VERDICT[verdict].colorKey];
}

// A distinct shape per verdict so status is legible without relying on color
// alone (e.g. for color-blind users).
const VERDICT_GLYPH: Record<Verdict, string> = {
  safe: "✓",
  danger: "✕",
  trace: "⚠",
  unknown: "?",
};

export function verdictGlyph(verdict: Verdict): string {
  return VERDICT_GLYPH[verdict];
}
