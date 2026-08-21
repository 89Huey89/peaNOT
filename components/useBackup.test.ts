import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBackup } from "@/components/useBackup";
import type { HistoryEntry } from "@/components/useHistory";
import { DEFAULT_PREFS } from "@/components/usePrefs";
import { readAllPackMatch, writePackMatch } from "@/lib/packmatch";
import { readAllNotes, writeNote } from "@/lib/notes";
import { EXPORT_FORMAT, EXPORT_VERSION } from "@/lib/backup";

const LOCAL: HistoryEntry = {
  id: "h_1_111",
  ts: 1,
  barcode: "111",
  name: "Lokal",
  brand: "X",
  verdict: "safe",
};

function setup(history: HistoryEntry[] = []) {
  const importHistory = vi.fn();
  const { result } = renderHook(() =>
    useBackup({ history, importHistory, prefs: DEFAULT_PREFS }),
  );
  return { result, importHistory };
}

describe("useBackup.importData", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects invalid JSON without touching any store", () => {
    const { result, importHistory } = setup([LOCAL]);

    const outcome = result.current.importData("{not json");

    expect(outcome).toEqual({ ok: false, error: "invalid-json" });
    expect(importHistory).not.toHaveBeenCalled();
    expect(readAllPackMatch()).toEqual({});
    expect(readAllNotes()).toEqual({});
  });

  it("rejects a file that isn't a peaNOT export", () => {
    const { result, importHistory } = setup();

    const outcome = result.current.importData(JSON.stringify({ format: "other", v: 1 }));

    expect(outcome).toEqual({ ok: false, error: "unsupported-format" });
    expect(importHistory).not.toHaveBeenCalled();
  });

  it("delegates history to importHistory, and merges packmatch/notes directly into storage", () => {
    writePackMatch("111", "mismatch", 1); // local answer must survive a looser import
    writeNote("222", "lokale Notiz", 1);

    const { result, importHistory } = setup([LOCAL]);

    const raw = JSON.stringify({
      format: EXPORT_FORMAT,
      v: EXPORT_VERSION,
      exportedAt: "2026-01-01T00:00:00.000Z",
      history: [
        { id: "h_2_222", ts: 2, barcode: "222", name: "Importiert", brand: "Y", verdict: "danger" },
      ],
      prefs: { accent: "clay" },
      packmatch: { "111": { value: "match", ts: 999 } }, // conflicts with the local mismatch above
      notes: { "333": { text: "importierte Notiz", ts: 5 } },
    });

    const outcome = result.current.importData(raw);

    expect(outcome).toEqual({
      ok: true,
      historyCount: 1,
      packmatchCount: 1,
      notesCount: 1,
      prefs: { accent: "clay" },
    });
    expect(importHistory).toHaveBeenCalledTimes(1);
    expect(importHistory.mock.calls[0]![0]).toEqual([
      { id: "h_2_222", ts: 2, barcode: "222", name: "Importiert", brand: "Y", verdict: "danger" },
    ]);
    // Fail-safe: the local "mismatch" was kept, not overwritten by the import.
    expect(readAllPackMatch()).toEqual({ "111": { value: "mismatch", ts: 1 } });
    // Notes merge additively — both the local and imported note survive.
    expect(readAllNotes()).toEqual({
      "222": { text: "lokale Notiz", ts: 1 },
      "333": { text: "importierte Notiz", ts: 5 },
    });
  });
});

describe("useBackup.exportData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shares a JSON file via the Web Share API when available", async () => {
    const shared: { data?: ShareData } = {};
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn(async (data: ShareData) => {
        shared.data = data;
      }),
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn(() => true),
    });
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });

    const { result } = setup([LOCAL]);
    await act(async () => {
      await result.current.exportData();
    });

    expect(navigator.share).toHaveBeenCalledTimes(1);
    expect(createObjectURL).not.toHaveBeenCalled();
    const file = shared.data?.files?.[0];
    expect(file?.name).toMatch(/^peanot-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(file?.type).toBe("application/json");

    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
  });

  it("respects a user-cancelled share sheet instead of falling back to a download", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn(async () => {
        const err = new Error("cancelled");
        err.name = "AbortError";
        throw err;
      }),
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn(() => true),
    });
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });

    const { result } = setup([LOCAL]);
    await act(async () => {
      await result.current.exportData();
    });

    expect(createObjectURL).not.toHaveBeenCalled();

    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
  });

  it("falls back to a download link when the Web Share API is unavailable", async () => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { result } = setup([LOCAL]);
    await act(async () => {
      await result.current.exportData();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
