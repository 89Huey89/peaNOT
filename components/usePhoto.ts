"use client";

import { useEffect, useState } from "react";
import {
  deletePhoto,
  isPhotoStale,
  readPhoto,
  savePhoto,
  type StoredPhoto,
} from "@/lib/photos";

/**
 * Feature E: the user's own photo of a barcode's ingredients list, kept in
 * the browser (IndexedDB, via lib/photos.ts) exactly the way useNote.ts and
 * usePackMatch.ts keep their state — self-contained, read after mount, and
 * fed by a store that never throws. ResultScreen only ever renders what this
 * hook hands back; it doesn't (and mustn't) know IndexedDB exists.
 *
 * Purely a memory aid, same as the note: nothing here is ever read by
 * anything that computes a verdict (see lib/photos.ts's header comment).
 */
export function usePhoto(barcode: string) {
  const [entry, setEntry] = useState<StoredPhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // True only while a just-captured photo is being read + shrunk — that's
  // the one part of this feature slow enough (a multi-MB iPhone photo) to
  // need a visible loading state, per F-E's accessibility requirement.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read after mount: IndexedDB access (like localStorage) has to wait for
  // the client, and switching barcodes (a new scan while this component
  // stays mounted, or a re-render for a different product) must re-load
  // rather than keep showing the previous barcode's photo.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    readPhoto(barcode).then((found) => {
      if (!cancelled) setEntry(found);
    });
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  // The one place an object URL for this photo is created *and* revoked —
  // on every entry change (a new photo replacing an old one) and on
  // unmount, so no screen showing a photo has to remember to clean this up
  // itself. Guarded: jsdom (and some webviews) has no URL.createObjectURL.
  useEffect(() => {
    if (!entry || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setPhotoUrl(null);
      return;
    }
    let url: string | null = null;
    try {
      url = URL.createObjectURL(entry.blob);
    } catch {
      setPhotoUrl(null);
      return;
    }
    setPhotoUrl(url);
    return () => {
      URL.revokeObjectURL(url!);
    };
  }, [entry]);

  async function capture(file: File | Blob): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const saved = await savePhoto(barcode, file);
      if (!saved) {
        // Storage failed (no IndexedDB, quota exceeded, blocked upgrade, …)
        // — surfaced here rather than swallowed, per F-E's "never fail
        // silently" requirement. The previous photo (if any) is untouched.
        setError("Foto konnte nicht gespeichert werden — evtl. ist der Speicher voll.");
        return;
      }
      setEntry(saved);
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    await deletePhoto(barcode);
    setEntry(null);
  }

  return {
    photoUrl,
    takenAt: entry?.ts ?? null,
    /** Old enough that the pack in hand, not this photo, should decide —
     * see lib/photos.ts's PHOTO_STALE_MS for the six-month reasoning. */
    stale: entry ? isPhotoStale(entry.ts) : false,
    saving,
    error,
    capture,
    remove,
  };
}
