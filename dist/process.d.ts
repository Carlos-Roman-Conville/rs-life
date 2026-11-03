/**
 * Service 3: the conservation and process engine. Each process moves a quantity along the graph by a real formula
 * (physics.ts) and records every transfer in the trace. Lumped, explicit, per-step: the first build's simplification.
 */
import type { Process } from "./scheduler.ts";
import { roomGasFraction } from "./atmosphere.ts";
export { roomGasFraction };
/** A seeded random for reproducible control noise and measurement noise (mulberry32), from the kernel. */
export { rng } from "@rex/kernel";
/**
 * Operator control: the fuel feed oscillates around the target with an amplitude set by skill (0 to 100). Skill never
 * changes the physics; it changes how close the feed stays to the target (Rex's principle).
 */
export declare function controlProcess(heater: string, targetKgPerS: number, skill: number, rand: () => number): Process;
/** Combustion at the heater: burns the fed charcoal with the room's oxygen, heat to the vessel (heat edge) and the rest to the room. */
export declare function combustionProcess(heater: string, room: string): Process;
/** Convective losses from every component with props.area_m2 and props.h to the room's air. */
export declare function lossesProcess(room: string, components: string[]): Process;
/** Free-surface evaporation below boiling: ASHRAE coefficient in physics.ts.
 * Vapour enters room air; latent heat is removed from the vessel. Explicit lumped step.
 */
export declare function evaporationProcess(vessel: string, room: string): Process;
/** Lumped wall: h A (Tair-Twall), then U_out A (Twall-Toutside).
 * The tabulated whole-wall U includes the indoor film; remove 1/h from its resistance
 * so the explicit indoor film is not counted twice. Sources: BRICK_WALL in physics.ts.
 */
export declare function wallsProcess(room: string, walls: string): Process;
/**
 * Boiling in a vessel: when the water's vapour pressure reaches the pressure over it, the temperature holds at the boiling
 * point and the surplus heat vaporises water at the latent heat; the vapour goes down the gas edge to the condenser.
 */
export declare function boilingProcess(vessel: string, room: string): Process;
/** Counterflow condenser with isothermal steam (Cr=0): epsilon=1-exp(-UA/Ccold).
 * Coolant recirculates from and returns to the lumped tub; no external cold-water supply.
 * Water-side natural convection sets U; small circulation's forced-convection enhancement
 * is neglected. Liquid leaves at saturation temperature (no subcooling section), then mixes
 * with the collector. Sources and property approximations are in physics.ts.
 */
export declare function condensationProcess(condenser: string, tub: string, collector: string, room: string): Process;
/** The room's box model: ventilation exchanges its gases and heat with the outside at ACH; humidity from its vapour. It lives in atmosphere.ts. */
export declare function roomProcess(room: string): Process;
/** A thermometer on a component: reading = true + offset(drift x days) + noise(sigma); accuracy condition widens sigma. */
export declare function thermometerProcess(thermometer: string, target: string, daysSinceCalibration: number, rand: () => number): Process;
/** Wear: a vessel at heat loses control and capability slowly; a condenser scales; placeholders by material (SCIENTIFIC_EQUIPMENT 4). */
export declare function wearProcess(components: string[]): Process;
