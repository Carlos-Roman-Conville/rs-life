/**
 * Nutrient pools, absorption, deficiency stages and body composition on a `body` component (kind "body", `props`). Every
 * number is read from `data/library/nutrition.json` through library.ts (the `nutrients`, `foods`, `foods_more`, `absorption`,
 * `depletion` and `body_composition` tables); the rule texts are parsed, so a changed table changes the model. What the docs
 * ask for and the library cannot support is listed in FLAGS.md and left disabled here.
 *
 * Each nutrient with a reserve in the depletion table is a pool: a content of the body (substance `nutrient:<id>`, kg), filled
 * by `eat` (intake times the absorption fraction, added to the pool) and drained once a day, after which the pool is capped at its full level and the rest traced to "excreta"
 * by the table's daily use. `stockPools` fills the pools; call it before `World.conserve("nutrient:vit_c", ["body"])`.
 *
 * Inputs on `body.props` (all optional): male (1 default, 0 for the woman's columns), fat_kg (the fat store; without it the
 * energy balance has nowhere to go and is reported as unplaced), glycogen_g (default: the full reserve), fever, pregnant,
 * menstrual, diarrhoea, rum_heavy, flux, chronic_flux (1 while the condition lasts), blood_lost_l (cumulative litres).
 * Outputs by library id on `body.props.outputs` (`bodyOutputs`): pool_<id>, pool_frac_<id>, deficiency_<id> (stage 0 to 3) and
 * deficiency_<id>_row for every pool; fat_kg, glycogen_g, glycogen_factor, glycogen_bound_water_kg, water_change_kg (the day's change of the water ledger), energy_balance_day_kcal, energy_unplaced_kcal,
 * starvation_limit, protein_need_g, intake_<id> (last closed day, in the food column's unit).
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import type { Component } from "./registry.ts";
import { type LibraryRow } from "./library.ts";
declare const UNIT_KG: {
    readonly g: 0.001;
    readonly mg: 0.000001;
    readonly mcg: 1e-9;
};
type Unit = keyof typeof UNIT_KG;
export interface NutrientInfo {
    id: string;
    name: string;
    unit: string;
    row: LibraryRow;
    needMan: number | null;
    needWoman: number | null;
    perKg: boolean;
    daysToSignsLo: number | null;
    daysToSignsHi: number | null;
}
/** A nutrient's library row and parsed need and clock; throws for an unknown id. */
export declare function nutrientInfo(id: string): NutrientInfo;
/** The daily need in the nutrient's table unit, or null where the table gives none (energy comes from physiology). Per-kg needs use the body mass. */
export declare function dailyNeed(id: string, male: boolean, massKg?: number): number | null;
export interface Food {
    id: string;
    slug: string;
    kcalPerKg: number;
    /** Nutrient id to the food column's unit per 100 g, kept with the unit so the amounts read as the table does. */
    per100: Map<string, {
        value: number;
        unit: Unit;
    }>;
    haem: boolean;
}
/** A food by its `foods` id, its slug, or the `foods_more` slug of the same row. */
export declare function foodRow(id: string): Food;
/** Amount of a nutrient in a mass of food, in the food column's unit (kcal for "energy"). */
export declare function foodContent(food: Food, nutrient: string, kg: number): number;
export interface PoolSpec {
    id: string;
    rowId: string;
    name: string;
    unit: Unit;
    fullMan: number;
    fullWoman: number;
    useFrac: number;
    useMin: number;
    useFixed: number;
    thresholdKg: number | null;
    recoveryDays: number | null;
    sweatPerL: number;
    menstrualDay: number;
    bloodPerL: number;
    feverX: number;
    diarrhoea: number;
    rumHeavy: number;
}
/** The pooled nutrient ids (those with a numeric reserve and daily use in the depletion table). */
export declare function pooledNutrients(): string[];
/** A pool's parsed depletion row. */
export declare function poolSpec(id: string): PoolSpec;
/** Fill the body's pools to the table's full reserve (times `fractions[id]`, default 1) for its sex. Call before `World.conserve`. */
export declare function stockPools(w: World, bodyId: string, fractions?: Record<string, number>): void;
/** A pool's level in its table unit (mg, mcg or g). */
export declare function poolLevel(w: World, bodyId: string, id: string): number;
/** The deficiency stage of every pooled nutrient above 0: `{vit_c: 1}`. The stage is 1 under the table's "signs below" level; 2 and 3 only where the caller gave their levels. */
export declare function deficiencySignals(body: Component): Record<string, number>;
/** The state of the eater and the meal that the absorption rules read. */
export interface MealOptions {
    /** anatomy.organs intestines: absorption x function; omitted means intact gut. */
    gutFunction?: number;
    cooked?: boolean;
    rawFish?: boolean;
    nixtamalised?: boolean;
    wholeGrain?: boolean;
    tea?: boolean;
    grainAndPease?: boolean;
}
interface Meal extends MealOptions {
    vitCMg: number;
    fatG: number;
    flux: boolean;
    chronicFlux: boolean;
    rum: boolean;
}
/** The fraction of a nutrient that the body keeps from this food in this meal (absorption table; 1 where the table has no rule). */
export declare function absorbedFraction(nutrient: string, food: Food, m: Meal): number;
export interface MealItem {
    food: string;
    kg: number;
}
/** Eat several foods as one meal (the vitamin C and fat of the meal change the absorption of its iron and fat-soluble vitamins). */
export declare function eatMeal(w: World, bodyId: string, items: MealItem[], opts?: MealOptions, process?: string): void;
/** Eat `kg` of a library food: its energy and water in through physiology's `ingest`, its nutrients absorbed into the pools, all traced. */
export declare function eat(w: World, bodyId: string, foodId: string, kg: number, opts?: MealOptions): void;
/** The library's convention, not an exact physiological constant; null disables this transfer. */
export declare const GLYCOGEN_BOUND_WATER: number | null;
/** Water already inside the body, held by its current glycogen reserve. */
export declare function glycogenBoundWaterKg(body: Component): number;
/** realism.nutrition.body_mass: the sole runtime writer of body component mass. */
export declare function bodyMassDelta(w: World, body: string, kg: number, process: string, note: string): void;
/** The energy density of stored fat the library gives (kcal/kg), 7,700 in the table. */
export declare function fatKcalPerKg(): number;
/** The Endurance pool's glycogen factor from the glycogen reserve (g): 0.5 + 0.5 x glycogen/400 in the table. */
export declare function glycogenFactor(glycogenG: number): number;
export interface NutritionOptions {
    every?: number;
    clockH0?: number;
    dayStartH?: number;
    /** Pool levels (the pool's table unit) under which a deficiency is stage 2 and stage 3. The library gives only the "signs below" level (stage 1); the game's adapter rows give these. */
    stages?: Record<string, {
        stage2?: number;
        stage3?: number;
    }>;
}
/** The daily nutrition process: closes each day's books (pool use, stages, glycogen and fat) at `dayStartH`; run it after `physiologyProcess`. */
export declare function nutritionProcess(body: string, o?: NutritionOptions): Process;
export {};
