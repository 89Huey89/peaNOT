import type { AllergenHit, PeanutStatus } from "@/lib/types";
import type { Palette } from "@/lib/theme";
import type { AllergenProfile } from "@/lib/allergens/profile";
import { caveatSummary, type CaveatKey } from "@/lib/caveats";

// The result UI speaks in five "verdicts"; the detection engine speaks in four
// statuses. This is the single place that maps between them. "partial" has no
// status of its own: it is a clean result whose confidence is limited by a
// caveat (see resolveVerdict).
export type Verdict = "safe" | "danger" | "trace" | "partial" | "unknown";

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

/**
 * The verdict actually shown. A clean result carrying caveats becomes
 * "partial": we found nothing, but something limits how much that is worth.
 * Hits and traces are never softened, and an unknown never becomes greener.
 */
export function resolveVerdict(
  status: PeanutStatus,
  caveats: CaveatKey[] = [],
): Verdict {
  const verdict = statusToVerdict(status);
  return verdict === "safe" && caveats.length > 0 ? "partial" : verdict;
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
    headline: "Keine Hinweise in den Daten gefunden.",
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
  partial: {
    colorKey: "AMBER",
    label: "Mit Vorbehalt",
    headline: "Kein Treffer — aber mit Vorbehalt.",
    stampWord: "vorbehalt",
    stampSub: "packung · prüfen",
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
 *
 * The "partial" detail line is assembled from the caveats, so the screen says
 * *why* the all-clear is qualified instead of just looking amber.
 */
export function verdictCopy(
  verdict: Verdict,
  profiles: AllergenProfile[],
  hits: AllergenHit[] = [],
  caveats: CaveatKey[] = [],
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
        detail: "Keine Hinweise in den hinterlegten Daten. Maßgeblich ist immer die Packung.",
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
      partial: {
        label: `Keine ${label} (Vorbehalt)`,
        tag: `keine ${lower} · vorbehalt`,
        title: `Keine ${label} in den Zutaten.`,
        detail: caveatSummary(caveats) || "Das Ergebnis ist nur eingeschränkt belastbar.",
      },
      unknown: {
        label: "Unbekannt",
        tag: "keine daten",
        title: "Keine Daten.",
        detail: `Wir können ${label} nicht ausschließen.`,
      },
    }[verdict];
  } else {
    const dangerHits = hits.filter((h) => h.status === "JA").map((h) => h.label);
    const danger = dangerHits.join(", ");
    const traces = joinLabels(hits, "SPUREN");
    // Up to two offenders fit in the big glance-level title ("Erdnuss & Soja
    // enthalten."); beyond that it would overflow, so it falls back to the
    // generic "Treffer." — the names still live in the detail line below and
    // the per-allergen chip list further down.
    const dangerTitle =
      dangerHits.length > 0 && dangerHits.length <= 2
        ? `${dangerHits.join(" & ")} enthalten.`
        : "Treffer.";
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
        title: dangerTitle,
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
      partial: {
        label: "Vorbehalt",
        tag: "vorbehalt",
        title: "Zutaten frei.",
        detail: caveatSummary(caveats) || "Das Ergebnis ist nur eingeschränkt belastbar.",
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
  partial: "!",
  unknown: "?",
};

export function verdictGlyph(verdict: Verdict): string {
  return VERDICT_GLYPH[verdict];
}

// Severity ranking used only to detect a *worsening* change vs. history — it
// never feeds back into the verdict itself. "safe" and "partial" share a rank
// (both are "no allergen found", just with differing confidence), and
// "unknown" has none: going to or from missing data is not a proven change in
// either direction, so it must never trigger the warning.
const VERDICT_SEVERITY: Record<Verdict, number> = {
  safe: 0,
  partial: 0,
  trace: 1,
  danger: 2,
  unknown: -1,
};

/**
 * True when `next` is a strictly worse verdict than `previous` for the same
 * barcode (safe/partial → trace/danger, or trace → danger). Informational
 * only: used to show a warning strip, never to alter either verdict.
 */
export function isVerdictWorsening(previous: Verdict, next: Verdict): boolean {
  const prevRank = VERDICT_SEVERITY[previous];
  const nextRank = VERDICT_SEVERITY[next];
  if (prevRank < 0 || nextRank < 0) return false;
  return nextRank > prevRank;
}
