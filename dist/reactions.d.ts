import type { Phase, Registry } from "./registry.ts";
import type { Process } from "./scheduler.ts";
export interface Reagent {
    substance: string;
    phase: Phase;
    coefficient: number;
}
export interface Reaction {
    id: string;
    name: string;
    reactants: Reagent[];
    products: Reagent[];
    /** minO2: oxygen volume fraction of the vessel's gas below which the reaction does not run. */
    conditions: {
        minimumTemperatureC: number;
        minO2?: number;
        catalyst?: string;
        note: string;
    };
    /** Citation for conditions.minO2: an opened source's URL, or null when the value is a [model] (the note says so). */
    minO2Source?: string | null;
    rate: {
        kind: "complete";
        note: string;
    } | {
        kind: "arrhenius";
        k0PerS: number;
        activationEnergyJPerMol: number;
        source: string;
        note: string;
    };
    heat: number;
    where: string;
    mark: string;
    source: string;
}
export declare const defaultReactions: Reaction[];
/** Heat per kg of the first reactant (the fuel), J/kg, same sign as `heat`; derived from the row, never stored. */
export declare function heatPerKg(reg: Registry, reaction: Reaction): number;
/** Vessel reactions, in record order. Reactants/catalysts must be inside the vessel.
 * k = k0 exp(-Ea/RT): https://goldbook.iupac.org/terms/view/A00446
 * [model] First-order limiting-reagent extent, integrated at frozen step temperature:
 * extent = available * (1-exp(-k dt)); complete fallback is explicitly marked in each record.
 * Hess's law and constant-cp sensible enthalpy, relative to 298.15 K (25 C):
 * https://srd.nist.gov/JPCRD/jpcrdS2Vol11.pdf and each record's formation enthalpies.
 * Endothermic extent is also limited by sensible heat above the minimum temperature.
 * conditions.minO2 is the oxygen volume fraction of the vessel's gas under which the reaction does not run,
 * and a floor: a step's extent is capped so the vessel's oxygen fraction does not fall below it.
 * Named simplifications: constant heat capacities, irreversible reactions, threshold ignition,
 * perfect mixing, no pressure/equilibrium kinetics, instantaneous gas transport along the first
 * outgoing gas edge (no edge means retained gas). Gas carries sensible enthalpy to its receiver.
 */
export declare function reactionProcess(vessel: string, reactions?: readonly Reaction[]): Process;
