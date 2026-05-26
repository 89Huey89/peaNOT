import type { OffProductFields } from "@/lib/types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Defensively coerce a raw OFF product object into normalized fields. */
export function normalizeOffProduct(raw: unknown): OffProductFields {
  const product = (raw ?? {}) as Record<string, unknown>;
  const ingredientsText =
    asString(product.ingredients_text_de) || asString(product.ingredients_text);

  return {
    allergens_tags: asStringArray(product.allergens_tags),
    traces_tags: asStringArray(product.traces_tags),
    ingredients_tags: asStringArray(product.ingredients_tags),
    ingredients_text: ingredientsText,
  };
}

/** Prefer the German product name, fall back to the generic one. */
export function extractProductName(raw: unknown): string {
  const product = (raw ?? {}) as Record<string, unknown>;
  return (
    asString(product.product_name_de) || asString(product.product_name)
  ).trim();
}

/** First brand from the comma-separated OFF brands field. */
export function extractBrand(raw: unknown): string {
  const product = (raw ?? {}) as Record<string, unknown>;
  const brands = asString(product.brands);
  return brands.split(",")[0]?.trim() ?? "";
}

/** Best available product photo URL, preferring smaller front images. */
export function extractImageUrl(raw: unknown): string {
  const product = (raw ?? {}) as Record<string, unknown>;
  return (
    asString(product.image_front_small_url) ||
    asString(product.image_front_url) ||
    asString(product.image_small_url) ||
    asString(product.image_url)
  ).trim();
}

/** A product is judgeable only if it carries allergen or ingredient data. */
export function hasUsableData(fields: OffProductFields): boolean {
  return (
    fields.allergens_tags.length > 0 ||
    fields.traces_tags.length > 0 ||
    fields.ingredients_tags.length > 0 ||
    fields.ingredients_text.trim() !== ""
  );
}
