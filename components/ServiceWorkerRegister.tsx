"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INSTALL_DISMISSED_KEY = "peanot.install-dismissed.v1";

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
 */
export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);
  const reloadOnControllerChange = useRef(false);

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

  if (waiting) {
    return (
      <Banner
        message="Neue Version verfügbar."
        action={{ label: "Aktualisieren", onClick: applyUpdate }}
      />
    );
  }

  if (!installDismissed && installEvt) {
    return (
      <Banner
        message="peaNOT zum Startbildschirm hinzufügen?"
        action={{ label: "Hinzufügen", onClick: triggerInstall }}
        onDismiss={dismissInstall}
      />
    );
  }

  if (!installDismissed && showIosHint) {
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
          ✕
        </button>
      ) : null}
    </div>
  );
}
