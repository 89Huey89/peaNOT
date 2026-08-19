import { describe, expect, it } from "vitest";
import { offProductUrl } from "@/lib/off/link";

describe("offProductUrl", () => {
  it("points at the public product page", () => {
    expect(offProductUrl("20137946")).toBe(
      "https://world.openfoodfacts.org/product/20137946",
    );
  });

  it("escapes anything that is not a plain code", () => {
    expect(offProductUrl("20137946?x=1")).toBe(
      "https://world.openfoodfacts.org/product/20137946%3Fx%3D1",
    );
  });
});
