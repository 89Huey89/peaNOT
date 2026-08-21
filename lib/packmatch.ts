import type { AllergenStatus } from "@/lib/types";
import { isIdentityCaveat, type CaveatKey } from "@/lib/caveats";

/** The user's answer to "does this record match the pack in your hand?". */
export type PackMatch = "match" | "mismatch";

const STORAGE_KEY = "peanot.packmatch.v1";
const MAX_ENTRIES = 200;

// A "match" answer only vouches for the specific pack the user held in their
// hand *then* — it must not stand in forever for a restricted-circulation
// code, which can legitimately point at a different product later (the exact
// risk lib/caveats.ts warns about). So it expires and the identity question
// is asked again. A "mismatch" carries no such risk — nothing unsafe follows
// from continuing to distrust a record — so it never expires (fail-safe).
const MATCH_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

export interface StoredAnswer {
  value: PackMatch;
  /** Epoch milliseconds, used to prune the oldest answers and to age out "match". */
  ts: number;
}

export type PackMatchStore = Record<string, StoredAnswer>;
type Store = PackMatchStore;

function isPackMatch(value: unknown): value is PackMatch {
  return value === "match" || value === "mismatch";
}

/**
 * Validate an arbitrary (already-parsed) value into a well-formed
 * pack-match store, dropping anything malformed. Shared by load() (raw
 * localStorage) and the F1 import path (lib/backup.ts), which hands in
 * already-parsed JSON instead of a raw string.
 */
export function sanitizePackMatchStore(value: unknown): Store {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const store: Store = {};
  for (const [barcode, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null || typeof entry !== "object") continue;
    const { value: v, ts } = entry as { value?: unknown; ts?: unknown };
    if (isPackMatch(v) && typeof ts === "number") store[barcode] = { value: v, ts };
  }
  return store;
}

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizePackMatchStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persist(store: Store): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable – the answer stays in memory for this screen */
  }
}

/** Keep the newest answers only, so the store cannot grow without bound. */
function prune(store: Store): Store {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) return store;
  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b.ts - a.ts).slice(0, MAX_ENTRIES),
  );
}

/**
 * The remembered answer for a barcode with its timestamp, or null when never
 * answered *or* when a "match" answer has aged out (see MATCH_EXPIRY_MS). A
 * "mismatch" is returned regardless of age.
 */
export function readPackMatchEntry(
  barcode: string,
  now: number = Date.now(),
): StoredAnswer | null {
  const entry = load()[barcode];
  if (!entry) return null;
  if (entry.value === "match" && now - entry.ts > MATCH_EXPIRY_MS) return null;
  return entry;
}

/** The remembered answer for a barcode, or null when never answered or expired. */
export function readPackMatch(barcode: string, now: number = Date.now()): PackMatch | null {
  return readPackMatchEntry(barcode, now)?.value ?? null;
}

/** Remember an answer, or forget it again when passed null. */
export function writePackMatch(
  barcode: string,
  value: PackMatch | null,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const store = load();
  if (value === null) {
    delete store[barcode];
  } else {
    store[barcode] = { value, ts: now };
  }
  persist(prune(store));
}

/** The full pack-match store, for the export side of F1 (lib/backup.ts). */
export function readAllPackMatch(): Store {
  return load();
}

/**
 * Replace the full pack-match store, for the import side of F1
 * (lib/backup.ts) — the caller (mergePackMatch) has already folded in the
 * existing entries, so this just persists (with the usual prune).
 */
export function writeAllPackMatch(store: Store): void {
  persist(prune(store));
}

export interface ResolvedLookup {
  status: AllergenStatus;
  caveats: CaveatKey[];
}

/**
 * Fold the user's pack comparison into the machine result.
 *
 * "match" settles the identity question — the user has seen more than the
 * database ever could, so those caveats drop away. "mismatch" invalidates the
 * whole record: whatever it says describes someone else's product, so the
 * result falls back to KEINE_DATEN.
 *
 * Fail-safe as everywhere else: an answer can never talk a hit or a trace
 * warning away, so JA/SPUREN pass through untouched.
 */
export function applyPackMatch(
  status: AllergenStatus,
  caveats: CaveatKey[],
  answer: PackMatch | null,
): ResolvedLookup {
  if (answer === null || status === "JA" || status === "SPUREN") {
    return { status, caveats };
  }
  if (answer === "mismatch") {
    return { status: "KEINE_DATEN", caveats };
  }
  return { status, caveats: caveats.filter((key) => !isIdentityCaveat(key)) };
}
