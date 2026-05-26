"use client";

import { useEffect } from "react";

/**
 * Registers the runtime-caching service worker so peaNOT is installable and
 * works offline. Only active in production — registering in dev would cache
 * (and then serve stale) the Next dev assets.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failed (unsupported / blocked) — app still works online */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
