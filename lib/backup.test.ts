import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/components/useHistory";
import type { StoredAnswer } from "@/lib/packmatch";
import type { StoredNote } from "@/lib/notes";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  buildExportPayload,
  mergeHistory,
  mergeNotes,
  mergePackMatch,
  parseImportFile,
} from "@/lib/backup";
import { DEFAULT_PREFS } from "@/components/usePrefs";

function entry(partial: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "h_1000_111",
    ts: 1000,
    barcode: "111",
    name: "Reiswaffel",
    brand: "dm Bio",
    verdict: "safe",
    ...partial,
  };
}

describe("buildExportPayload", () => {
  it("stamps the format/version and passes the stores through unchanged", () => {
    const history = [entry({})];
    const packmatch: Record<string, StoredAnswer> = { "111": { value: "match", ts: 1 } };
    const notes: Record<string, StoredNote> = { "111": { text: "Notiz", ts: 1 } };

    const payload = buildExportPayload({ history, prefs: DEFAULT_PREFS, packmatch, notes });

    expect(payload.format).toBe(EXPORT_FORMAT);
    expect(payload.v).toBe(EXPORT_VERSION);
    expect(payload.history).toEqual(history);
    expect(payload.prefs).toEqual(DEFAULT_PREFS);
    expect(payload.packmatch).toEqual(packmatch);
    expect(payload.notes).toEqual(notes);
    expect(() => new Date(payload.exportedAt).toISOString()).not.toThrow();
  });
});

describe("mergeHistory", () => {
  it("keeps entries from both sides when barcodes differ", () => {
    const a = [entry({ id: "h_1_111", ts: 1, barcode: "111" })];
    const b = [entry({ id: "h_2_222", ts: 2, barcode: "222" })];

    expect(mergeHistory(a, b).map((e) => e.barcode)).toEqual(["222", "111"]);
  });

  it("de-duplicates an identical re-import by id", () => {
    const e = entry({ id: "h_1_111", ts: 1, barcode: "111" });
    expect(mergeHistory([e], [e])).toEqual([e]);
  });

  it("falls back to barcode+ts when an entry has no id", () => {
    const a = [entry({ id: "", ts: 5, barcode: "111", name: "A" })];
    const b = [entry({ id: "", ts: 5, barcode: "111", name: "A" })];
    expect(mergeHistory(a, b)).toHaveLength(1);
  });

  it("keeps the newer entry on a genuine key conflict", () => {
    const older = entry({ id: "dup", ts: 1, name: "Alt" });
    const newer = entry({ id: "dup", ts: 2, name: "Neu" });
    expect(mergeHistory([older], [newer])).toEqual([newer]);
    expect(mergeHistory([newer], [older])).toEqual([newer]);
  });

  it("sorts the merged result newest-first", () => {
    const a = [entry({ id: "h_1", ts: 1, barcode: "1" })];
    const b = [
      entry({ id: "h_3", ts: 3, barcode: "3" }),
      entry({ id: "h_2", ts: 2, barcode: "2" }),
    ];
    expect(mergeHistory(a, b).map((e) => e.ts)).toEqual([3, 2, 1]);
  });

  it("caps the merged result at maxEntries", () => {
    const a = Array.from({ length: 150 }, (_, i) => entry({ id: `a${i}`, ts: i, barcode: `a${i}` }));
    const b = Array.from({ length: 150 }, (_, i) =>
      entry({ id: `b${i}`, ts: 1000 + i, barcode: `b${i}` }),
    );
    const merged = mergeHistory(a, b, 200);
    expect(merged).toHaveLength(200);
    // The oldest 100 "a" entries (ts 0..99) got dropped, newest 200 survive.
    expect(merged.some((e) => e.barcode === "a0")).toBe(false);
    expect(merged.some((e) => e.barcode === "b149")).toBe(true);
  });
});

