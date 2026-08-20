import { describe, expect, it } from "vitest";
import type { RecallWarning } from "@/lib/recalls/client";
import { findRecallMatches, normalizeText, tokenize } from "@/lib/recalls/match";

function warning(partial: Partial<RecallWarning> & { title: string }): RecallWarning {
  return { link: null, publishedDate: null, extraText: "", ...partial };
}

describe("normalizeText", () => {
  it("lowercases, folds umlauts and strips punctuation", () => {
    expect(normalizeText("Ültje Erdnüsse, pikant-gewürzt!")).toBe(
      "ueltje erdnuesse pikant gewuerzt",
    );
  });

  it("folds ß and accents", () => {
    expect(normalizeText("süß Crème")).toBe("suess creme");
  });
});

describe("tokenize", () => {
  it("drops short tokens, bare numbers and filler words", () => {
    expect(tokenize("ültje Erdnüsse 180 Gramm im Beutel")).toEqual([
      "ueltje",
      "erdnuesse",
    ]);
  });

  it("deduplicates tokens", () => {
    expect(tokenize("Erdnüsse Erdnüsse")).toEqual(["erdnuesse"]);
  });
});

describe("findRecallMatches", () => {
  const ultje = warning({
    title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
    link: "https://www.lebensmittelwarnung.de/x",
    publishedDate: 1_763_000_000_000,
  });

  it("matches when brand and most of the name reappear in the notice", () => {
    const matches = findRecallMatches(
      "ültje Erdnüsse pikant gewürzt",
      "ültje",
      [ultje],
    );
    expect(matches).toEqual([
      {
        title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
        link: "https://www.lebensmittelwarnung.de/x",
        publishedDate: 1_763_000_000_000,
      },
    ]);
  });

  it("never matches on a single generic shared word", () => {
    // Every peanut product shares "Erdnüsse" with every peanut recall —
    // that alone must not raise a warning.
    expect(findRecallMatches("Erdnüsse geröstet gesalzen", "Aldi", [ultje])).toEqual(
      [],
    );
  });

  it("does not match a different product of the same brand", () => {
    expect(
      findRecallMatches("ültje Studentenfutter extra Frucht", "ültje", [ultje]),
    ).toEqual([]);
  });

  it("matches without brand only when nearly the whole name reappears", () => {
    expect(
      findRecallMatches("Erdnüsse pikant gewürzt", null, [ultje]),
    ).toHaveLength(1);
    expect(findRecallMatches("Erdnüsse pikant", null, [ultje])).toEqual([]);
  });

  it("reads the extra text of a notice, not just its title", () => {
    const w = warning({
      title: "Rückruf wegen nicht deklarierter Erdnüsse",
      extraText: "Mandelcreme Feine Welt REWE",
    });
    expect(findRecallMatches("Feine Welt Mandelcreme", "REWE", [w])).toHaveLength(1);
  });

  it("returns nothing when the record has no name", () => {
    expect(findRecallMatches(null, "ültje", [ultje])).toEqual([]);
    expect(findRecallMatches("", null, [ultje])).toEqual([]);
  });

  it("caps matches at three, newest first", () => {
    const many = [1, 2, 3, 4].map((n) =>
      warning({
        title: "ültje Erdnüsse pikant gewürzt",
        publishedDate: n * 1000,
      }),
    );
    const matches = findRecallMatches("ültje Erdnüsse pikant gewürzt", "ültje", many);
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.publishedDate)).toEqual([4000, 3000, 2000]);
  });
});
