export type PeanutStatus = "JA" | "SPUREN" | "NEIN" | "KEINE_DATEN";

/**
 * Normalized subset of Open Food Facts product fields the detector reads.
 * Arrays are always defined (possibly empty); texts are always strings.
 */
export interface OffProductFields {
  allergens_tags: string[];
  traces_tags: string[];
  ingredients_tags: string[];
  ingredients_text: string;
}

export type DetectReason =
  | "tag-allergen"
  | "tag-ingredient"
  | "text-keyword"
  | "tag-traces"
  | "clean"
  | "insufficient-data";

export interface DetectionResult {
  status: PeanutStatus;
  reason: DetectReason;
}

/**
 * Result of a server-side OFF lookup. A discriminated union so the route
 * never has to interpret raw HTTP details. The client never throws.
 */
export type OffFetchOutcome =
  | { kind: "found"; fields: OffProductFields; productName: string; brand: string }
  | { kind: "no-data"; productName: string; brand: string }
  | { kind: "not-found" }
  | { kind: "error"; cause: "network" | "timeout" | "http" | "parse" };

/** Public response shape returned by /api/product/[barcode]. */
export interface ProductResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  status: PeanutStatus;
  message?: string;
}
