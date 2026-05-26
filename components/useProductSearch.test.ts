import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProductSearch } from "@/components/useProductSearch";
import type { ProductSearchResult } from "@/lib/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function jsonResponse(results: ProductSearchResult[]) {
  return { json: async () => ({ results }) } as unknown as Response;
}

describe("useProductSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("debounces input and stores results after the delay", async () => {
    const hit: ProductSearchResult = {
      barcode: "4011200296908",
      productName: "Magnum Mandel",
      brand: "Magnum",
      imageUrl: null,
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse([hit]));

    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.search("magnum mand");
    });

    // No request yet — still within the debounce window.
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.searching).toBe(false);
    expect(result.current.results).toEqual([hit]);
  });

  it("clears results and skips the request for queries under 2 characters", async () => {
    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.search("m");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it("collapses rapid keystrokes into a single request", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.search("ma");
      result.current.search("mag");
      result.current.search("magnum");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain("q=magnum");
  });

  it("ignores a stale response when a newer search finishes first", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.search("magnum");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.search("milka");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      second.resolve(
        jsonResponse([
          { barcode: "222", productName: "Milka", brand: null, imageUrl: null },
        ]),
      );
      await Promise.resolve();
    });

    await act(async () => {
      first.resolve(
        jsonResponse([
          { barcode: "111", productName: "Magnum", brand: null, imageUrl: null },
        ]),
      );
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([
      { barcode: "222", productName: "Milka", brand: null, imageUrl: null },
    ]);
  });
});
