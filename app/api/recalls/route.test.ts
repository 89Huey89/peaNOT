import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecallFetchOutcome } from "@/lib/recalls/client";
import type { RecallMatch } from "@/lib/types";

vi.mock("@/lib/recalls/client", () => ({ fetchFoodWarnings: vi.fn() }));

import { POST } from "./route";
import { fetchFoodWarnings } from "@/lib/recalls/client";
import { WATCH_CANDIDATES_MAX } from "@/lib/recalls/watch";

function mockOutcome(outcome: RecallFetchOutcome) {
  vi.mocked(fetchFoodWarnings).mockResolvedValue(outcome);
}

/** Loose shape covering every response this route can produce, so tests can
 * assert on whichever fields apply without a cast per call site. */
interface RouteResponseBody {
  status?: "ok" | "unavailable";
  results?: Record<string, RecallMatch[]>;
  error?: string;
}

async function post(body: unknown): Promise<{ status: number; body: RouteResponseBody }> {
  const res = await POST(
    new Request("http://localhost/api/recalls", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe("POST /api/recalls", () => {
  beforeEach(() => {
    vi.mocked(fetchFoodWarnings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns matches per barcode from a single warning-list fetch", async () => {
    mockOutcome({
      kind: "ok",
      warnings: [
        {
          title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
          link: "https://www.lebensmittelwarnung.de/x",
          publishedDate: 1_700_000_000_000,
          extraText: "",
        },
      ],
    });

    const { status, body } = await post({
      products: [
        { barcode: "4011200296908", name: "ültje Erdnüsse pikant gewürzt", brand: "ültje" },
        { barcode: "20137946", name: "Reiswaffel", brand: "dm Bio" },
      ],
    });

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.results!["4011200296908"]).toHaveLength(1);
    expect(body.results!["4011200296908"]![0]!.title).toContain("ültje");
    expect(body.results!["20137946"]).toEqual([]);
    expect(fetchFoodWarnings).toHaveBeenCalledTimes(1);
  });

  it("fetches the warning list exactly once no matter how many products are checked", async () => {
    mockOutcome({ kind: "ok", warnings: [] });

    await post({
      products: Array.from({ length: 5 }, (_, i) => ({
        barcode: "4011200296908",
        name: `Produkt ${i}`,
        brand: "ACME",
      })),
    });

    expect(fetchFoodWarnings).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable instead of an empty match list when the portal fails", async () => {
    mockOutcome({ kind: "error", cause: "network" });

    const { status, body } = await post({
      products: [{ barcode: "4011200296908", name: "X", brand: "Y" }],
    });

    expect(status).toBe(200);
    expect(body).toEqual({ status: "unavailable" });
  });

  it("returns 400 for a body that isn't JSON, without calling the client", async () => {
    const { status, body } = await post("{not json");

    expect(status).toBe(400);
    expect(body.error).toBe("invalid_body");
    expect(fetchFoodWarnings).not.toHaveBeenCalled();
  });

  it("returns 400 when products is missing or not an array", async () => {
    const { status, body } = await post({ products: "nope" });

    expect(status).toBe(400);
    expect(body.error).toBe("invalid_body");
    expect(fetchFoodWarnings).not.toHaveBeenCalled();
  });

  it("drops malformed rows instead of failing the whole request", async () => {
    mockOutcome({ kind: "ok", warnings: [] });

    const { status, body } = await post({
      products: [
        { barcode: "4011200296908", name: "Gültig", brand: "ACME" },
        { barcode: "abc", name: "Ungültiger Barcode", brand: "ACME" },
        null,
        "just a string",
        { name: "Kein Barcode", brand: "ACME" },
      ],
    });

    expect(status).toBe(200);
    expect(Object.keys(body.results!)).toEqual(["4011200296908"]);
  });

  it("returns ok with empty results and skips the fetch when nothing valid was submitted", async () => {
    const { status, body } = await post({ products: [{ barcode: "abc" }] });

    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok", results: {} });
    expect(fetchFoodWarnings).not.toHaveBeenCalled();
  });

  it("caps the number of products checked per request", async () => {
    mockOutcome({ kind: "ok", warnings: [] });

    const products = Array.from({ length: WATCH_CANDIDATES_MAX + 10 }, (_, i) => ({
      // Distinct, valid (8-14 digit) barcodes so the cap is actually tested
      // against unique keys rather than colliding into a handful of entries.
      barcode: String(20_000_000_000 + i),
      name: `Produkt ${i}`,
      brand: "ACME",
    }));

    const { body } = await post({ products });

    expect(Object.keys(body.results!)).toHaveLength(WATCH_CANDIDATES_MAX);
  });
});
