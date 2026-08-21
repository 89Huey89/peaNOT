"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductResult } from "@/lib/types";
import { resolveVerdict, type Verdict } from "@/lib/verdict";
import { applyPackMatch, readPackMatch } from "@/lib/packmatch";

const STORAGE_KEY = "peanot.history.v1";
const MAX_ENTRIES = 200;

export interface HistoryEntry {
  id: string;
  /** Epoch milliseconds of the scan. */
  ts: number;
  barcode: string;
  name: string;
  brand: string;
  verdict: Verdict;
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable – keep in-memory only */
  }
}

/**
 * Resolve a lookup result to the verdict shown in the history list — folds in
 * any remembered pack-match answer, exactly like the result screen. Exported
 * so a caller that needs "the verdict this result is about to be recorded
 * as" *before* record() runs (the worsening-vs-history check in app/page.tsx)
 * uses the identical resolution instead of a second, drifting copy of it.
 */
export function resolveHistoryVerdict(result: ProductResult): Verdict {
  const resolved = applyPackMatch(
    result.status,
    result.caveats ?? [],
    readPackMatch(result.barcode),
  );
  return resolveVerdict(resolved.status, resolved.caveats);
}

function toEntry(result: ProductResult, ts: number): HistoryEntry {
  return {
    id: `h_${ts}_${result.barcode}`,
    ts,
    barcode: result.barcode,
    name: result.productName ?? "Unbekanntes Produkt",
    brand: result.brand ?? "—",
    verdict: resolveHistoryVerdict(result),
  };
}

/**
 * Scan history persisted to the browser (localStorage) — no account, no
 * server. Survives reloads on the same device.
 */
export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHistory(load());
    setReady(true);
  }, []);

  const record = useCallback((result: ProductResult) => {
    const entry = toEntry(result, Date.now());
    setHistory((prev) => {
      // Collapse a repeat scan of the same barcode at the top into one row.
      const deduped =
        prev[0]?.barcode === entry.barcode ? prev.slice(1) : prev;
      const next = [entry, ...deduped].slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persist(next);
      return next;
    });
  }, []);

  /**
   * Re-insert a previously removed entry, preserving its original `ts`/`id`
   * — the undo path for `remove` (HistoryScreen keeps the removed entry in
   * component state for a few seconds and calls this if "Rückgängig" is
   * tapped). Re-sorts by ts so it lands back in its original position rather
   * than jumping to the top.
   */
  const restore = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev;
      const next = [...prev, entry].sort((a, b) => b.ts - a.ts).slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  return { history, record, clear, remove, restore, ready };
}
