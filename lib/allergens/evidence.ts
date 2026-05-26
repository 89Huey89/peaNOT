// Locate the literal peanut mention inside freeform ingredient text so the
// result screen can highlight it as evidence. Returns the exact substring as
// it appears in the source (preserving case/umlauts) or null when absent.

const PEANUT_MENTION =
  /erdn[uü]ss\w*|peanut\w*|ground[\s-]?nut\w*|arachid\w*|arachis\w*|cacahu\w*/i;

export function findPeanutMention(ingredientsText: string): string | null {
  if (!ingredientsText) return null;
  const match = ingredientsText.match(PEANUT_MENTION);
  return match ? match[0] : null;
}
