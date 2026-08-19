import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ResultScreen from "@/components/screens/ResultScreen";
import type { ProductResult } from "@/lib/types";
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

function renderResult(result: ProductResult = CLEAN_RESULT) {
  render(
    <ResultScreen
      P={palette("mustard")}
      result={result}
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
