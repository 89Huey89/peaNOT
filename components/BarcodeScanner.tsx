"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { sanitizeBarcode } from "@/lib/barcode";
import { shouldAcceptScan, type LastScan } from "@/lib/scan";
import { tick, vibrate } from "@/lib/feedback";

type ScannerState = "idle" | "starting" | "scanning" | "denied" | "unsupported";

/**
 * Request a sharp, higher-resolution rear-camera stream. More pixels make
 * small / distant barcodes readable; continuous autofocus keeps them sharp as
 * the user moves. `advanced` constraints are best-effort, so devices that lack
 * focus control simply ignore them instead of failing.
 */
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    advanced: [{ focusMode: "continuous" }],
  } as unknown as MediaTrackConstraints,
};

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  /** Freeze decoding while a result/lookup is on screen; resume when false. */
  paused: boolean;
  /** Show the lookup spinner over the frozen frame. */
  loading: boolean;
  /** Light confirmation feedback the moment a code is read. */
  haptic: boolean;
  sound: boolean;
}

export default function BarcodeScanner({
  onDetected,
  paused,
  loading,
  haptic,
  sound,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lastScanRef = useRef<LastScan | null>(null);
  const frozenRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const hapticRef = useRef(haptic);
  hapticRef.current = haptic;
  const soundRef = useRef(sound);
  soundRef.current = sound;

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
      // Load the (heavy) ZXing libraries only now, on the user's deliberate tap,
      // so they stay out of the initial scan-screen bundle.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([import("@zxing/browser"), import("@zxing/library")]);

      const hints = new Map<number, unknown>([
        // Restrict ZXing to product barcode formats so each frame decodes faster.
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
        // Also scan rotated rows so a barcode held vertically / at an angle is read.
        [DecodeHintType.TRY_HARDER, true],
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 200,
      });
      const controls = await reader.decodeFromConstraints(
        CAMERA_CONSTRAINTS,
        videoRef.current!,
        (result) => {
          if (pausedRef.current || frozenRef.current || !result) return;
          const code = sanitizeBarcode(result.getText());
          if (code === "") return;
          const now = Date.now();
          if (!shouldAcceptScan(lastScanRef.current, code, now)) return;
          lastScanRef.current = { code, time: now };

          // Freeze the displayed frame (track stays live for instant resume)
          // and notify the user. Scanning resumes via the `paused` effect once
          // the result is dismissed — the camera is never torn down in between.
          frozenRef.current = true;
          try {
            videoRef.current?.pause();
          } catch {
            /* ignore */
          }
          setDetectedCode(code);
          if (hapticRef.current) vibrate(25);
          if (soundRef.current) tick();
          onDetectedRef.current(code);
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

  // The camera is started deliberately by the user (tap "Kamera starten")
  // rather than on mount, so it never grabs a frame before the user is ready
  // to aim — which previously caused premature scans right after launch. Once
  // started, the stream stays alive across scans via the freeze/resume effect.

  // Parent-controlled freeze/resume. While paused (lookup running or result on
  // screen) the frame stays frozen; the moment it clears we resume instantly.
  useEffect(() => {
    if (state !== "scanning") return;
    if (paused) {
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    frozenRef.current = false;
    setDetectedCode(null);
    playVideo();
  }, [paused, state, playVideo]);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      trackRef.current = null;
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
            <Check size={13} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />Barcode erkannt: {detectedCode}
          </div>
        ) : null}
        {loading ? (
          <div className="scanner__loading" role="status" aria-live="polite">
            <span className="scanner__spinner" aria-hidden="true" />
            <span>Prüfe Produkt…</span>
          </div>
        ) : null}
      </div>

      {state === "idle" || state === "starting" || state === "denied" ? (
        <button
          type="button"
          className="scanner__start"
          onClick={start}
          disabled={state === "starting"}
        >
          {state === "starting"
            ? "Kamera startet…"
            : state === "denied"
              ? "Erneut versuchen"
              : "Kamera starten"}
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
