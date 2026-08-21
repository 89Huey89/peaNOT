import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAudioContextForTests, beep, tick, unlockAudio, vibrate } from "@/lib/feedback";

/** Minimal WebAudio node stub: connect() returns its argument, like the real API. */
function fakeNode(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn((dest: unknown) => dest), ...extra };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createOscillator = vi.fn(() =>
    fakeNode({ type: "", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn() }),
  );
  createGain = vi.fn(() => fakeNode({ gain: { value: 0 } }));

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

/** Constructor that always throws, simulating a browser refusing to create one. */
class ThrowingAudioContext {
  constructor() {
    throw new Error("no audio for you");
  }
}

function installAudioContext(ctor: unknown) {
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: ctor,
  });
}

function removeAudioContext() {
  Reflect.deleteProperty(window, "AudioContext");
}

describe("vibrate", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("does nothing when the Vibration API is unavailable (iOS Safari)", () => {
    // jsdom mirrors iOS here: no navigator.vibrate at all.
    expect(() => vibrate(25)).not.toThrow();
  });

  it("calls navigator.vibrate with the given pattern when available", () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrateMock });

    vibrate([60, 40, 60]);

    expect(vibrateMock).toHaveBeenCalledWith([60, 40, 60]);
  });

  it("swallows a throwing navigator.vibrate", () => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => {
        throw new Error("denied");
      },
    });

    expect(() => vibrate(25)).not.toThrow();
  });
});

describe("beep / unlockAudio (shared AudioContext)", () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    __resetAudioContextForTests();
  });

  afterEach(() => {
    removeAudioContext();
    __resetAudioContextForTests();
  });

  it("does nothing when WebAudio is unavailable", () => {
    removeAudioContext();
    expect(() => beep()).not.toThrow();
    expect(() => unlockAudio()).not.toThrow();
    expect(() => tick()).not.toThrow();
  });

  it("never throws if the AudioContext constructor itself throws", () => {
    installAudioContext(ThrowingAudioContext);
    expect(() => beep()).not.toThrow();
    expect(() => unlockAudio()).not.toThrow();
  });

  it("reuses a single shared context across repeated beeps instead of creating one per call", () => {
    installAudioContext(FakeAudioContext);

    beep();
    tick();
    beep({ freq: 440 });

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("resumes the shared context when unlockAudio() runs on a suspended context", () => {
    installAudioContext(FakeAudioContext);

    unlockAudio();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0]!.resume).toHaveBeenCalledTimes(1);
  });

  it("does not call resume() again once the context is already running", () => {
    installAudioContext(FakeAudioContext);

    unlockAudio();
    const ctx = FakeAudioContext.instances[0]!;
    ctx.state = "running";
    unlockAudio();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("plays a beep through the shared context's oscillator", () => {
    installAudioContext(FakeAudioContext);

    beep({ freq: 880, dur: 0.18 });

    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    const osc = ctx.createOscillator.mock.results[0]!.value as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });
});
