import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { decodeMock } = vi.hoisted(() => ({ decodeMock: vi.fn() }));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromConstraints: decodeMock,
  })),
}));

import BarcodeScanner from "@/components/BarcodeScanner";

type DecodeCallback = (result: { getText: () => string } | undefined) => void;

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

describe("BarcodeScanner", () => {
  beforeEach(() => {
    decodeMock.mockReset();
    setMediaDevices({ getUserMedia: vi.fn() });
    stubMediaPlayback();
  });

  it("starts the camera and reports a detected barcode (debounced)", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, _video, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} />);

    await userEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    capturedCallback({ getText: () => "4011200296908" });
    capturedCallback({ getText: () => "4011200296908" }); // duplicate within window

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("4011200296908");
  });

  it("shows a banner and freezes when a barcode is detected", async () => {
    let capturedCallback: DecodeCallback = () => {};
    decodeMock.mockImplementation(async (_constraints, video: HTMLVideoElement, cb: DecodeCallback) => {
      capturedCallback = cb;
      return { stop: vi.fn() };
    });

    render(<BarcodeScanner onDetected={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());

    capturedCallback({ getText: () => "4011200296908" });

    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(/Barcode erkannt: 4011200296908/);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
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

    render(<BarcodeScanner onDetected={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Kamera starten" }));

    const torchButton = await screen.findByRole("button", { name: "Licht an" });
    await userEvent.click(torchButton);

    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(await screen.findByRole("button", { name: "Licht aus" })).toBeInTheDocument();
  });

  it("shows a German message when camera access is denied", async () => {
    decodeMock.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    render(<BarcodeScanner onDetected={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Kamera starten" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Kamerazugriff verweigert/);
  });

  it("shows an unsupported message when the camera API is missing", async () => {
    setMediaDevices(undefined);

    render(<BarcodeScanner onDetected={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Kamera starten" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Kamera nicht verfügbar/);
    expect(decodeMock).not.toHaveBeenCalled();
  });
});
