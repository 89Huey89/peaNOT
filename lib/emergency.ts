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
  /**
   * Feature B: the family's Adrenalin auto-injectors, so an expiry date
   * lives in the one place someone actually looks in an emergency instead
   * of only on the small print of a device nobody checks routinely. Two
   * pens is the normal case (the step list itself calls for a second one),
   * so this is a list, not a fixed pair — and an empty list is a perfectly
   * valid state; nobody is forced to fill this in. Pure reminder, not a
   * medical release: see `getPenStatus` and the disclaimer text on the
   * screen for why an unexpired pen is never called "fine"/"safe" in the UI.
   */
  pens: AutoInjectorPen[];
  /**
   * Feature C: contacts to hand someone alongside the 112 button — the
   * second parent, the pediatrician, the Kita. Purely informational, never
   * read by any verdict logic, and strictly secondary to 112 in both the
   * data model's ordering intent and the UI (112 stays the one big red
   * button). An empty list is valid; nobody is forced to fill this in.
   */
  contacts: EmergencyContact[];
}

/**
 * One Adrenalin auto-injector. `expiresOn` is a plain calendar date
 * (`YYYY-MM-DD`, exactly what `<input type="date">` produces) rather than a
 * timestamp — expiry is a day, not a moment, and storing it as a string
 * sidesteps a UTC-vs-local round-trip through `Date` entirely until
 * `getPenStatus` needs to compare it against "today".
 */
export interface AutoInjectorPen {
  /** Free text: where the pen lives or whose it is, e.g. "Rucksack", "Kita". Optional — "" is fine. */
  label: string;
  /** `YYYY-MM-DD`, or "" if the family hasn't entered a date yet. */
  expiresOn: string;
}

/** One free-text emergency contact (second parent, pediatrician, Kita, …). */
export interface EmergencyContact {
  /** Free text, e.g. "Mama", "Kinderärztin Dr. Bauer". */
  label: string;
  /** Exactly as the person typed it — cleaned only for the `tel:` link, see `cleanPhoneForTel`. */
  phone: string;
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

/** At most this many free-text contacts — enough for both parents plus the
 * pediatrician and the Kita/school, without the list becoming its own wall
 * of text to scan in an emergency. */
export const EMERGENCY_CONTACTS_MAX = 4;

export const DEFAULT_EMERGENCY_PLAN: EmergencyPlan = {
  steps: [...DEFAULT_EMERGENCY_STEPS],
  notes: "",
  confirmed: false,
  // Empty, not pre-filled with a blank row: a fresh plan must not look like
  // something has already been entered (see the task's framing for both
  // Feature B and C).
  pens: [],
  contacts: [],
};

/**
 * How many days out "läuft bald ab" starts warning — long enough that a
 * family sees it well before the pen is actually unusable, short enough
 * that it isn't background noise for most of the pen's life.
 */
export const PEN_EXPIRY_WARNING_DAYS = 60;

export type PenStatus = "expired" | "soon" | "ok" | "unknown";

/**
 * Days from `today` to the pen's `expiresOn`, compared as calendar dates —
 * never as millisecond timestamps. `new Date("2026-08-22")` parses as UTC
 * midnight, so diffing it against a *local* `Date.now()` can land the
 * comparison a day off depending on the device's timezone (e.g. anywhere
 * west of UTC, "today" in local time is still "yesterday" in UTC at certain
 * hours). Parsing the stored string by hand and reading `today`'s
 * *local* year/month/day sidesteps that entirely: both sides are turned
 * into a UTC-midnight instant for the same calendar date, so the diff is a
 * whole number of days regardless of which timezone either value lives in.
 * Returns null for a missing/malformed date (e.g. a pen with no date set
 * yet) rather than throwing.
 */
function calendarDaysUntil(dateStr: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const [, y, mo, d] = m;
  const target = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - todayUTC) / 86_400_000);
}

/**
 * Status of one auto-injector relative to `today` (passed in explicitly —
 * never read internally via `Date.now()` — so this stays testable without
 * fake timers). This is a reminder, not a medical release: "ok" means only
 * "expiry date not reached", never "safe to use" or "verified working" —
 * the app has no way to know that, and the UI text must not imply it does.
 */
export function getPenStatus(expiresOn: string, today: Date): PenStatus {
  const days = calendarDaysUntil(expiresOn, today);
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days <= PEN_EXPIRY_WARNING_DAYS) return "soon";
  return "ok";
}

/**
 * Strips the formatting a human types into a phone field — spaces,
 * parentheses, hyphens — so the number works as a `tel:` href, while
 * keeping a leading `+` (international prefix) intact. Deliberately does
 * *not* touch anything else (no re-parsing into a canonical format): the
 * input field itself keeps the person's original text untouched, this is
 * only for the href.
 */
export function cleanPhoneForTel(raw: string): string {
  return raw.trim().replace(/[\s()-]/g, "");
}

function normalizePen(value: unknown): AutoInjectorPen {
  const obj = (value && typeof value === "object" ? value : {}) as Partial<AutoInjectorPen>;
  return {
    label: typeof obj.label === "string" ? obj.label : "",
    expiresOn: typeof obj.expiresOn === "string" ? obj.expiresOn : "",
  };
}

function normalizeContact(value: unknown): EmergencyContact {
  const obj = (value && typeof value === "object" ? value : {}) as Partial<EmergencyContact>;
  return {
    label: typeof obj.label === "string" ? obj.label : "",
    phone: typeof obj.phone === "string" ? obj.phone : "",
  };
}

/**
 * Makes any stored `EmergencyPlan` safe to render, including one saved by
 * an older app version that predates `pens`/`contacts` entirely. `usePrefs`
 * only spreads a saved plan over `DEFAULT_PREFS` at the top level (see its
 * `load()`), so an old plan's missing `pens`/`contacts` arrive here as
 * `undefined`, not as `[]` — rendering that directly (`.map`, `.length`)
 * would throw. Called from the screen before anything reads `plan.pens` /
 * `plan.contacts`. Also defensively coerces malformed individual entries
 * (e.g. hand-edited localStorage) rather than trusting stored shapes.
 */
export function normalizeEmergencyPlan(plan: EmergencyPlan): EmergencyPlan {
  return {
    steps: Array.isArray(plan?.steps) && plan.steps.length > 0 ? plan.steps : [...DEFAULT_EMERGENCY_STEPS],
    notes: typeof plan?.notes === "string" ? plan.notes : "",
    confirmed: plan?.confirmed === true,
    pens: Array.isArray(plan?.pens) ? plan.pens.map(normalizePen) : [],
    contacts: Array.isArray(plan?.contacts) ? plan.contacts.map(normalizeContact) : [],
  };
}
