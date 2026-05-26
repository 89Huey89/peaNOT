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

interface BeepOptions {
  freq?: number;
  /** Duration in seconds. */
  dur?: number;
  vol?: number;
}

/** Short WebAudio beep. Caller decides whether the user opted into sound. */
export function beep({ freq = 880, dur = 0.18, vol = 0.05 }: BeepOptions = {}): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

/** Soft, brief confirmation tone for a successful barcode read. */
export function tick(): void {
  beep({ freq: 660, dur: 0.06, vol: 0.03 });
}
