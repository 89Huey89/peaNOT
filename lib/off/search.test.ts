import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchOffProducts } from "@/lib/off/search";
import { USER_AGENT } from "@/lib/config";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe("searchOffProducts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps hits to lightweight search results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        hits: [
          {
            code: "4011200296908",
            product_name_de: "Magnum Mandel",
            brands: "Magnum, Langnese",
            image_front_small_url: "https://img/magnum.jpg",
          },
        ],
      }),
    );

    const outcome = await searchOffProducts("magnum mand");

    expect(outcome).toEqual({
      kind: "ok",
      results: [
        {
          barcode: "4011200296908",
          productName: "Magnum Mandel",
          brand: "Magnum",
          imageUrl: "https://img/magnum.jpg",
        },
      ],
    });
  });

  it("appends a trailing wildcard to the last token for prefix matching", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ hits: [] }));

    await searchOffProducts("magnum mand");

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("q")).toBe("magnum mand*");
    expect(String(url)).toContain("fields=");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
  });

  it("resolves a localized product_name object, preferring German", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        hits: [
          {
            code: "4011200296908",
            product_name: { en: "Almond", de: "Mandel" },
            brands: "Magnum",
          },
        ],
      }),
    );

    const outcome = await searchOffProducts("mandel");
    expect(outcome).toEqual({
      kind: "ok",
      results: [
        { barcode: "4011200296908", productName: "Mandel", brand: "Magnum", imageUrl: null },
      ],
    });
  });

  it("drops hits whose code is not a valid barcode", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        hits: [
          { code: "abc", product_name: "Bogus" },
          { code: "4011200296908", product_name: "Real" },
        ],
      }),
    );

    const outcome = await searchOffProducts("test");
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.results.map((r) => r.barcode)).toEqual(["4011200296908"]);
    }
  });

  it("returns an empty result list without fetching for blank queries", async () => {
    const outcome = await searchOffProducts("   ");
    expect(outcome).toEqual({ kind: "ok", results: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("strips Lucene special characters from the query", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ hits: [] }));

    await searchOffProducts("magn(um) :nut");

    const parsed = new URL(String(vi.mocked(fetch).mock.calls[0]![0]));
    expect(parsed.searchParams.get("q")).toBe("magn um nut*");
  });

  it("returns error/http for non-ok responses", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    expect(await searchOffProducts("magnum")).toEqual({ kind: "error", cause: "http" });
  });

  it("returns error/parse when JSON parsing fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response);
    expect(await searchOffProducts("magnum")).toEqual({ kind: "error", cause: "parse" });
  });

  it("returns error/timeout on abort", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    expect(await searchOffProducts("magnum")).toEqual({ kind: "error", cause: "timeout" });
  });

  it("returns error/network on other fetch failures", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    expect(await searchOffProducts("magnum")).toEqual({ kind: "error", cause: "network" });
  });
});
