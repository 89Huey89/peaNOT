import type { AllergenHit, AllergenStatus, OffProductFields } from "@/lib/types";
import { detectAllergen } from "@/lib/allergens/detect";
import { findMention } from "@/lib/allergens/evidence";
import type { AllergenProfile } from "@/lib/allergens/profile";

export interface CombinedDetection {
  overall: AllergenStatus;
  hits: AllergenHit[];
}

/**
 * Combine per-allergen statuses into one overall verdict. Worst case wins:
 * any JA → JA; else any SPUREN → SPUREN; else all NEIN → NEIN; otherwise (an
 * unknown is mixed in) KEINE_DATEN as the fail-safe.
 */
export function combineStatus(statuses: AllergenStatus[]): AllergenStatus {
  if (statuses.length === 0) return "KEINE_DATEN";
  if (statuses.includes("JA")) return "JA";
  if (statuses.includes("SPUREN")) return "SPUREN";
  if (statuses.every((s) => s === "NEIN")) return "NEIN";
  return "KEINE_DATEN";
}

/** Run detection for every selected profile and fold into one overall verdict. */
export function detectAllergens(
  fields: OffProductFields | null,
  profiles: AllergenProfile[],
): CombinedDetection {
  const hits: AllergenHit[] = profiles.map((profile) => {
    const { status } = detectAllergen(fields, profile);
    const found =
      fields && (status === "JA" || status === "SPUREN")
        ? findMention(fields.ingredients_text, profile)
        : null;
    return { key: profile.key, label: profile.label, status, found };
  });
  return { overall: combineStatus(hits.map((h) => h.status)), hits };
}
