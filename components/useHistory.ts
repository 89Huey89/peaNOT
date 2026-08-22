"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductResult } from "@/lib/types";
import { resolveVerdict, type Verdict } from "@/lib/verdict";
import { applyPackMatch, readPackMatch } from "@/lib/packmatch";
import { mergeHistory, sanitizeHistory } from "@/lib/backup";

const STORAGE_KEY = "peanot.history.v1";
const MAX_ENTRIES = 200;

export interface HistoryEntry {
  id: string;
  /** Epoch milliseconds of the scan. */
  ts: number;
  barcode: string;
  name: string;
  brand: string;
  verdict: Verdict;
  /**
   * F (part 2): who this result was checked for, captured at record() time.
   * Both id AND name are stored — never just the id — because a person can
   * later be renamed or removed (lib/persons.ts's renamePerson/removePerson),
   * and an old row must still be able to say *whose* verdict it was even
   * then, rather than pointing at a name that changed or an id that no
   * longer resolves to anyone. So `personName` is the source of truth for
   * display, always, never re-derived by looking the id up in the current
   * persons list.
   *
   * Optional because every entry written before this feature existed has
   * neither field. Those entries were only ever created while the app had
   * exactly one person (there was no other kind of history yet) — so a
   * missing personId is read (never rewritten in place — see
   * resolvedHistoryPersonId/resolvedHistoryPersonName below) as belonging to
   * whoever was that one person, not as "nobody" or "unknown".
   */
  personId?: string;
  personName?: string;
}

/**
 * Resolves which person `entry` belongs to for matching/dedup purposes,
 * filling in the one case that predates this feature: an entry with no
 * personId at all. Such an entry can only have been written while the
 * household had exactly one person (see the HistoryEntry field comment), so
 * it is attributed to `firstPersonId` — which every caller derives as
 * `prefs.persons[0]?.id`, the longest-standing entry in that array (it only
 * ever grows by appending — see lib/persons.ts's addPersonToState — so
 * persons[0] is always whoever was the household's *only* person for as long
 * as any personId-less row could exist).
 *
 * This is a best-effort convention, not a certainty: if that original person
 * was later removed and two entirely new people took their place, an old row
 * would end up attributed to whichever of them now happens to sit at
 * persons[0]. There is no way to recover the true original identity at that
 * point — this is still the least-wrong assumption available, and it never
 * invents a third, unlisted "unknown person" that would need its own display
 * handling everywhere.
 */
export function resolvedHistoryPersonId(entry: HistoryEntry, firstPersonId: string): string {
  return entry.personId ?? firstPersonId;
}

/** Display-name counterpart to resolvedHistoryPersonId — see its comment for
 * the missing-personId convention. `firstPersonName` is that same
 * `persons[0]` person's *current* name (unlike a modern entry's own
 * `personName`, a personId-less entry never captured a name of its own to
 * freeze, so the best available information is the name that person
 * currently has). */
export function resolvedHistoryPersonName(entry: HistoryEntry, firstPersonName: string): string {
  return entry.personId !== undefined ? (entry.personName ?? entry.personId) : firstPersonName;
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Befund 02: the old `Array.isArray(parsed) ? parsed : []` trusted every
    // element's shape completely. One row with a verdict string VERDICT
    // (lib/verdict.ts) doesn't know, a missing field, or a non-object
    // element was enough for verdictColor() to throw "Cannot read
    // properties of undefined (reading 'colorKey')" on every render — a
    // white screen on every single launch, since the bad value never left
    // localStorage. sanitizeHistory (lib/backup.ts, shared with the F1
    // import path) drops only the malformed row(s); everything else in the
    // array survives untouched.
    return sanitizeHistory(parsed);
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable – keep in-memory only */
  }
}

/**
 * Resolve a lookup result to the verdict shown in the history list — folds in
 * any remembered pack-match answer, exactly like the result screen. Exported
 * so a caller that needs "the verdict this result is about to be recorded
 * as" *before* record() runs (the worsening-vs-history check in app/page.tsx)
 * uses the identical resolution instead of a second, drifting copy of it.
 */
export function resolveHistoryVerdict(result: ProductResult): Verdict {
  const resolved = applyPackMatch(
    result.status,
    result.caveats ?? [],
    readPackMatch(result.barcode),
  );
  return resolveVerdict(resolved.status, resolved.caveats);
}

function toEntry(
  result: ProductResult,
  ts: number,
  person: { id: string; name: string },
): HistoryEntry {
  return {
    // F (part 2): the person id is folded into the id itself, not only
    // into `ts`+`barcode` as before — two different people can now each
    // have their own row for the very same barcode recorded in the very
    // same millisecond (e.g. Anna and Ben each rechecking a shared staple
    // back-to-back), and remove()/restore() key off this `id` alone. Without
    // this, such a pair would collide on one shared id, and removing "the"
    // row could silently target the wrong person's entry.
    id: `h_${ts}_${result.barcode}_${person.id}`,
    ts,
    barcode: result.barcode,
    name: result.productName ?? "Unbekanntes Produkt",
    brand: result.brand ?? "—",
    verdict: resolveHistoryVerdict(result),
    personId: person.id,
    personName: person.name,
  };
}

