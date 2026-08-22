import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import HistoryScreen from "@/components/screens/HistoryScreen";
import type { HistoryEntry } from "@/components/useHistory";
import type { FavoriteEntry } from "@/lib/favorites";
import { palette } from "@/lib/theme";

const ENTRY: HistoryEntry = {
  id: "h_1_111",
  ts: 1_700_000_000_000,
  barcode: "111",
  name: "Reiswaffel",
  brand: "dm Bio",
  verdict: "safe",
};

function renderScreen(history: HistoryEntry[] = [ENTRY], favorites: FavoriteEntry[] = []) {
  const onRemove = vi.fn();
  const onRestore = vi.fn();
  const onOpenCard = vi.fn();
  const onToggleFavorite = vi.fn();
  render(
    <HistoryScreen
      P={palette("mustard")}
      history={history}
      favorites={favorites}
      onOpen={() => {}}
      onClear={() => {}}
      onRemove={onRemove}
      onRestore={onRestore}
      onToggleFavorite={onToggleFavorite}
      onOpenCard={onOpenCard}
      onTab={() => {}}
    />,
  );
  return { onRemove, onRestore, onOpenCard, onToggleFavorite };
}

describe("HistoryScreen delete undo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes immediately (no confirm) and offers a 'Rückgängig' snackbar", () => {
    const { onRemove } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /aus dem Verlauf entfernen/ }));

    expect(onRemove).toHaveBeenCalledWith(ENTRY.id);
    expect(screen.getByText(/Reiswaffel.*entfernt/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rückgängig" })).toBeInTheDocument();
  });

  it("re-inserts the exact removed entry (preserving ts/id) when undone", () => {
    const { onRestore } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /aus dem Verlauf entfernen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Rückgängig" }));

    expect(onRestore).toHaveBeenCalledWith(ENTRY);
    // The snackbar dismisses itself once acted on.
    expect(screen.queryByRole("button", { name: "Rückgängig" })).not.toBeInTheDocument();
  });

  it("dismisses the snackbar on its own after 5 seconds", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /aus dem Verlauf entfernen/ }));
    expect(screen.getByRole("button", { name: "Rückgängig" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("button", { name: "Rückgängig" })).not.toBeInTheDocument();
  });

  it("does not ask for confirmation before removing (unlike 'Leeren')", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { onRemove } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /aus dem Verlauf entfernen/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith(ENTRY.id);
  });
});

describe("HistoryScreen allergy card access (UX7)", () => {
  it("opens the allergy card from the TopBar with one tap, even with an empty history", () => {
    const { onOpenCard } = renderScreen([]);

    fireEvent.click(screen.getByRole("button", { name: "Allergie-Karte öffnen" }));

    expect(onOpenCard).toHaveBeenCalledTimes(1);
  });
});

describe("HistoryScreen favorite star (F2)", () => {
  it("offers to star an entry that isn't favorited yet", () => {
    const { onToggleFavorite } = renderScreen();

    const star = screen.getByRole("button", { name: `„Reiswaffel“ zu Favoriten hinzufügen` });
    expect(star).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star);

    expect(onToggleFavorite).toHaveBeenCalledWith(ENTRY);
  });

  it("shows an entry as favorited and offers to remove it", () => {
    const FAV: FavoriteEntry = {
      barcode: "111",
      name: "Reiswaffel",
      brand: "dm Bio",
      verdict: "safe",
      ts: 1,
      addedAt: 1,
    };
    renderScreen([ENTRY], [FAV]);

    const star = screen.getByRole("button", { name: `„Reiswaffel“ aus Favoriten entfernen` });
    expect(star).toHaveAttribute("aria-pressed", "true");
  });

  it("does not remove the entry from the history list", () => {
    const { onRemove } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: `„Reiswaffel“ zu Favoriten hinzufügen` }));

    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe("HistoryScreen share list (G)", () => {
  const SECOND: HistoryEntry = {
    id: "h_2_222",
    ts: 1_700_100_000_000,
    barcode: "222",
    name: "Schokoriegel",
    brand: "Ritter Sport",
    verdict: "danger",
  };

  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  it("offers a 'Liste teilen' button showing how many entries would be shared", () => {
    renderScreen([ENTRY, SECOND]);

    expect(screen.getByRole("button", { name: /Liste teilen \(2 Einträge\)/ })).toBeInTheDocument();
  });

  it("is absent when the (filtered) selection is empty, rather than sharing nothing", () => {
    renderScreen([]);

    expect(screen.queryByRole("button", { name: /Liste teilen/ })).not.toBeInTheDocument();
  });

  it("shares only the currently filtered selection, not the whole history", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    renderScreen([ENTRY, SECOND]);
    // Narrow to just the "danger" filter chip — only SECOND should qualify.
    fireEvent.click(screen.getByRole("button", { name: "Warnung" }));

    fireEvent.click(screen.getByRole("button", { name: /Liste teilen \(1 Eintrag\)/ }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const text = (share.mock.calls[0]![0] as { text: string }).text;
    expect(text).toContain("Schokoriegel");
    expect(text).not.toContain("Reiswaffel");
  });

  it("calls navigator.share with the built list text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    renderScreen([ENTRY, SECOND]);
    fireEvent.click(screen.getByRole("button", { name: /Liste teilen/ }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const text = (share.mock.calls[0]![0] as { text: string }).text;
    expect(text).toContain("Reiswaffel");
    expect(text).toContain("Schokoriegel");
    expect(text).toContain("EAN 111");
    expect(text).toContain("EAN 222");
  });

  it("falls back to the clipboard with a confirmation when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderScreen([ENTRY]);
    fireEvent.click(screen.getByRole("button", { name: /Liste teilen/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain("Reiswaffel");
    expect(await screen.findByText("In die Zwischenablage kopiert.")).toBeInTheDocument();
  });

  it("shows no error and no false confirmation when the user cancels the share sheet", async () => {
    const share = vi.fn().mockImplementation(async () => {
      const err = new Error("cancelled");
      err.name = "AbortError";
      throw err;
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderScreen([ENTRY]);
    fireEvent.click(screen.getByRole("button", { name: /Liste teilen/ }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText("In die Zwischenablage kopiert.")).not.toBeInTheDocument();
  });
});

describe("HistoryScreen note preview (F5)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows a note preview under an entry that has one", () => {
    window.localStorage.setItem(
      "peanot.notes.v1",
      JSON.stringify({ "111": { text: "Sorte Schoko okay, Crunchy nicht", ts: 1 } }),
    );

    renderScreen();

    expect(screen.getByText("Sorte Schoko okay, Crunchy nicht")).toBeInTheDocument();
  });

  it("shows nothing extra for an entry without a note", () => {
    renderScreen();

    expect(screen.queryByText(/Sorte Schoko/)).not.toBeInTheDocument();
  });
});
