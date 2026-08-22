import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanScreen from "@/components/screens/ScanScreen";
import { palette } from "@/lib/theme";
import { DEFAULT_EMERGENCY_PLAN, type EmergencyPlan } from "@/lib/emergency";
import type { RecallWatchHit } from "@/lib/recalls/watch";
import type { Person } from "@/lib/persons";

const SINGLE_PERSON: Person[] = [{ id: "p1", name: "Ich", allergens: ["peanut"] }];

// BarcodeScanner owns real camera access (@zxing/browser, getUserMedia) —
// irrelevant to the bottom-sheet behavior under test here (UX8), so it's
// replaced with a lightweight stub. Real camera behavior is covered by
// BarcodeScanner.test.tsx.
vi.mock("@/components/BarcodeScanner", () => ({
  default: ({ autoStart }: { autoStart?: boolean }) => (
    <div data-testid="barcode-scanner-stub" data-auto-start={String(Boolean(autoStart))} />
  ),
}));

// Real product-name search (debounced fetch) is exercised by
// useProductSearch.test.ts / ProductSearch.test.tsx; here ScanScreen only
// needs to know the search sheet renders *some* selectable result so its own
// wiring (closing on selection, forwarding knownVerdicts) can be tested
// without fake timers or network mocking.
const SEARCH_HIT = {
  barcode: "4011200296908",
  productName: "Magnum Mandel",
  brand: "Magnum",
  imageUrl: null,
};
vi.mock("@/components/useProductSearch", () => ({
  useProductSearch: () => ({
    searching: false,
    results: [SEARCH_HIT],
    query: "magnum",
    search: vi.fn(),
  }),
}));

type HistoryEntryLike = {
  id: string;
  ts: number;
  barcode: string;
  name: string;
  brand: string;
  verdict: "safe" | "danger" | "trace" | "partial" | "unknown";
};

function renderScreen(
  favorites: Array<{
    barcode: string;
    name: string;
    brand: string;
    verdict: "safe" | "danger" | "trace" | "partial" | "unknown";
    ts: number;
    addedAt: number;
  }> = [],
  opts: {
    autoStartCamera?: boolean;
    loading?: boolean;
    history?: HistoryEntryLike[];
    recallHits?: RecallWatchHit[];
    emergencyPlan?: EmergencyPlan;
    persons?: Person[];
    activePersonId?: string;
  } = {},
) {
  const onDetected = vi.fn();
  const onOpenFavorite = vi.fn();
  const onOpenNotfall = vi.fn();
  const onAcknowledgeRecall = vi.fn();
  const onSwitchPerson = vi.fn();
  const persons = opts.persons ?? SINGLE_PERSON;
  const { container } = render(
    <ScanScreen
      P={palette("mustard")}
      loading={opts.loading ?? false}
      paused={false}
      haptic={false}
      sound={false}
      autoStartCamera={opts.autoStartCamera ?? false}
      history={opts.history ?? []}
      favorites={favorites}
      persons={persons}
      activePersonId={opts.activePersonId ?? persons[0]!.id}
      onSwitchPerson={onSwitchPerson}
      recallHits={opts.recallHits ?? []}
      onAcknowledgeRecall={onAcknowledgeRecall}
      emergencyPlan={opts.emergencyPlan ?? DEFAULT_EMERGENCY_PLAN}
      onDetected={onDetected}
      onOpen={vi.fn()}
      onOpenFavorite={onOpenFavorite}
      onOpenCard={vi.fn()}
      onOpenNotfall={onOpenNotfall}
      onTab={vi.fn()}
    />,
  );
  return { onDetected, onOpenFavorite, onOpenNotfall, onAcknowledgeRecall, onSwitchPerson, container };
}

async function openManual() {
  await userEvent.click(await screen.findByRole("button", { name: /Barcode manuell eingeben/ }));
}

async function openSearch() {
  await userEvent.click(await screen.findByRole("button", { name: /Nach Name suchen/ }));
}

