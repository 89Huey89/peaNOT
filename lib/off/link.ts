/** Public product page on Open Food Facts (the API lives at OFF_BASE_URL). */
const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/product";

/**
 * Link to the record a verdict was built from, so the user can compare it with
 * the pack and correct it. The page carries OFF's own edit button, which is
 * where a wrong or incomplete record actually gets fixed — for everyone.
 */
export function offProductUrl(barcode: string): string {
  return `${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}`;
}
