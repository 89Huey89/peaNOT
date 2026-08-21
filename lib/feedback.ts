// Shared haptic + audio feedback helpers, used by the scanner (light tick on
// detection) and the result screen (strong alarm on a peanut hit).

/** Vibrate if the device supports it; never throws. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration unavailable – ignore */
  }
}

// A fresh AudioContext created outside a user gesture starts suspended on iOS
// Safari and never plays, even for a later beep() — only a call inside the
// synchronous stack of a tap handler is allowed to resume it. So we keep one
// shared context alive for the whole session instead of one per beep, and
// unlock it explicitly from primary taps (see unlockAudio).
let sharedCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

/**
 * Resume the shared AudioContext. Call this synchronously from a user-gesture
 * handler (tap "Kamera starten", starting a product lookup, …) — iOS only
 * lets a suspended context start from within that call stack, not from an
 * async beep() later on. Never throws.
 */
export function unlockAudio(): void {
  try {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio unavailable */
  }
}

interface BeepOptions {
  freq?: number;
  /** Duration in seconds. */
  dur?: number;
  vol?: number;
}

/** Short WebAudio beep. Caller decides whether the user opted into sound. */
export function beep({ freq = 880, dur = 0.18, vol = 0.05 }: BeepOptions = {}): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + dur);
  } catch {
    /* audio unavailable */
  }
}

/** Soft, brief confirmation tone for a successful barcode read. */
export function tick(): void {
  beep({ freq: 660, dur: 0.06, vol: 0.03 });
}

/** Test-only: drop the shared context so module state doesn't leak between tests. */
export function __resetAudioContextForTests(): void {
  sharedCtx = null;
}
