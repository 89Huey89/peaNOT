import { NextResponse } from "next/server";
import type { RecallMatch } from "@/lib/types";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";
import { fetchFoodWarnings } from "@/lib/recalls/client";
import { findRecallMatches } from "@/lib/recalls/match";
import { WATCH_CANDIDATES_MAX } from "@/lib/recalls/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F5 (Rückruf-Wächter): batch recall check for whatever components/
 * useRecallWatch.ts is currently watching (favorites + recent history), so
 * a product that was clean at scan time but gets an official recall notice
 * weeks later doesn't sit silently in the cupboard. POST + a JSON body is
 * the right shape here (unlike the single-barcode GET route): a list of
 * products doesn't fit meaningfully into a URL, and this is a private,
 * locally-triggered background poll, not a bookmarkable resource.
 *
 * Request:  { products: { barcode: string, name?: string, brand?: string }[] }
 * Response: { status: "ok", results: Record<barcode, RecallMatch[]> }
 *        or { status: "unavailable" }   — the portal could not be reached;
 *           never an empty "ok" result, which would look like all-clear.
 *        or 400 { error: "invalid_body" } for a body that isn't usable at
 *           all (not JSON, or no `products` array) — mirrors
 *           app/api/product/[barcode]/route.ts's "refuse quietly, never
 *           throw" contract. Individual malformed rows inside an otherwise
 *           valid `products` array are just dropped rather than failing the
 *           whole request.
 */

interface RecallCandidate {
  barcode: string;
  name: string;
  brand: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Validate one candidate row defensively; anything unusable becomes null
 * and is dropped rather than rejecting the whole batch over one bad entry. */
function parseCandidate(value: unknown): RecallCandidate | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const barcode = sanitizeBarcode(asString(record.barcode));
  if (!isValidBarcode(barcode)) return null;
  return { barcode, name: asString(record.name), brand: asString(record.brand) };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const products =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).products
      : undefined;
  if (!Array.isArray(products)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Deckel: never check more than WATCH_CANDIDATES_MAX products per request,
  // no matter how many the client asked for — this is a background poll,
  // not a use case where a household would ever legitimately need hundreds
  // checked in one go.
  const candidates = products
    .map(parseCandidate)
    .filter((c): c is RecallCandidate => c !== null)
    .slice(0, WATCH_CANDIDATES_MAX);

  if (candidates.length === 0) {
    return NextResponse.json({ status: "ok", results: {} });
  }

  // Fetch the warning list exactly once for the whole batch — it's already
  // cached server-side (LMW_REVALIDATE_S, lib/config.ts) — and reuse it for
  // every candidate below, instead of one portal round-trip per product.
  const outcome = await fetchFoodWarnings();
  if (outcome.kind === "error") {
    // Honest failure, never an empty match list: a silent "ok" here would
    // look exactly like "checked, nothing found" to the client.
    return NextResponse.json({ status: "unavailable" });
  }

  const results: Record<string, RecallMatch[]> = {};
  for (const candidate of candidates) {
    results[candidate.barcode] = findRecallMatches(
      candidate.name || null,
      candidate.brand || null,
      outcome.warnings,
    );
  }

  return NextResponse.json({ status: "ok", results });
}
