import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPackMatch,
  readPackMatch,
  readPackMatchEntry,
  writePackMatch,
} from "@/lib/packmatch";

describe("applyPackMatch", () => {
  it("changes nothing while the question is unanswered", () => {
    expect(applyPackMatch("NEIN", ["restricted-code"], null)).toEqual({
      status: "NEIN",
      caveats: ["restricted-code"],
    });
  });

  it("settles the identity caveats when the pack matches", () => {
    expect(
      applyPackMatch("NEIN", ["restricted-code", "traces-unknown"], "match"),
    ).toEqual({ status: "NEIN", caveats: ["traces-unknown"] });
  });

  it("also settles a checksum warning when the pack matches", () => {
    expect(applyPackMatch("NEIN", ["checksum-mismatch"], "match")).toEqual({
      status: "NEIN",
      caveats: [],
    });
  });

  it("invalidates the record when the pack does not match", () => {
    expect(applyPackMatch("NEIN", ["restricted-code"], "mismatch")).toEqual({
      status: "KEINE_DATEN",
      caveats: ["restricted-code"],
    });
  });

  it("never lets an answer talk a hit or a trace warning away", () => {
    expect(applyPackMatch("JA", [], "mismatch").status).toBe("JA");
    expect(applyPackMatch("JA", [], "match").status).toBe("JA");
    expect(applyPackMatch("SPUREN", [], "mismatch").status).toBe("SPUREN");
  });
});

describe("pack match storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null for a barcode that was never answered", () => {
    expect(readPackMatch("20137946")).toBeNull();
  });

  it("remembers an answer across reads", () => {
    writePackMatch("20137946", "mismatch");
    expect(readPackMatch("20137946")).toBe("mismatch");
    expect(readPackMatch("4011200296908")).toBeNull();
  });

  it("overwrites and clears answers", () => {
    writePackMatch("20137946", "match");
    writePackMatch("20137946", "mismatch");
    expect(readPackMatch("20137946")).toBe("mismatch");
    writePackMatch("20137946", null);
    expect(readPackMatch("20137946")).toBeNull();
  });

  it("keeps only the newest 200 answers", () => {
    // "mismatch" so this only exercises the count-based prune, not the
    // separate "match" time-based expiry (see the "pack match expiry" suite).
    for (let i = 0; i < 205; i++) {
      writePackMatch(`code-${i}`, "mismatch", 1_000 + i);
    }
    expect(readPackMatch("code-204")).toBe("mismatch");
    expect(readPackMatch("code-5")).toBe("mismatch");
    expect(readPackMatch("code-4")).toBeNull();
    expect(readPackMatch("code-0")).toBeNull();
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("peanot.packmatch.v1", "{not json");
    expect(readPackMatch("20137946")).toBeNull();
    writePackMatch("20137946", "match");
    expect(readPackMatch("20137946")).toBe("match");
  });

  it("ignores entries that are not valid answers", () => {
    window.localStorage.setItem(
      "peanot.packmatch.v1",
      JSON.stringify({ "20137946": { value: "vielleicht", ts: 1 } }),
    );
    expect(readPackMatch("20137946")).toBeNull();
  });
});

describe("pack match expiry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const DAY = 24 * 60 * 60 * 1000;

  it("keeps a fresh 'match' answer", () => {
    writePackMatch("20137946", "match", 0);
    expect(readPackMatch("20137946", 89 * DAY)).toBe("match");
  });

  it("expires a 'match' answer after 90 days, asking again", () => {
    writePackMatch("20137946", "match", 0);
    expect(readPackMatch("20137946", 91 * DAY)).toBeNull();
  });

  it("never expires a 'mismatch' answer, fail-safe", () => {
    writePackMatch("20137946", "mismatch", 0);
    expect(readPackMatch("20137946", 1000 * DAY)).toBe("mismatch");
  });

  it("exposes the answer's timestamp via readPackMatchEntry", () => {
    writePackMatch("20137946", "match", 1_000);
    expect(readPackMatchEntry("20137946", 1_000)).toEqual({ value: "match", ts: 1_000 });
  });

  it("readPackMatchEntry also honors 'match' expiry", () => {
    writePackMatch("20137946", "match", 0);
    expect(readPackMatchEntry("20137946", 91 * DAY)).toBeNull();
  });
});
