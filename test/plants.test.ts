import { describe, expect, it } from "vitest";
import { libraryTable, libraryTables } from "../src/library.ts";

const SPECIES_TAGS: Record<string, Set<string>> = {
  swietenia_mahagoni: new Set(["tree"]),
  saccharum_officinarum: new Set(["crop"]),
  rhizophora_mangle: new Set(["tree", "mangrove"]),
  thalassia_testudinum: new Set(["seagrass"]),
};

function appliesToSpecies(applies: string, tags: Set<string>): boolean {
  const parts = applies.split(",").map((p) => p.trim());
  if (parts.includes("all")) return true;
  return parts.some((p) => tags.has(p));
}

describe("plants library", () => {
  it("loads schema and four species tables", () => {
    const tables = libraryTables("plants");
    // research units add tables (forms, pollinators, fixture sites); require the scaffold's five (2943)
    expect(tables).toEqual(
      expect.arrayContaining([
        "rhizophora_mangle",
        "saccharum_officinarum",
        "schema",
        "swietenia_mahagoni",
        "thalassia_testudinum",
      ]),
    );
    for (const t of tables) {
      expect(libraryTable("plants", t).length, t).toBeGreaterThan(0);
    }
  });

  it("gives each species a row for every applicable schema field", () => {
    const schema = libraryTable("plants", "schema");
    for (const [table, tags] of Object.entries(SPECIES_TAGS)) {
      const rows = libraryTable("plants", table);
      const fields = new Set(rows.map((r) => String(r.Field)));
      for (const s of schema) {
        const applies = String(s["Applies to"]);
        const field = String(s.Field);
        if (appliesToSpecies(applies, tags)) {
          expect(fields.has(field), `${table} missing ${field}`).toBe(true);
        } else {
          expect(fields.has(field), `${table} must not have ${field}`).toBe(false);
        }
      }
      expect(fields.size).toBe(
        schema.filter((s) => appliesToSpecies(String(s["Applies to"]), tags)).length,
      );
    }
  });
});
