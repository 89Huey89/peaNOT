"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import { VERDICT, verdictColor, verdictGlyph, type Verdict } from "@/lib/verdict";
import { formatRelative } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import type { FavoriteEntry } from "@/lib/favorites";
import { readNote } from "@/lib/notes";
import { AppShell, IconButton, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { IdCard, Star, StickyNote, X } from "lucide-react";

const FILTERS: { label: string; verdict: Verdict | null }[] = [
  { label: "Alle", verdict: null },
  { label: "Sicher", verdict: "safe" },
  { label: "Warnung", verdict: "danger" },
  { label: "Spuren", verdict: "trace" },
  { label: "Vorbehalt", verdict: "partial" },
  { label: "Unbekannt", verdict: "unknown" },
];

const UNDO_MS = 5000;

/** A filter pill whose tap target reaches 44×44pt without growing the pill
 * itself — see .hit44 in globals.css. */
function FilterChip({
  P,
  active,
  onClick,
  children,
}: {
  P: Palette;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="tap hit44"
      aria-pressed={active}
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: "transparent",
        border: 0,
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          display: "inline-block",
          background: active ? P.INK : "transparent",
          color: active ? P.BG : P.INK,
          border: active ? 0 : `1px solid ${P.INK}33`,
          borderRadius: 99,
          padding: "7px 12px",
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    </button>
  );
}

export default function HistoryScreen({
  P,
  history,
  favorites,
  onOpen,
  onClear,
  onRemove,
  onRestore,
  onToggleFavorite,
  onOpenCard,
  onTab,
}: {
  P: Palette;
  history: HistoryEntry[];
  /** Starred staples (F2) — only their barcodes matter here, to render the
   * star filled on the rows that are already favorited. */
  favorites: FavoriteEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onRestore: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  onOpenCard: () => void;
  onTab: (t: Tab) => void;
}) {
  const [filter, setFilter] = useState<Verdict | null>(null);
  const [query, setQuery] = useState("");

  // "Rückgängig" snackbar: the removed entry stays here for UNDO_MS so a
  // mis-tap on the small delete target is recoverable — useHistory (the
  // actual source of truth) already dropped it the moment the X was tapped.
  const [pendingUndo, setPendingUndo] = useState<HistoryEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function handleRemove(entry: HistoryEntry) {
    onRemove(entry.id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPendingUndo(entry);
    undoTimer.current = setTimeout(() => setPendingUndo(null), UNDO_MS);
  }

  function handleUndo() {
    if (!pendingUndo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    onRestore(pendingUndo);
    setPendingUndo(null);
  }

  const favoriteBarcodes = useMemo(
    () => new Set(favorites.map((f) => f.barcode)),
    [favorites],
  );

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
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              P={P}
              icon={<IdCard size={18} aria-hidden="true" />}
              label="Allergie-Karte öffnen"
              onClick={onOpenCard}
            />
            {history.length > 0 ? (
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
            ) : null}
          </div>
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
        {FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            P={P}
            active={f.verdict === filter}
            onClick={() => setFilter(f.verdict)}
          >
            {f.label}
          </FilterChip>
        ))}
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
                ? `Keine Treffer für „${query.trim()}“.`
                : "Keine Einträge in diesem Filter."}
          </p>
        ) : (
          shown.map((h) => {
            const fg = verdictColor(h.verdict, P);
            // F5: looked up separately (not merged into `h`) so the entry
            // handed to onOpen/onRemove/onRestore stays exactly the plain
            // HistoryEntry those callbacks (and peanot.history.v1) expect.
            const note = readNote(h.barcode);
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
                        color: P.FILL_TEXT,
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
                      <Mono style={{ opacity: 0.7 }}>{h.brand}</Mono>
                      <Mono style={{ opacity: 0.7 }}>{formatRelative(h.ts)}</Mono>
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.906em",
                        marginTop: 1,
                        lineHeight: 1.2,
                        textWrap: "pretty",
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75em",
                        color: fg,
                        fontWeight: 600,
                        marginTop: 2,
                        fontStyle: h.verdict === "danger" ? "italic" : "normal",
                      }}
                    >
                      {VERDICT[h.verdict].label}
                    </div>
                    {note ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 3,
                          fontSize: "0.72em",
                          opacity: 0.62,
                        }}
                      >
                        <StickyNote size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {note}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  className="tap hit44"
                  onClick={() => onToggleFavorite(h)}
                  aria-pressed={favoriteBarcodes.has(h.barcode)}
                  aria-label={
                    favoriteBarcodes.has(h.barcode)
                      ? `„${h.name}“ aus Favoriten entfernen`
                      : `„${h.name}“ zu Favoriten hinzufügen`
                  }
                  style={{
                    background: "transparent",
                    border: 0,
                    color: favoriteBarcodes.has(h.barcode) ? P.ACCENT : P.DIM,
                    lineHeight: 1,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  <Star
                    size={16}
                    aria-hidden="true"
                    fill={favoriteBarcodes.has(h.barcode) ? P.ACCENT : "none"}
                  />
                </button>
                <button
                  type="button"
                  className="tap hit44"
                  onClick={() => handleRemove(h)}
                  aria-label={`„${h.name}“ aus dem Verlauf entfernen`}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: P.DIM,
                    fontSize: 18,
                    lineHeight: 1,
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

      {pendingUndo ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: "calc(78px + env(safe-area-inset-bottom))",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 8px 12px 16px",
            borderRadius: 14,
            background: P.INK,
            color: P.BG,
            boxShadow: `0 12px 32px -14px ${P.INK}, 0 2px 8px ${P.INK}33`,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, flex: 1 }}>
            „{pendingUndo.name}“ entfernt.
          </span>
          <button
            type="button"
            className="tap hit44"
            onClick={handleUndo}
            style={{
              flexShrink: 0,
              background: "transparent",
              border: 0,
              color: P.ACCENT,
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            Rückgängig
          </button>
        </div>
      ) : null}

      <TabBar P={P} tab="verlauf" onTab={onTab} />
    </AppShell>
  );
}
