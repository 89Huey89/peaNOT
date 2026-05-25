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
