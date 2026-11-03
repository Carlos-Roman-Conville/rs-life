/**
 * The outdoors as one module: the conditions a host supplies per place and hour (air temperature, humidity, wind, sun, rain; the
 * host owns its climate tables) turned into what bodies and rooms read. Table numbers come from `data/library/environment.json`
 * (`exposure`) through library.ts; Life supplies felt-temperature and immersion readers; what the docs ask for and the library cannot support is in
 * FLAGS.md and left `null` here. Nothing is moved between components, so there is no mass or energy to trace: the module reads
 * conditions and writes outputs.
 *
 * Sources of the formulas:
 * - WBGT: the Australian Bureau of Meteorology's simplified form (the exposure table's own source text names it), which is the
 *   ACSM (1987) approximation: WBGT = 0.567 Ta + 0.393 e + 3.94, Ta in C, e the vapour pressure in hPa, e = RH x 6.105 exp(17.27 Ta
 *   / (237.7 + Ta)). Its stated error against Liljegren's full model was not reachable (FLAGS.md), so `WBGT_ERROR_C` is null. Wind
 *   and sun are not terms of the form; the place's effect on it is the exposure row's "WBGT vs open deck" column.
 * - Diurnal curve: half-cosine interpolation between the day's minimum and maximum, each reached at an hour the host supplies.
 * - Day length and sunburn time: the host supplies the month's row (daylight hours, minutes to burn untanned); the sun is up for
 *   daylight hours centred on 12:00 solar time.
 *
 * Outputs by library id on the place's `props.outputs` (`bodyOutputs`): wbgt_c, air_c, wet, sun_exposure, vector_exposure, and
 * felt_c, wind_felt_ms, daylight_h, is_day (1 or 0), sunburn_min, exposure_row, cold_water_row, and the immersion times in minutes
 * as immersion_exhaustion_min_lo/_hi and immersion_survival_min_lo/_hi.
 * `props.wbgt_c` on the place is what physiology reads.
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { type LibraryRow } from "./library.ts";
import type { Component } from "./registry.ts";
/** The BoM form's coefficients (ACSM 1987 and the Bureau's page); no library table carries them (FLAGS.md NOTE). */
export declare const WBGT_BOM: {
    readonly perAirC: 0.567;
    readonly perVapourHpa: 0.393;
    readonly offsetC: 3.94;
    readonly vapourHpaAt0: 6.105;
    readonly vapourA: 17.27;
    readonly vapourBC: 237.7;
};
/** The stated error of the BoM form against Liljegren's model, C. Null: the figure was not reachable (FLAGS.md). */
export declare const WBGT_ERROR_C: number | null;
/** Vapour pressure in hPa from air temperature (C) and relative humidity (percent), the form the BoM page uses. */
export declare function vapourPressureHpa(airC: number, rhPct: number): number;
/** WBGT of an open, sunlit place by the BoM simplified form, from air temperature (C) and relative humidity (percent). */
export declare function wbgtBom(airC: number, rhPct: number): number;
export interface Exposure {
    id: string;
    row: LibraryRow;
    shade: string;
    windFelt: string;
    wet: string;
    /** The row's "WBGT vs open deck" in C; null where the row is not a number (the cold row) or the delta holds only in the sun and the sun is down. */
    wbgtDeltaC: number | null;
    /** Share of the open sun that reaches the place: 1 for shade "none", 0 for "full", null for the partial words (no number in the library). */
    sunShare: number | null;
    /** The felt wind as a share of the host's wind: 1 for "full", 0 for "none", null for the other words. */
    windShare: number | null;
}
/** Terrain ids of the exposure table, in its order. */
export declare function exposureIds(): string[];
/** One exposure row with its words read. `sun` is whether the sun is up on the place (the "+2 C in the sun" row applies only then). */
export declare function exposure(terrain: string, sun?: boolean): Exposure;
/**
 * Air temperature at an hour (0 to 24, wrapping) on a half-cosine between the day's minimum at `tMinHour` and maximum at
 * `tMaxHour` (tMinHour before tMaxHour), falling again to the same minimum at `tMinHour` the next morning.
 */
export declare function diurnalC(hour: number, maxC: number, minC: number, tMaxHour: number, tMinHour: number): number;
/** Sunrise and sunset hours for a day of `daylightH` hours centred on 12:00. */
export declare function sunHours(daylightH: number): {
    rise: number;
    set: number;
};
/** Whether the sun is up at an hour of the day. */
export declare function isDay(hour: number, daylightH: number): boolean;
/** What the host supplies for a place at an hour. Humidity is a percentage; the host's climate tables stay with the host. */
export interface Conditions {
    airC: number;
    rhPct: number;
    windMS: number;
    sun: boolean;
    rain: boolean;
    /** The month's row: hours of daylight and minutes to burn untanned at noon (environment.sun). Omitted: no day outputs. */
    daylightH?: number;
    sunburnMin?: number;
    hour?: number;
    waterC?: number;
}
export interface PlaceOutputs {
    wbgt_c: number | null;
    air_c: number;
    wet: string;
    sun_exposure: number | null;
    vector_exposure: null;
    felt_c: number | null;
    wind_felt_ms: number | null;
    daylight_h: number | null;
    is_day: boolean | null;
    sunburn_min: number | null;
    exposure_row: string;
    cold_water_row: string | null;
    immersion_exhaustion_min: {
        lo: number;
        hi: number;
    } | null;
    immersion_survival_min: {
        lo: number;
        hi: number;
    } | null;
}
/** Life supplies these readers; the place module does not own body response formulas or tables. */
export interface ExposureReaders {
    windChillC: (airC: number, windMS: number) => number | null;
    coldWater: (waterC: number) => {
        row: LibraryRow;
        exhaustionMin: PlaceOutputs["immersion_exhaustion_min"];
        survivalMin: PlaceOutputs["immersion_survival_min"];
    } | null;
}
/**
 * The outputs for a terrain in the host's conditions. WBGT is the BoM form plus the row's delta against the open deck; null where
 * the row has no number (the cold row). Wet is the row's word, "rain" if it rains where there is no full shade. Mosquito and
 * foul-water exposure are not in the library's table: `vector_exposure` is null (FLAGS.md). Felt temperature is the wind chill
 * in the cold and the air otherwise; null where the felt wind has no number for the row's wind word.
 */
export declare function placeOutputs(terrain: string, c: Conditions, life: ExposureReaders): PlaceOutputs;
/**
 * A place (a component) reading the host's conditions each step: `conditions(w)` returns them for the place's terrain and the hour,
 * and the outputs go on the place's `props.outputs` by id. `props.wbgt_c` is set for physiology to read (cleared where null).
 */
export declare function environmentProcess(place: string, terrain: string, conditions: (w: World) => Conditions, every: number, life: ExposureReaders, outputs: (component: Component) => Record<string, number | string | null>): Process;
