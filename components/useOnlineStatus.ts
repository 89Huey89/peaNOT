"use client";

import { useEffect, useState } from "react";

/**
 * Honest connectivity state via navigator.onLine + online/offline events.
 * Note the asymmetry: `true` only means "has a network interface", not proven
 * internet (a captive portal or dead router still reports online) — but
 * `false` is reliable, and that's the direction this app needs it for.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
