import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const PREFS_KEY = "peanot.prefs.v1";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function setOnboarded(value: boolean) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ onboarded: value }));
}

// The iOS-hint branch is the only install-banner path exercisable without a
// real beforeinstallprompt event, so every test masquerades as iOS Safari.
function stubIosSafari() {
  Object.defineProperty(window.navigator, "userAgent", {
    value: IOS_SAFARI_UA,
    configurable: true,
  });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as Window["matchMedia"];
}

describe("ServiceWorkerRegister install banner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    stubIosSafari();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden before onboarding is complete, however long it waits", async () => {
    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the install hint after the delay when already onboarded on mount", async () => {
    setOnboarded(true);
    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Zum Home-Bildschirm");
  });

  it("only starts the delay once onboarding finishes mid-session", async () => {
    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    setOnboarded(true);

    // Next storage poll (every 1s) picks up onboarding and arms the delay —
    // the banner must not appear before the full 4s have elapsed since then.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps the dismiss persistence once eligible", async () => {
    setOnboarded(true);
    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    fireEvent.click(screen.getByRole("button", { name: /schließen/i }));

    expect(localStorage.getItem("peanot.install-dismissed.v1")).toBe("1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
