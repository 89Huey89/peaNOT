import type { OffProductFields } from "@/lib/types";

/**
 * Reviewed corrections for products whose current packaging is newer than the
 * Open Food Facts record. EANs can survive packaging and recipe changes, so a
 * database photo or ingredient list is not necessarily the version in hand.
 *
 * Keep this list deliberately small and evidence-based. Overrides only add
 * warnings; they must never remove an allergen declaration from OFF.
 */
const ADDITIONAL_TRACES: Readonly<Record<string, readonly string[]>> = {
  // Gelatelli Mini Mix Fruit: current pack declares possible peanut traces.
  "20137946": ["en:peanuts"],
};

export function applySafetyOverrides(
  barcode: string,
  fields: OffProductFields,
): OffProductFields {
  const extraTraces = ADDITIONAL_TRACES[barcode];
  if (!extraTraces) return fields;

  return {
    ...fields,
    traces_tags: [...new Set([...fields.traces_tags, ...extraTraces])],
  };
}
