import { type DiseaseOutcomeDay } from "./medicine.ts";
import type { Trace } from "./trace.ts";
export declare const COHORTS: readonly ["children", "adultsM", "adultsF", "elders"];
export type CohortName = typeof COHORTS[number];
/** Rates the host supplies, per year (the `rates table` the tick rows read). */
export interface Rates {
    /** Births per adult woman per year. */
    birthRate: number;
    /** Background deaths per person per year; the elders' rate is the row's multiple of it. */
    deathRate: number;
    /** Share of children who become men on reaching 15 (the table gives the move, not the sex split). */
    childMaleShare: number;
}
export interface Epidemic {
    disease: string;
    startDay: number;
    /** Share of the susceptible pool newly sick per day (the disease's catch rate: the host's). */
    catchRate: number;
    /** Exposure batches and their medicine-owned outcome probabilities by day since exposure. */
    batches: {
        day: number;
        n: Record<CohortName, number>;
        outcomes: DiseaseOutcomeDay[];
    }[];
    /** Resident pool at outbreak start; transients are outside the epidemic. */
    initialPool: number;
    /** Members of that pool neither initially seasoned nor caught in this outbreak. */
    susceptible: number;
    /** Share of the initial pool caught so far, including recovered and dead cases. */
    caught: number;
}
export interface Population {
    day: number;
    children: number;
    adultsM: number;
    adultsF: number;
    elders: number;
    /** Fraction of adults immune to the local fevers. */
    seasonedShare: number;
    transient: number;
    /** Mean body condition, 0 to 1. */
    health: number;
    /** Stores against need; the tick takes one a day and the host adds. */
    foodDays: number;
    epidemic: Epidemic | null;
    /** Total of people ever entering and leaving, by cause. */
    ledger: {
        births: number;
        arrivals: number;
        deaths: Record<string, number>;
        departures: number;
    };
}
export declare function createPopulation(c: Partial<Pick<Population, CohortName | "seasonedShare" | "transient" | "health" | "foodDays">>): Population;
export declare const total: (p: Population) => number;
export declare const adults: (p: Population) => number;
/** Starts a first-infection outbreak in the current resident pool. Exposure runs through the row's
 * maximum course day; incubation and each case's course continue afterwards. The host gives the catch rate. */
export declare function startEpidemic(p: Population, disease: string, catchRate: number): Epidemic;
export interface TickOptions {
    /** New transient people this day (ships in port x crew share ashore), and those who sail. */
    arrivals?: number;
    transientLeaving?: number;
    /** Settlers: prosperity x reputation x the row's 0.001 a day join the adults; `settlerMaleShare` splits them. */
    prosperity?: number;
    reputation?: number;
    settlerMaleShare?: number;
    /** Adults leaving this day, by sex (fear of fever, the dying port). */
    leaversM?: number;
    leaversF?: number;
    /** Where in the disease row's risk range new cases fall (0 low .. 1 high). Default the middle. */
    riskAt?: number;
    trace?: Trace;
}
export interface TickResult {
    births: number;
    backgroundDeaths: Record<CohortName, number>;
    epidemicDeaths: Record<CohortName, number>;
    newCases: number;
    /** Expected person-days of illness during this tick, excluding incubation and ending at death or recovery. */
    illnessDays: number;
    aged: {
        toAdults: number;
        toElders: number;
    };
    arrivals: number;
    departures: number;
    famine: boolean;
}
/** The row's famine terms: health -0.02 a day, births x0.5, deaths x1.5. */
export declare function famineRule(): {
    healthLoss: number;
    birthsFactor: number;
    deathsFactor: number;
};
/** Daily moves between cohorts: 1/5475 of children (15 years) and 1/12,775 of adults (the 35 years from 15 to 50). */
export declare function ageingRates(): {
    toAdults: number;
    toElders: number;
};
export declare const elderDeathFactor: () => number;
export declare const settlersPerDay: (prosperity: number, reputation: number) => number;
/** One day, in the order of the tick table: births, background deaths, epidemic, ageing, food, migration. Rates act on the
 * counts at the start of the day. */
export declare function tick(p: Population, rates: Rates, o?: TickOptions): TickResult;
export interface LabourRow {
    category: string;
    persons: number;
    personHours: number;
}
export interface LabourSupply {
    /** The population's supply today by category (adult men, adult women, elders, children: Reality's
     *  categories); persons = cohort × health × (1 − sick share), health applied once; personHours = persons ×
     *  the host's hours per day (one number, Settlement's `hoursPerDay`, SET-12). */
    supply(day: number): LabourRow[];
    /** False while a person is aboard, dead or away: the host knows, the engines do not. */
    available(person: string, day: number): boolean;
    /** Person-hours a person or a pool has left after the day's grants (CONTRACTS section 18). */
    hours(source: string, role: string, day: number): number;
    /** Person-hours a pool grants a post today: at most `wantedHours` and at most what it has not granted yet. */
    draw(pool: string, role: string, requires: unknown, wantedHours: number, day: number): number;
    /** 0..n output factor of a holder in a role; the host maps skill bands to it. */
    productivity(holder: string, role: string): number;
}
/** Section 19 extends the shared section 16 block without changing its declaration. */
export interface LabourSupply {
    /** The least wage, in money per filled post-day (as `Post.wage`), a named person asks for a role today; null
     *  when none is stated. The host answers it from the person's latest `work` intention (`terms.wage_min`). */
    reservationWage?(person: string, role: string, day: number): number | null;
}
/** Pool supply, hours and draw use person*h. Categories use COHORTS ids.
 * Queries read the current population; day keys grants, not historical population snapshots.
 * P1 is role-blind: roles and requires are host concerns until occupations exist.
 * Throws at construction when two pools share a category, preventing duplicate grants.
 * Keep one provider instance for a population's allocation session. */
export declare function populationLabourSupply(p: Population, o: {
    hoursPerDay: number;
    pools: Record<string, string[]>;
}): Pick<LabourSupply, "supply" | "hours" | "draw">;
/** Outputs by library id. Adult labour is person*h, with required host hoursPerDay.
 * Living symptomatic cases are excluded per cohort, then health is applied once. */
export declare function populationOutputs(p: Population, hoursPerDay: number): {
    "population.cohorts.children": number;
    "population.cohorts.adults-m-adults-f": number;
    "population.cohorts.elders": number;
    "population.cohorts.seasoned-share": number;
    "population.cohorts.transient": number;
    "population.cohorts.health": number;
    "population.cohorts.food-days": number;
    "population.cohorts.epidemic": {
        disease: string;
        day: number;
    } | null;
    "population.cohorts.labour": number;
};
