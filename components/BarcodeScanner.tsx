"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { sanitizeBarcode } from "@/lib/barcode";
import { shouldAcceptScan, type LastScan } from "@/lib/scan";

type ScannerState = "idle" | "starting" | "scanning" | "denied" | "unsupported";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<LastScan | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [state, setState] = useState<ScannerState>("idle");

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result) => {
          if (!result) return;
          const code = sanitizeBarcode(result.getText());
          if (code === "") return;
          const now = Date.now();
          if (!shouldAcceptScan(lastScanRef.current, code, now)) return;
          lastScanRef.current = { code, time: now };
          onDetectedRef.current(code);
        },
      );
      controlsRef.current = controls;
      setState("scanning");
    } catch (err) {
      const name =
        typeof err === "object" && err !== null && "name" in err
          ? String((err as { name: unknown }).name)
          : "";
      setState(name === "NotAllowedError" ? "denied" : "unsupported");
    }
  }, []);

  useEffect(() => stop, [stop]);

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        className="scanner__video"
        playsInline
        muted
        aria-label="Kamerabild zum Barcode-Scannen"
      />
      {state === "idle" || state === "starting" ? (
        <button
          type="button"
          className="scanner__start"
          onClick={start}
          disabled={state === "starting"}
        >
          {state === "starting" ? "Kamera startet…" : "Kamera starten"}
        </button>
      ) : null}
      {state === "denied" ? (
        <p className="scanner__hint" role="alert">
          Kamerazugriff verweigert. Bitte erlaube den Zugriff oder nutze die
          manuelle Eingabe unten.
        </p>
      ) : null}
      {state === "unsupported" ? (
        <p className="scanner__hint" role="alert">
          Kamera nicht verfügbar. Bitte nutze die manuelle Eingabe unten.
        </p>
      ) : null}
    </div>
  );
}
