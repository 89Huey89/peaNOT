import { NextResponse, type NextRequest } from "next/server";
import type { ProductSearchResult } from "@/lib/types";
import { searchOffProducts } from "@/lib/off/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] as ProductSearchResult[] });
  }

  const outcome = await searchOffProducts(query);
  // The search is only a discovery aid (the peanut verdict comes from the
  // per-product lookup on tap), so failures degrade to an empty list.
  const results = outcome.kind === "ok" ? outcome.results : [];

  return NextResponse.json({ results });
}
