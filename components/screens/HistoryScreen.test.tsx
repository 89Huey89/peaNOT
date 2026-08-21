import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

    const star = screen.getByRole("button", { name: `„Reiswaffel" zu Favoriten hinzufügen` });
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

    const star = screen.getByRole("button", { name: `„Reiswaffel" aus Favoriten entfernen` });
    expect(star).toHaveAttribute("aria-pressed", "true");
  });

  it("does not remove the entry from the history list", () => {
    const { onRemove } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: `„Reiswaffel" zu Favoriten hinzufügen` }));

    expect(onRemove).not.toHaveBeenCalled();
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
