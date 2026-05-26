/**
 * An allergen profile parameterizes the detection engine. Adding a new
 * allergen means adding another profile to ALLERGEN_PROFILES, not changing
 * the engine.
 *
 * SAFETY-CRITICAL: positiveTags and textKeywords decide whether a user with a
 * life-threatening allergy is warned. Every list below must be reviewed by a
 * human. When unsure, prefer over-broad coverage — a false JA/SPUREN is far
 * safer than a missed allergen.
 */
export interface AllergenProfile {
  key: string;
  /** German display name used in the UI (picker, verdict copy, breakdown). */
  label: string;
  /**
   * OFF "en:" taxonomy tags counting as a positive presence/trace. A product
   * tag matches if it equals one of these or starts with it followed by "-"
   * (e.g. "en:peanut-oil" matches "en:peanut"). Singular and plural forms are
   * distinct tags, so list both where OFF uses both.
   */
  positiveTags: string[];
  /**
   * Substrings matched against normalized (lowercased, ß→ss, diacritic-stripped)
   * freeform ingredient text. Entries MUST already be in that normalized form
   * (no uppercase, umlauts, or accents) — see normalizeText in lib/text.ts.
   */
  textKeywords: string[];
  /**
   * Optional hand-tuned regex for highlighting the literal mention in the
   * original ingredient text. When absent, evidence falls back to a token scan.
   */
  mentionRegex?: RegExp;
}

