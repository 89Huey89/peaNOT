const STORAGE_KEY = "peanot.notes.v1";
const MAX_ENTRIES = 200;

/** Same order of magnitude as the allergy card's own addendum
 * (PhraseScreen's CARD_NOTE_MAX) — a product note is a short family reminder,
 * not a diary entry. */
export const NOTE_MAX_LENGTH = 240;

export interface StoredNote {
  text: string;
  /** Epoch milliseconds of the last edit — prunes the oldest notes and
   * resolves import merge conflicts (see lib/backup.ts's mergeNotes). */
  ts: number;
}

export type NoteStore = Record<string, StoredNote>;
type Store = NoteStore;

/**
 * Validate an arbitrary (already-parsed) value into a well-formed note
 * store, dropping anything malformed. Shared by load() (raw localStorage)
 * and the F1 import path (lib/backup.ts), which hands in already-parsed
 * JSON instead of a raw string.
 */
export function sanitizeNoteStore(value: unknown): Store {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const store: Store = {};
  for (const [barcode, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null || typeof entry !== "object") continue;
    const { text, ts } = entry as { text?: unknown; ts?: unknown };
    if (typeof text === "string" && text.trim().length > 0 && typeof ts === "number") {
      store[barcode] = { text: text.slice(0, NOTE_MAX_LENGTH), ts };
    }
  }
  return store;
}

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeNoteStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persist(store: Store): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable – the note stays in memory for this screen */
  }
}

/** Keep the newest notes only, so the store cannot grow without bound. */
function prune(store: Store): Store {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) return store;
  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b.ts - a.ts).slice(0, MAX_ENTRIES),
  );
}

/** The saved note for a barcode with its timestamp, or null when there is none. */
export function readNoteEntry(barcode: string): StoredNote | null {
  return load()[barcode] ?? null;
}

/** The saved note text for a barcode, or null when there is none. */
export function readNote(barcode: string): string | null {
  return readNoteEntry(barcode)?.text ?? null;
}

/**
 * Save, update, or clear the note for a barcode. Blank/whitespace-only text
 * clears it (mirrors writePackMatch's null-to-clear convention). Returns the
 * entry that ended up stored (or null when cleared) so callers don't have to
 * re-derive the trim/cap that happened here — see components/useNote.ts.
 *
 * Purely informational (F5): nothing here reads or feeds a verdict.
 */
export function writeNote(
  barcode: string,
  text: string,
  now: number = Date.now(),
): StoredNote | null {
  if (typeof window === "undefined") return null;
  const trimmed = text.trim().slice(0, NOTE_MAX_LENGTH);
  const store = load();
  if (!trimmed) {
    delete store[barcode];
    persist(store);
    return null;
  }
  const entry: StoredNote = { text: trimmed, ts: now };
  store[barcode] = entry;
  persist(prune(store));
  return entry;
}

/** The full note store, for the export side of F1 (lib/backup.ts). */
export function readAllNotes(): Store {
  return load();
}

/**
 * Replace the full note store, for the import side of F1 (lib/backup.ts) —
 * the caller (mergeNotes) has already folded in the existing entries, so
 * this just persists (with the usual prune).
 */
export function writeAllNotes(store: Store): void {
  persist(prune(store));
}
