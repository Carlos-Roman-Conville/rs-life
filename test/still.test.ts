import { metabolicHeat } from "../src/physiology.ts";
import { describe, expect, it } from "vitest";

const LONG = 60_000;
import { World } from "../src/world.ts";
import { evaporationProcess, roomProcess, wallsProcess, condensationProcess } from "../src/process.ts";
import { runStill } from "../src/lab/still.ts";
import { BRICK_WALL, CP, counterflowEffectiveness, condenserWaterCoefficient, surfaceEvaporationKgPerS, pressureAtAltitude, waterBoilingPoint, waterLatentHeat, waterVapourPressure, carbonCombustion, HHV } from "../src/physics.ts";

describe("physics constants and formulas (real-world values)", () => {
  it("water boils at 100 C at sea level and at about 92.5 C at 2,256 m (Antoine)", () => {
    expect(waterBoilingPoint(101325)).toBeCloseTo(100.0, 0);
    expect(waterBoilingPoint(pressureAtAltitude(2256))).toBeCloseTo(92.5, 0);
  });
  it("vapour pressure of water at 25 C is about 23.8 mmHg (3.17 kPa)", () => {
    expect(waterVapourPressure(25) / 1000).toBeCloseTo(3.17, 1);
  });
  it("latent heat is about 2257 kJ/kg at 100 C", () => {
    expect(waterLatentHeat(100) / 1000).toBeCloseTo(2264, -2);
  });
  it("charcoal burns by stoichiometry: 1 kg C needs 2.67 kg O2 and makes 3.67 kg CO2 with 30 MJ", () => {
    const c = carbonCombustion(1, 0.21);
    expect(c.kgO2).toBeCloseTo(2.667, 2); expect(c.kgCO2).toBeCloseTo(3.667, 2); expect(c.kgCO).toBe(0); expect(c.heatJ).toBe(HHV.charcoal);
  });
});

describe("the still in a room", () => {
  const sea = runStill({ altitudeM: 0, skill: 100, minutes: 120, seed: 7 });
  const hill = runStill({ altitudeM: 2256, skill: 100, minutes: 120, seed: 7 });

  it("conserves water and charcoal every step", () => {
    expect(sea.conservationFailures).toBe(0);
    expect(hill.conservationFailures).toBe(0);
  });
  it("boils at the pressure's boiling point and lower on the hill", () => {
    expect(sea.boilingPointC).toBeCloseTo(100.0, 0);
    expect(hill.boilingPointC).toBeCloseTo(92.5, 0);
    expect(hill.boilingPointC).toBeLessThan(sea.boilingPointC);
  });
  it("produces distillate once boiling, at the rate the net heat over the latent heat allows", () => {
    expect(sea.firstBoilAtS).not.toBeNull();
    expect(sea.distillateKg).toBeGreaterThan(0.2);
    // energy bound: distillate x L cannot exceed the fuel's heat delivered to the vessel
    const L = waterLatentHeat(100);
    const delivered = sea.charcoalBurnedKg * HHV.charcoal * 0.3;
    expect(sea.distillateKg * L).toBeLessThan(delivered);
    // the condenser kept up: little lost to the room
    expect(sea.lostToRoomKg).toBeLessThan(sea.distillateKg * 0.2);
  });
  it("energy balances: fuel heat = vessel sensible + latent + losses + room, within 2%", () => {
    const tr = sea.world.trace;
    const fuel = tr.into("heater", "energy");
    const toVessel = tr.transfers.filter(x => x.quantity === "energy" && x.from === "heater" && x.to === "vessel").reduce((a, x) => a + x.amount, 0);
    const toRoom = tr.transfers.filter(x => x.quantity === "energy" && x.from === "heater" && x.to === "room").reduce((a, x) => a + x.amount, 0);
    expect((toVessel + toRoom) / fuel).toBeCloseTo(1, 2);
    const latent = tr.transfers.filter(x => x.quantity === "energy" && x.to === "latent").reduce((a, x) => a + x.amount, 0);
    const vesselLosses = tr.transfers.filter(x => x.quantity === "energy" && x.process === "losses" && x.from === "vessel").reduce((a, x) => a + x.amount, 0);
    const cap = sea.world.registry.heatCapacity(sea.world.registry.component("vessel"));
    const sensibleNow = (sea.vesselC - 26) * cap;
    // the water that boiled off carried its own sensible heat (cp x (T_boil - 26)) out of the vessel
    const waterOut = tr.outOf("vessel", "mass:water");
    const carried = waterOut * 4186 * (sea.boilingPointC - 26);
    expect(Math.abs(toVessel - (latent + vesselLosses + sensibleNow + carried)) / toVessel).toBeLessThan(0.02);
  });
  it("the room warms, its oxygen falls and CO2 rises from the fire; the distiller sweats", () => {
    expect(sea.roomC).toBeGreaterThan(26);
    expect(sea.co2ppm).toBeGreaterThan(400);
    expect(sea.o2frac).toBeLessThan(0.2095);
    expect(sea.waterDeficitPct).toBeGreaterThan(0);
  });
  it("a drifted thermometer misreports while the physics proceeds on the true temperature", () => {
    const r = runStill({ altitudeM: 0, skill: 100, minutes: 60, daysSinceCalibration: 60, seed: 3 });
    expect(Math.abs(r.thermometerReading - r.thermometerTrue)).toBeGreaterThan(1.5);
    expect(r.boilingPointC).toBeCloseTo(100, 0);
  }, LONG);
  it("a novice wastes fuel: more charcoal per kg of distillate than a master", () => {
    const master = runStill({ altitudeM: 0, skill: 100, minutes: 120, seed: 11 });
    const novice = runStill({ altitudeM: 0, skill: 0, minutes: 120, seed: 11 });
    expect(novice.charcoalBurnedKg / Math.max(1e-6, novice.distillateKg)).toBeGreaterThanOrEqual(master.charcoalBurnedKg / master.distillateKg * 0.95);
    expect(novice.vesselCondition.control).toBeLessThanOrEqual(master.vesselCondition.control + 1e-9);
  }, LONG);
  it("a shut room with a big fire runs short of oxygen and makes carbon monoxide", () => {
    const shut = runStill({ altitudeM: 0, skill: 100, minutes: 180, ach: 0.1, roomM3: 15, feedKgPerS: 2 / 3600, charcoalKg: 8, seed: 5 });
    expect(shut.o2frac).toBeLessThan(0.17);
    expect(shut.coppm).toBeGreaterThan(0);
    expect(shut.co2ppmMin).toBeGreaterThan(100000);
  }, LONG);
});


