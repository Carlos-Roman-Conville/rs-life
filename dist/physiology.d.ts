/**
 * Human energy, heat, sleep and water as one engine process on a `body` component (kind "body", `props`). Every table
 * number comes from `data/library/physiology.json` through library.ts; the formulas are Mifflin-St Jeor (physiology.ts,
 * PHY-MSJ), the MET cost (physiology.ts metabolicHeat, PHY-MET) and the drift rule of gears/core-temperature-drift.md. What the docs
 * ask for and the library cannot support is listed in FLAGS.md and left disabled here.
 *
 * Inputs on `body.props` (all optional): height_cm, age_y, male (1 or 0) for the resting rate; acclimatisation (0 to 1,
 * default 1: the table's ceilings are the acclimatised ones); core_c (default: the recovery table's resting core);
 * sheltered (1 default; 0 for a wet cold night); work_w (external work, W); intake_kcal (food energy eaten); area_m2 (else
 * DuBois from height_cm) and h (else ISO 7730's convection and radiation). On the room: rh (atmosphere's) and air_speed_ms (0).
 * Outputs by library id on `body.props.outputs` (read them with `bodyOutputs`): alertness, sleep_debt, circadian,
 * core_c, core_state, work_capacity_heat, water_deficit_pct, hydration_state, endurance_hydration, work_capacity_hydration,
 * energy_balance_kcal, metabolic_w, met, activity (canonical schedule row id, null for a numeric MET),
 * pal, rmr_kcal, rmr_label, sweat_l_per_h, breath_water_l_per_h, skin_diffusion_l_per_h, urine_l_per_h, wbgt_c, wbgt_ceiling_c,
 * acclimatisation, fatigue_met_hours, and the matching `*_row` ids. A water deficit in a band whose row says work stops
 * ("incapacitated") or death opens a crisis record for that row (crisis.ts); the engine kills no one.
 */
import type { Process } from "./scheduler.ts";
import { type World } from "./world.ts";
import type { Component } from "./registry.ts";
import { type LibraryRow } from "./library.ts";
/** Energy per litre of oxygen consumed (STPD), J/L: 20.1 kJ/L (PHY-MET, PHY-FAO). */
export declare const O2_ENERGY_J_PER_L = 20100;
/** Metabolic heat of a body, W: MET x 3.5 mL O2/kg/min x 20.1 kJ/L (PHY-MET, PHY-FAO). */
export declare function metabolicHeat(met: number, massKg: number): number;
/** Latent heat of sweat evaporation, J/kg (about 2.43 MJ/kg at skin temperature). ENG-LAT. */
export declare const SWEAT_LATENT = 2430000;
/**
 * A body in the room. The process is `physiologyProcess` (physiology.ts): metabolic heat by MET, the air exchange, sweat
 * and its evaporative cooling, the water deficit, CO2 and CO exposure, and the library's heat, sleep and hydration states.
 */
export declare function bodyProcess(body: string, room: string, met: number): Process;
export type BodyOutputs = Record<string, number | string | null>;
/** The outputs record of a body, created on first use. It lives at `props.outputs` (props is typed numbers only). */
export declare function bodyOutputs(body: Component): BodyOutputs;
/** Body surface area, m2: the host's `area_m2`, else DuBois from height and mass; null when neither is known. */
export declare function bodyArea(body: Component): number | null;
interface Band {
    lo: number;
    hi: number;
    row: LibraryRow;
}
interface WbgtClass {
    lo: number;
    loIncl: boolean;
    hi: number;
    hiIncl: boolean;
    ceilingC: number;
    unacclimatisedC: number;
    driftCPerHPerC: number;
    row: LibraryRow;
}
/** MET of a physiology row (full id or slug), a muscular.activations row id, or a number as given. */
export declare function metOf(activity: number | string): number;
/** The work class (light, moderate, heavy) of a MET: its WBGT ceilings and core drift rate. */
export declare function wbgtClass(met: number): WbgtClass;
/** The WBGT ceiling for continuous work at this MET, between the unacclimatised (0) and acclimatised (1) columns. */
export declare function wbgtCeiling(met: number, acclimatisation: number): number;
/** Sleep debt (hours below need) to the table row and its alertness multiplier. */
export declare function sleepDebtRow(debtH: number): {
    row: LibraryRow;
    multiplier: number;
};
/** Clock hour (0 to 24) to the circadian row and factor; a band such as 22:00 to 02:00 wraps midnight. */
export declare function circadianRow(hour: number): {
    row: LibraryRow;
    factor: number;
};
/** Core temperature to its state row; `workCapacity` is the row's "work capacity xN" (1 for normal, null where the text gives none). */
export declare function coreRow(coreC: number): {
    row: LibraryRow;
    state: string;
    effect: string;
    workCapacity: number | null;
    sweatAtMax: boolean;
};
export declare const hydrationCrisisRows: () => Band[];
/** Water deficit (% of body mass) to its row; `endurance` is the Endurance factor (the in-heat one when hot), null where the text gives none;
 * `workCapacity` is 1 where the row says none, 0 where it says work stops or death, null where it gives no work figure. */
