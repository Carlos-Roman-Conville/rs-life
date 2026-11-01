import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { Trace } from "../src/trace.ts";
import { MMHG_PER_PA, M, pressureAtAltitude } from "../src/physics.ts";
import { libraryRow } from "../src/library.ts";
import { bodyOutputs, metOf, metabolicRateW } from "../src/physiology.ts";
import { roomProcess } from "../src/process.ts";
import { CALCULATOR, accumulateExposure, alveolarPO2, bodyGasFlows, breathingProcess, cohbAfter, gasThresholds, respiratoryProfile, respiratoryState, thresholdPpm } from "../src/respiration.ts";
import { Grid, achFromFlow, airContents, altitudeAir, altitudeRow, baselineAir, fireFlows, flowFromAch, inhaledDoseLitres, lampFlows, layeredPpm, litresToMoles, partialPressureMmHg, ppmMinutes, roomAirProcess, roomGasFraction, rotFlows, sourcesProcess, sulphurFlows, densityVsAir, fractionToPpm, ppmToFraction } from "../src/atmosphere.ts";
import { saturation } from "../src/circulation.ts";

const SLEEPING = metOf("sleeping");
const comp = (id: string, kind: string, over: Partial<Component> = {}): Component => ({ id, kind, material: kind === "body" ? "flesh" : "air_mass", mass: kind === "body" ? 70 : 10,
  temperatureC: kind === "body" ? 37 : 20, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: {}, ...over });

function roomWorld(volume: number, ach: number, altitudeM = 0, tC = 20) {
  const reg = defaultRegistry(), w = new World(reg), p = pressureAtAltitude(altitudeM);
  w.env.outsideC = tC;
  const room = comp("room", "room", { temperatureC: tC, contents: airContents(volume, p, tC), props: { volume_m3: volume, ach, pressurePa: p } });
  reg.addComponent(room);
  return { reg, w, room };
}

