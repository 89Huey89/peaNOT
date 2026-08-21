"use client";

import { useCallback, useEffect, useState } from "react";
import type { Accent, ThemeMode } from "@/lib/theme";
import type { FontScale } from "@/lib/fontScale";

const STORAGE_KEY = "peanot.prefs.v1";

export interface Prefs {
  accent: Accent;
  theme: ThemeMode;
  haptic: boolean;
  sound: boolean;
  tracesStrict: boolean;
  onboarded: boolean;
  /** Allergen keys (see lib/allergens/profile.ts) checked on every scan. */
  selectedAllergens: string[];
  /** "Größere Schrift" — scales the reading path's base font size; off (normal) by default. */
  fontScale: FontScale;
  /**
   * Optional free-text addendum shown below the verified sentence on the
   * allergy card (F7a) — e.g. "Adrenalin-Pen ist im Rucksack". Purely
   * informational and never translated: it is stored and shown verbatim in
   * whatever language it was typed, kept visually apart from the reviewed
   * lib/phrases.ts sentences, and never fed back into them.
   */
  cardNote: string;
}

export const DEFAULT_PREFS: Prefs = {
  accent: "mustard",
  theme: "light",
  haptic: true,
  sound: false,
  tracesStrict: true,
  onboarded: false,
  selectedAllergens: ["peanut"],
  fontScale: "normal",
  cardNote: "",
};

function load(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // iOS Safari never implemented navigator.vibrate, so the haptic channel
      // is silently a no-op there. Give brand-new users an audible alarm by
      // default in that case; anyone with an existing stored choice below
      // keeps exactly what they picked, untouched.
      const vibrateSupported = typeof navigator !== "undefined" && "vibrate" in navigator;
      return vibrateSupported ? DEFAULT_PREFS : { ...DEFAULT_PREFS, sound: true };
    }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs() {
  // Start from defaults on the server and first client render to avoid a
  // hydration mismatch; hydrate from storage right after mount.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(load());
    setReady(true);
  }, []);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable (private mode / quota) – keep in-memory state */
      }
      return next;
    });
  }, []);

  return { prefs, setPref, ready };
}
