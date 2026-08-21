import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OffFetchOutcome, OffProductFields, ProductResult } from "@/lib/types";

vi.mock("@/lib/off/client", () => ({ fetchOffProduct: vi.fn() }));
vi.mock("@/lib/recalls/check", () => ({ checkRecalls: vi.fn() }));

import { GET } from "./route";
import { fetchOffProduct } from "@/lib/off/client";
import { checkRecalls } from "@/lib/recalls/check";

function fields(partial: Partial<OffProductFields> = {}): OffProductFields {
  return {
    allergens_tags: [],
    traces_tags: [],
    ingredients_tags: [],
    ingredients_text: "",
    ...partial,
  };
}

async function call(
  barcode: string,
  allergens?: string[],
  extra?: Record<string, string>,
): Promise<{ status: number; body: ProductResult & { error?: string }; headers: Headers }> {
  const params = new URLSearchParams();
  if (allergens) params.set("a", allergens.join(","));
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const query = params.toString();
  const res = await GET(
    new Request(`http://localhost/api/product/${barcode}${query ? `?${query}` : ""}`),
    { params: Promise.resolve({ barcode }) },
  );
  return { status: res.status, body: await res.json(), headers: res.headers };
}

function mockOutcome(outcome: OffFetchOutcome) {
  vi.mocked(fetchOffProduct).mockResolvedValue(outcome);
}

