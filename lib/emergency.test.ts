import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMERGENCY_PLAN,
  DEFAULT_EMERGENCY_STEPS,
  EMERGENCY_CONTACTS_MAX,
  EMERGENCY_NOTES_MAX,
  PEN_EXPIRY_WARNING_DAYS,
  cleanPhoneForTel,
  getPenStatus,
  normalizeEmergencyPlan,
  type EmergencyPlan,
} from "@/lib/emergency";

describe("emergency plan defaults", () => {
  it("ships a non-empty, non-blank default step template", () => {
    expect(DEFAULT_EMERGENCY_STEPS.length).toBeGreaterThan(0);
    for (const step of DEFAULT_EMERGENCY_STEPS) {
      expect(step.trim().length).toBeGreaterThan(0);
    }
  });

  it("mentions calling 112, the app's one fixed emergency fact", () => {
    expect(DEFAULT_EMERGENCY_STEPS.some((s) => s.includes("112"))).toBe(true);
  });

  it("starts unconfirmed — a template the family must review, not an app claim", () => {
    expect(DEFAULT_EMERGENCY_PLAN.confirmed).toBe(false);
  });

  it("starts with the default steps and no free text", () => {
    expect(DEFAULT_EMERGENCY_PLAN.steps).toEqual([...DEFAULT_EMERGENCY_STEPS]);
    expect(DEFAULT_EMERGENCY_PLAN.notes).toBe("");
  });

  it("keeps the default plan's steps array independent of the readonly template", () => {
    // DEFAULT_EMERGENCY_PLAN.steps must be its own array, not the same
    // reference as DEFAULT_EMERGENCY_STEPS — otherwise a caller mutating one
    // plan's steps (e.g. via setPref) could corrupt the shared default.
    expect(DEFAULT_EMERGENCY_PLAN.steps).not.toBe(DEFAULT_EMERGENCY_STEPS);
  });

  it("caps free-text notes to a sensible, short length", () => {
    expect(EMERGENCY_NOTES_MAX).toBeGreaterThan(0);
    expect(EMERGENCY_NOTES_MAX).toBeLessThanOrEqual(1000);
  });

  it("starts with no pens and no contacts — a fresh plan mustn't look pre-filled", () => {
    expect(DEFAULT_EMERGENCY_PLAN.pens).toEqual([]);
    expect(DEFAULT_EMERGENCY_PLAN.contacts).toEqual([]);
  });

  it("caps the number of free-text contacts to a sane, small number", () => {
    expect(EMERGENCY_CONTACTS_MAX).toBeGreaterThan(0);
    expect(EMERGENCY_CONTACTS_MAX).toBeLessThanOrEqual(10);
  });
});

describe("getPenStatus (Feature B)", () => {
  // 2026-08-22, expressed as a *local* Date the way `new Date()` in a
  // component would produce it — the point of these tests is that the
  // result doesn't depend on which timezone that local Date happens to be
  // in relative to UTC.
  const today = new Date(2026, 7, 22); // month is 0-indexed: August

  it("flags a pen whose date has already passed as expired", () => {
    expect(getPenStatus("2026-08-21", today)).toBe("expired");
    expect(getPenStatus("2020-01-01", today)).toBe("expired");
  });

  it("does not flag today's own date as expired yet", () => {
    expect(getPenStatus("2026-08-22", today)).not.toBe("expired");
  });

  it(`flags a pen expiring within ${PEN_EXPIRY_WARNING_DAYS} days as "soon"`, () => {
    expect(getPenStatus("2026-08-22", today)).toBe("soon"); // 0 days out
    expect(getPenStatus("2026-10-21", today)).toBe("soon"); // 60 days out
  });

  it("treats a pen more than the warning threshold away as ok", () => {
    expect(getPenStatus("2026-10-22", today)).toBe("ok"); // 61 days out
    expect(getPenStatus("2099-01-01", today)).toBe("ok");
  });

  it("returns unknown for a missing or malformed date rather than throwing", () => {
    expect(getPenStatus("", today)).toBe("unknown");
    expect(getPenStatus("not-a-date", today)).toBe("unknown");
  });

  it("never lets a UTC-midnight parse of the date string shift the calendar day", () => {
    // The trap this guards against: `new Date("2026-08-22")` parses as UTC
    // midnight. Naively diffing that against a *local* `today` Date can
    // land the boundary a day off depending on the device's timezone (e.g.
    // anywhere west of UTC, local midnight is still "yesterday" in UTC for
    // several hours). getPenStatus must compare calendar days, not
    // millisecond instants, so this stays exact regardless of where the
    // test runner's local timezone happens to sit.
    const dayBeforeToday = new Date(2026, 7, 21);
    const dayAfterToday = new Date(2026, 7, 23);
    expect(getPenStatus("2026-08-21", dayAfterToday)).toBe("expired");
    expect(getPenStatus("2026-08-23", dayBeforeToday)).not.toBe("expired");
  });
});

