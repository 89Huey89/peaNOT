import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePhoto } from "@/components/usePhoto";
import { PHOTO_STALE_MS, deletePhoto, readPhoto, savePhoto } from "@/lib/photos";

// Only the storage calls are mocked — lib/photos.ts's own read/write/FIFO/
// error-handling logic already has its own thorough coverage in
// lib/photos.test.ts (against a fake IndexedDB). This file is about the
// hook's own job: loading on mount and on barcode change, the saving/error
// flags around capture(), object-URL creation *and* cleanup, and the stale
// calculation — using the real isPhotoStale/PHOTO_STALE_MS from lib/photos.
vi.mock("@/lib/photos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photos")>();
  return {
    ...actual,
    readPhoto: vi.fn(),
    savePhoto: vi.fn(),
    deletePhoto: vi.fn(),
  };
});

const mockReadPhoto = vi.mocked(readPhoto);
const mockSavePhoto = vi.mocked(savePhoto);
const mockDeletePhoto = vi.mocked(deletePhoto);

// jsdom has no URL.createObjectURL/revokeObjectURL at all (see lib/photos.ts's
// own comment on this) — stub them so the hook's cleanup behavior can
// actually be observed, the same way a real browser would let it.
let nextUrl = 0;
function stubObjectUrls() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:mock-${++nextUrl}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

describe("usePhoto", () => {
  beforeEach(() => {
    stubObjectUrls();
    mockReadPhoto.mockReset();
    mockSavePhoto.mockReset();
    mockDeletePhoto.mockReset();
    mockDeletePhoto.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with no photo and loads null gracefully when the store has none", async () => {
    mockReadPhoto.mockResolvedValue(null);

    const { result } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(mockReadPhoto).toHaveBeenCalledWith("4001"));

    expect(result.current.photoUrl).toBeNull();
    expect(result.current.takenAt).toBeNull();
    expect(result.current.stale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shows the existing photo's object URL and capture time", async () => {
    const blob = new Blob(["ingredients"], { type: "image/jpeg" });
    mockReadPhoto.mockResolvedValue({ barcode: "4001", blob, ts: 5_000 });

    const { result } = renderHook(() => usePhoto("4001"));

    await waitFor(() => expect(result.current.photoUrl).not.toBeNull());
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(result.current.takenAt).toBe(5_000);
  });

  it("flags a photo older than the stale threshold, and not one just under it", async () => {
    const oldTs = Date.now() - (PHOTO_STALE_MS + 60_000);
    mockReadPhoto.mockResolvedValue({ barcode: "old", blob: new Blob(["x"]), ts: oldTs });

    const { result } = renderHook(() => usePhoto("old"));
    await waitFor(() => expect(result.current.takenAt).toBe(oldTs));

    expect(result.current.stale).toBe(true);
  });

  it("does not flag a recent photo as stale", async () => {
    const recentTs = Date.now() - 60_000;
    mockReadPhoto.mockResolvedValue({ barcode: "new", blob: new Blob(["x"]), ts: recentTs });

    const { result } = renderHook(() => usePhoto("new"));
    await waitFor(() => expect(result.current.takenAt).toBe(recentTs));

    expect(result.current.stale).toBe(false);
  });

  it("reloads when the barcode changes", async () => {
    mockReadPhoto.mockImplementation(async (barcode: string) =>
      barcode === "a" ? { barcode: "a", blob: new Blob(["a"]), ts: 1 } : null,
    );

    const { result, rerender } = renderHook(({ barcode }) => usePhoto(barcode), {
      initialProps: { barcode: "a" },
    });
    await waitFor(() => expect(result.current.takenAt).toBe(1));

    rerender({ barcode: "b" });
    await waitFor(() => expect(mockReadPhoto).toHaveBeenCalledWith("b"));
    await waitFor(() => expect(result.current.takenAt).toBeNull());
    expect(result.current.photoUrl).toBeNull();
  });

  it("sets saving while capture() is in flight, then clears it and updates the photo", async () => {
    mockReadPhoto.mockResolvedValue(null);
    let resolveSave!: (value: { barcode: string; blob: Blob; ts: number }) => void;
    mockSavePhoto.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    const { result } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(mockReadPhoto).toHaveBeenCalled());

    const newBlob = new Blob(["captured"], { type: "image/jpeg" });
    act(() => {
      void result.current.capture(newBlob);
    });
    await waitFor(() => expect(result.current.saving).toBe(true));

    await act(async () => {
      resolveSave({ barcode: "4001", blob: newBlob, ts: 9_000 });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(result.current.takenAt).toBe(9_000);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error, without throwing, when saving fails (e.g. quota exceeded)", async () => {
    mockReadPhoto.mockResolvedValue(null);
    mockSavePhoto.mockResolvedValue(null);

    const { result } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(mockReadPhoto).toHaveBeenCalled());

    await act(async () => {
      await result.current.capture(new Blob(["x"]));
    });

    expect(result.current.error).toMatch(/nicht gespeichert/);
    expect(result.current.photoUrl).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("clears the photo after remove()", async () => {
    mockReadPhoto.mockResolvedValue({ barcode: "4001", blob: new Blob(["x"]), ts: 1_000 });

    const { result } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(result.current.photoUrl).not.toBeNull());

    await act(async () => {
      await result.current.remove();
    });

    expect(mockDeletePhoto).toHaveBeenCalledWith("4001");
    expect(result.current.photoUrl).toBeNull();
    expect(result.current.takenAt).toBeNull();
  });

  it("revokes the previous object URL once a new photo replaces it", async () => {
    mockReadPhoto.mockResolvedValue({ barcode: "4001", blob: new Blob(["old"]), ts: 1 });

    const { result } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(result.current.photoUrl).not.toBeNull());
    const firstUrl = result.current.photoUrl;

    mockSavePhoto.mockResolvedValue({ barcode: "4001", blob: new Blob(["new"]), ts: 2 });
    await act(async () => {
      await result.current.capture(new Blob(["new"]));
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
  });

  it("revokes the object URL on unmount", async () => {
    mockReadPhoto.mockResolvedValue({ barcode: "4001", blob: new Blob(["x"]), ts: 1 });

    const { result, unmount } = renderHook(() => usePhoto("4001"));
    await waitFor(() => expect(result.current.photoUrl).not.toBeNull());
    const url = result.current.photoUrl;

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });
});
