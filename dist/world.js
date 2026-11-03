/** The world: a registry, a graph, a trace, the clock, and the conservation ledger the trace checks each step. */
import { Registry } from "./registry.js";
import { Graph } from "./graph.js";
import { Trace } from "./trace.js";
import { atomicMass, formulaAtoms } from "./elements.js";
export class World {
    t = 0; // seconds
    registry;
    graph = new Graph();
    trace = new Trace(count => this.moveTraceCursors(count));
    /** Quantities whose total across named components must stay constant (plus recorded flows out of the system). */
    conserved = [];
    conservedCarries = new WeakMap();
    cursor = 0; // the first transfer not yet folded into the conserved tallies
    elements = [];
    env = {};
    constructor(registry) { this.registry = registry; }
    /** Detached ledger view for comparison; changing it cannot change the world's tallies or cursors. */
    ledgerState() {
        return structuredClone({ conserved: this.conserved,
            conservedCarries: this.conserved.map(c => this.conservedCarries.get(c) ?? { entered: 0, left: 0 }),
            cursor: this.cursor, elements: this.elements });
    }
    /** Validate every ledger consumer before moving any cursor for a trace head removal. */
    moveTraceCursors(count) {
        if (this.cursor < count || this.elements.some(c => c.cursor < count)) {
            throw new Error("trace.compact requires afterStep to consume the removed transfers");
        }
        this.cursor -= count;
        for (const c of this.elements)
            c.cursor -= count;
    }
    /** Total mass of a substance (all phases) across components. */
    massOf(substance, components) {
        let m = 0;
        for (const id of components)
            for (const x of this.registry.component(id).contents)
                if (x.substance === substance)
                    m += x.mass;
        return m;
    }
    conserve(substance, components, tolerance = 1e-6) {
        this.conserved.push({ quantity: `mass:${substance}`, substance, components, initial: this.massOf(substance, components), tolerance, entered: 0, left: 0 });
    }
    /** Moles of an element's atoms: sum of n(substance) * atoms per formula, with n = mass / molarMass.
     * Conservation is checked on atom counts, so it holds for any molar mass the data carries (a reaction's
     * stoichiometric coefficients move whole moles of each substance); mass follows from the counts.
     * Component shells are inert; this ledger covers their reactive contents only.
     */
    elementMolesOf(element, components) {
        return components.reduce((sum, id) => sum + this.registry.component(id).contents.reduce((m, x) => m + x.mass * this.elementPerKg(x.substance, element), 0), 0);
    }
    elementPerKg(substance, element) {
        const s = this.registry.substance(substance);
        return (s.formula === "" ? 0 : (formulaAtoms(s.formula)[element] ?? 0)) / s.molarMass;
    }
    /** Enrol all registered elements before running processes; checked by every afterStep(). */
    conserveElements(components = [...this.registry.components.keys()], tolerance = 1e-9) {
        const elements = new Set([...this.registry.substances.values()].flatMap(s => s.formula === "" ? [] : Object.keys(formulaAtoms(s.formula))));
        for (const element of elements) {
            if (!atomicMass[element])
                throw new Error(`no atomic mass for ${element}`);
            this.elements.push({ element, components: [...components], initial: this.elementMolesOf(element, components),
                tolerance, net: 0, carry: 0, cursor: this.trace.transfers.length });
        }
    }
    /** Neumaier carries retain the low bits lost by each addition, including signed cancellation. */
    addConserved(c, field, amount) {
        let carry = this.conservedCarries.get(c);
        if (!carry) {
            carry = { entered: 0, left: 0 };
            this.conservedCarries.set(c, carry);
        }
        const sum = c[field], total = sum + amount;
        carry[field] += Math.abs(sum) >= Math.abs(amount) ? (sum - total) + amount : (amount - total) + sum;
        c[field] = total;
    }
    /** The conservation check: current total + what the trace says left the set of components = initial + what entered. */
    afterStep() {
        const ts = this.trace.transfers;
        for (; this.cursor < ts.length; this.cursor++) {
            const x = ts[this.cursor];
            for (const c of this.conserved) {
                if (x.quantity !== c.quantity)
                    continue;
                const f = c.components.includes(x.from), g = c.components.includes(x.to);
                if (f && !g)
                    this.addConserved(c, "left", x.amount);
                else if (!f && g)
                    this.addConserved(c, "entered", x.amount);
            }
        }
        for (const c of this.conserved) {
            const carry = this.conservedCarries.get(c);
            this.trace.check(this.t, c.quantity, c.initial + (c.entered + (carry?.entered ?? 0)) - (c.left + (carry?.left ?? 0)), this.massOf(c.substance, c.components), c.tolerance);
        }
        for (const c of this.elements) {
            for (; c.cursor < ts.length; c.cursor++) {
                const x = ts[c.cursor];
                // Chemical conversion is internal, not an exchange with an imaginary reservoir.
                if (x.chemicalChange || !x.quantity.startsWith("mass:"))
                    continue;
                const from = c.components.includes(x.from), to = c.components.includes(x.to);
                if (from !== to) {
                    const amount = (to ? 1 : -1) * x.amount * this.elementPerKg(x.quantity.slice(5), c.element), total = c.net + amount;
                    c.carry += Math.abs(c.net) >= Math.abs(amount) ? (c.net - total) + amount : (amount - total) + c.net;
                    c.net = total;
                }
            }
            this.trace.check(this.t, `element:${c.element}`, c.initial + (c.net + c.carry), this.elementMolesOf(c.element, c.components), c.tolerance);
        }
    }
}
/** Add heat (J, negative to remove) to a component: its lumped temperature moves by J over its heat capacity. */
export function addHeat(w, c, J) { c.temperatureC += J / w.registry.heatCapacity(c); }
