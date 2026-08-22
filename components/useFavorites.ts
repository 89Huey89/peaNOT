"use client";

import { useCallback, useEffect, useState } from "react";
import type { Verdict } from "@/lib/verdict";
import {
  readAllFavorites,
  recordFavoriteCheck,
  subscribeFavorites,
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
    // subscribeFavorites (lib/favorites.ts) fires on *every* write to the
    // store — a toggle and a recheck below included, not only an external
    // one — so this single subscription is now the only place favorites
    // state gets refreshed; toggleFavorite/recordCheck just call the plain
    // store functions and let this listener pick up the result. That's what
    // makes an F1 import land here too: components/useBackup.ts writes an
    // imported/merged store directly into lib/favorites.ts (writeFavoriteStore),
    // bypassing this hook's setters entirely — without this subscription
    // that write would sit invisibly in localStorage until the next reload.
    return subscribeFavorites(() => setFavorites(readAllFavorites()));
  }, []);

  const toggleFavorite = useCallback(
    (entry: { barcode: string; name: string; brand: string; verdict: Verdict; ts: number }) => {
      toggleFavoriteStore(entry.barcode, entry);
    },
    [],
  );

  /** Refresh a favorited barcode's verdict/ts after any fresh lookup.
   * lib/favorites.ts's recordFavoriteCheck is a no-op (no persist(), so no
   * notifyFavoritesChanged() either) when the barcode isn't favorited, so
   * the subscription above only re-renders when this actually changed
   * something. */
  const recordCheck = useCallback((barcode: string, verdict: Verdict, ts: number) => {
    recordFavoriteCheck(barcode, verdict, ts);
  }, []);

  return { favorites, ready, toggleFavorite, recordCheck };
}
