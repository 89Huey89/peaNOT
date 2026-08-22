"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Palette } from "@/lib/theme";
import { verdictColor, verdictGlyph, VERDICT, type Verdict } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import type { FavoriteEntry } from "@/lib/favorites";
import { useOnlineStatus } from "@/components/useOnlineStatus";
import ManualEntry from "@/components/ManualEntry";
import ProductSearch from "@/components/ProductSearch";
import { AppShell, IconButton, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { IdCard, Keyboard, Languages, Search, Siren, Star, X } from "lucide-react";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => <p className="scanner__hint">Kamera wird geladen…</p>,
});

type EntrySheet = "manual" | "search" | null;

// Befund 11: the sheet was capped at a flat 45dvh so the iOS keyboard could
// never cover its results — safe, but it also left the cap in place on
// devices/orientations where the keyboard takes far less than 55% of the
// screen, showing barely two search results. This is only the fallback for
// environments without `visualViewport` (jsdom in tests, and any browser
// that lacks it) — see the effect below for the real, measured height.
const FALLBACK_SHEET_MAX_HEIGHT = "45dvh";

export default function ScanScreen({
  P,
  loading,
  paused,
  haptic,
  sound,
  autoStartCamera,
  history,
  favorites,
  onDetected,
  onOpen,
  onOpenFavorite,
  onOpenCard,
  onOpenNotfall,
  onTab,
}: {
  P: Palette;
  loading: boolean;
  paused: boolean;
  haptic: boolean;
  sound: boolean;
  /** UX10 opt-in (prefs.autoStartCamera): start the camera on mount instead
   * of waiting for the "Kamera starten" tap. */
  autoStartCamera: boolean;
  history: HistoryEntry[];
  /** Starred staples (F2), most recently starred first. */
  favorites: FavoriteEntry[];
  onDetected: (barcode: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  /** Re-runs the ordinary lookup flow for a starred barcode — same as
   * tapping a "zuletzt geprüft" card, just from the Favoriten strip. */
  onOpenFavorite: (entry: FavoriteEntry) => void;
  onOpenCard: () => void;
  /** F4: opens the family's Notfallplan (112 + Adrenalin-Autoinjektor-Plan). */
  onOpenNotfall: () => void;
  onTab: (t: Tab) => void;
}) {
  // UX8: manual entry and search share one bottom sheet slot — opening one
  // replaces the other rather than stacking both over the scanner.
  const [sheet, setSheet] = useState<EntrySheet>(null);
  const sheetOpen = sheet !== null;
  const online = useOnlineStatus();
  // Whichever toggle button was tapped to open (or last switch) the sheet —
  // captured on click, *before* ManualEntry's/ProductSearch's own autoFocus
  // grabs focus during the same commit (too early for an effect here to
  // still see it on document.activeElement).
  const openerRef = useRef<HTMLElement | null>(null);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<string>(FALLBACK_SHEET_MAX_HEIGHT);

  function toggleSheet(kind: "manual" | "search") {
    openerRef.current = document.activeElement as HTMLElement | null;
    setSheet((s) => (s === kind ? null : kind));
  }

  // Befund 05: forward to the ordinary lookup flow, but also close the sheet
  // right away instead of leaving it sitting open behind the result. Closing
  // unmounts ManualEntry/ProductSearch entirely (see the sheet's conditional
  // render below), which is also what "clears the field" — there's no stale
  // barcode/query left to clear because the next open is a fresh mount.
  function handleManualSubmit(barcode: string) {
    setSheet(null);
    onDetected(barcode);
  }
  function handleSearchSelect(barcode: string) {
    setSheet(null);
    onDetected(barcode);
  }

  // Restore focus to whatever opened the sheet once it closes, by any means
  // (Schließen, scrim tap, Escape, or now a successful submit/selection above)
  // — mirrors ResultScreen's/PhraseScreen's dialog pattern. Reads openerRef
  // fresh in the cleanup (not up front) so switching manual<->search without
  // closing still restores to the most recent opener, not a stale one from
  // the first open.
  //
  // Kept for the submit/select path too, deliberately: `loading` becomes
  // true right away but the result overlay only mounts once the lookup's
  // network round-trip resolves, so there's a real (if short) gap where this
  // screen — sheet now closed — is what's actually on screen and
  // interactive. Landing focus on the button that opened the sheet keeps it
  // somewhere sane for that gap instead of dropping it to <body>, and costs
  // nothing extra: it's the same cleanup Escape/scrim/✕ already use. Once
  // the result dialog does mount, app/page.tsx marks this screen `inert` and
  // the dialog manages its own focus (the established pattern elsewhere in
  // this app), so this placement is superseded rather than fought over.
  useEffect(() => {
    if (!sheetOpen) return;
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [sheetOpen]);

  // Escape closes the sheet, mirroring the ✕ button.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Befund 11: replace the flat 45dvh cap with the real space available above
  // the keyboard, tracked via visualViewport while the sheet is open.
  // visualViewport.height already excludes the iOS keyboard, and offsetTop
  // covers the (rarer) case where the visible viewport itself has scrolled
  // down from the layout viewport's top. jsdom (and any browser without
  // visualViewport) has nothing to observe, so it just keeps the old static
  // cap — never throws, never leaves the sheet unbounded.
  useEffect(() => {
    if (!sheetOpen) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) {
      setSheetMaxHeight(FALLBACK_SHEET_MAX_HEIGHT);
      return;
    }
    // Mirrors the sheet's own `marginTop` base offset and leaves a small gap
    // at the bottom so the card never touches the visible viewport's edge.
    const TOP_OFFSET = 10;
    const BOTTOM_GAP = 12;
    const update = () => {
      const available = vv.height + vv.offsetTop - TOP_OFFSET - BOTTOM_GAP;
      setSheetMaxHeight(`${Math.max(200, Math.round(available))}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [sheetOpen]);

  // Befund 11: barcode -> the freshest verdict already known from favorites
  // or history, so ProductSearch can mark a familiar result instead of every
  // near-duplicate needing to be opened just to tell them apart. Recomputed
  // only when either list actually changes; picks whichever of the two
  // records is newer rather than preferring one source, since both are kept
  // fresh by the same recheck (recordFavoriteCheck / history.record both run
  // from the same lookup in app/page.tsx).
  const knownVerdicts = useMemo(() => {
    const map = new Map<string, { verdict: Verdict; ts: number }>();
    const consider = (barcode: string, verdict: Verdict, ts: number) => {
      const existing = map.get(barcode);
      if (!existing || ts > existing.ts) map.set(barcode, { verdict, ts });
    };
    for (const h of history) consider(h.barcode, h.verdict, h.ts);
    for (const f of favorites) consider(f.barcode, f.verdict, f.ts);
    return map;
  }, [history, favorites]);

  return (
    <AppShell P={P}>
      {/* inert freezes focus/AT navigation and pointer events behind the
          sheet's scrim while it's open — same rationale as app/page.tsx's
          wrapping around ScanScreen itself. display:contents keeps the
          wrapper out of AppShell's flex layout. */}
      <div inert={sheetOpen || undefined} style={{ display: "contents" }}>
      <TopBar
        P={P}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              P={P}
              icon={<IdCard size={18} aria-hidden="true" />}
              label="Allergie-Karte öffnen"
              onClick={onOpenCard}
            />
            <button
              type="button"
              className="tap"
              onClick={() => onTab("profil")}
              aria-label={online ? "Profil öffnen" : "Profil öffnen — offline"}
              style={{
                display: "flex",
                gap: 7,
                alignItems: "center",
                color: P.DIM,
                background: "transparent",
                border: 0,
                fontFamily: "inherit",
                padding: "6px 2px",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: online ? P.GREEN : P.AMBER,
                  boxShadow: `0 0 0 3px ${online ? P.GREEN : P.AMBER}22`,
                }}
              />
              <Mono style={{ opacity: online ? 0.7 : 1, color: online ? undefined : P.AMBER_TEXT }}>
                {online ? "live" : "offline"}
              </Mono>
            </button>
          </div>
        }
      />

      <div
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "4px 22px 96px" }}
      >
        <SectionTitle>
          {loading ? "Suche Barcode…" : "Halte einen Code vor die Kamera."}
        </SectionTitle>

        <BarcodeScanner
          onDetected={onDetected}
          paused={paused}
          loading={loading}
          haptic={haptic}
          sound={sound}
          autoStart={autoStartCamera}
        />

        {/* Befund 04.1: Favoriten moved up to right under the camera —
            rechecking the same 10-20 staples before a shop is the most
            common reason to open this screen at all, so it shouldn't sit
            below four buttons' worth of scrolling to reach. */}
        {favorites.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <Mono style={{ opacity: 0.6, display: "block", marginBottom: 8 }}>favoriten</Mono>
            <div
              className="scroll"
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                margin: "0 -22px",
                padding: "0 22px",
              }}
            >
              {favorites.map((f) => {
                const fg = verdictColor(f.verdict, P);
                return (
                  <button
                    key={f.barcode}
                    type="button"
                    className="tap"
                    onClick={() => onOpenFavorite(f)}
                    style={{
                      minWidth: 148,
                      padding: "10px 12px",
                      background: P.PAPER,
                      border: `1px solid ${P.ACCENT}55`,
                      borderRadius: 12,
                      textAlign: "left",
                      color: "inherit",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      display: "block",
                      position: "relative",
                    }}
                  >
                    <Star
                      size={13}
                      aria-hidden="true"
                      fill={P.ACCENT}
                      color={P.ACCENT}
                      style={{ position: "absolute", top: 8, right: 8 }}
                    />
                    {/* Der Stern sitzt absolut oben rechts; ohne diese
                        Reserve läuft die Zeitangabe darunter durch
                        ("GESTERN · 07:13" mit Stern auf der 3). Der
                        Produktname darunter hält denselben Abstand. */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        paddingRight: 16,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 99,
                          background: fg,
                          color: P.FILL_TEXT,
                          fontSize: 9,
                          fontWeight: 800,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {verdictGlyph(f.verdict)}
                      </span>
                      <Mono style={{ opacity: 0.7 }}>{formatRelative(f.ts)}</Mono>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8125em",
                        marginTop: 5,
                        lineHeight: 1.15,
                        textWrap: "pretty",
                        // Leave room for the star mark in the corner.
                        paddingRight: 16,
                      }}
                    >
                      {f.name}
                    </div>
                    <div
                      style={{ fontSize: "0.6875em", color: fg, fontWeight: 600, marginTop: 3 }}
                    >
                      {VERDICT[f.verdict].label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Mono style={{ opacity: 0.6 }}>zuletzt geprüft</Mono>
              <button
                type="button"
                className="tap hit44"
                onClick={() => onTab("verlauf")}
                style={{
                  color: P.INK,
                  background: "transparent",
                  border: 0,
                  fontFamily: "inherit",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Alle ansehen
                </span>
              </button>
            </div>
            <div
              className="scroll"
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                margin: "0 -22px",
                padding: "0 22px",
              }}
            >
              {history.slice(0, 6).map((h) => {
                const fg = verdictColor(h.verdict, P);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="tap"
                    onClick={() => onOpen(h)}
                    style={{
                      minWidth: 148,
                      padding: "10px 12px",
                      background: P.PAPER,
                      border: `1px solid ${P.INK}1a`,
                      borderRadius: 12,
                      textAlign: "left",
                      color: "inherit",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 99,
                          background: fg,
                          color: P.FILL_TEXT,
                          fontSize: 9,
                          fontWeight: 800,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {verdictGlyph(h.verdict)}
                      </span>
                      <Mono style={{ opacity: 0.7 }}>{formatRelative(h.ts)}</Mono>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8125em",
                        marginTop: 5,
                        lineHeight: 1.15,
                        textWrap: "pretty",
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{ fontSize: "0.6875em", color: fg, fontWeight: 600, marginTop: 3 }}
                    >
                      {VERDICT[h.verdict].label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Befund 04.2: manual entry and name search are two ways to reach the
            same goal — checking a barcode you can't or don't want to point
            the camera at — so they share one row instead of two full-width
            pills that read as separate, unrelated actions. Visible labels
            are short ("Manuell"/"Suchen"); the fuller aria-label keeps the
            accessible name (and this file's existing tests) unchanged. */}
        <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
          <button
            type="button"
            className="tap"
            onClick={() => toggleSheet("manual")}
            aria-expanded={sheet === "manual"}
            aria-controls="manual-entry-panel"
            aria-label="Barcode manuell eingeben"
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: P.INK,
              border: `1.5px solid ${P.INK}33`,
              borderRadius: 99,
              padding: "11px 10px",
              fontWeight: 600,
              fontSize: 13.5,
              fontFamily: "inherit",
            }}
          >
            <Keyboard size={15} aria-hidden="true" /> &nbsp;Manuell
          </button>

          <button
            type="button"
            className="tap"
            onClick={() => toggleSheet("search")}
            aria-expanded={sheet === "search"}
            aria-controls="product-search-panel"
            aria-label="Nach Name suchen"
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: P.INK,
              border: `1.5px solid ${P.INK}33`,
              borderRadius: 99,
              padding: "11px 10px",
              fontWeight: 600,
              fontSize: 13.5,
              fontFamily: "inherit",
            }}
          >
            <Search size={15} aria-hidden="true" /> &nbsp;Suchen
          </button>
        </div>

        {/* Befund 04.3: Allergie-Karte and Notfallplan are two standalone
            screens, not a third input alternative — set apart from the row
            above by a divider and quieter styling (smaller, DIM-toned
            "Allergie-Karte") so the pair reads as "elsewhere in the app"
            rather than more of the same kind of action. Notfallplan keeps a
            filled red tint regardless of that quieter treatment: it has to
            be findable by someone who's never seen this app before — a
            grandparent, a babysitter — searching under stress, so it can't
            fade into a muted "more" section the way Allergie-Karte can. */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 26,
            paddingTop: 18,
            borderTop: `1px solid ${P.INK}1a`,
          }}
        >
          <button
            type="button"
            className="tap"
            onClick={onOpenCard}
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: P.DIM,
              border: `1.5px solid ${P.INK}22`,
              borderRadius: 99,
              padding: "10px 10px",
              fontWeight: 600,
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <Languages size={14} aria-hidden="true" /> &nbsp;Allergie-Karte
          </button>

          <button
            type="button"
            className="tap"
            onClick={onOpenNotfall}
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${P.RED}12`,
              color: P.RED,
              border: `1.5px solid ${P.RED}55`,
              borderRadius: 99,
              padding: "10px 10px",
              fontWeight: 700,
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <Siren size={14} aria-hidden="true" /> &nbsp;Notfallplan
          </button>
        </div>
      </div>

      <TabBar P={P} tab="scan" onTab={onTab} />
      </div>

      {sheet ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sheet === "manual" ? "Barcode manuell eingeben" : "Nach Name suchen"}
          style={{ position: "absolute", inset: 0, zIndex: 25 }}
        >
          {/* Scrim: a second, purely visual dismiss target alongside the
              explicit Schließen button below — same dual affordance every
              modal in this app offers. */}
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setSheet(null)}
            style={{
              position: "absolute",
              inset: 0,
              border: 0,
              padding: 0,
              background: `${P.INK}66`,
              cursor: "pointer",
            }}
          />
          <div
            id={sheet === "manual" ? "manual-entry-panel" : "product-search-panel"}
            className="result-in"
            style={{
              position: "relative",
              margin: "calc(10px + env(safe-area-inset-top)) 14px 0",
              // Befund 11: real free space above the keyboard (see the
              // visualViewport effect above), falling back to the previous
              // static 45dvh cap wherever that API isn't available.
              maxHeight: sheetMaxHeight,
              display: "flex",
              flexDirection: "column",
              background: P.BG,
              borderRadius: 18,
              border: `1px solid ${P.INK}1a`,
              boxShadow: `0 20px 50px -20px ${P.INK}, 0 4px 16px ${P.INK}33`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px 10px 0",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="tap hit44"
                onClick={() => setSheet(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: 0,
                  color: P.DIM,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <X size={16} aria-hidden="true" /> Schließen
              </button>
            </div>
            <div
              className="scroll"
              style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px" }}
            >
              {sheet === "manual" ? (
                <ManualEntry onSubmit={handleManualSubmit} disabled={loading} />
              ) : (
                <ProductSearch
                  P={P}
                  onSelect={handleSearchSelect}
                  disabled={loading}
                  knownVerdicts={knownVerdicts}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
