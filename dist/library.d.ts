export type Cell = string | number | boolean | null;
/** One library row: column name to cell. Every table but `sources` has `id` first and `source` last. */
export type LibraryRow = Record<string, Cell>;
export declare const validation: {
    oxygen_energy: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    equine_resting_vo2: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number)[][];
    };
    water_turnover: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    alcohol_peak: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    outbreak_records: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    crisis_thresholds: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    met_compendium: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    muscle_fatigue_data: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    vo2max_norms: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    working_hours: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    vitamin_c_depletion: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    sleep_homeostasis: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    oxygen_dissociation: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    blood_volume: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    gas_exposure_limits: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    rmr_measured: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    scurvy_consequences: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    plants_validation: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    excreta: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    gut_fermentation: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    energy_costs_growth_thermo_repro: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    tissue_turnover: {
        title: string;
        kind: string;
        conf: string;
        source: string;
        columns: string[];
        rows: (string | number | null)[][];
    };
    _about: string;
};
/** The library's file names (`physiology`, `nutrition`, ..., `sources`). */
export declare function libraryFiles(): string[];
/** The table names of a file. */
export declare function libraryTables(file: string): string[];
/** A table's rows as objects keyed by column name. The result is cached and shared: treat it as read-only. */
export declare function libraryTable(file: string, table: string): LibraryRow[];
/** A table's column names, in file order. */
export declare function libraryColumns(file: string, table: string): string[];
/** The table's own heading: title, kind (science, model, ...), confidence and source text. */
export declare function libraryMeta(file: string, table: string): {
    title: string;
    kind: string;
    conf: string;
    source: string;
};
/** One row by its stable id; throws when the id is not in the table. */
export declare function libraryRow(file: string, table: string, id: string): LibraryRow;
