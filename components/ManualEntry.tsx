"use client";

import { useState, type FormEvent } from "react";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";

interface ManualEntryProps {
  onSubmit: (barcode: string) => void;
  disabled?: boolean;
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
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={value !== "" && !valid}
          aria-describedby="manual-barcode-hint"
          placeholder="z. B. 4011200296908"
          value={value}
          onChange={(e) => setValue(sanitizeBarcode(e.target.value))}
        />
        <button type="submit" disabled={disabled || !valid}>
          Prüfen
        </button>
      </div>
      {value === "" ? null : valid ? (
        <p id="manual-barcode-hint" className="manual-entry__hint manual-entry__hint--ok">
          ✓ Gültige Länge
        </p>
      ) : (
        <p id="manual-barcode-hint" className="manual-entry__hint" role="status">
          Barcode hat 8–14 Ziffern (aktuell {value.length}).
        </p>
      )}
    </form>
  );
}
