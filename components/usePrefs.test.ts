import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_PREFS, usePrefs } from "@/components/usePrefs";

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
