import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_PREFS, usePrefs } from "@/components/usePrefs";
import { DEFAULT_EMERGENCY_STEPS } from "@/lib/emergency";

const KEY = "peanot.prefs.v1";

function setVibrateSupported(supported: boolean) {
  if (supported) {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
  } else {
    // jsdom has no navigator.vibrate at all by default (matches iOS Safari),
    // but undo a previous test's mock just in case.
    Reflect.deleteProperty(navigator, "vibrate");
  }
}

describe("usePrefs default sound behaviour", () => {
  afterEach(() => {
    window.localStorage.clear();
    setVibrateSupported(false);
  });

  it("keeps sound off by default for a new user when vibration is supported", async () => {
    setVibrateSupported(true);

    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.sound).toBe(false);
  });

  it("defaults sound on for a new user when vibration is unavailable (iOS)", async () => {
    setVibrateSupported(false);

    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.sound).toBe(true);
    // The haptic pref itself is left untouched — only the sound default shifts.
    expect(result.current.prefs.haptic).toBe(DEFAULT_PREFS.haptic);
  });

  it("never overrides an existing stored sound choice, even without vibration", async () => {
    setVibrateSupported(false);
    window.localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PREFS, sound: false }));

    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.sound).toBe(false);
  });

  it("respects an existing stored sound:true choice regardless of vibration support", async () => {
    setVibrateSupported(true);
    window.localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PREFS, sound: true }));

    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.sound).toBe(true);
  });
});

describe("usePrefs cardNote (F7a)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to an empty string for a new user", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.cardNote).toBe("");
  });

  it("persists and reloads a stored addendum verbatim", async () => {
    const { result, rerender } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setPref("cardNote", "Adrenalin-Pen ist im Rucksack.");
    });
    rerender();
    expect(result.current.prefs.cardNote).toBe("Adrenalin-Pen ist im Rucksack.");

    const { result: reloaded } = renderHook(() => usePrefs());
    await waitFor(() => expect(reloaded.current.ready).toBe(true));
    expect(reloaded.current.prefs.cardNote).toBe("Adrenalin-Pen ist im Rucksack.");
  });
});

describe("usePrefs emergencyPlan (F4)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to the unconfirmed default template for a new user", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.emergencyPlan.confirmed).toBe(false);
    expect(result.current.prefs.emergencyPlan.steps).toEqual([...DEFAULT_EMERGENCY_STEPS]);
    expect(result.current.prefs.emergencyPlan.notes).toBe("");
  });

  it("persists and reloads an edited, confirmed plan", async () => {
    const { result, rerender } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setPref("emergencyPlan", {
        steps: ["Adrenalin-Pen anwenden.", "112 anrufen."],
        notes: "Jext 150 µg im Rucksack.",
        confirmed: true,
        pens: [],
        contacts: [],
      });
    });
    rerender();
    expect(result.current.prefs.emergencyPlan.confirmed).toBe(true);
    expect(result.current.prefs.emergencyPlan.steps).toHaveLength(2);

    const { result: reloaded } = renderHook(() => usePrefs());
    await waitFor(() => expect(reloaded.current.ready).toBe(true));
    expect(reloaded.current.prefs.emergencyPlan.notes).toBe("Jext 150 µg im Rucksack.");
    expect(reloaded.current.prefs.emergencyPlan.confirmed).toBe(true);
  });

  it("keeps an old stored prefs blob (without emergencyPlan) working via the default", async () => {
    window.localStorage.setItem(
      "peanot.prefs.v1",
      JSON.stringify({ accent: "clay", onboarded: true }),
    );

    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.emergencyPlan.confirmed).toBe(false);
    expect(result.current.prefs.emergencyPlan.steps.length).toBeGreaterThan(0);
  });
});

describe("usePrefs importPrefs (F1)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("overlays the imported fields onto the current prefs and persists them", async () => {
    const { result, rerender } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.importPrefs({ accent: "clay", tracesStrict: false });
    });
    rerender();

    expect(result.current.prefs.accent).toBe("clay");
    expect(result.current.prefs.tracesStrict).toBe(false);
    // Untouched fields keep their prior value, not silently reset to default.
    expect(result.current.prefs.onboarded).toBe(DEFAULT_PREFS.onboarded);

    const { result: reloaded } = renderHook(() => usePrefs());
    await waitFor(() => expect(reloaded.current.ready).toBe(true));
    expect(reloaded.current.prefs.accent).toBe("clay");
  });

  it("leaves prefs unchanged when the imported object is empty", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    // Snapshot rather than comparing to DEFAULT_PREFS: the initial `sound`
    // value itself already depends on vibrate support (see the "default
    // sound behaviour" suite above), which this test isn't about.
    const before = result.current.prefs;

    act(() => result.current.importPrefs({}));

    expect(result.current.prefs).toEqual(before);
  });

  it("always yields a valid persons state, even from a completely broken import", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      // @ts-expect-error deliberately malformed, like a hand-edited backup file
      result.current.importPrefs({ persons: [{ allergens: "nope" }], activePersonId: "ghost" }),
    );

    expect(result.current.prefs.persons.length).toBeGreaterThanOrEqual(1);
    expect(
      result.current.prefs.persons.some((p) => p.id === result.current.prefs.activePersonId),
    ).toBe(true);
    expect(result.current.prefs.persons.every((p) => p.allergens.length > 0)).toBe(true);
  });

  it("applies a legacy (pre-F) backup's bare selectedAllergens onto the active person", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const activeId = result.current.prefs.activePersonId;

    // An export from before persons existed carries only the flat field —
    // no `persons` key at all.
    act(() => result.current.importPrefs({ selectedAllergens: ["milk", "gluten"] }));

    expect(result.current.prefs.selectedAllergens).toEqual(["milk", "gluten"]);
    const active = result.current.prefs.persons.find((p) => p.id === activeId);
    expect(active?.allergens).toEqual(["milk", "gluten"]);
  });

  it("does not touch persons for a modern backup that already carries them", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() =>
      result.current.importPrefs({
        persons: [{ id: "x", name: "Anna", allergens: ["soy"] }],
        activePersonId: "x",
        selectedAllergens: ["soy"],
      }),
    );

    expect(result.current.prefs.persons).toEqual([{ id: "x", name: "Anna", allergens: ["soy"] }]);
    expect(result.current.prefs.activePersonId).toBe("x");
    expect(result.current.prefs.selectedAllergens).toEqual(["soy"]);
  });
});

