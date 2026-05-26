"use client";

import { useCallback, useEffect, useState } from "react";
import type { Accent, ThemeMode } from "@/lib/theme";

const STORAGE_KEY = "peanot.prefs.v1";

export interface Prefs {
  accent: Accent;
  theme: ThemeMode;
  haptic: boolean;
  sound: boolean;
  tracesStrict: boolean;
  onboarded: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  accent: "mustard",
  theme: "light",
  haptic: true,
  sound: false,
  tracesStrict: true,
  onboarded: false,
};

function load(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
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
