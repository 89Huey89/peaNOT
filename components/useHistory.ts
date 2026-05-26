"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductResult } from "@/lib/types";
import { statusToVerdict, type Verdict } from "@/lib/verdict";

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

function toEntry(result: ProductResult, ts: number): HistoryEntry {
  return {
    id: `h_${ts}_${result.barcode}`,
    ts,
    barcode: result.barcode,
    name: result.productName ?? "Unbekanntes Produkt",
    brand: result.brand ?? "—",
    verdict: statusToVerdict(result.status),
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

  const clear = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  return { history, record, clear, ready };
}
