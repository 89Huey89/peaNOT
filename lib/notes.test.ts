import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTE_MAX_LENGTH,
  readAllNotes,
  readNote,
  readNoteEntry,
  sanitizeNoteStore,
  writeAllNotes,
  writeNote,
} from "@/lib/notes";

describe("note storage (F5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null for a barcode that was never noted", () => {
    expect(readNote("20137946")).toBeNull();
  });

  it("remembers a note across reads", () => {
    writeNote("20137946", "Sorte Schoko okay, Crunchy nicht");
    expect(readNote("20137946")).toBe("Sorte Schoko okay, Crunchy nicht");
    expect(readNote("4011200296908")).toBeNull();
  });

  it("trims whitespace and updates an existing note", () => {
    writeNote("20137946", "erste Notiz");
    writeNote("20137946", "  zweite Notiz  ");
    expect(readNote("20137946")).toBe("zweite Notiz");
  });

  it("clears the note when saved blank or whitespace-only", () => {
    writeNote("20137946", "wird gelöscht");
    expect(readNote("20137946")).toBe("wird gelöscht");
    writeNote("20137946", "   ");
    expect(readNote("20137946")).toBeNull();
  });

  it("caps the stored text length", () => {
    const long = "x".repeat(NOTE_MAX_LENGTH + 50);
    writeNote("20137946", long);
    expect(readNote("20137946")).toHaveLength(NOTE_MAX_LENGTH);
  });

  it("exposes the note's timestamp via readNoteEntry", () => {
    writeNote("20137946", "hallo", 1_000);
    expect(readNoteEntry("20137946")).toEqual({ text: "hallo", ts: 1_000 });
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("peanot.notes.v1", "{not json");
    expect(readNote("20137946")).toBeNull();
    writeNote("20137946", "wieder da");
    expect(readNote("20137946")).toBe("wieder da");
  });

  it("ignores entries that are not valid notes", () => {
    window.localStorage.setItem(
      "peanot.notes.v1",
      JSON.stringify({
        "20137946": { text: "", ts: 1 }, // blank text
        "111": { text: "ok", ts: "not-a-number" }, // bad ts
        "222": { text: 42, ts: 1 }, // bad text type
      }),
    );
    expect(readNote("20137946")).toBeNull();
    expect(readNote("111")).toBeNull();
    expect(readNote("222")).toBeNull();
  });

  it("keeps only the newest 200 notes", () => {
    for (let i = 0; i < 205; i++) {
      writeNote(`code-${i}`, `Notiz ${i}`, 1_000 + i);
    }
    expect(readNote("code-204")).toBe("Notiz 204");
    expect(readNote("code-5")).toBe("Notiz 5");
    expect(readNote("code-4")).toBeNull();
    expect(readNote("code-0")).toBeNull();
  });
});

describe("sanitizeNoteStore", () => {
  it("drops malformed entries and keeps valid ones", () => {
    expect(
      sanitizeNoteStore({
        good: { text: "passt", ts: 5 },
        blank: { text: "   ", ts: 5 },
        bad: { text: 1, ts: 5 },
        missingTs: { text: "x" },
      }),
    ).toEqual({ good: { text: "passt", ts: 5 } });
  });

  it("returns an empty store for non-object input", () => {
    expect(sanitizeNoteStore(null)).toEqual({});
    expect(sanitizeNoteStore([1, 2])).toEqual({});
    expect(sanitizeNoteStore("nope")).toEqual({});
  });
});

describe("readAllNotes / writeAllNotes (F1 export/import)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the full store", () => {
    writeNote("111", "Erste", 1);
    writeNote("222", "Zweite", 2);

    const all = readAllNotes();
    expect(all).toEqual({
      "111": { text: "Erste", ts: 1 },
      "222": { text: "Zweite", ts: 2 },
    });

    window.localStorage.clear();
    writeAllNotes(all);
    expect(readAllNotes()).toEqual(all);
  });
});
