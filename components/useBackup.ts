"use client";

import { useCallback } from "react";
import type { HistoryEntry } from "@/components/useHistory";
import type { Prefs } from "@/components/usePrefs";
import { readAllPackMatch, writeAllPackMatch } from "@/lib/packmatch";
import { readAllNotes, writeAllNotes } from "@/lib/notes";
import { readFavoriteStore, writeFavoriteStore } from "@/lib/favorites";
import {
  buildExportPayload,
  mergeFavorites,
  mergeNotes,
  mergePackMatch,
  parseImportFile,
} from "@/lib/backup";

export type ImportOutcome =
  | {
      ok: true;
      historyCount: number;
      packmatchCount: number;
      notesCount: number;
      favoritesCount: number;
      /** Parsed but NOT applied — ProfileScreen only calls importPrefs after
       * an explicit user confirmation (see README's F1 section). */
      prefs: Partial<Prefs>;
    }
  | { ok: false; error: "invalid-json" | "unsupported-format" | "unsupported-version" };

/**
 * Wires the pure parse/merge helpers in lib/backup.ts to the app's actual
 * localStorage-backed stores (F1). History merges through useHistory's own
 * importEntries (it owns that store's React state); pack-match and notes
 * have no top-level React state, so they are read/merged/written directly
 * here. Favorites (F2) *do* have their own top-level React state
 * (components/useFavorites.ts) — unlike pack-match/notes — but that hook
 * doesn't need a prop threaded in here to stay in sync: lib/favorites.ts's
 * writeFavoriteStore persists through the exact same module useFavorites.ts
 * already subscribes to (subscribeFavorites), so a mounted instance picks up
 * an import immediately, the same way it already does for a live toggle.
 * Prefs are deliberately never written here — only after ProfileScreen gets
 * an explicit confirmation does it call usePrefs' own importPrefs.
 */
export function useBackup({
  history,
  importHistory,
  prefs,
}: {
  history: HistoryEntry[];
  importHistory: (entries: HistoryEntry[]) => void;
  prefs: Prefs;
}) {
  const exportData = useCallback(async () => {
    const payload = buildExportPayload({
      history,
      prefs,
      packmatch: readAllPackMatch(),
      notes: readAllNotes(),
      favorites: readFavoriteStore(),
    });
    const json = JSON.stringify(payload, null, 2);
    const filename = `peanot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], filename, { type: "application/json" });

    const canShareFile =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        // AbortError: the user dismissed the share sheet themselves — respect
        // that instead of surprising them with an automatic download.
        if (err instanceof Error && err.name === "AbortError") return;
        // Any other failure falls through to the direct-download fallback.
      }
    }

    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* no download surface available (rare) – nothing more we can do here */
    }
  }, [history, prefs]);

  const importData = useCallback(
    (raw: string): ImportOutcome => {
      const parsed = parseImportFile(raw);
      if (!parsed.ok) return parsed;
      const { data } = parsed;
      importHistory(data.history);
      writeAllPackMatch(mergePackMatch(readAllPackMatch(), data.packmatch));
      writeAllNotes(mergeNotes(readAllNotes(), data.notes));
      writeFavoriteStore(mergeFavorites(readFavoriteStore(), data.favorites));
      return {
        ok: true,
        historyCount: data.history.length,
        packmatchCount: Object.keys(data.packmatch).length,
        notesCount: Object.keys(data.notes).length,
        favoritesCount: Object.keys(data.favorites).length,
        prefs: data.prefs,
      };
    },
    [importHistory],
  );

  return { exportData, importData };
}
