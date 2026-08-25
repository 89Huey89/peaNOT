"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const INSTALL_DISMISSED_KEY = "peanot.install-dismissed.v1";
const PREFS_KEY = "peanot.prefs.v1";
// Give the onboarding CTA (and the first scan) room before nagging about install.
const INSTALL_DELAY_MS = 4000;

// Befund 03: instead of an all-or-nothing "shown on every visit until
// dismissed" nag, the install banner (Android/Chrome prompt and iOS hint
// alike) is put on a "Wiedervorlage" schedule — it's only eligible to show
// up on specific visit counts, so a user who never explicitly dismisses it
// isn't nagged every single time they open the app.
const VISIT_COUNT_KEY = "peanot.install-hint-visits.v1";
// First re-shown on the 3rd visit (visits 1-2 are reserved for onboarding /
// getting comfortable with the app), then every 10th visit after that
// (13th, 23rd, 33rd, …) for as long as it keeps not being dismissed.
const FIRST_RESHOW_VISIT = 3;
const RESHOW_INTERVAL = 10;

// Befund 03: the banner auto-hides itself after this long so it doesn't sit
// on top of app content indefinitely. This is a soft, session-local hide —
// it does *not* touch INSTALL_DISMISSED_KEY, so the banner is still eligible
// to reappear on a later qualifying visit (see isEligibleVisit below).
const AUTO_HIDE_MS = 10_000;

function isEligibleVisit(visit: number): boolean {
  if (visit < FIRST_RESHOW_VISIT) return false;
  return (visit - FIRST_RESHOW_VISIT) % RESHOW_INTERVAL === 0;
}

/**
 * Bumps and persists the "app opened" counter used for the install-hint
 * Wiedervorlage schedule. Every mount of this component counts as one
 * visit — simple and easy to reason about for a single-user, mobile-only app.
 */
function bumpVisitCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(VISIT_COUNT_KEY);
    const previous = raw ? Number.parseInt(raw, 10) : 0;
    const next = (Number.isFinite(previous) ? previous : 0) + 1;
    window.localStorage.setItem(VISIT_COUNT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { onboarded?: boolean }).onboarded);
  } catch {
    return false;
  }
}

/** The slice of BeforeInstallPromptEvent we use (not in lib.dom yet). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isIosSafariStandaloneCandidate(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return isIos && isSafari && !standalone;
}

/**
 * Registers the runtime-caching service worker (production only) and surfaces
 * two unobtrusive PWA prompts:
 *  - an update banner when a new SW version is waiting, and
 *  - an install banner ("add to home screen"), with an iOS-Safari hint since
 *    iOS never fires `beforeinstallprompt`.
 *
 * Befund 03: both banners are fixed to the bottom of the screen, which is
 * exactly where the result overlay's allergen chips and action bar (and
 * other dialogs' content) live. So neither banner may render while a modal
 * dialog is open — see the `dialogOpen` MutationObserver effect below. The
 * install banner additionally only shows on specific "Wiedervorlage" visits
 * and auto-hides itself after a few seconds (see the constants above).
 */