describe("altitude, the alveolar gas equation and the saturation curve", () => {
  it("reproduces the altitude table's pressure, inspired and alveolar PO2 in every row", () => {
    for (const h of [0, 500, 1000, 2256, 3000, 5000]) {
      const row = altitudeRow(h), air = altitudeAir(h);
      expect(Math.abs(air.pressureMmHg - Number(row["Pressure (mmHg)"]))).toBeLessThan(1);
      expect(Math.abs(air.inspiredPO2MmHg - Number(row["Inspired PO2 (mmHg)"]))).toBeLessThan(1);
      expect(Math.abs(alveolarPO2(baselineAir().o2, air.pressureMmHg, 40) - Number(row["Alveolar PO2 at PaCO2 40 (mmHg)"]))).toBeLessThan(1);
    }
  });
  it("matches the table's resting saturation at sea level, 500 m, 1,000 m and 2,256 m", () => {
    // the table's 3,000 and 5,000 m values are for the acclimatised (over-breathing), which the formula does not model, so they are not compared
    const sat = (h: number) => {
      const air = altitudeAir(h), b = baselineAir();
      return respiratoryState({ pressureMmHg: air.pressureMmHg, o2Frac: b.o2, co2Frac: b.co2, coPpm: 0 }, 1, 70).sao2;
    };
    for (const h of [0, 500, 1000]) expect(Math.abs(sat(h) - Number(altitudeRow(h)["Typical resting saturation"]))).toBeLessThan(0.01);
    // the table's value is a typical reading to the hundredth; the A-a gradient (7 mmHg here, 5 to 10 in health) puts the formula 0.026 below it
    expect(Math.abs(sat(2256) - Number(altitudeRow(2256)["Typical resting saturation"]))).toBeLessThan(0.03);
    expect(sat(2256)).toBeLessThan(sat(1000));
  });
  it("is the Severinghaus curve: half saturated at 26.9 mmHg and 0.97 at 95", () => {
    expect(saturation(26.9)).toBeCloseTo(0.5, 1);
    expect(saturation(95)).toBeCloseTo(0.97, 2);
    expect(saturation(0)).toBe(0);
  });
  it("follows the dashboard calculator for a set of airs", () => {
    const sat = (p: number) => 1 / (1 + 23400 / (p * p * p + 150 * p));
    const calc = (alt: number, fo2: number, fco2: number, met: number) => {   // body/dashboard.html, `resp`, with its variable names
      const P = 760 * Math.pow(1 - 0.0065 * alt / 288.15, 5.256), pio2 = fo2 * (P - 47);
      const vo2 = 3.5 * met * 70, ve = Math.min(150, 6 + 0.025 * Math.max(0, vo2 - 250));
      let paco2 = 40 + fco2 * (P - 47) * 0.7; let veDrive = Math.min(150, ve * Math.pow(2, Math.max(0, paco2 - 40) / 5));
      const pao2First = Math.max(0, pio2 - paco2 / 0.8);
      if (pao2First < 60 && fco2 < 0.02) { const drop = Math.min(15, (60 - pao2First) * 0.5); paco2 = Math.max(25, paco2 - drop); veDrive = Math.min(150, veDrive * (1 + drop / 15)); }
      const pao2 = Math.max(0, pio2 - paco2 / 0.8), pa = Math.max(0, pao2 - 7);
      return { sao2: sat(pa), ve: veDrive, paco2, pao2 };
    };
    for (const [alt, fo2, fco2, met] of [[0, 0.2095, 0.0004, 1], [2256, 0.2095, 0.0004, 3], [5000, 0.2095, 0.0004, 1], [0, 0.15, 0.03, 2], [0, 0.2095, 0.06, 1], [3000, 0.13, 0.0004, 4]] as const) {
      const air = altitudeAir(alt), got = respiratoryState({ pressureMmHg: air.pressureMmHg, o2Frac: fo2, co2Frac: fco2, coPpm: 0 }, met, 70), want = calc(alt, fo2, fco2, met);
      expect(got.sao2).toBeCloseTo(want.sao2, 10); expect(got.ventilationLMin).toBeCloseTo(want.ve, 10);
      expect(got.paco2MmHg).toBeCloseTo(want.paco2, 10); expect(got.alveolarPO2MmHg).toBeCloseTo(want.pao2, 10);
    }
    expect(CALCULATOR.aaGradientMmHg).toBe(7);
  });
  it("breathes faster for CO2, panting in a shut hold, and not at all for CO", () => {
    const air = { pressureMmHg: 760, o2Frac: 0.2095, co2Frac: 0.0004, coPpm: 0 };
    const rest = respiratoryState(air, 1, 70), close = respiratoryState({ ...air, co2Frac: 0.05 }, 1, 70), co = respiratoryState({ ...air, coPpm: 500 }, 1, 70);
    expect(rest.ventilationLMin).toBeCloseTo(6, 0);
    expect(close.ventilationLMin).toBeGreaterThan(5 * rest.ventilationLMin);
    expect(co.ventilationLMin).toBe(rest.ventilationLMin);
    expect(respiratoryState(air, 30, 70).ventilationLMin).toBe(respiratoryProfile().maxVentilationLMin);
  });
  it("lets another species change the profile", () => {
    const air = { pressureMmHg: 760, o2Frac: 0.2095, co2Frac: 0.0004, coPpm: 0 };
    const horse = respiratoryProfile({ maxVentilationLMin: 1500, restingVentilationLMin: 60, aaGradientMmHg: 5 });
    expect(respiratoryState(air, 1, 500, horse).ventilationLMin).toBeGreaterThan(60);
    expect(respiratoryState(air, 1, 500, horse).sao2).toBeGreaterThan(respiratoryState(air, 1, 70).sao2);
  });
});

describe("carboxyhaemoglobin", () => {
  it("approaches 0.16 x ppm / 100 with a 5 h half-time at 6 L/min and clears with the same half-time in air", () => {
    expect(cohbAfter(0, 200, 6, 300)).toBeCloseTo(0.16, 10);
    expect(cohbAfter(0.2, 0, 6, 300)).toBeCloseTo(0.1, 10);
    expect(cohbAfter(0, 200, 12, 150)).toBeCloseTo(0.16, 10);   // work: the half-time falls by VE / 6
  });
});

