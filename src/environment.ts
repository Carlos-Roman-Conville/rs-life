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
import { libraryTable, type LibraryRow } from "./library.ts";
import type { Component } from "./registry.ts";

// ---------------------------------------------------------------------------------------------------------------- WBGT

/** The BoM form's coefficients (ACSM 1987 and the Bureau's page); no library table carries them (FLAGS.md NOTE). */
export const WBGT_BOM = { perAirC: 0.567, perVapourHpa: 0.393, offsetC: 3.94, vapourHpaAt0: 6.105, vapourA: 17.27, vapourBC: 237.7 } as const;

/** The stated error of the BoM form against Liljegren's model, C. Null: the figure was not reachable (FLAGS.md). */
export const WBGT_ERROR_C: number | null = null;

/** Vapour pressure in hPa from air temperature (C) and relative humidity (percent), the form the BoM page uses. */
export function vapourPressureHpa(airC: number, rhPct: number): number {
  const W = WBGT_BOM;
  return rhPct / 100 * W.vapourHpaAt0 * Math.exp(W.vapourA * airC / (W.vapourBC + airC));
}

/** WBGT of an open, sunlit place by the BoM simplified form, from air temperature (C) and relative humidity (percent). */
export function wbgtBom(airC: number, rhPct: number): number {
  const W = WBGT_BOM;
  return W.perAirC * airC + W.perVapourHpa * vapourPressureHpa(airC, rhPct) + W.offsetC;
}

// ---------------------------------------------------------------------------------------------------------------- exposure by terrain (environment.exposure)

export interface Exposure {
  id: string; row: LibraryRow;
  shade: string; windFelt: string; wet: string;
  /** The row's "WBGT vs open deck" in C; null where the row is not a number (the cold row) or the delta holds only in the sun and the sun is down. */
  wbgtDeltaC: number | null;
  /** Share of the open sun that reaches the place: 1 for shade "none", 0 for "full", null for the partial words (no number in the library). */
  sunShare: number | null;
  /** The felt wind as a share of the host's wind: 1 for "full", 0 for "none", null for the other words. */
  windShare: number | null;
}

/** Terrain ids of the exposure table, in its order. */
export function exposureIds(): string[] { return libraryTable("environment", "exposure").map(r => String(r.id).replace(/^environment\.exposure\./, "")); }

