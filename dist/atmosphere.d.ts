/**
 * The air: composition, altitude and pressure, gas units, room sources and sinks, and the transport grid.
 * Table numbers come from data/library/{atmosphere,gasdynamics,chemistry}.json through library.ts.
 * Breathing and its physiological library data live in respiration.ts; callers supply gas flows to applyGasFlows.
 *
 * A flow in litres per minute is gas at the room's temperature and pressure (ideal gas, gasdynamics.units),
 * so moles = p V / (R T). Every transfer into or out of a room is traced as mass:<gas>.
 * Unsupported rates remain disabled (null) and are listed in flags/atmosphere.md.
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import type { Component, Contents, Registry } from "./registry.ts";
import type { Trace } from "./trace.ts";
import { type LibraryRow } from "./library.ts";
/** The default outside air's water vapour, kg per kg of dry air (the still's value, process.ts before it moved here). */
export declare const OUTSIDE_WATER_KG_PER_KG = 0.012;
/** Volume fraction to ppm. */
export declare const fractionToPpm: (fraction: number) => number;
/** ppm to volume fraction. */
export declare const ppmToFraction: (ppm: number) => number;
/** Partial pressure in mmHg = fraction x total pressure (mmHg). */
export declare const partialPressureMmHg: (fraction: number, totalMmHg: number) => number;
/** Air changes per hour from a flow in m3 per minute: ACH = flow / volume x 60. */
export declare const achFromFlow: (flowM3PerMin: number, volumeM3: number) => number;
/** The flow in m3 per minute that an ACH is: the inverse of `achFromFlow`. */
export declare const flowFromAch: (ach: number, volumeM3: number) => number;
/** Moles in a volume of litres of gas at p, T (ideal gas; a region's total moles = p V / (R T)). */
export declare const litresToMoles: (litres: number, pPa: number, tC: number) => number;
/** kg of a registry gas in litres of gas at p, T. */
export declare function litresToKg(reg: Registry, gas: string, litres: number, pPa: number, tC: number): number;
/** Exposure of a concentration held for minutes, ppm-min. */
export declare const ppmMinutes: (ppm: number, minutes: number) => number;
/** Inhaled dose, L = VE (L/min) x fraction x minutes x uptake fraction (`gasdynamics.units` exposure). The uptake is the caller's (CHEMISTRY). */
export declare const inhaledDoseLitres: (veLMin: number, fraction: number, minutes: number, uptake: number) => number;
/** The baseline air's volume fractions (library `atmosphere.baseline`): oxygen and CO2 from the rows, nitrogen fills the balance. */
export declare function baselineAir(): {
    o2: number;
    n2: number;
    co2: number;
};
export interface AirAt {
    pressurePa: number;
    pressureMmHg: number;
    inspiredPO2MmHg: number;
}
/** The air at an altitude: the standard-atmosphere pressure and the inspired PO2 = FiO2 (P - 47 mmHg) once the airways saturate it. */
export declare function altitudeAir(altitudeM: number, o2Frac?: number): AirAt;
/** The altitude table's row nearest an altitude. */
export declare function altitudeRow(altitudeM: number): LibraryRow;
/** `chemistry.substances` "Density vs air" of a gas (registry id; water vapour is `h2o_v` there), or null where the row has none. */
export declare function densityVsAir(gas: string): number | null;
/**
 * The ppm a person at a height of an unmixed box reads: the heavier gases of `gasdynamics.box_model` (those the row names) read
 * x1.5 the mean low and x0.5 high (placeholder factors from that row); a mixed box, or any other gas, reads the mean.
 */
export declare function layeredPpm(gas: string, meanPpm: number, layer: "low" | "high", mixed: boolean): number;
/** The room's air as a component: its contents are the gases (kg), its temperature the air's; props volume_m3, ach, pressurePa. */
export declare function roomGasFraction(w: World, room: Component, gas: string): number;
/** Standard outside air as gas contents for a volume at p, T: the baseline fractions, plus water at kg per kg of air. */
export declare function airContents(volumeM3: number, pressurePa: number, tC: number, waterKgPerKgAir?: number): Contents[];
/**
 * The room's box model: ventilation exchanges its gases and heat with the outside at ACH (V dC/dt = -Q (C - C_out), with the
 * sources added by `sourcesProcess` and `breathingProcess`); humidity from its vapour. Any gas the room holds beyond the standard
 * five is carried out at zero outside. Sets `rh`, `co2ppm`, `o2frac`, `coppm` (and `<gas>ppm` for the others it holds).
 */
