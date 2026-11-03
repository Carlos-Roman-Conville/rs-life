import { type LibraryRow } from "./library.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { type Crisis } from "./crisis.ts";
type CollagenThreshold = "reopen-healed-at-integrity" | "teeth-lost-at-integrity" | "sudden-death-on-exertion-at-integrity";
/** Unsourced thresholds stay null. Late-stage signs must follow the impaired-collagen sign. */
export declare function collagenConsequenceThreshold(id: CollagenThreshold): number | null;
/** The rows of a medicine table by stable id. */
export declare const medicineRules: (table: "diseases" | "wounds" | "pain" | "treatments" | "healing" | "immunity" | "exposure" | "collagen_consequences") => {
    [k: string]: LibraryRow;
};
export declare const medicineColumns: (table: string) => string[];
export interface Range {
    lo: number;
    hi: number;
}
/** "7 to 14 bacillary", "2 to 4 weeks acute", "fever every 2nd day for 2 to 4 weeks", "0": a day range at the start or after "for". */
export declare function daysRange(text: unknown): Range | null;
/** The death risk as a fraction range: the "of all cases" clause wins, else the first clause; "under 2%" is 0 to 2%. */
export declare function riskRange(text: unknown): Range | null;
/** The point of a parsed range used by individual cases and expected-value aggregates. */
export declare const rangePoint: (r: Range, p: number) => number;
export interface DiseaseCourse {
    id: string;
    incubation: Range | null;
    course: Range | null;
    risk: Range | null;
    /** The window a death falls in: the course days, else the "within N years" of the risk text. */
    riskWindowDays: number | null;
    lastingHarm: string;
    recoveryDays: Range | null;
    row: LibraryRow;
}
/** A disease row read into numbers where the text has them; every other path is null (and flagged). */
export declare function diseaseCourse(id: string): DiseaseCourse;
export interface DiseaseOutcomeDay {
    /** Unconditional probabilities of a crisis or recovery on this day since exposure. */
    death: number;
    recovery: number;
    /** Probability of being alive and ill after this day (incubation excluded). */
    ill: number;
}
/** Exact expectation of expose/advanceDays when every untreated crisis is counted as a death.
 * Index 0 is exposure, before advancing. Incubation and course are uniform integer draws; a fatal
 * crisis is uniform on 1..course. Null means the row cannot place an individual course in time. */
export declare function diseaseOutcomeDays(d: DiseaseCourse, risk: number): DiseaseOutcomeDay[] | null;
export interface ImmunityRule {
    id: string;
    level: "lifelong" | "partial" | "none";
    fadesAfterDays: number | null;
    inoculation: boolean;
    row: LibraryRow;
}
/** The immunity row for a disease: the row id's tail is the disease or lists it (dysentery-typhoid-influenza). */
export declare function immunityRule(disease: string): ImmunityRule;
export interface Sick {
    id: string;
    stage: "incubating" | "ill";
    dayOfStage: number;
    incubationDays: number;
    courseDays: number | null;
    /** Drawn at exposure: the course day the untreated death risk falls due, or null. Treatment can cancel it. */
    fatalOnDay: number | null;
    /** Course day a treatment set for recovery of an open-ended course. */
    endsOnDay: number | null;
    treated: boolean;
    /** Timing of a fatal draw cannot be placed (no course days or horizon in the row). */
    timingUnsupported: boolean;
    crisis: boolean;
}
export interface Wound {
    n: number;
    kind: string;
    /** Bleeding class label from the row, or null (burns lose fluid, not blood). */
    bleedingClass: string | null;
    internal: boolean;
    burnFluidClassIIUnits: number | null;
    rateMlMin: number | null;
    clotting: number;
    bound: boolean;
    open: boolean;
    infected: boolean;
    healDays: number;
    progressDays: number;
    healed: boolean;
    reopened: number;
    painCause: string | null;
    workingPart: boolean;
    resting: boolean;
}
export interface Immunity {
    disease: string;
    level: "lifelong" | "partial";
    sinceDay: number;
    fadesAfterDays: number | null;
    via: "survived" | "inoculation";
}
export interface MedicineState {
    body: string;
    rand: () => number;
    day: number;
    elapsedSeconds: number;
    sick: Sick[];
    wounds: Wound[];
    immunity: Record<string, Immunity>;
    lastingHarm: Record<string, string>;
    crises: Crisis[];
    /** Append-only bridge cursor; optional for existing host-created states. */
    crisisTraceCursor?: number;
    /** World time corresponding to medicine elapsedSeconds = 0, fixed on first bridge/process call. */
    crisisTimeOrigin?: number;
    airActive: Record<string, number>;
    /** Latest anatomy state; scurvy is a diagnosis over this state, with no course clock. */
    collagenIntegrity?: number;
    /** Crossing latch, not a clock; unknown integrity cannot re-arm it. */
    collagenReopeningActive?: boolean;
    /** Irreversible consequence, retained after collagen recovery. */
    teethLost?: boolean;
    /** Used for a wound's pain when the host does not name the cause. */
    options: {
        riskAt: number;
        dentate?: boolean;
    };
}
export interface MedicineOptions {
    seed?: number;
    /** Whether the body has teeth; omitted means the host has not specified it. */
    dentate?: boolean;
    /** Where in a row's risk range this body's cases fall (0 = the low end, 1 = the high end). Default the middle. */
    riskAt?: number;
}
export declare function createMedicine(body: string, options?: MedicineOptions): MedicineState;
/** Flush appended crises once, retaining object identity for resolveCrisis. On the
 * first call, w.t must correspond to s.elapsedSeconds; call before advancing to
 * bind a state created at a nonzero world time. Later flushes may be delayed. */
