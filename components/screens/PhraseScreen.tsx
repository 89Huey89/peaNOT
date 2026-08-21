"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import { AppShell, Mono, SectionTitle } from "@/components/ui";
import { useHistoryOverlay } from "@/components/useHistoryOverlay";
import {
  PHRASE_LANGS,
  VENUES,
  hasVenueTranslation,
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
  School,
  UtensilsCrossed,
  X,
} from "lucide-react";

const SERIF = "'Fraunces', serif";

const VENUE_ICON: Record<VenueKey, ReactNode> = {
  icecream: <IceCreamCone size={16} aria-hidden="true" />,
  restaurant: <UtensilsCrossed size={16} aria-hidden="true" />,
  bakery: <Croissant size={16} aria-hidden="true" />,
  kita: <School size={16} aria-hidden="true" />,
  general: <ConciergeBell size={16} aria-hidden="true" />,
};

/**
 * The family's own addendum (F7a), rendered clearly apart from the reviewed
 * sentence: no serif italic, no translation — just what was typed, verbatim.
 * Shared between the inline card and the fullscreen view so both stay in
 * sync and neither invents its own styling for it.
 */
function CardNote({ P, note, size }: { P: Palette; note: string; size: "card" | "full" }) {
  return (
    <div
      style={{
        marginTop: size === "full" ? 22 : 14,
        paddingTop: size === "full" ? 18 : 12,
        borderTop: `1.5px dashed ${P.INK}26`,
      }}
    >
      <Mono style={{ opacity: 0.55, display: "block", marginBottom: 5, color: P.DIM }}>
        Eigener Zusatz
      </Mono>
      <p
        style={{
          margin: 0,
          fontFamily: "inherit",
          fontStyle: "normal",
          fontWeight: 500,
          fontSize: size === "full" ? 19 : 14.5,
          lineHeight: 1.5,
          textWrap: "pretty",
          whiteSpace: "pre-wrap",
        }}
      >
        {note}
      </p>
    </div>
  );
}

const CARD_NOTE_MAX = 240;

