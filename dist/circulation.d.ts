/** CIRCULATION.md CIR-DO2 and the circulation library. Volumes are mL, Hb is g/dL,
 * flow L/min, pressure mmHg, time seconds. Missing kinetic parameters stay null.
 * Run after breathingProcess; the host owns wounds, treatment supplies and crises.
 */
import { type LibraryRow } from "./library.ts";
import type { World } from "./world.ts";
import type { Process } from "./scheduler.ts";
/** Oxygen saturation of haemoglobin by the Severinghaus form, from the arterial PO2 in mmHg. */
export declare function saturation(paO2MmHg: number): number;
/** All source rules and normals, including qualitative values, keyed by stable id. */
export declare function circulationRules(table: "quantities" | "bleeding" | "delivery_failures" | "homeostasis" | "blood_gas" | "events"): {
    [k: string]: LibraryRow;
};
export declare function normalBloodVolume(massKg: number, male: boolean): number;
/** Bound oxygen only, per CIR-DO2. No duplicate saturation or CO kinetics. */
export declare function oxygenDelivery(coLMin: number, hbGDL: number, sao2: number, cohb?: number): number;
/** Fractional classes take precedence over the rounded 70 kg illustrative mL column.
 * Adjacent boundaries enter the higher class; IV is strictly over 40% as written. */
export declare function bleedingClass(lossMl: number, baselineMl: number): LibraryRow;
/** The table specifies whole-body perfusion only in class I; unspecified organs stay null. */
export declare function bleedingEffects(lossMl: number, baselineMl: number): {
    row: LibraryRow;
    pressure: number | null;
    pressureUpperBound: number | null;
    perfusion: {
        brain: number | null;
        kidneys: number | null;
        gut: number | null;
        skin: number | null;
    };
    deathRatePerHour: number;
    unmeasured: true;
};
export interface CirculationOptions {
    every?: number;
    /** Actual host flow/resistance, never inferred from volume by an invented curve. */
    resistance?: number;
    cardiacOutputLMin?: number;
    /** Overrides the library's maximal cardiac output (null until a cited one exists). */
    maximalCardiacOutputLMin?: number;
    /** Overrides the body's muscular training factor (1 if untracked). Read each step. */
    trainingFactor?: number;
    /** Overrides the library's volume tau (null until a cited one exists). */
    volumeTauSeconds?: number;
    kidneyWorking?: boolean;
}
/** Initial blood is a volume ledger inside the host body mass; shed blood leaves that mass at the library density. */
export declare function initialiseCirculation(w: World, body: string, profile?: {
    bloodVolumeMl: number;
    haemoglobinGDL: number;
}): void;
/** Whole blood leaves with its current Hb concentration. Requested loss caps at available blood. */
export declare function loseBlood(w: World, body: string, ml: number): number;
/** The `N` in the bleeding table's "rate x minutes x (N - clotting)", read from the table's own source sentence. */
export declare function bleedFactor(): number;
/** Wound rate is a host input, not a class death chance. Binding/ligation stops it. */
export declare function bleed(w: World, body: string, rateMlMin: number, seconds: number, clotting: number, bound?: boolean): number;
/** Loop metadata preserves qualitative time constants; tauSeconds is the library's cited number, null while none is cited
 * (no conversion of 'days' to a guessed number). */
export declare function regulationLoops(): {
    [k: string]: {
        target: import("./library.ts").Cell;
        correction: import("./library.ts").Cell;
        timeConstant: import("./library.ts").Cell;
        tauSeconds: number | null;
        failsWhen: import("./library.ts").Cell;
    };
};
/** Maximal oxygen delivery (mL O2/min), without stepping or initialising the body.
 * Missing blood/gas inputs return null. Optional process overrides use the same
 * computation; otherwise read the body's current Banister state and library maximum. */
export declare function aerobicToday(w: World, body: string, options?: Pick<CirculationOptions, "trainingFactor" | "maximalCardiacOutputLMin">): number | null;
/** First-order volume recovery only with a host tau and an explicit finite supply of
 * already available intravascular replacement fluid (props.circulation_fluid_ml).
 * This does not model oral absorption or manufacture red cells. */
export declare function circulationProcess(body: string, options?: CirculationOptions): Process;
export interface CardiovascularState {
    index?: number;
    demandExceedsSupply?: boolean;
    triggerDay?: boolean;
    potassium?: number;
    magnesiumLow?: boolean;
    sao2?: number;
    drugs?: boolean;
    heartDamage?: number;
    feverC?: number;
    sustainedLowHeartFunction?: boolean;
    embolicClot?: boolean;
    pressureVeryHigh?: boolean;
    immobile?: boolean;
    dehydrated?: boolean;
    injury?: boolean;
    sepsis?: boolean;
    latePox?: boolean;
    classIIIPlus?: boolean;
    acuteHeartFailure?: boolean;
    badBurn?: boolean;
    anaphylaxis?: boolean;
}
/** Placeholder intensity in the table's native unit, NOT a measured hazard or a roll.
 * Competing/unsized causes return null instead of inventing an aggregation rule. */
export declare function hazard(event: string, state?: CardiovascularState): {
    id: string;
    eligible: boolean;
    rate: number | null;
    unit: "state" | "day" | "hour" | "event" | "index/day";
    unmeasured: true;
    precondition: string;
    rule: string;
};
