// Turn Open Food Facts allergen/trace taxonomy tags ("en:peanuts", "de:milch")
// into short German chip labels. Falls back to a title-cased tag when unmapped.

const TAG_LABELS: Record<string, string> = {
  peanuts: "Erdnuss",
  peanut: "Erdnuss",
  nuts: "Schalenfrüchte",
  "tree-nuts": "Schalenfrüchte",
  hazelnut: "Haselnuss",
  hazelnuts: "Haselnuss",
  almond: "Mandel",
  almonds: "Mandel",
  walnut: "Walnuss",
  walnuts: "Walnuss",
  cashew: "Cashew",
  cashews: "Cashew",
  "cashew-nuts": "Cashew",
  pistachio: "Pistazie",
  pistachios: "Pistazie",
  pecan: "Pekannuss",
  pecans: "Pekannuss",
  "pecan-nuts": "Pekannuss",
  "brazil-nut": "Paranuss",
  "brazil-nuts": "Paranuss",
  macadamia: "Macadamia",
  "macadamia-nuts": "Macadamia",
  soybeans: "Soja",
  soy: "Soja",
  milk: "Milch",
  gluten: "Gluten",
  eggs: "Ei",
  egg: "Ei",
  "sesame-seeds": "Sesam",
  sesame: "Sesam",
  fish: "Fisch",
  crustaceans: "Krebstiere",
  molluscs: "Weichtiere",
  celery: "Sellerie",
  mustard: "Senf",
  lupin: "Lupine",
  sulphur: "Sulfite",
  "sulphur-dioxide-and-sulphites": "Sulfite",
};

/** Strip the language prefix ("en:", "de:") from an OFF taxonomy tag. */
function stripPrefix(tag: string): string {
  const idx = tag.indexOf(":");
  return (idx >= 0 ? tag.slice(idx + 1) : tag).trim().toLowerCase();
}

function titleCase(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Map a single OFF tag to a German label. */
export function allergenLabel(tag: string): string {
  const slug = stripPrefix(tag);
  return TAG_LABELS[slug] ?? titleCase(slug);
}

/** Map + de-duplicate a list of OFF tags to display labels. */
export function allergenLabels(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const label = allergenLabel(tag);
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}
