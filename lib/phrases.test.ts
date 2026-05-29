import { describe, expect, it } from "vitest";
import {
  PHRASES,
  PHRASE_LANGS,
  VENUES,
  defaultLangCode,
  phraseFor,
  type VenueKey,
} from "./phrases";

const VENUE_KEYS = VENUES.map((v) => v.key);

describe("phrases data", () => {
  it("lists every language exactly once with the required fields", () => {
    const codes = PHRASE_LANGS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const l of PHRASE_LANGS) {
      expect(l.code).toMatch(/^[a-z]{2}$/);
      expect(l.label.trim().length).toBeGreaterThan(0);
      expect(l.english.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers every venue for every listed language (no silent gaps)", () => {
    for (const lang of PHRASE_LANGS) {
      const byVenue = PHRASES[lang.code];
      expect(byVenue, `missing translations for ${lang.code}`).toBeDefined();
      for (const venue of VENUE_KEYS) {
        const text = byVenue?.[venue];
        expect(text, `${lang.code}/${venue} missing`).toBeTruthy();
        expect((text ?? "").trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("has no stray translation entries for unlisted languages", () => {
    const listed = new Set(PHRASE_LANGS.map((l) => l.code));
    for (const code of Object.keys(PHRASES)) {
      expect(listed.has(code), `${code} has text but is not in PHRASE_LANGS`).toBe(true);
    }
  });
});

describe("phraseFor", () => {
  it("returns the exact translation for a known language and venue", () => {
    expect(phraseFor("it", "icecream")).toBe(PHRASES.it?.icecream);
    expect(phraseFor("de", "restaurant")).toBe(PHRASES.de?.restaurant);
  });

  it("keeps the user-provided Italian ice-cream wording", () => {
    expect(phraseFor("it", "icecream")).toContain("una paletta pulita e appena lavata");
  });

  it("falls back to English for an unknown language", () => {
    expect(phraseFor("xx" as string, "general" as VenueKey)).toBe(PHRASES.en?.general);
  });
});

describe("defaultLangCode", () => {
  it("matches on the primary subtag", () => {
    expect(defaultLangCode(["pt-BR", "en"])).toBe("pt");
    expect(defaultLangCode(["de-DE"])).toBe("de");
  });

  it("skips unknown tags and falls back to English", () => {
    expect(defaultLangCode(["xx-YY", "ja-JP"])).toBe("ja");
    expect(defaultLangCode(["xx", "yy"])).toBe("en");
    expect(defaultLangCode([])).toBe("en");
  });
});
