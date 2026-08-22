import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHistoryOverlay } from "@/components/useHistoryOverlay";

describe("useHistoryOverlay", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom's location/history persist across tests within this file (one
    // jsdom window per file, not per test) — reset it before every test so
    // a `screen` URL written by one test can't leak into the next one's
    // assertions.
    window.history.replaceState(null, "", "/");
    pushSpy = vi.spyOn(window.history, "pushState");
    // Real browsers fire popstate asynchronously after history.back(); the
    // hook doesn't care about timing, only that it eventually gets exactly
    // one popstate per back() call — so the mock fires it synchronously,
    // which also keeps every test self-contained (no leftover state ever
    // straddles into the next test).
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  afterEach(() => {
    pushSpy.mockRestore();
    backSpy.mockRestore();
  });

  it("pushes exactly one history entry while open, even across re-renders", () => {
    const onClose = vi.fn();
    const { rerender, unmount } = renderHook(({ open }) => useHistoryOverlay(open, onClose), {
      initialProps: { open: false },
    });
    expect(pushSpy).not.toHaveBeenCalled();

    rerender({ open: true });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Guard against double-push: re-rendering while still open must not
    // push a second entry.
    rerender({ open: true });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("maps a popstate (edge-swipe back) to onClose while open", () => {
    const onClose = vi.fn();
    const { rerender, unmount } = renderHook(({ open }) => useHistoryOverlay(open, onClose), {
      initialProps: { open: false },
    });
    rerender({ open: true });

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does nothing on a popstate when no overlay is open (base-state guard)", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useHistoryOverlay(false, onClose));

    expect(() => window.dispatchEvent(new PopStateEvent("popstate"))).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });

  it("pops its own entry via history.back() when closed by the UI, not the back gesture", () => {
    const onClose = vi.fn();
    const { rerender, unmount } = renderHook(({ open }) => useHistoryOverlay(open, onClose), {
      initialProps: { open: true },
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Closed via a "Schließen"/"Zurück" tap: `open` flips without any
    // popstate ever having fired.
    rerender({ open: false });

    expect(backSpy).toHaveBeenCalledTimes(1);
    // The resulting (self-triggered) popstate must not be mistaken for a
    // second, real close.
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });

  it("a single popstate closes only the most recently opened of two stacked overlays", () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    const outer = renderHook(({ open }) => useHistoryOverlay(open, onCloseOuter), {
      initialProps: { open: true },
    });
    const inner = renderHook(({ open }) => useHistoryOverlay(open, onCloseInner), {
      initialProps: { open: true },
    });
    expect(pushSpy).toHaveBeenCalledTimes(2);

    // One edge-swipe: closes the fullscreen card, leaves the karte screen
    // underneath it open (mirrors PhraseScreen's "present" nested in karte).
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();

    // A second edge-swipe now closes the one underneath.
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onCloseOuter).toHaveBeenCalledTimes(1);

    outer.unmount();
    inner.unmount();
  });

  it("closing a nested overlay via the UI does not also close the one below it", () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    const outer = renderHook(({ open }) => useHistoryOverlay(open, onCloseOuter), {
      initialProps: { open: true },
    });
    const inner = renderHook(({ open }) => useHistoryOverlay(open, onCloseInner), {
      initialProps: { open: true },
    });

    inner.rerender({ open: false });

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();
    expect(onCloseInner).not.toHaveBeenCalled();

    outer.unmount();
  });

  // Befund 09: the optional `screen` param mirrors the overlay into
  // `?screen=<screen>` while it's open, and puts the address bar back to
  // whatever it showed right before — normally the tab the overlay was
  // opened from (app/page.tsx keeps that in sync separately).
  describe("`screen` URL mirror (Befund 09)", () => {
    it("writes ?screen=<screen> while open and restores the prior URL on a UI close", () => {
      window.history.replaceState(null, "", "/?screen=verlauf");
      const onClose = vi.fn();
      const { rerender, unmount } = renderHook(
        ({ open }) => useHistoryOverlay(open, onClose, "karte"),
        { initialProps: { open: false } },
      );
      expect(window.location.search).toBe("?screen=verlauf");

      rerender({ open: true });
      expect(window.location.search).toBe("?screen=karte");

      // Closed via the UI (e.g. a "Zurück" tap flips `open` directly,
      // without any popstate ever having fired) — the address bar must
      // fall back to the tab it was opened from, not just "somewhere".
      rerender({ open: false });
      expect(window.location.search).toBe("?screen=verlauf");
      expect(onClose).not.toHaveBeenCalled();

      unmount();
    });

    it("restores the prior URL on a popstate close (edge-swipe) too", () => {
      window.history.replaceState(null, "", "/?screen=profil");
      const onClose = vi.fn();
      const { rerender, unmount } = renderHook(
        ({ open }) => useHistoryOverlay(open, onClose, "notfall"),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(window.location.search).toBe("?screen=notfall");

      window.dispatchEvent(new PopStateEvent("popstate"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.location.search).toBe("?screen=profil");

      unmount();
    });

    it("leaves the URL alone entirely when no `screen` is given (e.g. the result dialog)", () => {
      window.history.replaceState(null, "", "/?screen=scan");
      const onClose = vi.fn();
      const { rerender, unmount } = renderHook(({ open }) => useHistoryOverlay(open, onClose), {
        initialProps: { open: false },
      });

      rerender({ open: true });
      expect(window.location.search).toBe("?screen=scan");

      rerender({ open: false });
      expect(window.location.search).toBe("?screen=scan");

      unmount();
    });
  });
});
