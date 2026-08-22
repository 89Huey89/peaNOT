"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductResult } from "@/lib/types";
import { resolveVerdict, type Verdict } from "@/lib/verdict";
import { applyPackMatch, readPackMatch } from "@/lib/packmatch";
import { mergeHistory, sanitizeHistory } from "@/lib/backup";

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
    // Befund 02: the old `Array.isArray(parsed) ? parsed : []` trusted every
    // element's shape completely. One row with a verdict string VERDICT
    // (lib/verdict.ts) doesn't know, a missing field, or a non-object
    // element was enough for verdictColor() to throw "Cannot read
    // properties of undefined (reading 'colorKey')" on every render — a
    // white screen on every single launch, since the bad value never left
    // localStorage. sanitizeHistory (lib/backup.ts, shared with the F1
    // import path) drops only the malformed row(s); everything else in the
    // array survives untouched.
    return sanitizeHistory(parsed);
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
 * Collapse a newest-first list to at most one row per barcode, keeping
 * whichever occurrence comes first (i.e. the newest, since every caller
 * passes an already newest-first — sorted by ts descending — list).
 *
 * Befund 06: the history is a product list, not an event log — a barcode
 * should appear once, wherever it currently sits, not once per scan.
 * Shared by restore() and importEntries() below; record() enforces the
 * same rule inline (see its own comment) since it already knows the new
 * entry is the newest by construction.
 */
function dedupeNewestPerBarcode(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.barcode)) continue;
    seen.add(entry.barcode);
    out.push(entry);
  }
  return out;
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
      // Befund 06: collapse a repeat scan of this barcode wherever it sits
      // in the list, not only when it happens to be the very last scan.
      // Checking the whole list (not just prev[0]) matters for exactly the
      // scenario the finding describes: checking five familiar products in
      // a row before a shopping trip used to create five new rows apiece
      // every single time, so at a 200-entry cap the weekly favorites
      // pass eventually pushes out the rarely-scanned products whose
      // verdict you actually needed the history for.
      const deduped = prev.filter((e) => e.barcode !== entry.barcode);
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
      // Befund 06: apply the same barcode-is-the-identity rule as record().
      // Undo is held in HistoryScreen's own component state for a few
      // seconds after a remove, during which a fresh scan of that very
      // barcode could land and add a new row — restoring the old row on
      // top of that must not produce two rows for one barcode. Sorting the
      // combined list newest-first before deduping means whichever of the
      // two actually has the newer `ts` wins; the older one is dropped.
      const merged = [...prev, entry].sort((a, b) => b.ts - a.ts);
      const next = dedupeNewestPerBarcode(merged).slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  /**
   * Fold an imported history (F1) into the current one — de-duplicated by
   * id/barcode+ts, newest wins, capped at MAX_ENTRIES exactly like a live
   * scan (see lib/backup.ts's mergeHistory). Used only by the "Daten
   * importieren" flow in ProfileScreen.
   */
  const importEntries = useCallback((entries: HistoryEntry[]) => {
    setHistory((prev) => {
      // mergeHistory (lib/backup.ts) dedupes by id, falling back to
      // barcode+ts — it doesn't know about Befund 06's barcode-is-the-
      // identity rule, since it's the same merge used for prefs/notes-style
      // imports that have no such rule. An imported file can still contain
      // two rows for one barcode (two scan times from another device, or
      // one on each side of the merge with different ids), so a second
      // pass here collapses those to one row too, exactly like a live
      // scan would. maxEntries is left uncapped for the merge itself so a
      // pair that *would* dedupe away isn't lost to truncation before this
      // pass gets to run; the real MAX_ENTRIES cap is applied after.
      const merged = mergeHistory(prev, entries, Number.POSITIVE_INFINITY);
      const next = dedupeNewestPerBarcode(merged).slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  return { history, record, clear, remove, restore, importEntries, ready };
}
