import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResultScreen from "@/components/screens/ResultScreen";
import type { ProductResult } from "@/lib/types";
import type { HistoryEntry } from "@/components/useHistory";
import { readPackMatch } from "@/lib/packmatch";
import { readNote, writeNote } from "@/lib/notes";
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
  opts: {
    worsenedFrom?: HistoryEntry | null;
    tracesStrict?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
  } = {},
) {
  render(
    <ResultScreen
      P={palette("mustard")}
      result={result}
      lastKnown={lastKnown}
      worsenedFrom={opts.worsenedFrom ?? null}
      selectedAllergens={["peanut"]}
      tracesStrict={opts.tracesStrict ?? false}
      haptic={false}
      sound={false}
      loading={false}
      isFavorite={opts.isFavorite ?? false}
      onToggleFavorite={opts.onToggleFavorite ?? (() => {})}
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

describe("ResultScreen unknown-result copy by kind", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const BASE: ProductResult = {
    barcode: "4011200296908",
    productName: null,
    brand: null,
    status: "KEINE_DATEN",
  };

  it("shows the not-found framing for a definitive not-found", () => {
    renderResult({ ...BASE, kind: "not-found", message: "Produkt nicht in der Datenbank gefunden." });

    expect(screen.getByText("Kein Eintrag gefunden")).toBeInTheDocument();
  });

  it("shows a distinct framing for a record without ingredient data", () => {
    renderResult({ ...BASE, kind: "no-data", message: "Keine Zutaten- oder Allergendaten vorhanden." });

    expect(screen.getByText("Eintrag ohne Zutatenangaben")).toBeInTheDocument();
    expect(screen.queryByText("Kein Eintrag gefunden")).not.toBeInTheDocument();
  });

  it("shows an urgent, retry-emphasized framing for a server error", () => {
    renderResult({ ...BASE, kind: "error", message: "Daten konnten nicht abgerufen werden." });

    expect(screen.getByText("Gerade keine Verbindung")).toBeInTheDocument();
    expect(screen.getByText("Gerade keine Verbindung.")).toBeInTheDocument(); // the headline
    expect(screen.getByRole("button", { name: /Jetzt erneut prüfen/ })).toBeInTheDocument();
  });

  it("treats the client-side network fallback the same as a server error", () => {
    renderResult({ ...BASE, networkError: true, message: "Netzwerkfehler." });

    expect(screen.getByText("Gerade keine Verbindung")).toBeInTheDocument();
  });

  it("does not show a branded unknown card while a pack mismatch is in effect", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "mismatch", ts: 1 } }),
    );
    renderResult(CLEAN_RESULT);

    expect(screen.queryByText("Kein Eintrag gefunden")).not.toBeInTheDocument();
    expect(screen.getByText("Andere Packung")).toBeInTheDocument();
  });
});

describe("ResultScreen strict-mode traces", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const TRACE_RESULT: ProductResult = {
    barcode: "4011200296908",
    productName: "Keks",
    brand: "ACME",
    status: "SPUREN",
    ingredients: "Mehl, kann Spuren von Erdnuss enthalten",
    found: null,
  };

  it("stays amber, with no strict chip, when strict mode is off", () => {
    renderResult(TRACE_RESULT, null, { tracesStrict: false });

    expect(screen.queryByText("Strikt: wie Treffer")).not.toBeInTheDocument();
    expect(screen.queryByText(/wie ein Treffer behandelt/)).not.toBeInTheDocument();
  });

  it("shows the strict chip and note when strict mode is on", () => {
    renderResult(TRACE_RESULT, null, { tracesStrict: true });

    expect(screen.getByText("Strikt: wie Treffer")).toBeInTheDocument();
    expect(screen.getByText(/wie ein Treffer behandelt/)).toBeInTheDocument();
    // The category itself must stay legible, not be replaced by the hit word.
    expect(screen.getByText("Spuren möglich.")).toBeInTheDocument();
  });
});

describe("ResultScreen data-age warning", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds an age warning to an old record on an otherwise clean result", () => {
    const threeYearsAgo = Math.floor(Date.now() / 1000) - 3 * 365 * 24 * 60 * 60;
    renderResult({
      barcode: "4011200296908",
      productName: "Keks",
      brand: "ACME",
      status: "NEIN",
      ingredients: "Mehl",
      dataLastModified: threeYearsAgo,
    });

    expect(screen.getByText(/seit über 2 Jahren nicht bearbeitet/)).toBeInTheDocument();
  });

  it("does not warn about a recently edited record", () => {
    const lastWeek = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    renderResult({
      barcode: "4011200296908",
      productName: "Keks",
      brand: "ACME",
      status: "NEIN",
      ingredients: "Mehl",
      dataLastModified: lastWeek,
    });

    expect(screen.queryByText(/seit über 2 Jahren nicht bearbeitet/)).not.toBeInTheDocument();
  });

  it("does not warn on a hit, even with a very old record", () => {
    const threeYearsAgo = Math.floor(Date.now() / 1000) - 3 * 365 * 24 * 60 * 60;
    renderResult({
      barcode: "4011200296908",
      productName: "Riegel",
      brand: "ACME",
      status: "JA",
      ingredients: "Erdnüsse",
      found: "Erdnüsse",
      dataLastModified: threeYearsAgo,
    });

    expect(screen.queryByText(/seit über 2 Jahren nicht bearbeitet/)).not.toBeInTheDocument();
  });
});

