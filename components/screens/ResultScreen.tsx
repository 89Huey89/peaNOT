"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Palette } from "@/lib/theme";
import type { ProductResult } from "@/lib/types";
import { VERDICT, resolveVerdict, verdictColor, verdictCopy, verdictGlyph } from "@/lib/verdict";
import { CAVEATS, hasIdentityCaveat } from "@/lib/caveats";
import { applyPackMatch } from "@/lib/packmatch";
import { offProductUrl } from "@/lib/off/link";
import { usePackMatch } from "@/components/usePackMatch";
import { useNote } from "@/components/useNote";
import { NOTE_MAX_LENGTH } from "@/lib/notes";
import { usePhoto } from "@/components/usePhoto";
import { getProfiles, type AllergenProfile } from "@/lib/allergens/profile";
import { buildAllergenChecklist, type AllergenChecklist } from "@/lib/allergens/checklist";
import { beep, vibrate } from "@/lib/feedback";
import { formatRelative, isDataStale } from "@/lib/time";
import type { HistoryEntry } from "@/components/useHistory";
import { buildShareText } from "@/lib/share";
import { AppShell, Chip, IconButton, Mono, Stamp, TopBar, type ChipTone } from "@/components/ui";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  ChevronDown,
  ExternalLink,
  Pencil,
  RotateCcw,
  Share,
  Star,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";

function shortEan(ean: string): string {
  return ean.length > 8 ? `${ean.slice(0, 4)}…${ean.slice(-4)}` : ean;
}

/**
 * F10: whether the product title likely needs the "tap to expand" control.
 * Not a real layout measurement (there is no DOM to measure before first
 * paint, and jsdom under test has no layout at all) — a character-count
 * heuristic instead, in the same spirit as stampWordSize/stampSubSize in
 * components/ui.tsx. The title column is roughly 220-240px wide next to the
 * 56px photo, in Fraunces 700 at ~20px — call it ~18 characters per line, so
 * three lines hold ~54 comfortably. Erring low (showing the control a little
 * more often than strictly necessary) is the safe direction: the alternative
 * — clamping text with no way to read the rest — is the actual bug this
 * fixes, so a false positive here just costs an unneeded tap affordance,
 * never a hidden product name.
 */
function titleMayOverflow(name: string): boolean {
  return name.length > 50;
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDataDate(timestamp: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp * 1000));
}

/** Recall notices carry ms timestamps, unlike the OFF record's seconds. */
function formatRecallDate(timestampMs: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestampMs));
}

/**
 * Link into the Open Food Facts record. Shown wherever peaNOT tells the user
 * its data may be wrong or incomplete: the fix belongs in the database, where
 * it helps the next person scanning the same code.
 */
