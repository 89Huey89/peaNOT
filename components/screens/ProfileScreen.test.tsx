import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { DEFAULT_PREFS, type Prefs } from "@/components/usePrefs";
import { palette } from "@/lib/theme";

function setVibrateSupported(supported: boolean) {
  if (supported) {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
  } else {
    // jsdom has no navigator.vibrate at all by default (matches iOS Safari),
    // but undo a previous test's mock just in case.
    Reflect.deleteProperty(navigator, "vibrate");
  }
}

function renderScreen(prefs: Prefs) {
  const setPref = vi.fn();
  const onOpenCard = vi.fn();
  render(
    <ProfileScreen
      P={palette("mustard")}
      prefs={prefs}
      setPref={setPref}
      onReplayOnboarding={() => {}}
      onOpenCard={onOpenCard}
      onTab={() => {}}
    />,
  );
  return { setPref, onOpenCard };
}

describe("ProfileScreen allergen picker", () => {
  it("adds an allergen when its switch is turned on", () => {
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, selectedAllergens: ["peanut"] });

    fireEvent.click(screen.getByRole("switch", { name: /Soja/ }));

    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["peanut", "soy"]);
  });

  it("removes an allergen when its switch is turned off", () => {
    const { setPref } = renderScreen({
      ...DEFAULT_PREFS,
      selectedAllergens: ["peanut", "milk"],
    });

    fireEvent.click(screen.getByRole("switch", { name: /Erdnuss/ }));

    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["milk"]);
  });

  it("reflects the current selection as checked switches", () => {
    renderScreen({ ...DEFAULT_PREFS, selectedAllergens: ["milk"] });

    expect(screen.getByRole("switch", { name: /Milch/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: /Gluten/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("ProfileScreen vibration toggle", () => {
  afterEach(() => {
    setVibrateSupported(false);
  });

  it("disables the toggle and explains why when the Vibration API is unavailable (iOS)", async () => {
    setVibrateSupported(false);
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, haptic: true });

    const toggle = await screen.findByRole("switch", { name: /Vibrieren bei Treffer/ });
    await waitFor(() => expect(toggle).toBeDisabled());
    expect(screen.getByText("Auf dem iPhone nicht verfügbar")).toBeInTheDocument();

    // The stored preference itself is untouched — still reflects prefs.haptic.
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(setPref).not.toHaveBeenCalled();
  });

  it("keeps the toggle enabled when the Vibration API is available", () => {
    setVibrateSupported(true);
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, haptic: false });

    const toggle = screen.getByRole("switch", { name: /Vibrieren bei Treffer/ });
    expect(toggle).not.toBeDisabled();
    expect(screen.queryByText("Auf dem iPhone nicht verfügbar")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(setPref).toHaveBeenCalledWith("haptic", true);
  });
});

describe("ProfileScreen allergy card access (UX7)", () => {
  it("opens the allergy card from the TopBar with one tap", () => {
    const { onOpenCard } = renderScreen(DEFAULT_PREFS);

    fireEvent.click(screen.getByRole("button", { name: "Allergie-Karte öffnen" }));

    expect(onOpenCard).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileScreen font scale ('Größere Schrift')", () => {
  it("is off (normal) by default and offers all three steps", () => {
    renderScreen({ ...DEFAULT_PREFS, fontScale: "normal" });

    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Groß" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Sehr groß" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("picks the larger step", () => {
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, fontScale: "normal" });

    fireEvent.click(screen.getByRole("button", { name: "Sehr groß" }));

    expect(setPref).toHaveBeenCalledWith("fontScale", "sehr-gross");
  });
});
