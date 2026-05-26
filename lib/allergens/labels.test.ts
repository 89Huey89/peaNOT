import { describe, expect, it } from "vitest";
import { allergenLabel, allergenLabels } from "@/lib/allergens/labels";

describe("allergenLabel", () => {
  it("maps known tags to German labels", () => {
    expect(allergenLabel("en:peanuts")).toBe("Erdnuss");
    expect(allergenLabel("en:milk")).toBe("Milch");
    expect(allergenLabel("en:soybeans")).toBe("Soja");
  });

  it("strips the language prefix and title-cases unknown tags", () => {
    expect(allergenLabel("en:some-new-allergen")).toBe("Some New Allergen");
  });

  it("handles tags without a prefix", () => {
    expect(allergenLabel("gluten")).toBe("Gluten");
  });
});

describe("allergenLabels", () => {
  it("maps and de-duplicates a list", () => {
    expect(allergenLabels(["en:peanuts", "en:peanut", "en:milk"])).toEqual([
      "Erdnuss",
      "Milch",
    ]);
  });

  it("returns an empty array for no tags", () => {
    expect(allergenLabels([])).toEqual([]);
  });
});
