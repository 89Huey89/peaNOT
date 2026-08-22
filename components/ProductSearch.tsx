"use client";

import { useState } from "react";
import type { Palette } from "@/lib/theme";
import { offThumbUrl } from "@/lib/off/normalize";
import { useProductSearch } from "@/components/useProductSearch";
import { formatRelative } from "@/lib/time";
import { verdictColor, verdictGlyph, VERDICT, type Verdict } from "@/lib/verdict";
import { Package } from "lucide-react";

/** What ScanScreen knows about a barcode from favorites/history — enough to
 * show a "you've already checked this one" hint next to a search result
 * without a second lookup. See knownVerdicts below. */
export interface KnownVerdict {
  verdict: Verdict;
  ts: number;
}

interface ProductSearchProps {
  P: Palette;
  onSelect: (barcode: string) => void;
  disabled?: boolean;
  /** Befund 11: barcode -> the freshest verdict ScanScreen already has for it
   * (from favorites and/or history), so a familiar result can show a small
   * dot instead of forcing "open it to find out" for every near-duplicate in
   * the list. Purely informational and never fed back into any verdict. */
  knownVerdicts?: Map<string, KnownVerdict>;
}

export default function ProductSearch({ P, onSelect, disabled, knownVerdicts }: ProductSearchProps) {
  const [value, setValue] = useState("");
  const { searching, results, query, search } = useProductSearch();

  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 2;
  const noResults =
    !searching && trimmed.length >= 2 && query === trimmed && results.length === 0;
  // Show skeletons only when there's nothing yet; keep stale results visible
  // while a follow-up query is in flight.
  const showSkeleton = searching && results.length === 0;

  return (
    <div className="manual-entry">
      <label htmlFor="product-search">Nach Name suchen</label>
      <input
        id="product-search"
        type="search"
        className="history-search"
        // Focus on mount: the field only renders once the user opens it.
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        placeholder="z. B. Magnum Mandel"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          search(e.target.value);
        }}
        // >=16px so iOS Safari doesn't zoom the page on focus — explicit here
        // rather than relying on .manual-entry's CSS specificity to win over
        // .history-search's 14px.
        style={{ fontSize: "1rem" }}
      />

      {tooShort ? (
        <p className="manual-entry__hint" role="status">
          Mindestens 2 Zeichen eingeben.
        </p>
      ) : null}

      {searching ? (
        <p className="sr-only" role="status">
          Suche läuft…
        </p>
      ) : null}

      {/* Befund 05: a selection is a lookup in flight exactly like manual
          entry's submit — same reasoning as ManualEntry's busy button, just
          without a single dedicated submit element to carry it (tapping a
          result *is* the submit). A visible status line plus a live region
          covers both sighted users and VoiceOver; the result buttons below
          are already disabled via `disabled={disabled}`. */}
      {disabled ? (
        // role="status" only takes its accessible name from aria-label (it
        // isn't a "name from content" role) — hence the explicit aria-label
        // duplicating the visible text below.
        <p
          className="manual-entry__hint"
          role="status"
          aria-live="polite"
          aria-label="Prüfe Produkt…"
          style={{ color: P.DIM, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: 99,
              border: `2px solid ${P.DIM}`,
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Prüfe Produkt…
        </p>
      ) : null}

      {showSkeleton ? (
        <ul
          aria-hidden="true"
          style={{
            listStyle: "none",
            margin: "4px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: P.PAPER,
                border: `1px solid ${P.INK}1a`,
                borderRadius: 12,
              }}
            >
              <span
                className="skeleton"
                style={{ width: 40, height: 40, flexShrink: 0 }}
              />
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="skeleton" style={{ height: 11, width: "70%" }} />
                <span className="skeleton" style={{ height: 9, width: "40%" }} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {noResults ? (
        <p className="manual-entry__hint" role="status" style={{ color: P.DIM }}>
          Keine Treffer.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "4px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {results.map((r) => {
            const known = knownVerdicts?.get(r.barcode);
            const dotColor = known ? verdictColor(known.verdict, P) : undefined;
            return (
              <li key={r.barcode}>
                <button
                  type="button"
                  className="tap"
                  disabled={disabled}
                  onClick={() => onSelect(r.barcode)}
                  style={{
                    position: "relative",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: P.PAPER,
                    border: `1px solid ${P.INK}1a`,
                    borderRadius: 12,
                    textAlign: "left",
                    color: "inherit",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {r.imageUrl ? (
                    <img
                      src={offThumbUrl(r.imageUrl)}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                        background: `${P.INK}10`,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        background: `${P.INK}10`,
                        color: P.DIM,
                        fontSize: 16,
                      }}
                    >
                      <Package size={20} aria-hidden="true" />
                    </span>
                  )}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 700,
                        fontSize: 13.5,
                        lineHeight: 1.2,
                        // Leave room for the known-verdict dot in the corner
                        // (only actually needed when `known` is set, but a
                        // constant reserve is simpler than measuring and the
                        // list is narrow either way).
                        paddingRight: known ? 20 : 0,
                      }}
                    >
                      {r.productName ?? "Unbekanntes Produkt"}
                    </span>
                    {r.brand ? (
                      <span
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: P.DIM,
                          marginTop: 2,
                        }}
                      >
                        {r.brand}
                      </span>
                    ) : null}
                  </span>
                  {known ? (
                    // Befund 11: a cached verdict from favorites/history, not
                    // a fresh check — labeled with "zuletzt geprüft" plus the
                    // relative time so it can't read as having just been
                    // checked. Color + glyph together, same as every other
                    // verdict mark in the app (never color alone).
                    <span
                      aria-label={`Zuletzt geprüft ${formatRelative(known.ts)}: ${VERDICT[known.verdict].label}`}
                      title={`Zuletzt geprüft ${formatRelative(known.ts)}`}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 15,
                        height: 15,
                        borderRadius: 99,
                        background: dotColor,
                        color: P.FILL_TEXT,
                        fontSize: 9,
                        fontWeight: 800,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span aria-hidden="true">{verdictGlyph(known.verdict)}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
