"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ACCENTS, type Accent, type Palette, type ThemeMode } from "@/lib/theme";
import { ALLERGEN_LIST } from "@/lib/allergens/profile";
import { FONT_SCALES, FONT_SCALE_LABEL } from "@/lib/fontScale";
import type { Prefs } from "@/components/usePrefs";
import type { ImportOutcome } from "@/components/useBackup";
import type { ImportError } from "@/lib/backup";
import { AppShell, IconButton, Mono, SectionTitle, TabBar, TopBar, type Tab } from "@/components/ui";
import { Download, IdCard, RotateCcw, Siren, Upload, User } from "lucide-react";

function importErrorCopy(error: ImportError): string {
  switch (error) {
    case "unsupported-format":
      return "Diese Datei ist kein peaNOT-Backup.";
    case "unsupported-version":
      return "Dieses Backup stammt aus einer neueren App-Version und kann hier nicht gelesen werden.";
    default:
      return "Diese Datei konnte nicht gelesen werden — ist es ein peaNOT-Backup?";
  }
}

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
      <Mono style={{ opacity: 0.7, marginBottom: 8, display: "block" }}>{title}</Mono>
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
  disabled,
  onChange,
}: {
  P: Palette;
  label: string;
  sub?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
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
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
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

/**
 * A pill in a segmented choice row (Darstellung, Schriftgröße). The visible
 * pill stays its original small size; the button itself grows to the 44×44pt
 * touch-target minimum via the invisible .hit44 hit-area, so the choice
 * doesn't shrink to fit.
 */
function SegButton({
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
      style={{ background: "transparent", border: 0, padding: 0, fontFamily: "inherit" }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "7px 12px",
          borderRadius: 99,
          fontSize: 12.5,
          fontWeight: 600,
          background: active ? P.INK : "transparent",
          color: active ? P.BG : P.INK,
          border: `1.5px solid ${active ? P.INK : `${P.INK}33`}`,
        }}
      >
        {children}
      </span>
    </button>
  );
}