export declare function flushMedicineCrises(w: World, s: MedicineState): void;
export interface ExposureOptions {
    /** Host multiplier from hygiene (no library number; default 1 = none). */
    hygiene?: number;
    quarantine?: boolean;
    /** Overrides for a row the table cannot place (incubation "months to years"). */
    incubationDays?: number;
}
export interface ExposureResult {
    infected: boolean;
    reason: "infected" | "no dose" | "immune" | "quarantined" | "already sick" | "unsupported incubation" | "state-defined diagnosis";
    sick?: Sick;
}
/** The host supplies an exposure by disease id and a dose in [0, 1] (the chance this exposure takes; the library has no
 * dose-response). The engine draws incubation, course and the fate of the case (always the same four draws) from the row. */
export declare function expose(s: MedicineState, disease: string, dose: number, o?: ExposureOptions): ExposureResult;
export type Effect = "cure" | "cure-now" | "immunise" | "block-exposure" | "stop-bleeding" | "unquantified";
/** Every treatment row with the effect its column licenses (none for the rows that say no). */
export declare function treatmentEfficacy(): {
    [k: string]: {
        text: string;
        effect: Effect | null;
    };
};
export interface TreatmentResult {
    treatment: string;
    efficacy: "worked" | "unquantified" | "none";
    effect: Effect | null;
    detail: string;
}
export type TreatmentTarget = {
    disease: string;
} | {
    wound: number;
};
/** Apply a treatment. It changes an outcome only where the column says it worked for that target; every other pairing is
 * recorded with efficacy "none" and nothing moves (and no random number is drawn). */
export declare function treat(s: MedicineState, treatment: string, target: TreatmentTarget): TreatmentResult;
export interface WoundOptions {
    /** 0 to 1 across the row's bleeding classes; drawn when absent. */
    severity?: number;
    /** A label inside the Heals-in text ("fracture", "concussion"). */
    variant?: string;
    open?: boolean;
    /** Host blood-loss rate and clotting (circulation owns the blood; the library has no wound rate). Both or neither. */
    rateMlMin?: number;
    clotting?: number;
    /** Force the infection outcome (a clean wound); otherwise one roll at the row's chance. */
    infected?: boolean;
    painCause?: string;
    burnedPct?: number;
}
export declare function inflictWound(s: MedicineState, kind: string, o?: WoundOptions): Wound;
export interface HealingFactors {
    /** Host-observed exertion; also pass these factors to anatomyProcess. */
    exerting?: boolean;
    collagenIntegrity?: number;
    proteinGKgDay?: number;
    energyBalanceKcalDay?: number;
    ageYears?: number;
    rest?: boolean;
    workingPart?: boolean;
    dressedDaily?: boolean;
    sleepDebtH?: number;
}
/** The product of the factors that apply (multipliers on healing time); an absent input applies nothing. */
export declare function healingMultiplier(f: HealingFactors): number;
/** Factors the world already holds for a body: collagen integrity, the day's energy balance, the sleep debt. */
export declare function worldHealingFactors(w: World, body: string): HealingFactors;
/** Advance whole days: wounds heal at 1/multiplier of a day a day (paused while infected, reopening at the working-part
 * chance), diseases move through incubation and course, and a due death risk opens a crisis (the host decides). */
export declare function advanceDays(s: MedicineState, days: number, factors?: HealingFactors): void;
/** The host's decision on a crisis. "died" removes the case; "survived" lets the course go on. The engine kills no one. */
export declare function resolveCrisis(s: MedicineState, crisis: Crisis, outcome: "survived" | "died"): void;
/** The band of the worst open wound or gangrene: its id, range and midpoint. No source of pain is 0. */
export declare function painLevel(s: MedicineState): {
    band: string;
    min: number;
    max: number;
    level: number;
} | {
    band: null;
    min: number;
    max: number;
    level: number;
};
export interface AirState {
    airO2Pct?: number;
    sao2?: number;
    paco2Mmhg?: number;
    airCo2Pct?: number;
    cohb?: number;
    smokeMgM3?: number;
    so2Ppm?: number;
    h2sPpm?: number;
    lowPressureDays?: boolean;
    driveFailing?: boolean;
}
/** Each condition is a pattern of the body's states, never a timer. The stage counts the course thresholds crossed; hypoxia
 * under its death threshold, and respiratory failure, are the conditions that open a crisis. */
export declare function airConditions(s: MedicineState, a: AirState): Record<string, number>;
/** Everything by library id: the stage of each disease (0 well, 1 incubating, 2 ill), open and infected wounds by kind, the
 * pain band and level, lasting-harm flags, immunity, and the crisis count. */
export declare function medicineOutputs(s: MedicineState): Record<string, string | number | null>;
/** Run after circulation and anatomy: open wounds with a host rate bleed through circulation's `bleed` (traced and checked there), the
 * disease and healing clocks advance a day at a time, and the outputs are published on the body. */
export declare function medicineProcess(s: MedicineState, factors?: HealingFactors, every?: number): Process;
export {};