export const ALLERGEN_PROFILES = {
  peanut: {
    key: "peanut",
    label: "Erdnuss",
    positiveTags: ["en:peanut", "en:peanuts"],
    textKeywords: [
      "peanut",
      "groundnut",
      "ground nut",
      "erdnuss",
      "erdnuesse",
      "arachide",
      "cacahuet",
      "arachis",
    ],
    mentionRegex:
      /erdn[uü]ss\w*|peanut\w*|ground[\s-]?nut\w*|arachid\w*|arachis\w*|cacahu\w*/i,
  },
  "tree-nuts": {
    key: "tree-nuts",
    label: "Schalenfrüchte",
    positiveTags: [
      "en:nuts",
      "en:tree-nuts",
      "en:almond",
      "en:almonds",
      "en:hazelnut",
      "en:hazelnuts",
      "en:walnut",
      "en:walnuts",
      "en:cashew",
      "en:cashews",
      "en:cashew-nuts",
      "en:pistachio",
      "en:pistachios",
      "en:pecan",
      "en:pecans",
      "en:pecan-nuts",
      "en:macadamia",
      "en:macadamia-nuts",
      "en:brazil-nut",
      "en:brazil-nuts",
    ],
    textKeywords: [
      "haselnuss",
      "mandel",
      "walnuss",
      "cashew",
      "pistazie",
      "pekannuss",
      "paranuss",
      "macadamia",
      "noisette",
      "amande",
      "noix",
      "hazelnut",
      "almond",
      "walnut",
      "pecan",
      "pistachio",
      "brazil nut",
      "schalenfruchte",
      "schalenfruchten",
    ],
  },
  soy: {
    key: "soy",
    label: "Soja",
    positiveTags: ["en:soybeans", "en:soya-beans", "en:soy", "en:soya"],
    textKeywords: [
      "soja",
      "soya",
      "sojabohne",
      "sojalecithin",
      "sojaol",
      "sojamehl",
      "sojaeiweiss",
      "sojaprotein",
      "tofu",
      "edamame",
      "tempeh",
      "miso",
    ],
  },
  gluten: {
    key: "gluten",
    label: "Gluten",
    positiveTags: [
      "en:gluten",
      "en:wheat",
      "en:barley",
      "en:rye",
      "en:oats",
      "en:spelt",
      "en:kamut",
    ],
    textKeywords: [
      "gluten",
      "weizen",
      "wheat",
      "gerste",
      "barley",
      "roggen",
      "rye",
      "dinkel",
      "spelt",
      "hafer",
      "malz",
      "malt",
      "weizenmehl",
      "weizengriess",
      "weizenstarke",
      "seitan",
      "grunkern",
      "bulgur",
      "couscous",
      "graham",
    ],
  },
  milk: {
    key: "milk",
    label: "Milch",
    positiveTags: ["en:milk"],
    textKeywords: [
      "milch",
      "milk",
      "lait",
      "laktose",
      "lactose",
      "molke",
      "whey",
      "molkenerzeugnis",
      "kasein",
      "casein",
      "caseinat",
      "sahne",
      "butter",
      "buttermilch",
      "joghurt",
      "yogurt",
      "quark",
      "kase",
      "magermilchpulver",
      "vollmilch",
      "milcheiweiss",
      "milchzucker",
    ],
  },
  eggs: {
    key: "eggs",
    label: "Ei",
    positiveTags: ["en:eggs", "en:egg"],
    textKeywords: [
      "eier",
      "eigelb",
      "eiklar",
      "vollei",
      "trockenei",
      "eipulver",
      "huhnerei",
      "ovalbumin",
      "albumin",
      "oeuf",
      "huevo",
    ],
  },
  sesame: {
    key: "sesame",
    label: "Sesam",
    positiveTags: ["en:sesame-seeds", "en:sesame"],
    textKeywords: [
      "sesam",
      "sesame",
      "sesamol",
      "sesamsaat",
      "sesammehl",
      "tahin",
      "tahini",
      "gomasio",
    ],
  },
  fish: {
    key: "fish",
    label: "Fisch",
    positiveTags: ["en:fish"],
    textKeywords: [
      "fisch",
      "fish",
      "poisson",
      "lachs",
      "thunfisch",
      "kabeljau",
      "hering",
      "makrele",
      "sardelle",
      "anchovis",
      "anchovy",
      "sardine",
      "forelle",
      "seelachs",
      "fischol",
      "fischsauce",
      "surimi",
      "pangasius",
    ],
  },
  crustaceans: {
    key: "crustaceans",
    label: "Krebstiere",
    positiveTags: ["en:crustaceans"],
    textKeywords: [
      "krebstier",
      "krustentier",
      "garnele",
      "shrimp",
      "prawn",
      "krabbe",
      "hummer",
      "lobster",
      "languste",
      "scampi",
      "crevette",
      "crab",
      "crayfish",
      "flusskrebs",
    ],
  },
  molluscs: {
    key: "molluscs",
    label: "Weichtiere",
    positiveTags: ["en:molluscs"],
    textKeywords: [
      "weichtier",
      "mollusc",
      "mollusk",
      "muschel",
      "tintenfisch",
      "calamari",
      "kalmar",
      "sepia",
      "oktopus",
      "octopus",
      "krake",
      "auster",
      "oyster",
      "mussel",
      "clam",
      "schnecke",
      "escargot",
      "abalone",
    ],
  },
  celery: {
    key: "celery",
    label: "Sellerie",
    positiveTags: ["en:celery"],
    textKeywords: [
      "sellerie",
      "celery",
      "celeri",
      "staudensellerie",
      "knollensellerie",
      "selleriesalz",
      "selleriesaft",
    ],
  },
  mustard: {
    key: "mustard",
    label: "Senf",
    positiveTags: ["en:mustard"],
    textKeywords: [
      "senf",
      "mustard",
      "moutarde",
      "mostaza",
      "senfsaat",
      "senfkorner",
      "senfmehl",
      "senfol",
      "senfpulver",
      "dijon",
    ],
  },
  lupin: {
    key: "lupin",
    label: "Lupine",
    positiveTags: ["en:lupin"],
    textKeywords: [
      "lupine",
      "lupin",
      "lupinen",
      "lupinenmehl",
      "lupineneiweiss",
      "altramuz",
    ],
  },
  sulphites: {
    key: "sulphites",
    label: "Sulfite",
    positiveTags: [
      "en:sulphur-dioxide-and-sulphites",
      "en:sulphur-dioxide",
      "en:sulphites",
    ],
    textKeywords: [
      "sulfit",
      "sulphite",
      "schwefeldioxid",
      "sulfur dioxide",
      "metabisulfit",
      "natriumsulfit",
      "kaliumsulfit",
      "bisulfit",
      "disulfit",
      "e220",
      "e221",
      "e222",
      "e223",
      "e224",
      "e226",
      "e227",
      "e228",
    ],
  },
} satisfies Record<string, AllergenProfile>;

const REGISTRY: Record<string, AllergenProfile> = ALLERGEN_PROFILES;

/** All known allergen keys, in registry (display) order. */
export const ALLERGEN_KEYS = Object.keys(ALLERGEN_PROFILES);

/** All profiles, in registry (display) order. */
export const ALLERGEN_LIST: AllergenProfile[] = Object.values(ALLERGEN_PROFILES);

/** Look up a single profile by key. */
export function getProfile(key: string): AllergenProfile | undefined {
  return REGISTRY[key];
}

/** Map keys to profiles, preserving input order and silently dropping unknowns. */
export function getProfiles(keys: string[]): AllergenProfile[] {
  const out: AllergenProfile[] = [];
  for (const key of keys) {
    const profile = REGISTRY[key];
    if (profile) out.push(profile);
  }
  return out;
}

/** Back-compat: the peanut profile, the app's original (and default) allergen. */
export const PEANUT_PROFILE: AllergenProfile = ALLERGEN_PROFILES.peanut;
