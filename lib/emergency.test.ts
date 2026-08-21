import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMERGENCY_PLAN,
  DEFAULT_EMERGENCY_STEPS,
  EMERGENCY_NOTES_MAX,
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
});
