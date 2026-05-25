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

describe("BarcodeScanner", () => {
  beforeEach(() => {
    decodeMock.mockReset();
    setMediaDevices({ getUserMedia: vi.fn() });
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
