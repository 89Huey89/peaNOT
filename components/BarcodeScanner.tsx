"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { sanitizeBarcode } from "@/lib/barcode";
import { shouldAcceptScan, type LastScan } from "@/lib/scan";

type ScannerState = "idle" | "starting" | "scanning" | "denied" | "unsupported";

/** Restrict ZXing to product barcode formats so each frame decodes faster. */
const PRODUCT_FORMAT_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODE_128,
    ],
  ],
]);

/** How long the frozen frame + banner stay before scanning resumes. */
const RESUME_DELAY_MS = 1800;

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lastScanRef = useRef<LastScan | null>(null);
  const frozenRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [state, setState] = useState<ScannerState>("idle");
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const playVideo = useCallback(() => {
    try {
      const p = videoRef.current?.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      /* jsdom / autoplay restrictions – safe to ignore */
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const reader = new BrowserMultiFormatReader(PRODUCT_FORMAT_HINTS, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 200,
      });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result) => {
          if (frozenRef.current || !result) return;
          const code = sanitizeBarcode(result.getText());
          if (code === "") return;
          const now = Date.now();
          if (!shouldAcceptScan(lastScanRef.current, code, now)) return;
          lastScanRef.current = { code, time: now };

          // Freeze the displayed frame (track stays live for instant resume)
          // and notify the user, then auto-resume scanning after a short delay.
          frozenRef.current = true;
          try {
            videoRef.current?.pause();
          } catch {
            /* ignore */
          }
          setDetectedCode(code);
          onDetectedRef.current(code);

          resumeTimerRef.current = setTimeout(() => {
            frozenRef.current = false;
            setDetectedCode(null);
            playVideo();
          }, RESUME_DELAY_MS);
        },
      );
      controlsRef.current = controls;

      const track =
        (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks?.()[0] ??
        null;
      trackRef.current = track;
      const caps = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;
      setTorchSupported(Boolean(caps?.torch));

      setState("scanning");
    } catch (err) {
      const name =
        typeof err === "object" && err !== null && "name" in err
          ? String((err as { name: unknown }).name)
          : "";
      setState(name === "NotAllowedError" ? "denied" : "unsupported");
    }
  }, [playVideo]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      /* device rejected torch toggle – leave state unchanged */
    }
  }, [torchOn]);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      trackRef.current = null;
      if (resumeTimerRef.current !== null) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      frozenRef.current = false;
    };
  }, []);

  return (
    <div className="scanner">
      <div className="scanner__viewport">
        <video
          ref={videoRef}
          className="scanner__video"
          playsInline
          muted
          aria-label="Kamerabild zum Barcode-Scannen"
        />
        {state === "scanning" && detectedCode === null ? (
          <div className="scanner__sweep" aria-hidden="true" />
        ) : null}
        {detectedCode !== null ? (
          <div className="scanner__banner" role="status" aria-live="polite">
            ✓ Barcode erkannt: {detectedCode}
          </div>
        ) : null}
      </div>

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
      {state === "scanning" && torchSupported ? (
        <button
          type="button"
          className="scanner__torch"
          onClick={toggleTorch}
          aria-pressed={torchOn}
        >
          {torchOn ? "Licht aus" : "Licht an"}
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
