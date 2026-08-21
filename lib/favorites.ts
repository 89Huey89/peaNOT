import { VERDICT, type Verdict } from "@/lib/verdict";

const STORAGE_KEY = "peanot.favorites.v1";
// A curated staple list, not a rolling log (see README's F2 section) — a
// family realistically re-buys 10-20 products, so this is a generous
// backstop against unbounded growth, not a normal-use limit.
const MAX_ENTRIES = 50;

/** A starred "staple" product — the pre-shopping check for the same 10-20
 * items a family buys again and again (F2). Purely informational: nothing
 * here is ever read by anything that computes a verdict. */
export interface FavoriteEntry {
  barcode: string;
  name: string;
  brand: string;
  /** Verdict from the most recent lookup of this barcode, refreshed by
   * recordFavoriteCheck on every recheck — not frozen at the moment it was
   * starred. */
  verdict: Verdict;
  /** Epoch milliseconds of that last lookup, same meaning as HistoryEntry.ts. */
  ts: number;
  /** Epoch milliseconds this barcode was starred. Unlike `ts`, this never
   * changes again — it orders the Favoriten strip (most recently starred
   * first) and decides which entry is dropped once MAX_ENTRIES is exceeded. */
  addedAt: number;
}

export type FavoriteStore = Record<string, FavoriteEntry>;
type Store = FavoriteStore;

const VERDICT_KEYS = new Set(Object.keys(VERDICT));
function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && VERDICT_KEYS.has(value);
}

/**
 * Validate an arbitrary (already-parsed) value into a well-formed favorites
 * store, dropping anything malformed — same defensive shape as
 * lib/notes.ts's sanitizeNoteStore / lib/packmatch.ts's sanitizePackMatchStore.
 */
export function sanitizeFavoriteStore(value: unknown): Store {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const store: Store = {};
  for (const [barcode, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null || typeof entry !== "object") continue;
    const { name, brand, verdict, ts, addedAt } = entry as Record<string, unknown>;
    if (
      typeof name === "string" &&
      typeof brand === "string" &&
      isVerdict(verdict) &&
      typeof ts === "number" &&
      typeof addedAt === "number"
    ) {
      store[barcode] = { barcode, name, brand, verdict, ts, addedAt };
    }
  }
  return store;
}

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeFavoriteStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persist(store: Store): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable – the favorite stays in memory for this screen */
  }
}

/** Keep the most recently starred entries only, so the list cannot grow
 * without bound. */
function prune(store: Store): Store {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) return store;
  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b.addedAt - a.addedAt).slice(0, MAX_ENTRIES),
  );
}

/** All favorites, most recently starred first — the order the Favoriten
 * strip (ScanScreen) renders them in. */
export function readAllFavorites(): FavoriteEntry[] {
  return Object.values(load()).sort((a, b) => b.addedAt - a.addedAt);
}

/** Whether a barcode is currently starred. */
export function isFavoriteBarcode(barcode: string): boolean {
  return barcode in load();
}

/**
 * Star or un-star a barcode. Starring records the product's current name,
 * brand, verdict and check time as a starting point — immediately kept fresh
 * by the next real check (see recordFavoriteCheck). Un-starring drops the
 * entry entirely. Returns the entry that ended up stored, or null once
 * removed.
 */
export function toggleFavorite(
  barcode: string,
  info: { name: string; brand: string; verdict: Verdict; ts: number },
  now: number = Date.now(),
): FavoriteEntry | null {
  if (typeof window === "undefined") return null;
  const store = load();
  if (store[barcode]) {
    delete store[barcode];
    persist(store);
    return null;
  }
  const entry: FavoriteEntry = { barcode, addedAt: now, ...info };
  store[barcode] = entry;
  persist(prune(store));
  return entry;
}

/**
 * Refresh a favorited barcode's stored verdict/ts after a fresh lookup — a
 * no-op when the barcode isn't (or is no longer) favorited. This is what
 * keeps the pre-shopping staple check (F2) honest: tapping a favorite always
 * re-runs the ordinary lookup against Open Food Facts, and the star only
 * ever reflects that latest result, never the one from when it was starred.
 */
export function recordFavoriteCheck(barcode: string, verdict: Verdict, ts: number): void {
  if (typeof window === "undefined") return;
  const store = load();
  const existing = store[barcode];
  if (!existing) return;
  store[barcode] = { ...existing, verdict, ts };
  persist(store);
}
