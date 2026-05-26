"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductSearchResult } from "@/lib/types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface SearchState {
  searching: boolean;
  results: ProductSearchResult[];
  /** The query that produced the current results (trimmed). */
  query: string;
}

/**
 * Debounced product name search against /api/search. Race-safe: stale
 * responses are dropped via a request id, mirroring useProductLookup. Never
 * throws — request failures resolve to an empty result list.
 */
export function useProductSearch() {
  const [state, setState] = useState<SearchState>({
    searching: false,
    results: [],
    query: "",
  });
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Invalidate and abort any in-flight request once the component unmounts.
      requestIdRef.current++;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (query: string) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, searching: true, query }));
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as { results?: ProductSearchResult[] };
      if (requestId !== requestIdRef.current) return;
      setState({ searching: false, results: data.results ?? [], query });
    } catch {
      if (requestId !== requestIdRef.current) return;
      setState({ searching: false, results: [], query });
    }
  }, []);

  const search = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (timerRef.current) clearTimeout(timerRef.current);

      if (query.length < MIN_QUERY_LENGTH) {
        // Cancel any pending/in-flight request and clear results immediately.
        requestIdRef.current++;
        abortRef.current?.abort();
        setState({ searching: false, results: [], query });
        return;
      }

      setState((prev) => ({ ...prev, searching: true, query }));
      timerRef.current = setTimeout(() => run(query), DEBOUNCE_MS);
    },
    [run],
  );

  return { ...state, search };
}