/** One exposure row with its words read. `sun` is whether the sun is up on the place (the "+2 C in the sun" row applies only then). */
export function exposure(terrain: string, sun = true): Exposure {
  const id = `environment.exposure.${terrain}`, row = libraryTable("environment", "exposure").find(r => r.id === id);
  if (!row) throw new Error(`environment: no exposure row ${id}`);
  const text = String(row["WBGT vs open deck"]), m = /^([+-]\d+(?:\.\d+)?)/.exec(text);
  const inSunOnly = /in the sun/.test(text);
  const shade = String(row.Shade), wind = String(row["Wind felt"]);
  return {
    id, row, shade, windFelt: wind, wet: String(row.Wet),
    wbgtDeltaC: m ? (inSunOnly && !sun ? 0 : Number(m[1])) : null,
    sunShare: shade === "none" ? 1 : shade === "full" ? 0 : null,
    windShare: wind === "full" ? 1 : wind === "none" ? 0 : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------- the day: curve, light, sun

/**
 * Air temperature at an hour (0 to 24, wrapping) on a half-cosine between the day's minimum at `tMinHour` and maximum at
 * `tMaxHour` (tMinHour before tMaxHour), falling again to the same minimum at `tMinHour` the next morning.
 */
export function diurnalC(hour: number, maxC: number, minC: number, tMaxHour: number, tMinHour: number): number {
  if (!(tMinHour < tMaxHour)) throw new Error("environment: the minimum hour must come before the maximum hour");
  const h = ((hour % 24) + 24) % 24, half = (maxC - minC) / 2;
  if (h >= tMinHour && h <= tMaxHour) return minC + half * (1 - Math.cos(Math.PI * (h - tMinHour) / (tMaxHour - tMinHour)));
  const u = h < tMinHour ? h + 24 : h;                              // the falling segment runs tMax to tMin + 24
  return maxC - half * (1 - Math.cos(Math.PI * (u - tMaxHour) / (tMinHour + 24 - tMaxHour)));
}

/** Sunrise and sunset hours for a day of `daylightH` hours centred on 12:00. */
export function sunHours(daylightH: number): { rise: number; set: number } { return { rise: 12 - daylightH / 2, set: 12 + daylightH / 2 }; }

/** Whether the sun is up at an hour of the day. */
export function isDay(hour: number, daylightH: number): boolean {
  const h = ((hour % 24) + 24) % 24, s = sunHours(daylightH);
  return h >= s.rise && h < s.set;
}

// ---------------------------------------------------------------------------------------------------------------- a place's outputs

/** What the host supplies for a place at an hour. Humidity is a percentage; the host's climate tables stay with the host. */
export interface Conditions {
  airC: number; rhPct: number; windMS: number;
  sun: boolean;                    // the sun is up (see `isDay`)
  rain: boolean;
  /** The month's row: hours of daylight and minutes to burn untanned at noon (environment.sun). Omitted: no day outputs. */
  daylightH?: number; sunburnMin?: number;
  hour?: number;                   // hour of day, for is_day
  waterC?: number;                 // sea temperature, for the immersion rows
}

export interface PlaceOutputs {
  wbgt_c: number | null; air_c: number; wet: string; sun_exposure: number | null; vector_exposure: null;
  felt_c: number | null; wind_felt_ms: number | null; daylight_h: number | null; is_day: boolean | null; sunburn_min: number | null;
  exposure_row: string; cold_water_row: string | null; immersion_exhaustion_min: { lo: number; hi: number } | null; immersion_survival_min: { lo: number; hi: number } | null;
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
export function placeOutputs(terrain: string, c: Conditions, life: ExposureReaders): PlaceOutputs {
  const x = exposure(terrain, c.sun), day = c.daylightH !== undefined;
  const wbgt = x.wbgtDeltaC === null ? null : wbgtBom(c.airC, c.rhPct) + x.wbgtDeltaC;
  const wind = x.windShare === null ? null : c.windMS * x.windShare;
  const cold = c.airC <= 10;
  const sunShare = c.sun ? x.sunShare : 0;
  const water = c.waterC === undefined ? null : life.coldWater(c.waterC);
  return {
    wbgt_c: wbgt, air_c: c.airC,
    wet: c.rain && x.shade !== "full" ? "rain" : x.wet,
    sun_exposure: sunShare,
    vector_exposure: null,
    felt_c: !cold ? c.airC : wind === null ? null : (life.windChillC(c.airC, wind) ?? c.airC),
    wind_felt_ms: wind,
    daylight_h: day ? c.daylightH! : null,
    is_day: c.hour !== undefined && day ? isDay(c.hour, c.daylightH!) : null,
    sunburn_min: sunShare === 1 && c.sunburnMin !== undefined ? c.sunburnMin : null,
    exposure_row: x.id,
    cold_water_row: water ? String(water.row.id) : null,
    immersion_exhaustion_min: water?.exhaustionMin ?? null, immersion_survival_min: water?.survivalMin ?? null,
  };
}

/**
 * A place (a component) reading the host's conditions each step: `conditions(w)` returns them for the place's terrain and the hour,
 * and the outputs go on the place's `props.outputs` by id. `props.wbgt_c` is set for physiology to read (cleared where null).
 */
export function environmentProcess(place: string, terrain: string, conditions: (w: World) => Conditions, every: number, life: ExposureReaders,
  outputs: (component: Component) => Record<string, number | string | null>): Process {
  return { name: "environment", every, step(w) {
    const comp = w.registry.component(place), out = outputs(comp), o = placeOutputs(terrain, conditions(w), life);
    const { immersion_exhaustion_min: ex, immersion_survival_min: sv, is_day: day, ...rest } = o;
    Object.assign(out, rest, { is_day: day === null ? null : day ? 1 : 0,
      immersion_exhaustion_min_lo: ex?.lo ?? null, immersion_exhaustion_min_hi: ex?.hi ?? null,
      immersion_survival_min_lo: sv?.lo ?? null, immersion_survival_min_hi: sv?.hi ?? null });
    if (o.wbgt_c === null) delete comp.props.wbgt_c; else comp.props.wbgt_c = o.wbgt_c;
  } };
}