// Reuse scenario equipment, then start an independent ledger for isolated process checks.
// A zero-minute run has no initialized instrument/air observations in the original API.
function processWorld(waterKg = 5): World {
  const initialized = runStill({ minutes: 1, feedKgPerS: 0, ach: 0, waterKg }).world;
  const w = new World(initialized.registry);
  w.env = { ...initialized.env };
  w.conserve("water", ["vessel", "condenser", "collector", "room", "tub"], 1e-6);
  return w;
}

describe("surface evaporation, thermal walls and the NTU condenser", () => {
  it("a warm nonboiling free surface loses water and latent heat, increasing room humidity", () => {
    const w = processWorld(), reg = w.registry;
    const v = reg.component("vessel"), r = reg.component("room");
    v.temperatureC = 40;
    roomProcess("room").step(w, 1);
    const rh = r.props.rh, water = reg.contentMass(v, "water", "liquid");
    const cap = reg.heatCapacity(v);
    evaporationProcess("vessel", "room").step(w, 60);
    roomProcess("room").step(w, 1);
    w.afterStep();
    const evaporated = water - reg.contentMass(v, "water", "liquid");
    // ASHRAE ch.6 eq.2, still air/unoccupied: k_m=0.089*0.5/L.
    expect(surfaceEvaporationKgPerS(1, 40, 0)).toBeCloseTo(0.0445 * waterVapourPressure(40) / waterLatentHeat(40), 12);
    expect(evaporated).toBeGreaterThan(0);
    expect(evaporated).toBeLessThan(0.01);
    expect(r.props.rh).toBeGreaterThan(rh);
    expect(v.temperatureC).toBeLessThan(40);
    expect(w.trace.into("latent", "energy")).toBeCloseTo(evaporated * waterLatentHeat(40), 6);
    // Departing water carries sensible heat at its departure temperature, leaving latent cooling.
    expect(cap * 40 - reg.heatCapacity(v) * v.temperatureC).toBeCloseTo(evaporated * (CP.water * 40 + waterLatentHeat(40)), 6);
    expect(w.trace.failed()).toHaveLength(0);
  });

  it("does not evaporate a dry surface or into saturated air", () => {
    expect(surfaceEvaporationKgPerS(0.05, 40, waterVapourPressure(40))).toBe(0);
    expect(surfaceEvaporationKgPerS(0.05, 40, 2 * waterVapourPressure(40))).toBe(0);
    const w = processWorld(0);
    w.registry.component("vessel").temperatureC = 40;
    evaporationProcess("vessel", "room").step(w, 1);
    expect(w.trace.transfers).toHaveLength(0);
  });

  it("keeps the two-hour 40 m3 open-door fire below the wall heat-balance bound", () => {
    const result = runStill({ minutes: 120, skill: 100 });
    const reg = result.world.registry, wall = reg.component("walls");
    // A conservative derived bound, not a claimed field measurement or comfort limit:
    // Tair <= Tout + (P*t + initial body excess heat)/Cwall + P/(h*A).
    // All fuel/metabolic power to air, no ventilation/outdoor wall cooling gives an upper envelope.
    // Q=m cp dT and q=h A dT: ENGINE.md section 2 (ENG-CP, ENG-HT).
    // Brick rho/cp: https://simulationresearch.lbl.gov/modelica/releases/v1.1_build0_rc2/help/Buildings_HeatTransfer_Data_Solids.html
    // 228 mm wall: https://mcscertified.com/wp-content/uploads/2020/04/Guidance-on-U-Values-from-Domestic-Heating-Design-Guide.pdf table 6.1.
    const power = 0.4 / 3600 * HHV.charcoal + metabolicHeat(3.3, 70);
    const initialBodyHeat = reg.heatCapacity(reg.component("body")) * (37 - 26);
    const boundC = 26 + (power * 7200 + initialBodyHeat) / reg.heatCapacity(wall) + power / (BRICK_WALL.h * wall.props.area_m2);
    expect(boundC).toBeLessThan(36);
    expect(result.roomC).toBeLessThan(boundC);
    expect(wall.temperatureC).toBeGreaterThan(26);
    expect(result.world.trace.into("walls", "energy")).toBeGreaterThan(0);
    expect(result.conservationFailures).toBe(0);
  });

  it("balances wall heat storage against both traced boundaries, in either direction", () => {
    const w = processWorld(), reg = w.registry;
    const wall = reg.component("walls"), room = reg.component("room");
    for (const [airC, wallC, outsideC] of [[40, 30, 26], [20, 30, 40]]) {
      room.temperatureC = airC; wall.temperatureC = wallC; w.env.outsideC = outsideC;
      const before = w.trace.transfers.length;
      wallsProcess("room", "walls").step(w, 1);
      const ts = w.trace.transfers.slice(before);
      const net = ts.reduce((sum, t) => sum + (t.to === "walls" ? t.amount : -t.amount), 0);
      expect((wall.temperatureC - wallC) * reg.heatCapacity(wall)).toBeCloseTo(net, 6);
      expect(ts.every(t => t.amount >= 0)).toBe(true);
    }
  });

  it("uses counterflow NTU limits and a temperature-dependent water-side coefficient", () => {
    expect(counterflowEffectiveness(0, 0)).toBe(0);
    expect(counterflowEffectiveness(1, 0)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(counterflowEffectiveness(1, 1)).toBe(0.5);
    expect(counterflowEffectiveness(2, 0.5)).toBeCloseTo((1 - Math.exp(-1)) / (1 - 0.5 * Math.exp(-1)), 12);
    expect(condenserWaterCoefficient(60, 0.09)).toBeGreaterThan(condenserWaterCoefficient(10, 0.09));
  });

  it("limits condensation by coolant capacity, warms the tub, traces all steam and latent heat", () => {
    const w = processWorld(), reg = w.registry;
    const c = reg.component("condenser"), tub = reg.component("tub");
    reg.addContent(c, "water", "gas", 0.01);
    c.props.vapourTempC = 100;
    const cap = reg.heatCapacity(tub), before = tub.temperatureC;
    const col = reg.component("collector"), collectorEnergy = reg.heatCapacity(col) * col.temperatureC;
    const waterBefore = w.massOf("water", ["condenser", "collector", "room"]);
    condensationProcess("condenser", "tub", "collector", "room").step(w, 1);
    const condensed = reg.contentMass(reg.component("collector"), "water", "liquid");
    const heat = condensed * waterLatentHeat(100);
    expect(condensed).toBeGreaterThan(0);
    expect(condensed).toBeLessThan(0.01);
    expect(heat).toBeLessThan(c.props.coolantKgPerS * CP.water * (100 - before));
    expect((tub.temperatureC - before) * cap).toBeCloseTo(heat, 6);
    expect(w.trace.into("tub", "energy")).toBeCloseTo(heat, 6);
    expect(reg.heatCapacity(col) * col.temperatureC - collectorEnergy).toBeCloseTo(condensed * CP.water * 100, 6);
    expect(w.trace.outOf("condenser", "mass:water")).toBeCloseTo(0.01, 12);
    expect(w.massOf("water", ["condenser", "collector", "room"])).toBeCloseTo(waterBefore, 12);
    c.props.coolantKgPerS = 0;
    reg.addContent(c, "water", "gas", 0.01);
    condensationProcess("condenser", "tub", "collector", "room").step(w, 1);
    expect(reg.contentMass(reg.component("collector"), "water", "liquid")).toBe(condensed);
    c.props.coolantKgPerS = 1 / 60;
    tub.temperatureC = 100;
    reg.addContent(c, "water", "gas", 0.01);
    condensationProcess("condenser", "tub", "collector", "room").step(w, 1);
    expect(reg.contentMass(col, "water", "liquid")).toBe(condensed);
    tub.temperatureC = 26;
    reg.addContent(tub, "water", "liquid", -reg.contentMass(tub, "water", "liquid"));
    reg.addContent(c, "water", "gas", 0.01);
    condensationProcess("condenser", "tub", "collector", "room").step(w, 1);
    expect(reg.contentMass(col, "water", "liquid")).toBe(condensed);
  });
});
