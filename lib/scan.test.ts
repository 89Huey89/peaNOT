import { describe, expect, it } from "vitest";
import { shouldAcceptScan } from "@/lib/scan";

describe("shouldAcceptScan", () => {
  it("accepts the first scan", () => {
    expect(shouldAcceptScan(null, "111", 1000)).toBe(true);
  });

  it("rejects the same code within the debounce window", () => {
    const last = { code: "111", time: 1000 };
    expect(shouldAcceptScan(last, "111", 1500)).toBe(false);
  });

  it("accepts the same code after the window passes", () => {
    const last = { code: "111", time: 1000 };
    expect(shouldAcceptScan(last, "111", 4000)).toBe(true);
  });

  it("accepts a different code immediately", () => {
    const last = { code: "111", time: 1000 };
    expect(shouldAcceptScan(last, "222", 1100)).toBe(true);
  });
});
