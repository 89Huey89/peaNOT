import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { DEFAULT_PREFS, type Prefs } from "@/components/usePrefs";
import type { ImportOutcome } from "@/components/useBackup";
import type { Person } from "@/lib/persons";
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

function renderScreen(
  prefs: Prefs,
  opts: { onImportFile?: (raw: string) => ImportOutcome } = {},
) {
  const setPref = vi.fn();
  const importPrefs = vi.fn();
  const onOpenCard = vi.fn();
  const onOpenNotfall = vi.fn();
  const onExport = vi.fn();
  const onImportFile =
    opts.onImportFile ??
    vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: true,
      historyCount: 0,
      packmatchCount: 0,
      notesCount: 0,
      favoritesCount: 0,
      prefs: {},
    }));
  render(
    <ProfileScreen
      P={palette("mustard")}
      prefs={prefs}
      setPref={setPref}
      importPrefs={importPrefs}
      onReplayOnboarding={() => {}}
      onOpenCard={onOpenCard}
      onOpenNotfall={onOpenNotfall}
      onTab={() => {}}
      onExport={onExport}
      onImportFile={onImportFile}
    />,
  );
  return { setPref, importPrefs, onOpenCard, onOpenNotfall, onExport, onImportFile };
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

  it("also updates the active person's allergen list, not just selectedAllergens (F)", () => {
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, selectedAllergens: ["peanut"] });

    fireEvent.click(screen.getByRole("switch", { name: /Soja/ }));

    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["peanut", "soy"]);
    expect(setPref).toHaveBeenCalledWith(
      "persons",
      expect.arrayContaining([
        expect.objectContaining({ id: DEFAULT_PREFS.activePersonId, allergens: ["peanut", "soy"] }),
      ]),
    );
  });

  it("titles the section 'Meine Allergene' for the default 'Ich' person", () => {
    renderScreen(DEFAULT_PREFS);
    expect(screen.getByText("Meine Allergene")).toBeInTheDocument();
  });

  it("titles the section after the active person once renamed/multi-person", () => {
    const persons: Person[] = [
      { id: "a", name: "Anna", allergens: ["peanut"] },
      { id: "b", name: "Ben", allergens: ["milk"] },
    ];
    renderScreen({
      ...DEFAULT_PREFS,
      persons,
      activePersonId: "a",
      selectedAllergens: ["peanut"],
    });

    expect(screen.getByText("Allergene von Anna")).toBeInTheDocument();
    expect(screen.getByText(/Gilt nur für Anna\./)).toBeInTheDocument();
  });
});

