import type { DetectionResult, OffProductFields } from "@/lib/types";
import { normalizeText } from "@/lib/text";
import { PEANUT_PROFILE, type AllergenProfile } from "@/lib/allergens/profile";

/** True if any tag equals a positive tag or is a hyphen-prefixed variant. */
export function tagMatches(tags: string[], positiveTags: string[]): boolean {
  const normalized = tags.map((t) => t.trim().toLowerCase());
  return normalized.some((tag) =>
    positiveTags.some((p) => tag === p || tag.startsWith(`${p}-`)),
  );
}

/** True if normalized freeform text contains any keyword substring. */
export function textContainsKeyword(text: string, keywords: string[]): boolean {
  if (text.trim() === "") return false;
  const haystack = normalizeText(text);
  return keywords.some((kw) => haystack.includes(normalizeText(kw)));
}

/**
 * Safety-critical decision engine. Order implements JA > SPUREN > NEIN, with
 * KEINE_DATEN as the fail-safe default whenever a judgment is impossible.
 *
 * The only path to NEIN requires usable data AND zero positive hits; any
 * null/empty input short-circuits to KEINE_DATEN.
 */
export function detectAllergen(
  fields: OffProductFields | null,
  profile: AllergenProfile,
): DetectionResult {
  if (fields === null) {
    return { status: "KEINE_DATEN", reason: "insufficient-data" };
  }

  const hasAllergenData =
    fields.allergens_tags.length > 0 || fields.traces_tags.length > 0;
  const hasIngredientData =
    fields.ingredients_tags.length > 0 || fields.ingredients_text.trim() !== "";

  if (!hasAllergenData && !hasIngredientData) {
    return { status: "KEINE_DATEN", reason: "insufficient-data" };
  }

  if (tagMatches(fields.allergens_tags, profile.positiveTags)) {
    return { status: "JA", reason: "tag-allergen" };
  }
  if (tagMatches(fields.ingredients_tags, profile.positiveTags)) {
    return { status: "JA", reason: "tag-ingredient" };
  }
  if (textContainsKeyword(fields.ingredients_text, profile.textKeywords)) {
    return { status: "JA", reason: "text-keyword" };
  }

  if (tagMatches(fields.traces_tags, profile.positiveTags)) {
    return { status: "SPUREN", reason: "tag-traces" };
  }

  return { status: "NEIN", reason: "clean" };
}

export function detectPeanut(fields: OffProductFields | null): DetectionResult {
  return detectAllergen(fields, PEANUT_PROFILE);
}