/**
 * Collapse a newest-first list to at most one row per (barcode, person),
 * keeping whichever occurrence comes first (i.e. the newest, since every
 * caller passes an already newest-first — sorted by ts descending — list).
 *
 * Befund 06: the history is a product list, not an event log — a barcode
 * should appear once, wherever it currently sits, not once per scan. F (part
 * 2) narrows the identity from "barcode" to "barcode, checked for this
 * person": Ben rechecking a staple must not make Anna's row for the same
 * barcode vanish. Two entries with no personId at all (both predating this
 * feature) still collapse into one another here, exactly as barcode-only
 * dedup already did — this function has no "current active person" to
 * resolve a missing personId against (see resolvedHistoryPersonId), so it
 * compares the stored field literally rather than guessing; record() below
 * is the one place that *does* have that context, and only it needs to
 * reconcile a personId-less legacy row against a freshly-identified scan.
 * Shared by restore() and importEntries() below; record() enforces its own
 * version of this rule inline (see its own comment) since it already knows
 * the new entry is the newest by construction.
 */
function dedupeNewestPerBarcode(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.barcode}::${entry.personId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Scan history persisted to the browser (localStorage) — no account, no
 * server. Survives reloads on the same device.
 */
export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHistory(load());
    setReady(true);
  }, []);

  /**
   * `person` is the actively-checking person (app/page.tsx passes
   * getActivePerson(prefs) — see lib/persons.ts). `firstPersonId` is
   * `prefs.persons[0]?.id`, needed only to resolve a pre-existing entry that
   * has no personId at all (see resolvedHistoryPersonId's comment) — it is
   * NOT necessarily who is active now, just who *was* the household's only
   * person for as long as such a row could have been written.
   */
  const record = useCallback(
    (result: ProductResult, person: { id: string; name: string }, firstPersonId: string) => {
      const entry = toEntry(result, Date.now(), person);
      setHistory((prev) => {
        // Befund 06: collapse a repeat scan of this barcode wherever it sits
        // in the list, not only when it happens to be the very last scan.
        // Checking the whole list (not just prev[0]) matters for exactly the
        // scenario the finding describes: checking five familiar products in
        // a row before a shopping trip used to create five new rows apiece
        // every single time, so at a 200-entry cap the weekly favorites
        // pass eventually pushes out the rarely-scanned products whose
        // verdict you actually needed the history for.
        //
        // F (part 2): a repeat scan only replaces a *prior row for the same
        // person* now — Ben checking a barcode Anna already checked must add
        // his own row alongside hers, never overwrite it (that would erase
        // her result, which is exactly the ambiguity this feature exists to
        // remove). A pre-existing row with no personId at all is resolved
        // via resolvedHistoryPersonId/firstPersonId — this is the one spot
        // in this file that *does* know the current active person, so it is
        // also the one spot that can safely bridge a personId-less legacy
        // row into "does this belong to whoever is scanning right now".
        const deduped = prev.filter(
          (e) => !(e.barcode === entry.barcode && resolvedHistoryPersonId(e, firstPersonId) === person.id),
        );
        const next = [entry, ...deduped].slice(0, MAX_ENTRIES);
        persist(next);
        return next;
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persist(next);
      return next;
    });
  }, []);

  /**
   * Re-insert a previously removed entry, preserving its original `ts`/`id`
   * — the undo path for `remove` (HistoryScreen keeps the removed entry in
   * component state for a few seconds and calls this if "Rückgängig" is
   * tapped). Re-sorts by ts so it lands back in its original position rather
   * than jumping to the top.
   */
  const restore = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev;
      // Befund 06: apply the same barcode-is-the-identity rule as record().
      // Undo is held in HistoryScreen's own component state for a few
      // seconds after a remove, during which a fresh scan of that very
      // barcode could land and add a new row — restoring the old row on
      // top of that must not produce two rows for one barcode. Sorting the
      // combined list newest-first before deduping means whichever of the
      // two actually has the newer `ts` wins; the older one is dropped.
      const merged = [...prev, entry].sort((a, b) => b.ts - a.ts);
      const next = dedupeNewestPerBarcode(merged).slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  /**
   * Fold an imported history (F1) into the current one — de-duplicated by
   * id/barcode+ts, newest wins, capped at MAX_ENTRIES exactly like a live
   * scan (see lib/backup.ts's mergeHistory). Used only by the "Daten
   * importieren" flow in ProfileScreen.
   */
  const importEntries = useCallback((entries: HistoryEntry[]) => {
    setHistory((prev) => {
      // mergeHistory (lib/backup.ts) dedupes by id, falling back to
      // barcode+ts — it doesn't know about Befund 06's barcode-is-the-
      // identity rule, since it's the same merge used for prefs/notes-style
      // imports that have no such rule. An imported file can still contain
      // two rows for one barcode (two scan times from another device, or
      // one on each side of the merge with different ids), so a second
      // pass here collapses those to one row too, exactly like a live
      // scan would. maxEntries is left uncapped for the merge itself so a
      // pair that *would* dedupe away isn't lost to truncation before this
      // pass gets to run; the real MAX_ENTRIES cap is applied after.
      const merged = mergeHistory(prev, entries, Number.POSITIVE_INFINITY);
      const next = dedupeNewestPerBarcode(merged).slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  return { history, record, clear, remove, restore, importEntries, ready };
}
