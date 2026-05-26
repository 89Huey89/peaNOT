import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOffProduct } from "@/lib/off/client";
import { USER_AGENT } from "@/lib/config";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchOffProduct", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns found with normalized fields for a product with data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: "Peanut Bar",
          brands: "ACME, Other",
          allergens_tags: ["en:peanuts"],
          ingredients_text: "Sugar, peanuts",
          image_front_small_url: "https://img/peanut-bar.jpg",
        },
      }),
    );

    const outcome = await fetchOffProduct("4011200296908");

    expect(outcome).toEqual({
      kind: "found",
      productName: "Peanut Bar",
      brand: "ACME",
      imageUrl: "https://img/peanut-bar.jpg",
      fields: {
        allergens_tags: ["en:peanuts"],
        traces_tags: [],
        ingredients_tags: [],
        ingredients_text: "Sugar, peanuts",
      },
    });
  });

  it("sends a descriptive User-Agent and requests fields", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 0 }));

    await fetchOffProduct("4011200296908");

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("4011200296908.json");
    expect(String(url)).toContain("fields=");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
  });

  it("returns no-data when product is found but has no usable data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: 1, product: { product_name: "Mystery", brands: "ACME" } }),
    );

    expect(await fetchOffProduct("4011200296908")).toEqual({
      kind: "no-data",
      productName: "Mystery",
      brand: "ACME",
      imageUrl: "",
    });
  });

  it("returns not-found for status 0", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 0 }));
    expect(await fetchOffProduct("0000000000000")).toEqual({ kind: "not-found" });
  });

  it("returns not-found when product is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 1, product: null }));
    expect(await fetchOffProduct("0000000000000")).toEqual({ kind: "not-found" });
  });

  it("returns error/http for non-ok responses", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    expect(await fetchOffProduct("4011200296908")).toEqual({ kind: "error", cause: "http" });
  });

  it("returns error/parse when JSON parsing fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response);
    expect(await fetchOffProduct("4011200296908")).toEqual({ kind: "error", cause: "parse" });
  });

  it("returns error/timeout on abort", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    expect(await fetchOffProduct("4011200296908")).toEqual({ kind: "error", cause: "timeout" });
  });

  it("returns error/network on other fetch failures", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    expect(await fetchOffProduct("4011200296908")).toEqual({ kind: "error", cause: "network" });
  });
});
