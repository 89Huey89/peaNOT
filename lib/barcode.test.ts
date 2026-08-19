import { describe, expect, it } from "vitest";
import {
  gtinCheckDigit,
  hasValidCheckDigit,
  isRestrictedCirculationCode,
  isValidBarcode,
  sanitizeBarcode,
} from "@/lib/barcode";

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

describe("gtinCheckDigit / hasValidCheckDigit", () => {
  it("computes the GS1 check digit for every GTIN length", () => {
    expect(gtinCheckDigit("2013794")).toBe(6); // EAN-8
    expect(gtinCheckDigit("01234567890")).toBe(5); // UPC-A
    expect(gtinCheckDigit("401120029690")).toBe(8); // EAN-13
  });

  it("accepts codes whose trailing digit matches", () => {
    expect(hasValidCheckDigit("20137946")).toBe(true);
    expect(hasValidCheckDigit("4011200296908")).toBe(true);
    expect(hasValidCheckDigit("012345678905")).toBe(true);
  });

  it("rejects mistyped or misread codes", () => {
    expect(hasValidCheckDigit("20137945")).toBe(false);
    expect(hasValidCheckDigit("4011200296909")).toBe(false);
    expect(hasValidCheckDigit("1234567")).toBe(false); // not a valid barcode
  });
});

describe("isRestrictedCirculationCode", () => {
  it("flags EAN-8 codes starting with 0 or 2", () => {
    expect(isRestrictedCirculationCode("20137946")).toBe(true);
    expect(isRestrictedCirculationCode("01234565")).toBe(true);
  });

  it("flags EAN-13 in-store prefixes", () => {
    expect(isRestrictedCirculationCode("2012345678903")).toBe(true); // 201
    expect(isRestrictedCirculationCode("0201234567891")).toBe(true); // 020
    expect(isRestrictedCirculationCode("0401234567897")).toBe(true); // 040
  });

  it("flags UPC-A codes starting with 2, which pad into the 02x range", () => {
    expect(isRestrictedCirculationCode("212345678901")).toBe(true);
  });

  it("does not flag ordinary manufacturer codes", () => {
    expect(isRestrictedCirculationCode("4011200296908")).toBe(false); // 401 DE
    expect(isRestrictedCirculationCode("12345678")).toBe(false); // EAN-8, prefix 1
    expect(isRestrictedCirculationCode("012345678905")).toBe(false); // UPC-A, 001
  });

  it("rejects malformed input instead of guessing", () => {
    expect(isRestrictedCirculationCode("abc")).toBe(false);
    expect(isRestrictedCirculationCode("")).toBe(false);
  });
});
