"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import type { EmergencyPlan } from "@/lib/emergency";
import { DEFAULT_EMERGENCY_STEPS, EMERGENCY_NOTES_MAX } from "@/lib/emergency";
import { AppShell, Mono, SectionTitle } from "@/components/ui";
import { ArrowLeft, Pencil, Phone, Plus, RotateCcw, Trash2 } from "lucide-react";

/** Shared card chrome for the two sections below — same shape as
 * ProfileScreen's local `Section`, kept local here since neither screen
 * imports from the other. */
function Card({ P, children }: { P: Palette; children: ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 16px 14px",
        borderRadius: 14,
        background: P.PAPER,
        border: `1px solid ${P.INK}14`,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

const pillButton = (P: Palette, filled: boolean): CSSProperties => ({
  background: filled ? P.INK : "transparent",
  color: filled ? P.BG : P.INK,
  border: `1.5px solid ${filled ? P.INK : `${P.INK}33`}`,
  borderRadius: 99,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 13.5,
  fontFamily: "inherit",
});

export default function EmergencyScreen({
  P,
  plan,
  onPlanChange,
  onBack,
}: {
  P: Palette;
  plan: EmergencyPlan;
  /** Persists the whole plan (usePrefs' setPref("emergencyPlan", …)) — this
   * screen never reads/writes localStorage directly, same division of
   * concerns as PhraseScreen's cardNote. */
  onPlanChange: (plan: EmergencyPlan) => void;
  onBack: () => void;
}) {
  // Starts in edit mode until the family has confirmed or saved at least
  // once (item F4: "Vorlage, die der Nutzer bestätigt/editiert") — so a
  // first visit asks for a decision instead of quietly showing app-authored
  // text as if it were the family's own plan.
  const [editingSteps, setEditingSteps] = useState(!plan.confirmed);
  const [draftSteps, setDraftSteps] = useState<string[]>(plan.steps);

  function startEdit() {
    setDraftSteps(plan.steps);
    setEditingSteps(true);
  }
  function cancelEdit() {
    setEditingSteps(false);
  }
  function saveDraft() {
    const cleaned = draftSteps.map((s) => s.trim()).filter((s) => s.length > 0);
    if (cleaned.length === 0) return;
    onPlanChange({ ...plan, steps: cleaned, confirmed: true });
    setEditingSteps(false);
  }
  function acceptTemplate() {
    onPlanChange({ ...plan, confirmed: true });
    setEditingSteps(false);
  }
  function resetDraftToTemplate() {
    setDraftSteps([...DEFAULT_EMERGENCY_STEPS]);
  }
  function updateDraftStep(i: number, value: string) {
    setDraftSteps((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }
  function removeDraftStep(i: number) {
    setDraftSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  const canSave = draftSteps.some((s) => s.trim().length > 0);

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
        <SectionTitle>Notfallplan</SectionTitle>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, opacity: 0.7, lineHeight: 1.5 }}>
          Für Oma, Babysitter oder die Lehrkraft, falls du ihnen im Notfall das
          Handy in die Hand drückst. Dies ist der Plan eurer Familie — keine
          medizinische Beratung durch die App.
        </p>

        <a
          href="tel:112"
          className="tap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "17px 14px",
            borderRadius: 99,
            background: P.RED,
            color: P.FILL_TEXT,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: 0.2,
            marginBottom: 6,
          }}
        >
          <Phone size={20} aria-hidden="true" /> 112 anrufen
        </a>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 11.5,
            opacity: 0.6,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Öffnet den Wähler — iOS fragt vor dem Anruf noch einmal nach.
        </p>

        <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>
          Adrenalin-Notfallplan
        </Mono>

        <Card P={P}>
          {editingSteps ? (
            <>
              {!plan.confirmed ? (
                <p style={{ margin: "0 0 12px", fontSize: 12.5, opacity: 0.75, lineHeight: 1.45 }}>
                  Das ist eine allgemeine Vorlage, keine Anweisung für euren
                  Fall. Prüft sie mit eurem Ärzt:innen-Team, passt sie an und
                  speichert eure eigene Version.
                </p>
              ) : null}
              {draftSteps.map((step, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      marginTop: 6,
                      borderRadius: 99,
                      background: `${P.INK}0F`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <textarea
                    aria-label={`Schritt ${i + 1}`}
                    value={step}
                    onChange={(e) => updateDraftStep(i, e.target.value)}
                    rows={2}
                    style={{
                      flex: 1,
                      resize: "vertical",
                      padding: "9px 11px",
                      borderRadius: 10,
                      background: P.BG,
                      color: P.INK,
                      border: `1.5px solid ${P.INK}22`,
                      fontFamily: "inherit",
                      // >=16px so iOS Safari doesn't zoom the page on focus.
                      fontSize: 16,
                      lineHeight: 1.4,
                    }}
                  />
                  <button
                    type="button"
                    className="tap hit44"
                    onClick={() => removeDraftStep(i)}
                    aria-label={`Schritt ${i + 1} entfernen`}
                    style={{
                      flexShrink: 0,
                      background: "transparent",
                      border: 0,
                      color: P.DIM,
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="tap"
                onClick={() => setDraftSteps((prev) => [...prev, ""])}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                  background: "transparent",
                  border: 0,
                  color: P.INK,
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: "6px 0",
                }}
              >
                <Plus size={14} aria-hidden="true" /> Schritt hinzufügen
              </button>

              {!canSave ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: P.RED, lineHeight: 1.4 }}>
                  Mindestens ein Schritt wird benötigt.
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: `1px solid ${P.INK}14`,
                }}
              >
                <button
                  type="button"
                  className="tap"
                  onClick={resetDraftToTemplate}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "transparent",
                    border: 0,
                    color: P.DIM,
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "6px 0",
                  }}
                >
                  <RotateCcw size={12} aria-hidden="true" /> Vorlage einsetzen
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  {plan.confirmed ? (
                    <button type="button" className="tap" onClick={cancelEdit} style={pillButton(P, false)}>
                      Abbrechen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="tap"
                    onClick={saveDraft}
                    disabled={!canSave}
                    style={{ ...pillButton(P, true), opacity: canSave ? 1 : 0.5 }}
                  >
                    Speichern
                  </button>
                </div>
              </div>

              {!plan.confirmed ? (
                <button
                  type="button"
                  className="tap"
                  onClick={acceptTemplate}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    background: "transparent",
                    border: `1.5px dashed ${P.INK}33`,
                    borderRadius: 12,
                    padding: "9px 12px",
                    color: P.INK,
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  Vorlage unverändert übernehmen
                </button>
              ) : null}
            </>
          ) : (
            <>
              <ol style={{ margin: 0, padding: "0 0 0 22px" }}>
                {plan.steps.map((step, i) => (
                  <li
                    key={i}
                    style={{ fontSize: 15, lineHeight: 1.55, marginBottom: i < plan.steps.length - 1 ? 10 : 0 }}
                  >
                    {step}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="tap"
                onClick={startEdit}
                aria-label="Notfallplan bearbeiten"
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: 0,
                  color: P.INK,
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: "6px 0",
                }}
              >
                <Pencil size={13} aria-hidden="true" /> Bearbeiten
              </button>
            </>
          )}
        </Card>

        <Mono style={{ opacity: 0.55, marginBottom: 8, display: "block" }}>
          Medikament, Dosis, Notfallset-Ort
        </Mono>
        <textarea
          aria-label="Medikament, Dosis, Notfallset-Ort"
          value={plan.notes}
          onChange={(e) =>
            onPlanChange({ ...plan, notes: e.target.value.slice(0, EMERGENCY_NOTES_MAX) })
          }
          placeholder="z. B. Jext 150 µg, 2×, im blauen Rucksack im Flur …"
          rows={3}
          maxLength={EMERGENCY_NOTES_MAX}
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

        <p
          style={{
            fontSize: 11,
            opacity: 0.6,
            textAlign: "center",
            margin: "20px 0 0",
            lineHeight: 1.5,
          }}
        >
          peaNOT ist ein Hilfsmittel, kein Ersatz für ärztlichen Rat. Besprecht
          und aktualisiert diesen Plan mit eurem Behandlungsteam.
        </p>
      </div>
    </AppShell>
  );
}
