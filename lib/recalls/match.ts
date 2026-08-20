import type { RecallMatch } from "@/lib/types";
import type { RecallWarning } from "@/lib/recalls/client";

/**
 * Official recall notices carry product names, not barcodes — so the only
 * possible link to a scanned product is its name. That makes this a fuzzy,
 * warn-only comparison: a match can add a warning card, and by construction
 * nothing here can ever make a verdict greener.
 */

/** Filler tokens that would create matches without meaning anything. */
const STOPWORDS = new Set([
  "und",
  "mit",
  "von",
  "aus",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "fuer",
  "ohne",
  "gramm",
  "kilogramm",
  "liter",
  "milliliter",
  "stueck",
  "packung",
  "beutel",
  "glas",
  "dose",
  "diverse",
  "verschiedene",
  "sorten",
  "sorte",
]);

/** Lowercase, fold umlauts/diacritics, drop punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distinct, meaningful tokens: 3+ chars, not a bare number, not filler. */
export function tokenize(text: string): string[] {
  const seen = new Set<string>();
  for (const token of normalizeText(text).split(" ")) {
    if (token.length < 3) continue;
    if (/^\d+$/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    seen.add(token);
  }
  return [...seen];
}

/**
 * Does this warning plausibly describe the scanned product? A single shared
 * word ("Erdnüsse") must never be enough — that would flag every peanut
 * product whenever any peanut recall is live. We require most of the product
 * name to reappear in the notice, with a lower bar when the brand matches too.
 */
function warningMatches(
  nameTokens: string[],
  brandTokens: string[],
  warning: RecallWarning,
): boolean {
  if (nameTokens.length === 0) return false;

  const haystack = new Set(tokenize(`${warning.title} ${warning.extraText}`));
  const matched = nameTokens.filter((t) => haystack.has(t)).length;
  if (matched === 0) return false;

  const coverage = matched / nameTokens.length;
  const brandHit = brandTokens.some((t) => haystack.has(t));

  if (brandHit) return coverage >= 0.6;
  return matched >= 3 && coverage >= 0.85;
}

/** Cap so one product never buries the result screen under notices. */
const MAX_MATCHES = 3;

/**
 * All warnings that plausibly concern the product, newest first. Name and
 * brand come from the Open Food Facts record of the scanned barcode.
 */
export function findRecallMatches(
  productName: string | null,
  brand: string | null,
  warnings: RecallWarning[],
): RecallMatch[] {
  const nameTokens = tokenize(productName ?? "");
  const brandTokens = tokenize(brand ?? "");

  return warnings
    .filter((w) => warningMatches(nameTokens, brandTokens, w))
    .sort((a, b) => (b.publishedDate ?? 0) - (a.publishedDate ?? 0))
    .slice(0, MAX_MATCHES)
    .map((w) => ({
      title: w.title,
      link: w.link,
      publishedDate: w.publishedDate,
    }));
}
