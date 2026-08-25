"use client";

import { useEffect, useState } from "react";

/**
 * The one and only key this screen is allowed to touch. Befund 02's real fix
 * lives in components/useHistory.ts's load() (a corrupt localStorage entry
 * is now filtered out instead of crashing the whole app), so this screen
 * should rarely be *needed* for that specific case again — but it stays as
 * the documented last-resort recovery for any future crash traceable to the
 * history store. It is deliberately scoped to nothing else: notes,
 * favourites, prefs and the emergency plan all live under their own
 * localStorage keys and are never touched here.
 */
const HISTORY_KEY = "peanot.history.v1";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js App Router error boundary for everything under the root layout
 * (a crash in ScanScreen, ResultScreen, HistoryScreen, ...). Root layout
 * itself (fonts, <html>/<body>, ServiceWorkerRegister) still renders around
 * this, so it does not need its own <html>/<body> — see app/global-error.tsx
 * for the boundary that does.
 *
 * Design intent: this is the worst moment to be a first-time reader of the
 * app — someone standing in a supermarket aisle with a product in one hand
 * and a phone in the other, and the screen just went blank. The stock
 * Next.js "Application error: a client-side exception has occurred" gives
 * that person nothing to do. This screen always gives them exactly two
 * ways forward: try again, or (if that keeps failing) reset the one piece
 * of local data most likely to be the cause, without guessing or losing
 * anything else.
 */
