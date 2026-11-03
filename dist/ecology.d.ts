import type { Trace } from "./trace.ts";
import { SoilCell, NutrientLedger, type NutrientAmounts } from "./soils.ts";
export interface Stock {
    id: string;
    /** Biomass or head count, in the host's unit. */
    B: number;
    /** Carrying capacity, same unit. */
    K: number;
    /** Intrinsic growth rate per year. */
    r: number;
    /** Penned stock neither depletes by itself nor breeds (the turtle crawl row). */
    penned: boolean;
    /** Multiplier on r (nesting-beach take), until `rMultiplierUntilDay`. */
    rMultiplier: number;
    rMultiplierUntilDay: number | null;
    day: number;
}
export declare function createStock(id: string, B: number, K: number, r: number, o?: {
    penned?: boolean;
}): Stock;
/** Maximum sustainable yield per year of the Schaefer model: r K / 4, at B = K / 2. */
export declare const msyPerYear: (s: Pick<Stock, "r" | "K">) => number;
/** Fished out: B under this fraction of K (the row's 0.2). */
export declare const fishedOutFraction: () => number;
/** The catch multiplier on a fished-out ground (the row's x0.2). */
export declare const fishedOutCatchFactor: () => number;
export declare const isFishedOut: (s: Stock) => boolean;
/** Daily catch per fisher: q x effort x B / K, times the fished-out factor under 0.2 K. `q` is the host's (its Fishing skill). */
export declare function dailyCatch(s: Stock, q: number, effort: number): number;
export interface StockStep {
    growth: number;
    catch: number;
    unmet: number;
}
/** The overnight update B += r B (1 - B/K) / 365 - catch, one day. A catch beyond what stands is cut to B and the rest is
 * `unmet`; a penned stock does not grow. The transfers go to `trace` and the balance is checked. */
export declare function stepStock(s: Stock, catchAmount: number, trace?: Trace): StockStep;
/** Years for a logistic stock to go from fraction `from` of K to `to`: ln[(to/(1-to)) / (from/(1-from))] / r. */
export declare function logisticYears(r: number, from: number, to: number): number;
/** The recovery row: years from 0.2 K back to 0.8 K ("about 2.8/r"; the logistic gives ln 16 / r = 2.77/r). */
export declare const recoveryYears: (r: number) => number;
/** Years a stock fished at a constant `catchPerYear` takes to reach zero from B0, by the logistic curve. Only a catch above MSY
 * collapses; at exactly MSY the stock holds, below it settles. Returns null when the stock does not collapse. */
export declare function collapseYears(s: Pick<Stock, "r" | "K">, B0: number, catchPerYear: number): number | null;
/** Taking breeding females on the beach in the nesting season: r x0.5 for a decade (3,650 days). */
export declare function takeNestingFemales(s: Stock): void;
/** Food a crawl of N pens gives: N x the row's kg per turtle. */
export declare const crawlFoodKg: (n: number) => number;
export declare function stockOutputs(s: Stock): {
    "ecology.depletion_rules.overnight-stock-update": number;
    "ecology.depletion_rules.a-ground-is-fished-out": boolean;
    "ecology.depletion_rules.daily-catch-per-fisher.fill": number;
};
export interface Field {
    readonly id: string;
    readonly cell: SoilCell;
    readonly ledger: NutrientLedger;
    readonly f0: number;
    readonly pool0: Readonly<NutrientAmounts>;
    readonly f: number;
}
/** Former values only, retained for callers inspecting the superseded library row.
 * @deprecated Harvest uses nutrientRemoval, never this index drain. */
export declare function cropDemand(): Record<string, number>;
/** Host supplies the cell and may share a funded ledger. Default ledger has no inputs.
 * Positive reference pools are required to define pool/pool0; a depleted cell can be
 * reached through transfers after creation. f0 = 0 gives a permanently zero index. */
export declare function createField(id: string, f: number, cell: SoilCell, ledger?: NutrientLedger): Field;
/** Clearing forest assigns the row's f = 0.9 to the host's existing stock, without adding mass. */
export declare const clearForest: (id: string, cell: SoilCell, ledger?: NutrientLedger) => Field;
/** Explicit row ids (or slugs) select other measurements; legacy crop names use the
 * documented defaults. No fixed-N credit is invented for legumes (CG-7). */
export declare function nutrientRemoval(crop: string): NutrientAmounts;
export interface Harvest {
    yield: number;
    /** Change in the derived index, retained for compatibility; never a second debit. */
    drain: number;
    /** Nutrients exported in the yield (kg), soil debits (kg), and unmet soil demand (kg). */
    removal: NutrientAmounts;
    transferred: NutrientAmounts;
    shortfall: NutrientAmounts;
}
/** yield = maxYield x (0.3 + 0.7 f) x rain x labour, reading f before any transfer.
 * Host yields are tonnes of the harvested part on the selected nutrient_removal row's
 * basis (fresh stalk/root or dry grain/leaf), over this whole cell, not tonnes/ha.
 * uptakeByPlant means Life already debited uptake through transferNutrient; plant-to-crop
 * export is outside this soil ledger. Otherwise all elements move in one atomic batch. */
export declare function harvest(field: Field, crop: string, maxYield: number, rainFactor: number, labourFactor: number, trace?: Trace, day?: number, opts?: {
    uptakeByPlant?: boolean;
}): Harvest;
/** A dry year (rain under 60% of normal) halves yields; otherwise the table has no rain factor: null, the host's. */
export declare function dryYearFactor(rainFraction: number): number | null;
/** Apply whole-cell tonnes of fresh manure, debiting the host-funded manure account.
 * Default: Purdue beef-open-concrete-lot; opts.row selects another manure_nutrients row.
 * No implicit availability/loss fraction: explicit losses need their own transfer.
 * Returns the kg added; all mass remains even when the display index reaches 1. */
export declare function manure(field: Field, tonnes: number, trace?: Trace, day?: number, opts?: {
    row?: string;
}): NutrientAmounts;
/** Placeholder until CG-7 supplies sourced inputs: debit host-funded inputs:fallow.
 * Table f-rate converted to kg per element using pool0/f0, at this flux's step. */
export declare function fallow(field: Field, days: number, underBush?: boolean, trace?: Trace, day?: number): number;
/** Placeholder until realism.terrain.nutrient_transport: table slope rate in kg,
 * transferred to loss:erosion. An overdraw refuses the entire batch, never clamps. */
export declare function erode(field: Field, days: number, trace?: Trace, day?: number): number;
export declare function soilOutputs(field: Field): Record<string, number>;
