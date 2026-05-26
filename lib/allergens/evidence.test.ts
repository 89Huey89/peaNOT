import { describe, expect, it } from "vitest";
import { findPeanutMention } from "@/lib/allergens/evidence";

describe("findPeanutMention", () => {
  it("finds the German plural with umlaut, preserving the original casing", () => {
    expect(
      findPeanutMention("Rosinen, Cashewkerne, Erdnüsse, Mandeln."),
    ).toBe("Erdnüsse");
  });

  it("finds English and French forms", () => {
    expect(findPeanutMention("Contains peanuts and salt")).toBe("peanuts");
    expect(findPeanutMention("arachides grillées")).toBe("arachides");
  });

  it("returns null when no peanut mention is present", () => {
    expect(findPeanutMention("Reis, Himbeere, Meersalz.")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(findPeanutMention("")).toBeNull();
  });
});
