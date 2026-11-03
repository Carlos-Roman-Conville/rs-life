import type { Trace } from "./trace.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
export declare function muscularRange(id: string): readonly [number, number];
export declare const muscularTables: () => {
    groups: import("./library.ts").LibraryRow[];
    values: import("./library.ts").LibraryRow[];
    adaptation: import("./library.ts").LibraryRow[];
    patterns: import("./library.ts").LibraryRow[];
    tendons: import("./library.ts").LibraryRow[];
    training: import("./library.ts").LibraryRow[];
};
export declare function muscularRates(group: string): {
    id: string;
    F: number;
    R: number;
} | null;
/** At the row's MET only. There are 30 activation columns for 31 groups: diaphragm is null. */
export declare function muscularActivation(actionId: string): {
    id: string;
    met: number;
    groups: Record<string, number | null>;
};
export interface Compartments {
    resting: number;
    active: number;
    fatigued: number;
}
/** Exact constant-effort evolution in seconds (gears/muscular-3cc.md).
 * At rest active fibres are released; MF then follows the documented exact exponential.
 * Transfers and sum-to-one checks are returned through the shared Trace when supplied. */
export declare function stepMuscleFatigue(state: Compartments, group: string, effort: number, seconds: number, recoveryMultiplier: number, trace?: Trace, t?: number): Compartments | null;
/** A reference observation, not a stopping threshold for 3CC (the rows are inconsistent). */
export declare function muscularEnduranceReference(effort: number): {
    id: string;
    seconds: number;
    lowerBound: boolean;
    exhaustionSeconds: null;
} | null;
export interface MuscleState {
    contractile: number;
    oxidative: number | null;
    condition: number;
    min: number;
    max: number;
    idleDays: number;
    tension: number;
    aerobic: number;
    compartments: Compartments | null;
}
export type MuscleSide = "L" | "R" | "one";
export interface MuscularState {
    groups: Record<string, Partial<Record<MuscleSide, MuscleState>>>;
    patterns: Record<string, Partial<Record<MuscleSide, {
        recruitment: number;
        practice: number;
        adaptation: null;
    }>>>;
    tendons: Record<string, {
        tolerance: number | null;
        adaptation: null;
        injury: null;
    }>;
}
/** Genetic limits and initial levels are host inputs, not inferred from game stats. */
export declare function createMuscularState(initial: {
    contractile: number;
    oxidative: number | null;
    min: number;
    max: number;
    recruitment: number;
}): MuscularState;
/** Three separate signals; effort and oxidativeShare are fractions, activation uses the library percent.
 * Linear load-factor interpolation is used between the two stated anchors. Pattern shares are host inputs. */
export declare function muscularStimuli(activation: number, effort: number, reps: number, minutes: number, oxidativeShare: number, patternShare: number): {
    tension: number;
    aerobic: number;
    practice: number;
};
export interface MuscularDay {
    tension: number;
    aerobic: number;
    used: boolean;
    hoursSinceHardSession: number;
    /** Resolved multipliers from the training rows; ambiguous intermediate gate values are the caller's. */
    proteinGate: number;
    energyGate: number;
    sleepGate: number;
    ageGate: number;
}
/** One overnight conversion, MUSCULAR.md 5a. No invented k_o, k_n or k_t.
 * Consumed tension is the gated portion; unconverted signal carries to the next night. */
export declare function adaptMuscleDay(state: MuscleState, day: MuscularDay): MuscleState;
/** Proposed, uncalibrated clamp (gears/aerobic-training-clamp.md); sole training input to circulation.
 * Normalisation rows reference the existing k rows, never a second fitted constant set. */
export declare function trainingFactor(state: {
    fitness: number;
    fatigue: number;
}): number;
/** Banister's daily impulse followed by decay on subsequent days; base is host supplied.
 * These are MET-hour sums, not a calibrated VO2 ceiling or the circulation aerobic_today. */
export declare function muscularBanisterDay(state: {
    fitness: number;
    fatigue: number;
}, loadMetHours: number, base: number): {
    fitness: number;
    fatigue: number;
    performance: number;
};
/** Read the body's daily Banister state; an untracked body retains full capacity. */
export declare function bodyTrainingFactor(w: World, body: string): number;
/** Host calls once per training day with its daily MET-hour load, including rest days.
 * Stores only fitness/fatigue; the existing pure daily calculation owns adaptation. */
export declare function bodyBanisterDay(w: World, body: string, loadMetHours: number, base: number): {
    fitness: number;
    fatigue: number;
    performance: number;
};
export declare function muscularOutputs(state: MuscularState): {
    fatigue: {
        [k: string]: {
            [k: string]: number | null;
        };
    };
    patternSkill: {
        [k: string]: {
            [k: string]: number;
        };
    };
    limbStrength: {
        [k: string]: null;
    };
    oxidativeAdaptation: null;
    tendonAdaptation: null;
    neuralAdaptation: null;
    massKg: null;
};
/** Useful to adapters validating their action coverage, including missing group columns. */
export declare const muscularActivationColumns: () => string[];
export interface MuscularFatigueOptions {
    /** Match physiology's cadence and place this process after it. */
    every?: number;
    recoveryMultiplier?: number;
}
/** Local fatigue reads the same work record as systemic MET-hours, never that counter.
 * Numeric METs and activities without an activation row mean local rest. Missing rates remain null.
 * Outputs are scalar ids: muscular.fatigue_3cc.<group>.<side>. Banister's daily state is separate. */
export declare function muscularFatigueProcess(body: string, state: MuscularState, o?: MuscularFatigueOptions): Process;
