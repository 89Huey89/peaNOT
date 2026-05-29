"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Palette } from "@/lib/theme";
import { verdictColor } from "@/lib/verdict";
import { VERDICT } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import ManualEntry from "@/components/ManualEntry";
import ProductSearch from "@/components/ProductSearch";
import { verdictGlyph } from "@/lib/verdict";
import { AppShell, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { Keyboard, Languages, Search } from "lucide-react";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => <p className="scanner__hint">Kamera wird geladen…</p>,
});

function scrollPanelIntoView(el: HTMLElement | null): void {
  if (!el) return;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
}

export default function ScanScreen({
  P,
  loading,
  paused,
  haptic,
  sound,
  history,
  onDetected,
  onOpen,
  onOpenCard,
  onTab,
}: {
  P: Palette;
  loading: boolean;
  paused: boolean;
  haptic: boolean;
  sound: boolean;
  history: HistoryEntry[];
  onDetected: (barcode: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onOpenCard: () => void;
  onTab: (t: Tab) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const manualPanelRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  // Bring a just-opened panel into view so its form isn't left below the fold.
  useEffect(() => {
    if (!manualOpen) return;
    scrollPanelIntoView(manualPanelRef.current);
  }, [manualOpen]);
  useEffect(() => {
    if (!searchOpen) return;
    scrollPanelIntoView(searchPanelRef.current);
  }, [searchOpen]);

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          <button
            type="button"
            className="tap"
            onClick={() => onTab("profil")}
            aria-label="Profil öffnen"
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
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: P.GREEN,
                boxShadow: `0 0 0 3px ${P.GREEN}22`,
              }}
            />
            <Mono style={{ opacity: 0.7 }}>live</Mono>
          </button>
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
        />

        <button
          type="button"
          className="tap"
          onClick={() => setManualOpen((o) => !o)}
          aria-expanded={manualOpen}
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

        {manualOpen ? (
          <div id="manual-entry-panel" ref={manualPanelRef} style={{ marginTop: 12 }}>
            <ManualEntry onSubmit={onDetected} disabled={loading} />
          </div>
        ) : null}

        <button
          type="button"
          className="tap"
          onClick={() => setSearchOpen((o) => !o)}
          aria-expanded={searchOpen}
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

        {searchOpen ? (
          <div id="product-search-panel" ref={searchPanelRef} style={{ marginTop: 12 }}>
            <ProductSearch P={P} onSelect={onDetected} disabled={loading} />
          </div>
        ) : null}

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

        {history.length > 0 ? (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <Mono style={{ opacity: 0.6 }}>zuletzt geprüft</Mono>
              <button
                type="button"
                className="tap"
                onClick={() => onTab("verlauf")}
                style={{
                  fontSize: 12,
                  color: P.INK,
                  opacity: 0.7,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  background: "transparent",
                  border: 0,
                  fontFamily: "inherit",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                Alle ansehen
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
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 800,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {verdictGlyph(h.verdict)}
                      </span>
                      <Mono style={{ opacity: 0.55, fontSize: 9 }}>
                        {formatRelative(h.ts)}
                      </Mono>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginTop: 5,
                        lineHeight: 1.15,
                        textWrap: "pretty",
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: fg, fontWeight: 600, marginTop: 3 }}
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
    </AppShell>
  );
}
