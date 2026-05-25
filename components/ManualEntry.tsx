"use client";

import { useState, type FormEvent } from "react";
import { sanitizeBarcode } from "@/lib/barcode";

interface ManualEntryProps {
  onSubmit: (barcode: string) => void;
  disabled?: boolean;
}

export default function ManualEntry({ onSubmit, disabled }: ManualEntryProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const barcode = sanitizeBarcode(value);
    if (barcode !== "") {
      onSubmit(barcode);
    }
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
          placeholder="z. B. 4011200296908"
          value={value}
          onChange={(e) => setValue(sanitizeBarcode(e.target.value))}
        />
        <button type="submit" disabled={disabled || sanitizeBarcode(value) === ""}>
          Prüfen
        </button>
      </div>
    </form>
  );
}
