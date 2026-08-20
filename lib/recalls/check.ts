import type { RecallCheckResult } from "@/lib/types";
import { fetchFoodWarnings } from "@/lib/recalls/client";
import { findRecallMatches } from "@/lib/recalls/match";

/**
 * Compare a scanned product against current official recall notices from
 * lebensmittelwarnung.de. Warn-only by design: the outcome can add a warning
 * card, never soften a verdict. Without a product name there is nothing to
 * compare, so callers should skip the check for not-found barcodes.
 */
export async function checkRecalls(
  productName: string | null,
  brand: string | null,
): Promise<RecallCheckResult> {
  const outcome = await fetchFoodWarnings();
  if (outcome.kind === "error") {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    matches: findRecallMatches(productName, brand, outcome.warnings),
  };
}
