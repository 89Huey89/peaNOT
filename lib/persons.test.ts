import { describe, expect, it } from "vitest";
import {
  addPersonToState,
  createPerson,
  createPersonId,
  getActivePerson,
  migratePersonsState,
  removePerson,
  renamePerson,
  setPersonAllergens,
  switchActivePerson,
  type Person,
  type PersonsState,
} from "@/lib/persons";

const FALLBACK = ["peanut"];

describe("createPersonId", () => {
  it("never returns the same id twice across many calls (collision-free)", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => createPersonId()));
    expect(ids.size).toBe(2000);
  });

  it("returns a non-empty string", () => {
    expect(createPersonId().length).toBeGreaterThan(0);
  });
});

describe("createPerson", () => {
  it("gives each created person a distinct id", () => {
    const a = createPerson("Anna");
    const b = createPerson("Ben");
    expect(a.id).not.toBe(b.id);
  });

  it("falls back to the neutral default name for a blank name", () => {
    expect(createPerson("   ").name).toBe("Ich");
  });
});

describe("migratePersonsState — legacy migration (no persons array yet)", () => {
  it("derives exactly one person from selectedAllergens, unchanged", () => {
    const state = migratePersonsState({ selectedAllergens: ["milk", "gluten"] }, FALLBACK);

    expect(state.persons).toHaveLength(1);
    expect(state.persons[0]!.allergens).toEqual(["milk", "gluten"]);
    expect(state.persons[0]!.name).toBe("Ich");
    expect(state.activePersonId).toBe(state.persons[0]!.id);
  });

  it("preserves the exact order and content of selectedAllergens (no reordering, no dedup surprises)", () => {
    const state = migratePersonsState({ selectedAllergens: ["gluten", "milk", "gluten"] }, FALLBACK);
    expect(state.persons[0]!.allergens).toEqual(["gluten", "milk", "gluten"]);
  });

  it("falls back to the caller-supplied default when selectedAllergens is missing entirely", () => {
    const state = migratePersonsState({ onboarded: true }, FALLBACK);
    expect(state.persons[0]!.allergens).toEqual(["peanut"]);
  });

  it("falls back to the caller-supplied default when selectedAllergens was genuinely empty", () => {
    const state = migratePersonsState({ selectedAllergens: [] }, FALLBACK);
    // Empty is the one case migration must never let stand — a person with
    // no allergens is a person for whom nothing would ever be detected.
    expect(state.persons[0]!.allergens).toEqual(["peanut"]);
  });

  it("drops non-string garbage inside a legacy selectedAllergens array", () => {
    const state = migratePersonsState({ selectedAllergens: ["milk", 5, null] }, FALLBACK);
    expect(state.persons[0]!.allergens).toEqual(["milk"]);
  });
});

describe("migratePersonsState — corrupted/broken input never leaves the app without an active person", () => {
  it("handles a completely empty stored object", () => {
    const state = migratePersonsState({}, FALLBACK);
    expect(state.persons.length).toBeGreaterThanOrEqual(1);
    expect(state.persons.some((p) => p.id === state.activePersonId)).toBe(true);
  });

  it("handles null", () => {
    const state = migratePersonsState(null, FALLBACK);
    expect(state.persons.length).toBeGreaterThanOrEqual(1);
  });

  it("handles a string instead of an object", () => {
    const state = migratePersonsState("not an object", FALLBACK);
    expect(state.persons.length).toBeGreaterThanOrEqual(1);
  });

  it("handles an array instead of an object", () => {
    const state = migratePersonsState(["oops"], FALLBACK);
    expect(state.persons.length).toBeGreaterThanOrEqual(1);
  });

  it("treats an empty persons array the same as no persons array (falls back to selectedAllergens)", () => {
    const state = migratePersonsState({ persons: [], selectedAllergens: ["milk"] }, FALLBACK);
    expect(state.persons).toHaveLength(1);
    expect(state.persons[0]!.allergens).toEqual(["milk"]);
  });

  it("drops individually corrupted person entries but keeps the valid ones", () => {
    const state = migratePersonsState(
      {
        persons: [
          { id: "a", name: "Anna", allergens: ["milk"] },
          { id: "b", name: "Ben", allergens: "not-an-array" },
          null,
          "garbage",
          42,
        ],
        activePersonId: "a",
      },
      FALLBACK,
    );
    expect(state.persons).toEqual([{ id: "a", name: "Anna", allergens: ["milk"] }]);
  });

  it("falls back to selectedAllergens when every stored person entry is corrupted", () => {
    const state = migratePersonsState(
      { persons: [{ allergens: "nope" }, null], selectedAllergens: ["gluten"] },
      FALLBACK,
    );
    expect(state.persons).toHaveLength(1);
    expect(state.persons[0]!.allergens).toEqual(["gluten"]);
  });

  it("invents a stable id for a stored person missing one", () => {
    const state = migratePersonsState(
      { persons: [{ name: "Anna", allergens: ["milk"] }] },
      FALLBACK,
    );
    expect(state.persons[0]!.id.length).toBeGreaterThan(0);
  });

  it("invents a fallback name for a stored person missing one", () => {
    const state = migratePersonsState(
      { persons: [{ id: "a", allergens: ["milk"] }] },
      FALLBACK,
    );
    expect(state.persons[0]!.name.length).toBeGreaterThan(0);
  });

  it("never keeps a valid stored person at an empty allergen list — bumps to the fallback default", () => {
    const state = migratePersonsState(
      { persons: [{ id: "a", name: "Anna", allergens: [] }], activePersonId: "a" },
      FALLBACK,
    );
    expect(state.persons[0]!.allergens).toEqual(["peanut"]);
  });
});

