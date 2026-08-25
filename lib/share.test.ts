import { describe, expect, it } from "vitest";
import { buildShareText, buildShareListText, type ShareListItem } from "@/lib/share";

describe("buildShareText (F6)", () => {
  it("includes name, brand, EAN, verdict label with its detail, and the OFF link", () => {
    const text = buildShareText({
      productName: "Nutella",
      brand: "Ferrero",
      barcode: "3017620422003",
      label: "Erdnuss enthalten",
      detail: "In der Zutatenliste explizit aufgeführt.",
    });

    expect(text).toContain("Nutella");
    expect(text).toContain("Ferrero");
    expect(text).toContain("EAN 3017620422003");
    expect(text).toContain("Erdnuss enthalten — In der Zutatenliste explizit aufgeführt.");
    expect(text).toContain("https://world.openfoodfacts.org/product/3017620422003");
  });

  // Fail-safe framing: a "Vorbehalt" share must carry the caveat sentence,
  // never read like a plain, unqualified "sicher".
  it("carries the caveat wording for a partial (Vorbehalt) result", () => {
    const text = buildShareText({
      productName: "Eis am Stiel",
      brand: null,
      barcode: "20137946",
      label: "Keine Erdnuss (Vorbehalt)",
      detail: "Barcode aus dem Handels-Eigencode-Bereich — der Treffer kann ein anderes Produkt sein.",
    });

    expect(text).toContain("Vorbehalt");
    expect(text).toContain("kann ein anderes Produkt sein");
    expect(text).not.toMatch(/^Sicher$/m);
  });

  it("falls back to a placeholder name and omits the brand line when missing", () => {
    const text = buildShareText({
      productName: null,
      brand: null,
      barcode: "111",
      label: "Unbekannt",
      detail: "Wir können Erdnuss nicht ausschließen.",
    });

    expect(text).toContain("peaNOT-Check: Unbekanntes Produkt");
    expect(text).not.toContain("· null");
  });
});

describe("buildShareListText (G)", () => {
  function item(overrides: Partial<ShareListItem> = {}): ShareListItem {
    return {
      name: "Nutella",
      brand: "Ferrero",
      barcode: "3017620422003",
      label: "Sicher",
      ts: new Date("2026-05-01T10:15:00Z").getTime(),
      ...overrides,
    };
  }

  it("returns an empty string for an empty list (never a header-only text)", () => {
    expect(buildShareListText([])).toBe("");
  });

  it("includes name, brand, barcode and verdict label per row", () => {
    const text = buildShareListText([item()]);
    expect(text).toContain("Nutella");
    expect(text).toContain("Ferrero");
    expect(text).toContain("EAN 3017620422003");
    expect(text).toContain("Sicher");
  });

  it("omits the brand segment when brand is the '—' placeholder", () => {
    const text = buildShareListText([item({ brand: "—" })]);
    expect(text).not.toContain("· —");
  });

  // Read later, possibly by someone without the app at all: every row must
  // carry a fixed date, not a relative "Heute"/"Gestern" that would silently
  // go wrong once the message sits unread for a while.
  it("stamps each row with an absolute calendar date, not a relative one", () => {
    const text = buildShareListText([item({ ts: new Date("2026-05-01T10:15:00Z").getTime() })]);
    expect(text).toContain("01.05.2026");
    expect(text).not.toMatch(/Heute|Gestern|Gerade eben/);
  });

  it("carries a header/footer note that this is a snapshot and the pack in hand still decides", () => {
    const text = buildShareListText([item()]);
    expect(text).toMatch(/Momentaufnahme/);
    expect(text).toMatch(/Packung in der Hand/);
  });

  // Fail-safe framing (same guarantee as buildShareText): non-clearing
  // verdicts must show up in the shared text exactly as firmly as on screen.
  it("carries non-clearing verdict labels unfiltered", () => {
    const labels = ["Treffer", "Spuren möglich", "Mit Vorbehalt", "Unbekannt"];
    for (const label of labels) {
      const text = buildShareListText([item({ label })]);
      expect(text).toContain(label);
    }
  });

  it("caps a long list and names the cut instead of silently truncating", () => {
    const items = Array.from({ length: 45 }, (_, i) =>
      item({ barcode: String(1000 + i), name: `Produkt ${i}` }),
    );
    const text = buildShareListText(items);
    expect(text).toContain("Produkt 0");
    expect(text).toContain("Produkt 29");
    expect(text).not.toContain("Produkt 30");
    expect(text).toContain("… und 15 weitere.");
  });

  it("does not append a truncation note when the list fits under the cap", () => {
    const text = buildShareListText([item()]);
    expect(text).not.toMatch(/weitere\./);
  });
});
