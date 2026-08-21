import type { Palette } from "@/lib/theme";
import { verdictColor, type Verdict } from "@/lib/verdict";
import { AppShell, Logo, Mono } from "@/components/ui";
import { ArrowRight } from "lucide-react";

// Verdict, the word peaNOT uses for it, and what it means for you. The second
// line says the consequence rather than repeating the name — "sicher" has to
// read as "nothing found in the data", never as a guarantee.
const STATES: [Verdict, string, string][] = [
  ["safe", "sicher", "Nichts gefunden"],
  ["danger", "treffer", "Nicht essen"],
  ["trace", "spuren", "Nur mit Vorsicht"],
  ["unknown", "keine daten", "Selbst prüfen"],
];

export default function OnboardingScreen({
  P,
  onDone,
}: {
  P: Palette;
  onDone: () => void;
}) {
  return (
    <AppShell P={P}>
      <div
        style={{
          padding: "calc(34px + env(safe-area-inset-top)) 24px 0",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Logo P={P} size={32} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            margin: "20px 0",
          }}
        >
          <Mono style={{ opacity: 0.6 }}>willkommen</Mono>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 800,
              fontSize: 42,
              lineHeight: 1.0,
              letterSpacing: -1.2,
              marginTop: 8,
              textWrap: "balance",
            }}
          >
            Scan&nbsp;den&nbsp;Code.
            <br />
            <span style={{ fontStyle: "italic", color: P.ACCENT }}>
              Wir prüfen die Erdnuss.
            </span>
          </div>
          <p
            style={{
              fontSize: 14.5,
              marginTop: 18,
              lineHeight: 1.5,
              opacity: 0.78,
              maxWidth: "30ch",
            }}
          >
            peaNOT liest den Barcode, vergleicht Zutaten und Allergenhinweise und sagt
            dir in unter zwei Sekunden, ob du das Produkt essen kannst.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 24,
            }}
          >
            {STATES.map(([k, name, meaning]) => (
              <div
                key={k}
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${P.INK}1f`,
                  borderRadius: 10,
                  background: P.PAPER,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 99,
                      background: verdictColor(k, P),
                    }}
                  />
                  <Mono style={{ opacity: 0.7 }}>{name}</Mono>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{meaning}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 0 32px" }}>
          <button
            type="button"
            className="tap btn"
            onClick={onDone}
            style={{
              width: "100%",
              background: P.INK,
              color: P.BG,
              border: 0,
              borderRadius: 99,
              padding: 16,
              fontWeight: 700,
              fontSize: 15.5,
              fontFamily: "inherit",
              letterSpacing: 0.2,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Loslegen <ArrowRight size={16} aria-hidden="true" /></span>
          </button>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <Mono style={{ opacity: 0.7 }}>Wir bitten gleich um Kamera-Zugriff</Mono>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
