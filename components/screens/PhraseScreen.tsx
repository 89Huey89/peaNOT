"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import { AppShell, Mono, SectionTitle } from "@/components/ui";
import {
  PHRASE_LANGS,
  VENUES,
  langFor,
  phraseFor,
  defaultLangCode,
  type VenueKey,
} from "@/lib/phrases";
import {
  ArrowLeft,
  ConciergeBell,
  Croissant,
  Expand,
  IceCreamCone,
  Languages,
  UtensilsCrossed,
  X,
} from "lucide-react";

const SERIF = "'Fraunces', serif";

const VENUE_ICON: Record<VenueKey, ReactNode> = {
  icecream: <IceCreamCone size={16} aria-hidden="true" />,
  restaurant: <UtensilsCrossed size={16} aria-hidden="true" />,
  bakery: <Croissant size={16} aria-hidden="true" />,
  general: <ConciergeBell size={16} aria-hidden="true" />,
};

export default function PhraseScreen({
  P,
  onBack,
}: {
  P: Palette;
  onBack: () => void;
}) {
  const [venue, setVenue] = useState<VenueKey>("icecream");
  // Start in the device language when we know it; client-only screen, so
  // navigator is available by the time this mounts.
  const [code, setCode] = useState<string>(() =>
    defaultLangCode(typeof navigator !== "undefined" ? navigator.languages : []),
  );
  const [present, setPresent] = useState(false);

  const lang = useMemo(() => langFor(code), [code]);
  const text = phraseFor(code, venue);
  const germanText = phraseFor("de", venue);

  return (
    <AppShell P={P}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "calc(8px + env(safe-area-inset-top)) 18px 8px",
        }}
      >
        <button
          type="button"
          className="tap"
          onClick={onBack}
          aria-label="Zurück"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: 0,
            color: P.INK,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            padding: "6px 2px",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Zurück
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 22px 28px" }}>
        <SectionTitle>Allergie-Karte</SectionTitle>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, opacity: 0.7, lineHeight: 1.5 }}>
          Zeig diese Karte dem Personal. Sie erklärt die Erdnussallergie und
          bittet um erdnussfreie Auswahl ohne Verunreinigung.
        </p>

        <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>Wo?</Mono>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {VENUES.map((v) => {
            const active = v.key === venue;
            return (
              <button
                key={v.key}
                type="button"
                className="tap"
                aria-pressed={active}
                onClick={() => setVenue(v.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 13px",
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: active ? P.INK : "transparent",
                  color: active ? P.BG : P.INK,
                  border: `1.5px solid ${active ? P.INK : `${P.INK}33`}`,
                }}
              >
                <span style={{ display: "flex", opacity: active ? 1 : 0.7 }}>
                  {VENUE_ICON[v.key]}
                </span>
                {v.label}
              </button>
            );
          })}
        </div>

        <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>Sprache</Mono>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              color: P.DIM,
              pointerEvents: "none",
            }}
          >
            <Languages size={16} />
          </span>
          <select
            aria-label="Sprache der Allergie-Karte"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: "100%",
              appearance: "none",
              WebkitAppearance: "none",
              padding: "12px 14px 12px 38px",
              borderRadius: 12,
              background: P.PAPER,
              color: P.INK,
              border: `1.5px solid ${P.INK}22`,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {PHRASE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} · {l.english}
              </option>
            ))}
          </select>
        </div>

        <div
          dir={lang.rtl ? "rtl" : "ltr"}
          style={{
            position: "relative",
            padding: "20px 18px",
            borderRadius: 16,
            background: P.PAPER,
            border: `1px solid ${P.INK}1a`,
          }}
        >
          <Mono style={{ opacity: 0.5, display: "block", marginBottom: 10 }}>
            {lang.label}
          </Mono>
          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 21,
              lineHeight: 1.5,
              fontWeight: 500,
              textWrap: "pretty",
            }}
          >
            {text}
          </p>

          <button
            type="button"
            className="tap"
            onClick={() => setPresent(true)}
            style={{
              marginTop: 16,
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: P.ACCENT,
              color: P.INK,
              border: 0,
              borderRadius: 99,
              padding: "12px 14px",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <Expand size={16} aria-hidden="true" /> Groß anzeigen
          </button>
        </div>

        {code !== "de" ? (
          <div style={{ marginTop: 16 }}>
            <Mono style={{ opacity: 0.5, display: "block", marginBottom: 6 }}>
              Auf Deutsch
            </Mono>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
              {germanText}
            </p>
          </div>
        ) : null}

        <p
          style={{
            fontSize: 11,
            opacity: 0.5,
            textAlign: "center",
            margin: "22px 0 0",
            lineHeight: 1.5,
          }}
        >
          Übersetzungen sind eine Hilfe, keine Garantie. Im Zweifel auf den
          Verzehr verzichten.
        </p>
      </div>

      {present ? (
        <button
          type="button"
          aria-label="Große Anzeige schließen"
          onClick={() => setPresent(false)}
          dir={lang.rtl ? "rtl" : "ltr"}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            background: P.BG,
            color: P.INK,
            border: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "calc(20px + env(safe-area-inset-top)) 26px calc(20px + env(safe-area-inset-bottom))",
            textAlign: lang.rtl ? "right" : "left",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "calc(14px + env(safe-area-inset-top))",
              insetInlineEnd: 18,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: P.DIM,
              fontSize: 12,
            }}
          >
            <X size={18} /> Schließen
          </span>
          <Mono style={{ opacity: 0.5, display: "block", marginBottom: 14 }}>
            {lang.label}
          </Mono>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 30,
              lineHeight: 1.45,
              fontWeight: 600,
              textWrap: "pretty",
            }}
          >
            {text}
          </span>
        </button>
      ) : null}
    </AppShell>
  );
}
