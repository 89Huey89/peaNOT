import type { AllergenStatus } from "@/lib/types";
import { isIdentityCaveat, type CaveatKey } from "@/lib/caveats";

/** The user's answer to "does this record match the pack in your hand?". */
export type PackMatch = "match" | "mismatch";

const STORAGE_KEY = "peanot.packmatch.v1";
const MAX_ENTRIES = 200;

interface StoredAnswer {
  value: PackMatch;
  /** Epoch milliseconds, used to prune the oldest answers. */
  ts: number;
}

type Store = Record<string, StoredAnswer>;

function isPackMatch(value: unknown): value is PackMatch {
  return value === "match" || value === "mismatch";
}

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const store: Store = {};
    for (const [barcode, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (entry === null || typeof entry !== "object") continue;
      const { value, ts } = entry as { value?: unknown; ts?: unknown };
      if (isPackMatch(value) && typeof ts === "number") store[barcode] = { value, ts };
    }
    return store;
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

/** The remembered answer for a barcode, or null when never answered. */
export function readPackMatch(barcode: string): PackMatch | null {
  return load()[barcode]?.value ?? null;
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
