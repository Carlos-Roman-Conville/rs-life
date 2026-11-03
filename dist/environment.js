import { libraryTable } from "./library.js";
// ---------------------------------------------------------------------------------------------------------------- WBGT
/** The BoM form's coefficients (ACSM 1987 and the Bureau's page); no library table carries them (FLAGS.md NOTE). */
export const WBGT_BOM = { perAirC: 0.567, perVapourHpa: 0.393, offsetC: 3.94, vapourHpaAt0: 6.105, vapourA: 17.27, vapourBC: 237.7 };
/** The stated error of the BoM form against Liljegren's model, C. Null: the figure was not reachable (FLAGS.md). */
export const WBGT_ERROR_C = null;
/** Vapour pressure in hPa from air temperature (C) and relative humidity (percent), the form the BoM page uses. */
export function vapourPressureHpa(airC, rhPct) {
    const W = WBGT_BOM;
    return rhPct / 100 * W.vapourHpaAt0 * Math.exp(W.vapourA * airC / (W.vapourBC + airC));
}
/** WBGT of an open, sunlit place by the BoM simplified form, from air temperature (C) and relative humidity (percent). */
export function wbgtBom(airC, rhPct) {
    const W = WBGT_BOM;
    return W.perAirC * airC + W.perVapourHpa * vapourPressureHpa(airC, rhPct) + W.offsetC;
}
/** Terrain ids of the exposure table, in its order. */
export function exposureIds() { return libraryTable("environment", "exposure").map(r => String(r.id).replace(/^environment\.exposure\./, "")); }
/** One exposure row with its words read. `sun` is whether the sun is up on the place (the "+2 C in the sun" row applies only then). */
export function exposure(terrain, sun = true) {
    const id = `environment.exposure.${terrain}`, row = libraryTable("environment", "exposure").find(r => r.id === id);
    if (!row)
        throw new Error(`environment: no exposure row ${id}`);
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
export function diurnalC(hour, maxC, minC, tMaxHour, tMinHour) {
    if (!(tMinHour < tMaxHour))
        throw new Error("environment: the minimum hour must come before the maximum hour");
    const h = ((hour % 24) + 24) % 24, half = (maxC - minC) / 2;
    if (h >= tMinHour && h <= tMaxHour)
        return minC + half * (1 - Math.cos(Math.PI * (h - tMinHour) / (tMaxHour - tMinHour)));
    const u = h < tMinHour ? h + 24 : h; // the falling segment runs tMax to tMin + 24
    return maxC - half * (1 - Math.cos(Math.PI * (u - tMaxHour) / (tMinHour + 24 - tMaxHour)));
}
/** Sunrise and sunset hours for a day of `daylightH` hours centred on 12:00. */
export function sunHours(daylightH) { return { rise: 12 - daylightH / 2, set: 12 + daylightH / 2 }; }
/** Whether the sun is up at an hour of the day. */
export function isDay(hour, daylightH) {
    const h = ((hour % 24) + 24) % 24, s = sunHours(daylightH);
    return h >= s.rise && h < s.set;
}
/**
 * The outputs for a terrain in the host's conditions. WBGT is the BoM form plus the row's delta against the open deck; null where
 * the row has no number (the cold row). Wet is the row's word, "rain" if it rains where there is no full shade. Mosquito and
 * foul-water exposure are not in the library's table: `vector_exposure` is null (FLAGS.md). Felt temperature is the wind chill
 * in the cold and the air otherwise; null where the felt wind has no number for the row's wind word.
 */
export function placeOutputs(terrain, c, life) {
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
        daylight_h: day ? c.daylightH : null,
        is_day: c.hour !== undefined && day ? isDay(c.hour, c.daylightH) : null,
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
export function environmentProcess(place, terrain, conditions, every, life, outputs) {
    return { name: "environment", every, step(w) {
            const comp = w.registry.component(place), out = outputs(comp), o = placeOutputs(terrain, conditions(w), life);
            const { immersion_exhaustion_min: ex, immersion_survival_min: sv, is_day: day, ...rest } = o;
            Object.assign(out, rest, { is_day: day === null ? null : day ? 1 : 0,
                immersion_exhaustion_min_lo: ex?.lo ?? null, immersion_exhaustion_min_hi: ex?.hi ?? null,
                immersion_survival_min_lo: sv?.lo ?? null, immersion_survival_min_hi: sv?.hi ?? null });
            if (o.wbgt_c === null)
                delete comp.props.wbgt_c;
            else
                comp.props.wbgt_c = o.wbgt_c;
        } };
}
