/**
 * Service 1: the registry. Stable ids for substances (properties only, never behaviour), materials (what a component is
 * made of), components (equipment, organs, structures: a thermal mass with contents and ports) and assemblies.
 */
import substanceData from "../data/substances.json" with { type: "json" };
import materialData from "../data/materials.json" with { type: "json" };

export type Phase = "solid" | "liquid" | "gas";

export interface Substance {
  id: string;
  name: string;
  molarMass: number;          // kg/mol
  formula: string;            // chemical formula, e.g. "C2H5OH"
  cp: Partial<Record<Phase, number | null>>; // J/(kg K) by phase
  hhv?: number | null;        // J/kg higher heating value if a fuel
  lhv?: number | null;        // J/kg lower heating value if a fuel
  density?: Partial<Record<Phase, number | null>>; // kg/m3 by phase, at the condition in the data row's note
  meltingPointC?: number | null;  // at 1 atm; null where none is standard
  boilingPointC?: number | null;
  source: string;             // URL of the reference the row's numbers come from
  provenance: "Historical" | "Anachronistic" | "Prehistoric" | "Mythological" | "Fantasy" | "Science Fiction" | "Original Fiction";
  checked: string;            // what was checked against the source, what matched, and what is unverified
}

export interface Material {
  id: string;
  name: string;
  cp: number;                 // J/(kg K)
  maxTemperatureC: number;    // beyond it the component fails
  corrodedBy: string[];       // substance ids it must not hold
  formula?: string | null;    // null for mixtures and composites
  source: string;             // URL
  provenance: Substance["provenance"];
  checked: string;            // as Substance.checked
}

export type PortKind = "fluid" | "gas" | "heat" | "power" | "mechanical" | "material";

export interface Port {
  id: string;
  kind: PortKind;
  direction: "in" | "out" | "both";
}

/** Condition as three independent properties (gears/equipment-condition.md). 1 = new. */
export interface Condition { capability: number; control: number; accuracy: number }

export interface Contents { substance: string; phase: Phase; mass: number } // kg

export interface Component {
  id: string;
  kind: string;               // heater | vessel | pipe | condenser | tub | collector | room | body | thermometer ...
  material: string;           // Material id
  mass: number;               // kg of the component itself (its thermal mass)
  temperatureC: number;       // one lumped temperature (a simplification the trace names)
  contents: Contents[];
  ports: Port[];
  condition: Condition;
  props: Record<string, number>; // area_m2, U, volume_m3, ach, maxTemperatureC ... per kind
}

export class Registry {
  substances = new Map<string, Substance>();
  materials = new Map<string, Material>();
  components = new Map<string, Component>();

  addSubstance(s: Substance) { this.substances.set(s.id, s); return s; }
  addMaterial(m: Material) { this.materials.set(m.id, m); return m; }
  addComponent(c: Component) {
    if (!this.materials.has(c.material)) throw new Error(`component ${c.id}: unknown material ${c.material}`);
    for (const x of c.contents) if (!this.substances.has(x.substance)) throw new Error(`component ${c.id}: unknown substance ${x.substance}`);
    this.components.set(c.id, c); return c;
  }
  substance(id: string) { const s = this.substances.get(id); if (!s) throw new Error(`unknown substance ${id}`); return s; }
  material(id: string) { const m = this.materials.get(id); if (!m) throw new Error(`unknown material ${id}`); return m; }
  component(id: string) { const c = this.components.get(id); if (!c) throw new Error(`unknown component ${id}`); return c; }

  /** Thermal mass of a component with its contents, J/K. */
  heatCapacity(c: Component): number {
    let cap = c.mass * this.material(c.material).cp;
    for (const x of c.contents) cap += x.mass * (this.substance(x.substance).cp[x.phase] ?? 1000);
    return cap;
  }
  contentMass(c: Component, substance: string, phase?: Phase): number {
    return c.contents.filter(x => x.substance === substance && (!phase || x.phase === phase)).reduce((a, x) => a + x.mass, 0);
  }
  /** Kahan carry per content entry: the low-order bits each `mass +=` rounded away, so thousands of equal small steps onto a
   * large mass (a horse's water, minute after minute for a month) do not drift one way past the ledger's 1e-9. */
  private carry = new WeakMap<Contents, number>();
  addContent(c: Component, substance: string, phase: Phase, kg: number) {
    const x = c.contents.find(y => y.substance === substance && y.phase === phase);
    if (x) {
      const y = kg - (this.carry.get(x) ?? 0), t = x.mass + y;
      this.carry.set(x, (t - x.mass) - y);
      x.mass = t;
    } else c.contents.push({ substance, phase, mass: kg });
    if (x && x.mass < 1e-12) { x.mass = 0; this.carry.delete(x); }
  }
}

/**
 * The default substances and materials, loaded from data/substances.json and data/materials.json (each row cites its
 * source). A game's own data extends these.
 */
export function defaultRegistry(): Registry {
  const r = new Registry();
  for (const s of substanceData.rows) r.addSubstance(s as Substance);
  for (const m of materialData.rows) r.addMaterial(m as Material);
  return r;
}
