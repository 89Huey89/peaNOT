import type { OffFetchOutcome } from "@/lib/types";
import {
  OFF_BASE_URL,
  OFF_FIELDS,
  OFF_REVALIDATE_S,
  OFF_TIMEOUT_MS,
  USER_AGENT,
} from "@/lib/config";
import {
  extractBrand,
  extractImageUrl,
  extractProductName,
  extractRecordMetadata,
  hasUsableData,
  normalizeOffProduct,
} from "@/lib/off/normalize";
import { applySafetyOverrides } from "@/lib/off/safety-overrides";

/**
 * Fetch a product from Open Food Facts (server-side). Never throws: every
 * failure is mapped to an OffFetchOutcome so callers can fail safe.
 *
 * `fresh` bypasses the Next data cache entirely (manual "Erneut prüfen"):
 * ordinary scans stay on the shared 1h cache, a fresh check actually re-asks
 * OFF instead of reusing up to an hour-old data.
 */
export async function fetchOffProduct(
  barcode: string,
  opts: { fresh?: boolean } = {},
): Promise<OffFetchOutcome> {
  const url = `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      ...(opts.fresh
        ? { cache: "no-store" as RequestCache }
        : { next: { revalidate: OFF_REVALIDATE_S } }),
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

    // Apply reviewed, warning-only corrections after normalization. This also
    // protects users while OFF still contains an older pack under the same EAN.
    const fields = applySafetyOverrides(
      barcode,
      normalizeOffProduct(body.product),
    );
    const productName = extractProductName(body.product);
    const brand = extractBrand(body.product);
    const imageUrl = extractImageUrl(body.product);
    const metadata = extractRecordMetadata(body.product);

    if (!hasUsableData(fields)) {
      return { kind: "no-data", productName, brand, imageUrl, ...metadata };
    }

    return { kind: "found", fields, productName, brand, imageUrl, ...metadata };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "error", cause: "timeout" };
    }
    return { kind: "error", cause: "network" };
  } finally {
    clearTimeout(timer);
  }
}
