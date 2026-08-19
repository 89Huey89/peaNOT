import { describe, expect, it } from "vitest";
import type { OffProductFields } from "@/lib/types";
import { CAVEATS, caveatSummary, detectCaveats } from "@/lib/caveats";

const CLEAN: OffProductFields = {
  allergens_tags: ["en:milk"],
  traces_tags: [],
  ingredients_tags: ["en:milk"],
  ingredients_text: "Lait écrémé, sucre",
};

const WITH_TRACES: OffProductFields = { ...CLEAN, traces_tags: ["en:nuts"] };

describe("detectCaveats", () => {
  it("never qualifies a hit or a trace warning", () => {
    expect(detectCaveats("20137946", "JA", CLEAN)).toEqual([]);
    expect(detectCaveats("20137946", "SPUREN", CLEAN)).toEqual([]);
  });

  it("flags an all-clear that rests on a retailer in-store code", () => {
    expect(detectCaveats("20137946", "NEIN", WITH_TRACES)).toEqual(["restricted-code"]);
  });

  it("flags an all-clear with no traces data at all", () => {
    expect(detectCaveats("4011200296908", "NEIN", CLEAN)).toEqual(["traces-unknown"]);
  });

  it("reports both reasons when both apply", () => {
    expect(detectCaveats("20137946", "NEIN", CLEAN)).toEqual([
      "restricted-code",
      "traces-unknown",
    ]);
  });

  it("prefers the checksum warning over the prefix warning", () => {
    expect(detectCaveats("20137945", "NEIN", WITH_TRACES)).toEqual(["checksum-mismatch"]);
  });

  it("leaves an ordinary all-clear unqualified", () => {
    expect(detectCaveats("4011200296908", "NEIN", WITH_TRACES)).toEqual([]);
  });

  it("still warns about the barcode when no data was found", () => {
    expect(detectCaveats("20137946", "KEINE_DATEN", null)).toEqual(["restricted-code"]);
    expect(detectCaveats("4011200296908", "KEINE_DATEN", null)).toEqual([]);
  });
});

describe("caveatSummary", () => {
  it("joins the short clauses in order", () => {
    expect(caveatSummary(["restricted-code", "traces-unknown"])).toBe(
      `${CAVEATS["restricted-code"].short} ${CAVEATS["traces-unknown"].short}`,
    );
  });

  it("is empty without caveats", () => {
    expect(caveatSummary([])).toBe("");
  });
});
