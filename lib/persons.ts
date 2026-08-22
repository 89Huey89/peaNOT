/**
 * F — Personen mit eigenen Allergenen. Vorher gab es genau eine
 * Allergen-Auswahl fürs ganze Gerät (`prefs.selectedAllergens`); Familien mit
 * mehreren Betroffenen (oder wer für ein Kita-Kind mitprüft) brauchen einen
 * Umschalter statt einer Sammelliste, damit ein Ergebnis sagen kann, für WEN
 * es gilt.
 *
 * Festgelegtes Modell: es gibt immer genau EINE aktive Person. Ein Ergebnis
 * gilt immer nur für sie. Für eine zweite Person schaltet man um und prüft
 * erneut — kein Gleichzeitig-Modus, keine Vereinigungsmenge über mehrere
 * Personen, weil eine Vereinigungsmenge wieder das ursprüngliche Problem
 * hätte: ein "sicher" das eigentlich nur für eine der beiden Personen stimmt.
 *
 * Dieses Modul ist bewusst reine Logik ohne localStorage-Zugriff (wie
 * lib/favorites.ts, lib/notes.ts, lib/backup.ts) — components/usePrefs.ts
 * verdrahtet es mit der echten Persistenz.
 */

/** Eine Person mit ihrer eigenen Allergen-Auswahl. */
export interface Person {
  id: string;
  name: string;
  /** Allergen-Keys (siehe lib/allergens/profile.ts), die für GENAU diese
   * Person geprüft werden. */
  allergens: string[];
}

/** `persons` + `activePersonId` als ein zusammengehöriges Paar — die beiden
 * Felder müssen immer gemeinsam betrachtet werden (eine aktive Person, die
 * es auch wirklich gibt), nie einzeln. */
export interface PersonsState {
  persons: Person[];
  activePersonId: string;
}

/** Neutraler Standardname für die erste, aus einer alten Einzel-Auswahl
 * migrierte Person — bewusst nicht "Familie" o.ä., weil die App genauso oft
 * von einer einzelnen Person für sich selbst genutzt wird. */
export const DEFAULT_PERSON_NAME = "Ich";

// --- ID-Erzeugung --------------------------------------------------------
//
// Personen-IDs identifizieren, WESSEN Allergen-Liste gerade bearbeitet oder
// geprüft wird. Eine Kollision zweier IDs wäre kein kosmetischer Bug, sondern
// ein Sicherheitsproblem: setPersonAllergens/renamePerson/removePerson
// arbeiten über `persons.find/filter(p => p.id === id)`, und würde eine neu
// angelegte Person zufällig dieselbe ID wie eine bestehende bekommen, würde
// deren Allergen-Liste beim nächsten Bearbeiten still überschrieben — man
// prüft weiter unter Annas Namen, tatsächlich aber mit Bens (überschriebener)
// Liste. Ein einzelner `Math.random()`-Aufruf (wie an mancher Stelle in
// dieser Art App für rein kosmetische IDs verwendet) hat nur ~52 Bit Entropie
// und keinerlei Kollisionsschutz.
//
// Deshalb: bevorzugt `crypto.randomUUID()` (in jedem Browser seit iOS 15.4
// und in jsdom/Node verfügbar, 122 Bit Zufall, für praktische Zwecke
// kollisionsfrei). Nur wenn diese API fehlen sollte (sehr alter Browser,
// eingeschränkte Umgebung), ein Fallback, der Zeitstempel + einen
// monoton steigenden Zähler + einen Zufallsanteil kombiniert: der Zähler
// macht zwei IDs, die in derselben Millisekunde in DIESEM Tab entstehen,
// garantiert verschieden (das ist der Fall, den ein nackter `Math.random()`
// am ehesten kollidieren lässt — z. B. zwei schnelle Taps auf "Person
// hinzufügen"), der Zufallsanteil verschieden IDs über Tabs/Geräte hinweg.
let fallbackIdCounter = 0;