export declare function hydrationRow(deficitPct: number, hot: boolean): {
    row: LibraryRow;
    effect: string;
    endurance: number | null;
    workCapacity: number | null;
};
/**
 * The overnight tick for sleep and fatigue (recovery table): debt += max(0, need - slept) - max(0, slept - need), floored at 0;
 * fatigue resets after the table's hours, else carries (need - slept)/need of itself. `slept` is already quality-weighted.
 */
export declare function overnight(debtH: number, fatigueMetH: number, sleptH: number): {
    debtH: number;
    fatigueMetH: number;
};
/** The recovery table's weight of a split (watch) night's hours. */
export declare function splitSleepQuality(): number;
/** The PAL bands' lowest and highest value (FAO 2004 as the library has them). */
export declare function palRange(): {
    min: number;
    max: number;
};
/** Resting rate in kcal/day, selected by anatomy.species.rmr-formula (human column by default).
 * Mifflin-St Jeor 1990 (PHY-MSJ): null when height, age or sex is missing.
 * Power-law coefficients come from the species cell, including the Kleiber horse example.
 * Explicit host overrides require an estimate or fiction label.
 */
export interface RmrOverride {
    kcalDay: number;
    label: "estimate" | "fiction";
}
export declare function restingMetabolicRate(body: Pick<Component, "mass" | "props">, rmrFormula?: string, rmrOverride?: RmrOverride): number | null;
/** Metabolic power owned by physiology; an explicit resting rate carries species/host selection. */
export declare function metabolicRateW(met: number, body: Pick<Component, "mass" | "props">, rmr?: number | null): number;
/** Oxygen demand in L/min for metabolic power in W (J/s). */
export declare function oxygenLitresPerMin(metabolicW: number): number;
export interface ScheduleEntry {
    fromH: number;
    toH: number;
    activity: number | string;
    sleepQuality?: number;
}
export interface PhysiologyOptions {
    rmrFormula?: string;
    rmrOverride?: RmrOverride;
    met?: number;
    schedule?: ScheduleEntry[];
    every?: number;
    clockH0?: number;
    dayStartH?: number;
}
/** Total body water includes the free content and the water held by glycogen. */
export declare function totalBodyWaterKg(w: World, b: Component): number;
/** Physiology owns registry water; every actual transfer also changes body mass immediately.
 * `other` names an external source/sink; default is the caller's process.
 */
export declare function addBodyWater(w: World, body: string, kg: number, process: string, note: string, other?: string): void;
/** Move water internally as glycogen changes, without a body-mass transfer. */
export declare function setBodyGlycogen(w: World, body: string, glycogenG: number): void;
/** Eat or drink in kind: water enters the single content ledger, energy enters its intake counter. */
export declare function ingest(w: World, body: string, food: {
    kcal?: number;
    waterKg?: number;
}, process?: string): void;
export declare function physiologyProcess(body: string, room: string, o?: PhysiologyOptions): Process;
export {};
