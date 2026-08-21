import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ResultScreen from "@/components/screens/ResultScreen";
import type { ProductResult } from "@/lib/types";
import type { HistoryEntry } from "@/components/useHistory";
import { readPackMatch } from "@/lib/packmatch";
import { CAVEATS } from "@/lib/caveats";
import { palette } from "@/lib/theme";

const CLEAN_RESULT: ProductResult = {
  barcode: "20137946",
  productName: "Gelatelli mini mix fruit",
  brand: "Gelatelli",
  status: "NEIN",
  ingredients: "Lait écrémé, sucre",
  caveats: ["restricted-code"],
};

function renderResult(
  result: ProductResult = CLEAN_RESULT,
  lastKnown: HistoryEntry | null = null,
) {
  render(
    <ResultScreen
      P={palette("mustard")}
      result={result}
      lastKnown={lastKnown}
      selectedAllergens={["peanut"]}
      tracesStrict={false}
      haptic={false}
      sound={false}
      loading={false}
      onBack={() => {}}
      onScanAgain={() => {}}
      onRetry={() => {}}
    />,
  );
}

describe("ResultScreen pack comparison", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("asks whether the record matches the pack when the barcode is ambiguous", () => {
    renderResult();

    expect(screen.getByText("Passt das zu deiner Packung?")).toBeInTheDocument();
    expect(screen.getByText("Keine Erdnuss in den Zutaten.")).toBeInTheDocument();
  });

  it("does not ask when the barcode is unambiguous", () => {
    renderResult({ ...CLEAN_RESULT, barcode: "4011200296908", caveats: ["traces-unknown"] });

    expect(screen.queryByText("Passt das zu deiner Packung?")).not.toBeInTheDocument();
  });

  it("clears the all-clear when the user reports a different pack", () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Nein, andere" }));

    expect(screen.getByText("Keine Daten.")).toBeInTheDocument();
    // Also present in the screen-reader live region, hence getAllByText.
    expect(screen.getAllByText(/Angaben gehören zu einem anderen Produkt/).length)
      .toBeGreaterThan(0);
    expect(readPackMatch("20137946")).toBe("mismatch");
  });

  it("restores the green verdict when the user confirms the pack", () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Ja, passt" }));

    expect(screen.getByText("Keine Erdnuss.")).toBeInTheDocument();
    expect(screen.queryByText(CAVEATS["restricted-code"].title)).not.toBeInTheDocument();
    expect(readPackMatch("20137946")).toBe("match");
  });

  it("lets the user take an answer back", () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Nein, andere" }));
    fireEvent.click(screen.getByRole("button", { name: "Antwort zurücknehmen" }));

    expect(screen.getByText("Passt das zu deiner Packung?")).toBeInTheDocument();
    expect(readPackMatch("20137946")).toBeNull();
  });

  it("offers to complete a record that carries no traces data", () => {
    renderResult({
      ...CLEAN_RESULT,
      barcode: "4011200296908",
      caveats: ["traces-unknown"],
    });

    const link = screen.getByRole("link", { name: /Spurenangabe .* ergänzen/ });
    expect(link).toHaveAttribute("href", "https://world.openfoodfacts.org/product/4011200296908");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links to the record when the user reports a different pack", () => {
    renderResult();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nein, andere" }));

    expect(screen.getByRole("link", { name: /Eintrag .* prüfen/ })).toHaveAttribute(
      "href",
      "https://world.openfoodfacts.org/product/20137946",
    );
  });

  it("picks up an answer remembered from an earlier scan", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "mismatch", ts: 1 } }),
    );

    renderResult();

    expect(screen.getByText("Andere Packung")).toBeInTheDocument();
    expect(screen.queryByText("Passt das zu deiner Packung?")).not.toBeInTheDocument();
  });

  it("never asks on a hit, and keeps the warning regardless of a stored answer", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "mismatch", ts: 1 } }),
    );

    renderResult({ ...CLEAN_RESULT, status: "JA", caveats: [] });

    expect(screen.getByText("Erdnuss enthalten.")).toBeInTheDocument();
    expect(screen.queryByText("Passt das zu deiner Packung?")).not.toBeInTheDocument();
    expect(screen.queryByText("Andere Packung")).not.toBeInTheDocument();
  });
});