describe("ResultScreen verdict-worsening warning", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const PRIOR_SAFE: HistoryEntry = {
    id: "h_1_4011200296908",
    ts: Date.now() - 30 * 86_400_000,
    barcode: "4011200296908",
    name: "Riegel",
    brand: "ACME",
    verdict: "safe",
  };

  it("shows a prominent strip when the caller flags a worsening", () => {
    renderResult(
      {
        barcode: "4011200296908",
        productName: "Riegel",
        brand: "ACME",
        status: "JA",
        ingredients: "Erdnüsse",
        found: "Erdnüsse",
      },
      null,
      { worsenedFrom: PRIOR_SAFE },
    );

    expect(screen.getByText(/Zuletzt als/)).toBeInTheDocument();
    expect(screen.getAllByText("Sicher").length).toBeGreaterThan(0);
  });

  it("shows nothing when there is nothing to compare against", () => {
    renderResult(
      {
        barcode: "4011200296908",
        productName: "Riegel",
        brand: "ACME",
        status: "JA",
        ingredients: "Erdnüsse",
        found: "Erdnüsse",
      },
      null,
      { worsenedFrom: null },
    );

    expect(screen.queryByText(/Zuletzt als/)).not.toBeInTheDocument();
  });
});

describe("ResultScreen pack-match answer age", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows how long ago the stored answer was given", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "match", ts: Date.now() - 10_000 } }),
    );

    renderResult();

    expect(screen.getByText(/gegencheck · von dir · Gerade eben/)).toBeInTheDocument();
    expect(screen.getByText(/für 90 Tage/)).toBeInTheDocument();
  });

  it("asks again once a stored 'match' answer has aged past 90 days", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "match", ts: Date.now() - 100 * 86_400_000 } }),
    );

    renderResult();

    expect(screen.getByText("Passt das zu deiner Packung?")).toBeInTheDocument();
    expect(screen.queryByText("Passt zu deiner Packung")).not.toBeInTheDocument();
  });
});

describe("ResultScreen personal note (F5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers to add a note when none exists yet", () => {
    renderResult();

    expect(screen.getByRole("button", { name: "Notiz hinzufügen" })).toBeInTheDocument();
  });

  it("saves a new note and shows it without staying in edit mode", () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Notiz hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Notiz zu diesem Produkt"), {
      target: { value: "Sorte Schoko okay, Crunchy nicht" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByText("Sorte Schoko okay, Crunchy nicht")).toBeInTheDocument();
    expect(screen.queryByLabelText("Notiz zu diesem Produkt")).not.toBeInTheDocument();
    expect(readNote("20137946")).toBe("Sorte Schoko okay, Crunchy nicht");
  });

  it("pre-fills the existing note when editing", () => {
    writeNote("20137946", "Bereits vorhandene Notiz");
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Notiz bearbeiten" }));

    expect(screen.getByLabelText("Notiz zu diesem Produkt")).toHaveValue(
      "Bereits vorhandene Notiz",
    );
  });

  it("clears the note when saved blank", () => {
    writeNote("20137946", "Wird gelöscht");
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Notiz bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Notiz zu diesem Produkt"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.queryByText("Wird gelöscht")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notiz hinzufügen" })).toBeInTheDocument();
    expect(readNote("20137946")).toBeNull();
  });

  it("discards the draft on cancel", () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Notiz hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Notiz zu diesem Produkt"), {
      target: { value: "verworfen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByText("verworfen")).not.toBeInTheDocument();
    expect(readNote("20137946")).toBeNull();
  });
});

describe("ResultScreen favorite star (F2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers to star when not yet a favorite", () => {
    renderResult();

    expect(
      screen.getByRole("button", { name: "Zu Favoriten hinzufügen" }),
    ).toBeInTheDocument();
  });

  it("offers to un-star an already-favorited result and calls back on tap", () => {
    const onToggleFavorite = vi.fn();
    renderResult(CLEAN_RESULT, null, { isFavorite: true, onToggleFavorite });

    fireEvent.click(screen.getByRole("button", { name: "Aus Favoriten entfernen" }));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });
});

describe("ResultScreen share (F6)", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  it("shares product, EAN, verdict label with its caveat wording, and the OFF link via Web Share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    renderResult();
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis teilen" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const text = (share.mock.calls[0]![0] as ShareData).text as string;
    expect(text).toContain("Gelatelli mini mix fruit");
    expect(text).toContain("Gelatelli");
    expect(text).toContain("EAN 20137946");
    // "partial" verdict: the label alone never appears without its caveat.
    expect(text).toContain("Vorbehalt");
    expect(text).toContain("Handels-Eigencode");
    expect(text).toContain("https://world.openfoodfacts.org/product/20137946");
  });

  it("respects a user-cancelled share sheet instead of falling back to the clipboard", async () => {
    const share = vi.fn().mockImplementation(async () => {
      const err = new Error("cancelled");
      err.name = "AbortError";
      throw err;
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderResult();
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis teilen" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard with a brief confirmation when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderResult();
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis teilen" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain("EAN 20137946");
    expect(await screen.findByText("In die Zwischenablage kopiert.")).toBeInTheDocument();
  });

  it("shows no false confirmation when neither Web Share nor the clipboard API exists", async () => {
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "Ergebnis teilen" }));

    // Give any (non-existent) async work a tick to settle, then confirm the
    // "kopiert" toast never appears — nothing was actually copied.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("In die Zwischenablage kopiert.")).not.toBeInTheDocument();
  });

  it("carries a fail-safe framing for a real hit, never a bare 'sicher'", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    renderResult({
      barcode: "20137946",
      productName: "Erdnuss-Riegel",
      brand: "ACME",
      status: "JA",
      ingredients: "Erdnüsse",
      found: "Erdnüsse",
    });
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis teilen" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const text = (share.mock.calls[0]![0] as ShareData).text as string;
    expect(text).toContain("Erdnuss enthalten");
    expect(text).not.toMatch(/\bsicher\b/i);
  });
});