export declare function roomAirProcess(room: string): Process;
/** A flow of gases into (+) or out of (-) a room, litres per minute at the room's own conditions, keyed by registry gas id. */
export type GasFlows = Record<string, number>;
export interface GasSource {
    id: string;
    flows: GasFlows | ((w: World) => GasFlows);
}
/** A lamp or candle, each: O2 -0.03 L/min, CO2 +0.03 (the row). Its CO "if it gutters" has no rate (FLAGS.md). */
export declare function lampFlows(count?: number): GasFlows;
/** A fire with its row's example rates (a cargo fire: 100 L/min CO2, 20 CO); oxygen follows from the carbon: C + O2 and 2C + O2, so O2 = CO2 + CO / 2. */
export declare function fireFlows(scale?: number): GasFlows;
/** Rot in the bilge: H2S at its row's rate, L/min (a foul bilge). The CH4 and CO2 of rot have no rate (FLAGS.md). */
export declare function rotFlows(): GasFlows;
/** A stinkpot burning grams of sulphur a minute: the row's 70 L of SO2 per 100 g, one mole of O2 for each of SO2 (S8 + 8 O2). */
export declare function sulphurFlows(gramsPerMin: number): GasFlows;
/**
 * Move gases between a room and a named outside (a fire, a body, a lamp): litres at the room's conditions to kg, traced as
 * `mass:<gas>` from the source to the room (or room to sink). A consumption is limited to what the room holds.
 */
export declare function applyGasFlows(w: World, room: string, flows: GasFlows, dt: number, process: string, other: string): void;
/** Sources and sinks on a room: each step every source's flows go through `applyGasFlows`. */
export declare function sourcesProcess(room: string, sources: GasSource[], every?: number): Process;
/** A regular grid the host supplies: columns on a lateral lattice with elevation, levels (decks) stacked on them, enclosure per cell. */
export interface GridSpec {
    nx: number;
    ny: number;
    nz?: number;
    cellM: number;
    levelM: number;
    pressurePa: number;
    temperatureC: number;
    elevationM?: (x: number, y: number) => number;
    enclosed?: (x: number, y: number, z: number) => boolean;
    ach?: (x: number, y: number, z: number) => number;
    species?: string[];
}
/** The fractions per step the library does not give; the host supplies them. `null` switches that transport off (FLAGS.md). */
export interface GridRates {
    windMS?: [number, number];
    diffusion?: number | null;
    rise?: number | null;
    settle?: number | null;
}
interface Ledger {
    initial: number;
    in: number;
    out: number;
    source: number;
}
/**
 * Host-supplied grid of cells with a mass of each tracked gas in each. Per step (explicit, operator-split; a cell per step at
 * most): advection by the wind (upwind, open cells; enclosed cells block it and exchange with the outside at their ACH),
 * diffusion by a fraction per step, buoyancy up a level for gases lighter than air and settling downhill or down a level for
 * heavier ones (the excess over the background only). Gas enters and leaves only through the wind boundary, the ACH exchange
 * and `release`; each is on the ledger and traced, and `balance` is zero when mass is conserved per species. Cells are
 * equal; the box model takes over when `uniform()` (every species within the library's 10% of its mean).
 */
export declare class Grid {
    readonly nx: number;
    readonly ny: number;
    readonly nz: number;
    readonly cells: number;
    readonly species: string[];
    readonly spec: GridSpec;
    readonly kg: Record<string, Float64Array>;
    readonly background: Record<string, number>;
    readonly ledger: Record<string, Ledger>;
    private readonly ground;
    private readonly enclosed;
    private readonly ach;
    private readonly molar;
    private readonly density;
    constructor(reg: Registry, spec: GridSpec);
    cellVolume(): number;
    at(x: number, y: number, z?: number): number;
    coords(i: number): [number, number, number];
    elevation(i: number): number;
    /** Total kg of a species across the grid. */
    total(sp: string): number;
    /** The mole fraction of a species in a cell, in ppm of the tracked gases' moles. */
    ppm(sp: string, i: number): number;
    /** initial + in + sources - out - total: zero (to rounding) when the species is conserved. */
    balance(sp: string): number;
    /** Put kg of a species into a cell (a fire, a vent, a shot); traced as `mass:<gas>` from the source to the grid. */
    release(sp: string, x: number, y: number, z: number, kg: number, label: string, trace?: Trace, t?: number): void;
    /** Every species within `tol` (default the library's 10%) of its mean over the cells: the box model can take over. */
    uniform(tol?: number): boolean;
    /** The grid as one box: its total volume and gas contents, to load into a room component when `uniform()`. */
    asBox(): {
        volume_m3: number;
        contents: Contents[];
    };
    /** The ppm a body standing in a cell is exposed to this step, summed on its props as `<gas>ppmMin` (crouching reads the lower half). */
    expose(body: Component, i: number, dt: number, layer?: "low" | "high" | null): void;
    private neighbours;
    private open;
    /** One step of dt seconds. Throws where the diffusion share would be unstable (6 x share over 1). */
    step(dt: number, rates?: GridRates, trace?: Trace, t?: number): void;
}
/** A grid as a scheduled process: steps it every `every` fast steps with the world's trace and clock. */
export declare function gridProcess(grid: Grid, rates: GridRates | ((w: World) => GridRates), every?: number): Process;
export {};
