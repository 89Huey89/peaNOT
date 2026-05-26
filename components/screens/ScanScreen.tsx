"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Palette } from "@/lib/theme";
import { verdictColor } from "@/lib/verdict";
import { VERDICT } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import ManualEntry from "@/components/ManualEntry";
import { AppShell, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => <p className="scanner__hint">Kamera wird geladen…</p>,
});

export default function ScanScreen({
  P,
  loading,
  history,
  onDetected,
  onOpen,
  onTab,
}: {
  P: Palette;
  loading: boolean;
  history: HistoryEntry[];
  onDetected: (barcode: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onTab: (t: Tab) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          <div
            className="tap"
            onClick={() => onTab("profil")}
            style={{ display: "flex", gap: 7, alignItems: "center", color: P.DIM }}
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

        <BarcodeScanner onDetected={onDetected} />

        <button
          type="button"
          className="tap"
          onClick={() => setManualOpen((o) => !o)}
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
          ⌨ &nbsp;Barcode manuell eingeben
        </button>

        {manualOpen ? (
          <div style={{ marginTop: 12 }}>
            <ManualEntry onSubmit={onDetected} disabled={loading} />
          </div>
        ) : null}

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
              <span
                className="tap"
                onClick={() => onTab("verlauf")}
                style={{
                  fontSize: 12,
                  color: P.INK,
                  opacity: 0.7,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Alle ansehen
              </span>
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
                  <div
                    key={h.id}
                    className="tap"
                    onClick={() => onOpen(h)}
                    style={{
                      minWidth: 148,
                      padding: "10px 12px",
                      background: P.PAPER,
                      border: `1px solid ${P.INK}1a`,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{ width: 8, height: 8, borderRadius: 99, background: fg }}
                      />
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
                  </div>
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