describe("migratePersonsState — activePersonId pointing nowhere falls back to the first person", () => {
  it("falls back when activePersonId matches no stored person", () => {
    const state = migratePersonsState(
      {
        persons: [
          { id: "a", name: "Anna", allergens: ["milk"] },
          { id: "b", name: "Ben", allergens: ["gluten"] },
        ],
        activePersonId: "does-not-exist",
      },
      FALLBACK,
    );
    expect(state.activePersonId).toBe("a");
  });

  it("falls back when activePersonId is missing entirely", () => {
    const state = migratePersonsState(
      { persons: [{ id: "a", name: "Anna", allergens: ["milk"] }] },
      FALLBACK,
    );
    expect(state.activePersonId).toBe("a");
  });

  it("falls back when activePersonId is not a string", () => {
    const state = migratePersonsState(
      { persons: [{ id: "a", name: "Anna", allergens: ["milk"] }], activePersonId: 5 },
      FALLBACK,
    );
    expect(state.activePersonId).toBe("a");
  });

  it("keeps a valid activePersonId untouched", () => {
    const state = migratePersonsState(
      {
        persons: [
          { id: "a", name: "Anna", allergens: ["milk"] },
          { id: "b", name: "Ben", allergens: ["gluten"] },
        ],
        activePersonId: "b",
      },
      FALLBACK,
    );
    expect(state.activePersonId).toBe("b");
  });
});

describe("migratePersonsState — idempotent on an already-valid modern state", () => {
  it("passes a well-formed persons state through unchanged in content", () => {
    const input = {
      persons: [
        { id: "a", name: "Anna", allergens: ["milk"] },
        { id: "b", name: "Ben", allergens: ["gluten", "soy"] },
      ],
      activePersonId: "b",
    };
    const state = migratePersonsState(input, FALLBACK);
    expect(state).toEqual(input);
  });
});

describe("getActivePerson", () => {
  it("returns the person matching activePersonId", () => {
    const state: PersonsState = {
      persons: [
        { id: "a", name: "Anna", allergens: ["milk"] },
        { id: "b", name: "Ben", allergens: ["gluten"] },
      ],
      activePersonId: "b",
    };
    expect(getActivePerson(state).name).toBe("Ben");
  });

  it("falls back to the first person if activePersonId is somehow stale", () => {
    const state: PersonsState = {
      persons: [{ id: "a", name: "Anna", allergens: ["milk"] }],
      activePersonId: "ghost",
    };
    expect(getActivePerson(state).id).toBe("a");
  });
});

function twoPeople(): PersonsState {
  return {
    persons: [
      { id: "a", name: "Anna", allergens: ["milk"] },
      { id: "b", name: "Ben", allergens: ["gluten"] },
    ],
    activePersonId: "a",
  };
}

