import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductResult } from "@/lib/types";
import { __clearProductLookupCache } from "@/components/useProductLookup";

// ScanScreen owns the camera (BarcodeScanner/@zxing) — irrelevant to the
// dialog-wiring and verdict-worsening behavior under test here, so it is
// replaced with a minimal stub that exposes the callbacks these tests drive:
// onDetected and onTab (to reach Verlauf without a real TabBar). Real camera
// behavior is covered by BarcodeScanner.test.tsx.
vi.mock("@/components/screens/ScanScreen", () => ({
  default: (props: {
    onDetected: (barcode: string) => void;
    onTab: (t: "scan" | "verlauf" | "profil") => void;
  }) => (
    <div data-testid="scan-screen-stub">
      <button type="button" onClick={() => props.onDetected("4011200296908")}>
        simulate detect
      </button>
      <button type="button" onClick={() => props.onTab("verlauf")}>
        goto verlauf
      </button>
    </div>
  ),
}));

import Home from "@/app/page";

function jsonResponse(body: ProductResult) {
  return { json: async () => body, headers: new Headers() } as unknown as Response;
}

describe("Home result dialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Skip onboarding so the scan screen mounts immediately.
    window.localStorage.setItem("peanot.prefs.v1", JSON.stringify({ onboarded: true }));
    vi.stubGlobal("fetch", vi.fn());
    // jsdom has no matchMedia; page.tsx uses it to track the OS color scheme.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __clearProductLookupCache();
  });

  it("makes the background inert and marks the result as a dialog once a verdict is shown", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        barcode: "4011200296908",
        productName: "Riegel",
        brand: "ACME",
        status: "NEIN",
      }),
    );

    const { container } = render(<Home />);
    await userEvent.click(await screen.findByText("simulate detect"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // The background (the div wrapping the ScanScreen stub) must be inert
    // while the dialog is open — otherwise VoiceOver can wander behind it.
    const scanWrapper = container.querySelector('[data-testid="scan-screen-stub"]')!.parentElement!;
    expect(scanWrapper).toHaveAttribute("inert");
  });

  it("does not warn on a first scan, but warns when a later scan of the same barcode gets worse", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          barcode: "4011200296908",
          productName: "Riegel",
          brand: "ACME",
          status: "NEIN",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          barcode: "4011200296908",
          productName: "Riegel",
          brand: "ACME",
          status: "JA",
          found: "Erdnüsse",
          ingredients: "Erdnüsse",
        }),
      );

    render(<Home />);

    await userEvent.click(await screen.findByText("simulate detect"));
    await screen.findByRole("dialog");
    expect(screen.queryByText(/gespeichert — jetzt/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Schließen/ }));

    // Simulate the realistic trigger for this feature: the barcode is
    // rescanned in a later session (history survives in localStorage, but
    // the in-memory per-session result cache — cleared on reload — does
    // not), so the second scan is a genuine fresh lookup, not a cache hit.
    __clearProductLookupCache();

    await userEvent.click(await screen.findByText("simulate detect"));
    await screen.findByRole("dialog");

    // The warning text is split across inline <strong> tags in the visible
    // strip, so assert via the single-text-node aria-live announcement
    // instead — it carries the same "zuletzt X, jetzt Y" note.
    expect(await screen.findByText(/zuletzt Sicher, jetzt Erdnuss enthalten/)).toBeInTheDocument();
    // Informational only: the worsening note is not the only thing that
    // changed — the verdict itself (a real hit) still drives the alarm below.
    expect(screen.getByText("Erdnuss enthalten.")).toBeInTheDocument();
  });
});

describe("Home allergy card access (UX7)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("peanot.prefs.v1", JSON.stringify({ onboarded: true }));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns to the tab that opened the card, not always Scan", async () => {
    render(<Home />);

    // Reach Verlauf (via the stubbed ScanScreen's onTab), open the card from
    // Verlauf's TopBar, then go back — it should land back on Verlauf.
    await userEvent.click(await screen.findByText("goto verlauf"));
    await userEvent.click(await screen.findByRole("button", { name: "Allergie-Karte öffnen" }));
    expect(await screen.findByText("Allergie-Karte")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    expect(screen.getByRole("heading", { name: "Verlauf" })).toBeInTheDocument();
    expect(screen.queryByText("Allergie-Karte")).not.toBeInTheDocument();
  });
});
