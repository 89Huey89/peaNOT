import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultDisplay from "@/components/ResultDisplay";
import type { ProductResult } from "@/lib/types";

function result(partial: Partial<ProductResult>): ProductResult {
  return {
    barcode: "4011200296908",
    productName: "Test Produkt",
    brand: "ACME",
    status: "NEIN",
    ...partial,
  };
}

describe("ResultDisplay", () => {
  it("renders the product name and brand", () => {
    render(<ResultDisplay result={result({ productName: "Erdnussriegel", brand: "ACME" })} />);
    expect(screen.getByText("Erdnussriegel")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
  });

  it("falls back when product name is null", () => {
    render(<ResultDisplay result={result({ productName: null })} />);
    expect(screen.getByText("Unbekanntes Produkt")).toBeInTheDocument();
  });

  it.each([
    ["JA", "ERDNUSS: JA", "status--ja"],
    ["SPUREN", "KANN SPUREN ENTHALTEN", "status--spuren"],
    ["NEIN", "ERDNUSS: NEIN", "status--nein"],
    ["KEINE_DATEN", "KEINE DATEN", "status--keine-daten"],
  ] as const)("renders %s with its label and color class", (status, label, className) => {
    const { container } = render(<ResultDisplay result={result({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`.${className}`)).not.toBeNull();
  });

  it("renders KEINE_DATEN as danger, not as the safe green class", () => {
    const { container } = render(<ResultDisplay result={result({ status: "KEINE_DATEN" })} />);
    expect(container.querySelector(".status--keine-daten")).not.toBeNull();
    expect(container.querySelector(".status--nein")).toBeNull();
  });

  it("uses the provided message when present", () => {
    render(
      <ResultDisplay
        result={result({ status: "KEINE_DATEN", message: "Eigene Warnung" })}
      />,
    );
    expect(screen.getByText("Eigene Warnung")).toBeInTheDocument();
  });
});
