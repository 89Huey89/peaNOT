"use client";

import type { ReactNode } from "react";
import { ACCENTS, type Accent, type Palette, type ThemeMode } from "@/lib/theme";
import { ALLERGEN_LIST } from "@/lib/allergens/profile";
import type { Prefs } from "@/components/usePrefs";
import { AppShell, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";

function Section({
  P,
  title,
  children,
}: {
  P: Palette;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>{title}</Mono>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: P.PAPER,
          border: `1px solid ${P.INK}14`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Toggle({
  P,
  label,
  sub,
  checked,
  onChange,
}: {
  P: Palette;
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="tap"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "8px 0",
        justifyContent: "space-between",
        width: "100%",
        background: "transparent",
        border: 0,
        fontFamily: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{label}</span>
        {sub ? (
          <span style={{ display: "block", fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {sub}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 42,
          height: 24,
          borderRadius: 99,
          position: "relative",
          background: checked ? P.GREEN : `${P.INK}22`,
          transition: "background .2s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 20,
            height: 20,
            borderRadius: 99,
            background: "#fff",
            transition: "left .2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </span>
    </button>
  );
}

export default function ProfileScreen({
  P,
  prefs,
  setPref,
  onReplayOnboarding,
  onTab,
}: {
  P: Palette;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  onReplayOnboarding: () => void;
  onTab: (t: Tab) => void;
}) {
  return (
    <AppShell P={P}>
      <TopBar P={P} />
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 22px 96px" }}>
        <SectionTitle>Dein Profil</SectionTitle>

        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: P.PAPER,
            border: `1px solid ${P.INK}14`,
            marginBottom: 14,
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 99,
              background: P.ACCENT,
              color: P.INK,
              display: "grid",
              placeItems: "center",
              fontFamily: "'Fraunces', serif",
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            ◐
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 700,
                fontSize: 18,
                lineHeight: 1.1,
              }}
            >
              Privat &amp; lokal
            </div>
            <Mono style={{ opacity: 0.55 }}>kein Konto · alles auf diesem Gerät</Mono>
          </div>
        </div>

        <Section P={P} title="Aussehen">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Akzentfarbe</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(Object.keys(ACCENTS) as Accent[]).map((key) => {
                const active = prefs.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="tap"
                    aria-label={key}
                    onClick={() => setPref("accent", key)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      background: ACCENTS[key],
                      border: active ? `2px solid ${P.INK}` : `2px solid transparent`,
                      boxShadow: active ? `0 0 0 2px ${P.BG}, 0 0 0 3px ${P.INK}` : "none",
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0 4px",
              marginTop: 8,
              borderTop: `1px solid ${P.INK}14`,
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>Darstellung</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  ["light", "Hell"],
                  ["dark", "Dunkel"],
                  ["system", "System"],
                ] as [ThemeMode, string][]
              ).map(([key, label]) => {
                const active = prefs.theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="tap"
                    aria-pressed={active}
                    onClick={() => setPref("theme", key)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 99,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      background: active ? P.INK : "transparent",
                      color: active ? P.BG : P.INK,
                      border: `1.5px solid ${active ? P.INK : `${P.INK}33`}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section P={P} title="Meine Allergene">
          <p style={{ margin: "0 0 6px", fontSize: 13, opacity: 0.7, lineHeight: 1.4 }}>
            Wähle aus, worauf wir jedes Produkt prüfen sollen. Bei einem Treffer schlagen wir Alarm.
          </p>
          {ALLERGEN_LIST.map((profile, i) => {
            const checked = prefs.selectedAllergens.includes(profile.key);
            return (
              <div
                key={profile.key}
                style={i > 0 ? { borderTop: `1px solid ${P.INK}14` } : undefined}
              >
                <Toggle
                  P={P}
                  label={profile.label}
                  checked={checked}
                  onChange={(v) => {
                    const next = v
                      ? [...prefs.selectedAllergens, profile.key]
                      : prefs.selectedAllergens.filter((k) => k !== profile.key);
                    setPref("selectedAllergens", next);
                  }}
                />
              </div>
            );
          })}
          {prefs.selectedAllergens.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>
              Nichts ausgewählt – ersatzweise prüfen wir auf Erdnuss.
            </p>
          ) : null}
        </Section>

        <Section P={P} title="Wie warnen wir dich?">
          <Toggle
            P={P}
            label="Vibrieren bei Treffer"
            checked={prefs.haptic}
            onChange={(v) => setPref("haptic", v)}
          />
          <Toggle
            P={P}
            label="Ton bei Treffer"
            checked={prefs.sound}
            onChange={(v) => setPref("sound", v)}
          />
          <Toggle
            P={P}
            label="Spuren-Warnung wie Treffer behandeln"
            sub="Empfohlen für Anaphylaxie-Patient:innen"
            checked={prefs.tracesStrict}
            onChange={(v) => setPref("tracesStrict", v)}
          />
        </Section>

        <Section P={P} title="Daten">
          {[
            ["Open Food Facts", "Live-Abfrage je Scan"],
            ["Verlauf", "Lokal auf diesem Gerät gespeichert"],
          ].map(([n, d]) => (
            <div
              key={n}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: `1px solid ${P.INK}14`,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{n}</div>
                <Mono style={{ opacity: 0.55 }}>{d}</Mono>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="tap"
            onClick={onReplayOnboarding}
            style={{
              marginTop: 12,
              width: "100%",
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
            ↺ &nbsp;Onboarding nochmal zeigen
          </button>
        </Section>

        <p
          style={{
            fontSize: 11,
            opacity: 0.5,
            textAlign: "center",
            margin: "18px 0 0",
            lineHeight: 1.5,
          }}
        >
          peaNOT · ein Hilfsmittel, kein Ersatz für medizinischen Rat.
          <br />
          Bei Notfall: 112
        </p>
      </div>

      <TabBar P={P} tab="profil" onTab={onTab} />
    </AppShell>
  );
}
