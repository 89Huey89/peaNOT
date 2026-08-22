"use client";

import { useCallback, useEffect, useState } from "react";
import type { Accent, ThemeMode } from "@/lib/theme";
import type { FontScale } from "@/lib/fontScale";
import { DEFAULT_EMERGENCY_PLAN, type EmergencyPlan } from "@/lib/emergency";
import {
  DEFAULT_PERSON_NAME,
  addPersonToState,
  getActivePerson,
  migratePersonsState,
  removePerson as removePersonFromState,
  renamePerson as renamePersonList,
  setPersonAllergens as setPersonAllergensList,
  switchActivePerson,
  type Person,
  type PersonsState,
} from "@/lib/persons";

const STORAGE_KEY = "peanot.prefs.v1";

// F: fixed (not generated) id for the single default person baked into
// DEFAULT_PREFS below. This is only ever the pre-hydration/SSR placeholder —
// load() below always re-derives the real persons state (via
// migratePersonsState) the moment localStorage becomes readable, so this
// literal never has a chance to collide with a createPersonId()-generated id
// (those are only minted when a *second* person is added). Using a fixed
// string here (rather than calling createPersonId() at module-load time)
// also keeps this constant identical between the server-rendered and first
// client render, which the rest of DEFAULT_PREFS already relies on to avoid
// a hydration mismatch.
const DEFAULT_PERSON_ID = "person-default";

export interface Prefs {
  accent: Accent;
  theme: ThemeMode;
  haptic: boolean;
  sound: boolean;
  tracesStrict: boolean;
  onboarded: boolean;
  /** UX10: start the camera the moment the Scan-Screen mounts, skipping the
   * "Kamera starten" tap. Off by default — iOS still shows its own camera
   * permission prompt every launch either way, this only removes the app's
   * own extra tap. */
  autoStartCamera: boolean;
  /**
   * F: everyone this device checks allergens for — always at least one
   * entry (see lib/persons.ts's migratePersonsState, which this file's
   * load()/importPrefs run on every read). ProfileScreen's "Personen"
   * section lets you add, rename, and remove people; a scan always checks
   * against exactly the active one (activePersonId below), never several at
   * once — see lib/persons.ts's module comment for why there is
   * deliberately no "check for everyone at once" mode.
   */
  persons: Person[];
  /** Which entry in `persons` a scan currently checks against. Guaranteed by
   * migratePersonsState to always point at a real entry in `persons` — never
   * "no one", never a dangling id. */
  activePersonId: string;
  /**
   * Allergen keys (see lib/allergens/profile.ts) checked on every scan.
   *
   * DERIVED — always kept equal to the active person's
   * (`persons`/`activePersonId` above) own `allergens`. Do not `setPref`
   * this directly outside of this file's own load()/importPrefs and the
   * person-management actions below: half a dozen places elsewhere in the
   * app read it as the single source of truth for "what do we check against"
   * (app/page.tsx, ResultScreen, PhraseScreen, the API route) and none of
   * them know about `persons` at all. Kept as its own field (rather than
   * removed in favor of always calling getActivePerson(prefs) at every call
   * site) precisely so none of those unrelated files have to change for
   * this feature to exist.
   */
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
  /**
   * F4: the family's own anaphylaxis emergency plan (EmergencyScreen) — a
   * confirmed/edited copy of DEFAULT_EMERGENCY_PLAN, never read by any
   * verdict logic. Kept in prefs like cardNote: one per-family value, not
   * per-product, so it needs no separate localStorage store.
   */
  emergencyPlan: EmergencyPlan;
}

