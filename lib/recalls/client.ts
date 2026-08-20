import {
  LMW_API_URL,
  LMW_AUTH_HEADER,
  LMW_REVALIDATE_S,
  LMW_ROWS,
  LMW_TIMEOUT_MS,
  LMW_WINDOW_DAYS,
  USER_AGENT,
} from "@/lib/config";

/** One food warning from lebensmittelwarnung.de, reduced to what we match on. */
export interface RecallWarning {
  title: string;
  /** Link into the official notice, when the portal supplies one. */
  link: string | null;
  /** Publication time in ms since epoch, when supplied. */
  publishedDate: number | null;
  /** Searchable text beyond the title (designation, brand, manufacturer, reason). */
  extraText: string;
}

/**
 * Result of a warning-list fetch. Mirrors OffFetchOutcome: the client never
 * throws, so callers decide what an unavailable list means for the UI.
 */
export type RecallFetchOutcome =
  | { kind: "ok"; warnings: RecallWarning[] }
  | { kind: "error"; cause: "network" | "timeout" | "http" | "parse" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cutoff for the warning window, rounded down to a full day. The cutoff is
 * part of the POST body, and the body is part of Next's data-cache key — a
 * per-request timestamp would make every scan a cache miss.
 */
function windowCutoff(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS - LMW_WINDOW_DAYS * DAY_MS;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read one API doc defensively; unusable docs become null. */
function parseDoc(doc: unknown): RecallWarning | null {
  if (typeof doc !== "object" || doc === null) return null;
  const record = doc as Record<string, unknown>;
  const title = asString(record.title).trim();
  if (!title) return null;

  const product =
    typeof record.product === "object" && record.product !== null
      ? (record.product as Record<string, unknown>)
      : {};
  const extraText = [
    asString(product.designation),
    asString(product.brandName),
    asString(product.manufacturer),
    // Free-text reason; present on food warnings, name varies by doc type.
    asString(record.warning),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    link: asString(record.link) || null,
    publishedDate:
      typeof record.publishedDate === "number" ? record.publishedDate : null,
    extraText,
  };
}

/**
 * Fetch recent food warnings from lebensmittelwarnung.de (server-side).
 * Never throws; the list is cached via Next's data cache, so scans reuse one
 * portal round-trip for hours.
 */
export async function fetchFoodWarnings(
  now: number = Date.now(),
): Promise<RecallFetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LMW_TIMEOUT_MS);

  try {
    const res = await fetch(LMW_API_URL, {
      method: "POST",
      headers: {
        Authorization: LMW_AUTH_HEADER,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        food: {
          rows: LMW_ROWS,
          sort: "publishedDate desc",
          start: 0,
          fq: [`publishedDate > ${windowCutoff(now)}`],
        },
      }),
      signal: controller.signal,
      next: { revalidate: LMW_REVALIDATE_S },
    });

    if (!res.ok) {
      return { kind: "error", cause: "http" };
    }

    let body: { docs?: unknown };
    try {
      body = (await res.json()) as { docs?: unknown };
    } catch {
      return { kind: "error", cause: "parse" };
    }

    if (!Array.isArray(body.docs)) {
      return { kind: "error", cause: "parse" };
    }

    const warnings = body.docs
      .map(parseDoc)
      .filter((w): w is RecallWarning => w !== null);
    return { kind: "ok", warnings };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "error", cause: "timeout" };
    }
    return { kind: "error", cause: "network" };
  } finally {
    clearTimeout(timer);
  }
}
