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
      "Netzwerkfehler – Erdnuss kann nicht ausgeschlossen werden.",
  };
}

export function useProductLookup() {
  const [state, setState] = useState<LookupState>({ loading: false, result: null });
  const requestIdRef = useRef(0);

  const lookup = useCallback(async (barcode: string) => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/product/${encodeURIComponent(barcode)}`);
      const data = (await res.json()) as ProductResult;
      if (requestId !== requestIdRef.current) return;
      setState({ loading: false, result: data });
    } catch {
      if (requestId !== requestIdRef.current) return;
      setState({ loading: false, result: networkErrorResult(barcode) });
    }
  }, []);

  return { ...state, lookup };
}
