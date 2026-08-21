"use client";

import { useEffect, useRef } from "react";

// Module-level LIFO stack: every currently-open overlay that opted into
// browser-history integration (UX9) registers its own close handler here.
// The app's overlays are always strictly stack-shaped (e.g. the fullscreen
// allergy card sits *inside* the karte screen, never beside it), so on a
// single popstate — the iPhone edge-swipe/back gesture — closing whatever
// was pushed most recently is always the right thing, without needing a
// full router or per-route path matching.
const stack: Array<() => void> = [];
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
    top?.();
  });
}

/**
 * Keeps the iPhone edge-swipe-back gesture from leaving the app whenever an
 * overlay is open (UX9: result / Allergie-Karte / fullscreen card). While
 * `open` is true, one history entry is pushed and popstate is mapped to
 * `onClose`; closing by any other means (✕ button, Escape) pops that same
 * entry again so the back-stack doesn't grow across a shopping session.
 */
export function useHistoryOverlay(open: boolean, onClose: () => void): void {
  const pushedRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ensureListener();
    // Guard against double-push: only push once per open->close cycle even
    // if this effect were to re-run while already open.
    if (pushedRef.current) return;
    window.history.pushState({ peanotOverlay: true }, "");
    pushedRef.current = true;
    const entry = () => closeRef.current();
    stack.push(entry);
    return () => {
      pushedRef.current = false;
      const idx = stack.lastIndexOf(entry);
      if (idx === -1) {
        // Already popped by the popstate listener above — nothing left to
        // undo, the browser is already one step back.
        return;
      }
      // Closed via UI, not the back gesture: remove our entry and step the
      // browser back to match, without letting that trigger a second close.
      stack.splice(idx, 1);
      suppressNextPop += 1;
      window.history.back();
    };
  }, [open]);
}
