import { NextResponse } from "next/server";
import type { ProductResult } from "@/lib/types";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";
import { fetchOffProduct } from "@/lib/off/client";
import { detectAllergens } from "@/lib/allergens/combine";
import { getProfiles, type AllergenProfile } from "@/lib/allergens/profile";
import { allergenLabels } from "@/lib/allergens/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KeineDatenKind = "not-found" | "no-data" | "error";

/** Read the requested allergen keys, whitelist them, default to peanut. */
function parseProfiles(url: string): AllergenProfile[] {
  const param = new URL(url).searchParams.get("a");
  const keys = param
    ? param.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const profiles = getProfiles(keys);
  return profiles.length > 0 ? profiles : getProfiles(["peanut"]);
}

function keineDatenMessage(
  kind: KeineDatenKind,
  profiles: AllergenProfile[],
): string {
  const subject =
    profiles.length === 1 && profiles[0]
      ? `${profiles[0].label} kann nicht ausgeschlossen werden`
      : "deine Allergene können nicht ausgeschlossen werden";
  const lead: Record<KeineDatenKind, string> = {
    "not-found": "Produkt nicht in der Datenbank gefunden",
    "no-data": "Keine Zutaten- oder Allergendaten vorhanden",
    error: "Daten konnten nicht abgerufen werden",
  };
  return `${lead[kind]} – ${subject}.`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ barcode: string }> },
) {
  const { barcode: rawBarcode } = await context.params;
  const barcode = sanitizeBarcode(rawBarcode);

  if (!isValidBarcode(barcode)) {
    return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const profiles = parseProfiles(request.url);
  const outcome = await fetchOffProduct(barcode);

  let result: ProductResult;
  switch (outcome.kind) {
    case "found": {
      const detection = detectAllergens(outcome.fields, profiles);
      const ingredients = outcome.fields.ingredients_text || null;
      const worst = detection.hits.find((h) => h.status === detection.overall);
      result = {
        barcode,
        productName: outcome.productName || null,
        brand: outcome.brand || null,
        status: detection.overall,
        ingredients,
        found: worst?.found ?? null,
        results: detection.hits,
        allergens: allergenLabels(outcome.fields.allergens_tags),
        traces: allergenLabels(outcome.fields.traces_tags),
        imageUrl: outcome.imageUrl || null,
      };
      break;
    }
    case "no-data":
      result = {
        barcode,
        productName: outcome.productName || null,
        brand: outcome.brand || null,
        status: "KEINE_DATEN",
        message: keineDatenMessage("no-data", profiles),
        imageUrl: outcome.imageUrl || null,
      };
      break;
    case "not-found":
      result = {
        barcode,
        productName: null,
        brand: null,
        status: "KEINE_DATEN",
        message: keineDatenMessage("not-found", profiles),
      };
      break;
    case "error":
      result = {
        barcode,
        productName: null,
        brand: null,
        status: "KEINE_DATEN",
        message: keineDatenMessage("error", profiles),
      };
      break;
  }

  return NextResponse.json(result, { status: 200 });
}
