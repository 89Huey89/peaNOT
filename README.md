# peaNOT

Private, mobile-first peanut-allergen barcode scanner. Scan a product barcode
in the browser, look it up on Open Food Facts, and get a clear peanut verdict.

> **Sicherheitshinweis:** Kein Erdnuss-Hinweis in der Datenbank gefunden bedeutet
> nicht garantiert erdnussfrei. Bei unklarer Datenlage wird nie „NEIN" angezeigt.

## Status-Logik

| Status        | Bedeutung                                                        | Anzeige      |
| ------------- | ---------------------------------------------------------------- | ------------ |
| `JA`          | Erdnuss in Allergenen / Zutaten(-Text)                           | Rot          |
| `SPUREN`      | Erdnuss nur in Spuren (`traces`)                                 | Orange       |
| `NEIN`        | Produktdaten vorhanden **und** kein Erdnuss-Hinweis              | Grün         |
| `KEINE_DATEN` | Nicht gefunden / keine Zutaten-/Allergendaten / Fehler           | Rot (Warnung) |

Jeder unklare Fall (nicht gefunden, fehlende Daten, Netzwerk-/API-Fehler) wird
fail-safe als `KEINE_DATEN` rot angezeigt – Erdnuss kann dann nicht
ausgeschlossen werden.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (alle Tests)
npm run typecheck  # tsc --noEmit
npm run build      # Production-Build
```

Kamerazugriff (`getUserMedia`) benötigt einen sicheren Kontext: `localhost` im
Dev oder HTTPS in Produktion. Auf dem iPhone die manuelle Eingabe nutzen, falls
die Kamera blockiert ist.

## Design

UI nach Design-Richtung **A · Bold Stamp** (warmes Cremepapier, Tinte,
Senf-Akzent; Fraunces-Serif + Space Grotesk + JetBrains Mono). Flow:
Onboarding → Scan → Ergebnis → Verlauf → Profil mit unterer Tab-Navigation.
Das Ergebnis ist der ganze Screen (Stempel, Belegstelle mit markierter
„Erdnüsse", Allergen-Chips).

## Verlauf & Einstellungen (lokal, ohne Konto)

Scan-Verlauf und Einstellungen (Akzentfarbe, Vibrieren/Ton bei Treffer,
Spuren-Strikt) liegen ausschließlich im Browser des Geräts (`localStorage`,
Keys `peanot.history.v1` / `peanot.prefs.v1`). Kein Account, kein Server-State –
„Leeren" entfernt den Verlauf wieder.

## Architektur

- `lib/allergens/` – reine, getestete Erdnuss-Erkennung (über `AllergenProfile`
  auf weitere Allergene erweiterbar) inkl. `labels` (Allergen-Tags → Labels) und
  `evidence` (Erdnuss-Fundstelle im Zutatentext).
- `lib/off/` – serverseitiger Open-Food-Facts-Client (setzt User-Agent) + defensive Normalisierung.
- `lib/theme.ts`, `lib/verdict.ts`, `lib/time.ts` – Palette, Status→Verdict-Mapping, relative Zeiten.
- `app/api/product/[barcode]/route.ts` – API-Route, komponiert Client + Erkennung.
- `app/page.tsx` – Client-Router über die Screens.
- `components/` – `BarcodeScanner` (@zxing/browser), `ManualEntry`, geteilte
  UI-Atome (`ui.tsx`), `useHistory`/`usePrefs` (localStorage) und `screens/`.

## Deployment (Vercel Hobby)

Repository in Vercel importieren – keine Umgebungsvariablen, keine Datenbank
nötig. Vercel liefert HTTPS (für die Kamera erforderlich). Die API-Route läuft
im Node-Runtime.