describe("ScanScreen entry sheet (UX8)", () => {
  it("opens the manual-entry sheet as a dialog with the field already focused", async () => {
    renderScreen();
    await openManual();

    const dialog = screen.getByRole("dialog", { name: "Barcode manuell eingeben" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Barcode manuell eingeben" })).toHaveFocus();
  });

  it("opens the search sheet with its field focused", async () => {
    renderScreen();
    await openSearch();

    expect(screen.getByRole("dialog", { name: "Nach Name suchen" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Nach Name suchen" })).toHaveFocus();
  });

  it("opening search while manual entry is open replaces it, not stacks it", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("textbox", { name: "Barcode manuell eingeben" })).toBeInTheDocument();

    await openSearch();

    expect(
      screen.queryByRole("textbox", { name: "Barcode manuell eingeben" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Nach Name suchen" })).toBeInTheDocument();
    // Still only one sheet dialog, never two stacked.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("tapping its own toggle button again closes the sheet", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await openManual();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a scrim tap", async () => {
    renderScreen();
    await openManual();

    await userEvent.click(screen.getAllByRole("button", { name: "Schließen" })[0]!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on the Schließen button and returns focus to the button that opened it", async () => {
    renderScreen();
    const opener = await screen.findByRole("button", { name: /Barcode manuell eingeben/ });
    await userEvent.click(opener);

    // The scrim and the header button share the "Schließen" name — the
    // header one is last in the dialog's DOM order.
    const closeButtons = screen.getAllByRole("button", { name: "Schließen" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still forwards a manually entered barcode via onDetected", async () => {
    const { onDetected } = renderScreen();
    await openManual();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Barcode manuell eingeben" }),
      "4011200296908",
    );
    await userEvent.click(screen.getByRole("button", { name: "Prüfen" }));

    expect(onDetected).toHaveBeenCalledWith("4011200296908");
    // Befund 05: no more stale sheet lingering behind the result — closing
    // it is what "clears the field" too, since the next open is a fresh
    // ManualEntry mount rather than the same instance with old input.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("makes the scanner and tab bar inert while the sheet is open", async () => {
    const { container } = renderScreen();
    await openManual();

    const scannerStub = screen.getByTestId("barcode-scanner-stub");
    const inertWrapper = container.querySelector("[inert]");
    expect(inertWrapper).not.toBeNull();
    expect(inertWrapper?.contains(scannerStub)).toBe(true);
  });
});

describe("ScanScreen auto-start camera (UX10)", () => {
  it("forwards autoStartCamera to BarcodeScanner as autoStart", () => {
    renderScreen([], { autoStartCamera: true });

    expect(screen.getByTestId("barcode-scanner-stub")).toHaveAttribute(
      "data-auto-start",
      "true",
    );
  });

  it("defaults to not auto-starting", () => {
    renderScreen();

    expect(screen.getByTestId("barcode-scanner-stub")).toHaveAttribute(
      "data-auto-start",
      "false",
    );
  });
});

describe("ScanScreen Notfallplan entry (F4)", () => {
  it("offers a Notfallplan button next to Allergie-Karte zeigen", async () => {
    const { onOpenNotfall } = renderScreen();

    await userEvent.click(screen.getByRole("button", { name: /Notfallplan/ }));

    expect(onOpenNotfall).toHaveBeenCalled();
  });
});

describe("ScanScreen Favoriten strip (F2)", () => {
  it("shows nothing when there are no favorites", () => {
    renderScreen([]);

    expect(screen.queryByText("favoriten")).not.toBeInTheDocument();
  });

  it("lists a starred staple and re-checks it on tap", async () => {
    const { onOpenFavorite } = renderScreen([
      {
        barcode: "20137946",
        name: "Reiswaffel",
        brand: "dm Bio",
        verdict: "safe",
        ts: Date.now(),
        addedAt: Date.now(),
      },
    ]);

    expect(screen.getByText("favoriten")).toBeInTheDocument();
    expect(screen.getByText("Reiswaffel")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Reiswaffel"));

    expect(onOpenFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: "20137946" }),
    );
  });
});

describe("ScanScreen layout order (Befund 04)", () => {
  it("places the Favoriten strip before the manual/search entry buttons", () => {
    renderScreen([
      {
        barcode: "20137946",
        name: "Reiswaffel",
        brand: "dm Bio",
        verdict: "safe",
        ts: Date.now(),
        addedAt: Date.now(),
      },
    ]);

    const favoritenLabel = screen.getByText("favoriten");
    const manualButton = screen.getByRole("button", { name: "Barcode manuell eingeben" });

    // DOCUMENT_POSITION_FOLLOWING: manualButton comes *after* favoritenLabel
    // in DOM order, i.e. Favoriten renders first.
    expect(
      favoritenLabel.compareDocumentPosition(manualButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps Allergie-Karte and Notfallplan as a distinct pair, still after the entry buttons", () => {
    renderScreen();

    const manualButton = screen.getByRole("button", { name: "Barcode manuell eingeben" });
    const cardButton = screen.getByRole("button", { name: "Allergie-Karte" });
    const notfallButton = screen.getByRole("button", { name: /Notfallplan/ });

    expect(
      manualButton.compareDocumentPosition(cardButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      manualButton.compareDocumentPosition(notfallButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("ScanScreen entry sheet closes on submit/select (Befund 05)", () => {
  it("closes the search sheet after selecting a result and forwards its barcode", async () => {
    const { onDetected } = renderScreen();
    await openSearch();

    await userEvent.click(screen.getByRole("button", { name: /Magnum Mandel/ }));

    expect(onDetected).toHaveBeenCalledWith(SEARCH_HIT.barcode);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to the opener after a submit closes the sheet", async () => {
    renderScreen();
    const opener = await screen.findByRole("button", { name: "Barcode manuell eingeben" });
    await userEvent.click(opener);

    await userEvent.type(
      screen.getByRole("textbox", { name: "Barcode manuell eingeben" }),
      "4011200296908",
    );
    await userEvent.click(screen.getByRole("button", { name: "Prüfen" }));

    // Same opener-focus mechanism as Escape/scrim/✕ — see the comment on the
    // effect in ScanScreen.tsx for why this is still wanted even though the
    // result overlay is about to take over.
    expect(opener).toHaveFocus();
  });
});

describe("ScanScreen entry sheet loading state (Befund 05)", () => {
  it("shows a busy state in the manual-entry sheet while a lookup is already in flight", async () => {
    renderScreen([], { loading: true });
    await openManual();

    const button = screen.getByRole("button", { name: /Prüfe/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("shows a busy state in the search sheet while a lookup is already in flight", async () => {
    renderScreen([], { loading: true });
    await openSearch();

    expect(screen.getByRole("status", { name: /Prüfe Produkt/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Magnum Mandel/ })).toBeDisabled();
  });
});

describe("ScanScreen search results show known verdicts (Befund 11)", () => {
  it("marks a result matching a history entry with its verdict, labeled as a past check", async () => {
    renderScreen([], {
      history: [
        {
          id: "h1",
          ts: Date.now() - 5 * 60_000,
          barcode: SEARCH_HIT.barcode,
          name: SEARCH_HIT.productName,
          brand: SEARCH_HIT.brand,
          verdict: "safe",
        },
      ],
    });
    await openSearch();

    // Glyph, not color alone (the app's rule: never color-only status) —
    // and an accessible name that reads as a past check, not a fresh one.
    const mark = screen.getByLabelText(/Zuletzt geprüft/);
    expect(mark).toHaveTextContent("✓");
  });

  it("shows no verdict mark for a result with no matching history/favorite", async () => {
    renderScreen();
    await openSearch();

    expect(screen.queryByLabelText(/Zuletzt geprüft/)).not.toBeInTheDocument();
  });
});

describe("ScanScreen Rückruf-Wächter strip (F5)", () => {
  const hit = {
    barcode: "4011200296908",
    name: "ültje Erdnüsse pikant gewürzt",
    brand: "ültje",
    match: {
      title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
      link: "https://www.lebensmittelwarnung.de/x",
      publishedDate: 1_700_000_000_000,
    },
  };

  it("shows nothing when there are no watched recall hits", () => {
    renderScreen([], { recallHits: [] });

    expect(screen.queryByText(/Rückruf/)).not.toBeInTheDocument();
  });

  it("never claims there are no recalls — no such text renders at all", () => {
    renderScreen([], { recallHits: [] });

    expect(screen.queryByText(/keine Rückrufe/i)).not.toBeInTheDocument();
  });

  it("shows a singular strip for exactly one hit", () => {
    renderScreen([], { recallHits: [hit] });

    expect(
      screen.getByText("1 Rückruf betrifft möglicherweise ein Stammprodukt"),
    ).toBeInTheDocument();
  });

  it("shows a plural strip for more than one hit", () => {
    renderScreen([], {
      recallHits: [hit, { ...hit, barcode: "20137946", name: "Reiswaffel" }],
    });

    expect(
      screen.getByText("2 Rückrufe betreffen möglicherweise Stammprodukte"),
    ).toBeInTheDocument();
  });

  it("reveals the affected product, the notice and a link on tap", async () => {
    renderScreen([], { recallHits: [hit] });

    await userEvent.click(
      screen.getByRole("button", { name: /1 Rückruf betrifft möglicherweise ein Stammprodukt/ }),
    );

    expect(screen.getByText(hit.name)).toBeInTheDocument();
    expect(screen.getByText(hit.match.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meldung öffnen/ })).toHaveAttribute(
      "href",
      hit.match.link,
    );
  });

  it("acknowledges a hit via the strip's own control", async () => {
    const { onAcknowledgeRecall } = renderScreen([], { recallHits: [hit] });

    await userEvent.click(
      screen.getByRole("button", { name: /1 Rückruf betrifft möglicherweise ein Stammprodukt/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Geprüft, ausblenden" }));

    expect(onAcknowledgeRecall).toHaveBeenCalledWith(hit.barcode, hit.match);
  });

  it("places the recall strip before the camera's own heading", () => {
    renderScreen([], { recallHits: [hit] });

    const stripButton = screen.getByRole("button", {
      name: /1 Rückruf betrifft möglicherweise ein Stammprodukt/,
    });
    const cameraHeading = screen.getByText("Halte einen Code vor die Kamera.");

    expect(
      stripButton.compareDocumentPosition(cameraHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("ScanScreen Pen-Ablaufwarnung (Zusatz)", () => {
  function planWithPen(expiresOn: string): EmergencyPlan {
    return { ...DEFAULT_EMERGENCY_PLAN, pens: [{ label: "Rucksack", expiresOn }] };
  }

  it("shows nothing when there are no pens", () => {
    renderScreen([], { emergencyPlan: DEFAULT_EMERGENCY_PLAN });

    expect(screen.queryByText(/Adrenalin-Pen/)).not.toBeInTheDocument();
  });

  it("shows nothing when every pen is well within date", () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 2);
    renderScreen([], {
      emergencyPlan: planWithPen(farFuture.toISOString().slice(0, 10)),
    });

    expect(screen.queryByText(/Adrenalin-Pen/)).not.toBeInTheDocument();
  });

  it("shows a red hint for an expired pen and opens Notfallplan on tap", async () => {
    const { onOpenNotfall } = renderScreen([], {
      emergencyPlan: planWithPen("2020-01-01"),
    });

    const hint = screen.getByText("Ein Adrenalin-Pen ist abgelaufen — Notfallplan prüfen.");
    expect(hint).toBeInTheDocument();

    await userEvent.click(hint);
    expect(onOpenNotfall).toHaveBeenCalled();
  });

  it("shows an amber hint for a pen expiring soon", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    renderScreen([], { emergencyPlan: planWithPen(soon.toISOString().slice(0, 10)) });

    expect(
      screen.getByText("Ein Adrenalin-Pen läuft bald ab — Notfallplan prüfen."),
    ).toBeInTheDocument();
  });

  it("stays quiet for a pen with no date entered yet", () => {
    renderScreen([], { emergencyPlan: planWithPen("") });

    expect(screen.queryByText(/Adrenalin-Pen/)).not.toBeInTheDocument();
  });

  it("is clearly less prominent than the recall strip (no bordered card)", () => {
    renderScreen([], { emergencyPlan: planWithPen("2020-01-01") });

    const hint = screen.getByText("Ein Adrenalin-Pen ist abgelaufen — Notfallplan prüfen.");
    // The recall strip is a bordered button with a background tint; the pen
    // hint must not adopt that same treatment.
    expect(hint).toHaveStyle({ background: "transparent" });
  });
});

describe("ScanScreen person switcher (F part 2)", () => {
  const TWO_PERSONS: Person[] = [
    { id: "p1", name: "Ich", allergens: ["peanut"] },
    { id: "p2", name: "Ben", allergens: ["milk"] },
  ];

  it("renders nothing at all for a single-person household", () => {
    renderScreen([], { persons: SINGLE_PERSON });

    expect(screen.queryByRole("group", { name: "Person wählen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ben" })).not.toBeInTheDocument();
  });

  it("shows every person and marks the active one once a second exists", () => {
    renderScreen([], { persons: TWO_PERSONS, activePersonId: "p1" });

    expect(screen.getByRole("button", { name: "Ich" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ben" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the active person with a single tap, no trip through Profil", async () => {
    const { onSwitchPerson } = renderScreen([], { persons: TWO_PERSONS, activePersonId: "p1" });

    await userEvent.click(screen.getByRole("button", { name: "Ben" }));

    expect(onSwitchPerson).toHaveBeenCalledWith("p2");
  });
});
