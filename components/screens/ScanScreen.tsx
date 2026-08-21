"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Palette } from "@/lib/theme";
import { verdictColor } from "@/lib/verdict";
import { VERDICT } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import type { FavoriteEntry } from "@/lib/favorites";
import { useOnlineStatus } from "@/components/useOnlineStatus";
import ManualEntry from "@/components/ManualEntry";
import ProductSearch from "@/components/ProductSearch";
import { verdictGlyph } from "@/lib/verdict";
import { AppShell, IconButton, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { IdCard, Keyboard, Languages, Search, Siren, Star, X } from "lucide-react";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => <p className="scanner__hint">Kamera wird geladen…</p>,
});

type EntrySheet = "manual" | "search" | null;

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

  function toggleSheet(kind: "manual" | "search") {
    openerRef.current = document.activeElement as HTMLElement | null;
    setSheet((s) => (s === kind ? null : kind));
  }

  // Restore focus to whatever opened the sheet once it closes, by any means
  // (Schließen, scrim tap, Escape) — mirrors ResultScreen's/PhraseScreen's
  // dialog pattern. Reads openerRef fresh in the cleanup (not up front) so
  // switching manual<->search without closing still restores to the most
  // recent opener, not a stale one from the first open.
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
              <Mono style={{ opacity: 0.7, color: online ? undefined : P.AMBER_TEXT }}>
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

        <button
          type="button"
          className="tap"
          onClick={() => toggleSheet("manual")}
          aria-expanded={sheet === "manual"}
          aria-controls="manual-entry-panel"
          style={{
            width: "100%",
            marginTop: 10,
            background: "transparent",
            color: P.INK,
            border: `1.5px solid ${P.INK}33`,
            borderRadius: 99,
            padding: "11px 14px",
            fontWeight: 600,
            fontSize: 13.5,
            fontFamily: "inherit",
          }}
        >
          <Keyboard size={15} aria-hidden="true" /> &nbsp;Barcode manuell eingeben
        </button>

        <button
          type="button"
          className="tap"
          onClick={() => toggleSheet("search")}
          aria-expanded={sheet === "search"}
          aria-controls="product-search-panel"
          style={{
            width: "100%",
            marginTop: 10,
            background: "transparent",
            color: P.INK,
            border: `1.5px solid ${P.INK}33`,
            borderRadius: 99,
            padding: "11px 14px",
            fontWeight: 600,
            fontSize: 13.5,
            fontFamily: "inherit",
          }}
        >
          <Search size={15} aria-hidden="true" /> &nbsp;Nach Name suchen
        </button>

        <button
          type="button"
          className="tap"
          onClick={onOpenCard}
          style={{
            width: "100%",
            marginTop: 10,
            background: "transparent",
            color: P.INK,
            border: `1.5px solid ${P.INK}33`,
            borderRadius: 99,
            padding: "11px 14px",
            fontWeight: 600,
            fontSize: 13.5,
            fontFamily: "inherit",
          }}
        >
          <Languages size={15} aria-hidden="true" /> &nbsp;Allergie-Karte zeigen
        </button>

        {/* F4: same neighbor pill as "Allergie-Karte zeigen" above, tinted
            red so it stays findable if someone unfamiliar with the app (a
            babysitter, a grandparent) has to find it under stress. */}
        <button
          type="button"
          className="tap"
          onClick={onOpenNotfall}
          style={{
            width: "100%",
            marginTop: 10,
            background: "transparent",
            color: P.RED,
            border: `1.5px solid ${P.RED}55`,
            borderRadius: 99,
            padding: "11px 14px",
            fontWeight: 600,
            fontSize: 13.5,
            fontFamily: "inherit",
          }}
        >
          <Siren size={15} aria-hidden="true" /> &nbsp;Notfallplan
        </button>

        {favorites.length > 0 ? (
          <div style={{ marginTop: 22 }}>
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
              // Anchored near the top and capped short: the iOS keyboard
              // covers roughly the bottom half of the screen once the field
              // is focused, so this stays clear of it and results (below the
              // field, inside the same scroll box) never end up hidden
              // underneath the keyboard.
              maxHeight: "45dvh",
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
                <ManualEntry onSubmit={onDetected} disabled={loading} />
              ) : (
                <ProductSearch P={P} onSelect={onDetected} disabled={loading} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
