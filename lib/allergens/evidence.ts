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

  // Fallback: match against the original tokens, then return the source
  // substring spanning the match. Normalizing per token (instead of slicing by
  // offset) sidesteps the length shift from ß→ss and keeps the original
  // casing/umlauts for display.
  const keywords = profile.textKeywords.map(normalizeText);
  const single = keywords.filter((kw) => !kw.includes(" "));
  const multi = keywords.filter((kw) => kw.includes(" "));

  const tokens = [...ingredientsText.matchAll(TOKEN)].map((m) => ({
    norm: normalizeText(m[0]),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));

  // Single-word keywords: the first original token whose normalized form
  // contains one (the historical behavior).
  for (const tok of tokens) {
    if (single.some((kw) => tok.norm.includes(kw))) {
      return ingredientsText.slice(tok.start, tok.end);
    }
  }

  // Multi-word keywords (e.g. "brazil nut", "sulfur dioxide") need a window of
  // consecutive tokens: no single token can contain the space between words, so
  // a per-token scan would highlight nothing even though detection — which
  // normalizes the whole text — reports a positive hit.
  if (multi.length > 0) {
    const maxWords = multi.reduce(
      (max, kw) => Math.max(max, kw.split(" ").length),
      1,
    );
    for (let i = 0; i < tokens.length; i++) {
      const first = tokens[i];
      if (!first) continue;
      let windowNorm = first.norm;
      let end = first.end;
      for (let j = i + 1; j < Math.min(i + maxWords, tokens.length); j++) {
        const tok = tokens[j];
        if (!tok) continue;
        windowNorm += ` ${tok.norm}`;
        end = tok.end;
        if (multi.some((kw) => windowNorm.includes(kw))) {
          return ingredientsText.slice(first.start, end);
        }
      }
    }
  }
  return null;
}

/** Back-compat wrapper for the peanut-only call sites. */
export function findPeanutMention(ingredientsText: string): string | null {
  return findMention(ingredientsText, PEANUT_PROFILE);
}