describe("units and thresholds", () => {
  it("converts fractions, partial pressures, ACH and moles", () => {
    expect(fractionToPpm(0.0004)).toBeCloseTo(400, 10); expect(ppmToFraction(400)).toBeCloseTo(0.0004, 12);
    expect(partialPressureMmHg(0.2095, 760)).toBeCloseTo(159.2, 1);
    expect(achFromFlow(0.5, 15)).toBeCloseTo(2, 10); expect(flowFromAch(2, 15)).toBeCloseTo(0.5, 10);
    expect(litresToMoles(24.465, 101325, 25)).toBeCloseTo(1, 3);
    expect(ppmMinutes(1000, 30)).toBe(30000);
    expect(inhaledDoseLitres(6, 0.03, 60, 0.5)).toBeCloseTo(5.4, 10);
  });
  it("reads the library's thresholds for CO2 and O2", () => {
    const co2 = gasThresholds("co2");
    expect(co2.map(t => t.at)).toEqual([1, 3, 5, 8]);
    expect(co2.map(thresholdPpm)).toEqual([10000, 30000, 50000, 80000]);
    expect(co2[1]!.effect).toContain("headache");
    const o2 = gasThresholds("o2");
    expect(o2[0]).toMatchObject({ at: 19.5, falling: true });
    expect(gasThresholds("co")[0]).toMatchObject({ at: 200, unit: "ppm" });
    expect(densityVsAir("co2")).toBe(1.5);
  });
  it("reads heavier gases low and lighter ones at the mean in an unmixed box, the mean when mixed", () => {
    expect(layeredPpm("co2", 1000, "low", false)).toBe(1500);
    expect(layeredPpm("co2", 1000, "high", false)).toBe(500);
    expect(layeredPpm("co", 1000, "low", false)).toBe(1000);
    expect(layeredPpm("co2", 1000, "low", true)).toBe(1000);
  });
});

describe("the room as a box", () => {
  it("is the old roomProcess: a shut room holds, an aired room moves each gas toward the outside by the air change", () => {
    const { w, room, reg } = roomWorld(40, 2);
    reg.addContent(room, "co2", "gas", 0.05);
    const before = reg.contentMass(room, "co2", "gas"), out = airContents(40, room.props.pressurePa, 20).find(x => x.substance === "co2")!.mass;
    const sch = new Scheduler(); sch.add(roomProcess("room"));
    sch.run(w, 10, 10);
    const frac = 2 * 40 / 3600 * 10 / 40;
    expect(reg.contentMass(room, "co2", "gas")).toBeCloseTo(before + (out - before) * frac, 12);
    expect(w.trace.transfers.some(x => x.process === "ventilation" && x.quantity === "mass:co2" && x.to === "outside")).toBe(true);
    expect(room.props.co2ppm).toBeCloseTo(roomGasFraction(w, room, "co2") * 1e6, 8);
    const shut = roomWorld(40, 0);
    const o2frac0 = roomGasFraction(shut.w, shut.room, "o2");
    const s2 = new Scheduler(); s2.add(roomAirProcess("room")); s2.run(shut.w, 60, 10);
    expect(shut.room.props.o2frac).toBe(o2frac0);
    expect(shut.w.trace.transfers.filter(x => x.quantity.startsWith("mass:")).length).toBe(0);
  });
  it("carries a gas it holds beyond the standard five out at zero outside", () => {
    const { w, room, reg } = roomWorld(40, 3);
    reg.addContent(room, "h2s", "gas", 0.001);
    const sch = new Scheduler(); sch.add(roomAirProcess("room")); sch.run(w, 600, 10);
    expect(reg.contentMass(room, "h2s", "gas")).toBeLessThan(0.001);
    expect(room.props.h2sppm).toBeGreaterThan(0);
  });
});

describe("sources and sinks", () => {
  it("makes a body's O2 and CO2 the person and goat rows of the library", () => {
    const person = bodyGasFlows(metabolicRateW(1, { mass: 70, props: {} }));
    expect(-person.o2!).toBeCloseTo(0.25, 1); expect(person.co2!).toBeCloseTo(0.2, 1);
    expect(Math.abs(person.o2! / -0.25 - 1)).toBeLessThan(0.03); expect(Math.abs(person.co2! / 0.2 - 1)).toBeLessThan(0.03);
    expect(-bodyGasFlows(metabolicRateW(1, { mass: 28, props: {} })).o2!).toBeCloseTo(0.1, 1);
    expect(-bodyGasFlows(metabolicRateW(7, { mass: 70, props: {} })).o2!).toBeCloseTo(7 * -person.o2!, 10);
    expect(String(libraryRow("gasdynamics", "sources_sinks", "gasdynamics.sources_sinks.livestock-goats-pigs-hens")["Rate (placeholder)"])).toContain("0.1 L/min O2");
  });
  it("reads the lamp, fire, rot and stinkpot rows", () => {
    expect(lampFlows(2)).toEqual({ o2: -0.06, co2: 0.06 });
    expect(fireFlows()).toEqual({ o2: -110, co2: 100, co: 20 });
    expect(rotFlows()).toEqual({ h2s: 0.01 });
    expect(sulphurFlows(100)).toEqual({ so2: 70, o2: -70 });
  });
  it("adds a fire's gases to a room, traced and conserved, and cannot burn more oxygen than the room holds", () => {
    const { w, room, reg } = roomWorld(60, 0);
    for (const g of ["o2", "co2", "co"]) w.conserve(g, ["room"], 1e-9);
    const sch = new Scheduler(); sch.add(sourcesProcess("room", [{ id: "cargo-fire", flows: fireFlows() }]));
    const co2Before = reg.contentMass(room, "co2", "gas");
    sch.run(w, 60, 1);
    const r = room.props.pressurePa, kgPerL = (g: string) => litresToMoles(1, r, 20) * reg.substance(g).molarMass;
    expect(reg.contentMass(room, "co2", "gas") - co2Before).toBeCloseTo(100 * kgPerL("co2"), 8);
    expect(w.trace.failed()).toEqual([]);
    expect(w.trace.into("room", "mass:co")).toBeCloseTo(20 * kgPerL("co"), 8);
    const o2 = reg.contentMass(room, "o2", "gas");
    sch.run(w, 3600 * 3, 60);
    expect(reg.contentMass(room, "o2", "gas")).toBeGreaterThanOrEqual(0);
    expect(reg.contentMass(room, "o2", "gas")).toBeLessThan(o2);
    expect(w.trace.failed()).toEqual([]);
  });
});

