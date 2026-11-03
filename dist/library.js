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
import validationIndex from "../data/library/validation/index.json" with { type: "json" };
import oxygen_energy from "../data/library/validation/oxygen_energy.json" with { type: "json" };
import equine_resting_vo2 from "../data/library/validation/equine_resting_vo2.json" with { type: "json" };
import water_turnover from "../data/library/validation/water_turnover.json" with { type: "json" };
import alcohol_peak from "../data/library/validation/alcohol_peak.json" with { type: "json" };
import outbreak_records from "../data/library/validation/outbreak_records.json" with { type: "json" };
import crisis_thresholds from "../data/library/validation/crisis_thresholds.json" with { type: "json" };
import met_compendium from "../data/library/validation/met_compendium.json" with { type: "json" };
import muscle_fatigue_data from "../data/library/validation/muscle_fatigue_data.json" with { type: "json" };
import vo2max_norms from "../data/library/validation/vo2max_norms.json" with { type: "json" };
import working_hours from "../data/library/validation/working_hours.json" with { type: "json" };
import vitamin_c_depletion from "../data/library/validation/vitamin_c_depletion.json" with { type: "json" };
import sleep_homeostasis from "../data/library/validation/sleep_homeostasis.json" with { type: "json" };
import oxygen_dissociation from "../data/library/validation/oxygen_dissociation.json" with { type: "json" };
import blood_volume from "../data/library/validation/blood_volume.json" with { type: "json" };
import gas_exposure_limits from "../data/library/validation/gas_exposure_limits.json" with { type: "json" };
import rmr_measured from "../data/library/validation/rmr_measured.json" with { type: "json" };
import scurvy_consequences from "../data/library/validation/scurvy_consequences.json" with { type: "json" };
import plants_validation from "../data/library/validation/plants_validation.json" with { type: "json" };
import excreta from "../data/library/validation/excreta.json" with { type: "json" };
import gut_fermentation from "../data/library/validation/gut_fermentation.json" with { type: "json" };
import energy_costs_growth_thermo_repro from "../data/library/validation/energy_costs_growth_thermo_repro.json" with { type: "json" };
import tissue_turnover from "../data/library/validation/tissue_turnover.json" with { type: "json" };
const FILES = {
    anatomy, atmosphere, chemistry, circulation, ecology, environment, equipment, gasdynamics, medicine, muscular,
    neurology, nutrition, physiology, plants, population, science, sources,
};
// Independent references remain separate from the model library exposed by libraryFiles().
// The manifest preserves the original reference table order regardless of import order.
const validationTables = {
    oxygen_energy, equine_resting_vo2, water_turnover, alcohol_peak,
    outbreak_records, crisis_thresholds, met_compendium, muscle_fatigue_data,
    vo2max_norms, working_hours, vitamin_c_depletion, sleep_homeostasis,
    oxygen_dissociation, blood_volume, gas_exposure_limits, rmr_measured,
    scurvy_consequences, plants_validation, excreta, gut_fermentation,
    energy_costs_growth_thermo_repro, tissue_turnover,
};
export const validation = {
    _about: validationIndex._about,
    ...Object.fromEntries(validationIndex.tables.map(name => [name, validationTables[name]])),
};
const cache = new Map();
/** The library's file names (`physiology`, `nutrition`, ..., `sources`). */
export function libraryFiles() { return Object.keys(FILES); }
/** The table names of a file. */
export function libraryTables(file) {
    const f = FILES[file];
    if (!f)
        throw new Error(`unknown library file ${file}`);
    return Object.keys(f).filter(k => !k.startsWith("_"));
}
function rawTable(file, table) {
    const f = FILES[file];
    if (!f)
        throw new Error(`unknown library file ${file}`);
    const t = f[table];
    if (table.startsWith("_") || typeof t !== "object" || !t)
        throw new Error(`unknown library table ${file}.${table}`);
    return t;
}
/** A table's rows as objects keyed by column name. The result is cached and shared: treat it as read-only. */
export function libraryTable(file, table) {
    const key = `${file}.${table}`;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const t = rawTable(file, table);
    const rows = t.rows.map(r => {
        const o = {};
        t.columns.forEach((c, i) => { o[c] = r[i] ?? null; });
        return o;
    });
    cache.set(key, rows);
    return rows;
}
/** A table's column names, in file order. */
export function libraryColumns(file, table) { return [...rawTable(file, table).columns]; }
/** The table's own heading: title, kind (science, model, ...), confidence and source text. */
export function libraryMeta(file, table) {
    const { title, kind, conf, source } = rawTable(file, table);
    return { title, kind, conf, source };
}
/** One row by its stable id; throws when the id is not in the table. */
export function libraryRow(file, table, id) {
    const r = libraryTable(file, table).find(x => x.id === id);
    if (!r)
        throw new Error(`no row ${id} in ${file}.${table}`);
    return r;
}
