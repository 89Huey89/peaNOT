import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFavorites } from "@/components/useFavorites";

const KEY = "peanot.favorites.v1";

const ENTRY = { barcode: "20137946", name: "Reiswaffel", brand: "dm Bio", verdict: "safe" as const, ts: 1_000 };

describe("useFavorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts empty and becomes ready after mount", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.favorites).toEqual([]);
  });

  it("hydrates existing favorites from localStorage on mount", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ "111": { barcode: "111", name: "Alt", brand: "X", verdict: "safe", ts: 1, addedAt: 1 } }),
    );

    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favorites).toHaveLength(1));
    expect(result.current.favorites[0]?.name).toBe("Alt");
  });

  it("stars a product and persists it", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.toggleFavorite(ENTRY));

    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.favorites[0]).toMatchObject({ barcode: "20137946", name: "Reiswaffel" });
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored["20137946"]).toBeDefined();
  });

  it("un-stars a product on a second toggle", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.toggleFavorite(ENTRY));
    act(() => result.current.toggleFavorite(ENTRY));

    expect(result.current.favorites).toEqual([]);
  });

  it("recordCheck refreshes the verdict/ts of a favorited barcode", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.toggleFavorite(ENTRY));
    act(() => result.current.recordCheck("20137946", "danger", 9_000));

    expect(result.current.favorites[0]).toMatchObject({ verdict: "danger", ts: 9_000 });
  });

  it("recordCheck for a non-favorited barcode changes nothing", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.ready).toBe(true));

    const before = result.current.favorites;
    act(() => result.current.recordCheck("999", "danger", 9_000));

    expect(result.current.favorites).toBe(before); // same reference: no re-render triggered
    expect(result.current.favorites).toEqual([]);
  });
});