export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [installEligible, setInstallEligible] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoHidden, setAutoHidden] = useState(false);
  const reloadOnControllerChange = useRef(false);

  // Befund 03 (1): a modal dialog (the result overlay, bottom sheets, the
  // allergy card — all of them render `role="dialog" aria-modal="true"`)
  // must never have a banner floating on top of it. We don't get app state
  // from here (this component is rendered in app/layout.tsx, above the page
  // tree), so instead we watch the DOM directly: a MutationObserver on
  // document.body notices whenever such a dialog is added/removed or has
  // its aria-modal attribute flipped, and we recompute on every mutation.
  // This is deliberately coarse (it doesn't diff *which* node changed) —
  // dialogs open/close rarely enough that re-querying the whole body on
  // each mutation is cheap, and coarse-but-correct beats a subtle miss here
  // since what's at stake is a safety-relevant allergen display.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasOpenDialog = () => !!document.querySelector('[role="dialog"][aria-modal="true"]');
    setDialogOpen(hasOpenDialog());

    if (typeof MutationObserver === "undefined") return; // defensive; real browsers/jsdom both have it
    const observer = new MutationObserver(() => setDialogOpen(hasOpenDialog()));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    return () => observer.disconnect();
  }, []);

  // Befund 03 (3): count this mount as one "visit" for the Wiedervorlage
  // schedule (see isEligibleVisit). Runs once, independent of onboarding —
  // it's just an open-count, not itself a nag.
  useEffect(() => {
    setVisitCount(bumpVisitCount());
  }, []);

  // Only surface the install banner once onboarding is done (it would
  // otherwise sit on top of the "Loslegen" CTA) and after a short delay so it
  // doesn't compete with the very first scan either. Onboarding can finish
  // mid-session without a reload, so poll storage until it does.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const armDelay = () => {
      delayTimer = setTimeout(() => setInstallEligible(true), INSTALL_DELAY_MS);
    };

    if (isOnboarded()) {
      armDelay();
    } else {
      poll = setInterval(() => {
        if (!isOnboarded()) return;
        if (poll) clearInterval(poll);
        armDelay();
      }, 1000);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (poll) clearInterval(poll);
    };
  }, []);

  // Service-worker registration + update detection (production only — in dev
  // the SW would cache and then serve stale Next assets).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const onControllerChange = () => {
      if (reloadOnControllerChange.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (cancelled) return;
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              // Only an *update* gets a prompt — the first install (no existing
              // controller) activates silently and shouldn't nag the user.
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                setWaiting(next);
              }
            });
          });
        })
        .catch(() => {
          /* registration failed (unsupported / blocked) — app still works online */
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // Install prompt: capture the browser event, or fall back to an iOS hint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
    setInstallDismissed(dismissed);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvt(null);
      setShowIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (!dismissed && isIosSafariStandaloneCandidate()) setShowIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    reloadOnControllerChange.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  }, [waiting]);

  const dismissInstall = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setInstallDismissed(true);
    setInstallEvt(null);
    setShowIosHint(false);
  }, []);

  const triggerInstall = useCallback(() => {
    const evt = installEvt;
    setInstallEvt(null);
    void evt?.prompt();
  }, [installEvt]);

  // Befund 03 (1+3): the install banner (either flavor) may only appear
  // while no modal dialog covers it, and only on a Wiedervorlage-eligible
  // visit. This does not include `autoHidden` on purpose — it's the "would
  // this banner be showing at all" condition the auto-hide timer below
  // keys off of.
  const installBannerEligible =
    !installDismissed && installEligible && isEligibleVisit(visitCount) && !dialogOpen;
  const showInstallEvtBanner = installBannerEligible && !!installEvt && !autoHidden;
  const showIosHintBanner = installBannerEligible && showIosHint && !autoHidden;

  // Befund 03 (2): auto-hide the install banner ~10s after it starts being
  // shown. This is intentionally separate from `dismissInstall` — it never
  // touches INSTALL_DISMISSED_KEY, so it's a soft, session-local hide, not
  // a permanent one. Keying the effect off `installBannerEligible &&
  // (installEvt || showIosHint)` (rather than the already-autoHidden-gated
  // booleans above) means: every time the banner has a fresh reason to
  // reappear — e.g. a dialog that was covering it just closed — the timer
  // restarts from a clean 10s, instead of staying stuck hidden from a
  // previous appearance.
  const installBannerShowable = installBannerEligible && (!!installEvt || showIosHint);
  useEffect(() => {
    if (!installBannerShowable) return;
    setAutoHidden(false);
    const timer = setTimeout(() => setAutoHidden(true), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [installBannerShowable]);

  // Befund 03 (4): the update banner is deliberately exempt from the
  // Wiedervorlage/auto-hide treatment above — a pending SW update is
  // actionable and important enough to show immediately and keep showing.
  // It *does* still defer while a modal dialog is open, though: it renders
  // in the exact same fixed bottom-of-screen slot as the install banner, so
  // showing it over the result overlay would reproduce the very same
  // "covers the allergen chips" problem Befund 03 is about. Deferring costs
  // nothing here — the waiting worker just keeps waiting quietly — and the
  // banner appears the instant the dialog closes.
  if (waiting && !dialogOpen) {
    return (
      <Banner
        message="Neue Version verfügbar."
        action={{ label: "Aktualisieren", onClick: applyUpdate }}
      />
    );
  }

  if (showInstallEvtBanner) {
    return (
      <Banner
        message="peaNOT zum Startbildschirm hinzufügen?"
        action={{ label: "Hinzufügen", onClick: triggerInstall }}
        onDismiss={dismissInstall}
      />
    );
  }

  if (showIosHintBanner) {
    return (
      <Banner
        message="Installieren: Teilen-Symbol → „Zum Home-Bildschirm“."
        onDismiss={dismissInstall}
      />
    );
  }

  return null;
}

function Banner({
  message,
  action,
  onDismiss,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className="pwa-banner"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(86px + env(safe-area-inset-bottom))",
        width: "min(440px, calc(100vw - 28px))",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderRadius: 14,
        background: "#16140f",
        color: "#f3ead8",
        boxShadow: "0 14px 40px -16px rgba(0,0,0,0.6)",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 13.5,
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.35 }}>{message}</span>
      {action ? (
        <button
          type="button"
          className="tap"
          onClick={action.onClick}
          style={{
            flexShrink: 0,
            background: "#d68a1a",
            color: "#16140f",
            border: 0,
            borderRadius: 99,
            padding: "7px 14px",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          className="tap"
          onClick={onDismiss}
          aria-label="Hinweis schließen"
          style={{
            flexShrink: 0,
            background: "transparent",
            color: "#f3ead8",
            border: 0,
            fontSize: 18,
            lineHeight: 1,
            padding: "4px 2px 4px 4px",
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: 0.7,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
