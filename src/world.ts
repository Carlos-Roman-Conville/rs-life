/** The world: a registry, a graph, a trace, the clock, and the conservation ledger the trace checks each step. */
import { Registry, type Component } from "./registry.ts";
import { Graph } from "./graph.ts";
import { Trace } from "./trace.ts";
import { atomicMass, formulaAtoms } from "./elements.ts";

export class World {
  t = 0; // seconds
  registry: Registry;
  graph = new Graph();
  trace = new Trace(count => this.moveTraceCursors(count));
  /** Quantities whose total across named components must stay constant (plus recorded flows out of the system). */
  conserved: { quantity: string; substance?: string; components: string[]; initial: number; tolerance: number; entered: number; left: number }[] = [];
  private conservedCarries = new WeakMap<World["conserved"][number], { entered: number; left: number }>();
  private cursor = 0; // the first transfer not yet folded into the conserved tallies
  private elements: { element: string; components: string[]; initial: number; tolerance: number; net: number; carry: number; cursor: number }[] = [];
  env: Record<string, number> = {};
  constructor(registry: Registry) { this.registry = registry; }

  /** Detached ledger view for comparison; changing it cannot change the world's tallies or cursors. */
  ledgerState() {
    return structuredClone({ conserved: this.conserved,
      conservedCarries: this.conserved.map(c => this.conservedCarries.get(c) ?? { entered: 0, left: 0 }),
      cursor: this.cursor, elements: this.elements });
  }

  /** Validate every ledger consumer before moving any cursor for a trace head removal. */
  private moveTraceCursors(count: number) {
    if (this.cursor < count || this.elements.some(c => c.cursor < count)) {
      throw new Error("trace.compact requires afterStep to consume the removed transfers");
    }
    this.cursor -= count;
    for (const c of this.elements) c.cursor -= count;
  }

  /** Total mass of a substance (all phases) across components. */
  massOf(substance: string, components: string[]): number {
    let m = 0;
    for (const id of components) for (const x of this.registry.component(id).contents) if (x.substance === substance) m += x.mass;
    return m;
  }
  conserve(substance: string, components: string[], tolerance = 1e-6) {
    this.conserved.push({ quantity: `mass:${substance}`, substance, components, initial: this.massOf(substance, components), tolerance, entered: 0, left: 0 });
  }
  /** Moles of an element's atoms: sum of n(substance) * atoms per formula, with n = mass / molarMass.
   * Conservation is checked on atom counts, so it holds for any molar mass the data carries (a reaction's
   * stoichiometric coefficients move whole moles of each substance); mass follows from the counts.
   * Component shells are inert; this ledger covers their reactive contents only.
   */
  elementMolesOf(element: string, components: string[]): number {
    return components.reduce((sum, id) => sum + this.registry.component(id).contents.reduce(
      (m, x) => m + x.mass * this.elementPerKg(x.substance, element), 0), 0);
  }
  private elementPerKg(substance: string, element: string): number {
    const s = this.registry.substance(substance);
    return (s.formula === "" ? 0 : (formulaAtoms(s.formula)[element] ?? 0)) / s.molarMass;
  }
  /** Enrol all registered elements before running processes; checked by every afterStep(). */
  conserveElements(components = [...this.registry.components.keys()], tolerance = 1e-9) {
    const elements = new Set([...this.registry.substances.values()].flatMap(s => s.formula === "" ? [] : Object.keys(formulaAtoms(s.formula))));
    for (const element of elements) {
      if (!atomicMass[element]) throw new Error(`no atomic mass for ${element}`);
      this.elements.push({ element, components: [...components], initial: this.elementMolesOf(element, components),
        tolerance, net: 0, carry: 0, cursor: this.trace.transfers.length });
    }
  }
  /** Neumaier carries retain the low bits lost by each addition, including signed cancellation. */
  private addConserved(c: World["conserved"][number], field: "entered" | "left", amount: number) {
    let carry = this.conservedCarries.get(c);
    if (!carry) { carry = { entered: 0, left: 0 }; this.conservedCarries.set(c, carry); }
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
        if (x.quantity !== c.quantity) continue;
        const f = c.components.includes(x.from), g = c.components.includes(x.to);
        if (f && !g) this.addConserved(c, "left", x.amount); else if (!f && g) this.addConserved(c, "entered", x.amount);
      }
    }
    for (const c of this.conserved) {
      const carry = this.conservedCarries.get(c);
      this.trace.check(this.t, c.quantity, c.initial + (c.entered + (carry?.entered ?? 0)) - (c.left + (carry?.left ?? 0)),
        this.massOf(c.substance!, c.components), c.tolerance);
    }
    for (const c of this.elements) {
      for (; c.cursor < ts.length; c.cursor++) {
        const x = ts[c.cursor];
        // Chemical conversion is internal, not an exchange with an imaginary reservoir.
        if (x.chemicalChange || !x.quantity.startsWith("mass:")) continue;
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
export function addHeat(w: World, c: Component, J: number) { c.temperatureC += J / w.registry.heatCapacity(c); }
