import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OffFetchOutcome, OffProductFields, ProductResult } from "@/lib/types";

vi.mock("@/lib/off/client", () => ({ fetchOffProduct: vi.fn() }));

import { GET } from "./route";
import { fetchOffProduct } from "@/lib/off/client";

function fields(partial: Partial<OffProductFields> = {}): OffProductFields {
  return {
    allergens_tags: [],
    traces_tags: [],
    ingredients_tags: [],
    ingredients_text: "",
    ...partial,
  };
}

async function call(barcode: string): Promise<{ status: number; body: ProductResult & { error?: string } }> {
  const res = await GET(new Request(`http://localhost/api/product/${barcode}`), {
    params: Promise.resolve({ barcode }),
  });
  return { status: res.status, body: await res.json() };
}

function mockOutcome(outcome: OffFetchOutcome) {
  vi.mocked(fetchOffProduct).mockResolvedValue(outcome);
}

describe("GET /api/product/[barcode]", () => {
  beforeEach(() => {
    vi.mocked(fetchOffProduct).mockReset();
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

  it("returns 200 KEINE_DATEN with name for no-data products", async () => {
    mockOutcome({ kind: "no-data", productName: "Mystery", brand: "ACME", imageUrl: "" });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.productName).toBe("Mystery");
    expect(body.message).toBeTruthy();
  });

  it("returns 200 KEINE_DATEN for not-found products", async () => {
    mockOutcome({ kind: "not-found" });

    const { status, body } = await call("0000000000000");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.productName).toBeNull();
  });

  it("maps errors to KEINE_DATEN, never NEIN", async () => {
    mockOutcome({ kind: "error", cause: "network" });

    const { status, body } = await call("4011200296908");
    expect(status).toBe(200);
    expect(body.status).toBe("KEINE_DATEN");
    expect(body.status).not.toBe("NEIN");
  });

  it("returns 400 for invalid barcodes without calling the client", async () => {
    const { status, body } = await call("abc");
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_barcode");
    expect(fetchOffProduct).not.toHaveBeenCalled();
  });
});
