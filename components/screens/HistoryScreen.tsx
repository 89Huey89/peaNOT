"use client";

import { useMemo, useState } from "react";
import type { Palette } from "@/lib/theme";
import { VERDICT, verdictColor, verdictGlyph, type Verdict } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import { AppShell, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { X } from "lucide-react";

const FILTERS: { label: string; verdict: Verdict | null }[] = [
  { label: "Alle", verdict: null },
  { label: "Sicher", verdict: "safe" },
  { label: "Warnung", verdict: "danger" },
  { label: "Spuren", verdict: "trace" },
  { label: "Vorbehalt", verdict: "partial" },
  { label: "Unbekannt", verdict: "unknown" },
];

export default function HistoryScreen({
  P,
  history,
  onOpen,
  onClear,
  onRemove,
  onTab,
}: {
  P: Palette;
  history: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onTab: (t: Tab) => void;
}) {
  const [filter, setFilter] = useState<Verdict | null>(null);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((h) => {
      if (filter && h.verdict !== filter) return false;
      if (q && !`${h.name} ${h.brand}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [history, filter, query]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = history.filter((h) => h.ts >= weekAgo);
    return {
      safe: recent.filter((h) => h.verdict === "safe").length,
      danger: recent.filter((h) => h.verdict === "danger").length,
      trace: recent.filter((h) => h.verdict === "trace").length,
    };
  }, [history]);

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          history.length > 0 ? (
            <button
              type="button"
              className="tap"
              onClick={() => {
                if (window.confirm("Gesamten Verlauf löschen?")) onClear();
              }}
              style={{
                background: "transparent",
                border: 0,
                color: P.DIM,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 4px",
              }}
            >
              Leeren
            </button>
          ) : null
        }
      />
      <div style={{ padding: "4px 22px 0" }}>
        <SectionTitle>Verlauf</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, opacity: 0.7, lineHeight: 1.45 }}>
          Alle Scans auf diesem Gerät. Tippe für Details.
        </p>
        {history.length > 0 ? (
          <input
            type="search"
            className="history-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Verlauf durchsuchen…"
            aria-label="Verlauf nach Produkt oder Marke durchsuchen"
          />
        ) : null}
      </div>

      <div
        className="scroll"
        style={{ display: "flex", gap: 6, padding: "10px 22px 6px", overflowX: "auto" }}
      >
        {FILTERS.map((f) => {
          const active = f.verdict === filter;
          return (
            <button
              key={f.label}
              type="button"
              className="tap"
              onClick={() => setFilter(f.verdict)}
              style={{
                background: active ? P.INK : "transparent",
                color: active ? P.BG : P.INK,
                border: active ? 0 : `1px solid ${P.INK}33`,
                borderRadius: 99,
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "4px 22px 96px" }}
      >
        {shown.length === 0 ? (
          <p style={{ fontSize: 13.5, opacity: 0.6, lineHeight: 1.5, marginTop: 18 }}>
            {history.length === 0
              ? "Noch keine Scans. Sobald du ein Produkt prüfst, erscheint es hier."
              : query.trim()
                ? `Keine Treffer für „${query.trim()}".`
                : "Keine Einträge in diesem Filter."}
          </p>
        ) : (
          shown.map((h) => {
            const fg = verdictColor(h.verdict, P);
            return (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: `1px solid ${P.INK}14`,
                }}
              >
                <button
                  type="button"
                  className="tap"
                  onClick={() => onOpen(h)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 0",
                    background: "transparent",
                    border: 0,
                    fontFamily: "inherit",
                    color: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `repeating-linear-gradient(45deg, ${P.INK}10 0 6px, transparent 6px 12px), ${P.PAPER}`,
                      border: `1px solid ${P.INK}22`,
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -5,
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        background: fg,
                        border: `2px solid ${P.BG}`,
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {verdictGlyph(h.verdict)}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "baseline",
                      }}
                    >
                      <Mono style={{ opacity: 0.55 }}>{h.brand}</Mono>
                      <Mono style={{ opacity: 0.45, fontSize: 9 }}>{formatRelative(h.ts)}</Mono>
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14.5,
                        marginTop: 1,
                        lineHeight: 1.2,
                        textWrap: "pretty",
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: fg,
                        fontWeight: 600,
                        marginTop: 2,
                        fontStyle: h.verdict === "danger" ? "italic" : "normal",
                      }}
                    >
                      {VERDICT[h.verdict].label}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="tap"
                  onClick={() => onRemove(h.id)}
                  aria-label={`„${h.name}" aus dem Verlauf entfernen`}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: P.DIM,
                    fontSize: 18,
                    lineHeight: 1,
                    padding: "10px 4px 10px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}

        {history.length > 0 ? (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 14,
              background: P.PAPER,
              border: `1px solid ${P.INK}14`,
            }}
          >
            <Mono style={{ opacity: 0.6 }}>diese woche</Mono>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {[
                [stats.safe, "Sicher", P.GREEN],
                [stats.danger, "Warnung", P.RED],
                [stats.trace, "Spuren", P.AMBER],
              ].map(([n, l, c]) => (
                <div key={l as string} style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 800,
                      fontSize: 28,
                      color: c as string,
                      lineHeight: 1,
                    }}
                  >
                    {n}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <TabBar P={P} tab="verlauf" onTab={onTab} />
    </AppShell>
  );
}
