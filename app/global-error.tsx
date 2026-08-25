"use client";

import Error from "./error";

/**
 * Root-layout error boundary. app/error.tsx only catches a crash inside
 * children of the root layout (app/layout.tsx) — a font, provider, or
 * something in <html>/<body> itself throwing needs this file instead, and
 * the App Router requires it to render its own <html>/<body> since it
 * replaces the whole root layout, not just the page beneath it.
 *
 * Kept deliberately thin: it reuses the exact same crash screen as
 * app/error.tsx (same copy, same "Erneut versuchen" / "Verlauf
 * zurücksetzen" recovery) so there is exactly one place that screen's
 * design and behaviour live, rather than a second copy that could drift.
 */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body>
        <Error {...props} />
      </body>
    </html>
  );
}
