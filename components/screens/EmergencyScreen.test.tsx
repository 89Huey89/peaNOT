import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EmergencyScreen from "@/components/screens/EmergencyScreen";
import { DEFAULT_EMERGENCY_PLAN, DEFAULT_EMERGENCY_STEPS, type EmergencyPlan } from "@/lib/emergency";
import { palette } from "@/lib/theme";

function renderScreen(plan: EmergencyPlan) {
  const onPlanChange = vi.fn();
  const onBack = vi.fn();
  render(
    <EmergencyScreen
      P={palette("mustard")}
      plan={plan}
      onPlanChange={onPlanChange}
      onBack={onBack}
    />,
  );
  return { onPlanChange, onBack };
}

const CONFIRMED_PLAN: EmergencyPlan = {
  steps: ["Adrenalin-Pen anwenden.", "Sofort 112 anrufen."],
  notes: "Jext 150 µg im blauen Rucksack.",
  confirmed: true,
};

describe("EmergencyScreen (F4)", () => {
  it("calls onBack from the header", () => {
    const { onBack } = renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers a tel:112 call button", () => {
    renderScreen(CONFIRMED_PLAN);
    const link = screen.getByRole("link", { name: /112 anrufen/ });
    expect(link).toHaveAttribute("href", "tel:112");
  });

  // Befund 07: an unconfirmed plan now shows a calm read view first — the
  // family reads the whole template and its disclaimer, then explicitly
  // decides — instead of landing straight in a wall of editable text
  // fields on first contact with the screen.
  it("shows an unconfirmed plan as a read view first, not the editor", () => {
    renderScreen(DEFAULT_EMERGENCY_PLAN);

    // The decision is presented, not the fields.
    expect(screen.getByRole("button", { name: "Unverändert übernehmen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notfallplan bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Schritt 1" })).not.toBeInTheDocument();

    // The template disclaimer belongs to this view, prominently.
    expect(
      screen.getByText(/Das ist eine allgemeine Vorlage, keine Anweisung für euren/),
    ).toBeInTheDocument();

    // And the template's own steps are readable as plain text.
    for (const step of DEFAULT_EMERGENCY_STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("accepting the template as-is confirms it without changing the steps", () => {
    const { onPlanChange } = renderScreen(DEFAULT_EMERGENCY_PLAN);

    fireEvent.click(screen.getByRole("button", { name: "Unverändert übernehmen" }));

    expect(onPlanChange).toHaveBeenCalledWith({
      ...DEFAULT_EMERGENCY_PLAN,
      confirmed: true,
    });
  });

  it("'Bearbeiten' opens the editor with each step's full, untruncated text as its value", () => {
    renderScreen(DEFAULT_EMERGENCY_PLAN);

    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));

    for (const step of DEFAULT_EMERGENCY_STEPS) {
      expect(screen.getByDisplayValue(step)).toBeInTheDocument();
    }
  });

  it("editing a step and saving persists the edit and confirms the plan", () => {
    const { onPlanChange } = renderScreen(DEFAULT_EMERGENCY_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));

    const first = screen.getByRole("textbox", { name: "Schritt 1" });
    fireEvent.change(first, { target: { value: "Angepasster erster Schritt." } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(onPlanChange).toHaveBeenCalledTimes(1);
    const saved = onPlanChange.mock.calls[0]![0] as EmergencyPlan;
    expect(saved.confirmed).toBe(true);
    expect(saved.steps[0]).toBe("Angepasster erster Schritt.");
    expect(saved.steps).toHaveLength(DEFAULT_EMERGENCY_STEPS.length);
  });

  it("shows a confirmed plan read-only with a Bearbeiten button, no template banner", () => {
    renderScreen(CONFIRMED_PLAN);

    expect(screen.getByText("Adrenalin-Pen anwenden.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Vorlage unverändert übernehmen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notfallplan bearbeiten" })).toBeInTheDocument();
  });

  it("Abbrechen discards edits to an already-confirmed plan without calling onPlanChange", () => {
    const { onPlanChange } = renderScreen(CONFIRMED_PLAN);

    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Schritt 1" }), {
      target: { value: "Verworfene Änderung." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onPlanChange).not.toHaveBeenCalled();
    expect(screen.getByText("Adrenalin-Pen anwenden.")).toBeInTheDocument();
  });

  it("adds a new empty step field on 'Schritt hinzufügen'", () => {
    renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: /Schritt hinzufügen/ }));

    expect(screen.getByRole("textbox", { name: "Schritt 3" })).toHaveValue("");
  });

  it("disables Speichern and warns when every step is removed", () => {
    renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));

    // Removing shifts the remaining rows' indices/labels down, so the second
    // removal targets "Schritt 1" again (the row that used to be #2).
    fireEvent.click(screen.getByRole("button", { name: "Schritt 1 entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Schritt 1 entfernen" }));

    expect(screen.getByText("Mindestens ein Schritt wird benötigt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
  });

  it("'Vorlage einsetzen' resets the draft back to the default template", () => {
    renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Notfallplan bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: /Vorlage einsetzen/ }));

    expect(screen.getByDisplayValue(DEFAULT_EMERGENCY_STEPS[0]!)).toBeInTheDocument();
  });

  it("updates the free-text field (Medikament/Dosis/Notfallset-Ort) immediately", () => {
    const { onPlanChange } = renderScreen(CONFIRMED_PLAN);

    fireEvent.change(screen.getByRole("textbox", { name: "Medikament, Dosis, Notfallset-Ort" }), {
      target: { value: "Neuer Aufbewahrungsort" },
    });

    expect(onPlanChange).toHaveBeenCalledWith({
      ...CONFIRMED_PLAN,
      notes: "Neuer Aufbewahrungsort",
    });
  });

  it("never lets the free text grow past the stored plan's own cap", () => {
    const { onPlanChange } = renderScreen(CONFIRMED_PLAN);
    const tooLong = "x".repeat(500);

    fireEvent.change(screen.getByRole("textbox", { name: "Medikament, Dosis, Notfallset-Ort" }), {
      target: { value: tooLong },
    });

    const saved = onPlanChange.mock.calls[0]![0] as EmergencyPlan;
    expect(saved.notes.length).toBeLessThanOrEqual(400);
  });
});
