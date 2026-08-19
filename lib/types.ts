import type { CaveatKey } from "@/lib/caveats";

export type PeanutStatus = "JA" | "SPUREN" | "NEIN" | "KEINE_DATEN";

/** Sprechender Alias für neuen Code; PeanutStatus bleibt aus Kompatibilität. */
export type AllergenStatus = PeanutStatus;

/** Detection outcome for a single allergen within a multi-allergen check. */
export interface AllergenHit {
  key: string;
  label: string;
  status: AllergenStatus;
  /** Literal mention in the ingredients, for highlighting (JA/SPUREN only). */
  found?: string | null;
}

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
      /** OFF record metadata; an edit is not necessarily a recipe change. */
      dataLastModified?: number;
      dataRevision?: number;
    }
  | {
      kind: "no-data";
      productName: string;
      brand: string;
      imageUrl: string;
      dataLastModified?: number;
      dataRevision?: number;
    }
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
  /** Overall verdict across all checked allergens (worst case wins). */
  status: PeanutStatus;
  message?: string;
  /** Product photo URL from Open Food Facts, when available. */
  imageUrl?: string | null;
  /** Unix timestamp of the last OFF record edit (not proof of a recipe change). */
  dataLastModified?: number;
  /** OFF record revision number, when supplied by the API. */
  dataRevision?: number;
  /** Freeform ingredient text, when available (used as on-screen evidence). */
  ingredients?: string | null;
  /** Literal allergen mention found in the ingredients, for highlighting. */
  found?: string | null;
  /** Per-allergen breakdown for the checked allergens. */
  results?: AllergenHit[];
  /**
   * Reasons a clean result is only conditionally clean (unknown barcode
   * identity, missing traces data). Keys resolve to copy in lib/caveats.ts.
   */
  caveats?: CaveatKey[];
  /** German allergen labels declared on the product. */
  allergens?: string[];
  /** German labels for allergens flagged as possible traces. */
  traces?: string[];
}
