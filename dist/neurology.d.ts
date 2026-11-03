/**
 * Signalling systems, baseline drivers, one-compartment kinetics, the four receptor clocks, the eleven circuits and the
 * interaction rules on a `body` component (kind "body", `props`). Every table number comes from `data/library/neurology.json`
 * through library.ts (`systems`, `baseline`, `pk`, `receptor`, `circuits`, `interactions`); the rule texts are parsed, so a
 * changed table changes the model. What NEUROLOGY.md asks for and the library cannot support (the EC50 and tolerance rate of all but alcohol, whose
 * pk-table values are design values, the rebound peak of most substances, the sizes of several drivers, the inverted-U shapes) is listed in FLAGS.md and left
 * disabled here: a `null` parameter switches its path off, and the caller may supply the number (`NeuroParams`).
 *
 * Tones: a system's tone is 1 at rest (0 to 2). tone = (1 + driver moves + sum of substance effects x sensitivity + withdrawal
 * swing) x the age scale, clamped. A circuit reads the tones once: read = 1 + sum of weight x (tone - 1), then the row's own
 * output range (neuroCircuits). Substances act only through the systems; no substance carries a penalty of its own.
 *
 * Dose: `dose(w, body, key, amount)` puts a substance in the gut (ledger substance `drug:<key>`, kg, traced from "intake");
 * `neurologyProcess` absorbs it (first order by the row's half-time), eliminates it (the row's half-life, or the zero-order
 * rate for alcohol, times `props.liver_function`, default 1; traced to "elimination") and reads the systems. Call
 * `registerDrugs(w)` and then `w.conserve("drug:alcohol", ["body"], 1e-12)` to have each substance's mass checked every step.
 *
 * Inputs on `body.props` (all optional): male (1 default), age_y, liver_function (1), pain (0 to 10), hunger (0 to 1),
 * starvation_stage, fever (1), fear_event (1 while it lasts), praise (1 on the event), isolation (1 while it lasts),
 * hours_awake (kept by the process: zeroed while asleep), asleep (1 or 0; absent: read from physiology's sleep hours), and
 * physiology's own outputs (met, sleep_debt, core_c, wbgt_c, wbgt_ceiling_c).
 * Outputs by library id on `body.props.outputs` (read them with `bodyOutputs`): one entry per circuit id (arousal,
 * motor-control, reward-and-habit, attention, pain-gating, memory-and-learning, breathing-drive, mood-regulation,
 * fear-and-stress, appetite, sleep) with its `<id>_row`, tone_<system>, sensitivity_<system>, dependence_<system>,
 * withdrawal_<system>, conc_<key>, occupancy_<key>, burden_<key>, alcohol_withdrawal_stage, fever_delirium, hours_awake.
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { type LibraryRow } from "./library.ts";
export interface NeuroSystem {
    id: string;
    name: string;
    recoveryDays: number;
    row: LibraryRow;
}
/** The ten systems in table order. */
export declare function neuroSystems(): NeuroSystem[];
export declare function neuroSystem(id: string): NeuroSystem;
/** What the body and the day are doing, as the baseline rows read it. Everything optional (absent: the driver is off). */
export interface BaselineState {
    hoursAwake?: number;
    sleepDebtH?: number;
    met?: number;
    /** Hours since a hard exercise bout ended (null or absent: none lately). */
    hoursSinceHardExercise?: number | null;
    pain?: number;
    fearEvent?: boolean;
    fearToday?: boolean;
    hunger?: number;
    starvationStage?: number;
    praiseToday?: boolean;
    isolation?: boolean;
    fever?: boolean;
    coreC?: number;
    heatStrain?: boolean;
    ageY?: number;
}
export interface BaselineResult {
    /** Tone moves by system id (added to the resting tone of 1). */
    move: Record<string, number>;
    /** Multiplicative scale on the tone by system id (age). 1 where nothing scales it. */
    scale: Record<string, number>;
    /** The baseline rows (ids) that are moving something now. */
    active: string[];
    /** Active rows whose systems the library names but whose size it does not give (FLAGS.md). */
    unsized: {
        row: string;
        systems: string[];
    }[];
    /** Fever's change to the attention read (the row names the circuit, not a system); 0 off. */
    feverAttention: number;
    /** Fever above the delirium temperature (the row's own 39.5 C). */
    delirium: boolean;
}
/** The baseline drivers' moves on the systems, from the body and the day. Pure. */
export declare function baselineMoves(s: BaselineState): BaselineResult;
export interface SystemHit {
    system: string;
    potency: number; /** the row says the effect comes "later": no delay is given, so the hit is off */
    delayed: boolean;
}
export type Elimination = {
    kind: "zero";
    gPerDLPerH: number;
} | {
    kind: "half";
    hours: number;
};
export interface NeuroSubstance {
    /** A short name for the row (alcohol, laudanum, tobacco, caffeine, quinine, mercury, lead, hemp). */
    key: string;
    id: string;
    name: string;
    row: LibraryRow;
    absorbHalfMin: number | null;
    elimination: Elimination | null;
    /** L/kg of the Widmark form for men and women, or the single value; null where the row gives "accumulates". */
    vdMan: number | null;
    vdWoman: number | null;
    /** A body burden: it has no concentration, only an amount that decays by its half-life. */
    accumulates: boolean;
    hits: SystemHit[];
    /** The amount of one standard dose (a range where the row gives one) and its unit, null where the row gives none. */
    standardDose: {
        lo: number;
        hi: number;
        unit: "g" | "mg";
    } | null;
    /** The unit a concentration is quoted in: g/dL for the alcohol form, mg/L otherwise. */
    concUnit: "g/dL" | "mg/L";
    /** The library's EC50 in `concUnit`, null where the pk table gives none (no acute effect). */
    ec50: number | null;
    /** The library's tolerance rate per day per unit of mean occupancy, null where the pk table gives none. */
    kTol: number | null;
}
/** The substances of the pk table that carry a kinetics row (the tagged row says "as its row" and has none). */
export declare function neuroSubstances(): NeuroSubstance[];
export declare function neuroSubstance(key: string): NeuroSubstance;
/** The share of a drink that is available after a meal (the pk table's "availability 66 to 71% after a meal", at its middle). */
export declare function mealAvailability(): number;
export interface PkState {
    gutKg: number;
    centralKg: number;
}
declare const UNIT_KG: {
    readonly g: 0.001;
    readonly mg: 0.000001;
    readonly kg: 1;
};
export type DoseUnit = keyof typeof UNIT_KG;
/** The volume of distribution in litres for this body (the Widmark factor times mass for alcohol), null where the row has none. */
export declare function distributionLitres(s: NeuroSubstance, massKg: number, male?: boolean): number | null;
/** Concentration of the central amount: g/dL for alcohol (Widmark: A / (r W)), mg/L for the rest; null for a burden. */
export declare function concentration(s: NeuroSubstance, centralKg: number, massKg: number, male?: boolean): number | null;
/** Advance the gut and central amounts by `dtMin` minutes, in sub-steps of at most one minute: first-order absorption, then elimination. */
export declare function pkStep(s: NeuroSubstance, st: PkState, dtMin: number, massKg: number, male?: boolean, liver?: number): PkState & {
    absorbedKg: number;
    eliminatedKg: number;
};
/** Occupancy of the receptors by a concentration: C / (C + EC50) (Hill, n = 1). */
export declare const occupancy: (c: number, ec50: number) => number;
/** The tolerance floor, the dependence time and the rebound peak the library gives (opioids: the middle of "peak 1 to 3 days", in hours). */
export declare function clockRules(): {
    toleranceFloor: number;
    dependenceDays: number;
    deliriumDependenceOver: number;
    deliriumDeathRollPerDay: number;
    opioidReboundPeakH: number | null;
};
/** Tolerance: sensitivity falls by kTol x the day's mean occupancy, to the floor. */
export declare function toleranceStep(sensitivity: number, meanOccupancy: number, kTol: number): number;
/** Recovery with no exposure: sensitivity moves toward 1 at the system's time constant, for `days`. */
export declare function recoveryStep(sensitivity: number, recoveryDays: number, days?: number): number;
/** dependence = clamp(1 - sensitivity, 0, 1) x exposure days / 14, held to 0..1. */
export declare function dependence(sensitivity: number, exposureDays: number): number;
/** Rebound: rises from 0 at the last dose to 1 at the peak, then fades on the system's recovery constant. */
export declare function rebound(hoursSinceDose: number, peakH: number, recoveryDays: number): number;
export interface CircuitTerm {
    system: string | null;
    weight: number | null;
    note: string;
    via: "alcohol" | null;
    invertedU: boolean;
}
export interface Circuit {
    id: string;
    rowId: string;
    name: string;
    terms: CircuitTerm[];
    /** The output's stated range from the row's Output text (null ends: none stated). */
    lo: number | null;
    hi: number | null;
    /** "offset": the read minus 1 is the output (normal = 0); "read": the read itself. */
    form: "read" | "offset";
    goesTo: string;
    /** Alcohol over this g/dL blocks the circuit (the memory row), null elsewhere. */
    blockedOverAlcohol: number | null;
    row: LibraryRow;
}
/** The eleven circuits as weighted reads of systems, from the circuits table. */
export declare function neuroCircuits(): Circuit[];
export declare function neuroCircuit(id: string): Circuit;
/** What a circuit reads once the terms the library can support are summed: 1 + sum of weight x (tone - 1). Disabled terms add nothing. */
export declare function circuitRead(c: Circuit, tone: Record<string, number>): number;
/** The terms of a circuit that are switched off for want of a number or a shape in the library (FLAGS.md). */
export declare function disabledTerms(c: Circuit): CircuitTerm[];
interface SynergyRule {
    opioid: number;
    gaba: number;
    alcohol: number;
    both: number;
    occupancyOver: number;
}
/** The depressant synergy on breathing, from the interactions table. */
export declare function synergyRule(): SynergyRule;
/** Respiratory drive by the product form: (1 - 0.6 opioid) x (1 - 0.3 gaba) x (1 - 0.2 alcohol), x0.8 with two depressants over the occupancy. */
export declare function breathingDrive(opioidEffect: number, gabaEffect: number, alcoholEffect: number, depressantsOver: number): number;
/** The numbers the library calls placeholders and does not give. Each `null` or absent entry switches its path off (FLAGS.md). */
export interface NeuroParams {
    /** EC50 per substance key, in the concentration unit of `NeuroSubstance.concUnit`; overrides the pk table's column, null switches the substance's acute effect off. */
    ec50?: Record<string, number | null>;
    /** The tolerance rate k_tol per substance key, per day per unit of mean occupancy; overrides the pk table's cell, null switches that substance's tolerance off. A substance with no number anywhere builds none. */
    kTol?: Record<string, number | null>;
    /** Hours from the last dose to the rebound peak, per substance key. Absent: no withdrawal for it (opioids: the library's range). */
    reboundPeakH?: Record<string, number>;
}
export interface NeurologyOptions {
    every?: number;
    clockH0?: number;
    dayStartH?: number;
    params?: NeuroParams;
}
/** Register the ledger substances (`drug:<key>`, mass only). Call before `World.conserve`. */
export declare function registerDrugs(w: World): void;
/** The amount on board in kg: gut plus central. */
export declare function onBoardKg(w: World, bodyId: string, key: string): number;
/**
 * Take a dose: `amount` in `unit` (default: the unit of the row's standard dose) goes into the gut, traced from "intake".
 * With `meal` the share the pk table gives for a meal is available; the rest is traced to "unabsorbed" and never enters.
 */
export declare function dose(w: World, bodyId: string, key: string, amount: number, o?: {
    unit?: DoseUnit;
    meal?: boolean;
}): void;
/** The neurology process: kinetics each step, the tones and circuits, and the tolerance clocks at each day's close. Run it after `physiologyProcess`. */
export declare function neurologyProcess(body: string, o?: NeurologyOptions): Process;
export {};
