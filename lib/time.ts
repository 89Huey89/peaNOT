// Human, German relative time for history rows: "Gerade eben", "Heute · 08:56",
// "Gestern · 19:20", "Mo · 11:33", or a date for older entries.

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function hhmm(d: Date): string {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return "Gerade eben";

  const date = new Date(ts);
  const today = startOfDay(new Date(now));
  const day = startOfDay(date);
  const daysAgo = Math.round((today - day) / 86_400_000);

  if (daysAgo <= 0) return `Heute · ${hhmm(date)}`;
  if (daysAgo === 1) return `Gestern · ${hhmm(date)}`;
  if (daysAgo < 7) return `${WEEKDAYS[date.getDay()]} · ${hhmm(date)}`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

const STALE_MONTHS = 24;

/**
 * Whether an OFF record edit is old enough that a recipe change is a live
 * risk (see the "Vorbehalte" section of README.md). Compared in whole
 * calendar months, not days, so "over 2 years" reads the way a human means it
 * regardless of how many 30/31-day months fall in between.
 */
export function isDataStale(dataLastModified: number, now: number = Date.now()): boolean {
  const edited = new Date(dataLastModified * 1000);
  const current = new Date(now);
  const months =
    (current.getFullYear() - edited.getFullYear()) * 12 +
    (current.getMonth() - edited.getMonth());
  return months >= STALE_MONTHS;
}