export function createPersonId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackIdCounter = (fallbackIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  const time = Date.now().toString(36);
  const counter = fallbackIdCounter.toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `p_${time}_${counter}_${random}`;
}

/** Legt eine neue Person an. `allergens` ist bewusst optional/leer erlaubt
 * hier auf Modell-Ebene — ob die UI eine Person mit leerer Liste zulässt
 * (z. B. direkt nach dem Anlegen, bevor man ihre Allergene ausgewählt hat),
 * entscheidet components/screens/ProfileScreen.tsx; Migration (unten)
 * verhindert es dagegen konsequent, weil dort niemand mehr aktiv "in
 * Ordnung" bestätigen kann, wenn plötzlich nichts mehr geprüft wird. */
export function createPerson(name: string, allergens: string[] = []): Person {
  const trimmed = name.trim();
  return { id: createPersonId(), name: trimmed || DEFAULT_PERSON_NAME, allergens: [...allergens] };
}

/** Die aktive Person aus einem (gültigen) PersonsState. Fällt defensiv auf
 * die erste Person zurück, falls `activePersonId` einmal doch nicht passt —
 * das sollte dank migratePersonsState nie vorkommen, aber ein Leser dieser
 * Funktion soll sich nicht auf das Gegenteil verlassen müssen. */
export function getActivePerson(state: PersonsState): Person {
  return (
    state.persons.find((p) => p.id === state.activePersonId) ??
    // Falls persons selbst leer wäre (sollte laut Invarianten nie passieren
    // — migratePersonsState/removePerson garantieren mindestens einen
    // Eintrag), lieber eine sichere Person synthetisieren als `undefined`
    // als `Person` auszugeben.
    state.persons[0] ??
    createPerson(DEFAULT_PERSON_NAME, ["peanut"])
  );
}

// --- Sanitizing / Migration ----------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeAllergens(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

/** Ein einzelner Personen-Eintrag aus gespeicherten (potenziell kaputten)
 * Daten. Ein Eintrag, dessen `allergens`-Feld nicht mal die richtige Form hat
 * (kein Array), wird komplett verworfen statt mit einer geratenen Liste
 * wiederbelebt — für eine erfundene Liste gibt es keine sichere Grundlage,
 * und Punkt 2 unten sorgt dafür, dass trotzdem nie "gar keine Person" dabei
 * herauskommt. */
function sanitizePerson(raw: unknown, indexForFallbackName: number): Person | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const allergens = sanitizeAllergens(obj.allergens);
  if (allergens === null) return null;
  const id = isNonEmptyString(obj.id) ? obj.id : createPersonId();
  const name = isNonEmptyString(obj.name) ? obj.name : `Person ${indexForFallbackName + 1}`;
  return { id, name, allergens };
}

/** Nie eine leere Liste durchlassen — siehe migratePersonsState's
 * Klassenkommentar für die Sicherheitsbegründung. */
function ensureNonEmptyAllergens(allergens: string[], fallback: string[]): string[] {
  return allergens.length > 0 ? allergens : [...fallback];
}

