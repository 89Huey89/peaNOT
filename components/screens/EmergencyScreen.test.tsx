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
  pens: [],
  contacts: [],
};

// A plan saved by an app version that predates Feature B/C entirely — the
// exact shape usePrefs' load() hands the screen for old stored prefs (see
// normalizeEmergencyPlan's doc comment in lib/emergency.ts). Cast because
// the current EmergencyPlan type requires pens/contacts; this constant
// exists specifically to prove the screen survives their absence anyway.
const LEGACY_PLAN = {
  steps: ["Alter Schritt aus einer älteren App-Version."],
  notes: "Alte Notiz",
  confirmed: true,
} as EmergencyPlan;

const PLAN_WITH_PENS_AND_CONTACTS: EmergencyPlan = {
  steps: ["Adrenalin-Pen anwenden."],
  notes: "",
  confirmed: true,
  pens: [
    { label: "Rucksack", expiresOn: "2020-01-01" }, // far in the past: always expired
    { label: "Kita", expiresOn: "2099-01-01" }, // far in the future: always ok
  ],
  contacts: [
    { label: "Mama", phone: "0151 234 56 78" },
    { label: "Kinderärztin", phone: "+49 (0)30 123-456" },
  ],
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

describe("EmergencyScreen — Feature B (auto-injector pens)", () => {
  it("renders an empty plan's pens section without crashing", () => {
    renderScreen(CONFIRMED_PLAN);
    expect(screen.getByText("Noch keine Autoinjektoren hinterlegt.")).toBeInTheDocument();
  });

  it("renders a plan saved before pens/contacts existed without crashing", () => {
    renderScreen(LEGACY_PLAN);
    expect(screen.getByText("Noch keine Autoinjektoren hinterlegt.")).toBeInTheDocument();
    expect(screen.getByText("Noch keine weiteren Kontakte hinterlegt.")).toBeInTheDocument();
    // The rest of the (legacy) plan still renders normally.
    expect(screen.getByText("Alter Schritt aus einer älteren App-Version.")).toBeInTheDocument();
  });

  it("labels an expired pen as such, and a far-future one as not expired", () => {
    renderScreen(PLAN_WITH_PENS_AND_CONTACTS);

    // Exact-string matches (not substring regex) so these can't also match
    // the enclosing row, whose combined text (label + status) would
    // otherwise satisfy a looser pattern too and make the query ambiguous.
    expect(screen.getByText("Ablaufdatum überschritten (01.01.2020)")).toBeInTheDocument();
    expect(screen.getByText("Ablaufdatum: 01.01.2099")).toBeInTheDocument();
    expect(screen.queryByText("Ablaufdatum überschritten (01.01.2099)")).not.toBeInTheDocument();
  });

  it("opens the pens editor with each pen's date and label as field values", () => {
    renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Autoinjektoren bearbeiten" }));

    expect(screen.getByRole("textbox", { name: "Pen 1 Name oder Ort" })).toHaveValue("Rucksack");
    expect(screen.getByDisplayValue("2020-01-01")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Pen 2 Name oder Ort" })).toHaveValue("Kita");
    expect(screen.getByDisplayValue("2099-01-01")).toBeInTheDocument();
  });

  it("adds a new empty pen row on 'Pen hinzufügen'", () => {
    renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Autoinjektoren bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: /Pen hinzufügen/ }));

    expect(screen.getByRole("textbox", { name: "Pen 1 Name oder Ort" })).toHaveValue("");
  });

  it("removes a pen row and saves the remaining pens", () => {
    const { onPlanChange } = renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Autoinjektoren bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: "Pen 1 entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    const saved = onPlanChange.mock.calls[0]![0] as EmergencyPlan;
    expect(saved.pens).toEqual([{ label: "Kita", expiresOn: "2099-01-01" }]);
  });

  it("editing a pen's date and label persists both on save", () => {
    const { onPlanChange } = renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Autoinjektoren bearbeiten" }));
    fireEvent.click(screen.getByRole("button", { name: /Pen hinzufügen/ }));

    fireEvent.change(screen.getByRole("textbox", { name: "Pen 1 Name oder Ort" }), {
      target: { value: "Schulranzen" },
    });
    fireEvent.change(screen.getByLabelText("Pen 1 Ablaufdatum"), {
      target: { value: "2030-06-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    const saved = onPlanChange.mock.calls[0]![0] as EmergencyPlan;
    expect(saved.pens).toEqual([{ label: "Schulranzen", expiresOn: "2030-06-15" }]);
  });

  it("cancelling the pens editor discards changes", () => {
    const { onPlanChange } = renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Autoinjektoren bearbeiten" }));
    fireEvent.click(screen.getByRole("button", { name: "Pen 1 entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onPlanChange).not.toHaveBeenCalled();
    expect(screen.getByText("Rucksack")).toBeInTheDocument();
  });
});

describe("EmergencyScreen — Feature C (emergency contacts)", () => {
  it("renders tel: links with cleaned hrefs, next to labels", () => {
    renderScreen(PLAN_WITH_PENS_AND_CONTACTS);

    const mama = screen.getByRole("link", { name: /Mama/ });
    expect(mama).toHaveAttribute("href", "tel:01512345678");

    const pediatrician = screen.getByRole("link", { name: /Kinderärztin/ });
    expect(pediatrician).toHaveAttribute("href", "tel:+49030123456");
  });

  it("keeps the 112 button as the first, primary action above the contacts", () => {
    renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "tel:112");
  });

  it("opens the contacts editor with each contact's raw, untouched text as its value", () => {
    renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Kontakte bearbeiten" }));

    expect(screen.getByRole("textbox", { name: "Kontakt 1 Name" })).toHaveValue("Mama");
    expect(screen.getByRole("textbox", { name: "Kontakt 1 Telefonnummer" })).toHaveValue("0151 234 56 78");
    expect(screen.getByRole("textbox", { name: "Kontakt 2 Telefonnummer" })).toHaveValue("+49 (0)30 123-456");
  });

  it("adds a new empty contact row on 'Kontakt hinzufügen'", () => {
    renderScreen(CONFIRMED_PLAN);
    fireEvent.click(screen.getByRole("button", { name: "Kontakte bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: /Kontakt hinzufügen/ }));

    expect(screen.getByRole("textbox", { name: "Kontakt 1 Name" })).toHaveValue("");
  });

  it("stops offering 'Kontakt hinzufügen' once the cap is reached", () => {
    const fullPlan: EmergencyPlan = {
      ...CONFIRMED_PLAN,
      contacts: [
        { label: "A", phone: "1" },
        { label: "B", phone: "2" },
        { label: "C", phone: "3" },
        { label: "D", phone: "4" },
      ],
    };
    renderScreen(fullPlan);
    fireEvent.click(screen.getByRole("button", { name: "Kontakte bearbeiten" }));

    expect(screen.queryByRole("button", { name: /Kontakt hinzufügen/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Maximal 4 Kontakte/)).toBeInTheDocument();
  });

  it("removes a contact row and saves the remaining contacts", () => {
    const { onPlanChange } = renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Kontakte bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: "Kontakt 1 entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    const saved = onPlanChange.mock.calls[0]![0] as EmergencyPlan;
    expect(saved.contacts).toEqual([{ label: "Kinderärztin", phone: "+49 (0)30 123-456" }]);
  });

  it("cancelling the contacts editor discards changes", () => {
    const { onPlanChange } = renderScreen(PLAN_WITH_PENS_AND_CONTACTS);
    fireEvent.click(screen.getByRole("button", { name: "Kontakte bearbeiten" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Kontakt 1 Name" }), {
      target: { value: "Verworfen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onPlanChange).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Mama/ })).toBeInTheDocument();
  });

  it("does not render a tel: link for a contact that has no phone number yet", () => {
    const plan: EmergencyPlan = {
      ...CONFIRMED_PLAN,
      contacts: [{ label: "Nur ein Name", phone: "" }],
    };
    renderScreen(plan);

    expect(screen.queryByRole("link", { name: /Nur ein Name/ })).not.toBeInTheDocument();
    expect(screen.getByText("Noch keine weiteren Kontakte hinterlegt.")).toBeInTheDocument();
  });
});
