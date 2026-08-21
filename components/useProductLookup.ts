"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductResult } from "@/lib/types";

interface LookupState {
  loading: boolean;
  result: ProductResult | null;
}

const MAX_CACHE_ENTRIES = 100;

// Session cache (in-memory, cleared on reload). Only definitive data hits are
// stored, so a transient KEINE_DATEN / network error stays retryable. Keyed by
// barcode + selected allergens, since the allergen set changes the verdict.
const cache = new Map<string, ProductResult>();

function cacheKey(barcode: string, allergens: string[]): string {
  return `${barcode}|${[...allergens].sort().join(",")}`;
}

function setCache(key: string, value: ProductResult): void {
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Test-only: drop all cached lookups so module state doesn't leak between tests. */
export function __clearProductLookupCache(): void {
  cache.clear();
}

/**
 * Builds the fail-safe KEINE_DATEN result used when the request itself fails
 * (offline with nothing cached by the service worker, aborted, etc.).
 * `networkError` marks this as the client-side fallback — distinct from a
 * server-reported KEINE_DATEN — so the UI can offer the last known verdict
 * as supplementary info instead of presenting this as a fresh check.
 */
function networkErrorResult(barcode: string): ProductResult {
  return {
    barcode,
    productName: null,
    brand: null,
    status: "KEINE_DATEN",
    message:
      "Netzwerkfehler – deine Allergene können nicht ausgeschlossen werden.",
    networkError: true,
  };
}

export function useProductLookup() {
  const [state, setState] = useState<LookupState>({ loading: false, result: null });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      requestIdRef.current++;
      abortRef.current?.abort();
    };
  }, []);

  const lookup = useCallback(async (
    barcode: string,
    allergens: string[] = [],
    opts: { fresh?: boolean } = {},
  ): Promise<ProductResult | null> => {
    const key = cacheKey(barcode, allergens);
    // A fresh request (manual "Erneut prüfen") bypasses this session cache
    // too — it exists to skip the OFF round-trip, not to shadow a check the
    // user explicitly asked to redo.
    if (!opts.fresh) {
      const cached = cache.get(key);
      if (cached) {
        // Serve instantly and make any in-flight request stale.
        requestIdRef.current++;
        abortRef.current?.abort();
        abortRef.current = null;
        setState({ loading: false, result: cached });
        return cached;
      }
    }

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const params = new URLSearchParams();
      if (allergens.length) params.set("a", allergens.join(","));
      if (opts.fresh) params.set("fresh", "1");
      const query = params.toString();
      const res = await fetch(
        `/api/product/${encodeURIComponent(barcode)}${query ? `?${query}` : ""}`,
        {
          signal: controller.signal,
          ...(opts.fresh ? { cache: "no-store" as RequestCache } : {}),
        },
      );
      const data = (await res.json()) as ProductResult;
      if (requestId !== requestIdRef.current) return null;
      // Cache honesty: the service worker stamps an offline cache hit with
      // these headers (public/sw.js) so the result never looks like a fresh
      // check. `res.headers` can be absent in tests that mock a bare object.
      if (res.headers?.get?.("X-Peanot-Cache") === "1") {
        data.cachedAt = res.headers.get("X-Peanot-Cached-At") ?? undefined;
      }
      if (data.status === "JA" || data.status === "SPUREN" || data.status === "NEIN") {
        setCache(key, data);
      }
      setState({ loading: false, result: data });
      return data;
    } catch {
      if (requestId !== requestIdRef.current) return null;
      const fallback = networkErrorResult(barcode);
      setState({ loading: false, result: fallback });
      return fallback;
    }
  }, []);

  return { ...state, lookup };
}
