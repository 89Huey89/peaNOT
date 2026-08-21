import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useProductLookup,
  __clearProductLookupCache,
} from "@/components/useProductLookup";
import type { ProductResult } from "@/lib/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function jsonResponse(body: ProductResult, headers?: Record<string, string>) {
  return {
    json: async () => body,
    headers: headers ? new Headers(headers) : undefined,
  } as unknown as Response;
}

describe("useProductLookup", () => {
  beforeEach(() => {
    __clearProductLookupCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads and stores a successful result", async () => {
    const product: ProductResult = {
      barcode: "111",
      productName: "Bar",
      brand: "ACME",
      status: "NEIN",
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(product));

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toEqual(product);
  });

  it("passes the selected allergens as a query param", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ barcode: "111", productName: "Bar", brand: null, status: "NEIN" }),
    );

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111", ["peanut", "milk"]);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/product/111?a=peanut%2Cmilk",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("synthesizes a KEINE_DATEN result on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("222");
    });

    expect(result.current.result?.status).toBe("KEINE_DATEN");
    expect(result.current.result?.status).not.toBe("NEIN");
    // Marks it as a client-side fallback, distinct from a server KEINE_DATEN.
    expect(result.current.result?.networkError).toBe(true);
  });

  it("sends ?fresh=1 with cache:'no-store' for a fresh lookup", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ barcode: "111", productName: "Bar", brand: null, status: "NEIN" }),
    );

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111", [], { fresh: true });
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/product/111?fresh=1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("bypasses the session cache for a fresh lookup", async () => {
    const product: ProductResult = {
      barcode: "111",
      productName: "Bar",
      brand: "ACME",
      status: "NEIN",
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(product));

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111");
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.lookup("111", [], { fresh: true });
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("marks a result served from the service worker's offline cache", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { barcode: "111", productName: "Bar", brand: "ACME", status: "NEIN" },
        { "X-Peanot-Cache": "1", "X-Peanot-Cached-At": "2026-08-01T10:00:00.000Z" },
      ),
    );

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111");
    });

    expect(result.current.result?.cachedAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("does not mark a normal, non-cached response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ barcode: "111", productName: "Bar", brand: "ACME", status: "NEIN" }),
    );

    const { result } = renderHook(() => useProductLookup());
    await act(async () => {
      await result.current.lookup("111");
    });

    expect(result.current.result?.cachedAt).toBeUndefined();
  });

  it("ignores a stale response when a newer lookup finishes first", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useProductLookup());

    act(() => {
      void result.current.lookup("111");
      void result.current.lookup("222");
    });

    await act(async () => {
      second.resolve(
        jsonResponse({ barcode: "222", productName: "Second", brand: null, status: "JA" }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      first.resolve(
        jsonResponse({ barcode: "111", productName: "First", brand: null, status: "NEIN" }),
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.result?.barcode).toBe("222"));
    expect(result.current.result?.productName).toBe("Second");
  });
});