export default function Error({ error, reset }: ErrorScreenProps) {
  // Two-step confirmation for the destructive escape hatch below, held in
  // plain component state — never window.confirm(): a native browser
  // dialog reads as OS chrome, not part of the app, and is jarring on a
  // screen that is already trying to be reassuring. The extra tap is the
  // whole safeguard; there is no way to reach handleConfirmedReset without
  // it.
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Log the real error for anyone with dev tools open or a bug report to
  // hand along — the UI below deliberately never shows a raw stack trace to
  // someone who is not debugging, only the short digest Next.js attaches.
  useEffect(() => {
    console.error("peaNOT — unbehandelter Fehler:", error);
  }, [error]);

  const handleConfirmedReset = () => {
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      // localStorage unavailable (private mode, full quota, ...) — nothing
      // to clear either way; still reload below so the user isn't stuck.
    }
    // A full reload, not reset(): reset() alone re-renders the same tree,
    // but if this crash is the corrupt-history case this screen exists
    // for, the very next render would just read the same broken value
    // straight back out of localStorage. Reloading forces useHistory's
    // load() to run fresh against the now-clean storage.
    window.location.reload();
  };

  return (
    <div className="peanot-crash">
      <style>{CSS}</style>
      <div className="peanot-crash__card">
        <p className="peanot-crash__kicker">peaNOT</p>
        <h1 className="peanot-crash__title">Da ist etwas schiefgelaufen.</h1>
        <p className="peanot-crash__lead">
          Die Seite ist beim Anzeigen abgestürzt — das ist ein Fehler in der
          App, nicht in deinen Daten. Die liegen unverändert auf diesem
          Gerät.
        </p>

        <button
          type="button"
          className="tap peanot-crash__primary"
          onClick={() => reset()}
        >
          Erneut versuchen
        </button>

        <div className="peanot-crash__escape">
          {!confirmingReset ? (
            <button
              type="button"
              className="tap peanot-crash__secondary"
              onClick={() => setConfirmingReset(true)}
            >
              Verlauf zurücksetzen
            </button>
          ) : (
            <div className="peanot-crash__confirm">
              <p className="peanot-crash__confirm-text">
                Das löscht nur den Scan-<strong>Verlauf</strong> auf diesem
                Gerät und lädt die App danach neu. Notizen, Favoriten,
                Einstellungen und der Notfallplan sind davon{" "}
                <strong>nicht</strong> betroffen.
              </p>
              <div className="peanot-crash__confirm-row">
                <button
                  type="button"
                  className="tap peanot-crash__secondary"
                  onClick={() => setConfirmingReset(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="tap peanot-crash__danger"
                  onClick={handleConfirmedReset}
                >
                  Ja, Verlauf löschen
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="peanot-crash__footnote">
          Alle Daten liegen nur auf diesem Gerät — es geht nichts verloren,
          ausser dem, was du hier ausdrücklich zurücksetzt.
        </p>

        {error.digest ? (
          <p className="peanot-crash__digest">Fehlercode: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}

// Plain <style> tag rather than the app's usual `P: Palette` object from
// lib/theme.ts on purpose: that palette is produced by usePrefs' accent/
// theme-mode preference, which itself reads localStorage — exactly the kind
// of app machinery a crash screen must not depend on. Colors below are the
// same values as lib/theme.ts's PAL_LIGHT/PAL_DARK, copied literally so this
// file has zero runtime dependency on the rest of the app, with the
// light/dark swap done in plain CSS via prefers-color-scheme instead of a
// JS media-query listener (system dark isn't tracked in state until
// app/page.tsx mounts, which is exactly what just failed).
const CSS = `
.peanot-crash {
  --bg: #f3ead8;
  --paper: #fffdf6;
  --ink: #16140f;
  --dim: #6b6555;
  --accent: #b46b04;
  --red: #c4321f;
  --fill-text: #fff;

  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg);
  color: var(--ink);
  font-family: "Space Grotesk", system-ui, -apple-system, sans-serif;
}

@media (prefers-color-scheme: dark) {
  .peanot-crash {
    --bg: #16140f;
    --paper: #221f18;
    --ink: #f3ead8;
    --dim: #a59d89;
    --accent: #e3a13a;
    --red: #ef6450;
    --fill-text: #16140f;
  }
}

.peanot-crash *,
.peanot-crash *::before,
.peanot-crash *::after {
  box-sizing: border-box;
}

.peanot-crash__card {
  width: 100%;
  max-width: 420px;
  background: var(--paper);
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 20px 60px -24px rgba(0, 0, 0, 0.35);
}

.peanot-crash__kicker {
  margin: 0 0 6px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.peanot-crash__title {
  margin: 0 0 12px;
  font-family: "Fraunces", Georgia, serif;
  font-style: italic;
  font-weight: 600;
  font-size: 26px;
  line-height: 1.25;
}

.peanot-crash__lead {
  margin: 0 0 22px;
  font-size: 14.5px;
  line-height: 1.5;
  opacity: 0.85;
}

.peanot-crash__primary {
  width: 100%;
  padding: 14px 18px;
  border: none;
  border-radius: 99px;
  background: var(--ink);
  color: var(--bg);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.peanot-crash__escape {
  margin-top: 14px;
}

.peanot-crash__secondary {
  width: 100%;
  padding: 11px 14px;
  border-radius: 99px;
  background: transparent;
  border: 1.5px solid color-mix(in srgb, var(--ink) 20%, transparent);
  color: var(--ink);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.peanot-crash__confirm {
  margin-top: 10px;
  padding: 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--red) 10%, transparent);
  border: 1px dashed color-mix(in srgb, var(--red) 45%, transparent);
}

.peanot-crash__confirm-text {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
}

.peanot-crash__confirm-row {
  display: flex;
  gap: 8px;
}

.peanot-crash__confirm-row .peanot-crash__secondary,
.peanot-crash__confirm-row .peanot-crash__danger {
  flex: 1;
  width: auto;
}

.peanot-crash__danger {
  padding: 11px 14px;
  border-radius: 99px;
  background: var(--red);
  border: 1.5px solid var(--red);
  color: var(--fill-text);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
}

.peanot-crash__footnote {
  margin: 20px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dim);
}

.peanot-crash__digest {
  margin: 10px 0 0;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px;
  color: var(--dim);
  word-break: break-all;
}
`;
