"use client";

import { useEffect, useRef } from "react";

// Module-level LIFO stack: every currently-open overlay that opted into
// browser-history integration (UX9) registers its own close handler here.
// The app's overlays are always strictly stack-shaped (e.g. the fullscreen
// allergy card sits *inside* the karte screen, never beside it), so on a
// single popstate — the iPhone edge-swipe/back gesture — closing whatever
// was pushed most recently is always the right thing, without needing a
// full router or per-route path matching.
//
// `restoreUrl` (Befund 09) is set only for overlays that opted into the
// `screen` URL mirror (see the hook below) — it's the address the bar
// should show once this entry is popped, i.e. whatever it displayed right
// before this overlay pushed its own `?screen=` entry. It's `undefined` for
// overlays that don't map to the URL at all (the result dialog), in which
// case popping never touches the address bar.
type StackEntry = { close: () => void; restoreUrl?: string };
const stack: StackEntry[] = [];
// Set right before *we* call history.back() to undo our own pushState (a
// UI-driven close, e.g. tapping "Schließen") — swallows the resulting
// popstate so the shared listener below doesn't also pop the next overlay
// down, which would close two levels for one user action.
let suppressNextPop = 0;
let listenerAttached = false;

function ensureListener() {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;
  window.addEventListener("popstate", () => {
    if (suppressNextPop > 0) {
      suppressNextPop -= 1;
      return;
    }
    // Guard: nothing on the stack means this popstate landed on the base
    // state (or one we never pushed) — never invent a close from that, it
    // just lets the gesture do whatever it would normally do.
    const top = stack.pop();
    if (!top) return;
    // A *real* edge-swipe has already handed the address bar back to the
    // previous entry's URL by the time popstate fires — this replaceState
    // is then a harmless no-op restating the same value. But popstate can
    // also arrive without any real navigation ever having happened (tests
    // dispatch it directly to simulate the gesture), so we restore it
    // explicitly here rather than trusting that the browser already did.
    if (top.restoreUrl !== undefined) {
      window.history.replaceState(null, "", top.restoreUrl);
    }
    top.close();
  });
}

/**
 * Keeps the iPhone edge-swipe-back gesture from leaving the app whenever an
 * overlay is open (UX9: result / Allergie-Karte / fullscreen card). While
 * `open` is true, one history entry is pushed and popstate is mapped to
 * `onClose`; closing by any other means (✕ button, Escape) pops that same
 * entry again so the back-stack doesn't grow across a shopping session.
 *
 * `screen` (Befund 09) is an optional, purely additive URL mirror: when
 * given, the pushed entry's URL becomes `?screen=<screen>` (e.g. `karte` /
 * `notfall`), so a shared/deep link can point at that overlay and reloading
 * while it's open doesn't lose the "what is this page" signal from the
 * address bar. On close (either path below) the address bar is put back to
 * whatever it showed the moment this overlay opened — normally the tab it
 * was opened from, which page.tsx keeps in sync via its own replaceState on
 * every tab switch. Callers that don't pass `screen` (the result dialog —
 * Befund 09 explicitly excludes it, see app/page.tsx) keep the exact old
 * behavior: pushState with no url argument, i.e. the address bar never
 * moves and nothing is restored on close.
 */
export function useHistoryOverlay(open: boolean, onClose: () => void, screen?: string): void {
  const pushedRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ensureListener();
    // Guard against double-push: only push once per open->close cycle even
    // if this effect were to re-run while already open.
    if (pushedRef.current) return;
    // Capture *before* pushing: whatever the address bar shows right now is
    // what closing this overlay should put back. Only overlays that mirror
    // themselves into the URL need this — the result dialog (no `screen`)
    // never touches the address bar in the first place.
    const restoreUrl =
      screen !== undefined ? window.location.pathname + window.location.search : undefined;
    window.history.pushState(
      { peanotOverlay: true },
      "",
      screen !== undefined ? `?screen=${screen}` : undefined,
    );
    pushedRef.current = true;
    const entry: StackEntry = { close: () => closeRef.current(), restoreUrl };
    stack.push(entry);
    return () => {
      pushedRef.current = false;
      const idx = stack.lastIndexOf(entry);
      if (idx === -1) {
        // Already popped by the popstate listener above — it already
        // restored the URL too, nothing left to undo.
        return;
      }
      // Closed via UI, not the back gesture: remove our entry, put the
      // address bar back first (see the module comment on restoreUrl for
      // why this can't just wait on history.back() to do it), then step
      // the browser back to match without letting that trigger a second
      // close.
      stack.splice(idx, 1);
      if (restoreUrl !== undefined) {
        window.history.replaceState(null, "", restoreUrl);
      }
      suppressNextPop += 1;
      window.history.back();
    };
    // screen is always a literal per call site (never changes across
    // re-renders in practice), but it's listed here anyway so the effect
    // stays honest about what it reads.
  }, [open, screen]);
}
