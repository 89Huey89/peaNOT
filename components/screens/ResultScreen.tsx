"use client";

import { useEffect, type ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import type { ProductResult } from "@/lib/types";
import { statusToVerdict, VERDICT, verdictColor } from "@/lib/verdict";
import { AppShell, Chip, Mono, Stamp, TopBar, type ChipTone } from "@/components/ui";

function shortEan(ean: string): string {
  return ean.length > 8 ? `${ean.slice(0, 4)}…${ean.slice(-4)}` : ean;
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Short attention beep via WebAudio (only when the user opted into sound). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

function highlight(text: string, found: string | null | undefined, P: Palette): ReactNode {
  if (!found) return text;
  const idx = text.toLowerCase().indexOf(found.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: P.RED,
          color: "#fff",
          padding: "1px 5px",
          borderRadius: 3,
          fontWeight: 700,
        }}
      >
        {text.slice(idx, idx + found.length)}
      </mark>
      {text.slice(idx + found.length)}
    </>
  );
}

export default function ResultScreen({
  P,
  result,
  tracesStrict,
  haptic,
  sound,
  onBack,
  onScanAgain,
}: {
  P: Palette;
  result: ProductResult;
  tracesStrict: boolean;
  haptic: boolean;
  sound: boolean;
  onBack: () => void;
  onScanAgain: () => void;
}) {
  const verdict = statusToVerdict(result.status);
  const copy = VERDICT[verdict];
  const fg = verdictColor(verdict, P);

  const isSafe = verdict === "safe";
  const isDanger = verdict === "danger";
  const isTrace = verdict === "trace";
  const isUnknown = verdict === "unknown";
  const alarm = isDanger || (isTrace && tracesStrict);

  // Alert the user on a hit (and on traces when strict mode is on).
  useEffect(() => {
    if (!alarm) return;
    if (haptic && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }
    if (sound) beep();
  }, [alarm, haptic, sound]);

  const accentBg = isSafe
    ? `${P.GREEN}10`
    : isDanger
      ? `${P.RED}10`
      : isTrace
        ? `${P.AMBER}12`
        : `${P.INK}06`;
  const accentBd = isSafe ? P.GREEN : isDanger ? P.RED : isTrace ? P.AMBER : `${P.INK}33`;

  const traceOnly = (result.traces ?? []).filter(
    (t) => !(result.allergens ?? []).includes(t),
  );

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          <button
            type="button"
            className="tap"
            onClick={onBack}
            style={{
              background: "transparent",
              border: 0,
              color: P.INK,
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 600,
              padding: "6px 4px",
            }}
          >
            ✕ Schließen
          </button>
        }
      />

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 22px 100px",
          animation: "resultIn .35s ease-out both",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Mono style={{ opacity: 0.6 }}>ergebnis</Mono>
          <Mono style={{ opacity: 0.6 }}>geprüft · {nowHHMM()}</Mono>
        </div>

        <p
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontSize: 20,
            margin: "6px 0 14px",
            color: P.INK,
            lineHeight: 1.2,
          }}
        >
          {copy.headline}
        </p>

        <div
          style={{
            padding: "16px 18px",
            borderRadius: 18,
            background: P.PAPER,
            border: `1.5px solid ${P.INK}`,
            position: "relative",
            boxShadow: `0 1px 0 ${P.INK}11, 0 24px 60px -32px ${P.INK}55`,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: `repeating-linear-gradient(45deg, ${P.INK}10 0 6px, transparent 6px 12px), #ece1c8`,
                border: `1px solid ${P.INK}22`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Mono style={{ opacity: 0.55, fontSize: 8 }}>foto</Mono>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Mono style={{ opacity: 0.55 }}>
                {result.brand ?? "—"} · ean {shortEan(result.barcode)}
              </Mono>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  fontSize: 20,
                  lineHeight: 1.1,
                  marginTop: 2,
                }}
              >
                {result.productName ?? "Unbekanntes Produkt"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "18px 14px 16px",
              borderRadius: 14,
              background: accentBg,
              border: `2px solid ${accentBd}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.06,
                background: `repeating-linear-gradient(135deg, ${accentBd} 0 8px, transparent 8px 18px)`,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
              {isUnknown ? (
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 99,
                    border: `2px dashed ${P.DIM}`,
                    display: "grid",
                    placeItems: "center",
                    color: P.DIM,
                    transform: "rotate(-8deg)",
                    flexShrink: 0,
                  }}
                >
                  <Mono style={{ fontSize: 9 }}>?</Mono>
                </div>
              ) : (
                <Stamp verdict={verdict} P={P} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Mono style={{ color: fg }}>{copy.tag}</Mono>
                <div
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color: fg,
                    lineHeight: 1.0,
                    marginTop: 3,
                    textWrap: "balance",
                  }}
                >
                  {copy.title}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 6, opacity: 0.78, lineHeight: 1.35 }}>
                  {isUnknown ? result.message ?? copy.detail : copy.detail}
                  {isTrace && tracesStrict ? " Im Strikt-Modus wie ein Treffer behandelt." : ""}
                </div>
              </div>
            </div>
          </div>

          {!isUnknown && result.ingredients ? (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: `${P.INK}05`,
                border: `1px dashed ${P.INK}33`,
              }}
            >
              <Mono style={{ opacity: 0.6 }}>belegstelle · zutaten</Mono>
              <div style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.5 }}>
                {highlight(result.ingredients, result.found, P)}
              </div>
            </div>
          ) : null}

          {(result.allergens?.length ?? 0) + traceOnly.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Mono style={{ opacity: 0.6 }}>weitere allergene</Mono>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {(result.allergens ?? []).map((name) => {
                  const tone: ChipTone = name === "Erdnuss" ? "bad" : "info";
                  return (
                    <Chip key={`a-${name}`} tone={tone} P={P}>
                      <span style={{ fontWeight: 700 }}>{name}</span>
                    </Chip>
                  );
                })}
                {traceOnly.map((name) => (
                  <Chip key={`t-${name}`} tone="warn" P={P}>
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    <span style={{ opacity: 0.7, fontWeight: 500 }}>· Spuren</span>
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {isUnknown ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: `${P.ACCENT}10`,
                border: `1.5px dashed ${P.ACCENT}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Kein Eintrag gefunden
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85 }}>
                Zu diesem Barcode liegen keine Zutaten- oder Allergendaten vor. Erdnuss kann
                nicht ausgeschlossen werden – im Zweifel das Produkt meiden.
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{ display: "flex", justifyContent: "space-between", marginTop: 12, opacity: 0.6 }}
        >
          <Mono>quelle · openfoodfacts</Mono>
          <Mono>ean · {result.barcode}</Mono>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 22px calc(20px + env(safe-area-inset-bottom))",
          background: `linear-gradient(180deg, transparent, ${P.BG} 30%)`,
        }}
      >
        <button
          type="button"
          className="tap btn"
          onClick={onScanAgain}
          style={{
            width: "100%",
            background: alarm ? P.RED : P.INK,
            color: alarm ? "#fff" : P.BG,
            border: 0,
            borderRadius: 99,
            padding: 15,
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: 0.3,
            fontFamily: "inherit",
            animation: alarm ? "pulseRed 1.6s ease-out 1" : "none",
          }}
        >
          {alarm ? "Verstanden — neu scannen" : "Nächsten Code scannen →"}
        </button>
      </div>
    </AppShell>
  );
}
