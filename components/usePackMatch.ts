"use client";

import { useCallback, useEffect, useState } from "react";
import { readPackMatch, writePackMatch, type PackMatch } from "@/lib/packmatch";

/**
 * The user's remembered answer to the pack comparison for one barcode, kept in
 * the browser (localStorage) like the rest of peaNOT's state. Scanning the same
 * code again picks the answer back up, so a known mismatch warns immediately.
 */
export function usePackMatch(barcode: string) {
  const [answer, setAnswer] = useState<PackMatch | null>(null);

  // Read after mount: localStorage is not available during server rendering.
  useEffect(() => {
    setAnswer(readPackMatch(barcode));
  }, [barcode]);

  const answerPackMatch = useCallback(
    (value: PackMatch | null) => {
      writePackMatch(barcode, value);
      setAnswer(value);
    },
    [barcode],
  );

  return { answer, answerPackMatch };
}
