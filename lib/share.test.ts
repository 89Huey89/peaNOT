import { describe, expect, it } from "vitest";
import { buildShareText } from "@/lib/share";

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