describe("ProfileScreen Personen (F)", () => {
  function withPersons(persons: Person[], activePersonId: string): Prefs {
    const active = persons.find((p) => p.id === activePersonId) ?? persons[0]!;
    return { ...DEFAULT_PREFS, persons, activePersonId, selectedAllergens: active.allergens };
  }

  it("stays minimal for a single-person household — just an add button, no list", () => {
    renderScreen(DEFAULT_PREFS);

    expect(screen.getByText("Personen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Person hinzufügen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wechseln/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entfernen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /umbenennen/ })).not.toBeInTheDocument();
  });

  it("lists every person once a second one exists, marking the active one", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "a",
    );
    renderScreen(prefs);

    expect(screen.getByRole("button", { name: "Zu Anna wechseln" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Zu Ben wechseln" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Scoped to each person's own row — "Erdnuss"/"Milch" also appear as the
    // (unrelated) allergen-toggle switch labels further down the screen.
    expect(
      within(screen.getByRole("button", { name: "Zu Anna wechseln" })).getByText("Erdnuss"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: "Zu Ben wechseln" })).getByText("Milch"),
    ).toBeInTheDocument();
  });

  it("shows a 'no allergens selected' summary for a freshly added person", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: [] },
      ],
      "a",
    );
    renderScreen(prefs);

    expect(screen.getByText("Keine Allergene ausgewählt")).toBeInTheDocument();
  });

  it("switching the active person updates persons/activePersonId/selectedAllergens together", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "a",
    );
    const { setPref } = renderScreen(prefs);

    fireEvent.click(screen.getByRole("button", { name: "Zu Ben wechseln" }));

    expect(setPref).toHaveBeenCalledWith("activePersonId", "b");
    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["milk"]);
    expect(setPref).toHaveBeenCalledWith("persons", prefs.persons);
  });

  it("adds a new person with a numbered default name, seeded allergens, and makes them active", () => {
    const { setPref } = renderScreen(DEFAULT_PREFS);

    fireEvent.click(screen.getByRole("button", { name: "Person hinzufügen" }));

    const personsCall = setPref.mock.calls.find(([key]) => key === "persons");
    expect(personsCall).toBeTruthy();
    const nextPersons = personsCall![1] as Person[];
    expect(nextPersons).toHaveLength(2);
    expect(nextPersons[1]).toMatchObject({ name: "Person 2", allergens: ["peanut"] });

    expect(setPref).toHaveBeenCalledWith("activePersonId", nextPersons[1]!.id);
    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["peanut"]);
  });

  it("renames a person via the inline editor without touching allergens/active id", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "a",
    );
    const { setPref } = renderScreen(prefs);

    fireEvent.click(screen.getByRole("button", { name: "Ben umbenennen" }));
    const input = screen.getByRole("textbox", { name: "Name von Ben" });
    fireEvent.change(input, { target: { value: "Benjamin" } });
    fireEvent.click(screen.getByRole("button", { name: "Umbenennen speichern" }));

    expect(setPref).toHaveBeenCalledWith("persons", [
      { id: "a", name: "Anna", allergens: ["peanut"] },
      { id: "b", name: "Benjamin", allergens: ["milk"] },
    ]);
    // Renaming alone never touches which person is active or what's checked.
    expect(setPref).not.toHaveBeenCalledWith("activePersonId", expect.anything());
    expect(setPref).not.toHaveBeenCalledWith("selectedAllergens", expect.anything());
  });

  it("cancelling the inline rename discards the draft", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "a",
    );
    const { setPref } = renderScreen(prefs);

    fireEvent.click(screen.getByRole("button", { name: "Ben umbenennen" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name von Ben" }), {
      target: { value: "Whatever" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Umbenennen abbrechen" }));

    expect(setPref).not.toHaveBeenCalled();
    expect(screen.getByText("Ben")).toBeInTheDocument();
  });

  it("removes a person after confirming, updating persons/activePersonId/selectedAllergens", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "b",
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { setPref } = renderScreen(prefs);

    fireEvent.click(screen.getByRole("button", { name: "Anna entfernen" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(setPref).toHaveBeenCalledWith("persons", [{ id: "b", name: "Ben", allergens: ["milk"] }]);
    // Ben was already active and stays active — removing a non-active person
    // never reassigns who's active.
    expect(setPref).toHaveBeenCalledWith("activePersonId", "b");
    expect(setPref).toHaveBeenCalledWith("selectedAllergens", ["milk"]);
    confirmSpy.mockRestore();
  });

  it("does nothing when the removal confirmation is declined", () => {
    const prefs = withPersons(
      [
        { id: "a", name: "Anna", allergens: ["peanut"] },
        { id: "b", name: "Ben", allergens: ["milk"] },
      ],
      "a",
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { setPref } = renderScreen(prefs);

    fireEvent.click(screen.getByRole("button", { name: "Ben entfernen" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(setPref).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("never offers a delete button for the last remaining person", () => {
    renderScreen(DEFAULT_PREFS);
    expect(screen.queryByRole("button", { name: /entfernen/ })).not.toBeInTheDocument();
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

describe("ProfileScreen auto-start-camera toggle (UX10)", () => {
  it("is off by default and turning it on updates the pref", () => {
    const { setPref } = renderScreen({ ...DEFAULT_PREFS, autoStartCamera: false });

    const toggle = screen.getByRole("switch", {
      name: /Kamera beim Öffnen automatisch starten/,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(setPref).toHaveBeenCalledWith("autoStartCamera", true);
  });

  it("reflects an already-enabled pref as checked", () => {
    renderScreen({ ...DEFAULT_PREFS, autoStartCamera: true });

    expect(
      screen.getByRole("switch", { name: /Kamera beim Öffnen automatisch starten/ }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("ProfileScreen allergy card access (UX7)", () => {
  it("opens the allergy card from the TopBar with one tap", () => {
    const { onOpenCard } = renderScreen(DEFAULT_PREFS);

    fireEvent.click(screen.getByRole("button", { name: "Allergie-Karte öffnen" }));

    expect(onOpenCard).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileScreen Notfallplan access (F4)", () => {
  it("opens the Notfallplan from the 'Für den Notfall' section", () => {
    const { onOpenNotfall } = renderScreen(DEFAULT_PREFS);

    fireEvent.click(screen.getByRole("button", { name: "Notfallplan öffnen" }));

    expect(onOpenNotfall).toHaveBeenCalledTimes(1);
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

describe("ProfileScreen backup export/import (F1)", () => {
  function pickFile(raw: string) {
    const file = new File([raw], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Backup-Datei auswählen"), {
      target: { files: [file] },
    });
  }

  it("mentions favorites alongside history/notes/settings in the backup description (F2)", () => {
    renderScreen(DEFAULT_PREFS);

    expect(
      screen.getByText(/Eine Datei mit Verlauf, Notizen, Favoriten und Einstellungen/),
    ).toBeInTheDocument();
  });

  it("exports on tap without touching prefs", () => {
    const { onExport, setPref } = renderScreen(DEFAULT_PREFS);

    fireEvent.click(screen.getByRole("button", { name: /Exportieren/ }));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(setPref).not.toHaveBeenCalled();
  });

  it("shows a merge summary after a successful import, including favorites (F2)", async () => {
    const onImportFile = vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: true,
      historyCount: 3,
      packmatchCount: 1,
      notesCount: 2,
      favoritesCount: 4,
      prefs: {},
    }));
    renderScreen(DEFAULT_PREFS, { onImportFile });

    pickFile('{"format":"peanot-export"}');

    await waitFor(() =>
      expect(
        screen.getByText(
          "Übernommen: 3 Scan(s), 2 Notiz(en), 1 Packungs-Antwort(en), 4 Favorit(en).",
        ),
      ).toBeInTheDocument(),
    );
    expect(onImportFile).toHaveBeenCalledWith('{"format":"peanot-export"}');
  });

  it("shows an error message for a rejected import instead of a summary", async () => {
    const onImportFile = vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: false,
      error: "unsupported-format",
    }));
    renderScreen(DEFAULT_PREFS, { onImportFile });

    pickFile("{}");

    await waitFor(() =>
      expect(screen.getByText("Diese Datei ist kein peaNOT-Backup.")).toBeInTheDocument(),
    );
  });

  it("only applies imported prefs after an explicit confirm", async () => {
    const onImportFile = vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: true,
      historyCount: 0,
      packmatchCount: 0,
      notesCount: 0,
      favoritesCount: 0,
      prefs: { accent: "clay" },
    }));
    const { importPrefs } = renderScreen(DEFAULT_PREFS, { onImportFile });

    pickFile("{}");

    await screen.findByText("Auch die Einstellungen übernehmen?");
    expect(importPrefs).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

    expect(importPrefs).toHaveBeenCalledWith({ accent: "clay" });
    expect(screen.queryByText("Auch die Einstellungen übernehmen?")).not.toBeInTheDocument();
  });

  it("never applies prefs when the user declines", async () => {
    const onImportFile = vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: true,
      historyCount: 0,
      packmatchCount: 0,
      notesCount: 0,
      favoritesCount: 0,
      prefs: { accent: "clay" },
    }));
    const { importPrefs } = renderScreen(DEFAULT_PREFS, { onImportFile });

    pickFile("{}");
    await screen.findByText("Auch die Einstellungen übernehmen?");
    fireEvent.click(screen.getByRole("button", { name: "Nicht übernehmen" }));

    expect(importPrefs).not.toHaveBeenCalled();
    expect(screen.queryByText("Auch die Einstellungen übernehmen?")).not.toBeInTheDocument();
  });

  it("does not offer a prefs confirmation when the import carried none", async () => {
    const onImportFile = vi.fn<(raw: string) => ImportOutcome>(() => ({
      ok: true,
      historyCount: 1,
      packmatchCount: 0,
      notesCount: 0,
      favoritesCount: 0,
      prefs: {},
    }));
    renderScreen(DEFAULT_PREFS, { onImportFile });

    pickFile("{}");

    await screen.findByText(/Übernommen:/);
    expect(screen.queryByText("Auch die Einstellungen übernehmen?")).not.toBeInTheDocument();
  });
});
