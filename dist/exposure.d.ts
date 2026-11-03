/** Body responses to the outdoors: sunburn, felt temperature and cold-water immersion.
 * Wind chill uses the North American index (Osczevski and Bluestein 2005);
 * immersion bands come from physiology.cold_water. The package adapters supply Life readers to the place module.
 */
import { type LibraryRow } from "./library.ts";
import { type Conditions, type PlaceOutputs } from "./environment.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
/** Fraction of a sunburn reached after `minutes` in full sun, from the month's minutes to burn untanned (1 or more is burned). */
export declare const sunburnFraction: (minutes: number, burnMin: number) => number;
/** Wind chill in C (North American index) from air temperature C and wind m/s; null outside its domain (over 10 C, or under 4.8 km/h). */
export declare function windChillC(airC: number, windMS: number): number | null;
export interface Span {
    lo: number;
    hi: number;
}
/** "15 to 30 min", "1 to 3 h", "3 h to indefinite", "indefinite (...)" to minutes (Infinity for indefinite); null if it reads otherwise. */
export declare function durationMinutes(text: string): Span | null;
export interface ColdWater {
    row: LibraryRow;
    exhaustionMin: Span | null;
    survivalMin: Span | null;
}
/** The `physiology.cold_water` row for a water temperature (C) with its times in minutes. Bands: "0 to 5", ... "over 27"; an edge belongs to the colder band. */
export declare function coldWater(waterC: number): ColdWater | null;
/** Package-compatible place outputs, with the Life readers supplied explicitly. */
export declare function placeOutputs(terrain: string, c: Conditions): PlaceOutputs;
/** Package-compatible place process, with Life readers and the output record accessor supplied explicitly. */
export declare function environmentProcess(place: string, terrain: string, conditions: (w: World) => Conditions, every?: number): Process;
