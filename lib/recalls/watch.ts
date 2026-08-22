import type { RecallMatch } from "@/lib/types";

/**
 * F5 (Rückruf-Wächter): pure selection/throttle/dedup logic for periodically
 * re-checking favorites and recent history against official recall notices
 * — the case the scan-time check in lib/recalls/check.ts never covers: a
 * product that was green at scan time and gets an official recall notice
 * weeks later, sitting untouched in the cupboard. No DOM, no localStorage
 * here (that lives in components/useRecallWatch.ts) so this stays testable
 * with plain values.
 */

/** Barcode + display fields a caller (favorite or history entry) offers as
 * input; the shared subset both stores already carry. */
interface CandidateSource {
  barcode: string;
  name: string;
  brand: string;
}

interface HistorySource extends CandidateSource {
  ts: number;
}

/** One product to send to POST /api/recalls. */
export interface WatchCandidate {
  barcode: string;
  name: string;
  brand: string;
}

/** How many of the most recent history entries even get considered, before
 * the barcode dedup below — a household with years of scans shouldn't have
 * to wait for hundreds of stale rows to be sifted through to find the
 * handful that are actually recent. */
export const WATCH_HISTORY_LIMIT = 20;

/** Hard cap on products sent to the API per poll (matches the route's own
 * cap in app/api/recalls/route.ts — kept here so both sides agree on one
 * number). A family realistically has a few dozen staples + recent scans at
 * most; this is a generous backstop, not a normal-use limit. */
export const WATCH_CANDIDATES_MAX = 30;

/**
 * How often the background poll is allowed to run. The server's own warning
 * list is cached for LMW_REVALIDATE_S = 6h (lib/config.ts) — polling more
 * often than that would only ever re-read the same cached list, never see
 * anything new, while still spending a request and battery on every app
 * open. Six hours also means at most a handful of checks per day even for
 * someone who opens the app constantly, which matters on a phone that has
 * no other reason to make network calls in the background.
 */
export const WATCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Cap on how many acknowledgements are kept, so the store can't grow
 * without bound over months of use — same idea as lib/favorites.ts's
 * MAX_ENTRIES. Pruning only ever drops the *oldest* acknowledgements once
 * the cap is exceeded; it never touches favorites, history or a verdict. */
export const WATCH_ACK_MAX = 200;

/**
 * Which products the watcher even asks about: every favorite (an explicitly
 * starred "Stammprodukt" is exactly the case this feature exists for — the
 * bag of peanuts already in the cupboard, not a product about to be bought)
 * plus the most recent history entries, deduplicated by barcode (a favorite
 * wins over a history duplicate, since it's the same product) and capped so
 * one request never balloons.
 */
export function selectWatchCandidates(
  favorites: readonly CandidateSource[],
  history: readonly HistorySource[],
  cap: number = WATCH_CANDIDATES_MAX,
): WatchCandidate[] {
  const seen = new Set<string>();
  const out: WatchCandidate[] = [];

  for (const f of favorites) {
    if (seen.has(f.barcode)) continue;
    seen.add(f.barcode);
    out.push({ barcode: f.barcode, name: f.name, brand: f.brand });
  }

  const recentHistory = [...history]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, WATCH_HISTORY_LIMIT);
  for (const h of recentHistory) {
    if (seen.has(h.barcode)) continue;
    seen.add(h.barcode);
    out.push({ barcode: h.barcode, name: h.name, brand: h.brand });
  }

  return out.slice(0, cap);
}

/**
 * Whether a fresh poll is due. `lastCheckedAt === null` (never checked
 * before, e.g. first launch) always counts as due. `now`/`lastCheckedAt` are
 * both passed in explicitly rather than read internally, so this stays
 * testable without fake timers.
 */
export function isWatchDue(
  lastCheckedAt: number | null,
  now: number,
  intervalMs: number = WATCH_INTERVAL_MS,
): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= intervalMs;
}

/**
 * Identifies one official notice for one barcode, for the "already
 * quittiert" set (Punkt 6). Notices carry no id of their own — RecallMatch
 * is just {title, link, publishedDate} — so this folds barcode + title +
 * publishedDate + link into one key. Title alone would conflate two
 * distinct notices that happen to reuse similar wording; adding the other
 * two fields is enough to tell those apart without a real id the portal
 * doesn't supply. A new notice for the same product (different title/date/
 * link) produces a different key, so it is never hidden by an old
 * acknowledgement — exactly the "quittiert pro Meldung und Barcode, nicht
 * global" rule the task calls for.
 */
export function recallMatchKey(
  barcode: string,
  match: Pick<RecallMatch, "title" | "publishedDate" | "link">,
): string {
  return [barcode, match.title, match.publishedDate ?? "", match.link ?? ""].join("::");
}

/** One unacknowledged recall hit against a watched product, ready for the
 * Scan-Screen strip. */
export interface RecallWatchHit {
  barcode: string;
  name: string;
  brand: string;
  match: RecallMatch;
}

/** The outcome of checking one watched product against the warning list —
 * as stored after a successful poll. */
export interface WatchResult {
  barcode: string;
  name: string;
  brand: string;
  matches: RecallMatch[];
}

/**
 * Matches from the last successful poll that have not been acknowledged yet
 * — what the red strip on the Scan-Screen actually renders. Warn-only, like
 * every other recall surface: this never touches a verdict, a history entry
 * or a favorite, it only decides whether a notice is still worth flagging.
 */
export function selectNewHits(
  results: readonly WatchResult[],
  acknowledged: ReadonlySet<string>,
): RecallWatchHit[] {
  const hits: RecallWatchHit[] = [];
  for (const r of results) {
    for (const match of r.matches) {
      if (acknowledged.has(recallMatchKey(r.barcode, match))) continue;
      hits.push({ barcode: r.barcode, name: r.name, brand: r.brand, match });
    }
  }
  return hits;
}

/**
 * Keep the acknowledgement store from growing without bound over months of
 * use. Values are "acknowledged at" timestamps; once over `max` entries,
 * only the newest `max` survive. This is a practical storage cap, not the
 * "quittieren löscht nichts" guarantee from the task — that guarantee is
 * about never touching the underlying recall data, history or favorites,
 * which this never does either way.
 */
export function pruneAcknowledged(
  acknowledged: Record<string, number>,
  max: number = WATCH_ACK_MAX,
): Record<string, number> {
  const entries = Object.entries(acknowledged);
  if (entries.length <= max) return acknowledged;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, max));
}