describe("two sleepers in a shut 15 m3 room", () => {
  const V = 15;
  const thresholds = gasThresholds("co2").map(thresholdPpm);
  function run() {
    const { w, room, reg } = roomWorld(V, 0);
    const a = comp("a", "body"), b = comp("b", "body");
    reg.addComponent(a); reg.addComponent(b);
    for (const g of ["o2", "co2", "n2", "water"]) w.conserve(g, ["room"], 1e-9);
    const sch = new Scheduler();
    sch.add(roomAirProcess("room")); sch.add(breathingProcess("a", "room", { met: SLEEPING, every: 1 })); sch.add(breathingProcess("b", "room", { met: SLEEPING, every: 1 }));
    // the box model's closed form: moles added per minute against the moles in the room (the breath takes 1 mol of O2 for 0.8 of CO2)
    const n0 = room.contents.reduce((s, x) => s + x.mass / reg.substance(x.substance).molarMass, 0), nc0 = room.contents.find(x => x.substance === "co2")!.mass / M.CO2;
    const vo2 = 3.5 * SLEEPING * 70 / 1000, perMin = (litres: number) => litresToMoles(litres, room.props.pressurePa, 20);
    const p = 2 * perMin(vo2 * 0.8), c = 2 * perMin(vo2);
    const predicted = (x: number) => (x * n0 - nc0) / (p - x * (p - c)) * 60;      // seconds
    const crossed: (number | null)[] = thresholds.map(() => null);
    let t = 0;
    while (t < 3600 * 80 && crossed.some(x => x === null)) {
      sch.run(w, 60, 60); t += 60;
      const ppm = roomGasFraction(w, room, "co2") * 1e6;
      thresholds.forEach((th, i) => { if (crossed[i] === null && ppm >= th) crossed[i] = t; });
    }
    return { w, room, reg, a, b, crossed, predicted };
  }
  it("crosses 1%, 3%, 5% and 8% CO2 when the box model says", () => {
    const { crossed, predicted } = run();
    expect(thresholds).toEqual([10000, 30000, 50000, 80000]);
    thresholds.forEach((th, i) => {
      const want = predicted(th / 1e6), got = crossed[i]!;
      expect(got).not.toBeNull();
      expect(got).toBeGreaterThanOrEqual(want);
      expect(got - want).toBeLessThanOrEqual(60);                // within the 60 s step the clock runs in
    });
    expect(crossed[0]! / 3600).toBeGreaterThan(5);               // 1% takes hours: two sleepers in 15 m3 are a long way from the hold's ninety minutes
  });
  it("conserves oxygen, CO2, nitrogen and water, and writes the outputs by id", () => {
    const { w, room, a } = run();
    expect(w.trace.failed()).toEqual([]);
    const out = bodyOutputs(a);
    // each sleeper's outputs are written in its own turn, so the first lags the second's breath of the same step (about 25 ppm)
    expect(out.co2_ppm).toBeCloseTo(roomGasFraction(w, room, "co2") * 1e6, -2);
    expect(Number(out.co2_ppm)).toBeLessThan(roomGasFraction(w, room, "co2") * 1e6);
    expect(out.o2_frac).toBeCloseTo(roomGasFraction(w, room, "o2"), 3);
    expect(out.co_ppm).toBe(0); expect(out.cohb).toBe(0);
    expect(out.ventilation_l_min).toBeGreaterThan(30);           // panting at 8%
    expect(out.sao2).toBeLessThan(0.5);                          // 8% CO2 with the oxygen near 10% leaves no alveolar oxygen
    expect(out.pressure_mmhg).toBeCloseTo(760, 0);
  });
});