describe("cleanPhoneForTel (Feature C)", () => {
  it("removes spaces, parentheses and hyphens", () => {
    expect(cleanPhoneForTel("0151 234 56 78")).toBe("01512345678");
    expect(cleanPhoneForTel("(030) 123-456")).toBe("030123456");
  });

  it("keeps a leading + intact", () => {
    expect(cleanPhoneForTel("+49 151 234 56 78")).toBe("+491512345678");
    expect(cleanPhoneForTel("+49 (0) 151-2345678")).toBe("+4901512345678");
  });

  it("leaves an already-clean number untouched", () => {
    expect(cleanPhoneForTel("112")).toBe("112");
    expect(cleanPhoneForTel("+491512345678")).toBe("+491512345678");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanPhoneForTel("  0151 234 56 78  ")).toBe("01512345678");
  });

  it("handles an empty string without throwing", () => {
    expect(cleanPhoneForTel("")).toBe("");
  });
});

describe("normalizeEmergencyPlan (backwards compatibility)", () => {
  it("fills in pens/contacts as empty arrays for a plan saved before Feature B/C existed", () => {
    // Simulates exactly what usePrefs' load() hands the screen for an old
    // stored plan: `pens`/`contacts` are simply absent, not `[]`, because
    // DEFAULT_PREFS is only spread over the saved object at the top level.
    const legacyPlan = {
      steps: ["Alter Schritt."],
      notes: "Alte Notiz",
      confirmed: true,
    } as EmergencyPlan;

    const normalized = normalizeEmergencyPlan(legacyPlan);

    expect(normalized.pens).toEqual([]);
    expect(normalized.contacts).toEqual([]);
    expect(normalized.steps).toEqual(["Alter Schritt."]);
    expect(normalized.notes).toBe("Alte Notiz");
    expect(normalized.confirmed).toBe(true);
  });

  it("passes a fully-formed, already-current plan through unchanged", () => {
    const plan: EmergencyPlan = {
      steps: ["Schritt 1"],
      notes: "Notiz",
      confirmed: false,
      pens: [{ label: "Rucksack", expiresOn: "2027-01-01" }],
      contacts: [{ label: "Mama", phone: "0151 234 56 78" }],
    };

    expect(normalizeEmergencyPlan(plan)).toEqual(plan);
  });

  it("falls back to the default steps if steps is missing or empty", () => {
    const withoutSteps = { notes: "", confirmed: false } as unknown as EmergencyPlan;
    expect(normalizeEmergencyPlan(withoutSteps).steps).toEqual([...DEFAULT_EMERGENCY_STEPS]);

    // Wie oben ein Plan aus einer Version vor pens/contacts — der Cast muss
    // über unknown gehen, seit die Felder Pflicht sind. Genau dieser Fall ist
    // der Grund für normalizeEmergencyPlan.
    const withEmptySteps = {
      steps: [],
      notes: "",
      confirmed: false,
    } as unknown as EmergencyPlan;
    expect(normalizeEmergencyPlan(withEmptySteps).steps).toEqual([...DEFAULT_EMERGENCY_STEPS]);
  });

  it("coerces malformed individual pen/contact entries instead of throwing", () => {
    const messyPlan = {
      steps: ["Schritt"],
      notes: "",
      confirmed: true,
      pens: [{ expiresOn: "2027-01-01" }, null, {}],
      contacts: [{ phone: "0151" }, undefined],
    } as unknown as EmergencyPlan;

    const normalized = normalizeEmergencyPlan(messyPlan);

    expect(normalized.pens).toEqual([
      { label: "", expiresOn: "2027-01-01" },
      { label: "", expiresOn: "" },
      { label: "", expiresOn: "" },
    ]);
    expect(normalized.contacts).toEqual([
      { label: "", phone: "0151" },
      { label: "", phone: "" },
    ]);
  });

  it("handles a completely missing/null plan without throwing", () => {
    expect(() => normalizeEmergencyPlan(null as unknown as EmergencyPlan)).not.toThrow();
    expect(normalizeEmergencyPlan(null as unknown as EmergencyPlan)).toEqual({
      ...DEFAULT_EMERGENCY_PLAN,
      steps: [...DEFAULT_EMERGENCY_STEPS],
    });
  });
});
