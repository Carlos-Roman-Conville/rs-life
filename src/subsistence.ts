/** Daily energy supply from the existing physiology and nutrition rules; no state or events. */
import type { Component } from "./registry.ts";
import { libraryColumns, libraryTable } from "./library.ts";
import { absorbedFraction, type Food } from "./nutrition.ts";
import { metabolicRateW, restingMetabolicRate } from "./physiology.ts";
import { KCAL_J } from "./physics.ts";

export interface EnergyScheduleEntry { met: number; seconds: number }

export interface EnergyRequirementOptions {
  food?: Food;
  // Meal is private to nutrition; derive its exact public call signature without duplicating it.
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
  nullMembers: { absorbedKcal: number[]; foodKcal: number[] };
}

function foodEnergyBasis(food?: Food): string {
  const columns = libraryColumns("nutrition", "foods");
  const row = food && libraryTable("nutrition", "foods").find(r => r.id === food.id);
  // Prefer an explicit row basis; do not infer Atwater energy merely from a USDA citation.
  const basisColumn = columns.find(c => /^(?:energy|kcal(?:PerKg)?)\s+basis$/i.test(c));
  if (basisColumn && row && typeof row[basisColumn] === "string" && row[basisColumn].trim())
    return row[basisColumn];
  const statesBasis = /\b(?:Atwater|metabolisable|metabolizable|gross energy)\b/i;
  const energyColumn = columns.find(c => /^kcal\b/i.test(c) && statesBasis.test(c));
  if (energyColumn) return energyColumn;
  if (row && typeof row.source === "string" && statesBasis.test(row.source)) return row.source;
  return "unstated (LIFE-17)";
}

/**
 * Integrate a host-supplied 86,400-second day at this body's current mass and resting rate.
 * This is physiology's expenditure integral with body inputs held fixed, not a forecast of
 * within-day mass changes. No activity default or missing-demographic fallback is supplied.
 */
export function energyRequirement(body: Pick<Component, "mass" | "props">,
  schedule: readonly EnergyScheduleEntry[], o: EnergyRequirementOptions = {}): EnergyRequirementResult {
  let seconds = 0;
  for (const entry of schedule) {
    if (!Number.isFinite(entry.seconds) || entry.seconds < 0 || !Number.isFinite(entry.met) || entry.met < 0)
      throw new Error("subsistence: schedule MET and seconds must be finite and nonnegative");
    seconds += entry.seconds;
  }
  if (seconds !== 86400) throw new Error("subsistence: schedule must sum to 86400 seconds");
  const rmr = restingMetabolicRate(body);
  const absorbedKcal = rmr === null ? null : schedule.reduce(
    (sum, entry) => sum + metabolicRateW(entry.met, body, rmr) * entry.seconds / KCAL_J, 0);
  const foodKcal = absorbedKcal === null || !o.food || !o.meal ? null
    : absorbedKcal / absorbedFraction("energy", o.food, o.meal);
  return { absorbedKcal, foodKcal, basis: foodEnergyBasis(o.food),
    omitted: ["growth", "thermoregulation", "pregnancy", "lactation"] };
}

/** Sum per-person results; unavailable quantities propagate independently. An empty household needs zero. */
export function householdRequirement(members: readonly EnergyRequirementResult[]): HouseholdRequirementResult {
  let absorbedKcal = 0, foodKcal = 0;
  const nullMembers: HouseholdRequirementResult["nullMembers"] = { absorbedKcal: [], foodKcal: [] };
  members.forEach((member, i) => {
    if (member.absorbedKcal === null) nullMembers.absorbedKcal.push(i);
    else absorbedKcal += member.absorbedKcal;
    if (member.foodKcal === null) nullMembers.foodKcal.push(i);
    else foodKcal += member.foodKcal;
  });
  return { absorbedKcal: nullMembers.absorbedKcal.length ? null : absorbedKcal,
    foodKcal: nullMembers.foodKcal.length ? null : foodKcal, nullMembers };
}
