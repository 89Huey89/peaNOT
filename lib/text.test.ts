import { describe, expect, it } from "vitest";
import { normalizeText } from "@/lib/text";

describe("normalizeText", () => {
  it("lowercases input", () => {
    expect(normalizeText("ERDNUSS")).toBe("erdnuss");
  });

  it("strips umlauts to their base letter", () => {
    expect(normalizeText("Erdnüsse")).toBe("erdnusse");
    expect(normalizeText("Öl")).toBe("ol");
  });

  it("folds ß to ss", () => {
    expect(normalizeText("Straße")).toBe("strasse");
  });

  it("strips diacritics", () => {
    expect(normalizeText("cacahuète")).toBe("cacahuete");
  });

  it("keeps the keyword 'erdnuss' as a substring of the normalized plural", () => {
    expect(normalizeText("Erdnüsse")).toContain("erdnuss");
  });
});