describe("GET /api/product/[barcode]", () => {
  beforeEach(() => {
    vi.mocked(fetchOffProduct).mockReset();
    vi.mocked(checkRecalls).mockReset();
    vi.mocked(checkRecalls).mockResolvedValue({ status: "ok", matches: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 JA for a peanut product", async () => {
    mockOutcome({
      kind: "found",
      productName: "Peanut Bar",
      brand: "ACME",
      imageUrl: "https://img/peanut-bar.jpg",
      fields: fields({ allergens_tags: ["en:peanuts"] }),
    });

    const { status, body } = await call("4011200296908");

    expect(status).toBe(200);
    expect(body.status).toBe("JA");
    expect(body.productName).toBe("Peanut Bar");
    expect(body.brand).toBe("ACME");
    expect(body.imageUrl).toBe("https://img/peanut-bar.jpg");
  });

  it("returns 200 SPUREN for a traces-only product", async () => {
    mockOutcome({
      kind: "found",
      productName: "Cookie",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ traces_tags: ["en:peanuts"], ingredients_text: "Mehl" }),
    });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("SPUREN");
  });

  it("exposes OFF edit metadata without treating it as a recipe change", async () => {
    mockOutcome({
      kind: "found",
      productName: "Cookie",
      brand: "ACME",
      imageUrl: "",
      dataLastModified: 1750000000,
      dataRevision: 12,
      fields: fields({ ingredients_text: "Mehl" }),
    });

    const { body } = await call("4011200296908");
    expect(body.dataLastModified).toBe(1750000000);
    expect(body.dataRevision).toBe(12);
  });

  it("returns 200 NEIN for a clean product", async () => {
    mockOutcome({
      kind: "found",
      productName: "Milk",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
    });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("NEIN");
  });

  it("qualifies a clean result from a retailer in-store code", async () => {
    mockOutcome({
      kind: "found",
      productName: "Gelatelli mini mix fruit",
      brand: "Gelatelli",
      imageUrl: "",
      fields: fields({
        allergens_tags: ["en:milk"],
        traces_tags: ["en:nuts"],
        ingredients_text: "Lait écrémé, sucre",
      }),
    });

    const { body } = await call("20137946");
    expect(body.status).toBe("NEIN");
    expect(body.caveats).toEqual(["restricted-code"]);
  });

  it("qualifies a clean result whose record carries no traces data", async () => {
    mockOutcome({
      kind: "found",
      productName: "Milk",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
    });

    const { body } = await call("4011200296908");
    expect(body.caveats).toEqual(["traces-unknown"]);
  });

  it("does not qualify a hit", async () => {
    mockOutcome({
      kind: "found",
      productName: "Peanut bar",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:peanuts"], ingredients_text: "Erdnüsse" }),
    });

    const { body } = await call("20137946");
    expect(body.status).toBe("JA");
    expect(body.caveats).toEqual([]);
  });

  it("keeps the barcode caveat when nothing was found", async () => {
    mockOutcome({ kind: "not-found" });

    const { body } = await call("20137946");
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.caveats).toEqual(["restricted-code"]);
  });

  it("returns 200 KEINE_DATEN with name for no-data products", async () => {
    mockOutcome({ kind: "no-data", productName: "Mystery", brand: "ACME", imageUrl: "" });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.kind).toBe("no-data");
    expect(body.productName).toBe("Mystery");
    expect(body.message).toBeTruthy();
  });

  it("returns 200 KEINE_DATEN for not-found products", async () => {
    mockOutcome({ kind: "not-found" });

    const { status, body } = await call("0000000000000");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.kind).toBe("not-found");
    expect(body.productName).toBeNull();
  });

  it("maps errors to KEINE_DATEN, never NEIN, and marks the kind as error", async () => {
    mockOutcome({ kind: "error", cause: "network" });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.status).not.toBe("NEIN");
    expect(body.kind).toBe("error");
  });

  it("never sets kind on a real (non-KEINE_DATEN) verdict", async () => {
    mockOutcome({
      kind: "found",
      productName: "Milk",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
    });

    const { body } = await call("4011200296908");
    expect(body.status).toBe("NEIN");
    expect(body.kind).toBeUndefined();
  });

  it("returns 400 for invalid barcodes without calling the client", async () => {
    const { status, body } = await call("abc");
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_barcode");
    expect(fetchOffProduct).not.toHaveBeenCalled();
  });

  it("checks the requested allergens and reports per-allergen results", async () => {
    mockOutcome({
      kind: "found",
      productName: "Choco",
      brand: "ACME",
      imageUrl: "",
      fields: fields({
        allergens_tags: ["en:milk"],
        ingredients_text: "Zucker, Milch, Sojalecithin",
      }),
    });

    const { body } = await call("4011200296908", ["peanut", "milk", "soy"]);

    expect(body.status).toBe("JA"); // worst case across the selection
    expect(body.results?.map((r) => r.key)).toEqual(["peanut", "milk", "soy"]);
    expect(body.results?.find((r) => r.key === "milk")?.status).toBe("JA");
    expect(body.results?.find((r) => r.key === "peanut")?.status).toBe("NEIN");
  });

  it("defaults to peanut when no allergens are requested", async () => {
    mockOutcome({
      kind: "found",
      productName: "Peanut Bar",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:peanuts"] }),
    });

    const { body } = await call("4011200296908");
    expect(body.status).toBe("JA");
    expect(body.results?.map((r) => r.key)).toEqual(["peanut"]);
  });

  it("ignores unknown allergen keys and falls back to peanut when all are unknown", async () => {
    mockOutcome({
      kind: "found",
      productName: "Milk",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
    });

    const { body } = await call("4011200296908", ["bogus"]);
    expect(body.results?.map((r) => r.key)).toEqual(["peanut"]);
    expect(body.status).toBe("NEIN");
  });

  it("attaches recall matches to a found product", async () => {
    mockOutcome({
      kind: "found",
      productName: "ültje Erdnüsse pikant gewürzt",
      brand: "ültje",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:peanuts"] }),
    });
    vi.mocked(checkRecalls).mockResolvedValue({
      status: "ok",
      matches: [
        { title: "ültje Erdnüsse pikant gewürzt, 180 Gramm", link: null, publishedDate: 1 },
      ],
    });

    const { body } = await call("4011200296908");
    expect(checkRecalls).toHaveBeenCalledWith("ültje Erdnüsse pikant gewürzt", "ültje");
    expect(body.recall).toEqual({
      status: "ok",
      matches: [
        { title: "ültje Erdnüsse pikant gewürzt, 180 Gramm", link: null, publishedDate: 1 },
      ],
    });
  });

  it("reports an unavailable recall check instead of hiding it", async () => {
    mockOutcome({
      kind: "found",
      productName: "Peanut Bar",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:peanuts"] }),
    });
    vi.mocked(checkRecalls).mockResolvedValue({ status: "unavailable" });

    const { body } = await call("4011200296908");
    expect(body.recall).toEqual({ status: "unavailable" });
    expect(body.status).toBe("JA"); // the add-on never touches the verdict
  });

  it("skips the recall check when there is no name to compare", async () => {
    mockOutcome({ kind: "not-found" });

    const { body } = await call("4011200296908");
    expect(checkRecalls).not.toHaveBeenCalled();
    expect(body.recall).toBeUndefined();
  });

  it("skips the recall check for a nameless no-data record", async () => {
    mockOutcome({ kind: "no-data", productName: "", brand: "", imageUrl: "" });

    const { body } = await call("4011200296908");
    expect(checkRecalls).not.toHaveBeenCalled();
    expect(body.recall).toBeUndefined();
  });

  it("still compares recalls for a named no-data record", async () => {
    mockOutcome({ kind: "no-data", productName: "Mystery", brand: "ACME", imageUrl: "" });

    const { body } = await call("4011200296908");
    expect(checkRecalls).toHaveBeenCalledWith("Mystery", "ACME");
    expect(body.recall).toEqual({ status: "ok", matches: [] });
  });

  it("names the single selected allergen in the KEINE_DATEN message", async () => {
    mockOutcome({ kind: "no-data", productName: "Mystery", brand: "ACME", imageUrl: "" });

    const { body } = await call("4011200296908", ["milk"]);
    expect(body.message).toContain("Milch");
  });

  it("requests an ordinary (non-fresh) OFF fetch by default", async () => {
    mockOutcome({ kind: "not-found" });

    await call("4011200296908");
    expect(fetchOffProduct).toHaveBeenCalledWith("4011200296908", { fresh: false });
  });

  it("passes fresh:true through to the OFF client for a manual retry", async () => {
    mockOutcome({ kind: "not-found" });

    await call("4011200296908", undefined, { fresh: "1" });
    expect(fetchOffProduct).toHaveBeenCalledWith("4011200296908", { fresh: true });
  });

  it("marks a transient OFF failure so the service worker never caches it", async () => {
    mockOutcome({ kind: "error", cause: "network" });

    const { status, headers } = await call("4011200296908");
    expect(status).toBe(200); // client contract: always 200, header signals transience
    expect(headers.get("X-Peanot-Transient")).toBe("1");
  });

  it("does not mark a definitive not-found result as transient", async () => {
    mockOutcome({ kind: "not-found" });

    const { headers } = await call("4011200296908");
    expect(headers.get("X-Peanot-Transient")).toBeNull();
  });

  it("does not mark a found result as transient", async () => {
    mockOutcome({
      kind: "found",
      productName: "Milk",
      brand: "ACME",
      imageUrl: "",
      fields: fields({ allergens_tags: ["en:milk"], ingredients_text: "Milch" }),
    });

    const { headers } = await call("4011200296908");
    expect(headers.get("X-Peanot-Transient")).toBeNull();
  });
});
