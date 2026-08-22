import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "peaNOT — Erdnuss-Check",
    short_name: "peaNOT",
    description: "Privater Erdnuss-Allergen-Scanner per Barcode (Open Food Facts).",
    lang: "de",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ead8",
    theme_color: "#f3ead8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Befund 09: deep-link the two screens someone might want one tap away
    // in an emergency (Notfallplan) or to hand to someone else (Allergie-
    // Karte) — both routes read via `?screen=` in app/page.tsx's bootstrap.
    //
    // IMPORTANT — iOS/Safari does NOT support manifest `shortcuts` at all
    // (no long-press-icon menu, no effect on the installed PWA); this is an
    // Android-only win there. The actual iOS payoff is different: open
    // `/?screen=notfall` in Safari and "Zum Home-Bildschirm hinzufügen" as a
    // *second* icon next to the main app's — that second icon boots straight
    // into the Notfallplan, no shortcuts support needed for it to work.
    // start_url stays "/" (the main icon must still boot to Scan).
    shortcuts: [
      {
        name: "Notfallplan",
        url: "/?screen=notfall",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Allergie-Karte",
        url: "/?screen=karte",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