export const DEFAULT_PREFS: Prefs = {
  accent: "mustard",
  theme: "light",
  haptic: true,
  sound: false,
  tracesStrict: true,
  onboarded: false,
  autoStartCamera: false,
  persons: [{ id: DEFAULT_PERSON_ID, name: DEFAULT_PERSON_NAME, allergens: ["peanut"] }],
  activePersonId: DEFAULT_PERSON_ID,
  selectedAllergens: ["peanut"],
  fontScale: "normal",
  cardNote: "",
  emergencyPlan: DEFAULT_EMERGENCY_PLAN,
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged = { ...DEFAULT_PREFS, ...(parsed as Partial<Prefs>) };
    // F: re-derive persons/activePersonId/selectedAllergens from the RAW
    // parsed blob (not from `merged`) on every load, not only the first time
    // this runs after the update that introduced `persons` — see
    // migratePersonsState's own comment for why this doubles as an
    // upgrade-path migration AND a standing defence against corrupted
    // storage, and must never be skipped just because the stored file
    // already "looks new enough".
    return withValidPersonsState(merged, parsed);
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Runs migratePersonsState against `rawSource` (the untrusted, possibly
 * legacy/corrupted shape — either freshly parsed JSON or an incoming import)
 * and folds the result into `base`, keeping `selectedAllergens` in lockstep
 * with whichever person ends up active. Shared by load() and importPrefs so
 * both go through the exact same derivation.
 */
function withValidPersonsState(base: Prefs, rawSource: unknown): Prefs {
  const state = migratePersonsState(rawSource, DEFAULT_PREFS.selectedAllergens);
  return {
    ...base,
    persons: state.persons,
    activePersonId: state.activePersonId,
    selectedAllergens: getActivePerson(state).allergens,
  };
}

function persist(next: Prefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode / quota) – keep in-memory state */
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
      persist(next);
      return next;
    });
  }, []);

  /**
   * Apply prefs from an imported backup (F1) — unlike history/notes/
   * pack-match, this is never called automatically: ProfileScreen only
   * invokes it after the user explicitly confirms, since it can replace
   * settings like tracesStrict that affect the alarm.
   */
  const importPrefs = useCallback((incoming: Partial<Prefs>) => {
    setPrefs((prev) => {
      const merged = { ...prev, ...incoming };
      // F: re-validate the persons trio no matter what shape `incoming` had
      // — an import must never be able to produce a state with a dangling
      // activePersonId or zero persons, the same invariant load() enforces.
      let next = withValidPersonsState(merged, merged);
      // A backup exported before this feature existed (or a hand-edited/
      // partial import) can carry the old flat `selectedAllergens` on its
      // own, with no `persons` at all. That case must still change what's
      // actually checked for whoever is currently active — the very common
      // "single default person, import an older file with different
      // allergens, tap 'Übernehmen'" path would otherwise silently do
      // nothing, because `merged.persons` is prev's (non-empty) persons and
      // migratePersonsState's "persons already exist" branch leaves those
      // alone rather than reaching for selectedAllergens. A modern export
      // always carries persons/activePersonId/selectedAllergens together,
      // consistently, and never takes this branch (`incoming.persons` is
      // defined for it).
      if (incoming.selectedAllergens && incoming.persons === undefined) {
        const persons = setPersonAllergensList(
          next.persons,
          next.activePersonId,
          incoming.selectedAllergens,
        );
        next = { ...next, persons, selectedAllergens: incoming.selectedAllergens };
      }
      persist(next);
      return next;
    });
  }, []);

  // --- F: schmale Verwaltungs-API für Personen -----------------------------
  //
  // Jede Aktion liest den aktuellen persons/activePersonId-Stand aus `prev`,
  // ruft die passende reine Funktion aus lib/persons.ts auf und schreibt
  // `persons`, `activePersonId` UND `selectedAllergens` in einem einzigen
  // setPrefs-Update zurück — so kann `selectedAllergens` nie für einen
  // Zwischenmoment vom tatsächlich aktiven Profil abweichen.
  const withPersonsState = useCallback(
    (patch: (state: PersonsState) => PersonsState) => {
      setPrefs((prev) => {
        const state = patch({ persons: prev.persons, activePersonId: prev.activePersonId });
        const next: Prefs = {
          ...prev,
          persons: state.persons,
          activePersonId: state.activePersonId,
          selectedAllergens: getActivePerson(state).allergens,
        };
        persist(next);
        return next;
      });
    },
    [],
  );

  /** Legt eine neue Person an und macht sie sofort aktiv. Die neue Person
   * erbt die Allergene der bisher aktiven als Startwert — siehe
   * lib/persons.ts's addPersonToState für die Begründung, warum eine leere
   * Startliste hier der unsicherere Weg wäre. */
  const addPerson = useCallback(
    (name: string) =>
      withPersonsState((state) =>
        addPersonToState(state, name, getActivePerson(state)?.allergens ?? []),
      ),
    [withPersonsState],
  );

  /** Benennt eine bestehende Person um; No-op bei leerem Namen/unbekannter ID. */
  const renamePersonAction = useCallback(
    (id: string, name: string) =>
      withPersonsState((state) => ({ ...state, persons: renamePersonList(state.persons, id, name) })),
    [withPersonsState],
  );

  /** Ersetzt die Allergen-Liste einer Person (nicht nur der aktiven). */
  const setPersonAllergensAction = useCallback(
    (id: string, allergens: string[]) =>
      withPersonsState((state) => ({
        ...state,
        persons: setPersonAllergensList(state.persons, id, allergens),
      })),
    [withPersonsState],
  );

  /** Entfernt eine Person; No-op, wenn es die letzte verbliebene wäre (siehe
   * lib/persons.ts's removePerson) — die letzte Person kann nie gelöscht
   * werden. */
  const removePersonAction = useCallback(
    (id: string) => withPersonsState((state) => removePersonFromState(state, id)),
    [withPersonsState],
  );

  /** Wechselt, wer gerade aktiv geprüft wird. No-op bei unbekannter ID. */
  const setActivePerson = useCallback(
    (id: string) => withPersonsState((state) => switchActivePerson(state, id)),
    [withPersonsState],
  );

  return {
    prefs,
    setPref,
    importPrefs,
    ready,
    addPerson,
    renamePerson: renamePersonAction,
    setPersonAllergens: setPersonAllergensAction,
    removePerson: removePersonAction,
    setActivePerson,
  };
}
