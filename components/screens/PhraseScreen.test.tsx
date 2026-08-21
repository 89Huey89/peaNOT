import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PhraseScreen from "@/components/screens/PhraseScreen";
import { phraseFor } from "@/lib/phrases";
import { palette } from "@/lib/theme";

function renderScreen(cardNote = "") {
  const onCardNoteChange = vi.fn();
  const onBack = vi.fn();
  render(
    <PhraseScreen
      P={palette("mustard")}
      selectedAllergens={["peanut"]}
      cardNote={cardNote}
      onCardNoteChange={onCardNoteChange}
      onBack={onBack}
    />,
  );
  return { onCardNoteChange, onBack };
}

function openFullscreen() {
  fireEvent.click(screen.getByRole("button", { name: "Groß anzeigen" }));
}

/** A minimal WakeLockSentinel double good enough for the request()/release()/
 * "release" event contract PhraseScreen relies on. */
function makeSentinel() {
  const listeners: Record<string, () => void> = {};
  return {
    released: false,
    type: "screen" as const,
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = cb;
    }),
    removeEventListener: vi.fn(),
    fireRelease: () => listeners.release?.(),
  };
}

function stubWakeLock(sentinel: ReturnType<typeof makeSentinel>) {
  const request = vi.fn().mockResolvedValue(sentinel);
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  return request;
}

beforeEach(() => {
  // useHistoryOverlay (UX9) pops its own pushState entry via history.back()
  // whenever the fullscreen view closes by any means other than the back
  // gesture itself (Schließen/Escape) — jsdom fires the resulting popstate
  // asynchronously, which would otherwise leak into a *later* test's own
  // dispatched popstate. Made synchronous here so every test's history
  // interactions stay fully self-contained.
  vi.spyOn(window.history, "back").mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
  vi.restoreAllMocks();
});

describe("PhraseScreen fullscreen view (UX4)", () => {
  it("does not close when tapping inside the view — only the dedicated Schließen button does", () => {
    renderScreen();
    openFullscreen();

    const dialog = screen.getByRole("dialog", { name: "Allergie-Karte, große Anzeige" });
    fireEvent.click(dialog);
    fireEvent.click(screen.getByText(/lebensbedrohliche Allergie/));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderScreen();
    openFullscreen();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a browser back navigation, i.e. the iPhone edge-swipe gesture (UX9)", () => {
    const { onBack } = renderScreen();
    openFullscreen();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.popState(window);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Only the fullscreen overlay closes — the karte screen underneath it
    // (its own history entry, pushed one level up in app/page.tsx) stays put.
    expect(onBack).not.toHaveBeenCalled();
  });

  it("renders the sentence as plain readable text, with no aria-label overriding it", () => {
    renderScreen();
    openFullscreen();

    const sentence = screen.getByText(/lebensbedrohliche Allergie/);
    expect(sentence).not.toHaveAttribute("aria-label");
    // The dialog's own name must not swallow the sentence: they're different
    // accessible nodes, so the visible text is still independently reachable.
    expect(screen.getByRole("dialog").getAttribute("aria-label")).not.toContain(
      sentence.textContent,
    );
  });

  it("requests a screen wake lock while shown and releases it on close (feature-detected)", async () => {
    const sentinel = makeSentinel();
    const request = stubWakeLock(sentinel);

    renderScreen();
    openFullscreen();

    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
    await waitFor(() => expect(sentinel.addEventListener).toHaveBeenCalledWith(
      "release",
      expect.any(Function),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("never throws when the Wake Lock API isn't available", () => {
    Reflect.deleteProperty(navigator, "wakeLock");

    expect(() => {
      renderScreen();
      openFullscreen();
      fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    }).not.toThrow();
  });

  it("swallows a rejected wake lock request instead of throwing", async () => {
    const request = vi.fn().mockRejectedValue(new Error("nope"));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });

    renderScreen();
    openFullscreen();

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("PhraseScreen eigener Zusatz (F7a)", () => {
  it("reports edits via onCardNoteChange", () => {
    const { onCardNoteChange } = renderScreen();

    fireEvent.change(screen.getByPlaceholderText(/Adrenalin-Pen/), {
      target: { value: "Notfallnummer: 0170 123456" },
    });

    expect(onCardNoteChange).toHaveBeenCalledWith("Notfallnummer: 0170 123456");
  });

  it("shows the addendum on the card, labeled and separate from the verified sentence", () => {
    renderScreen("Adrenalin-Pen ist im Rucksack.");

    expect(screen.getByText("Eigener Zusatz")).toBeInTheDocument();
    // { selector: "p" } excludes the editable textarea below, whose value
    // happens to match the same text.
    expect(
      screen.getByText("Adrenalin-Pen ist im Rucksack.", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("also shows the addendum in the fullscreen view", () => {
    renderScreen("Adrenalin-Pen ist im Rucksack.");
    openFullscreen();

    // Once in the (still-mounted, now covered) card and once in the overlay
    // — the textarea's own matching value is excluded via the "p" selector.
    expect(
      screen.getAllByText("Adrenalin-Pen ist im Rucksack.", { selector: "p" }),
    ).toHaveLength(2);
    expect(screen.getAllByText("Eigener Zusatz")).toHaveLength(2);
  });

  it("renders nothing extra when there is no addendum", () => {
    renderScreen("");
    expect(screen.queryByText("Eigener Zusatz")).not.toBeInTheDocument();
  });
});

describe("PhraseScreen 'Kita & Schule' venue (F7b)", () => {
  it("is selectable and marked with a de/en hint", () => {
    renderScreen();
    const chip = screen.getByRole("button", { name: /Kita & Schule/ });
    expect(chip).toHaveTextContent("(de/en)");
  });

  it("shows the dedicated German sentence for de", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Sprache der Allergie-Karte"), {
      target: { value: "de" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Kita & Schule/ }));

    expect(screen.getByText(phraseFor("de", "kita", ["peanut"]))).toBeInTheDocument();
    expect(screen.queryByText(/gibt es bisher nur auf/)).not.toBeInTheDocument();
  });

  it("falls back to the language's own general sentence elsewhere, with a visible note", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Sprache der Allergie-Karte"), {
      target: { value: "fr" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Kita & Schule/ }));

    const expected = phraseFor("fr", "general", ["peanut"]);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText(/gibt es bisher nur auf/)).toBeInTheDocument();
  });
});
