import type { OffFetchOutcome } from "@/lib/types";
import {
  OFF_BASE_URL,
  OFF_FIELDS,
  OFF_TIMEOUT_MS,
  USER_AGENT,
} from "@/lib/config";
import {
  extractBrand,
  extractImageUrl,
  extractProductName,
  hasUsableData,
  normalizeOffProduct,
} from "@/lib/off/normalize";

/**
 * Fetch a product from Open Food Facts (server-side). Never throws: every
 * failure is mapped to an OffFetchOutcome so callers can fail safe.
 */
export async function fetchOffProduct(barcode: string): Promise<OffFetchOutcome> {
  const url = `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { kind: "error", cause: "http" };
    }

    let body: { status?: number; product?: unknown };
    try {
      body = (await res.json()) as { status?: number; product?: unknown };
    } catch {
      return { kind: "error", cause: "parse" };
    }

    if (body.status === 0 || body.product == null) {
      return { kind: "not-found" };
    }

    const fields = normalizeOffProduct(body.product);
    const productName = extractProductName(body.product);
    const brand = extractBrand(body.product);
    const imageUrl = extractImageUrl(body.product);

    if (!hasUsableData(fields)) {
      return { kind: "no-data", productName, brand, imageUrl };
    }

    return { kind: "found", fields, productName, brand, imageUrl };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "error", cause: "timeout" };
    }
    return { kind: "error", cause: "network" };
  } finally {
    clearTimeout(timer);
  }
}
