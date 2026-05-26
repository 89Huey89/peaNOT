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

/** Builds the fail-safe KEINE_DATEN result used when the request itself fails. */
function networkErrorResult(barcode: string): ProductResult {
  return {
    barcode,
    productName: null,
    brand: null,
    status: "KEINE_DATEN",
    message:
      "Netzwerkfehler – deine Allergene können nicht ausgeschlossen werden.",
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
  ): Promise<ProductResult | null> => {
    const key = cacheKey(barcode, allergens);
    const cached = cache.get(key);
    if (cached) {
      // Serve instantly and make any in-flight request stale.
      requestIdRef.current++;
      abortRef.current?.abort();
      abortRef.current = null;
      setState({ loading: false, result: cached });
      return cached;
    }

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const query = allergens.length
        ? `?a=${encodeURIComponent(allergens.join(","))}`
        : "";
      const res = await fetch(`/api/product/${encodeURIComponent(barcode)}${query}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as ProductResult;
      if (requestId !== requestIdRef.current) return null;
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
