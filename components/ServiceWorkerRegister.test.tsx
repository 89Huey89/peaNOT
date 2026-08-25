import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const PREFS_KEY = "peanot.prefs.v1";
const INSTALL_DISMISSED_KEY = "peanot.install-dismissed.v1";
const VISIT_COUNT_KEY = "peanot.install-hint-visits.v1";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function setOnboarded(value: boolean) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ onboarded: value }));
}

// The Wiedervorlage schedule only re-shows the hint from the 3rd visit
// onward (see isEligibleVisit in the component). bumpVisitCount() reads the
// *previous* count and adds one for "this" mount, so seeding "2" here makes
// the render below count as visit 3 — the first eligible one.
function seedEligibleVisit() {
  localStorage.setItem(VISIT_COUNT_KEY, "2");
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

function appendOpenDialog(): HTMLElement {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  document.body.appendChild(dialog);
  return dialog;
}

// Flushes the MutationObserver microtask queue. MutationObserver callbacks
// are scheduled as microtasks, which run independently of vi.useFakeTimers
// (that only fakes macrotasks like setTimeout/setInterval) — so a couple of
// awaited microtask ticks is enough to let a pending callback fire and its
// resulting state update commit.
async function flushDialogObserver() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
    seedEligibleVisit();
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
    seedEligibleVisit();
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

  it("does not show on the 1st or 2nd visit — only from the 3rd (Wiedervorlage) onward", async () => {
    setOnboarded(true);
    // No seeding: this is visit 1.
    const first = render(<ServiceWorkerRegister />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    // Visit counter now sits at 1 -> this mount is visit 2, still not eligible.
    render(<ServiceWorkerRegister />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("suppresses the install hint while a modal dialog is open, and re-shows it once the dialog closes", async () => {
    setOnboarded(true);
    seedEligibleVisit();
    const dialog = appendOpenDialog();

    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    // Otherwise eligible, but a dialog (the result overlay / a bottom sheet /
    // the allergy card all use this markup) is open — must stay hidden.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    document.body.removeChild(dialog);
    await flushDialogObserver();

    expect(screen.getByRole("status")).toHaveTextContent("Zum Home-Bildschirm");
  });

  it("auto-hides the install hint after ~10s without marking it as permanently dismissed", async () => {
    setOnboarded(true);
    seedEligibleVisit();
    render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Auto-hide is a soft, session-local hide — never the permanent dismiss.
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBeNull();
  });

  it("keeps the dismiss persistence once eligible, including on a later Wiedervorlage-qualifying visit", async () => {
    setOnboarded(true);
    seedEligibleVisit();
    const first = render(<ServiceWorkerRegister />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    fireEvent.click(screen.getByRole("button", { name: /schließen/i }));

    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe("1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    // Jump ahead to the 13th visit (the next Wiedervorlage slot) — an
    // explicit dismiss must still win over it.
    localStorage.setItem(VISIT_COUNT_KEY, "12");
    render(<ServiceWorkerRegister />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("ServiceWorkerRegister update banner", () => {
  const originalServiceWorker = window.navigator.serviceWorker;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
    });
  });

  // Stubs a service worker registration that immediately resolves with a
  // waiting worker over an existing controller — the same shape the real
  // "update installed" flow produces (see the updatefound/statechange
  // handling in the component).
  function stubWaitingServiceWorker() {
    vi.stubEnv("NODE_ENV", "production");
    const fakeReg = {
      waiting: {} as ServiceWorker,
      addEventListener: vi.fn(),
    };
    const fakeServiceWorker = {
      controller: {} as ServiceWorker,
      register: vi.fn().mockResolvedValue(fakeReg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: fakeServiceWorker,
      configurable: true,
    });
  }

  it("shows immediately with no onboarding/visit-count/auto-hide gating", async () => {
    stubWaitingServiceWorker();
    const { unmount } = render(<ServiceWorkerRegister />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Neue Version verfügbar.")).toBeInTheDocument();

    // None of the install-banner rules apply: no Wiedervorlage delay, and no
    // auto-hide even after well over the install hint's 10s timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.getByText("Neue Version verfügbar.")).toBeInTheDocument();

    // Unmount while the service-worker stub is still in place — afterEach
    // restores the original (unstubbed) navigator.serviceWorker, and the
    // component's own cleanup needs the stub to still be there to run
    // cleanly against.
    unmount();
  });

  it("defers only while a modal dialog is open, then shows as soon as it closes", async () => {
    stubWaitingServiceWorker();
    const dialog = appendOpenDialog();

    const { unmount } = render(<ServiceWorkerRegister />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Same fixed bottom-of-screen slot as the install hint, so it would
    // reproduce Befund 03 over an open dialog — deferred until it closes.
    expect(screen.queryByText("Neue Version verfügbar.")).not.toBeInTheDocument();

    document.body.removeChild(dialog);
    await flushDialogObserver();

    expect(screen.getByText("Neue Version verfügbar.")).toBeInTheDocument();
    unmount();
  });
});