/**
 * Leitet aus einem beliebigen (auch kaputten, auch alten) gespeicherten
 * Prefs-Objekt einen gültigen Personen-Zustand ab. Reine Funktion — kein
 * localStorage-Zugriff, komplett testbar mit Fixtures.
 *
 * Diese Funktion läuft bei JEDEM Laden (nicht nur beim ersten Start nach dem
 * Update), siehe components/usePrefs.ts's load()/importPrefs — sie ist damit
 * zugleich die einmalige Alt-zu-neu-Migration UND eine dauerhafte
 * Validierung gegen Datenkorruption.
 *
 * Zwei Sicherheitsregeln, die sich auf den ersten Blick widersprechen können,
 * aber bewusst verschiedene Fälle behandeln:
 *
 * 1. Gibt es (nach dem Filtern kaputter Einträge) KEINE gültige `persons`-
 *    Liste, ist die einzige verlässliche Information über "was wurde bisher
 *    geprüft" die alte Sammel-Liste `selectedAllergens`. Die wird dann EXAKT
 *    übernommen (keine Ergänzung, keine Kürzung) — eine Migration darf
 *    niemals still ändern, was ein Scan als Treffer meldet, sonst merkt
 *    niemand, dass sich die geprüften Allergene geändert haben.
 * 2. Eine Person mit leerer Allergen-Liste ist ein gültiges Datenmodell,
 *    aber ein gefährlicher Zustand: für sie würde nie irgendetwas erkannt,
 *    ein "sicher" wäre bedeutungslos. Die Migration lässt diesen Zustand
 *    nie stehen bleiben — weder für die frisch aus `selectedAllergens`
 *    abgeleitete Person (falls die selbst leer war oder fehlte) noch für
 *    eine bereits gespeicherte Person, deren Liste (aus welchem Grund auch
 *    immer) leer ist. Der Fallback ist dabei nie eine erfundene Liste,
 *    sondern der von der aufrufenden Seite übergebene App-weite Standard
 *    (`fallbackAllergens`, siehe components/usePrefs.ts's DEFAULT_PREFS).
 *
 * Regel 1 gilt für den WERT (exakte Kopie), Regel 2 nur für den
 * Entartungsfall "am Ende wäre gar nichts mehr ausgewählt".
 */
export function migratePersonsState(stored: unknown, fallbackAllergens: string[]): PersonsState {
  const obj: Record<string, unknown> =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  let persons: Person[] = Array.isArray(obj.persons)
    ? obj.persons
        .map((raw, i) => sanitizePerson(raw, i))
        .filter((p): p is Person => p !== null)
    : [];

  if (persons.length === 0) {
    // Keine (gültige) persons-Liste vorhanden — einzige Quelle ist die alte
    // Einzel-Auswahl. sanitizeAllergens statt einem rohen Array.isArray-Check,
    // damit auch ein Array mit z. B. Zahlen darin drin nicht 1:1 durchreicht.
    const legacy = sanitizeAllergens(obj.selectedAllergens) ?? [];
    persons = [createPerson(DEFAULT_PERSON_NAME, ensureNonEmptyAllergens(legacy, fallbackAllergens))];
  } else {
    persons = persons.map((p) =>
      p.allergens.length === 0
        ? { ...p, allergens: ensureNonEmptyAllergens(p.allergens, fallbackAllergens) }
        : p,
    );
  }

  // `persons` is non-empty at this point either way (the `if` branch just
  // above always assigns a fresh one-element array; the `else` branch only
  // runs when it already had at least one element) — but
  // noUncheckedIndexedAccess can't see that through the branch, so the `??`
  // fallback below exists purely to satisfy the type checker; it can never
  // actually run.
  const firstPersonId = persons[0]?.id ?? createPerson(DEFAULT_PERSON_NAME, fallbackAllergens).id;
  const activePersonId =
    isNonEmptyString(obj.activePersonId) && persons.some((p) => p.id === obj.activePersonId)
      ? (obj.activePersonId as string)
      : firstPersonId;

  return { persons, activePersonId };
}

// --- Verwaltungs-Aktionen (reine Funktionen) ------------------------------
//
// Jede Aktion unten ist eine reine Funktion: (bisheriger Zustand, ...) =>
// neuer Zustand. components/usePrefs.ts ruft sie auf und kümmert sich ums
// Schreiben/Persistieren; components/screens/ProfileScreen.tsx (das keinen
// Zugriff auf usePrefs' Aktionen hat, sondern nur auf `prefs`/`setPref`)
// ruft sie direkt auf und reicht das Ergebnis selbst über mehrere
// `setPref`-Aufrufe weiter. Ein No-op (ungültige ID, letzte Person
// entfernen) gibt bewusst dieselbe Objekt-Referenz zurück, damit Aufrufer
// mit `=== ` billig erkennen können, dass sich nichts geändert hat, statt
// einen identisch aussehenden, aber neuen Zustand unnötig zu persistieren.

