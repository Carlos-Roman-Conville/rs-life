/**
 * Breathing: inspired air becomes respiratory state, body gas exchange, exposure and COHb.
 * Library formulas and calculator coefficients are moved unchanged from atmosphere.ts.
 * Atmosphere supplies room gas fractions, gas units and the single traced transfer through applyGasFlows.
 * Outputs on body.props.outputs: o2_frac, co2_ppm, co_ppm, sao2, cohb, ventilation_l_min,
 * pressure_mmhg, inspired_po2_mmhg, alveolar_po2_mmhg and paco2_mmhg.
 */
import type { Process } from "./scheduler.ts";
import type { Component } from "./registry.ts";
import { type GasFlows } from "./atmosphere.ts";
/**
 * Coefficients of the host dashboard's respiratory calculator (`resp`, body/dashboard.html) that no library table carries.
 * They are illustrative placeholders there (its caption says so); FLAGS.md lists each as a NOTE.
 */
export declare const CALCULATOR: {
    readonly aaGradientMmHg: 7;
    readonly co2Retention: 0.7;
    readonly hypoxicDropPerMmHg: 0.5;
    readonly hypoxicDropMaxMmHg: 15;
    readonly paco2FloorMmHg: 25;
    readonly hypoxicCo2LimitFrac: 0.02;
    readonly cohbEqCap: 0.8;
};
/** Alveolar gas equation (ATM-ALV): PAO2 = FiO2 (P - 47) - PaCO2 / 0.8, mmHg, not below zero. */
export declare function alveolarPO2(o2Frac: number, pressureMmHg: number, paco2MmHg: number): number;
/** The respiratory profile of a species (`anatomy.respiratory`): the human defaults come from the library; a species overrides fields. */
export interface RespiratoryProfile {
    medium: "air" | "water" | "other";
    maxVentilationLMin: number;
    aaGradientMmHg: number;
    restingVentilationLMin: number;
    ventilationPerMlVo2: number;
    vo2OffsetMlMin: number;
}
/** The human profile; `over` replaces fields for another species. */
export declare function respiratoryProfile(over?: Partial<RespiratoryProfile>): RespiratoryProfile;
export interface InspiredAir {
    pressureMmHg: number;
    o2Frac: number;
    co2Frac: number;
    coPpm: number;
}
export interface RespiratoryState {
    vo2MlMin: number;
    inspiredPO2MmHg: number;
    paco2MmHg: number;
    alveolarPO2MmHg: number;
    arterialPO2MmHg: number;
    sao2: number;
    ventilationLMin: number;
    cohbEq: number;
    cohbHalfTimeMin: number;
}
/**
 * The respiratory side for one body in one air: minute ventilation from the MET, the CO2 drive (x2 per 5 mmHg of PaCO2 over
 * 40, capped at the profile's maximum and held at the library's 70 mmHg where the drive fails) and the hypoxic drive, then the
 * alveolar gas equation, the A-a gradient and the Severinghaus curve; carbon monoxide gives no drive. The calculator's rules
 * for the retained inspired CO2 and the hypoxic drive are in `CALCULATOR`.
 */
export declare function respiratoryState(air: InspiredAir, met: number, massKg: number, profile?: RespiratoryProfile): RespiratoryState;
/** Respiratory state using the same oxygen demand (mL/min) as the body's gas exchange. */
export declare function respiratoryStateFromVo2(air: InspiredAir, vo2: number, profile?: RespiratoryProfile): RespiratoryState;
/** COHb after `minutes`: it approaches its equilibrium with the half-time the ventilation sets (uptake is faster at work). */
export declare function cohbAfter(cohb: number, coPpm: number, ventilationLMin: number, minutes: number): number;
/** Species susceptibility data only; medicine owns diagnosis and consequences. */
export declare function gasTolerances(): {
    hypoxiaO2Pct: number;
    hypercapniaCo2Pct: number;
};
export interface GasThreshold {
    at: number;
    unit: "%" | "ppm";
    falling: boolean;
    effect: string;
}
/** The inhalation effect thresholds of a gas (`chemistry.substances`): "1% drowsy; 3% headache" as {at, unit, falling, effect}. */
export declare function gasThresholds(gas: string): GasThreshold[];
/** A threshold in ppm. */
export declare const thresholdPpm: (t: GasThreshold) => number;
/**
 * The gases a body exchanges from metabolic power in W: physiology supplies oxygen L/min and the respiratory quotient
 * (0.8) sets CO2. With no RMR inputs, 70 kg at 1 MET matches the person row (0.25 O2, 0.2 CO2) to 2%; 28 kg matches
 * the goat row's 0.1. Physiology handles breath water and sweat.
 */
export declare function bodyGasFlows(metabolicW: number): GasFlows;
/** Gases tracked as `<gas>ppm` on a room and `<gas>ppmMin` on a body, besides the standard five. */
export declare const EXPOSURE_GASES: readonly ["co2", "co", "h2s", "so2", "ch4", "h2"];
/**
 * Exposure integration for a body in a room: ppm-minutes of each gas the room reports (`<gas>ppm` on the room, `<gas>ppmMin`
 * summed on the body) and the peak (`<gas>ppmPeak`). Carbon dioxide reads ambient (400) and carbon monoxide zero where the room
 * reports none, as physiology did before this moved here.
 */
export declare function accumulateExposure(body: Component, room: Component, dt: number): void;
export interface BreathingOptions {
    met?: number;
    every?: number;
    profile?: RespiratoryProfile;
}
/**
 * A body breathing the room's air. Each step: the body takes O2 from the room and gives CO2 back (`bodyGasFlows` at
 * `outputs.metabolic_w` from physiology, else the `met` option through `metabolicRateW`), then the respiratory state of the room's air is written as outputs
 * by id and COHb moves toward its equilibrium. A profile whose medium is not air has no exchange and null outputs (gills and
 * water are not modelled: FLAGS.md). Place it after `roomAirProcess`.
 */
export declare function breathingProcess(body: string, room: string, o?: BreathingOptions): Process;
