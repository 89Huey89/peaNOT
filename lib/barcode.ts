/** Strip everything except digits. */
export function sanitizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Valid product barcodes are 8–14 digits
 * (covers EAN-8, UPC-A, EAN-13, ITF-14 / GTIN-14).
 */
export function isValidBarcode(barcode: string): boolean {
  return /^[0-9]{8,14}$/.test(barcode);
}

/**
 * GS1 modulo-10 check digit over the data digits (everything but the trailing
 * check digit). Weights alternate 3/1 starting at the rightmost data digit,
 * which is the same rule for every GTIN length.
 */
export function gtinCheckDigit(dataDigits: string): number {
  let sum = 0;
  let weight = 3;
  for (let i = dataDigits.length - 1; i >= 0; i--) {
    sum += Number(dataDigits[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * True when the trailing digit matches the GS1 check digit. A mismatch means
 * the code was misread or is not a GTIN at all — either way the database hit
 * it produces may belong to a different product.
 */
export function hasValidCheckDigit(barcode: string): boolean {
  if (!isValidBarcode(barcode)) return false;
  return gtinCheckDigit(barcode.slice(0, -1)) === Number(barcode.slice(-1));
}

/**
 * GS1 prefixes reserved for restricted distribution — retailer in-store codes
 * that are NOT globally unique. Compared against the 3-digit prefix of the
 * 13-digit GTIN body.
 */
const RESTRICTED_PREFIX_RANGES: readonly [number, number][] = [
  [20, 29], // 020–029: restricted distribution / in-store
  [40, 49], // 040–049: company internal
  [200, 299], // 200–299: restricted distribution within a region
];

/**
 * True for barcodes from the restricted-distribution ranges, i.e. own-brand
 * codes a retailer assigns itself (Lidl, Aldi, …). The same code may stand for
 * a different product in another country or store chain, so a database record
 * matched by such a code is not proof of product identity.
 */
export function isRestrictedCirculationCode(barcode: string): boolean {
  if (!isValidBarcode(barcode)) return false;

  // GTIN-8 has its own rule: leading 0 or 2 marks restricted distribution.
  // (Zero-padding it into GTIN-13 form would hide that, so check it directly.)
  if (barcode.length === 8) return barcode[0] === "0" || barcode[0] === "2";

  // Everything else is compared as a GTIN-13 body: pad to 14 and drop the
  // GTIN-14 indicator digit, so UPC-A and EAN-13 line up on the same prefix.
  const prefix = Number(barcode.padStart(14, "0").slice(1, 4));
  return RESTRICTED_PREFIX_RANGES.some(([lo, hi]) => prefix >= lo && prefix <= hi);
}
