export type Phase = "solid" | "liquid" | "gas";
export interface Substance {
    id: string;
    name: string;
    molarMass: number;
    formula: string;
    cp: Partial<Record<Phase, number | null>>;
    hhv?: number | null;
    lhv?: number | null;
    density?: Partial<Record<Phase, number | null>>;
    meltingPointC?: number | null;
    boilingPointC?: number | null;
    source: string;
    provenance: "Historical" | "Anachronistic" | "Prehistoric" | "Mythological" | "Fantasy" | "Science Fiction" | "Original Fiction";
    checked: string;
}
export interface Material {
    id: string;
    name: string;
    cp: number;
    maxTemperatureC: number;
    corrodedBy: string[];
    formula?: string | null;
    source: string;
    provenance: Substance["provenance"];
    checked: string;
}
export type PortKind = "fluid" | "gas" | "heat" | "power" | "mechanical" | "material";
export interface Port {
    id: string;
    kind: PortKind;
    direction: "in" | "out" | "both";
}
/** Condition as three independent properties (gears/equipment-condition.md). 1 = new. */
export interface Condition {
    capability: number;
    control: number;
    accuracy: number;
}
export interface Contents {
    substance: string;
    phase: Phase;
    mass: number;
}
export interface Component {
    id: string;
    kind: string;
    material: string;
    mass: number;
    temperatureC: number;
    contents: Contents[];
    ports: Port[];
    condition: Condition;
    props: Record<string, number>;
}
export declare class Registry {
    substances: Map<string, Substance>;
    materials: Map<string, Material>;
    components: Map<string, Component>;
    addSubstance(s: Substance): Substance;
    addMaterial(m: Material): Material;
    addComponent(c: Component): Component;
    substance(id: string): Substance;
    material(id: string): Material;
    component(id: string): Component;
    /** Thermal mass of a component with its contents, J/K. */
    heatCapacity(c: Component): number;
    contentMass(c: Component, substance: string, phase?: Phase): number;
    /** Kahan carry per content entry: the low-order bits each `mass +=` rounded away, so thousands of equal small steps onto a
     * large mass (a horse's water, minute after minute for a month) do not drift one way past the ledger's 1e-9. */
    private carry;
    addContent(c: Component, substance: string, phase: Phase, kg: number): void;
}
/**
 * The default substances and materials, loaded from data/substances.json and data/materials.json (each row cites its
 * source). A game's own data extends these.
 */
export declare function defaultRegistry(): Registry;
