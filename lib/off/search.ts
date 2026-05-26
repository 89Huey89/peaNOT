import type { OffSearchOutcome, ProductSearchResult } from "@/lib/types";
import {
  OFF_SEARCH_FIELDS,
  OFF_SEARCH_PAGE_SIZE,
  OFF_SEARCH_TIMEOUT_MS,
  OFF_SEARCH_URL,
  USER_AGENT,
} from "@/lib/config";
import { extractBrand, extractImageUrl } from "@/lib/off/normalize";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";

/**
 * Turn user input into a Search-a-licious query. Lucene special characters are
 * stripped (they would otherwise break the query), and a trailing wildcard is
 * appended to the last token so partial words match: "magnum mand" -> "Mandel".
 */
function buildQuery(input: string): string {
  const tokens = input
    .replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "";
  tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}*`;
  return tokens.join(" ");
}

/** Read a hit's product name; tolerates a string or a per-language object. */
function extractHitName(raw: unknown): string {
  const hit = (raw ?? {}) as Record<string, unknown>;
  const candidates = [hit.product_name_de, hit.product_name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const map = value as Record<string, unknown>;
      const localized = map.de ?? map.en ?? Object.values(map)[0];
      if (typeof localized === "string" && localized.trim()) {
        return localized.trim();
      }
    }
  }
  return "";
}

function toSearchResult(raw: unknown): ProductSearchResult | null {
  const hit = (raw ?? {}) as Record<string, unknown>;
  const barcode = sanitizeBarcode(
    typeof hit.code === "string" ? hit.code : "",
  );
  if (!isValidBarcode(barcode)) return null;

  const productName = extractHitName(hit);
  const brand = extractBrand(hit);
  const imageUrl = extractImageUrl(hit);

  return {
    barcode,
    productName: productName || null,
    brand: brand || null,
    imageUrl: imageUrl || null,
  };
}

/**
 * Search Open Food Facts by product name (server-side). Never throws: every
 * failure is mapped to an OffSearchOutcome so callers can fail safe.
 */
export async function searchOffProducts(
  query: string,
): Promise<OffSearchOutcome> {
  const q = buildQuery(query);
  if (q === "") return { kind: "ok", results: [] };

  const params = new URLSearchParams({
    q,
    fields: OFF_SEARCH_FIELDS,
    page_size: String(OFF_SEARCH_PAGE_SIZE),
    langs: "de,en",
  });
  const url = `${OFF_SEARCH_URL}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { kind: "error", cause: "http" };
    }

    let body: { hits?: unknown };
    try {
      body = (await res.json()) as { hits?: unknown };
    } catch {
      return { kind: "error", cause: "parse" };
    }

    const hits = Array.isArray(body.hits) ? body.hits : [];
    const results = hits
      .map(toSearchResult)
      .filter((r): r is ProductSearchResult => r !== null);

    return { kind: "ok", results };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "error", cause: "timeout" };
    }
    return { kind: "error", cause: "network" };
  } finally {
    clearTimeout(timer);
  }
}