describe("usePrefs person management (F)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("starts with exactly one default person, active", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.prefs.persons).toHaveLength(1);
    expect(result.current.prefs.persons[0]!.id).toBe(result.current.prefs.activePersonId);
    expect(result.current.prefs.selectedAllergens).toEqual(
      result.current.prefs.persons[0]!.allergens,
    );
  });

  it("addPerson seeds the new person from the active one and makes them active", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.addPerson("Ben"));

    expect(result.current.prefs.persons).toHaveLength(2);
    const ben = result.current.prefs.persons[1]!;
    expect(ben.name).toBe("Ben");
    // Geerbt von der bisher aktiven Person, nicht leer: Ben ist ab jetzt
    // aktiv, und eine leere Liste hieße, dass bis zur ersten Auswahl niemand
    // entschieden hat, worauf geprüft wird.
    expect(ben.allergens).toEqual(["peanut"]);
    expect(result.current.prefs.activePersonId).toBe(ben.id);
    // selectedAllergens follows the newly active person immediately.
    expect(result.current.prefs.selectedAllergens).toEqual(["peanut"]);
  });

  it("never leaves the freshly added, now-active person without allergens", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.addPerson("Ben"));

    expect(result.current.prefs.selectedAllergens.length).toBeGreaterThan(0);
  });

  it("setActivePerson switches the active person and selectedAllergens follows", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const originalId = result.current.prefs.activePersonId;

    act(() => result.current.addPerson("Ben"));
    const benId = result.current.prefs.activePersonId;

    act(() => result.current.setActivePerson(originalId));
    expect(result.current.prefs.activePersonId).toBe(originalId);
    expect(result.current.prefs.selectedAllergens).toEqual(["peanut"]);

    act(() => result.current.setActivePerson(benId));
    expect(result.current.prefs.activePersonId).toBe(benId);
    expect(result.current.prefs.selectedAllergens).toEqual(["peanut"]);
  });

  it("setPersonAllergens on the active person updates selectedAllergens too", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const activeId = result.current.prefs.activePersonId;

    act(() => result.current.setPersonAllergens(activeId, ["milk", "soy"]));

    expect(result.current.prefs.persons[0]!.allergens).toEqual(["milk", "soy"]);
    expect(result.current.prefs.selectedAllergens).toEqual(["milk", "soy"]);
  });

  it("setPersonAllergens on an inactive person leaves selectedAllergens untouched", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const originalId = result.current.prefs.activePersonId;

    act(() => result.current.addPerson("Ben")); // Ben is now active, seeded from the original
    act(() => result.current.setPersonAllergens(originalId, ["gluten"]));

    const original = result.current.prefs.persons.find((p) => p.id === originalId);
    expect(original?.allergens).toEqual(["gluten"]);
    // Ben is active, not the person we just edited — his seeded list stands.
    expect(result.current.prefs.selectedAllergens).toEqual(["peanut"]);
  });

  it("renamePerson renames without touching allergens or the active person", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const activeId = result.current.prefs.activePersonId;

    act(() => result.current.renamePerson(activeId, "Timo"));

    expect(result.current.prefs.persons[0]!.name).toBe("Timo");
    expect(result.current.prefs.persons[0]!.allergens).toEqual(["peanut"]);
    expect(result.current.prefs.activePersonId).toBe(activeId);
  });

  it("removePerson removes a non-active person", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const originalId = result.current.prefs.activePersonId;

    act(() => result.current.addPerson("Ben"));
    expect(result.current.prefs.persons).toHaveLength(2);

    act(() => result.current.removePerson(originalId));

    expect(result.current.prefs.persons).toHaveLength(1);
    expect(result.current.prefs.persons[0]!.name).toBe("Ben");
  });

  it("cannot remove the last remaining person", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const onlyId = result.current.prefs.activePersonId;

    act(() => result.current.removePerson(onlyId));

    expect(result.current.prefs.persons).toHaveLength(1);
    expect(result.current.prefs.persons[0]!.id).toBe(onlyId);
    expect(result.current.prefs.activePersonId).toBe(onlyId);
  });

  it("removing the active person falls back to another person, and selectedAllergens follows", async () => {
    const { result } = renderHook(() => usePrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const originalId = result.current.prefs.activePersonId;

    act(() => result.current.addPerson("Ben")); // Ben now active, seeded from the original
    const benId = result.current.prefs.activePersonId;

    act(() => result.current.removePerson(benId));

    expect(result.current.prefs.persons).toHaveLength(1);
    expect(result.current.prefs.activePersonId).toBe(originalId);
    expect(result.current.prefs.selectedAllergens).toEqual(["peanut"]);
  });
});