describe("ResultScreen recall comparison", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows a recall card with link when a notice matches", () => {
    renderResult({
      ...CLEAN_RESULT,
      recall: {
        status: "ok",
        matches: [
          {
            title: "Gelatelli mini mix fruit, 500 ml",
            link: "https://www.lebensmittelwarnung.de/x",
            publishedDate: 1_763_000_000_000,
          },
        ],
      },
    });

    expect(
      screen.getByText("Rückruf könnte dieses Produkt betreffen"),
    ).toBeInTheDocument();
    expect(screen.getByText("Gelatelli mini mix fruit, 500 ml")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meldung öffnen/ })).toHaveAttribute(
      "href",
      "https://www.lebensmittelwarnung.de/x",
    );
  });

  it("shows only a quiet status line when nothing matched", () => {
    renderResult({ ...CLEAN_RESULT, recall: { status: "ok", matches: [] } });

    expect(
      screen.queryByText("Rückruf könnte dieses Produkt betreffen"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/rückruf-abgleich · lebensmittelwarnung.de · kein namenstreffer/),
    ).toBeInTheDocument();
  });

  it("says when the recall portal was unreachable", () => {
    renderResult({ ...CLEAN_RESULT, recall: { status: "unavailable" } });

    expect(
      screen.getByText(/lebensmittelwarnung.de nicht erreichbar/),
    ).toBeInTheDocument();
  });

  it("stays silent when the comparison never ran", () => {
    renderResult();

    expect(screen.queryByText(/rückruf-abgleich/)).not.toBeInTheDocument();
  });
});

describe("ResultScreen offline cache honesty", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks a result the service worker served from its offline cache", () => {
    renderResult({
      ...CLEAN_RESULT,
      barcode: "4011200296908",
      caveats: [],
      cachedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    });

    expect(screen.getByText(/Offline — Ergebnis aus Abfrage vom/)).toBeInTheDocument();
    expect(screen.queryByText(/geprüft ·/)).not.toBeInTheDocument();
  });

  it("shows a plain 'geprüft' timestamp for an ordinary, non-cached result", () => {
    renderResult({ ...CLEAN_RESULT, barcode: "4011200296908", caveats: [] });

    expect(screen.getByText(/geprüft ·/)).toBeInTheDocument();
    expect(screen.queryByText(/Offline — Ergebnis aus Abfrage vom/)).not.toBeInTheDocument();
  });

  // Cache honesty is display-only: a stale cached JA/SPUREN must stay just as
  // alarming as a fresh one, never softened by the "offline" annotation.
  it("keeps a cached hit result fully alarming", () => {
    renderResult({
      barcode: "20137946",
      productName: "Erdnuss-Riegel",
      brand: "ACME",
      status: "JA",
      ingredients: "Erdnüsse",
      found: "Erdnüsse",
      cachedAt: new Date().toISOString(),
    });

    expect(screen.getByText("Erdnuss enthalten.")).toBeInTheDocument();
  });
});

describe("ResultScreen network-error last known verdict", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const NETWORK_ERROR_RESULT: ProductResult = {
    barcode: "4011200296908",
    productName: null,
    brand: null,
    status: "KEINE_DATEN",
    message: "Netzwerkfehler – deine Allergene können nicht ausgeschlossen werden.",
    networkError: true,
  };

  const PRIOR_ENTRY: HistoryEntry = {
    id: "h_1_4011200296908",
    ts: Date.now() - 2 * 86_400_000,
    barcode: "4011200296908",
    name: "Erdnuss-Riegel",
    brand: "ACME",
    verdict: "safe",
  };

  it("shows the barcode's last known verdict as supplementary info, not a fresh one", () => {
    renderResult(NETWORK_ERROR_RESULT, PRIOR_ENTRY);

    expect(screen.getByText(/aktuell nicht verifizierbar/)).toBeInTheDocument();
    expect(screen.getByText("Sicher")).toBeInTheDocument();
    // The card underneath still reads "Keine Daten", not the old verdict.
    expect(screen.getByText("Keine Daten.")).toBeInTheDocument();
  });

  it("shows nothing extra when there is no prior scan for this barcode", () => {
    renderResult(NETWORK_ERROR_RESULT, null);

    expect(screen.queryByText(/aktuell nicht verifizierbar/)).not.toBeInTheDocument();
  });

  it("does not show the last-known note for a server-reported KEINE_DATEN", () => {
    renderResult(
      { ...NETWORK_ERROR_RESULT, networkError: undefined, message: "Produkt nicht gefunden." },
      PRIOR_ENTRY,
    );

    expect(screen.queryByText(/aktuell nicht verifizierbar/)).not.toBeInTheDocument();
  });
});