describe("addPersonToState", () => {
  it("seeds the new person from the given list and makes them active", () => {
    const state = addPersonToState(twoPeople(), "Chris", ["peanut", "milk"]);
    expect(state.persons).toHaveLength(3);
    const added = state.persons[2]!;
    expect(added.name).toBe("Chris");
    expect(added.allergens).toEqual(["peanut", "milk"]);
    expect(state.activePersonId).toBe(added.id);
  });

  // Der Grund für den Pflichtparameter: Eine neue Person ist ab dem Anlegen
  // sofort aktiv. Startete sie leer, prüfte die App bis zur ersten Auswahl
  // gegen den Fallback der API, und migratePersonsState füllte die Lücke beim
  // nächsten Laden still mit dem globalen Default — worauf für diese Person
  // geprüft wird, hätte dann nie ein Mensch entschieden.
  it("never leaves the newly activated person with an empty list", () => {
    const state = addPersonToState(twoPeople(), "Chris", ["peanut"]);
    const active = state.persons.find((p) => p.id === state.activePersonId)!;
    expect(active.allergens.length).toBeGreaterThan(0);
  });

  it("copies the seed instead of aliasing it", () => {
    const seed = ["peanut"];
    const state = addPersonToState(twoPeople(), "Chris", seed);
    seed.push("milk");
    expect(state.persons[2]!.allergens).toEqual(["peanut"]);
  });

  it("does not mutate the input persons array", () => {
    const before = twoPeople();
    const snapshot = [...before.persons];
    addPersonToState(before, "Chris", ["peanut"]);
    expect(before.persons).toEqual(snapshot);
  });
});

describe("switchActivePerson", () => {
  it("switches to an existing person", () => {
    const state = switchActivePerson(twoPeople(), "b");
    expect(state.activePersonId).toBe("b");
  });

  it("is a no-op (same reference) for an unknown id", () => {
    const before = twoPeople();
    const after = switchActivePerson(before, "ghost");
    expect(after).toBe(before);
  });

  it("is a no-op (same reference) when already active", () => {
    const before = twoPeople();
    const after = switchActivePerson(before, "a");
    expect(after).toBe(before);
  });
});

describe("renamePerson", () => {
  it("renames the matching person only", () => {
    const persons: Person[] = [
      { id: "a", name: "Anna", allergens: ["milk"] },
      { id: "b", name: "Ben", allergens: ["gluten"] },
    ];
    const next = renamePerson(persons, "a", "Annika");
    expect(next[0]!.name).toBe("Annika");
    expect(next[1]!.name).toBe("Ben");
  });

  it("trims whitespace", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: [] }];
    expect(renamePerson(persons, "a", "  Annika  ")[0]!.name).toBe("Annika");
  });

  it("is a no-op (same reference) for a blank name", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: [] }];
    expect(renamePerson(persons, "a", "   ")).toBe(persons);
  });

  it("is a no-op (same reference) for an unknown id", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: [] }];
    expect(renamePerson(persons, "ghost", "Neu")).toBe(persons);
  });
});

describe("setPersonAllergens", () => {
  it("replaces (not merges) the matching person's allergens", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: ["milk"] }];
    expect(setPersonAllergens(persons, "a", ["peanut", "soy"])[0]!.allergens).toEqual([
      "peanut",
      "soy",
    ]);
  });

  it("allows clearing down to an empty list — the UI's call, not this module's", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: ["milk"] }];
    expect(setPersonAllergens(persons, "a", [])[0]!.allergens).toEqual([]);
  });

  it("is a no-op (same reference) for an unknown id", () => {
    const persons: Person[] = [{ id: "a", name: "Anna", allergens: [] }];
    expect(setPersonAllergens(persons, "ghost", ["milk"])).toBe(persons);
  });
});

describe("removePerson", () => {
  it("removes a non-active person, keeping the active one untouched", () => {
    const state = removePerson(twoPeople(), "b");
    expect(state.persons.map((p) => p.id)).toEqual(["a"]);
    expect(state.activePersonId).toBe("a");
  });

  it("falls back to the first remaining person when the active one is removed", () => {
    const state = removePerson(twoPeople(), "a");
    expect(state.persons.map((p) => p.id)).toEqual(["b"]);
    expect(state.activePersonId).toBe("b");
  });

  it("refuses to remove the last remaining person (same reference back)", () => {
    const onePerson: PersonsState = {
      persons: [{ id: "a", name: "Anna", allergens: ["milk"] }],
      activePersonId: "a",
    };
    expect(removePerson(onePerson, "a")).toBe(onePerson);
  });

  it("is a no-op (same reference) for an unknown id", () => {
    const before = twoPeople();
    expect(removePerson(before, "ghost")).toBe(before);
  });
});
