import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductSearch from "@/components/ProductSearch";
import { palette } from "@/lib/theme";
import type { Verdict } from "@/lib/verdict";

// The debounced fetch behavior itself is covered by useProductSearch.test.ts;
// here the hook is mocked so ProductSearch's own rendering (selection,
// busy state, known-verdict marks) can be tested deterministically without
// fake timers or a network mock.
const searchMock = vi.fn();
const searchState: {
  searching: boolean;
  results: Array<{
    barcode: string;
    productName: string | null;
    brand: string | null;
    imageUrl: string | null;
  }>;
  query: string;
} = { searching: false, results: [], query: "" };

vi.mock("@/components/useProductSearch", () => ({
  useProductSearch: () => ({ ...searchState, search: searchMock }),
}));

function setSearchState(overrides: Partial<typeof searchState>) {
  Object.assign(searchState, { searching: false, results: [], query: "" }, overrides);
}

const P = palette("mustard");

afterEach(() => {
  searchMock.mockClear();
});

describe("ProductSearch", () => {
  it("selects a result and forwards its barcode", async () => {
    setSearchState({
      query: "magnum",
      results: [
        { barcode: "4011200296908", productName: "Magnum Mandel", brand: "Magnum", imageUrl: null },
      ],
    });
    const onSelect = vi.fn();
    render(<ProductSearch P={P} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /Magnum Mandel/ }));

    expect(onSelect).toHaveBeenCalledWith("4011200296908");
  });

  it("disables results and shows a busy state while a lookup is in flight (Befund 05)", () => {
    setSearchState({
      query: "magnum",
      results: [
        { barcode: "4011200296908", productName: "Magnum Mandel", brand: "Magnum", imageUrl: null },
      ],
    });
    render(<ProductSearch P={P} onSelect={vi.fn()} disabled />);

    expect(screen.getByRole("status", { name: /Prüfe Produkt/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Magnum Mandel/ })).toBeDisabled();
  });

  it("does not show a busy state when nothing is loading", () => {
    setSearchState({
      query: "magnum",
      results: [
        { barcode: "4011200296908", productName: "Magnum Mandel", brand: "Magnum", imageUrl: null },
      ],
    });
    render(<ProductSearch P={P} onSelect={vi.fn()} />);

    expect(screen.queryByRole("status", { name: /Prüfe Produkt/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Magnum Mandel/ })).not.toBeDisabled();
  });

  it("marks a result with a known verdict from favorites/history (Befund 11)", () => {
    setSearchState({
      query: "reiswaffel",
      results: [
        { barcode: "20137946", productName: "Reiswaffel", brand: "dm Bio", imageUrl: null },
      ],
    });
    const knownVerdicts = new Map<string, { verdict: Verdict; ts: number }>([
      ["20137946", { verdict: "safe", ts: Date.now() - 60_000 }],
    ]);

    render(<ProductSearch P={P} onSelect={vi.fn()} knownVerdicts={knownVerdicts} />);

    // The app never signals status via color alone — the mark carries the
    // verdict glyph too, and its accessible name is explicit that this is a
    // *past* check ("zuletzt geprüft"), not a fresh one just performed now.
    const mark = screen.getByLabelText(/Zuletzt geprüft/);
    expect(mark).toHaveTextContent("✓");
    expect(mark).toHaveAccessibleName(expect.stringMatching(/Zuletzt geprüft/));
  });

  it("shows no mark for a result with no known verdict", () => {
    setSearchState({
      query: "unbekannt",
      results: [
        { barcode: "999", productName: "Unbekanntes Produkt", brand: null, imageUrl: null },
      ],
    });

    render(<ProductSearch P={P} onSelect={vi.fn()} />);

    expect(screen.queryByLabelText(/Zuletzt geprüft/)).not.toBeInTheDocument();
  });
});
