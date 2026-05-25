/**
 * An allergen profile parameterizes the detection engine. Adding a new
 * allergen (tree nuts, gluten, ...) later means adding another profile,
 * not changing the engine.
 */
export interface AllergenProfile {
  key: string;
  /**
   * OFF "en:" taxonomy tags counting as a positive presence/trace. A product
   * tag matches if it equals one of these or starts with it followed by "-"
   * (e.g. "en:peanut-oil" matches "en:peanut").
   */
  positiveTags: string[];
  /**
   * Substrings matched against normalized (lowercased, umlaut-folded,
   * diacritic-stripped) freeform ingredient text. Keep entries ascii-folded.
   */
  textKeywords: string[];
}

export const PEANUT_PROFILE: AllergenProfile = {
  key: "peanut",
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
};
