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
  | {
      kind: "found";
      fields: OffProductFields;
      productName: string;
      brand: string;
      imageUrl: string;
    }
  | { kind: "no-data"; productName: string; brand: string; imageUrl: string }
  | { kind: "not-found" }
  | { kind: "error"; cause: "network" | "timeout" | "http" | "parse" };

/** A single product name-search hit (lightweight; no peanut verdict yet). */
export interface ProductSearchResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
}

/**
 * Result of a server-side OFF name search. Discriminated union mirroring
 * OffFetchOutcome; the client never throws.
 */
export type OffSearchOutcome =
  | { kind: "ok"; results: ProductSearchResult[] }
  | { kind: "error"; cause: "network" | "timeout" | "http" | "parse" };

/** Public response shape returned by /api/product/[barcode]. */
export interface ProductResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  status: PeanutStatus;
  message?: string;
  /** Product photo URL from Open Food Facts, when available. */
  imageUrl?: string | null;
  /** Freeform ingredient text, when available (used as on-screen evidence). */
  ingredients?: string | null;
  /** Literal peanut mention found in the ingredients, for highlighting. */
  found?: string | null;
  /** German allergen labels declared on the product. */
  allergens?: string[];
  /** German labels for allergens flagged as possible traces. */
  traces?: string[];
}
