"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { palette } from "@/lib/theme";
import { useProductLookup } from "@/components/useProductLookup";
import { usePrefs } from "@/components/usePrefs";
import { useHistory, type HistoryEntry } from "@/components/useHistory";
import { Logo, type Tab } from "@/components/ui";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import ScanScreen from "@/components/screens/ScanScreen";
import ResultScreen from "@/components/screens/ResultScreen";
import HistoryScreen from "@/components/screens/HistoryScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import PhraseScreen from "@/components/screens/PhraseScreen";

type Route = "onboarding" | "scan" | "verlauf" | "profil" | "result" | "karte";

export default function Home() {
  const { prefs, setPref, ready: prefsReady } = usePrefs();
  const { history, record, clear, remove, ready: historyReady } = useHistory();
  const { loading, result, lookup } = useProductLookup();

  const [route, setRoute] = useState<Route | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const bootstrapped = useRef(false);

  // Resolve the "system" theme option and keep it in sync with the OS setting.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const mode = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  const P = palette(prefs.accent, mode);
  const ready = prefsReady && historyReady;

  // Color the area around the app column (and behind safe-area insets).
  useEffect(() => {
    document.body.style.background = P.OUTER;
  }, [P.OUTER]);

  // Decide the first screen once storage has loaded (avoids onboarding flash).
  useEffect(() => {
    if (!ready || bootstrapped.current) return;
    bootstrapped.current = true;
    setRoute(prefs.onboarded ? "scan" : "onboarding");
  }, [ready, prefs.onboarded]);

  const runLookup = useCallback(
    async (barcode: string) => {
      const r = await lookup(barcode, prefs.selectedAllergens);
      if (r) {
        record(r);
        setRoute("result");
      }
    },
    [lookup, record, prefs.selectedAllergens],
  );

  const openEntry = useCallback((entry: HistoryEntry) => runLookup(entry.barcode), [runLookup]);

  if (!ready || route === null) {
    return (
      <div
        className="device"
        style={{ background: P.BG, color: P.INK, display: "grid", placeItems: "center" }}
        aria-busy="true"
      >
        <div className="boot-pulse">
          <Logo P={P} size={44} />
        </div>
      </div>
    );
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
  } else if (route === "verlauf") {
    screen = (
      <HistoryScreen
        P={P}
        history={history}
        onOpen={openEntry}
        onClear={clear}
        onRemove={remove}
        onTab={(t: Tab) => setRoute(t)}
      />
    );
  } else if (route === "karte") {
    screen = (
      <PhraseScreen
        P={P}
        selectedAllergens={prefs.selectedAllergens}
        onBack={() => setRoute("scan")}
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
    // scan + result share a mounted ScanScreen so the camera stream stays alive;
    // the result is layered on top instead of swapping screens.
    screen = (
      <>
        <ScanScreen
          P={P}
          loading={loading}
          paused={loading || route === "result"}
          haptic={prefs.haptic}
          sound={prefs.sound}
          history={history}
          onDetected={runLookup}
          onOpen={openEntry}
          onOpenCard={() => setRoute("karte")}
          onTab={(t: Tab) => setRoute(t)}
        />
        {route === "result" && result ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
            <ResultScreen
              P={P}
              result={result}
              selectedAllergens={prefs.selectedAllergens}
              tracesStrict={prefs.tracesStrict}
              haptic={prefs.haptic}
              sound={prefs.sound}
              loading={loading}
              onBack={() => setRoute("scan")}
              onScanAgain={() => setRoute("scan")}
              onRetry={() => runLookup(result.barcode)}
            />
          </div>
        ) : null}
      </>
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
