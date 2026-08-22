"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";

interface ManualEntryProps {
  onSubmit: (barcode: string) => void;
  disabled?: boolean;
}

/**
 * Small inline spinner for the "Prüfen" button's busy state (Befund 05).
 * Reuses the `spin` keyframe already declared globally in app/globals.css
 * (it drives BarcodeScanner's `.scanner__spinner`) — referencing it by name
 * needs no new CSS, and this file isn't allowed to touch globals.css anyway.
 * `currentColor` picks up the button's own text color, so it stays legible
 * in both the light/dark palettes without needing a Palette prop here.
 */
function Spinner({ size = 13 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 99,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        opacity: 0.85,
        animation: "spin 0.8s linear infinite",
        verticalAlign: "-2px",
      }}
    />
  );
}

export default function ManualEntry({ onSubmit, disabled }: ManualEntryProps) {
  const [value, setValue] = useState("");
  const valid = isValidBarcode(value);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid) onSubmit(value);
  }

  return (
    <form className="manual-entry" onSubmit={handleSubmit}>
      <label htmlFor="manual-barcode">Barcode manuell eingeben</label>
      <div className="manual-entry__row">
        <input
          id="manual-barcode"
          name="barcode"
          // Focus on mount: the field only renders once the user opens it.
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={value !== "" && !valid}
          aria-describedby="manual-barcode-hint"
          placeholder="z. B. 4011200296908"
          value={value}
          onChange={(e) => setValue(sanitizeBarcode(e.target.value))}
        />
        {/* Befund 05: `disabled` means a lookup is in flight — either this
            very submission (ScanScreen closes the sheet on submit, so in
            practice that window is a single render), or a *different* one
            still running when this sheet happens to be opened (e.g. a
            favorite was just re-checked). Either way, the button is exactly
            what the user is looking at, so it carries the busy state itself
            instead of relying on the scanner box's spinner, which sits
            behind this sheet and its scrim while the sheet is open. */}
        <button type="submit" disabled={disabled || !valid} aria-busy={disabled || undefined}>
          {disabled ? (
            <>
              <Spinner /> Prüfe…
            </>
          ) : (
            "Prüfen"
          )}
        </button>
      </div>
      {/* Not visible (the button already shows this to sighted users) but
          keeps VoiceOver informed even if focus isn't sitting on the button
          — e.g. it was opened onto an already-in-flight lookup. */}
      {disabled ? (
        // role="status" only takes its accessible name from aria-label (it
        // isn't a "name from content" role), so the visible text alone
        // wouldn't reach VoiceOver here — hence the explicit aria-label
        // duplicating it.
        <p className="sr-only" role="status" aria-live="polite" aria-label="Prüfe Produkt…">
          Prüfe Produkt…
        </p>
      ) : null}
      {value === "" ? null : valid ? (
        <p id="manual-barcode-hint" className="manual-entry__hint manual-entry__hint--ok">
          <Check size={12} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />Gültige Länge
        </p>
      ) : (
        <p id="manual-barcode-hint" className="manual-entry__hint" role="status">
          Barcode hat 8–14 Ziffern (aktuell {value.length}).
        </p>
      )}
    </form>
  );
}
