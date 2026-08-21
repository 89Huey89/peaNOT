"use client";

import { useCallback, useEffect, useState } from "react";
import type { Verdict } from "@/lib/verdict";
import {
  readAllFavorites,
  recordFavoriteCheck,
  toggleFavorite as toggleFavoriteStore,
  type FavoriteEntry,
} from "@/lib/favorites";

/**
 * Starred "staple" products (F2), persisted to the browser (localStorage) —
 * lifted to app/page.tsx like useHistory, because it's read from both the
 * Favoriten strip (ScanScreen) and the star toggle (ResultScreen, History-
 * Screen) at once and a toggle in one must be visible in the other
 * immediately, without a reload.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(readAllFavorites());
    setReady(true);
  }, []);

  const toggleFavorite = useCallback(
    (entry: { barcode: string; name: string; brand: string; verdict: Verdict; ts: number }) => {
      toggleFavoriteStore(entry.barcode, entry);
      setFavorites(readAllFavorites());
    },
    [],
  );

  /** Refresh a favorited barcode's verdict/ts after any fresh lookup —
   * lib/favorites.ts's recordFavoriteCheck is already a no-op when the
   * barcode isn't favorited, so this only re-reads (and re-renders) when it
   * actually changed something. */
  const recordCheck = useCallback((barcode: string, verdict: Verdict, ts: number) => {
    recordFavoriteCheck(barcode, verdict, ts);
    setFavorites((prev) => (prev.some((f) => f.barcode === barcode) ? readAllFavorites() : prev));
  }, []);

  return { favorites, ready, toggleFavorite, recordCheck };
}