export default function ProfileScreen({
  P,
  prefs,
  setPref,
  importPrefs,
  onReplayOnboarding,
  onOpenCard,
  onOpenNotfall,
  onTab,
  onExport,
  onImportFile,
}: {
  P: Palette;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** Applies imported prefs (F1) — only ever called after the user confirms
   * in the "Daten importieren" flow below, never automatically. */
  importPrefs: (incoming: Partial<Prefs>) => void;
  onReplayOnboarding: () => void;
  onOpenCard: () => void;
  /** F4: opens the family's Notfallplan (112 + Adrenalin-Autoinjektor-Plan). */
  onOpenNotfall: () => void;
  onTab: (t: Tab) => void;
  /** Builds and shares/downloads the backup file (F1) — see components/useBackup.ts. */
  onExport: () => void;
  /** Parses+merges an imported backup file's raw text (F1); prefs inside it
   * are returned but not applied — see importPrefs above. */
  onImportFile: (raw: string) => ImportOutcome;
}) {
  // iOS Safari never shipped navigator.vibrate — checked client-side only, so
  // the toggle starts enabled and settles into its real (disabled) state
  // right after mount instead of guessing during SSR.
  const [vibrateUnsupported, setVibrateUnsupported] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && !("vibrate" in navigator)) {
      setVibrateUnsupported(true);
    }
  }, []);

  // F1 export/import UI state — transient, so it resets whenever the screen
  // remounts rather than being persisted anywhere.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [pendingPrefs, setPendingPrefs] = useState<Partial<Prefs> | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setPendingPrefs(null);
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const outcome = onImportFile(raw);
      if (!outcome.ok) {
        setImportSummary(importErrorCopy(outcome.error));
        return;
      }
      setImportSummary(
        `Übernommen: ${outcome.historyCount} Scan(s), ${outcome.notesCount} Notiz(en), ${outcome.packmatchCount} Packungs-Antwort(en), ${outcome.favoritesCount} Favorit(en).`,
      );
      setPendingPrefs(Object.keys(outcome.prefs).length > 0 ? outcome.prefs : null);
    };
    reader.onerror = () => setImportSummary("Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  }

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          <IconButton
            P={P}
            icon={<IdCard size={18} aria-hidden="true" />}
            label="Allergie-Karte öffnen"
            onClick={onOpenCard}
          />
        }
      />
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
            <User size={28} aria-hidden="true" />
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
            <Mono style={{ opacity: 0.7 }}>kein Konto · alles auf diesem Gerät</Mono>
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
            <div style={{ display: "flex", gap: 0 }}>
              {(Object.keys(ACCENTS) as Accent[]).map((key) => {
                const active = prefs.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="tap hit44"
                    aria-label={key}
                    aria-pressed={active}
                    onClick={() => setPref("accent", key)}
                    style={{ background: "transparent", border: 0, padding: 0 }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: "block",
                        width: 26,
                        height: 26,
                        borderRadius: 99,
                        background: ACCENTS[key],
                        border: active ? `2px solid ${P.INK}` : `2px solid transparent`,
                        boxShadow: active ? `0 0 0 2px ${P.BG}, 0 0 0 3px ${P.INK}` : "none",
                      }}
                    />
                  </button>
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
              ).map(([key, label]) => (
                <SegButton
                  key={key}
                  P={P}
                  active={prefs.theme === key}
                  onClick={() => setPref("theme", key)}
                >
                  {label}
                </SegButton>
              ))}
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
            <div style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>Schriftgröße</div>
            <div style={{ display: "flex", gap: 6 }}>
              {FONT_SCALES.map((scale) => (
                <SegButton
                  key={scale}
                  P={P}
                  active={prefs.fontScale === scale}
                  onClick={() => setPref("fontScale", scale)}
                >
                  {FONT_SCALE_LABEL[scale]}
                </SegButton>
              ))}
            </div>
          </div>
        </Section>

        <Section P={P} title="Scanner">
          <Toggle
            P={P}
            label="Kamera beim Öffnen automatisch starten"
            sub="iPhone fragt trotzdem bei jedem Start kurz nach Zugriff."
            checked={prefs.autoStartCamera}
            onChange={(v) => setPref("autoStartCamera", v)}
          />
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
            sub={vibrateUnsupported ? "Auf dem iPhone nicht verfügbar" : undefined}
            checked={prefs.haptic}
            disabled={vibrateUnsupported}
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

        <Section P={P} title="Für den Notfall">
          <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7, lineHeight: 1.4 }}>
            112-Anrufknopf, euer Adrenalin-Autoinjektor-Plan und wo das
            Notfallset liegt — für euch, aber auch für Oma, Babysitter oder
            die Lehrkraft, falls sie das Handy übernehmen.
          </p>
          <button
            type="button"
            className="tap"
            onClick={onOpenNotfall}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              color: P.RED,
              border: `1.5px solid ${P.RED}55`,
              borderRadius: 99,
              padding: "11px 14px",
              fontWeight: 700,
              fontSize: 13.5,
              fontFamily: "inherit",
            }}
          >
            <Siren size={15} aria-hidden="true" /> Notfallplan öffnen
          </button>
        </Section>

        <Section P={P} title="Daten">
          {[
            ["Open Food Facts", "Live-Abfrage je Scan"],
            ["Verlauf", "Lokal auf diesem Gerät gespeichert"],
            ["Notizen", "Lokal, pro Produkt gespeichert"],
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
                <Mono style={{ opacity: 0.7 }}>{d}</Mono>
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
            <RotateCcw size={14} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />Onboarding nochmal zeigen
          </button>

          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px solid ${P.INK}14`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Sichern &amp; übertragen</div>
            <p style={{ margin: "3px 0 10px", fontSize: 12.5, opacity: 0.7, lineHeight: 1.4 }}>
              Eine Datei mit Verlauf, Notizen, Favoriten und Einstellungen — z. B. per
              AirDrop aufs andere Familien-Handy.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="tap"
                onClick={() => {
                  setImportSummary(null);
                  setPendingPrefs(null);
                  onExport();
                }}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "transparent",
                  color: P.INK,
                  border: `1.5px solid ${P.INK}33`,
                  borderRadius: 99,
                  padding: "10px 10px",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                <Download size={14} aria-hidden="true" />
                Exportieren
              </button>
              <button
                type="button"
                className="tap"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "transparent",
                  color: P.INK,
                  border: `1.5px solid ${P.INK}33`,
                  borderRadius: 99,
                  padding: "10px 10px",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                <Upload size={14} aria-hidden="true" />
                Importieren
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Backup-Datei auswählen"
                onChange={handleFileChange}
              />
            </div>

            {importSummary ? (
              <p role="status" style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.4 }}>
                {importSummary}
              </p>
            ) : null}

            {pendingPrefs ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: `${P.ACCENT}0D`,
                  border: `1.5px solid ${P.ACCENT}`,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  Auch die Einstellungen übernehmen?
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
                  Akzentfarbe, Allergene, Alarm-Optionen und Schriftgröße aus der Datei
                  ersetzen deine jetzigen Einstellungen auf diesem Gerät.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="tap"
                    onClick={() => {
                      importPrefs(pendingPrefs);
                      setPendingPrefs(null);
                    }}
                    style={{
                      flex: 1,
                      background: P.INK,
                      color: P.BG,
                      border: 0,
                      borderRadius: 99,
                      padding: "9px 12px",
                      fontWeight: 700,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  >
                    Übernehmen
                  </button>
                  <button
                    type="button"
                    className="tap"
                    onClick={() => setPendingPrefs(null)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: P.INK,
                      border: `1px solid ${P.INK}33`,
                      borderRadius: 99,
                      padding: "9px 12px",
                      fontWeight: 600,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  >
                    Nicht übernehmen
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Section>

        <p
          style={{
            fontSize: 11,
            // Raised from 0.5 — "Bei Notfall: 112" is content, not decoration.
            opacity: 0.7,
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
