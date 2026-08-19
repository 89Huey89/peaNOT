import { describe, expect, it } from "vitest";
import { applySafetyOverrides } from "@/lib/off/safety-overrides";
import type { OffProductFields } from "@/lib/types";

const cleanFields: OffProductFields = {
  allergens_tags: ["en:milk"],
  traces_tags: [],
  ingredients_tags: ["en:milk"],
  ingredients_text: "Milch, Zucker, Fruchtpüree",
};

describe("applySafetyOverrides", () => {
  it("adds the reported peanut trace for Gelatelli Mini Mix Fruit", () => {
    const result = applySafetyOverrides("20137946", cleanFields);

    expect(result.traces_tags).toContain("en:peanuts");
    expect(result.ingredients_text).toBe(cleanFields.ingredients_text);
  });

  it("does not change products without a reviewed correction", () => {
    expect(applySafetyOverrides("4011200296908", cleanFields)).toBe(cleanFields);
  });

  it("does not duplicate an existing trace tag", () => {
    const fields = { ...cleanFields, traces_tags: ["en:peanuts"] };

    expect(applySafetyOverrides("20137946", fields).traces_tags).toEqual([
      "en:peanuts",
    ]);
  });
});
