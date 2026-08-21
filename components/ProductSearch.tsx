"use client";

import { useState } from "react";
import type { Palette } from "@/lib/theme";
import { offThumbUrl } from "@/lib/off/normalize";
import { useProductSearch } from "@/components/useProductSearch";
import { Package } from "lucide-react";

interface ProductSearchProps {
  P: Palette;
  onSelect: (barcode: string) => void;
  disabled?: boolean;
}

export default function ProductSearch({ P, onSelect, disabled }: ProductSearchProps) {
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
          {results.map((r) => (
            <li key={r.barcode}>
              <button
                type="button"
                className="tap"
                disabled={disabled}
                onClick={() => onSelect(r.barcode)}
                style={{
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
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 700,
                      fontSize: 13.5,
                      lineHeight: 1.2,
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
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
