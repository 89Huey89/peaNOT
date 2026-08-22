import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Error from "@/app/error";

const HISTORY_KEY = "peanot.history.v1";
const OTHER_KEY = "peanot.notes.v1";

function crashError(digest?: string): globalThis.Error & { digest?: string } {
  const err = new globalThis.Error("boom") as globalThis.Error & { digest?: string };
  if (digest) err.digest = digest;
  return err;
}

describe("app/error.tsx (Befund 02's crash screen)", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: "h1" }]));
    window.localStorage.setItem(OTHER_KEY, JSON.stringify({ some: "note" }));

    // jsdom's real window.location.reload just logs a "not implemented"
    // warning; replace it with a plain spy so the reset path is both quiet
    // and assertable.
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { reload: reloadSpy },
    });

    // The component logs the crash via console.error on mount — expected
    // and desired, but keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an honest heading and a short explanation", () => {
    render(<Error error={crashError()} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /da ist etwas schiefgelaufen/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/abgestürzt/i)).toBeInTheDocument();
  });

  it('"Erneut versuchen" calls reset() and touches nothing in localStorage', () => {
    const reset = vi.fn();
    render(<Error error={crashError()} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('a single tap on "Verlauf zurücksetzen" only asks for confirmation — it does not delete anything yet', () => {
    render(<Error error={crashError()} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Verlauf zurücksetzen" }));

    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
    // The confirmation explicitly names what is and isn't affected.
    expect(screen.getByText(/notizen, favoriten, einstellungen/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ja, Verlauf löschen" }),
    ).toBeInTheDocument();
  });

  it('"Abbrechen" backs out of the confirmation without deleting anything', () => {
    render(<Error error={crashError()} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Verlauf zurücksetzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
    // Back to the single secondary button, confirmation panel gone.
    expect(screen.getByRole("button", { name: "Verlauf zurücksetzen" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ja, Verlauf löschen" }),
    ).not.toBeInTheDocument();
  });

  it("confirming the reset removes only the history key and reloads, leaving every other key untouched", () => {
    render(<Error error={crashError()} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Verlauf zurücksetzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, Verlauf löschen" }));

    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(window.localStorage.getItem(OTHER_KEY)).toEqual(JSON.stringify({ some: "note" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the error digest when Next.js provides one, for support reference", () => {
    render(<Error error={crashError("abc123digest")} reset={vi.fn()} />);
    expect(screen.getByText(/abc123digest/)).toBeInTheDocument();
  });

  it("shows no digest line when none is provided", () => {
    render(<Error error={crashError()} reset={vi.fn()} />);
    expect(screen.queryByText(/Fehlercode/)).not.toBeInTheDocument();
  });
});
