/**
 * The scientific data library, typed. `data/library/*.json` is the home of every table (README, "The library"); a module
 * reads a table here and never carries the number itself. A file is `{"_about": text, "<table>": {title, kind, conf,
 * source, columns, rows}}`; `libraryTable` returns a table's rows as objects keyed by column name, cached.
 */
import anatomy from "../data/library/anatomy.json" with { type: "json" };
import atmosphere from "../data/library/atmosphere.json" with { type: "json" };
import chemistry from "../data/library/chemistry.json" with { type: "json" };
import circulation from "../data/library/circulation.json" with { type: "json" };
import ecology from "../data/library/ecology.json" with { type: "json" };
import environment from "../data/library/environment.json" with { type: "json" };
import equipment from "../data/library/equipment.json" with { type: "json" };
import gasdynamics from "../data/library/gasdynamics.json" with { type: "json" };
import medicine from "../data/library/medicine.json" with { type: "json" };
import muscular from "../data/library/muscular.json" with { type: "json" };
import neurology from "../data/library/neurology.json" with { type: "json" };
import nutrition from "../data/library/nutrition.json" with { type: "json" };
import physiology from "../data/library/physiology.json" with { type: "json" };
import plants from "../data/library/plants.json" with { type: "json" };
import population from "../data/library/population.json" with { type: "json" };
import science from "../data/library/science.json" with { type: "json" };
import sources from "../data/library/sources.json" with { type: "json" };

export type Cell = string | number | boolean | null;
/** One library row: column name to cell. Every table but `sources` has `id` first and `source` last. */
export type LibraryRow = Record<string, Cell>;

interface RawTable { title: string; kind: string; conf: string; source: string; columns: string[]; rows: Cell[][] }
type RawFile = Record<string, RawTable | string>;

const FILES: Record<string, RawFile> = {
  anatomy, atmosphere, chemistry, circulation, ecology, environment, equipment, gasdynamics, medicine, muscular,
  neurology, nutrition, physiology, plants, population, science, sources,
} as unknown as Record<string, RawFile>;

const cache = new Map<string, LibraryRow[]>();

/** The library's file names (`physiology`, `nutrition`, ..., `sources`). */
export function libraryFiles(): string[] { return Object.keys(FILES); }

/** The table names of a file. */
export function libraryTables(file: string): string[] {
  const f = FILES[file];
  if (!f) throw new Error(`unknown library file ${file}`);
  return Object.keys(f).filter(k => !k.startsWith("_"));
}

function rawTable(file: string, table: string): RawTable {
  const f = FILES[file];
  if (!f) throw new Error(`unknown library file ${file}`);
  const t = f[table];
  if (table.startsWith("_") || typeof t !== "object" || !t) throw new Error(`unknown library table ${file}.${table}`);
  return t;
}

/** A table's rows as objects keyed by column name. The result is cached and shared: treat it as read-only. */
export function libraryTable(file: string, table: string): LibraryRow[] {
  const key = `${file}.${table}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = rawTable(file, table);
  const rows = t.rows.map(r => {
    const o: LibraryRow = {};
    t.columns.forEach((c, i) => { o[c] = r[i] ?? null; });
    return o;
  });
  cache.set(key, rows);
  return rows;
}

/** A table's column names, in file order. */
export function libraryColumns(file: string, table: string): string[] { return [...rawTable(file, table).columns]; }

/** The table's own heading: title, kind (science, model, ...), confidence and source text. */
export function libraryMeta(file: string, table: string): { title: string; kind: string; conf: string; source: string } {
  const { title, kind, conf, source } = rawTable(file, table);
  return { title, kind, conf, source };
}

/** One row by its stable id; throws when the id is not in the table. */
export function libraryRow(file: string, table: string, id: string): LibraryRow {
  const r = libraryTable(file, table).find(x => x.id === id);
  if (!r) throw new Error(`no row ${id} in ${file}.${table}`);
  return r;
}
