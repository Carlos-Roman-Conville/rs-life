import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { bodyOutputs } from "../src/physiology.ts";
import {
  WBGT_ERROR_C, diurnalC, exposure, exposureIds, isDay,
  vapourPressureHpa, wbgtBom,
} from "../src/environment.ts";
import { coldWater, durationMinutes, sunburnFraction, windChillC } from "../src/exposure.ts";
import { placeOutputs, environmentProcess } from "../src/index.ts";

const OPEN = { airC: 31, rhPct: 75, windMS: 2, sun: true, rain: false };

describe("WBGT by the BoM simplified form", () => {
  it("gives 34.7 C for 31 C and 75% on an open deck (hand arithmetic of the cited form)", () => {
    const e = 0.75 * 6.105 * Math.exp(17.27 * 31 / (237.7 + 31));
    expect(vapourPressureHpa(31, 75)).toBeCloseTo(e, 9);
    expect(e).toBeCloseTo(33.57, 1);
    expect(wbgtBom(31, 75)).toBeCloseTo(0.567 * 31 + 0.393 * e + 3.94, 9);
    expect(wbgtBom(31, 75)).toBeCloseTo(34.7, 1);
    expect(placeOutputs("open-deck-day", OPEN).wbgt_c).toBeCloseTo(wbgtBom(31, 75), 9);
  });
  it("leaves the form's error against Liljegren null: the figure was not reachable", () => { expect(WBGT_ERROR_C).toBeNull(); });
  it("shifts by the exposure row's column against the open deck", () => {
    const open = placeOutputs("open-deck-day", OPEN).wbgt_c!;
    expect(placeOutputs("aloft", OPEN).wbgt_c).toBeCloseTo(open - 1, 9);
    expect(placeOutputs("the-galley", OPEN).wbgt_c).toBeCloseTo(open + 6, 9);
    expect(placeOutputs("below-decks-under-way", OPEN).wbgt_c).toBeCloseTo(open + 3, 9);
    expect(placeOutputs("rainforest-hills", OPEN).wbgt_c).toBeCloseTo(open - 2, 9);
    // "+2 C in the sun" holds only with the sun up
    expect(placeOutputs("a-dry-coral-island-the-beach-careening", OPEN).wbgt_c).toBeCloseTo(open + 2, 9);
    expect(placeOutputs("a-dry-coral-island-the-beach-careening", { ...OPEN, sun: false }).wbgt_c).toBeCloseTo(open, 9);
  });
  it("has no WBGT for the cold row, and reads every row of the table", () => {
    expect(placeOutputs("north-atlantic-winter", { ...OPEN, airC: 2 }).wbgt_c).toBeNull();
    expect(exposureIds()).toHaveLength(11);
    for (const id of exposureIds()) expect(exposure(id).row.id).toBe(`environment.exposure.${id}`);
  });
});

describe("shade, wet, sun and vectors", () => {
  it("reads wet from the row, rain only where there is no full shade", () => {
    expect(placeOutputs("open-deck-day", { ...OPEN, rain: true }).wet).toBe("rain");
    expect(placeOutputs("the-galley", { ...OPEN, rain: true }).wet).toBe("dry");
    expect(placeOutputs("open-deck-day", OPEN).wet).toBe("spray");
  });
  it("gives sun exposure 1 in the open, 0 in full shade or at night, null for the words without a number", () => {
    expect(placeOutputs("open-deck-day", OPEN).sun_exposure).toBe(1);
    expect(placeOutputs("the-galley", OPEN).sun_exposure).toBe(0);
    expect(placeOutputs("open-deck-day", { ...OPEN, sun: false }).sun_exposure).toBe(0);
    expect(placeOutputs("a-plantation-town", OPEN).sun_exposure).toBeNull();
  });
  it("takes the month's row for day length and sunburn time", () => {
    const o = placeOutputs("open-deck-day", { ...OPEN, daylightH: 13, sunburnMin: 15, hour: 12 });
    expect(o.daylight_h).toBe(13); expect(o.sunburn_min).toBe(15); expect(o.is_day).toBe(true);
    expect(placeOutputs("the-galley", { ...OPEN, daylightH: 13, sunburnMin: 15 }).sunburn_min).toBeNull();
    expect(isDay(5.4, 13)).toBe(false); expect(isDay(5.5, 13)).toBe(true); expect(isDay(18.5, 13)).toBe(false); expect(isDay(18.4, 13)).toBe(true);
    expect(sunburnFraction(7.5, 15)).toBe(0.5);
  });
  it("leaves vector exposure null: the library table has no mosquito or foul-water column", () => {
    expect(placeOutputs("the-guinea-coast", OPEN).vector_exposure).toBeNull();
  });
});

