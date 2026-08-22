import type { Metadata, Viewport } from "next";
import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Befund 08: the three families used to come from a runtime
// <link rel="stylesheet"> on fonts.googleapis.com — the one silent
// third-party request in an app whose whole pitch (Verlauf, Notizen,
// Favoriten, Notfallplan, Profil-Screen: "Kein Konto · alles auf diesem
// Gerät") is that nothing leaves the device. next/font/google downloads the
// font files at BUILD time and next serves them from this origin's own
// /_next/static/ — so there's no request to Google at all, not even on the
// very first launch, and no FOUT/layout-shift waiting on a network round
// trip.
//
// Each call below sets a CSS custom property (via `variable`) that resolves
// to the LITERAL family name plus fallback stack, e.g.
// --font-fraunces: "Fraunces", "Fraunces Fallback", Georgia, serif — and the
// generated @font-face rules declare that same literal "Fraunces" name.
// That's deliberate on next/font's part when `variable` is used (unlike
// `className`, it doesn't get a hashed/scoped name), and it means the
// existing `fontFamily: "'Fraunces', serif"` /
// `"'Space Grotesk', sans-serif"` / `"'JetBrains Mono', monospace"` literals
// still hardcoded throughout components/* keep matching and resolving to
// these self-hosted files without any change there — verified against the
// actual build output (.next/static/css), not just assumed.
const fraunces = Fraunces({
  subsets: ["latin"],
  // Fraunces is a variable font; axes are only selectable when weight is
  // "variable" (next/font rejects `axes` alongside a fixed weight list), so
  // this fetches the full continuous 100..900 weight range instead of the
  // discrete 400/600/800 (normal) + 400/800 (italic) instances the old
  // Google Fonts URL pinned. Same underlying variable font file either way
  // — this is a superset, not a different font. `axes: ["opsz"]` is the
  // part that actually matters: without it, next/font would freeze the
  // optical-size axis at its default (14) and the serif would render
  // subtly different than the 9..144-aware original at small/large sizes.
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-fraunces",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-grotesk",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "peaNOT — Erdnuss-Check",
  description: "Privater Erdnuss-Allergen-Scanner per Barcode (Open Food Facts).",
  robots: { index: false, follow: false },
  applicationName: "peaNOT",
  appleWebApp: {
    capable: true,
    title: "peaNOT",
    // Every screen roots in AppShell (P.BG) with TopBar consuming
    // safe-area-inset-top already — black-translucent + viewportFit:"cover"
    // below lets the app draw behind the status bar as designed instead of
    // leaving a dead gap under it.
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/splash/apple-splash-1290-2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/apple-splash-1179-2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/apple-splash-750-1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
  },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ead8" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The three variables below (--font-fraunces/--font-grotesk/--font-mono)
    // are consumed in app/globals.css. No <head> font links needed anymore —
    // next/font already inlines the required @font-face rules and preload
    // tags for the self-hosted files during the build.
    <html lang="de" className={`${fraunces.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
