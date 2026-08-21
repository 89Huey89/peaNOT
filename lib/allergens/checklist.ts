import type { AllergenProfile } from "@/lib/allergens/profile";

/** Reading-help checklist for one allergen: the human-facing terms to look
 * for on a package, next to the German display label. */
export interface AllergenChecklist {
  key: string;
  label: string;
  terms: string[];
}

/**
 * Capitalize a normalized keyword for display ("ground nut" -> "Ground Nut").
 * textKeywords are stored lowercase and diacritic-stripped for substring
 * matching (see lib/text.ts normalizeText) — this is a light readability
 * pass, not a spelling correction, so it will not restore umlauts/accents
 * ("erdnuss" stays "Erdnuss", not "Erdnuß"/"Erdnuss").
 */
function displayTerm(keyword: string): string {
  return keyword
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Build a package-reading checklist per selected allergen: "these words mean
 * <Allergen>", generated from the same textKeywords the detection engine
 * matches against ingredient text (lib/allergens/detect.ts) — never a new,
 * separately-maintained word list. Purely a memory aid for the human reading
 * the pack; it feeds no verdict.
 *
 * Deduplicates case-insensitively (some profiles list the same root word in
 * more than one casing/spacing) while preserving the profile's own order, so
 * a KEINE_DATEN screen never shows the same term twice.
 */
export function buildAllergenChecklist(profiles: AllergenProfile[]): AllergenChecklist[] {
  return profiles.map((profile) => {
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const keyword of profile.textKeywords) {
      const term = displayTerm(keyword.trim());
      const dedupeKey = term.toLowerCase();
      if (term && !seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        terms.push(term);
      }
    }
    return { key: profile.key, label: profile.label, terms };
  });
}
