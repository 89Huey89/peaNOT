import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { DEFAULT_PREFS, type Prefs } from "@/components/usePrefs";
import { palette } from "@/lib/theme";

function renderScreen(prefs: Prefs) {
  const setPref = vi.fn();
  render(
    <ProfileScreen
      P={palette("mustard")}
      prefs={prefs}
      setPref={setPref}
      onReplayOnboarding={() => {}}
      onTab={() => {}}
    />,
  );
  return { setPref };
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
