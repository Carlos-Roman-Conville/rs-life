/** Body responses to the outdoors: sunburn, felt temperature and cold-water immersion.
 * Wind chill uses the North American index (Osczevski and Bluestein 2005);
 * immersion bands come from physiology.cold_water. The package adapters supply Life readers to the place module.
 */
import { libraryTable, type LibraryRow } from "./library.ts";
import { bodyOutputs } from "./physiology.ts";
import { placeOutputs as readPlaceOutputs, environmentProcess as placeProcess, type Conditions, type PlaceOutputs } from "./environment.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";

/** Fraction of a sunburn reached after `minutes` in full sun, from the month's minutes to burn untanned (1 or more is burned). */
export const sunburnFraction = (minutes: number, burnMin: number) => minutes / burnMin;

// ---------------------------------------------------------------------------------------------------------------- cold: wind chill and water

/** Wind chill in C (North American index) from air temperature C and wind m/s; null outside its domain (over 10 C, or under 4.8 km/h). */
export function windChillC(airC: number, windMS: number): number | null {
  const v = windMS * 3.6;
  if (airC > 10 || v < 4.8) return null;
  const p = Math.pow(v, 0.16);
  return 13.12 + 0.6215 * airC - 11.37 * p + 0.3965 * airC * p;
}

export interface Span { lo: number; hi: number }

/** "15 to 30 min", "1 to 3 h", "3 h to indefinite", "indefinite (...)" to minutes (Infinity for indefinite); null if it reads otherwise. */
export function durationMinutes(text: string): Span | null {
  const t = text.replace(/\(.*\)/, "").trim();
  if (/^indefinite$/.test(t)) return { lo: Infinity, hi: Infinity };
  const m = /^(\d+(?:\.\d+)?)(?: (min|h))? to (\d+(?:\.\d+)?|indefinite)(?: (min|h))?$/.exec(t);
  if (!m) return null;
  const unit = (u: string | undefined) => u === "h" ? 60 : 1, lastUnit = m[4] ?? m[2];
  const hi = m[3] === "indefinite" ? Infinity : Number(m[3]) * unit(m[4] ?? lastUnit);
  return { lo: Number(m[1]) * unit(m[2] ?? lastUnit), hi };
}

export interface ColdWater { row: LibraryRow; exhaustionMin: Span | null; survivalMin: Span | null }

/** The `physiology.cold_water` row for a water temperature (C) with its times in minutes. Bands: "0 to 5", ... "over 27"; an edge belongs to the colder band. */
export function coldWater(waterC: number): ColdWater | null {
  for (const row of libraryTable("physiology", "cold_water")) {
    const t = String(row["Water (C)"]), r = /^(-?[\d.]+) to ([\d.]+)$/.exec(t), o = /^over ([\d.]+)$/.exec(t);
    const hit = r ? waterC >= Number(r[1]) && waterC <= Number(r[2]) : o ? waterC > Number(o[1]) : false;
    if (hit) return { row, exhaustionMin: durationMinutes(String(row["Time to exhaustion or unconsciousness"])), survivalMin: durationMinutes(String(row["Expected survival"])) };
  }
  return null;
}

/** Package-compatible place outputs, with the Life readers supplied explicitly. */
export function placeOutputs(terrain: string, c: Conditions): PlaceOutputs {
  return readPlaceOutputs(terrain, c, { coldWater, windChillC });
}

/** Package-compatible place process, with Life readers and the output record accessor supplied explicitly. */
export function environmentProcess(place: string, terrain: string, conditions: (w: World) => Conditions, every = 60): Process {
  return placeProcess(place, terrain, conditions, every, { coldWater, windChillC }, bodyOutputs);
}
