import type { LibraryRow } from "./library.ts";
import type { TissuePopulation } from "./tissue.ts";
import { NutrientLedger, SoilCell } from "./soils.ts";
import { Trace } from "./trace.ts";
export declare class PlantParameterError extends Error {
    constructor(fields: readonly string[]);
}
export declare class PlantFormError extends Error {
    constructor(id: string);
}
export declare class PlantEnvironmentError extends Error {
    constructor(field: string);
}
export type PlantForms = readonly LibraryRow[];
/** plants.forms.temperature_beta_function supports a zero base only (2808).
 * A nonzero base requires the separately sourced cardinal form, currently absent. */
export declare function plantTemperatureFactor(t: number, min: number, opt: number, max: number, forms?: PlantForms): number;
/** plants.forms.fao56_ks: remaining available water is TAW - Dr; units cancel. */
export declare function plantWaterFactor(available: number, totalAvailable: number, p: number, forms?: PlantForms): number;
/** plants.forms.salinity_threshold_slope; slope is percent per conductivity unit. */
export declare function plantSalinityFactor(s: number, threshold: number, slope: number, forms?: PlantForms): number;
/** plants.forms.ph_trapezoid is absent in the current library: calling it throws. */
export declare function plantPhFactor(ph: number, min: number, low: number, high: number, max: number, forms?: PlantForms): number;
export type PlantOrganName = "leaf" | "stem" | "root" | "rhizome";
export type PlantNutrient = "n" | "p" | "k";
type OrganValues = Record<PlantOrganName, number>;
type NutrientValues = Record<PlantNutrient, number>;
export interface PlantEnvironment {
    /** MJ PAR / m2 / day. A photon-mol port needs an explicit spectral conversion upstream. */
    par?: number;
    airTemperatureC?: number;
    vpdKPa?: number;
    co2Ppm?: number;
    /** Per-individual root-zone available water and TAW, kg; no field-capacity default. */
    soilWater?: {
        availableKg: number;
        totalAvailableKg: number;
    };
    availableN?: number;
    availableP?: number;
    availableK?: number;
    soilPh?: number;
    /** dS/m for threshold/slope; same units as the supplied cardinals for a beta. */
    salinity?: number;
    waterDepthM?: number;
    kdPerM?: number;
    inundation?: number;
}
export interface PlantInit {
    /** Host identities are required for resolution changes and soil integration. */
    id?: string;
    region?: string;
    speciesId?: string;
    cultivar: string | null;
    variants: Readonly<Record<string, string | number | boolean | null>>;
    ageDays: number;
    massesKg: OrganValues;
    reserveKg: number;
    groundAreaM2: number;
    waterKg: number;
    waterStatus: number;
    tissueFractions: NutrientValues;
    /** Explicit alternate data provider, primarily for test-only forms. Never fills library rows. */
    forms?: PlantForms;
}
export interface PlantLitter {
    dryMassKg: number;
    carbonKg: number;
    nutrientsKg: NutrientValues;
}
export interface PlantFluxes {
    grossDryMassKg: number;
    co2TakenKgC: number;
    co2ReleasedKgC: number;
    o2ReleasedKg: number;
    waterTakenKg: number;
    waterTranspiredKg: number;
    nutrientsTakenKg: NutrientValues;
    litter: Record<PlantOrganName, PlantLitter>;
    factors: {
        temperature: number;
        water: number;
        salinity: number;
        nutrients: number;
        ph: number;
        co2: number;
        combined: number;
    };
}
interface Inventory {
    carbon: number;
    water: number;
    nutrients: NutrientValues;
}
export interface Plant {
    id: string | null;
    region: string | null;
    species: string | null;
    genetic: {
        readonly cultivar: string | null;
        readonly variants: Readonly<Record<string, string | number | boolean | null>>;
    };
    developmental: {
        ageDays: number;
        organs: Record<PlantOrganName, {
            populations: TissuePopulation[];
        }>;
        leafAreaM2: number;
        reserveKg: number;
        heightM: number | null;
        stemDiameterCm: number | null;
        maturity: "juvenile" | "reproductive" | "senescent";
    };
    organism: {
        waterStatus: number;
        waterKg: number;
        nutrientsKg: NutrientValues;
        tissueFractions: NutrientValues;
        accumulatedStressDays: number;
        alive: boolean;
        cause: "carbon starvation" | null;
    };
    parameters: Readonly<Record<string, string | number | boolean | null>>;
    forms: PlantForms;
    groundAreaM2: number;
    ledger: {
        initial: Inventory;
        totals: PlantFluxes;
        notes: {
            t: number;
            text: string;
        }[];
    };
}
export declare function plantOrganMasses(plant: Plant): OrganValues;
/** Reads schema Field names, never positional species cells. All missing required rows are reported together. */
export declare function createPlant(speciesTable: string | readonly LibraryRow[], init: PlantInit): Plant;
/** Same immutable genotype, independent populations and ledger history. */
export declare function clonePlant(parent: Plant): Plant;
/** A fresh read, including the existing carbohydrate reserve; never an integrated stock. */
export declare function vegetationStock(records: readonly Plant[], region: string): {
    organsKg: OrganValues;
    reserveKg: number;
    totalKg: number;
};
/** Replace the input records with the result in the host registry (do not retain both resolutions).
 * Tissue states follow mergeRegions; organism age/stress/water status use ground-area means.
 * Distinct genotypes, forms or life/death states cannot be represented by this single record. */
export declare function coarsen(records: readonly Plant[], trace?: Trace, t?: number): Plant;
/** Positive shares name child records, not new places. The last child receives roundoff remainders. */
export declare function refine(record: Plant, shares: Readonly<Record<string, number>>, trace?: Trace, t?: number): Plant[];
/** One immediate soil debit/tissue credit per nonzero element; all elements roll back on refusal.
 * Call with a new uptake flux, never reapply a flux returned by an already integrated step. */
export declare function plantUptake(cell: SoilCell, plant: Plant, fluxes: Pick<PlantFluxes, "nutrientsTakenKg">, ledger: NutrientLedger, trace?: Trace, t?: number): void;
export interface PlantSoilStep {
    cell: SoilCell;
    ledger: NutrientLedger;
    trace?: Trace;
    /** Flux time in seconds, like the soil API. */
    t: number;
}
/** One explicit interval at constant forcing; days is not an internal subdivision or convergence claim.
 * Works on a copy first: any missing input/form leaves the caller's state and ledger unchanged. */
export declare function stepPlant(plant: Plant, env: PlantEnvironment, days: number, soil?: PlantSoilStep): PlantFluxes;
/** Absolute residuals in kg C, kg water, and kg N/P/K, independently using initial/current inventories. */
export declare function plantLedgerError(plant: Plant): {
    carbon: number;
    water: number;
    n: number;
    p: number;
    k: number;
};
export {};