/** Neue Person anhängen und sofort aktiv setzen — wer gerade eine Person
 * anlegt, will direkt danach ihre Allergene eintragen, und der bestehende
 * Allergen-Umschalter wirkt immer auf die aktive Person.
 *
 * `seedAllergens` ist bewusst ein Pflichtparameter, und Aufrufer geben dafür
 * die Liste der bisher aktiven Person mit. Eine leere Startliste wäre der
 * gefährlichere Weg gewesen: Die neue Person ist ab dem Anlegen sofort aktiv,
 * eine leere Auswahl lässt die API auf ihren eigenen Fallback zurückfallen,
 * und migratePersonsState hätte die Lücke beim nächsten Laden still mit dem
 * globalen Default gefüllt — der Mensch hätte also nie entschieden, worauf
 * für diese Person geprüft wird, und es nicht einmal gemerkt.
 *
 * Ein geerbter Startwert ist kein Raten: Er wird beim Anlegen angezeigt, ist
 * mit einem Tap änderbar, und im Zweifel warnt er zu viel statt zu wenig —
 * dieselbe Richtung, in die die ganze App fehlschlägt. */
export function addPersonToState(
  state: PersonsState,
  name: string,
  seedAllergens: string[],
): PersonsState {
  const person = createPerson(name, [...seedAllergens]);
  return { persons: [...state.persons, person], activePersonId: person.id };
}

/** Aktive Person wechseln. No-op (gleiche Referenz zurück), wenn `id` keine
 * bestehende Person trifft — schaltet nie auf "keine". */
export function switchActivePerson(state: PersonsState, id: string): PersonsState {
  if (state.activePersonId === id) return state;
  if (!state.persons.some((p) => p.id === id)) return state;
  return { ...state, activePersonId: id };
}

/** Person umbenennen. No-op (gleiche Referenz zurück) bei leerem Namen oder
 * unbekannter ID. */
export function renamePerson(persons: Person[], id: string, name: string): Person[] {
  const trimmed = name.trim();
  if (!trimmed) return persons;
  if (!persons.some((p) => p.id === id)) return persons;
  return persons.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
}

/** Allergene einer Person ersetzen (nicht ergänzen — der Aufrufer übergibt
 * die vollständige neue Liste, genau wie der bisherige
 * `setPref("selectedAllergens", next)`-Aufruf es für die alte Einzel-Auswahl
 * tat). Erlaubt hier bewusst eine leere Liste: die UI, nicht dieses Modul,
 * entscheidet, ob/wie sie davor warnt (siehe ProfileScreen); nur die
 * Migration oben verhindert, dass so ein Zustand einen Reload übersteht. */
export function setPersonAllergens(persons: Person[], id: string, allergens: string[]): Person[] {
  if (!persons.some((p) => p.id === id)) return persons;
  return persons.map((p) => (p.id === id ? { ...p, allergens: [...allergens] } : p));
}

/** Person entfernen. No-op (gleiche Referenz zurück), wenn `id` unbekannt
 * ist ODER es die letzte verbliebene Person wäre — die App darf nie in
 * einen Zustand geraten, in dem niemand mehr aktiv ist und nichts mehr
 * geprüft werden kann. War die entfernte Person die aktive, übernimmt die
 * erste verbliebene Person diese Rolle. */
export function removePerson(state: PersonsState, id: string): PersonsState {
  if (state.persons.length <= 1) return state;
  const persons = state.persons.filter((p) => p.id !== id);
  if (persons.length === state.persons.length) return state; // id nicht gefunden
  // `persons` is non-empty here: state.persons.length >= 2 (checked above)
  // and exactly one entry was filtered out. The `??` fallback is just to
  // satisfy noUncheckedIndexedAccess; state.activePersonId is itself always
  // a valid id in a well-formed PersonsState, so it is a safe value to fall
  // back to even in principle.
  const activePersonId =
    state.activePersonId === id ? (persons[0]?.id ?? state.activePersonId) : state.activePersonId;
  return { persons, activePersonId };
}
