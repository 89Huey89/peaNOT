import { describe, expect, it } from "vitest";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";

describe("sanitizeBarcode", () => {
  it("keeps only digits", () => {
    expect(sanitizeBarcode(" 40112-00296 908 ")).toBe("4011200296908");
    expect(sanitizeBarcode("abc123def")).toBe("123");
    expect(sanitizeBarcode("")).toBe("");
  });
});

describe("isValidBarcode", () => {
  it("accepts 8 to 14 digit codes", () => {
    expect(isValidBarcode("12345678")).toBe(true); // EAN-8
    expect(isValidBarcode("012345678905")).toBe(true); // UPC-A
    expect(isValidBarcode("4011200296908")).toBe(true); // EAN-13
    expect(isValidBarcode("12345678901234")).toBe(true); // GTIN-14
  });

  it("rejects too short or too long codes", () => {
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("123456789012345")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });

  it("rejects non-digit codes", () => {
    expect(isValidBarcode("12345abc")).toBe(false);
  });
});
