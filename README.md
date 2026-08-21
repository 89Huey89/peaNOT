# peaNOT

Private, mobile-first peanut-allergen barcode scanner. Scan a product barcode
in the browser, look it up on Open Food Facts, and get a clear peanut verdict.

> **Sicherheitshinweis:** Kein Erdnuss-Hinweis in der Datenbank gefunden bedeutet
> nicht garantiert erdnussfrei. Rezeptur und Verpackung können sich bei gleicher
> EAN ändern; maßgeblich ist deshalb immer die Packung in der Hand. Bei unklarer
> Datenlage wird nie „NEIN" angezeigt.

Wenn Open Food Facts die Metadaten liefert, zeigt das Ergebnis außerdem Datum
und Revisionsnummer der letzten Datenbankbearbeitung. Das macht einen alten
Datensatz sichtbar, beweist aber keine Rezepturänderung: Eine Revision kann
ebenso durch ein neues Foto oder eine reine Textkorrektur entstehen.

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

### Vorbehalte (`lib/caveats.ts`)

Ein `NEIN` ist nur so gut wie der Datensatz dahinter. Deshalb prüft die API
zusätzlich, ob dem grünen Ergebnis etwas Wesentliches fehlt, und liefert
`caveats`. Ein Ergebnis mit Vorbehalt wird nicht mehr grün, sondern **amber**
dargestellt (Verdict `partial`) und nennt den Grund im Klartext:

| Caveat              | Auslöser                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `restricted-code`   | Barcode aus dem GS1-Bereich für Handels-Eigencodes (EAN-8 mit 0/2, Präfix 020–029, 040–049, 200–299). Solche Codes sind nicht weltweit eindeutig – der Treffer kann ein anderes Produkt sein. |
| `checksum-mismatch` | GS1-Prüfziffer passt nicht: Fehlscan oder kein Standard-Barcode.    |
| `traces-unknown`    | Der Datensatz hat gar kein `traces`-Feld. Fehlende Spurenangabe ist keine geprüfte Spurenfreiheit. |

Vorbehalte können ein Ergebnis nur **abwerten**: an `JA` und `SPUREN` werden sie
nie angehängt, und aus `KEINE_DATEN` wird nie etwas Grüneres.

### Packungs-Gegencheck (`lib/packmatch.ts`)

Ob ein Datensatz überhaupt das Produkt in der Hand beschreibt, kann die App
nicht wissen — der Mensch davor schon. Bei einem Identitäts-Vorbehalt
(`restricted-code`, `checksum-mismatch`) zeigt das Ergebnis deshalb das
Datenbank-Foto groß und fragt: **„Passt das zu deiner Packung?"**

- **Ja** → der Identitäts-Vorbehalt ist erledigt, das Ergebnis wird grün
  (sofern nichts anderes dagegen spricht).
- **Nein** → der Eintrag gehört zu einem anderen Produkt, das Ergebnis fällt auf
  `KEINE_DATEN` zurück.

Die Antwort wird pro Barcode lokal gemerkt (`peanot.packmatch.v1`, max. 200
Einträge), gilt also beim nächsten Scan desselben Codes sofort — auch im
Verlauf. Gefragt wird nur bei Identitäts-Vorbehalt, damit die Frage nicht zur
Reflex-Bestätigung verkommt. Auch hier gilt fail-safe: eine Antwort kann ein
`JA`/`SPUREN` niemals entkräften. Ein **Ja** verfällt nach 90 Tagen und wird
dann erneut gefragt — Handels-Eigencodes sind genau dafür berüchtigt, dass
derselbe Code später ein anderes Produkt bezeichnet. Ein **Nein** gilt fort,
bis es zurückgenommen wird (fail-safe).

Wo peaNOT sagt, dass seine Daten falsch oder unvollständig sind, verlinkt es den
Eintrag bei Open Food Facts (`lib/off/link.ts`) — bei gemeldeter Abweichung zum
Prüfen, bei fehlender Spurenangabe zum Ergänzen. Korrekturen landen so dort, wo
sie dem nächsten Menschen mit demselben Code helfen.

### Rückruf-Abgleich (`lib/recalls/`)

