/** Daily energy supply from the existing physiology and nutrition rules; no state or events. */
import type { Component } from "./registry.ts";
import { absorbedFraction, type Food } from "./nutrition.ts";
export interface EnergyScheduleEntry {
    met: number;
    seconds: number;
}
export interface EnergyRequirementOptions {
    food?: Food;
    meal?: Parameters<typeof absorbedFraction>[2];
}
export interface EnergyRequirementResult {
    /** kcal per person-day, null when physiology cannot determine the resting rate. */
    absorbedKcal: number | null;
    /** kcal per person-day in foods.kcalPerKg's basis; null without both food and meal.
     * Zero absorption gives Infinity for a positive requirement: no finite ration suffices. */
    foodKcal: number | null;
    /** The library's statement of the food energy basis, or "unstated (LIFE-17)". */
    basis: string;
    /** Uncosted CG-14 terms: this estimate is a floor where these apply. */
    omitted: string[];
}
export interface HouseholdRequirementResult {
    /** kcal per household-day; each total is null if any corresponding member value is null. */
    absorbedKcal: number | null;
    foodKcal: number | null;
    /** Zero-based input indices, separately for each unavailable quantity. */
    nullMembers: {
        absorbedKcal: number[];
        foodKcal: number[];
    };
}
/**
 * Integrate a host-supplied 86,400-second day at this body's current mass and resting rate.
 * This is physiology's expenditure integral with body inputs held fixed, not a forecast of
 * within-day mass changes. No activity default or missing-demographic fallback is supplied.
 */
export declare function energyRequirement(body: Pick<Component, "mass" | "props">, schedule: readonly EnergyScheduleEntry[], o?: EnergyRequirementOptions): EnergyRequirementResult;
/** Sum per-person results; unavailable quantities propagate independently. An empty household needs zero. */
export declare function householdRequirement(members: readonly EnergyRequirementResult[]): HouseholdRequirementResult;