describe("the diurnal curve", () => {
  const f = (h: number) => diurnalC(h, 32, 24, 14, 5);
  it("reaches the minimum at the minimum hour and the maximum at the maximum hour", () => {
    expect(f(5)).toBeCloseTo(24, 9); expect(f(14)).toBeCloseTo(32, 9);
    const hours = Array.from({ length: 96 }, (_, i) => i / 4);
    const lo = hours.reduce((a, b) => f(b) < f(a) ? b : a), hi = hours.reduce((a, b) => f(b) > f(a) ? b : a);
    expect(lo).toBe(5); expect(hi).toBe(14);
    for (const h of hours) { expect(f(h)).toBeGreaterThanOrEqual(24 - 1e-9); expect(f(h)).toBeLessThanOrEqual(32 + 1e-9); }
  });
  it("is continuous across midnight and halfway at the midpoint of each segment", () => {
    expect(Math.abs(f(23.999) - f(0.001))).toBeLessThan(0.01);
    expect(f(9.5)).toBeCloseTo(28, 9);
    expect(f(14 + (5 + 24 - 14) / 2)).toBeCloseTo(28, 9);
  });
});

describe("cold: wind chill and the water", () => {
  it("matches the index's published values", () => {
    expect(windChillC(-10, 20 / 3.6)).toBeCloseTo(-17.9, 0);       // 20 km/h at -10 C: about -18 (Environment Canada chart)
    expect(windChillC(15, 20 / 3.6)).toBeNull(); expect(windChillC(0, 1)).toBeNull();
  });
  it("feels the wind where the row has a number for it and the air otherwise", () => {
    const o = placeOutputs("north-atlantic-winter", { airC: -5, rhPct: 80, windMS: 15, sun: false, rain: false });
    expect(o.wind_felt_ms).toBeNull(); expect(o.felt_c).toBeNull();                       // "gale" has no number
    const deck = placeOutputs("open-deck-day", { airC: -5, rhPct: 80, windMS: 10, sun: false, rain: false });
    expect(deck.felt_c).toBeCloseTo(windChillC(-5, 10)!, 9);
    expect(placeOutputs("open-deck-day", OPEN).felt_c).toBe(31);
  });
  it("reads the cold_water rows in minutes", () => {
    expect(durationMinutes("15 to 30 min")).toEqual({ lo: 15, hi: 30 });
    expect(durationMinutes("1 to 3 h")).toEqual({ lo: 60, hi: 180 });
    expect(durationMinutes("3 h to indefinite")).toEqual({ lo: 180, hi: Infinity });
    expect(durationMinutes("indefinite (fatigue, thirst, sharks decide)")).toEqual({ lo: Infinity, hi: Infinity });
    expect(coldWater(3)!.row.id).toBe("physiology.cold_water.0-to-5");
    expect(coldWater(5)!.row.id).toBe("physiology.cold_water.0-to-5");
    expect(coldWater(12)!.exhaustionMin).toEqual({ lo: 60, hi: 120 });
    expect(coldWater(12)!.survivalMin).toEqual({ lo: 60, hi: 360 });
    expect(coldWater(30)!.row.id).toBe("physiology.cold_water.over-27");
    expect(coldWater(-3)).toBeNull();
    expect(placeOutputs("open-deck-day", { ...OPEN, waterC: 8 }).cold_water_row).toBe("physiology.cold_water.5-to-10");
  });
});

describe("as a process on a place", () => {
  it("writes outputs by id and the wbgt_c physiology reads", () => {
    const reg = defaultRegistry(), w = new World(reg);
    const place: Component = { id: "deck", kind: "room", material: "air_mass", mass: 10, temperatureC: 31, contents: [], ports: [],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: {} };
    reg.addComponent(place);
    const s = new Scheduler();
    s.add(environmentProcess("deck", "the-galley", () => ({ ...OPEN, daylightH: 12, sunburnMin: 20, hour: 12, waterC: 20 }), 1));
    s.run(w, 2, 1);
    const out = bodyOutputs(place);
    expect(place.props.wbgt_c).toBeCloseTo(wbgtBom(31, 75) + 6, 9);
    expect(out.wbgt_c).toBeCloseTo(wbgtBom(31, 75) + 6, 9);
    expect(out.air_c).toBe(31); expect(out.wet).toBe("dry"); expect(out.sun_exposure).toBe(0); expect(out.vector_exposure).toBeNull();
    expect(out.is_day).toBe(1); expect(out.immersion_exhaustion_min_lo).toBe(120);
  });
});
