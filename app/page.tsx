"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { palette } from "@/lib/theme";
import { FONT_SCALE_FACTOR } from "@/lib/fontScale";
import { unlockAudio } from "@/lib/feedback";
import { isVerdictWorsening } from "@/lib/verdict";
import { useProductLookup } from "@/components/useProductLookup";
import { usePrefs } from "@/components/usePrefs";
import { useHistoryOverlay } from "@/components/useHistoryOverlay";
import { useHistory, resolveHistoryVerdict, type HistoryEntry } from "@/components/useHistory";
import { useFavorites } from "@/components/useFavorites";
import { useBackup } from "@/components/useBackup";
import { Logo, type Tab } from "@/components/ui";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import ScanScreen from "@/components/screens/ScanScreen";
import ResultScreen from "@/components/screens/ResultScreen";
import HistoryScreen from "@/components/screens/HistoryScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import PhraseScreen from "@/components/screens/PhraseScreen";
import EmergencyScreen from "@/components/screens/EmergencyScreen";

type Route = "onboarding" | "scan" | "verlauf" | "profil" | "result" | "karte" | "notfall";

export default function Home() {
  const { prefs, setPref, importPrefs, ready: prefsReady } = usePrefs();
  const {
    history,
    record,
    clear,
    remove,
    restore,
    importEntries,
    ready: historyReady,
  } = useHistory();
  const {
    favorites,
    toggleFavorite,
    recordCheck: recordFavoriteCheck,
    ready: favoritesReady,
  } = useFavorites();
  const { loading, result, lookup } = useProductLookup();
  const { exportData, importData } = useBackup({ history, importHistory: importEntries, prefs });

  const [route, setRoute] = useState<Route | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [lastKnown, setLastKnown] = useState<HistoryEntry | null>(null);
  // Which tab the allergy card was opened from (UX7 — it's reachable from
  // Scan/Verlauf/Profil now, not just Scan), so "Zurück" returns there
  // instead of always landing back on Scan.
  const [cardReturnTab, setCardReturnTab] = useState<Tab>("scan");
  // Same idea for the Notfallplan (F4) — reachable from Scan and Profil.
  const [notfallReturnTab, setNotfallReturnTab] = useState<Tab>("scan");
  // The barcode's prior history entry, set only when the fresh result is a
  // proven *worsening* vs. that entry (see isVerdictWorsening) — informational,
  // it never touches the verdict itself.
  const [worsenedFrom, setWorsenedFrom] = useState<HistoryEntry | null>(null);
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
  const fontScale = FONT_SCALE_FACTOR[prefs.fontScale];
  const ready = prefsReady && historyReady && favoritesReady;

  // Color the area around the app column (and behind safe-area insets).
  useEffect(() => {
    document.body.style.background = P.OUTER;
  }, [P.OUTER]);

  // The static theme-color <meta> pair in layout.tsx only tracks the OS
  // scheme; mirror the resolved in-app theme (which can override it) into a
  // dynamic meta appended after them so Safari's chrome / Android's status
  // bar follow the user's choice too.
  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.dataset.dynamic = "";
      document.head.appendChild(meta);
    }
    meta.content = P.BG;
  }, [P.BG]);

  // Decide the first screen once storage has loaded (avoids onboarding flash).
  useEffect(() => {
    if (!ready || bootstrapped.current) return;
    bootstrapped.current = true;
    setRoute(prefs.onboarded ? "scan" : "onboarding");
  }, [ready, prefs.onboarded]);

  const runLookup = useCallback(
    async (barcode: string, opts: { fresh?: boolean } = {}) => {
      // Every alarm beep traces back to a lookup started here (camera
      // detection, manual entry, search, or a history/staple tap) — resuming
      // the shared AudioContext synchronously at the top covers all of them,
      // not just the explicit "Kamera starten" unlock in BarcodeScanner.
      unlockAudio();
      // Snapshot the barcode's last known verdict *before* record() below can
      // dedupe/replace it — a network-error result needs to point at the
      // prior scan, not at the "Unbekannt" entry it is about to create.
      const previous = history.find((h) => h.barcode === barcode) ?? null;
      const r = await lookup(barcode, prefs.selectedAllergens, opts);
      if (r) {
        const verdict = resolveHistoryVerdict(r);
        // Compare against the prior scan of this exact barcode before record()
        // can dedupe it away — the classic allergy-accident case is "that was
        // safe last time", so a real worsening gets a prominent warning
        // instead of relying on a stressed parent's memory.
        const worsened =
          previous && isVerdictWorsening(previous.verdict, verdict) ? previous : null;
        record(r);
        // F2: if this barcode is a starred staple, its star only ever shows
        // the latest real check — never the verdict from the moment it was
        // favorited. No-op when it isn't (or is no longer) favorited.
        recordFavoriteCheck(barcode, verdict, Date.now());
        setLastKnown(previous);
        setWorsenedFrom(worsened);
        setRoute("result");
      }
    },
    [lookup, record, recordFavoriteCheck, prefs.selectedAllergens, history],
  );

  const openEntry = useCallback((entry: HistoryEntry) => runLookup(entry.barcode), [runLookup]);
  const openFavorite = useCallback(
    (entry: { barcode: string }) => runLookup(entry.barcode),
    [runLookup],
  );

  const openCard = useCallback((from: Tab) => {
    setCardReturnTab(from);
    setRoute("karte");
  }, []);
  const openNotfall = useCallback((from: Tab) => {
    setNotfallReturnTab(from);
    setRoute("notfall");
  }, []);

  // If a network-error result is on screen when connectivity returns, retry
  // the same barcode automatically — the household member doesn't have to
  // remember to tap "Erneut prüfen" once they're back near a signal.
  useEffect(() => {
    if (!(route === "result" && result?.networkError)) return;
    const barcode = result.barcode;
    const onOnline = () => runLookup(barcode);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [route, result, runLookup]);

  // UX9: opening the result dialog or the allergy card pushes a history
  // entry, so the iPhone edge-swipe/back gesture closes that overlay
  // instead of leaving the app mid-shop. Both routes are mutually
  // exclusive, so at most one of these is ever actually open.
  const resultOpen = route === "result" && !!result;
  const karteOpen = route === "karte";
  const notfallOpen = route === "notfall";
  useHistoryOverlay(resultOpen, () => setRoute("scan"));
  useHistoryOverlay(karteOpen, () => setRoute(cardReturnTab));
  useHistoryOverlay(notfallOpen, () => setRoute(notfallReturnTab));

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
        favorites={favorites}
        onOpen={openEntry}
        onClear={clear}
        onRemove={remove}
        onRestore={restore}
        onToggleFavorite={toggleFavorite}
        onOpenCard={() => openCard("verlauf")}
        onTab={(t: Tab) => setRoute(t)}
      />
    );
  } else if (route === "karte") {
    screen = (
      <PhraseScreen
        P={P}
        selectedAllergens={prefs.selectedAllergens}
        cardNote={prefs.cardNote}
        onCardNoteChange={(v) => setPref("cardNote", v)}
        onBack={() => setRoute(cardReturnTab)}
      />
    );
  } else if (route === "notfall") {
    screen = (
      <EmergencyScreen
        P={P}
        plan={prefs.emergencyPlan}
        onPlanChange={(plan) => setPref("emergencyPlan", plan)}
        onBack={() => setRoute(notfallReturnTab)}
      />
    );
  } else if (route === "profil") {
    screen = (
      <ProfileScreen
        P={P}
        prefs={prefs}
        setPref={setPref}
        importPrefs={importPrefs}
        onReplayOnboarding={() => {
          setPref("onboarded", false);
          setRoute("onboarding");
        }}
        onOpenCard={() => openCard("profil")}
        onOpenNotfall={() => openNotfall("profil")}
        onTab={(t: Tab) => setRoute(t)}
        onExport={exportData}
        onImportFile={importData}
      />
    );
  } else {
    // scan + result share a mounted ScanScreen so the camera stream stays alive;
    // the result is layered on top instead of swapping screens.
    screen = (
      <>
        {/* inert freezes focus/AT navigation and pointer events in the
            background while the result dialog is open — without it VoiceOver
            can wander into scanner controls hidden behind the verdict.
            display:contents keeps the wrapper out of the layout so ScanScreen
            still gets .device's real height through the percentage chain. */}
        <div inert={resultOpen || undefined} style={{ display: "contents" }}>
          <ScanScreen
            P={P}
            loading={loading}
            paused={loading || route === "result"}
            haptic={prefs.haptic}
            sound={prefs.sound}
            history={history}
            favorites={favorites}
            onDetected={runLookup}
            onOpen={openEntry}
            onOpenFavorite={openFavorite}
            onOpenCard={() => openCard("scan")}
            onOpenNotfall={() => openNotfall("scan")}
            onTab={(t: Tab) => setRoute(t)}
          />
        </div>
        {resultOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: "absolute", inset: 0, zIndex: 30 }}
          >
            <ResultScreen
              P={P}
              result={result}
              lastKnown={lastKnown}
              worsenedFrom={worsenedFrom}
              selectedAllergens={prefs.selectedAllergens}
              tracesStrict={prefs.tracesStrict}
              haptic={prefs.haptic}
              sound={prefs.sound}
              loading={loading}
              isFavorite={favorites.some((f) => f.barcode === result.barcode)}
              onToggleFavorite={() =>
                toggleFavorite({
                  barcode: result.barcode,
                  name: result.productName ?? "Unbekanntes Produkt",
                  brand: result.brand ?? "—",
                  verdict: resolveHistoryVerdict(result),
                  ts: Date.now(),
                })
              }
              onBack={() => setRoute("scan")}
              onScanAgain={() => setRoute("scan")}
              onRetry={() => runLookup(result.barcode, { fresh: true })}
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
          "--fill-text": P.FILL_TEXT,
          "--font-scale": fontScale,
          // "Größere Schrift" (Profil): scales .device's own font-size, which
          // cascades to any descendant text sized in em (see components/ui.tsx
          // Mono and the em-converted sizes on Result/Scan/History) — off
          // (factor 1) by default.
          fontSize: "calc(1em * var(--font-scale, 1))",
        } as React.CSSProperties
      }
    >
      {screen}
    </main>
  );
}