export default function PhraseScreen({
  P,
  selectedAllergens,
  cardNote,
  onCardNoteChange,
  onBack,
}: {
  P: Palette;
  /** Allergen keys the user scans for; the card names exactly these. */
  selectedAllergens: string[];
  /** F7a: the family's own addendum, stored verbatim in prefs.cardNote. */
  cardNote: string;
  onCardNoteChange: (value: string) => void;
  onBack: () => void;
}) {
  const [venue, setVenue] = useState<VenueKey>("icecream");
  // Start in the device language when we know it; client-only screen, so
  // navigator is available by the time this mounts.
  const [code, setCode] = useState<string>(() =>
    defaultLangCode(typeof navigator !== "undefined" ? navigator.languages : []),
  );
  const [present, setPresent] = useState(false);
  const phraseRef = useRef<HTMLParagraphElement>(null);

  const lang = useMemo(() => langFor(code), [code]);
  const text = phraseFor(code, venue, selectedAllergens);
  const germanText = phraseFor("de", venue, selectedAllergens);
  const note = cardNote.trim();
  // "kita" (F7b) is only translated for de/en so far — everywhere else
  // phraseFor quietly reuses that language's own "general" sentence. Say so,
  // instead of leaving the venue-specific wording unexplained.
  const venueFallsBack = venue !== "general" && !hasVenueTranslation(code, venue);

  // Move focus onto the presented sentence so VoiceOver/keyboard users land
  // there immediately, and return it to whatever opened the view on close —
  // mirrors ResultScreen's dialog-open pattern.
  useEffect(() => {
    if (!present) return;
    const opener = document.activeElement as HTMLElement | null;
    phraseRef.current?.focus();
    return () => {
      if (opener?.isConnected && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [present]);

  // Escape closes the fullscreen view, mirroring the ✕ button.
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  // UX9: the fullscreen card is itself an overlay on top of the karte
  // screen (which already pushes its own history entry in app/page.tsx) —
  // pushing a second one here means one edge-swipe closes just this view,
  // not both.
  useHistoryOverlay(present, () => setPresent(false));

  // Keep the screen awake while the card is being shown to staff — a timeout
  // mid-conversation is exactly the wrong moment. Best-effort only: the Wake
  // Lock API is feature-detected and every failure is swallowed, since
  // presenting the card must never depend on it (Safari ships it from iOS
  // 16.4; older Safari/other browsers simply get no lock).
  useEffect(() => {
    if (!present) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) {
          // The view was already closed by the time the request settled —
          // release immediately instead of leaking an active lock.
          void s.release().catch(() => {});
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // Refused (low battery, no user activation, unsupported context, …) —
        // the card still shows fine, it just may not keep the screen awake.
      }
    };
    void acquire();
    const onVisibility = () => {
      // The platform releases the lock whenever the tab is hidden; grab it
      // again once the card is back in view (e.g. after answering a call).
      if (!cancelled && document.visibilityState === "visible" && sentinel === null) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [present]);

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
          Zeig diese Karte dem Personal. Sie nennt die in deinem Profil
          gewählten Allergene und bittet um eine sichere Auswahl ohne
          Verunreinigung.
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
                {v.hint ? (
                  <span style={{ opacity: 0.65, fontWeight: 500, fontSize: 11 }}>
                    ({v.hint})
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>Sprache</Mono>
        <div style={{ position: "relative", marginBottom: venueFallsBack ? 8 : 18 }}>
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
              // >=16px so iOS Safari doesn't zoom the page on focus.
              fontSize: 16,
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

        {venueFallsBack ? (
          <p style={{ margin: "0 0 18px", fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>
            „{VENUES.find((v) => v.key === venue)?.label}“ gibt es bisher nur auf
            Deutsch/Englisch — für {lang.label} zeigen wir stattdessen den
            allgemeinen Satz.
          </p>
        ) : null}

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

          {note ? <CardNote P={P} note={note} size="card" /> : null}

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

        <div style={{ marginTop: 18 }}>
          <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>
            Eigener Zusatz (optional)
          </Mono>
          <textarea
            aria-label="Eigener Zusatz (optional)"
            value={cardNote}
            onChange={(e) => onCardNoteChange(e.target.value.slice(0, CARD_NOTE_MAX))}
            placeholder="z. B. Adrenalin-Pen ist im Rucksack, Name des Kindes …"
            rows={3}
            maxLength={CARD_NOTE_MAX}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "12px 14px",
              borderRadius: 12,
              background: P.PAPER,
              color: P.INK,
              border: `1.5px solid ${P.INK}22`,
              fontFamily: "inherit",
              // >=16px so iOS Safari doesn't zoom the page on focus.
              fontSize: 16,
              lineHeight: 1.5,
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, opacity: 0.55, lineHeight: 1.4 }}>
            Nur dein eigener Text, unübersetzt — erscheint auf der Karte klar
            abgesetzt unter dem geprüften Satz, nie darin vermischt.
          </p>
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Allergie-Karte, große Anzeige"
          dir={lang.rtl ? "rtl" : "ltr"}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            background: P.BG,
            color: P.INK,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding:
              "calc(14px + env(safe-area-inset-top)) 26px calc(24px + env(safe-area-inset-bottom))",
            textAlign: lang.rtl ? "right" : "left",
          }}
        >
          <button
            type="button"
            className="tap hit44"
            onClick={() => setPresent(false)}
            aria-label="Schließen"
            style={{
              alignSelf: lang.rtl ? "flex-start" : "flex-end",
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
              flexShrink: 0,
            }}
          >
            <X size={18} aria-hidden="true" /> Schließen
          </button>

          <div style={{ marginTop: 8 }}>
            <Mono style={{ opacity: 0.5, display: "block", marginBottom: 14 }}>
              {lang.label}
            </Mono>
            <p
              ref={phraseRef}
              // Focusable without a visible ring: this receives focus
              // programmatically on open so VoiceOver/keyboard start here,
              // not because a person tabs to it.
              tabIndex={-1}
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: 30,
                lineHeight: 1.45,
                fontWeight: 600,
                textWrap: "pretty",
                outline: "none",
              }}
            >
              {text}
            </p>
            {note ? <CardNote P={P} note={note} size="full" /> : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
