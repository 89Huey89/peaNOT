"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readPackMatchEntry,
  writePackMatch,
  type PackMatch,
  type StoredAnswer,
} from "@/lib/packmatch";

/**
 * The user's remembered answer to the pack comparison for one barcode, kept in
 * the browser (localStorage) like the rest of peaNOT's state. Scanning the same
 * code again picks the answer back up, so a known mismatch warns immediately.
 * A "match" answer that has aged out (see lib/packmatch.ts) comes back as
 * null here too, so the identity question is asked again.
 */
export function usePackMatch(barcode: string) {
  const [entry, setEntry] = useState<StoredAnswer | null>(null);

  // Read after mount: localStorage is not available during server rendering.
  useEffect(() => {
    setEntry(readPackMatchEntry(barcode));
  }, [barcode]);

  const answerPackMatch = useCallback(
    (value: PackMatch | null) => {
      writePackMatch(barcode, value);
      setEntry(value === null ? null : { value, ts: Date.now() });
    },
    [barcode],
  );

  return { answer: entry?.value ?? null, answeredAt: entry?.ts ?? null, answerPackMatch };
}