describe("a body in carbon monoxide", () => {
  it("gains COHb at the library rate and the breath does not rise for it", () => {
    const { w, room, reg } = roomWorld(30, 0);
    reg.addContent(room, "co", "gas", reg.contentMass(room, "n2", "gas") * 200e-6 * M.CO / M.N2);
    const body = comp("b", "body"); reg.addComponent(body);
    const sch = new Scheduler(); sch.add(roomAirProcess("room")); sch.add(breathingProcess("b", "room", { met: 1, every: 1 }));
    sch.run(w, 3600, 60);
    const out = bodyOutputs(body), ppm = Number(out.co_ppm);
    expect(ppm).toBeGreaterThan(150);
    // an hour toward 0.16 x ppm / 100 at the 5 h half-time of 6 L/min; the CO2 the breath makes lifts the ventilation a little, which shortens it
    expect(Number(out.cohb)).toBeGreaterThan(cohbAfter(0, ppm, 6, 60));
    expect(Number(out.cohb)).toBeLessThan(cohbAfter(0, ppm, 7, 60));
    expect(Number(out.ventilation_l_min)).toBeLessThan(7);
  });
  it("adds ppm-minutes per gas and keeps the peak", () => {
    const room = comp("room", "room", { props: { co2ppm: 3000, coppm: 100, h2sppm: 5 } }), body = comp("b", "body");
    accumulateExposure(body, room, 120); room.props.coppm = 300; accumulateExposure(body, room, 60);
    expect(body.props.co2ppmMin).toBeCloseTo(9000, 8); expect(body.props.coppmMin).toBeCloseTo(100 * 2 + 300, 8);
    expect(body.props.coppmPeak).toBe(300); expect(body.props.h2sppmMin).toBeCloseTo(15, 8);
    expect(body.props.so2ppmMin).toBeUndefined();
  });
  it("has no exchange for a species that does not breathe air", () => {
    const { w, room, reg } = roomWorld(30, 0);
    const fish = comp("f", "body"); reg.addComponent(fish);
    const sch = new Scheduler(); sch.add(breathingProcess("f", "room", { met: 1, every: 1, profile: respiratoryProfile({ medium: "water" }) }));
    const o2 = reg.contentMass(room, "o2", "gas");
    sch.run(w, 600, 60);
    expect(reg.contentMass(room, "o2", "gas")).toBe(o2);
    expect(bodyOutputs(fish).sao2).toBeNull();
  });
});

