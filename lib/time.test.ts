import { describe, expect, it } from "vitest";
import { formatRelative, isDataStale } from "@/lib/time";

describe("formatRelative", () => {
  const now = new Date("2026-05-26T12:00:00").getTime();

  it("shows 'Gerade eben' for very recent timestamps", () => {
    expect(formatRelative(now - 10_000, now)).toBe("Gerade eben");
  });

  it("prefixes today with 'Heute'", () => {
    const earlierToday = new Date("2026-05-26T08:56:00").getTime();
    expect(formatRelative(earlierToday, now)).toMatch(/^Heute · /);
  });

  it("prefixes yesterday with 'Gestern'", () => {
    const yesterday = new Date("2026-05-25T19:20:00").getTime();
    expect(formatRelative(yesterday, now)).toMatch(/^Gestern · /);
  });

  it("uses a weekday abbreviation within the last week", () => {
    const threeDaysAgo = new Date("2026-05-23T11:33:00").getTime();
    expect(formatRelative(threeDaysAgo, now)).toMatch(/^(So|Mo|Di|Mi|Do|Fr|Sa) · /);
  });

  it("falls back to a date for older entries", () => {
    const longAgo = new Date("2026-04-01T10:00:00").getTime();
    expect(formatRelative(longAgo, now)).toMatch(/\d{2}\.\d{2}/);
  });
});

describe("isDataStale", () => {
  const now = new Date("2026-08-21T12:00:00").getTime();

  it("is not stale just under 24 months", () => {
    const editedMs = new Date("2024-09-01T00:00:00").getTime();
    expect(isDataStale(editedMs / 1000, now)).toBe(false);
  });

  it("is stale at exactly 24 months", () => {
    const editedMs = new Date("2024-08-01T00:00:00").getTime();
    expect(isDataStale(editedMs / 1000, now)).toBe(true);
  });

  it("is stale well past 24 months", () => {
    const editedMs = new Date("2021-01-01T00:00:00").getTime();
    expect(isDataStale(editedMs / 1000, now)).toBe(true);
  });

  it("is not stale for a recent edit", () => {
    const editedMs = new Date("2026-08-01T00:00:00").getTime();
    expect(isDataStale(editedMs / 1000, now)).toBe(false);
  });
});
