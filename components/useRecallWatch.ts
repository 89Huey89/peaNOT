"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecallMatch } from "@/lib/types";
import { useOnlineStatus } from "@/components/useOnlineStatus";
import {
  isWatchDue,
  pruneAcknowledged,
  recallMatchKey,
  selectNewHits,
  selectWatchCandidates,
  type RecallWatchHit,
  type WatchResult,
} from "@/lib/recalls/watch";

const STORAGE_KEY = "peanot.recallwatch.v1";

interface CandidateLike {
  barcode: string;
  name: string;
  brand: string;
}
interface HistoryLike extends CandidateLike {
  ts: number;
}

interface StoredState {
  /** Epoch ms of the last poll attempt (success or failure) — drives the
   * throttle window (isWatchDue), see lib/recalls/watch.ts. */
  lastCheckedAt: number | null;
  /** recallMatchKey -> when it was acknowledged (epoch ms). */
  acknowledged: Record<string, number>;
  /** Matches from the last successful poll, kept so the strip survives a
   * reload even while the next poll is still throttled. */
  lastResults: WatchResult[];
}

const EMPTY_STATE: StoredState = { lastCheckedAt: null, acknowledged: {}, lastResults: [] };

function isRecallMatch(value: unknown): value is RecallMatch {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RecallMatch).title === "string"
  );
}

function isWatchResult(value: unknown): value is WatchResult {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<WatchResult>;
  return (
    typeof r.barcode === "string" &&
    typeof r.name === "string" &&
    typeof r.brand === "string" &&
    Array.isArray(r.matches) &&
    r.matches.every(isRecallMatch)
  );
}

/** Read the stored watcher state defensively — a malformed/foreign value
 * (older app version, hand-edited localStorage) degrades to EMPTY_STATE
 * rather than throwing, same shape as every other store in this app. */
function load(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY_STATE;

    const lastCheckedAt = typeof parsed.lastCheckedAt === "number" ? parsed.lastCheckedAt : null;

    const acknowledged: Record<string, number> = {};
    if (parsed.acknowledged && typeof parsed.acknowledged === "object" && !Array.isArray(parsed.acknowledged)) {
      for (const [key, value] of Object.entries(parsed.acknowledged as Record<string, unknown>)) {
        if (typeof value === "number") acknowledged[key] = value;
      }
    }

    const lastResults = Array.isArray(parsed.lastResults)
      ? parsed.lastResults.filter(isWatchResult)
      : [];

    return { lastCheckedAt, acknowledged, lastResults };
  } catch {
    return EMPTY_STATE;
  }
}

function persist(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode / quota) – keep in-memory only */
  }
}

/**
 * F5 (Rückruf-Wächter): periodically checks favorites + recent history
 * against official recall notices, independent of any scan — the case
 * lib/recalls/check.ts never covers on its own, since it only runs at the
 * moment of a scan. Orchestrates the throttled POST /api/recalls poll and
 * the localStorage-backed "already quittiert" state; the actual selection/
 * throttle/dedup rules live in lib/recalls/watch.ts (pure, DOM-free) so they
 * stay unit-testable on their own.
 *
 * Callers pass in whatever favorites/history they already have mounted
 * (app/page.tsx already holds both via useFavorites/useHistory) — this hook
 * owns no store of its own for *which* products to watch, only the poll
 * timing and the acknowledgement state.
 */
export function useRecallWatch(favorites: CandidateLike[], history: HistoryLike[]) {
  const online = useOnlineStatus();
  const [state, setState] = useState<StoredState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const pollInFlight = useRef(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  // The actual poll. Never fires while offline (no point failing a request
  // navigator.onLine already told us can't succeed) and never more often
  // than WATCH_INTERVAL_MS apart (see lib/recalls/watch.ts for why 6h).
  useEffect(() => {
    if (!ready || !online || pollInFlight.current) return;
    const now = Date.now();
    if (!isWatchDue(state.lastCheckedAt, now)) return;

    const candidates = selectWatchCandidates(favorites, history);
    if (candidates.length === 0) {
      // Nothing to watch (no favorites, no history yet) — still record the
      // attempt so the throttle window holds and this doesn't refire on
      // every render until there's something to check.
      setState((prev) => {
        const next = { ...prev, lastCheckedAt: now };
        persist(next);
        return next;
      });
      return;
    }

    pollInFlight.current = true;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/recalls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: candidates }),
        });
        const body: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        const ok =
          res.ok &&
          typeof body === "object" &&
          body !== null &&
          (body as { status?: string }).status === "ok" &&
          typeof (body as { results?: unknown }).results === "object" &&
          (body as { results?: unknown }).results !== null;

        setState((prev) => {
          if (!ok) {
            // Unavailable (or a response shape we don't recognize): never
            // treat this as "no recalls" — keep whatever lastResults were
            // already known and just record that a check was attempted, so
            // the throttle window still holds instead of retrying on every
            // render.
            const next = { ...prev, lastCheckedAt: now };
            persist(next);
            return next;
          }
          const resultsByBarcode = (body as { results: Record<string, unknown> }).results;
          const lastResults: WatchResult[] = candidates.map((c) => ({
            barcode: c.barcode,
            name: c.name,
            brand: c.brand,
            matches: Array.isArray(resultsByBarcode[c.barcode])
              ? (resultsByBarcode[c.barcode] as RecallMatch[])
              : [],
          }));
          const next = { ...prev, lastCheckedAt: now, lastResults };
          persist(next);
          return next;
        });
      } catch {
        if (cancelled) return;
        // The request itself failed (offline mid-flight, app API down,
        // etc.) — same fail-safe rule as above: never silently becomes "no
        // recalls", just records the attempt.
        setState((prev) => {
          const next = { ...prev, lastCheckedAt: now };
          persist(next);
          return next;
        });
      } finally {
        pollInFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // favorites/history are the actual watch list; state.lastCheckedAt is
    // read to decide isWatchDue on every change (including the one this
    // effect itself just made, which correctly short-circuits it above).
  }, [ready, online, favorites, history, state.lastCheckedAt]);

  const hits: RecallWatchHit[] = selectNewHits(
    state.lastResults,
    new Set(Object.keys(state.acknowledged)),
  );

  /**
   * Punkt 6: quittiert per Meldung+Barcode, not globally, and quittieren
   * never deletes anything — it only adds a key to the acknowledged set, so
   * a fresh notice for the same product (a different recallMatchKey) still
   * surfaces on its own.
   */
  const acknowledge = useCallback((barcode: string, match: RecallMatch) => {
    const key = recallMatchKey(barcode, match);
    setState((prev) => {
      const acknowledged = pruneAcknowledged({ ...prev.acknowledged, [key]: Date.now() });
      const next = { ...prev, acknowledged };
      persist(next);
      return next;
    });
  }, []);

  return { hits, acknowledge, ready };
}
