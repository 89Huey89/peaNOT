// Locate the literal allergen mention inside freeform ingredient text so the
// result screen can highlight it as evidence. Returns the exact substring as it
// appears in the source (preserving case/umlauts) or null when absent.

import { normalizeText } from "@/lib/text";
import { PEANUT_PROFILE, type AllergenProfile } from "@/lib/allergens/profile";

// Word-ish tokens (letters, digits, apostrophes, hyphens) used by the fallback
// scan when a profile has no hand-tuned mentionRegex.
const TOKEN = /[\p{L}\p{N}'-]+/gu;

export function findMention(
  ingredientsText: string,
  profile: AllergenProfile,
): string | null {
  if (!ingredientsText) return null;

  if (profile.mentionRegex) {
    const match = ingredientsText.match(profile.mentionRegex);
    return match ? match[0] : null;
  }

  // Fallback: return the first original token whose normalized form contains a
  // keyword. Normalizing per token (instead of slicing by offset) sidesteps the
  // length shift from ß→ss and keeps the original casing/umlauts for display.
  const keywords = profile.textKeywords.map(normalizeText);
  for (const match of ingredientsText.matchAll(TOKEN)) {
    const norm = normalizeText(match[0]);
    if (keywords.some((kw) => norm.includes(kw))) return match[0];
  }
  return null;
}

/** Back-compat wrapper for the peanut-only call sites. */
export function findPeanutMention(ingredientsText: string): string | null {
  return findMention(ingredientsText, PEANUT_PROFILE);
}
