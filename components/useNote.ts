"use client";

import { useCallback, useEffect, useState } from "react";
import { readNoteEntry, writeNote, type StoredNote } from "@/lib/notes";

/**
 * The user's saved note for one barcode (F5) — kept in the browser
 * (localStorage) like the rest of peaNOT's state, exactly the pattern
 * usePackMatch already uses. Purely informational: nothing here is ever fed
 * into a verdict.
 */
export function useNote(barcode: string) {
  const [entry, setEntry] = useState<StoredNote | null>(null);

  // Read after mount: localStorage is not available during server rendering.
  useEffect(() => {
    setEntry(readNoteEntry(barcode));
  }, [barcode]);

  const saveNote = useCallback(
    (text: string) => {
      setEntry(writeNote(barcode, text));
    },
    [barcode],
  );

  return { note: entry?.text ?? null, notedAt: entry?.ts ?? null, saveNote };
}