describe("mergePackMatch (fail-safe conflict rule)", () => {
  it("adds a barcode only present on one side", () => {
    expect(mergePackMatch({}, { "111": { value: "match", ts: 1 } })).toEqual({
      "111": { value: "match", ts: 1 },
    });
    expect(mergePackMatch({ "111": { value: "mismatch", ts: 1 } }, {})).toEqual({
      "111": { value: "mismatch", ts: 1 },
    });
  });

  it("keeps the newer answer when both sides agree", () => {
    const current = { "111": { value: "match" as const, ts: 1 } };
    const incoming = { "111": { value: "match" as const, ts: 5 } };
    expect(mergePackMatch(current, incoming)["111"]).toEqual({ value: "match", ts: 5 });
    expect(mergePackMatch(incoming, current)["111"]).toEqual({ value: "match", ts: 5 });
  });

  it("a local 'mismatch' always survives an imported 'match', regardless of age", () => {
    const current = { "111": { value: "mismatch" as const, ts: 1 } };
    const incoming = { "111": { value: "match" as const, ts: 999 } };
    expect(mergePackMatch(current, incoming)["111"]).toEqual({ value: "mismatch", ts: 1 });
  });

  it("an imported 'mismatch' always overrides a local 'match', regardless of age", () => {
    const current = { "111": { value: "match" as const, ts: 999 } };
    const incoming = { "111": { value: "mismatch" as const, ts: 1 } };
    expect(mergePackMatch(current, incoming)["111"]).toEqual({ value: "mismatch", ts: 1 });
  });
});

describe("mergeNotes", () => {
  it("adds a barcode only present on one side", () => {
    expect(mergeNotes({}, { "111": { text: "neu", ts: 1 } })).toEqual({
      "111": { text: "neu", ts: 1 },
    });
  });

  it("keeps the more recently edited note on conflict", () => {
    const current = { "111": { text: "alt", ts: 1 } };
    const incoming = { "111": { text: "neu", ts: 5 } };
    expect(mergeNotes(current, incoming)).toEqual({ "111": { text: "neu", ts: 5 } });
    expect(mergeNotes(incoming, current)).toEqual({ "111": { text: "neu", ts: 5 } });
  });
});

describe("parseImportFile", () => {
  function validFile(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      format: "peanot-export",
      v: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      history: [entry({})],
      prefs: { accent: "berry" },
      packmatch: { "111": { value: "match", ts: 1 } },
      notes: { "111": { text: "hallo", ts: 1 } },
      ...overrides,
    });
  }

  it("accepts a well-formed export", () => {
    const result = parseImportFile(validFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.history).toHaveLength(1);
    expect(result.data.packmatch).toEqual({ "111": { value: "match", ts: 1 } });
    expect(result.data.notes).toEqual({ "111": { text: "hallo", ts: 1 } });
    expect(result.data.prefs).toEqual({ accent: "berry" });
  });

  it("rejects invalid JSON", () => {
    expect(parseImportFile("{not json")).toEqual({ ok: false, error: "invalid-json" });
  });

  it("rejects a JSON value that is not an object", () => {
    expect(parseImportFile("[1,2,3]")).toEqual({ ok: false, error: "invalid-json" });
    expect(parseImportFile("null")).toEqual({ ok: false, error: "invalid-json" });
  });

  it("rejects a file with the wrong format tag", () => {
    expect(parseImportFile(validFile({ format: "something-else" }))).toEqual({
      ok: false,
      error: "unsupported-format",
    });
  });

  it("rejects a file with an unsupported version", () => {
    expect(parseImportFile(validFile({ v: 2 }))).toEqual({
      ok: false,
      error: "unsupported-version",
    });
  });

  it("drops malformed history rows instead of failing the whole import", () => {
    const result = parseImportFile(
      validFile({ history: [entry({}), { barcode: "bad" }, null, "nope"] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.history).toHaveLength(1);
  });

  it("falls back to an empty history array when the field is missing or malformed", () => {
    const result = parseImportFile(validFile({ history: "not-an-array" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.history).toEqual([]);
  });
});
