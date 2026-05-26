import { NextResponse } from "next/server";
import type { ProductResult } from "@/lib/types";
import { isValidBarcode, sanitizeBarcode } from "@/lib/barcode";
import { fetchOffProduct } from "@/lib/off/client";
import { detectPeanut } from "@/lib/allergens/detect";
import { allergenLabels } from "@/lib/allergens/labels";
import { findPeanutMention } from "@/lib/allergens/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEINE_DATEN_MESSAGES = {
  "not-found":
    "Produkt nicht in der Datenbank gefunden – Erdnuss kann nicht ausgeschlossen werden.",
  "no-data":
    "Keine Zutaten- oder Allergendaten vorhanden – Erdnuss kann nicht ausgeschlossen werden.",
  error:
    "Daten konnten nicht abgerufen werden – Erdnuss kann nicht ausgeschlossen werden.",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ barcode: string }> },
) {
  const { barcode: rawBarcode } = await context.params;
  const barcode = sanitizeBarcode(rawBarcode);

  if (!isValidBarcode(barcode)) {
    return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const outcome = await fetchOffProduct(barcode);

  let result: ProductResult;
  switch (outcome.kind) {
    case "found": {
      const detection = detectPeanut(outcome.fields);
      const ingredients = outcome.fields.ingredients_text || null;
      result = {
        barcode,
        productName: outcome.productName || null,
        brand: outcome.brand || null,
        status: detection.status,
        ingredients,
        found: ingredients ? findPeanutMention(ingredients) : null,
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
        message: KEINE_DATEN_MESSAGES["no-data"],
        imageUrl: outcome.imageUrl || null,
      };
      break;
    case "not-found":
      result = {
        barcode,
        productName: null,
        brand: null,
        status: "KEINE_DATEN",
        message: KEINE_DATEN_MESSAGES["not-found"],
      };
      break;
    case "error":
      result = {
        barcode,
        productName: null,
        brand: null,
        status: "KEINE_DATEN",
        message: KEINE_DATEN_MESSAGES.error,
      };
      break;
  }

  return NextResponse.json(result, { status: 200 });
}
