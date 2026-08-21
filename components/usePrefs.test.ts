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
});
