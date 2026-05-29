import { describe, expect, it } from "vitest";
import {
  ALLERGEN_KEYS,
  ALLERGEN_TERMS,
  LANG_PHRASES,
  PHRASE_LANGS,
  VENUES,
  allergenList,
  allergenTerm,
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

  it("has a lead with the {LIST} placeholder and every venue for every language", () => {
    for (const lang of PHRASE_LANGS) {
      const lp = LANG_PHRASES[lang.code];
      expect(lp, `missing phrasing for ${lang.code}`).toBeDefined();
      expect(lp?.lead, `${lang.code} lead missing {LIST}`).toContain("{LIST}");
      expect((lp?.sep ?? "").length, `${lang.code} separator missing`).toBeGreaterThan(0);
      for (const venue of VENUE_KEYS) {
        const text = lp?.venues[venue];
        expect(text, `${lang.code}/${venue} missing`).toBeTruthy();
        expect((text ?? "").trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("translates every known allergen for every language (no silent gaps)", () => {
    for (const lang of PHRASE_LANGS) {
      const terms = ALLERGEN_TERMS[lang.code];
      expect(terms, `missing allergen terms for ${lang.code}`).toBeDefined();
      for (const key of ALLERGEN_KEYS) {
        const term = terms?.[key];
        expect(term, `${lang.code}/${key} term missing`).toBeTruthy();
        expect((term ?? "").trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("has no stray phrasing or term entries for unlisted languages", () => {
    const listed = new Set(PHRASE_LANGS.map((l) => l.code));
    for (const code of Object.keys(LANG_PHRASES)) {
      expect(listed.has(code), `${code} has phrasing but is not in PHRASE_LANGS`).toBe(true);
    }
    for (const code of Object.keys(ALLERGEN_TERMS)) {
      expect(listed.has(code), `${code} has terms but is not in PHRASE_LANGS`).toBe(true);
    }
  });
});

describe("allergenTerm", () => {
  it("returns the language-specific term", () => {
    expect(allergenTerm("de", "milk")).toBe("Milch");
    expect(allergenTerm("fr", "eggs")).toBe("œufs");
  });

  it("falls back to English for an unknown language, then to the key", () => {
    expect(allergenTerm("xx", "milk")).toBe(ALLERGEN_TERMS.en?.milk);
    expect(allergenTerm("de", "unknown-key")).toBe("unknown-key");
  });
});

describe("allergenList", () => {
  it("joins selected allergens with the language separator", () => {
    expect(allergenList("de", ["peanut", "milk"])).toBe("Erdnüsse, Milch");
    expect(allergenList("zh", ["peanut", "milk"])).toBe("花生、牛奶");
  });

  it("drops unknown keys but keeps known ones", () => {
    expect(allergenList("de", ["milk", "not-real"])).toBe("Milch");
  });

  it("falls back to peanut when nothing valid is selected (mirrors the scanner)", () => {
    expect(allergenList("de", [])).toBe("Erdnüsse");
    expect(allergenList("de", ["not-real"])).toBe("Erdnüsse");
  });
});

describe("phraseFor", () => {
  it("names exactly the selected allergens in the lead", () => {
    const text = phraseFor("de", "restaurant", ["milk", "eggs"]);
    expect(text).toContain("Milch, Eier");
    expect(text).not.toContain("Erdnüsse");
    expect(text).toContain("Welche Gerichte sind frei von diesen Allergenen");
  });

  it("keeps the user-provided Italian ice-cream wording", () => {
    expect(phraseFor("it", "icecream", ["peanut"])).toContain(
      "una paletta pulita e appena lavata",
    );
  });

  it("falls back to English phrasing for an unknown language", () => {
    const text = phraseFor("xx" as string, "general" as VenueKey, ["milk"]);
    expect(text).toContain(LANG_PHRASES.en?.venues.general);
    expect(text).toContain("milk");
  });

  it("defaults to peanut when no allergens are selected", () => {
    expect(phraseFor("en", "general", [])).toContain("peanuts");
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
