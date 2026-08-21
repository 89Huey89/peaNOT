import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { decodeMock, readerCtor } = vi.hoisted(() => {
  const decodeMock = vi.fn();
  const readerCtor = vi
    .fn()
    .mockImplementation(() => ({ decodeFromConstraints: decodeMock }));
  return { decodeMock, readerCtor };
});

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: readerCtor,
}));

import { DecodeHintType } from "@zxing/library";
import BarcodeScanner from "@/components/BarcodeScanner";

type DecodeCallback = (result: { getText: () => string } | undefined) => void;

/** Default props; individual tests override what they exercise. */
const baseProps = {
  onDetected: () => {},
  paused: false,
  loading: false,
  haptic: false,
  sound: false,
};

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

/** jsdom does not implement media playback – stub so the component can call them. */
function stubMediaPlayback() {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
}

/** The camera now starts only on an explicit tap; click the start button. */
async function clickStart() {
  await userEvent.click(await screen.findByRole("button", { name: /Kamera starten/ }));
}

/** Clears the ~800ms post-start arming delay (real timers — see ARM_DELAY_MS
 * in components/BarcodeScanner.tsx) so a test can exercise scans after it. */
async function waitForArm() {
  await new Promise((resolve) => setTimeout(resolve, 850));
}

describe("BarcodeScanner", () => {
  beforeEach(() => {
    decodeMock.mockReset();
    readerCtor.mockClear();
    setMediaDevices({ getUserMedia: vi.fn() });
    stubMediaPlayback();
  });

  it("does not start the camera until the user taps start", async () => {
    decodeMock.mockImplementation(async () => ({ stop: vi.fn() }));

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);

    // Nothing decodes on mount; the start affordance is shown instead.
    expect(decodeMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Kamera starten/ })).toBeInTheDocument();
  });

  it("starts the camera on mount when autoStart is on (UX10), no tap required", async () => {
    decodeMock.mockImplementation(async () => ({ stop: vi.fn() }));

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} autoStart />);

    await waitFor(() => expect(decodeMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Kamera starten/ })).not.toBeInTheDocument();
  });

  it("still arms an auto-started camera before accepting a scan", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner {...baseProps} onDetected={onDetected} autoStart />);
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    capturedCallback({ getText: () => "4011200296908" });
    expect(onDetected).not.toHaveBeenCalled();

    await waitForArm();
    capturedCallback({ getText: () => "4011200296908" });
    expect(onDetected).toHaveBeenCalledWith("4011200296908");
  });

  it("starts any-orientation, high-resolution, autofocusing capture on tap", async () => {
    let captured: MediaStreamConstraints | undefined;
    decodeMock.mockImplementation(
      async (constraints: MediaStreamConstraints, _video: HTMLVideoElement, _cb: DecodeCallback) => {
        captured = constraints;
        return { stop: vi.fn() };
      },
    );

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    // TRY_HARDER lets ZXing decode rotated / vertically held barcodes.
    const hints = readerCtor.mock.calls[0]![0] as Map<number, unknown>;
    expect(hints.get(DecodeHintType.TRY_HARDER)).toBe(true);

    // Higher resolution + continuous focus extend the readable distance.
    const video = captured!.video as Record<string, unknown>;
    expect(video.width).toEqual({ ideal: 1280 });
    expect(video.height).toEqual({ ideal: 720 });
    expect(video.advanced).toContainEqual({ focusMode: "continuous" });
  });

  it("reports a detected barcode (debounced)", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner {...baseProps} onDetected={onDetected} />);
    await clickStart();
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());
    await waitForArm();

    capturedCallback({ getText: () => "4011200296908" });
    capturedCallback({ getText: () => "4011200296908" }); // duplicate within window

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("4011200296908");
  });

  it("ignores a detection during the ~800ms arming delay right after start, then accepts once armed", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner {...baseProps} onDetected={onDetected} />);
    await clickStart();
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    // Still inside the arming window right after start — this used to be
    // exactly the premature-scan case the manual-tap-only design prevented.
    capturedCallback({ getText: () => "4011200296908" });
    expect(onDetected).not.toHaveBeenCalled();

    await waitForArm();
    capturedCallback({ getText: () => "4011200296908" });
    expect(onDetected).toHaveBeenCalledWith("4011200296908");
  });

  it("ignores detections while paused (result on screen)", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner {...baseProps} onDetected={onDetected} paused />);
    await clickStart();
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    capturedCallback({ getText: () => "4011200296908" });

    expect(onDetected).not.toHaveBeenCalled();
  });

  it("shows a banner and freezes when a barcode is detected", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video: HTMLVideoElement, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());
    // Wait until the start flow settles into "scanning" (start button gone),
    // otherwise the idle→scanning transition would clear the fresh banner.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Kamera/ })).toBeNull());
    await waitForArm();

    capturedCallback({ getText: () => "4011200296908" });

    const banner = await screen.findByText(/Barcode erkannt: 4011200296908/);
    expect(banner).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("shows the lookup spinner while loading", async () => {
    decodeMock.mockImplementation(async () => ({ stop: vi.fn() }));

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} loading paused />);

    expect(await screen.findByText(/Prüfe Produkt/)).toBeInTheDocument();
  });

  it("offers a torch toggle when the camera supports it", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: () => ({ torch: true }),
      applyConstraints,
    };
    decodeMock.mockImplementation(async (_constraints, video: HTMLVideoElement, _cb: DecodeCallback) => {
      Object.defineProperty(video, "srcObject", {
        configurable: true,
        value: { getVideoTracks: () => [track] },
      });
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();

    const torchButton = await screen.findByRole("button", { name: "Licht an" });
    await userEvent.click(torchButton);

    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(await screen.findByRole("button", { name: "Licht aus" })).toBeInTheDocument();
  });

  it("offers a 1x/2x zoom toggle when the track reports a usable zoom range", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: () => ({ zoom: { min: 1, max: 8, step: 0.1 } }),
      applyConstraints,
    };
    decodeMock.mockImplementation(async (_constraints, video: HTMLVideoElement, _cb: DecodeCallback) => {
      Object.defineProperty(video, "srcObject", {
        configurable: true,
        value: { getVideoTracks: () => [track] },
      });
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();

    const zoomButton = await screen.findByRole("button", { name: "1×" });
    await userEvent.click(zoomButton);

    // 2x is clamped into the track's own [min, max] range.
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] });
    const zoomedButton = await screen.findByRole("button", { name: "2×" });
    expect(zoomedButton).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(zoomedButton);
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ zoom: 1 }] });
    expect(await screen.findByRole("button", { name: "1×" })).toBeInTheDocument();
  });

  it("clamps the 2x target to a track's max when the range doesn't reach 2", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: () => ({ zoom: { min: 1, max: 1.5 } }),
      applyConstraints,
    };
    decodeMock.mockImplementation(async (_constraints, video: HTMLVideoElement, _cb: DecodeCallback) => {
      Object.defineProperty(video, "srcObject", {
        configurable: true,
        value: { getVideoTracks: () => [track] },
      });
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();
    await userEvent.click(await screen.findByRole("button", { name: "1×" }));

    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 1.5 }] });
  });

  it("does not offer a zoom toggle when the track has no zoom capability", async () => {
    const track = { getCapabilities: () => ({ torch: true }) };
    decodeMock.mockImplementation(async (_constraints, video: HTMLVideoElement, _cb: DecodeCallback) => {
      Object.defineProperty(video, "srcObject", {
        configurable: true,
        value: { getVideoTracks: () => [track] },
      });
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();
    await screen.findByRole("button", { name: "Licht an" });

    expect(screen.queryByRole("button", { name: "1×" })).not.toBeInTheDocument();
  });

  it("shows a German message when camera access is denied", async () => {
    decodeMock.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Kamerazugriff verweigert/);
    // A retry affordance is offered after denial.
    expect(await screen.findByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
  });

  it("shows an unsupported message when the camera API is missing", async () => {
    setMediaDevices(undefined);

    render(<BarcodeScanner {...baseProps} onDetected={vi.fn()} />);
    await clickStart();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Kamera nicht verfügbar/);
    expect(decodeMock).not.toHaveBeenCalled();
  });
});
