import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { OffSearchOutcome, ProductSearchResult } from "@/lib/types";

vi.mock("@/lib/off/search", () => ({ searchOffProducts: vi.fn() }));

import { GET } from "./route";
import { searchOffProducts } from "@/lib/off/search";

async function call(q: string | null): Promise<{
  status: number;
  body: { results: ProductSearchResult[] };
}> {
  const url = q === null ? "http://localhost/api/search" : `http://localhost/api/search?q=${encodeURIComponent(q)}`;
  const res = await GET(new NextRequest(url));
  return { status: res.status, body: await res.json() };
}

function mockOutcome(outcome: OffSearchOutcome) {
  vi.mocked(searchOffProducts).mockResolvedValue(outcome);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.mocked(searchOffProducts).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the search results for a valid query", async () => {
    const results: ProductSearchResult[] = [
      { barcode: "4011200296908", productName: "Magnum Mandel", brand: "Magnum", imageUrl: null },
    ];
    mockOutcome({ kind: "ok", results });

    const { status, body } = await call("magnum mand");
    expect(status).toBe(200);
    expect(body.results).toEqual(results);
    expect(searchOffProducts).toHaveBeenCalledWith("magnum mand");
  });

  it("returns an empty list for queries under 2 characters without searching", async () => {
    const { body } = await call("m");
    expect(body.results).toEqual([]);
    expect(searchOffProducts).not.toHaveBeenCalled();
  });

  it("returns an empty list when q is missing", async () => {
    const { body } = await call(null);
    expect(body.results).toEqual([]);
    expect(searchOffProducts).not.toHaveBeenCalled();
  });

  it("degrades a search error to an empty result list", async () => {
    mockOutcome({ kind: "error", cause: "network" });

    const { status, body } = await call("magnum");
    expect(status).toBe(200);
    expect(body.results).toEqual([]);
  });
});
