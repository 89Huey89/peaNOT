/**
 * F4: the family's own anaphylaxis emergency plan — a starting template the
 * app proposes, never a medical instruction the app itself asserts (see the
 * disclaimer text on EmergencyScreen). The family reviews it once (accepting
 * it as-is or editing it) and can revise it any time after.
 */
export interface EmergencyPlan {
  /** Ordered action steps, editable. Starts as DEFAULT_EMERGENCY_STEPS. */
  steps: string[];
  /** Free text: medication, dose, where the emergency kit is kept. */
  notes: string;
  /** True once the family has accepted-as-is or saved an edit at least
   * once — lets the screen tell "still the untouched template" apart from
   * "this is what we actually agreed on" (item F4's "confirms/edits once"). */
  confirmed: boolean;
}

/**
 * Generic, non-branded steps for a suspected anaphylactic reaction — the
 * kind of sequence printed on most auto-injector package leaflets, not tied
 * to one product. A starting point only: families must review it against
 * their own doctor's plan before relying on it (enforced by `confirmed`
 * staying false until they do).
 */
export const DEFAULT_EMERGENCY_STEPS: readonly string[] = [
  "Ruhe bewahren. Das Kind hinlegen — bei Kreislaufbeschwerden die Beine hochlagern, bei Atemnot aufrecht sitzen lassen.",
  "Adrenalin-Autoinjektor sofort anwenden: außen am Oberschenkel, auch durch die Kleidung möglich. Anleitung auf dem Gerät befolgen.",
  "Sofort 112 anrufen — auch wenn es danach besser wird. „Anaphylaxie“ und „Adrenalin verabreicht“ nennen.",
  "Keine Besserung nach 5–10 Minuten? Zweiten Autoinjektor anwenden, falls vorhanden.",
  "Bis der Rettungsdienst da ist: nicht allein lassen, weiter beobachten.",
];

export const EMERGENCY_NOTES_MAX = 400;

export const DEFAULT_EMERGENCY_PLAN: EmergencyPlan = {
  steps: [...DEFAULT_EMERGENCY_STEPS],
  notes: "",
  confirmed: false,
};
