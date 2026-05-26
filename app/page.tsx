"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { palette } from "@/lib/theme";
import { useProductLookup } from "@/components/useProductLookup";
import { usePrefs } from "@/components/usePrefs";
import { useHistory, type HistoryEntry } from "@/components/useHistory";
import type { Tab } from "@/components/ui";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import ScanScreen from "@/components/screens/ScanScreen";
import ResultScreen from "@/components/screens/ResultScreen";
import HistoryScreen from "@/components/screens/HistoryScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";

type Route = "onboarding" | "scan" | "verlauf" | "profil" | "result";

export default function Home() {
  const { prefs, setPref, ready: prefsReady } = usePrefs();
  const { history, record, clear, ready: historyReady } = useHistory();
  const { loading, result, lookup } = useProductLookup();

  const [route, setRoute] = useState<Route | null>(null);
  const bootstrapped = useRef(false);

  const P = palette(prefs.accent);
  const ready = prefsReady && historyReady;

  // Decide the first screen once storage has loaded (avoids onboarding flash).
  useEffect(() => {
    if (!ready || bootstrapped.current) return;
    bootstrapped.current = true;
    setRoute(prefs.onboarded ? "scan" : "onboarding");
  }, [ready, prefs.onboarded]);

  const runLookup = useCallback(
    async (barcode: string) => {
      const r = await lookup(barcode);
      if (r) {
        record(r);
        setRoute("result");
      }
    },
    [lookup, record],
  );

  const openEntry = useCallback((entry: HistoryEntry) => runLookup(entry.barcode), [runLookup]);

  if (!ready || route === null) {
    return <div style={{ minHeight: "100dvh", background: P.BG }} />;
  }

  let screen: React.ReactNode;
  if (route === "onboarding") {
    screen = (
      <OnboardingScreen
        P={P}
        onDone={() => {
          setPref("onboarded", true);
          setRoute("scan");
        }}
      />
    );
  } else if (route === "result" && result) {
    screen = (
      <ResultScreen
        P={P}
        result={result}
        tracesStrict={prefs.tracesStrict}
        haptic={prefs.haptic}
        sound={prefs.sound}
        onBack={() => setRoute("scan")}
        onScanAgain={() => setRoute("scan")}
      />
    );
  } else if (route === "verlauf") {
    screen = (
      <HistoryScreen
        P={P}
        history={history}
        onOpen={openEntry}
        onClear={clear}
        onTab={(t: Tab) => setRoute(t)}
      />
    );
  } else if (route === "profil") {
    screen = (
      <ProfileScreen
        P={P}
        prefs={prefs}
        setPref={setPref}
        onReplayOnboarding={() => {
          setPref("onboarded", false);
          setRoute("onboarding");
        }}
        onTab={(t: Tab) => setRoute(t)}
      />
    );
  } else {
    screen = (
      <ScanScreen
        P={P}
        loading={loading}
        history={history}
        onDetected={runLookup}
        onOpen={openEntry}
        onTab={(t: Tab) => setRoute(t)}
      />
    );
  }

  return (
    <main
      className="device"
      style={
        {
          background: P.BG,
          color: P.INK,
          "--bg": P.BG,
          "--ink": P.INK,
          "--paper": P.PAPER,
          "--dim": P.DIM,
          "--accent": P.ACCENT,
          "--green": P.GREEN,
          "--red": P.RED,
        } as React.CSSProperties
      }
    >
      {screen}
    </main>
  );
}
