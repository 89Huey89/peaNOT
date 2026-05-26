import { describe, expect, it } from "vitest";
import { formatRelative } from "@/lib/time";

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
