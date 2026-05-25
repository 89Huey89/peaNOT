/**
 * Lowercase and strip diacritics so freeform ingredient text matches keywords
 * regardless of accents or umlauts. German "ß" is folded to "ss" (it has no
 * Unicode decomposition). Note umlauts are stripped, not expanded:
 * "Erdnüsse" → "erdnusse" (so the keyword "erdnuss" still matches the plural).
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