function OffRecordLink({ barcode, label, P }: { barcode: string; label: string; P: Palette }) {
  return (
    <a
      href={offProductUrl(barcode)}
      target="_blank"
      rel="noopener noreferrer"
      className="tap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
        color: P.INK,
        fontSize: 12.5,
        fontWeight: 600,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {label}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
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
          color: P.FILL_TEXT,
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

interface UnknownCardCopy {
  heading: string;
  body: string;
  retryLabel: string;
  /** A network/server failure gets a distinct, more urgent retry framing —
   * the product may well be in the database, unlike a genuine not-found. */
  network: boolean;
}

/**
 * Copy for the "no verdict" card, branched by *why* there is no verdict.
 * Previously every KEINE_DATEN rendered the same "Kein Eintrag gefunden" —
 * misleading for a transient network/server failure, where the right move is
 * "try again near a signal", not "give up and read the pack".
 */
function unknownCardCopy(result: ProductResult, profiles: AllergenProfile[]): UnknownCardCopy {
  const subject =
    profiles.length === 1 && profiles[0]
      ? `${profiles[0].label} kann`
      : "Deine Allergene können";
  if (result.networkError === true || result.kind === "error") {
    return {
      heading: "Gerade keine Verbindung",
      body: `Server oder Verbindung waren gerade nicht erreichbar — das ist kein Ergebnis für dieses Produkt, es kann trotzdem in der Datenbank sein. ${subject} deshalb nicht ausgeschlossen werden.`,
      retryLabel: "Jetzt erneut prüfen",
      network: true,
    };
  }
  if (result.kind === "no-data") {
    return {
      heading: "Eintrag ohne Zutatenangaben",
      body: `Dieser Barcode ist in der Datenbank, aber ohne Zutaten- oder Allergenangaben. ${subject} nicht ausgeschlossen werden — im Zweifel das Produkt meiden.`,
      retryLabel: "Erneut prüfen",
      network: false,
    };
  }
  return {
    heading: "Kein Eintrag gefunden",
    body: `Zu diesem Barcode liegen keine Zutaten- oder Allergendaten vor. ${subject} nicht ausgeschlossen werden — im Zweifel das Produkt meiden.`,
    retryLabel: "Erneut prüfen",
    network: false,
  };
}

/**
 * F3: a collapsible reading-help checklist for the KEINE_DATEN (and
 * pack-mismatch) result — "these words mean <allergen>", built from the same
 * textKeywords the detection engine matches (see lib/allergens/checklist.ts).
 * No OCR, no verdict of its own: purely a cheat sheet for the human
 * comparison the app is already asking for.
 */
function AllergenChecklistCard({
  P,
  checklist,
  open,
  onToggle,
}: {
  P: Palette;
  checklist: AllergenChecklist[];
  open: boolean;
  onToggle: () => void;
}) {
  const heading =
    checklist.length === 1 && checklist[0]
      ? `Diese Begriffe bedeuten ${checklist[0].label}`
      : "Diese Begriffe bedeuten eines deiner Allergene";
  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 10,
        background: `${P.INK}05`,
        border: `1px dashed ${P.INK}33`,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        className="tap"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="allergen-checklist"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 14px",
          background: "transparent",
          border: 0,
          color: P.INK,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <BookOpen size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{heading}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s ease",
          }}
        />
      </button>
      {open ? (
        <div id="allergen-checklist" style={{ padding: "0 14px 14px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>
            Wonach du auf der Verpackung suchst — dieselben Begriffe, nach denen
            peaNOT sonst auch sucht. Ersetzt nicht die Zutatenliste, hilft nur
            beim Lesen.
          </p>
          {checklist.map((entry) => (
            <div key={entry.key} style={{ marginBottom: 10 }}>
              {checklist.length > 1 ? (
                <Mono style={{ opacity: 0.6, display: "block", marginBottom: 5 }}>
                  {entry.label}
                </Mono>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {entry.terms.map((term) => (
                  <span
                    key={term}
                    style={{
                      padding: "7px 11px",
                      borderRadius: 8,
                      background: P.PAPER,
                      border: `1px solid ${P.INK}22`,
                      fontWeight: 700,
                      // Large enough to hold next to the pack's own print for
                      // a direct comparison, per the item's own requirement.
                      fontSize: 15,
                    }}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * F-E: the user's own photo of a barcode's ingredients list (see
 * components/usePhoto.ts / lib/photos.ts). Shown for every product — a
 * green result can be worth documenting too, e.g. before a recipe change —
 * but earns its keep most at KEINE_DATEN or a reported pack mismatch, where
 * "go read the label yourself" is otherwise the end of the road, every
 * single time the same code is scanned again.
 *
 * Purely a memory aid: no OCR, no verdict of its own — this card only ever
 * displays what the user themselves photographed and when they did it (see
 * lib/photos.ts's header comment for the full reasoning). The age warning
 * below is the honesty half of that: a photo, unlike this card's wording,
 * cannot know whether the recipe behind it has changed since.
 */
function IngredientPhotoCard({
  P,
  productName,
  photoUrl,
  takenAt,
  stale,
  saving,
  error,
  onCapture,
  onRemove,
}: {
  P: Palette;
  productName: string | null;
  photoUrl: string | null;
  takenAt: number | null;
  stale: boolean;
  saving: boolean;
  error: string | null;
  onCapture: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear immediately so picking the very same file again still fires a
    // change event (iOS otherwise treats an unchanged value as a no-op).
    e.target.value = "";
    if (file) onCapture(file);
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 10,
        background: `${P.INK}05`,
        border: `1px dashed ${P.INK}33`,
      }}
    >
      {/* capture="environment" is what makes iOS Safari open the camera
          directly instead of the photo library picker. Screen-reader-only
          (same sr-only class as the backup-import file input in
          ProfileScreen.tsx), not display:none — some browsers won't let a
          fully hidden file input be triggered at all. The visible buttons
          below open it via the ref. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
        aria-label="Foto der Zutatenliste aufnehmen"
      />

      <Mono style={{ opacity: 0.6 }}>foto · zutatenliste</Mono>

      {photoUrl ? (
        <>
          <img
            src={photoUrl}
            alt={
              productName
                ? `Selbst aufgenommenes Foto der Zutatenliste von ${productName}`
                : "Selbst aufgenommenes Foto der Zutatenliste"
            }
            style={{
              display: "block",
              width: "100%",
              maxHeight: 320,
              objectFit: "contain",
              borderRadius: 10,
              marginTop: 8,
              // Same PAPER-derived letterbox fill as the header/pack-match
              // photos above (F12) — a hardcoded color would clash in dark
              // mode whenever objectFit leaves a visible border.
              background: P.PAPER,
              border: `1px solid ${P.INK}22`,
            }}
          />
          {takenAt ? (
            <Mono style={{ opacity: 0.65, display: "block", marginTop: 6 }}>
              aufgenommen · {formatRelative(takenAt)}
            </Mono>
          ) : null}
          {stale ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.4,
                color: P.AMBER_TEXT,
              }}
            >
              Dieses Foto ist schon einige Monate alt — Rezeptur oder Packung können sich
              seither geändert haben. Im Zweifel zählt die aktuelle Packung, nicht das Foto.
            </div>
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>
              Nur eine Erinnerung ans nächste Mal — ersetzt nie den Blick auf die aktuelle
              Packung.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="tap hit44"
              onClick={pickFile}
              disabled={saving}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "transparent",
                color: P.INK,
                border: `1px solid ${P.INK}44`,
                borderRadius: 99,
                padding: "9px 12px",
                fontWeight: 600,
                fontSize: 12.5,
                fontFamily: "inherit",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Camera size={14} aria-hidden="true" />
              Neu aufnehmen
            </button>
            <button
              type="button"
              className="tap hit44"
              onClick={() => {
                if (window.confirm("Foto der Zutatenliste wirklich löschen?")) onRemove();
              }}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                color: P.RED,
                border: `1px solid ${P.RED}55`,
                borderRadius: 99,
                padding: "9px 12px",
                fontWeight: 600,
                fontSize: 12.5,
                fontFamily: "inherit",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Löschen
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "5px 0 10px", fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>
            Einmal die Zutatenliste fotografieren, statt sie beim nächsten Einkauf wieder von
            vorn zu lesen. Ersetzt nie den Blick auf die aktuelle Packung.
          </p>
          <button
            type="button"
            className="tap hit44"
            onClick={pickFile}
            disabled={saving}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              color: P.INK,
              border: `1.5px solid ${P.ACCENT}`,
              borderRadius: 99,
              padding: "11px 12px",
              fontWeight: 700,
              fontSize: 13.5,
              fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Camera size={15} aria-hidden="true" />
            Zutatenliste fotografieren
          </button>
        </>
      )}

      {/* The resize step (createImageBitmap + canvas) is a visible beat on a
          multi-MB iPhone photo — say so rather than leaving the screen
          looking stuck. role="status" so it's announced without stealing
          focus the way the verdict's assertive live region does. */}
      {saving ? (
        <div role="status">
          <Mono style={{ opacity: 0.6, display: "block", marginTop: 8 }}>wird verkleinert…</Mono>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: P.RED, lineHeight: 1.4 }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function ResultScreen({
  P,
  result,
  lastKnown,
  worsenedFrom,
  selectedAllergens,
  tracesStrict,
  haptic,
  sound,
  loading,
  isFavorite,
  activePersonName,
  personCount,
  onToggleFavorite,
  onBack,
  onScanAgain,
  onRetry,
}: {
  P: Palette;
  result: ProductResult;
  /** The barcode's most recent history entry from *before* this lookup —
   * shown only alongside a network-error result (see result.networkError). */
  lastKnown: HistoryEntry | null;
  /** The barcode's prior history entry, set only when this result is a proven
   * *worsening* vs. that entry — informational, never alters the verdict. */
  worsenedFrom: HistoryEntry | null;
  selectedAllergens: string[];
  tracesStrict: boolean;
  haptic: boolean;
  sound: boolean;
  loading: boolean;
  /** F2: whether this barcode is currently starred as a staple. */
  isFavorite: boolean;
  /** F (part 2): name of the person this verdict was just checked for. Only
   * ever rendered/appended when `personCount > 1` — see that prop. */
  activePersonName: string;
  /** F (part 2): total number of people on this device (prefs.persons.length).
   * At exactly one person this screen renders byte-for-byte like before this
   * feature existed — no line, no share-text change, nothing new to notice. */
  personCount: number;
  onToggleFavorite: () => void;
  onBack: () => void;
  onScanAgain: () => void;
  onRetry: () => void;
}) {
  const caveats = result.caveats ?? [];
  const { answer, answeredAt, answerPackMatch } = usePackMatch(result.barcode);
  // F5: a family-only note per product — purely informational, read nowhere
  // that resolves a verdict (see lib/notes.ts).
  const { note, notedAt, saveNote } = useNote(result.barcode);
  // F-E: the user's own photo of this barcode's ingredients list — see
  // components/usePhoto.ts / lib/photos.ts. Self-contained like useNote
  // above: it reads its own IndexedDB state and never feeds a verdict.
  const {
    photoUrl,
    takenAt: photoTakenAt,
    stale: photoStale,
    saving: photoSaving,
    error: photoError,
    capture: capturePhoto,
    remove: removePhoto,
  } = usePhoto(result.barcode);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  // F3: collapsed by default — the checklist is a lookup aid, not something
  // to read on every KEINE_DATEN, so it shouldn't push the retry button down
  // for everyone.
  const [checklistOpen, setChecklistOpen] = useState(false);
  // F10: a long product name is clamped to 3 lines by default (see
  // titleMayOverflow) so it can never push the stamp below the fold — a tap
  // reveals the rest. Collapsed again whenever a new result comes in, so an
  // expanded long name from the previous product doesn't leak into the next.
  const [nameExpanded, setNameExpanded] = useState(false);
  // F6: brief "kopiert" confirmation for the clipboard fallback (no native
  // share sheet available) — see handleShare below.
  const [shareNotice, setShareNotice] = useState(false);
  const shareNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (shareNoticeTimer.current) clearTimeout(shareNoticeTimer.current);
    };
  }, []);
  const resolved = applyPackMatch(result.status, caveats, answer);
  const verdict = resolveVerdict(resolved.status, resolved.caveats);
  const profiles = getProfiles(selectedAllergens);
  const copy = verdictCopy(verdict, profiles, result.results ?? [], resolved.caveats);

  const isSafe = verdict === "safe";
  const isDanger = verdict === "danger";
  const isTrace = verdict === "trace";
  const isPartial = verdict === "partial";
  const isUnknown = verdict === "unknown";
  // F3: reading-help checklist for KEINE_DATEN (real or pack-mismatch) — see
  // AllergenChecklistCard. Empty (and thus hidden) whenever nothing is
  // selected, which cannot normally happen (usePrefs defaults to peanut).
  const checklist = isUnknown ? buildAllergenChecklist(profiles) : [];
  // Strict mode treats a trace like a hit for the alarm — but the visuals
  // (stamp, frame, verdict color) used to stay amber regardless, so only the
  // small print said "wie ein Treffer". Tracked separately so the framing
  // below can go red while the stamp word/category stays "spuren", not "stop".
  const strictTraceHit = isTrace && tracesStrict;
  // A qualified all-clear stays quiet: only real hits (and traces in strict
  // mode) are worth an alarm.
  const alarm = isDanger || strictTraceHit;
  // KEINE_DATEN is fail-safe ("could be anything") and reads as a genuine
  // warning, not a neutral "we don't know" — so it borrows the hit's red,
  // distinguished from a real hit by shape (dashed ring, not the solid stamp).
  // `fg` colors text (the mono kicker at ~11px and the verdict title), so the
  // amber verdicts take AMBER_TEXT — fill-grade AMBER stays below 4.5:1 even on
  // the card's own tint (see lib/theme.ts). The tint and frame keep AMBER.
  // Warn-only recall comparison: matches add a card, everything else stays a
  // quiet status line — "no match" must never read as "no recall exists".
  const recallMatches =
    result.recall?.status === "ok" ? result.recall.matches : [];
  // A recall hit qualifies an otherwise-clear read: "no match in the data" is
  // not the same claim as "safe" once an official recall notice might apply
  // to the same product. trace/danger/unknown already read as a warning on
  // their own, so this only softens safe/partial — the two verdicts whose
  // stock headline, kicker and green card would otherwise sound like
  // reassurance right above a red recall card. It has to reach every part of
  // that card, not just the stamp glyph: a green frame around an amber stamp
  // still reads "safe" at arm's length, which is exactly the glance this is
  // meant to interrupt. The verdict itself (copy.title, copy.label, history
  // entry, share text, aria-live announcement) stays untouched — this is
  // presentation only, the comparison remains warn-only.
  const recallQualifiesVerdict = recallMatches.length > 0 && (isSafe || isPartial);

  const fg = strictTraceHit || isUnknown
    ? P.RED
    : isTrace || isPartial || recallQualifiesVerdict
      ? P.AMBER_TEXT
      : verdictColor(verdict, P);

  // The record can only be matched to the pack in hand by the person holding
  // it — so ask, but only where the barcode itself leaves identity open.
  const identityOpen = hasIdentityCaveat(caveats);
  const mismatch = answer === "mismatch" && resolved.status === "KEINE_DATEN";
  const rawDetailText = mismatch
    ? "Diese Angaben gehören zu einem anderen Produkt. Bitte die Zutatenliste auf deiner Verpackung lesen."
    : isUnknown
      ? result.message ?? copy.detail
      : copy.detail;

  // F (part 2): once a second person exists, the verdict itself must say
  // unambiguously *for whom* it was just checked, right next to it — a
  // "Sicher" with no name attached is exactly the false all-clear this
  // feature exists to prevent the moment there's someone else it could
  // belong to instead. Prefixed onto the detail line (rendered immediately
  // under the big verdict title, see data-verdict-card below) rather than
  // tucked away lower on the screen. At exactly one person `personPrefix` is
  // "" and every string below is byte-identical to before this feature.
  const showPersonOnResult = personCount > 1;
  const personPrefix = showPersonOnResult ? `Für ${activePersonName}: ` : "";
  const detailText = `${personPrefix}${rawDetailText}`;

  // Branch the "no verdict" card by *why* (network/server failure vs. a real
  // not-found/no-data) — see unknownCardCopy for the reasoning.
  const unknownCard = isUnknown && !mismatch ? unknownCardCopy(result, profiles) : null;

  const headlineText = unknownCard?.network
    ? "Gerade keine Verbindung."
    : recallQualifiesVerdict
      ? "Kein Treffer in den Daten — aber ein Rückruf könnte passen."
      : copy.headline;

  // F6: mirrors exactly what's already on screen — the verdict label plus
  // its detail line (now with the "Für <Person>: " prefix folded in above
  // when there's more than one person), which for "partial" already carries
  // the caveat wording and for a mismatch/network case already carries that
  // correction — so a shared message can never read safer, or less
  // attributable, than the app itself says on screen.
  const shareText = buildShareText({
    productName: result.productName,
    brand: result.brand,
    barcode: result.barcode,
    label: copy.label,
    detail: `${detailText}${strictTraceHit ? " Im Strikt-Modus wie ein Treffer behandelt." : ""}`,
  });

  // A green/amber result is only as good as the record behind it — flag a
  // record that has not been touched in a long time so the packet in hand
  // stays the deciding factor, not an old snapshot.
  const dataStale =
    (isSafe || isPartial) &&
    result.dataLastModified != null &&
    isDataStale(result.dataLastModified);

  const headlineRef = useRef<HTMLParagraphElement>(null);
  const [announce, setAnnounce] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  // Move focus to the result so keyboard / screen-reader users land on it
  // (and don't stay on the now-hidden scan screen behind it). On close, return
  // focus to whatever opened the result, if that element is still in the DOM.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    headlineRef.current?.focus();
    return () => {
      if (opener?.isConnected && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, []);

  // Escape closes the result overlay, mirroring the ✕ button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  // Announce the verdict to assistive tech, always assertive: the result
  // overlay is a dialog over a life-safety verdict, so VoiceOver should speak
  // it immediately rather than waiting for a pause (as "polite" would). Empty
  // on mount and filled in an effect makes it a live-region *change*, which is
  // what actually triggers the announcement.
  useEffect(() => {
    const worsenNote = worsenedFrom
      ? `Achtung, Änderung gegenüber dem letzten Scan: zuletzt ${VERDICT[worsenedFrom.verdict].label}, jetzt ${copy.label}. `
      : "";
    const recallNote =
      recallMatches.length > 0
        ? " Achtung: Eine amtliche Rückruf-Meldung könnte dieses Produkt betreffen."
        : "";
    setAnnounce(`${worsenNote}${copy.title} ${detailText}${recallNote}`);
    setImgFailed(false);
    setNameExpanded(false);
  }, [result, copy.title, copy.label, detailText, recallMatches.length, worsenedFrom]);

  // Alert the user on a hit (and on traces when strict mode is on).
  useEffect(() => {
    if (!alarm) return;
    if (haptic) vibrate([60, 40, 60]);
    if (sound) beep();
  }, [alarm, haptic, sound]);

  // recallQualifiesVerdict is checked before isSafe so a clear read with a
  // matching recall gets the amber card, not the green one.
  const accentBg = recallQualifiesVerdict
    ? `${P.AMBER}12`
    : isSafe
      ? `${P.GREEN}10`
      : isDanger || strictTraceHit
        ? `${P.RED}10`
        : isTrace || isPartial
          ? `${P.AMBER}12`
          : isUnknown
            ? `${P.RED}09`
            : `${P.INK}06`;
  const accentBd = recallQualifiesVerdict
    ? P.AMBER
    : isSafe
      ? P.GREEN
      : isDanger || strictTraceHit
        ? P.RED
        : isTrace || isPartial
          ? P.AMBER
          : isUnknown
            ? P.RED
            : `${P.INK}33`;
  // Unknown keeps a dashed frame (vs. everyone else's solid) so it stays
  // visually distinct from a real hit even though both are red now.
  const accentBorderStyle = isUnknown ? "dashed" : "solid";

  const traceOnly = (result.traces ?? []).filter(
    (t) => !(result.allergens ?? []).includes(t),
  );

  function startEditNote() {
    setNoteDraft(note ?? "");
    setEditingNote(true);
  }
  function cancelEditNote() {
    setEditingNote(false);
  }
  function saveNoteDraft() {
    saveNote(noteDraft);
    setEditingNote(false);
  }

  // F6: navigator.share opens the native sheet (AirDrop/Nachrichten/Mail on
  // iOS); when it isn't available (or the OS itself has no share targets),
  // fall back to the clipboard with a brief on-screen confirmation — the
  // same two-step pattern lib/backup.ts/useBackup.ts already uses for F1.
  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (err) {
        // AbortError: the user dismissed the share sheet themselves — leave
        // it at that instead of surprising them with a clipboard fallback.
        if (err instanceof Error && err.name === "AbortError") return;
        // Any other failure falls through to the clipboard fallback below.
      }
    }
    // Guard the call itself (not just try/catch it): navigator.clipboard?.
    // writeText(...) would otherwise short-circuit to `undefined` when the
    // API is missing, which resolves without throwing — that would show the
    // "kopiert" confirmation even though nothing was actually copied.
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareNotice(true);
        if (shareNoticeTimer.current) clearTimeout(shareNoticeTimer.current);
        shareNoticeTimer.current = setTimeout(() => setShareNotice(false), 2500);
      } catch {
        /* clipboard write refused (e.g. permission) – nothing more we can do here */
      }
    }
  }

  return (
    <AppShell P={P}>
      <TopBar
        P={P}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              P={P}
              icon={
                <Star
                  size={18}
                  aria-hidden="true"
                  fill={isFavorite ? P.ACCENT : "none"}
                  color={isFavorite ? P.ACCENT : undefined}
                />
              }
              label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              onClick={onToggleFavorite}
            />
            <IconButton
              P={P}
              icon={<Share size={18} aria-hidden="true" />}
              label="Ergebnis teilen"
              onClick={handleShare}
            />
            <button
              type="button"
              className="tap hit44"
              onClick={onBack}
              style={{
                background: "transparent",
                border: 0,
                color: P.INK,
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <X size={14} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />Schließen
            </button>
          </div>
        }
      />

      {/* Assertive so VoiceOver speaks the verdict as soon as the dialog
          opens, rather than waiting for a pause as "polite" would — this is
          a life-safety result, not a routine status update. */}
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>

      {shareNotice ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: "calc(54px + env(safe-area-inset-top))",
            zIndex: 20,
            padding: "10px 14px",
            borderRadius: 12,
            background: P.INK,
            color: P.BG,
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            boxShadow: `0 12px 32px -14px ${P.INK}, 0 2px 8px ${P.INK}33`,
          }}
        >
          In die Zwischenablage kopiert.
        </div>
      ) : null}

      <div
        className="scroll result-in"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 22px 100px",
          animation: "resultIn .35s ease-out both",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Mono style={{ opacity: 0.6 }}>ergebnis</Mono>
          <Mono style={{ opacity: 0.6 }}>
            {result.cachedAt ? "offline · zwischengespeichert" : `geprüft · ${nowHHMM()}`}
          </Mono>
        </div>

        {result.cachedAt ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: `${P.AMBER}12`,
              border: `1.5px dashed ${P.AMBER}`,
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            {/* Undimmed: AMBER_TEXT only clears 4.5:1 at full strength. */}
            <Mono style={{ color: P.AMBER_TEXT }}>offline</Mono>
            <div style={{ marginTop: 3 }}>
              Offline — Ergebnis aus Abfrage vom{" "}
              {formatRelative(new Date(result.cachedAt).getTime())}.
            </div>
          </div>
        ) : null}

        {worsenedFrom ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: `${P.RED}10`,
              border: `1.5px solid ${P.RED}`,
              fontSize: 12.5,
              lineHeight: 1.45,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, color: P.RED }} />
            <div>
              <Mono style={{ color: P.RED }}>änderung zum letzten scan</Mono>
              <div style={{ marginTop: 3 }}>
                Zuletzt als <strong>{VERDICT[worsenedFrom.verdict].label}</strong> gespeichert —
                jetzt <strong>{copy.label}</strong>.
              </div>
            </div>
          </div>
        ) : null}

        <p
          ref={headlineRef}
          tabIndex={-1}
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontSize: "1.25em",
            margin: "6px 0 14px",
            color: P.INK,
            lineHeight: 1.2,
            outline: "none",
          }}
        >
          {headlineText}
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
            {result.imageUrl && !imgFailed ? (
              <img
                src={result.imageUrl}
                alt={
                  result.productName ? `Foto von ${result.productName}` : "Produktfoto"
                }
                width={56}
                height={56}
                loading="lazy"
                onError={() => setImgFailed(true)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  objectFit: "cover",
                  // F12: PAPER, not a hardcoded cream — that literal stayed
                  // bright in dark mode and clashed with the card around it.
                  // This is just the letterbox behind a loading/transparent
                  // photo, so it should read as "card surface", not a color.
                  background: P.PAPER,
                  border: `1px solid ${P.INK}22`,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  // F12: same PAPER-derived fill as above — in dark mode the
                  // old hardcoded cream sat almost exactly on top of P.INK
                  // (dark mode's INK *is* a light cream, for text), so the
                  // "foto" label all but disappeared into its own background.
                  background: `repeating-linear-gradient(45deg, ${P.INK}10 0 6px, transparent 6px 12px), ${P.PAPER}`,
                  border: `1px solid ${P.INK}22`,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Mono style={{ opacity: 0.7, color: P.INK }}>foto</Mono>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Mono
                style={{
                  opacity: 0.7,
                  // F10: the brand/ean line is a single status line, not a
                  // headline — clamp it to one row so a long brand name can't
                  // wrap and push the title (and with it, the stamp) down.
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {result.brand ?? "—"} · ean {shortEan(result.barcode)}
              </Mono>
              {(() => {
                const productName = result.productName ?? "Unbekanntes Produkt";
                const titleStyle: CSSProperties = {
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  fontSize: "1.25em",
                  lineHeight: 1.1,
                  marginTop: 2,
                  textAlign: "left",
                };
                // F10: a realistic long name ("Bio-Vollkorn-Dinkel-Knusper-
                // Müsli mit Mandeln, Cranberries und Kürbiskernen,
                // Familienpackung 750 g") can fill half the screen and push
                // the stamp below the fold. Clamp to 3 lines and only offer
                // the tap-to-expand affordance when the name is actually
                // long enough to need it — a short name shows plain text,
                // no button, no aria-expanded, nothing to trip over.
                if (!titleMayOverflow(productName)) {
                  return <div style={titleStyle}>{productName}</div>;
                }
                return (
                  <button
                    type="button"
                    className="tap"
                    onClick={() => setNameExpanded((v) => !v)}
                    aria-expanded={nameExpanded}
                    aria-label={
                      nameExpanded
                        ? `Produktname einklappen: ${productName}`
                        : `Vollständigen Produktnamen anzeigen: ${productName}`
                    }
                    style={{
                      display: "block",
                      width: "100%",
                      minHeight: 44,
                      padding: 0,
                      margin: 0,
                      background: "transparent",
                      border: 0,
                      color: "inherit",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        ...titleStyle,
                        display: nameExpanded ? "block" : "-webkit-box",
                        WebkitLineClamp: nameExpanded ? undefined : 3,
                        WebkitBoxOrient: "vertical",
                        overflow: nameExpanded ? "visible" : "hidden",
                      }}
                    >
                      {productName}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* A recall notice must be seen before any all-clear stamp: on a
              phone screen the stamp alone can fill the viewport, so a recall
              rendered below it (as it used to be) was invisible until the
              user scrolled past a green "safe" seal. Rendering it first means
              the worst case — an official recall on an otherwise clean
              record — is never hidden behind a reassuring visual. */}
          {recallMatches.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                padding: "14px 14px 12px",
                borderRadius: 12,
                background: `${P.RED}0D`,
                border: `2px solid ${P.RED}`,
              }}
            >
              <Mono style={{ color: P.RED }}>
                amtliche warnung · lebensmittelwarnung.de
              </Mono>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 800,
                  fontSize: 18,
                  marginTop: 3,
                  lineHeight: 1.15,
                  color: P.RED,
                }}
              >
                Rückruf könnte dieses Produkt betreffen
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.82, lineHeight: 1.45 }}>
                Der Abgleich läuft über den Produktnamen und kann irren. Öffne die
                Meldung und vergleiche Produkt, Charge und Haltbarkeitsdatum mit
                deiner Packung.
              </div>
              {recallMatches.map((match, i) => (
                <div
                  key={`${match.title}-${i}`}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px dashed ${P.RED}55`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3 }}>
                    {match.title}
                  </div>
                  {match.publishedDate ? (
                    <Mono style={{ opacity: 0.6, marginTop: 2, display: "block" }}>
                      gemeldet · {formatRecallDate(match.publishedDate)}
                    </Mono>
                  ) : null}
                  {match.link ? (
                    <a
                      href={match.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        color: P.INK,
                        fontSize: 12.5,
                        fontWeight: 600,
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                      }}
                    >
                      Meldung öffnen
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div
            data-verdict-card=""
            style={{
              marginTop: recallMatches.length > 0 ? 12 : 16,
              padding: "18px 14px 16px",
              borderRadius: 14,
              background: accentBg,
              border: `2px ${accentBorderStyle} ${accentBd}`,
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
                    // Dashed (vs. the hit stamp's solid double border) keeps
                    // this red warning visually distinct from a real JA hit,
                    // fail-safe framing per README even though the color now
                    // matches.
                    border: `2px dashed ${P.RED}`,
                    display: "grid",
                    placeItems: "center",
                    color: P.RED,
                    transform: "rotate(-8deg)",
                    flexShrink: 0,
                  }}
                >
                  <Mono style={{ fontSize: 9 }}>?</Mono>
                </div>
              ) : (
                <Stamp
                  verdict={verdict}
                  P={P}
                  colorOverride={
                    strictTraceHit ? P.RED : recallQualifiesVerdict ? P.AMBER : undefined
                  }
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Mono style={{ color: fg }}>
                    {recallQualifiesVerdict ? "kein treffer · rückruf prüfen" : copy.tag}
                  </Mono>
                  {strictTraceHit ? (
                    <Chip tone="bad" P={P}>
                      Strikt: wie Treffer
                    </Chip>
                  ) : null}
                </div>
                <div
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 800,
                    // The stamp keeps its 88px, so on narrow phones the verdict
                    // has to give: full size from ~390px up, smaller below.
                    fontSize: "clamp(1.25em, 6.7vw, 1.625em)",
                    color: fg,
                    lineHeight: 1.0,
                    marginTop: 3,
                    textWrap: "balance",
                    // Long allergen labels ("Schalenfrüchte") must break rather
                    // than push past the card on narrow phones — hyphenated
                    // where German allows it, hard-broken only as a last resort.
                    hyphens: "auto",
                    overflowWrap: "break-word",
                  }}
                >
                  {copy.title}
                </div>
                <div
                  style={{
                    fontSize: "0.78em",
                    marginTop: 6,
                    opacity: isUnknown ? 0.92 : 0.78,
                    lineHeight: 1.35,
                    color: isUnknown ? P.RED : undefined,
                  }}
                >
                  {/* F (part 2): the "Für <Person>: " prefix is folded into
                      `detailText` itself (see its own comment above) so the
                      announcement/share text stay word-for-word identical to
                      what's rendered here — `<strong>` is purely a visual
                      emphasis on the same characters, not a second copy. */}
                  {personPrefix ? <strong style={{ color: fg }}>{personPrefix}</strong> : null}
                  {rawDetailText}
                  {strictTraceHit ? " Im Strikt-Modus wie ein Treffer behandelt." : ""}
                </div>
              </div>
            </div>
          </div>

          {identityOpen && answer === null ? (
            <div
              style={{
                marginTop: 12,
                padding: "14px 14px 12px",
                borderRadius: 12,
                background: `${P.ACCENT}0D`,
                border: `1.5px solid ${P.ACCENT}`,
              }}
            >
              <Mono style={{ opacity: 0.65 }}>gegencheck · packung</Mono>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 800,
                  fontSize: 18,
                  marginTop: 3,
                  lineHeight: 1.15,
                }}
              >
                Passt das zu deiner Packung?
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.82, lineHeight: 1.45 }}>
                Dieser Barcode ist nicht eindeutig. Vergleiche Foto, Marke und Name mit dem
                Produkt in deiner Hand — nur du kannst das entscheiden.
              </div>
              {result.imageUrl && !imgFailed ? (
                <img
                  src={result.imageUrl}
                  alt={
                    result.productName
                      ? `Foto von ${result.productName} aus der Datenbank`
                      : "Produktfoto aus der Datenbank"
                  }
                  loading="lazy"
                  onError={() => setImgFailed(true)}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: 190,
                    objectFit: "contain",
                    borderRadius: 10,
                    marginTop: 10,
                    // F12: same fix as the header placeholder — objectFit
                    // "contain" can letterbox this image, and the old
                    // hardcoded cream showed through that letterbox as a
                    // bright block in dark mode.
                    background: P.PAPER,
                    border: `1px solid ${P.INK}22`,
                  }}
                />
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="tap"
                  onClick={() => answerPackMatch("match")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    color: P.INK,
                    border: `1.5px solid ${P.GREEN}`,
                    borderRadius: 99,
                    padding: "11px 10px",
                    fontWeight: 700,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                  }}
                >
                  Ja, passt
                </button>
                <button
                  type="button"
                  className="tap"
                  onClick={() => answerPackMatch("mismatch")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    color: P.INK,
                    border: `1.5px solid ${P.RED}`,
                    borderRadius: 99,
                    padding: "11px 10px",
                    fontWeight: 700,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                  }}
                >
                  Nein, andere
                </button>
              </div>
            </div>
          ) : null}

          {identityOpen && answer !== null ? (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: mismatch ? `${P.RED}0D` : `${P.GREEN}0D`,
                border: `1.5px solid ${mismatch ? P.RED : P.GREEN}55`,
              }}
            >
              <Mono style={{ opacity: 0.65 }}>
                gegencheck · von dir{answeredAt ? ` · ${formatRelative(answeredAt)}` : ""}
              </Mono>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 4 }}>
                {mismatch ? "Andere Packung" : "Passt zu deiner Packung"}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 3, opacity: 0.82, lineHeight: 1.45 }}>
                {mismatch
                  ? "Du hast angegeben, dass der Eintrag nicht zu deinem Produkt gehört. Damit ist das Ergebnis hinfällig — es zählt die Zutatenliste auf der Verpackung."
                  : "Du hast den Eintrag deiner Packung zugeordnet. Beim nächsten Scan dieses Codes gilt die Antwort weiter — für 90 Tage, danach wird sicherheitshalber erneut gefragt."}
              </div>
              {mismatch ? (
                <div>
                  <OffRecordLink
                    barcode={result.barcode}
                    label="Eintrag bei Open Food Facts prüfen"
                    P={P}
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="tap"
                onClick={() => answerPackMatch(null)}
                style={{
                  marginTop: 8,
                  background: "transparent",
                  color: P.INK,
                  border: `1px solid ${P.INK}44`,
                  borderRadius: 99,
                  padding: "7px 12px",
                  fontWeight: 600,
                  fontSize: 12.5,
                  fontFamily: "inherit",
                }}
              >
                Antwort zurücknehmen
              </button>
            </div>
          ) : null}

          {resolved.caveats.length > 0 ? (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: `${P.AMBER}0F`,
                border: `1.5px dashed ${P.AMBER}`,
              }}
            >
              <Mono style={{ color: P.AMBER_TEXT }}>vorbehalt</Mono>
              {resolved.caveats.map((key) => (
                <div key={key} style={{ marginTop: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{CAVEATS[key].title}</div>
                  <div style={{ fontSize: 12.5, marginTop: 3, opacity: 0.82, lineHeight: 1.45 }}>
                    {CAVEATS[key].detail}
                  </div>
                </div>
              ))}
              {resolved.caveats.includes("traces-unknown") ? (
                <OffRecordLink
                  barcode={result.barcode}
                  label="Spurenangabe bei Open Food Facts ergänzen"
                  P={P}
                />
              ) : null}
            </div>
          ) : null}

          {(result.results?.length ?? 0) > 1 ? (
            <div style={{ marginTop: 12 }}>
              <Mono style={{ opacity: 0.6 }}>geprüfte allergene</Mono>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                {result.results!.map((hit) => {
                  const hv = resolveVerdict(hit.status, caveats);
                  const tone: ChipTone =
                    hv === "danger"
                      ? "bad"
                      : hv === "trace" || hv === "partial"
                        ? "warn"
                        : hv === "safe"
                          ? "ok"
                          : "neutral";
                  const word =
                    hv === "danger"
                      ? "enthalten"
                      : hv === "trace"
                        ? "Spuren"
                        : hv === "partial"
                          ? "Zutaten frei"
                          : hv === "safe"
                            ? "frei"
                            : "keine Daten";
                  return (
                    <div
                      key={hit.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{hit.label}</span>
                      <Chip tone={tone} P={P}>
                        <span aria-hidden="true">{verdictGlyph(hv)}</span>
                        <span>{word}</span>
                      </Chip>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

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
              <div style={{ fontSize: "0.84em", marginTop: 5, lineHeight: 1.5 }}>
                {highlight(result.ingredients, result.found, P)}
              </div>
            </div>
          ) : null}

          {(result.allergens?.length ?? 0) + traceOnly.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Mono style={{ opacity: 0.6 }}>weitere allergene</Mono>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {(result.allergens ?? []).map((name) => {
                  return (
                    <Chip key={`a-${name}`} tone="info" P={P}>
                      <span style={{ fontWeight: 700 }}>{name}</span>
                    </Chip>
                  );
                })}
                {traceOnly.map((name) => (
                  <Chip key={`t-${name}`} tone="warn" P={P}>
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    {/* Weight, not opacity: dimming would undo AMBER_TEXT's contrast. */}
                    <span style={{ fontWeight: 500 }}>· Spuren</span>
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          <IngredientPhotoCard
            P={P}
            productName={result.productName}
            photoUrl={photoUrl}
            takenAt={photoTakenAt}
            stale={photoStale}
            saving={photoSaving}
            error={photoError}
            onCapture={capturePhoto}
            onRemove={removePhoto}
          />

          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              background: `${P.INK}05`,
              border: `1px dashed ${P.INK}33`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Mono style={{ opacity: 0.6 }}>notiz · nur für euch</Mono>
              {!editingNote ? (
                <button
                  type="button"
                  className="tap hit44"
                  onClick={startEditNote}
                  aria-label={note ? "Notiz bearbeiten" : "Notiz hinzufügen"}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: P.INK,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  <Pencil size={13} aria-hidden="true" />
                  {note ? "Bearbeiten" : "Hinzufügen"}
                </button>
              ) : null}
            </div>

            {editingNote ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  aria-label="Notiz zu diesem Produkt"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                  placeholder="z. B. Sorte Schoko okay, Crunchy nicht …"
                  rows={3}
                  maxLength={NOTE_MAX_LENGTH}
                  autoFocus
                  style={{
                    width: "100%",
                    resize: "vertical",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: P.PAPER,
                    color: P.INK,
                    border: `1.5px solid ${P.INK}22`,
                    fontFamily: "inherit",
                    // >=16px so iOS Safari doesn't zoom the page on focus.
                    fontSize: 16,
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="tap"
                    onClick={saveNoteDraft}
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
                    Speichern
                  </button>
                  <button
                    type="button"
                    className="tap"
                    onClick={cancelEditNote}
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
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : note ? (
              <>
                <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.45, textWrap: "pretty" }}>
                  {note}
                </div>
                {notedAt ? (
                  <Mono style={{ opacity: 0.7, display: "block", marginTop: 4 }}>
                    {formatRelative(notedAt)}
                  </Mono>
                ) : null}
              </>
            ) : (
              <p style={{ margin: "5px 0 0", fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>
                Nur eine Erinnerung für euch — z. B. „Sorte Schoko okay, Crunchy nicht“. Ändert nie
                das Ergebnis.
              </p>
            )}
          </div>

          {result.dataLastModified || result.dataRevision ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: dataStale ? `${P.AMBER}14` : `${P.ACCENT}0D`,
                border: `1px solid ${dataStale ? P.AMBER : `${P.ACCENT}55`}`,
                fontSize: 12.5,
                lineHeight: 1.45,
              }}
            >
              <Mono style={{ opacity: dataStale ? 1 : 0.65, color: dataStale ? P.AMBER_TEXT : undefined }}>
                datenstand · open food facts
              </Mono>
              <div style={{ marginTop: 4 }}>
                {result.dataLastModified
                  ? `Zuletzt bearbeitet: ${formatDataDate(result.dataLastModified)}`
                  : "Bearbeitungsdatum unbekannt"}
                {result.dataRevision ? ` · Revision ${result.dataRevision}` : ""}
              </div>
              <div style={{ marginTop: 3, opacity: 0.72 }}>
                Eine neue Revision kann auch nur ein Foto oder eine Textkorrektur sein.
                Sie bestätigt keine neue Rezeptur. Die aktuelle Packung ist maßgeblich.
              </div>
              {dataStale ? (
                <div style={{ marginTop: 6, fontWeight: 700, opacity: 1 }}>
                  Dieser Eintrag wurde seit über 2 Jahren nicht bearbeitet — die Zutatenliste
                  auf der Packung ist deshalb besonders wichtig.
                </div>
              ) : null}
            </div>
          ) : null}

          {result.networkError && lastKnown ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: `${P.INK}05`,
                border: `1px dashed ${P.INK}33`,
              }}
            >
              <Mono style={{ opacity: 0.6 }}>zuletzt bekannt</Mono>
              <div style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.45 }}>
                Zuletzt am {formatRelative(lastKnown.ts)} als{" "}
                <strong>{VERDICT[lastKnown.verdict].label}</strong> geprüft — aktuell nicht
                verifizierbar.
              </div>
            </div>
          ) : null}

          {checklist.length > 0 ? (
            <AllergenChecklistCard
              P={P}
              checklist={checklist}
              open={checklistOpen}
              onToggle={() => setChecklistOpen((v) => !v)}
            />
          ) : null}

          {unknownCard ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: unknownCard.network ? `${P.RED}0D` : `${P.ACCENT}10`,
                border: `1.5px dashed ${unknownCard.network ? P.RED : P.ACCENT}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                {unknownCard.heading}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85 }}>
                {unknownCard.body}
              </div>
              <button
                type="button"
                className="tap"
                onClick={onRetry}
                disabled={loading}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: unknownCard.network ? P.RED : "transparent",
                  color: unknownCard.network ? "#fff" : P.INK,
                  border: `1.5px solid ${unknownCard.network ? P.RED : P.ACCENT}`,
                  borderRadius: 99,
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  "Prüfe erneut…"
                ) : (
                  <>
                    {unknownCard.network ? (
                      <WifiOff size={14} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                    ) : (
                      <RotateCcw size={14} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                    )}
                    {unknownCard.retryLabel}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        <div
          style={{ display: "flex", justifyContent: "space-between", marginTop: 12, opacity: 0.7 }}
        >
          <Mono>quelle · openfoodfacts</Mono>
          <Mono>ean · {result.barcode}</Mono>
        </div>
        {result.recall ? (
          <div style={{ marginTop: 4, opacity: 0.7 }}>
            <Mono>
              {result.recall.status === "unavailable"
                ? "rückruf-abgleich · lebensmittelwarnung.de nicht erreichbar"
                : recallMatches.length > 0
                  ? "rückruf-abgleich · lebensmittelwarnung.de · treffer siehe oben"
                  : "rückruf-abgleich · lebensmittelwarnung.de · kein namenstreffer"}
            </Mono>
          </div>
        ) : null}
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
          className={alarm ? "tap btn pulse-red" : "tap btn"}
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
          {alarm ? "Verstanden — neu scannen" : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Nächsten Code scannen <ArrowRight size={16} aria-hidden="true" /></span>}
        </button>
      </div>
    </AppShell>
  );
}