describe("the grid", () => {
  const reg = defaultRegistry();
  const base = { cellM: 1, levelM: 1, pressurePa: 101325, temperatureC: 20 };
  const centroid = (g: Grid, sp: string) => { let s = 0, m = 0; for (let i = 0; i < g.cells; i++) { s += g.kg[sp]![i]! * g.coords(i)[0]; m += g.kg[sp]![i]!; } return s / m; };
  const excess = (g: Grid, sp: string, i: number) => g.kg[sp]![i]! - g.background[sp]!;
  const assertConserved = (g: Grid, tol = 1e-12) => { for (const sp of g.species) expect(Math.abs(g.balance(sp))).toBeLessThan(tol * Math.max(1, g.ledger[sp]!.initial)); };

  it("spreads a release downwind and conserves each species", () => {
    const g = new Grid(reg, { ...base, nx: 12, ny: 3 }), trace = new Trace();
    g.release("co2", 2, 1, 0, 0.5, "vent", trace);
    const c0 = centroid(g, "co2");
    for (let k = 0; k < 40; k++) g.step(0.5, { windMS: [1, 0], diffusion: 0.05 }, trace, k * 0.5);
    expect(centroid(g, "co2")).toBeGreaterThan(c0 + 3);
    expect(excess(g, "co2", g.at(6, 1))).toBeGreaterThan(excess(g, "co2", g.at(0, 1)));
    assertConserved(g);
    expect(trace.failed()).toEqual([]);
    expect(trace.into("grid", "mass:co2")).toBeGreaterThan(0.5);
    expect(g.ledger.co2!.out).toBeGreaterThan(0);
  });
  it("pools a heavy gas in the low tiles and lets a light one rise a level", () => {
    const slope = (x: number) => (11 - x) * 1;
    const still = { diffusion: 0.05, settle: 0.5, rise: 0.5 };
    const run = (rates: typeof still | { diffusion: number }) => {
      const g = new Grid(reg, { ...base, nx: 12, ny: 1, nz: 2, elevationM: slope });
      g.release("co2", 2, 0, 0, 0.5, "vent"); g.release("co", 2, 0, 0, 0.5, "vent");
      for (let k = 0; k < 400; k++) g.step(1, rates);
      return g;
    };
    const g = run(still), control = run({ diffusion: 0.05 });
    const lowest = g.at(11, 0, 0), highest = g.at(0, 0, 0);
    expect(g.ppm("co2", lowest)).toBeGreaterThan(g.ppm("co2", highest));
    expect(excess(g, "co2", lowest)).toBeGreaterThan(excess(control, "co2", control.at(11, 0, 0)));
    // CO (0.97 x air) rises a level into the deck above the release
    const upper = (gr: Grid) => { let s = 0; for (let x = 0; x < 12; x++) s += excess(gr, "co", gr.at(x, 0, 1)); return s; };
    expect(upper(g)).toBeGreaterThan(upper(control));
    assertConserved(g); assertConserved(control);
  });
  it("keeps the wind out of an enclosed cell and trades its air at its own ACH", () => {
    const g = new Grid(reg, { ...base, nx: 5, ny: 1, enclosed: x => x === 2, ach: x => x === 2 ? 1 : 0 });
    g.release("co2", 2, 0, 0, 0.2, "brazier");
    const before = g.kg.co2![g.at(2, 0)]!;
    for (let k = 0; k < 20; k++) g.step(1, { windMS: [1, 0] });
    expect(g.kg.co2![g.at(2, 0)]!).toBeLessThan(before);         // only the ACH takes it
    expect(g.kg.co2![g.at(3, 0)]!).toBeCloseTo(g.background.co2!, 10);   // and a wall stops it reaching the next cell
    expect(Math.abs(g.kg.co2![g.at(2, 0)]! - before * Math.pow(1 - 1 / 3600, 20))).toBeLessThan(0.002);
    assertConserved(g);
  });
  it("becomes uniform in a closed grid and hands its mass to the box", () => {
    const g = new Grid(reg, { ...base, nx: 3, ny: 3 });
    g.release("co2", 0, 0, 0, 0.3, "vent");
    expect(g.uniform()).toBe(false);
    for (let k = 0; k < 200 && !g.uniform(); k++) g.step(1, { diffusion: 0.1 });
    expect(g.uniform()).toBe(true);
    const box = g.asBox();
    expect(box.volume_m3).toBe(9);
    expect(box.contents.find(x => x.substance === "co2")!.mass).toBeCloseTo(g.total("co2"), 12);
    assertConserved(g);
  });
  it("sums exposure for a body standing in a cell and reads the lower half crouching", () => {
    const g = new Grid(reg, { ...base, nx: 2, ny: 1 });
    g.release("co2", 0, 0, 0, 0.05, "vent");
    const body = comp("b", "body");
    g.expose(body, g.at(0, 0), 60);
    expect(body.props.co2ppmMin).toBeCloseTo(g.ppm("co2", g.at(0, 0)), 6);
    g.expose(body, g.at(0, 0), 60, "low");
    expect(body.props.co2ppmMin).toBeCloseTo(g.ppm("co2", g.at(0, 0)) * 2.5, 6);
  });
  it("refuses a diffusion share that would be unstable", () => {
    const g = new Grid(reg, { ...base, nx: 2, ny: 2 });
    expect(() => g.step(1, { diffusion: 0.2 })).toThrow(/diffusion/);
  });
  it("leaves the background air alone: nothing moves in the clean grid", () => {
    const g = new Grid(reg, { ...base, nx: 6, ny: 2, nz: 2, elevationM: x => x });
    for (let k = 0; k < 50; k++) g.step(1, { windMS: [0.7, 0.3], diffusion: 0.1, settle: 0.5, rise: 0.5 });
    for (const sp of g.species) for (const v of g.kg[sp]!) expect(v).toBeCloseTo(g.background[sp]!, 12);
    expect(MMHG_PER_PA).toBeGreaterThan(0);
  });
});
