/** The world: a registry, a graph, a trace, the clock, and the conservation ledger the trace checks each step. */
import { Registry, type Component } from "./registry.ts";
import { Graph } from "./graph.ts";
import { Trace } from "./trace.ts";
export declare class World {
    t: number;
    registry: Registry;
    graph: Graph;
    trace: Trace;
    /** Quantities whose total across named components must stay constant (plus recorded flows out of the system). */
    conserved: {
        quantity: string;
        substance?: string;
        components: string[];
        initial: number;
        tolerance: number;
        entered: number;
        left: number;
    }[];
    private conservedCarries;
    private cursor;
    private elements;
    env: Record<string, number>;
    constructor(registry: Registry);
    /** Detached ledger view for comparison; changing it cannot change the world's tallies or cursors. */
    ledgerState(): {
        conserved: {
            quantity: string;
            substance?: string;
            components: string[];
            initial: number;
            tolerance: number;
            entered: number;
            left: number;
        }[];
        conservedCarries: {
            entered: number;
            left: number;
        }[];
        cursor: number;
        elements: {
            element: string;
            components: string[];
            initial: number;
            tolerance: number;
            net: number;
            carry: number;
            cursor: number;
        }[];
    };
    /** Validate every ledger consumer before moving any cursor for a trace head removal. */
    private moveTraceCursors;
    /** Total mass of a substance (all phases) across components. */
    massOf(substance: string, components: string[]): number;
    conserve(substance: string, components: string[], tolerance?: number): void;
    /** Moles of an element's atoms: sum of n(substance) * atoms per formula, with n = mass / molarMass.
     * Conservation is checked on atom counts, so it holds for any molar mass the data carries (a reaction's
     * stoichiometric coefficients move whole moles of each substance); mass follows from the counts.
     * Component shells are inert; this ledger covers their reactive contents only.
     */
    elementMolesOf(element: string, components: string[]): number;
    private elementPerKg;
    /** Enrol all registered elements before running processes; checked by every afterStep(). */
    conserveElements(components?: string[], tolerance?: number): void;
    /** Neumaier carries retain the low bits lost by each addition, including signed cancellation. */
    private addConserved;
    /** The conservation check: current total + what the trace says left the set of components = initial + what entered. */
    afterStep(): void;
}
/** Add heat (J, negative to remove) to a component: its lumped temperature moves by J over its heat capacity. */
export declare function addHeat(w: World, c: Component, J: number): void;
