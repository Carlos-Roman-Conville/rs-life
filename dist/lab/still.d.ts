import { World } from "../world.ts";
export interface StillOptions {
    altitudeM?: number;
    outsideC?: number;
    waterKg?: number;
    charcoalKg?: number;
    feedKgPerS?: number;
    skill?: number;
    roomM3?: number;
    ach?: number;
    tubKg?: number;
    minutes?: number;
    daysSinceCalibration?: number;
    seed?: number;
}
export interface StillResult {
    world: World;
    boilingPointC: number;
    firstBoilAtS: number | null;
    distillateKg: number;
    lostToRoomKg: number;
    charcoalBurnedKg: number;
    vesselC: number;
    tubC: number;
    roomC: number;
    co2ppm: number;
    o2frac: number;
    coppm: number;
    rh: number;
    bodyC: number;
    waterDeficitPct: number;
    co2ppmMin: number;
    thermometerReading: number;
    thermometerTrue: number;
    vesselCondition: {
        capability: number;
        control: number;
        accuracy: number;
    };
    conservationFailures: number;
    journal: string[];
}
export declare function runStill(o?: StillOptions): StillResult;
