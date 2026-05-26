"use client";

import { useCallback, useRef, useState } from "react";
import type { ProductResult } from "@/lib/types";

interface LookupState {
  loading: boolean;
  result: ProductResult | null;
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

  const lookup = useCallback(async (
    barcode: string,
    allergens: string[] = [],
  ): Promise<ProductResult | null> => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const query = allergens.length
        ? `?a=${encodeURIComponent(allergens.join(","))}`
        : "";
      const res = await fetch(`/api/product/${encodeURIComponent(barcode)}${query}`);
      const data = (await res.json()) as ProductResult;
      if (requestId !== requestIdRef.current) return null;
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
