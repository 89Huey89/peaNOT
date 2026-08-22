import type { HistoryEntry } from "@/components/useHistory";
import type { Prefs } from "@/components/usePrefs";
import type { Verdict } from "@/lib/verdict";
import { sanitizePackMatchStore, type PackMatchStore } from "@/lib/packmatch";
import { sanitizeNoteStore, type NoteStore } from "@/lib/notes";

/**
 * F1 — export/import as a family backup and device-to-device sync substitute
 * (no account, no server, see README). This file holds only the pure
 * parse/merge logic so it is unit-testable without touching localStorage or
 * the DOM; the actual localStorage reads/writes stay where each store
 * already owns them (components/useHistory.ts, lib/packmatch.ts,
 * lib/notes.ts) and are wired together by components/useBackup.ts.
 */

export const EXPORT_FORMAT = "peanot-export" as const;
export const EXPORT_VERSION = 1 as const;

// Mirrors components/useHistory.ts's own MAX_ENTRIES; the live hook always
// passes that constant explicitly when merging, so this default only matters
// for calling mergeHistory directly (e.g. in tests).
const DEFAULT_HISTORY_CAP = 200;

export interface PeanotExport {
  format: typeof EXPORT_FORMAT;
  v: typeof EXPORT_VERSION;
  exportedAt: string;
  history: HistoryEntry[];
  prefs: Partial<Prefs>;
  packmatch: PackMatchStore;
  notes: NoteStore;
}

export function buildExportPayload(input: {
  history: HistoryEntry[];
  prefs: Prefs;
  packmatch: PackMatchStore;
  notes: NoteStore;
}): PeanotExport {
  return {
    format: EXPORT_FORMAT,
    v: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    history: input.history,
    prefs: input.prefs,
    packmatch: input.packmatch,
    notes: input.notes,
  };
}

function historyKey(entry: HistoryEntry): string {
  return entry.id || `${entry.barcode}|${entry.ts}`;
}

/**
 * Merge two history lists for import (F1): entries are de-duplicated by id,
 * falling back to barcode+ts for anything without one, and the newer entry
 * wins a conflict. Sorted newest-first and capped like the live store, so an
 * imported file can never grow it past the ordinary limit.
 */
export function mergeHistory(
  current: HistoryEntry[],
  incoming: HistoryEntry[],
  maxEntries: number = DEFAULT_HISTORY_CAP,
): HistoryEntry[] {
  const byKey = new Map<string, HistoryEntry>();
  for (const entry of [...current, ...incoming]) {
    const key = historyKey(entry);
    const existing = byKey.get(key);
    if (!existing || entry.ts > existing.ts) byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.ts - a.ts).slice(0, maxEntries);
}

/**
 * Merge two pack-match stores for import. Unlike history/notes, a pack-match
 * answer can change a verdict (lib/packmatch.ts's applyPackMatch), so a
 * conflict is resolved fail-safe: "mismatch" always wins over "match",
 * regardless of which side is newer — an import must never quietly make an
 * already-distrusted record trustable again. Only when both sides agree does
 * the newer timestamp win (it matters for "match"'s 90-day expiry).
 */
export function mergePackMatch(
  current: PackMatchStore,
  incoming: PackMatchStore,
): PackMatchStore {
  const merged: PackMatchStore = { ...current };
  for (const [barcode, next] of Object.entries(incoming)) {
    const existing = merged[barcode];
    if (!existing) {
      merged[barcode] = next;
    } else if (existing.value === next.value) {
      merged[barcode] = next.ts > existing.ts ? next : existing;
    } else {
      merged[barcode] = existing.value === "mismatch" ? existing : next;
    }
  }
  return merged;
}

/**
 * Merge two note stores for import (F5) — purely additive and informational,
 * never touches a verdict, so the newer edit simply wins a conflict.
 */
export function mergeNotes(current: NoteStore, incoming: NoteStore): NoteStore {
  const merged: NoteStore = { ...current };
  for (const [barcode, next] of Object.entries(incoming)) {
    const existing = merged[barcode];
    if (!existing || next.ts > existing.ts) merged[barcode] = next;
  }
  return merged;
}

const VERDICTS: readonly Verdict[] = ["safe", "danger", "trace", "partial", "unknown"];
function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}

/** Drop anything that isn't a well-formed history entry — a malformed row in
 * an imported file is skipped, not allowed to crash the whole import.
 *
 * Exported so components/useHistory.ts's load() can run the exact same
 * check on whatever is already sitting in localStorage (Befund 02): a
 * corrupt row that made it into storage some other way (a future bug, a
 * hand-edited value, a botched migration) must not crash every future
 * launch just because it once got written. This file's only import *from*
 * components/useHistory.ts is `import type { HistoryEntry }` above, which
 * TypeScript erases at compile time — so useHistory.ts importing a value
 * from here in return does not create a runtime import cycle. */
export function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryEntry[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const { id, ts, barcode, name, brand, verdict } = item as Record<string, unknown>;
    if (
      typeof id === "string" &&
      typeof ts === "number" &&
      typeof barcode === "string" &&
      typeof name === "string" &&
      typeof brand === "string" &&
      isVerdict(verdict)
    ) {
      out.push({ id, ts, barcode, name, brand, verdict });
    }
  }
  return out;
}

// Prefs get no field-level validation here — same trust level as
// components/usePrefs.ts's own load(), which spreads parsed JSON straight
// over DEFAULT_PREFS. Applying an import is gated behind an explicit user
// confirmation in ProfileScreen regardless (see README), so a malformed
// field just falls back to the existing default the next time usePrefs
// reads it.
function sanitizePrefsPartial(value: unknown): Partial<Prefs> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Partial<Prefs>;
}

export type ImportError = "invalid-json" | "unsupported-format" | "unsupported-version";

export type ImportParseResult =
  | { ok: true; data: PeanotExport }
  | { ok: false; error: ImportError };

/**
 * Parse and validate a picked file's contents into a PeanotExport, or a
 * typed reason it was rejected. Never throws.
 */
export function parseImportFile(raw: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "invalid-json" };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== EXPORT_FORMAT) return { ok: false, error: "unsupported-format" };
  if (obj.v !== EXPORT_VERSION) return { ok: false, error: "unsupported-version" };
  return {
    ok: true,
    data: {
      format: EXPORT_FORMAT,
      v: EXPORT_VERSION,
      exportedAt:
        typeof obj.exportedAt === "string" ? obj.exportedAt : new Date(0).toISOString(),
      history: sanitizeHistory(obj.history),
      prefs: sanitizePrefsPartial(obj.prefs),
      packmatch: sanitizePackMatchStore(obj.packmatch),
      notes: sanitizeNoteStore(obj.notes),
    },
  };
}
