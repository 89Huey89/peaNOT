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
  };
}
