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

/**
 * Plain-text share body for "Liste teilen" (G) in the history screen — the
 * round *before* buildShareText's single result: a shopping companion gets a
 * readable list of everything already checked, so they don't have to guess
 * in the aisle.
 *
 * One row per already-checked product. `label` must be the verdict label
 * exactly as shown on screen (VERDICT[verdict].label from lib/verdict.ts) —
 * never re-worded here — so a hit, a trace warning, a "Vorbehalt", or an
 * "Unbekannt" reads in the shared text exactly as firmly as it does on the
 * device. Callers only ever pass entries whose verdict is "safe" without
 * caveats (resolveVerdict already routes a caveated clean result to
 * "partial"), so a bare "Sicher" here carries the same weight it does in the
 * history list itself.
 */
export interface ShareListItem {
  /** Product name, already resolved to "Unbekanntes Produkt" if missing. */
  name: string;
  /** Brand, already resolved to a placeholder ("—") if missing. */
  brand: string;
  barcode: string;
  /** Verdict label as shown in the history row (VERDICT[...].label). */
  label: string;
  /** When this product was checked, epoch milliseconds. */
  ts: number;
}

// A list beyond this length turns into an unreadable wall of text and can
// exceed what some share targets (SMS bodies, some messenger previews)
// accept. Cut it off — but say so in the text (see the "… und N weitere"
// line below), because a silent cut would look like a complete list.
const SHARE_LIST_LIMIT = 30;

// Read later, away from the app: relative wording like "Heute" or "Gestern"
// (formatRelative, lib/time.ts) is exactly right for a screen the same
// person is looking at *now*, but it goes stale — and actively misleading —
// the moment the message sits unread for a day. A shared list is read
// asynchronously by someone who may never open the app at all, so every row
// gets a fixed calendar date (+ time) instead: it reads the same whether
// opened a minute or three months after sending.
function formatShareTimestamp(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Same reminder the app repeats at every other point where a verdict is
// shown (see verdictCopy's "safe" detail, README's "Vorbehalte"): the
// recipe/packaging behind a given EAN can change, so a snapshot from the app
// is never a substitute for reading the pack in hand.
const SHARE_LIST_FOOTER =
  "Momentaufnahme aus der App zum Zeitpunkt der Prüfung — maßgeblich bleibt immer die Packung in der Hand: Rezeptur und Verpackung können sich bei gleicher EAN ändern.";

export function buildShareListText(items: ShareListItem[]): string {
  if (items.length === 0) return "";

  const shown = items.slice(0, SHARE_LIST_LIMIT);
  const omitted = items.length - shown.length;

  const lines = shown.map((it) => {
    const brand = it.brand.trim();
    const hasBrand = brand && brand !== "—";
    return `• ${it.name}${hasBrand ? ` · ${brand}` : ""} — ${it.label} · geprüft ${formatShareTimestamp(it.ts)} (EAN ${it.barcode})`;
  });

  return [
    `peaNOT-Check: ${items.length} geprüfte ${items.length === 1 ? "Produkt" : "Produkte"}`,
    "",
    ...lines,
    ...(omitted > 0 ? [`… und ${omitted} weitere.`] : []),
    "",
    SHARE_LIST_FOOTER,
  ].join("\n");
}