Nicht deklarierte Allergene sind einer der häufigsten Gründe für amtliche
Lebensmittel-Rückrufe — genau der Fall, den keine Zutatenliste der Welt
abfängt. Deshalb gleicht die API jeden Treffer zusätzlich gegen die aktuellen
Meldungen von [lebensmittelwarnung.de](https://www.lebensmittelwarnung.de)
ab (amtliches Portal der Bundesländer und des BVL; REST-Schnittstelle wie bei
[bund.dev](https://github.com/bundesAPI/lebensmittelwarnung-api) dokumentiert,
inklusive des dort veröffentlichten statischen Zugriffsschlüssels).

Amtliche Meldungen nennen Produktnamen, keine Barcodes. Der Abgleich läuft
deshalb über den Namen und die Marke aus dem Open-Food-Facts-Datensatz
(`lib/recalls/match.ts`) und ist bewusst **warn-only**:

- Ein Namens-Treffer zeigt eine rote Karte „Rückruf könnte dieses Produkt
  betreffen" mit Link zur amtlichen Meldung — das Verdict (JA/NEIN/…) ändert
  er nie, denn der Abgleich kann irren. Prüfen muss der Mensch: Meldung
  öffnen, Charge und MHD vergleichen.
- Kein Treffer heißt nur „kein Namens-Treffer im Abgleichsfenster
  (180 Tage)", nie „kein Rückruf existiert". Das Ergebnis zeigt das als
  dezente Statuszeile, nicht als Entwarnung.
- Ist das Portal nicht erreichbar, sagt die Statuszeile auch das — still
  scheitern würde ein grünes Ergebnis vertrauenswürdiger aussehen lassen,
  als es ist.

Ein einzelnes generisches Wort („Erdnüsse") reicht nie für einen Treffer:
verlangt wird ein Großteil des Produktnamens, mit niedrigerer Schwelle, wenn
zusätzlich die Marke in der Meldung auftaucht. Die Warnliste wird serverseitig
gecacht (`LMW_REVALIDATE_S`), sodass Scans das Portal nicht pro Anfrage
treffen.

### Lese-Hilfe bei KEINE_DATEN (`lib/allergens/checklist.ts`)

Bei `KEINE_DATEN` — echt fehlende Daten oder ein per Packungs-Gegencheck
verworfener Treffer — bleibt nur die Zutatenliste in der Hand. Eine
aufklappbare Checkliste „Diese Begriffe bedeuten Erdnuss" zeigt dafür genau
die Wörter, nach denen peaNOT selbst sucht (`textKeywords` aus
`lib/allergens/profile.ts`, dieselbe Liste wie in der Erkennung), aufbereitet
und groß genug für den Abgleich mit der Packung. Kein OCR, kein eigener
Verdict: reine Lesehilfe für die menschliche Prüfung, die die App ohnehin
verlangt.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (alle Tests)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
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

## Allergie-Karte (mehrsprachig)

Über das Karten-Symbol in der oberen Leiste (Scan/Verlauf/Profil — ein Tap von
überall) sowie den Button **„Allergie-Karte zeigen"** (Scan-Screen) erreichbar:
eine Karte zum Vorzeigen vor Ort mit einem vorformulierten Satz, der die
gewählte Allergie erklärt und um eine sichere Auswahl ohne Verunreinigung
bittet. Auswählbar nach Ort (Eisdiele, Restaurant, Bäckerei & Café, Kita &
Schule, Allgemein) und Sprache (16 gängige Reise-/Weltsprachen, inkl. RTL für
Arabisch). Die Startsprache richtet sich nach der Gerätesprache; „Groß
anzeigen" zeigt den Satz bildschirmfüllend, hält per Wake Lock (wo unterstützt)
den Bildschirm wach und schließt nur über den eigenen Schließen-Button oder
Escape — nie durch versehentliches Antippen.

Texte liegen in `lib/phrases.ts`; `lib/phrases.test.ts` stellt sicher, dass jede
gelistete Sprache jeden Kern-Ort abdeckt (keine stillen Lücken). „Kita &
Schule" ist bisher nur auf Deutsch/Englisch übersetzt — jede andere Sprache
fällt dafür bewusst auf ihren eigenen „Allgemein"-Satz zurück (dokumentiert in
`OPTIONAL_VENUE_LANGS`, ebenfalls testabgedeckt), nie auf eine fremde Sprache
oder auf Stille. Übersetzungen sind eine Hilfe, keine Garantie.

Optional lässt sich unterhalb der Karte ein **eigener Zusatz** eintragen (z. B.
„Adrenalin-Pen ist im Rucksack") — reiner Freitext, lokal in
`prefs.cardNote` gespeichert, nie übersetzt und auf der Karte klar vom
geprüften Satz abgesetzt.

## Verlauf & Einstellungen (lokal, ohne Konto)

Scan-Verlauf und Einstellungen (Akzentfarbe, Vibrieren/Ton bei Treffer,
Spuren-Strikt) liegen ausschließlich im Browser des Geräts (`localStorage`,
Keys `peanot.history.v1` / `peanot.prefs.v1`). Kein Account, kein Server-State –
„Leeren" entfernt den Verlauf wieder.

### Scanner: automatischer Start, Zoom (`components/BarcodeScanner.tsx`)

Standardmäßig startet die Kamera erst nach Tap auf **„Kamera starten"**. Wer
in Profil → Scanner **„Kamera beim Öffnen automatisch starten"** einschaltet,
bekommt die Kamera sofort beim Öffnen des Scan-Screens — das iPhone fragt
trotzdem bei jedem Start kurz nach Zugriff, das lässt sich app-seitig nicht
abstellen (iOS merkt sich Kamera-Berechtigungen für installierte
Home-Screen-Apps nicht). Damit ein Frühscan (Kamera zeigt noch Hosentasche
oder Tisch) nicht sofort ein Ergebnis auslöst, ignoriert der Scanner
Treffer für die ersten ~800ms, nachdem das Bild zu laufen beginnt — und zwar
bei beiden Startwegen, manuellem Tap wie Auto-Start gleichermaßen.

Unterstützt die Kamera optischen/digitalen Zoom (`getCapabilities().zoom`),
erscheint neben dem Blitzlicht-Knopf ein kleiner **1×/2×**-Umschalter
(`track.applyConstraints`); ohne diese Fähigkeit bleibt er unsichtbar, ein
Fehlschlag beim Umschalten wird still ignoriert.

### Notiz pro Produkt (`lib/notes.ts`)

Im Ergebnis lässt sich pro Barcode eine kurze eigene Notiz hinterlegen (z. B.
„Sorte Schoko okay, Crunchy nicht" oder „Reaktion 2024") — lokal gespeichert
(`peanot.notes.v1`, max. 200 Einträge, gleiche Machart wie
`lib/packmatch.ts`) und im Verlauf als Vorschauzeile sichtbar. Rein
informativ: Eine Notiz wird an keiner Stelle gelesen, die ein Verdict
berechnet, und kann ein Ergebnis nie beeinflussen.

### Favoriten (`lib/favorites.ts`)

Der Alltag einer Allergiker-Familie besteht meist aus denselben 10–20
Produkten. Ein Stern (Ergebnis-Kopfzeile, Verlaufszeile) merkt sich ein
Produkt als Staple — lokal (`peanot.favorites.v1`, max. 50 Einträge,
gleiche Machart wie `lib/notes.ts`/`lib/packmatch.ts`) mit Name, Marke,
letztem Verdict und Prüfzeitpunkt. Die Favoriten erscheinen als eigene
Zeile oberhalb von „Zuletzt geprüft" auf dem Scan-Screen; ein Tipp darauf
löst den ganz normalen Prüf-Vorgang erneut aus (kein Cache-Anzeige), sodass
sich vor dem Einkauf mit einem Tipp bestätigen lässt, dass ein Staple noch
grün ist — kombiniert mit der Änderungs-Warnung oben genau der Fall, den das
README selbst benennt (Rezeptur kann sich bei gleicher EAN ändern). Rein
informativ: Der gespeicherte Verdict wird nirgends gelesen, das ein Ergebnis
berechnet, nur nach jedem echten Check aktualisiert.

### Ergebnis teilen (`lib/share.ts`)

Der **„Teilen"**-Button (Ergebnis-Kopfzeile) öffnet das native Teilen-Sheet
(`navigator.share`, z. B. AirDrop/Nachrichten) mit Produktname, Marke, EAN,
dem Verdict-Label **inklusive** Vorbehalts-Formulierung (nie ein blankes
„sicher") und dem Link zum Open-Food-Facts-Eintrag. Ohne Web-Share-API (oder
bei fehlenden Zielen) landet derselbe Text stattdessen in der Zwischenablage,
mit kurzer Bestätigung auf dem Screen — derselbe Zwei-Stufen-Fallback wie
beim Export (F1).

### Export & Import (`lib/backup.ts`)

Da alle Daten nur lokal liegen, ersetzt ein manueller Export den fehlenden
Familien-Sync: **„Exportieren"** (Profil → Daten) baut eine JSON-Datei aus
Verlauf, Notizen, Packungs-Antworten und Einstellungen
(`{format:"peanot-export", v:1, …}`) und übergibt sie per Web-Share-Sheet
(z. B. AirDrop aufs zweite Familien-Handy) oder, falls nicht verfügbar, als
Direkt-Download. Favoriten (`peanot.favorites.v1`) sind (noch) nicht Teil
dieser Datei — sie leben aktuell nur auf dem Gerät, auf dem sie angelegt
wurden.

**„Importieren"** liest eine solche Datei und **merged** statt zu
überschreiben:

- Verlauf: dedupliziert nach ID (Fallback Barcode+Zeitstempel), bei Konflikt
  gewinnt der neuere Eintrag.
- Notizen: rein additiv, bei Konflikt gewinnt die neuer bearbeitete Notiz.
- Packungs-Antworten: additiv, aber **fail-safe** — da eine Antwort ein
  Verdict verändern kann (siehe Packungs-Gegencheck oben), gewinnt bei einem
  Konflikt immer „Nein" gegen „Ja", unabhängig vom Zeitstempel. Ein Import
  kann einen bereits verworfenen Datensatz also nie wieder grün machen.
- Einstellungen werden **nie automatisch** übernommen — erst nach expliziter
  Bestätigung, da sie u. a. `tracesStrict` und die geprüften Allergene
  enthalten.

Die reinen Merge-Funktionen sind in `lib/backup.ts` gekapselt und ohne
localStorage/DOM testbar (`lib/backup.test.ts`).

### Notfallplan (`lib/emergency.ts`)

Über **„Notfallplan"** (Scan-Screen, neben „Allergie-Karte zeigen", sowie
Profil → „Für den Notfall") erreichbar: ein Anrufknopf für **112**, eine
editierbare Schrittliste für den familieneigenen
Adrenalin-Autoinjektor-Notfallplan und ein Freitextfeld für Medikament, Dosis
und Notfallset-Ort. Gedacht auch für Oma, Babysitter oder die Lehrkraft, denen
man im Ernstfall das Handy in die Hand drückt.

Die Schrittliste startet mit einer allgemeinen, unverbindlichen
Beispiel-Vorlage — bewusst keine medizinische Anweisung der App. Die Familie
muss sie einmal **bestätigen** (unverändert übernehmen) oder **bearbeiten**
und speichern, bevor sie als „ihr eigener Plan" gilt (`confirmed`); bis dahin
öffnet der Screen direkt im Bearbeiten-Modus. Gespeichert wird lokal in
`prefs.emergencyPlan` (`peanot.prefs.v1`), wie `prefs.cardNote` rein
informativ und an keiner Stelle mit Verdict-Logik verbunden.

## Architektur

- `lib/allergens/` – reine, getestete Erdnuss-Erkennung (über `AllergenProfile`
  auf weitere Allergene erweiterbar) inkl. `labels` (Allergen-Tags → Labels),
  `evidence` (Erdnuss-Fundstelle im Zutatentext) und `checklist` (Lese-Hilfe-
  Begriffe je Allergen, aus denselben `textKeywords`).
- `lib/off/` – serverseitiger Open-Food-Facts-Client (setzt User-Agent) + defensive Normalisierung.
- `lib/recalls/` – Client für lebensmittelwarnung.de, namensbasierter
  Rückruf-Abgleich (warn-only) und `checkRecalls`-Fassade für die Route.
- `lib/theme.ts`, `lib/verdict.ts`, `lib/time.ts` – Palette, Status→Verdict-Mapping, relative Zeiten.
- `lib/packmatch.ts`, `lib/notes.ts`, `lib/favorites.ts` – lokale Stores
  (Gegencheck-Antwort, Notiz bzw. Favorit), gleiche Machart (localStorage,
  Cap, defensives Parsen).
- `lib/emergency.ts` – Default-Vorlage und Typ für den familieneigenen
  Notfallplan (F4); gespeichert in `prefs.emergencyPlan`, nicht in einem
  eigenen Store.
- `lib/share.ts` – reiner Text-Baustein für „Teilen" (F6), aus den bereits
  auf dem Ergebnis-Screen angezeigten Strings zusammengesetzt.
- `lib/backup.ts` – reine Parse-/Merge-Logik für Export/Import (F1); die
  eigentlichen localStorage-Zugriffe bleiben bei den Stores, die sie schon
  besitzen (`components/useHistory.ts`, `lib/packmatch.ts`, `lib/notes.ts`).
- `app/api/product/[barcode]/route.ts` – API-Route, komponiert Client + Erkennung.
- `app/page.tsx` – Client-Router über die Screens (inkl. `notfall`-Route für
  `EmergencyScreen`).
- `components/` – `BarcodeScanner` (@zxing/browser), `ManualEntry`, geteilte
  UI-Atome (`ui.tsx`), `useHistory`/`usePrefs`/`useNote`/`useFavorites`
  (localStorage), `useBackup` (Export/Import-Orchestrierung) und `screens/`
  (inkl. `EmergencyScreen`, dem Notfallplan-Screen aus F4).

## Deployment (Vercel Hobby)

Repository in Vercel importieren – keine Umgebungsvariablen, keine Datenbank
nötig. Vercel liefert HTTPS (für die Kamera erforderlich). Die API-Route läuft
im Node-Runtime.

`next.config.mjs` setzt auf jeder Route `Permissions-Policy:
camera=(self), microphone=(), geolocation=()` (nur die Kamera wird gebraucht),
`X-Frame-Options: DENY` (nie in ein fremdes Iframe einbettbar) und
`X-Content-Type-Options: nosniff`.
