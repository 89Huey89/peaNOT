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

/** One official recall notice that plausibly concerns the scanned product. */
export interface RecallMatch {
  title: string;
  /** Link into the notice on lebensmittelwarnung.de, when supplied. */
  link: string | null;
  /** Publication time in ms since epoch, when supplied. */
  publishedDate: number | null;
}

/**
 * Outcome of the warn-only recall comparison against lebensmittelwarnung.de.
 * Matching is name-based (notices carry no barcodes), so "ok" with no matches
 * means "nothing found in the comparison", never "no recall exists".
 */
export type RecallCheckResult =
  | { status: "ok"; matches: RecallMatch[] }
  | { status: "unavailable" };

/**
 * Why a result came back KEINE_DATEN, so the UI can tell "the product might
 * still be findable, try again" (no-data/error) apart from "we looked, there
 * is nothing under this code" (not-found). Never set for a real verdict.
 */
export type KeineDatenKind = "not-found" | "no-data" | "error";

/** Public response shape returned by /api/product/[barcode]. */
export interface ProductResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  /** Overall verdict across all checked allergens (worst case wins). */
  status: PeanutStatus;
  message?: string;
  /** Set only alongside a KEINE_DATEN status; see KeineDatenKind. */
  kind?: KeineDatenKind;
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
  /**
   * Warn-only comparison against official recall notices, present whenever
   * the record offered a name or brand to compare with.
   */
  recall?: RecallCheckResult;
  /** German allergen labels declared on the product. */
  allergens?: string[];
  /** German labels for allergens flagged as possible traces. */
  traces?: string[];
  /**
   * Client-only annotation: set when this response was served by the service
   * worker from its offline cache rather than a live fetch (X-Peanot-Cache /
   * X-Peanot-Cached-At in public/sw.js). ISO timestamp of the original fetch,
   * never set by the API itself. Purely informational — never changes status.
   */
  cachedAt?: string;
  /**
   * Client-only annotation: set when the lookup request itself never reached
   * the app's own API (offline with nothing cached, aborted, etc.). Set by
   * components/useProductLookup.ts, never by the API. Distinguishes this
   * client-side fail-safe fallback from a server-reported KEINE_DATEN.
   */
  networkError?: boolean;
}
