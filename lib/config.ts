/**
 * Open Food Facts requires a descriptive User-Agent. It must be set
 * server-side (browsers forbid overriding User-Agent), which is one reason
 * the OFF call lives in the API route rather than the client.
 */
export const USER_AGENT = "peaNOT/1.0 (https://github.com/89huey89/peanot)";

export const OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";

/** Only request the fields we actually use, to keep the payload small. */
export const OFF_FIELDS = [
  "product_name",
  "product_name_de",
  "brands",
  "allergens_tags",
  "traces_tags",
  "ingredients_tags",
  "ingredients_text",
  "ingredients_text_de",
  "image_front_small_url",
  "image_front_url",
  "image_small_url",
  "image_url",
  "last_modified_t",
  "rev",
].join(",");

export const OFF_TIMEOUT_MS = 6000;

/**
 * Seconds the Next data cache may reuse an OFF product response. Product
 * allergen data is stable, so reusing it across allergen profiles, re-scans
 * and users avoids the slow OFF round-trip while the verdict is still
 * recomputed per request. Detection stays server-side, so this never changes
 * the fail-safe verdict — only how often OFF itself is hit.
 */
export const OFF_REVALIDATE_S = 3600;

/** Search-a-licious full-text search endpoint (product name search). */
export const OFF_SEARCH_URL = "https://search.openfoodfacts.org/search";

/** Fields requested per search hit — only what the result list shows. */
export const OFF_SEARCH_FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "brands",
  "image_front_small_url",
  "image_small_url",
].join(",");

export const OFF_SEARCH_PAGE_SIZE = 20;

export const OFF_SEARCH_TIMEOUT_MS = 6000;
