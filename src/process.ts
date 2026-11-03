/**
 * Service 3: the conservation and process engine. Each process moves a quantity along the graph by a real formula
 * (physics.ts) and records every transfer in the trace. Lumped, explicit, per-step: the first build's simplification.
 */
import type { Process } from "./scheduler.ts";
import { addHeat } from "./world.ts";
import { roomAirProcess, roomGasFraction } from "./atmosphere.ts";
import { CP, R_GAS, counterflowEffectiveness, condenserWaterCoefficient, surfaceEvaporationKgPerS, C_TO_K, M, carbonCombustion, heatFlow, waterBoilingPoint, waterLatentHeat } from "./physics.ts";

export { roomGasFraction };

/** A seeded random for reproducible control noise and measurement noise (mulberry32), from the kernel. */
export { rng } from "@rex/kernel";

/**
 * Operator control: the fuel feed oscillates around the target with an amplitude set by skill (0 to 100). Skill never
 * changes the physics; it changes how close the feed stays to the target (Rex's principle).
 */
export function controlProcess(heater: string, targetKgPerS: number, skill: number, rand: () => number): Process {
  return { name: "control", every: 10, step(w, dt) {
    const h = w.registry.component(heater);
    const amp = 0.6 * (1 - skill / 100);           // a master +/-0%, a novice +/-60% (placeholder scale; the shape is the rule)
    const noise = (rand() * 2 - 1) * amp;
    h.props.feedKgPerS = Math.max(0, targetKgPerS * (1 + noise) * h.condition.control);
    void dt;
  } };
}

/** Combustion at the heater: burns the fed charcoal with the room's oxygen, heat to the vessel (heat edge) and the rest to the room. */
export function combustionProcess(heater: string, room: string): Process {
  return { name: "combustion", every: 1, step(w, dt) {
    const h = w.registry.component(heater), r = w.registry.component(room), reg = w.registry;
    const feed = (h.props.feedKgPerS ?? 0) * dt;
    const fuelAvailable = reg.contentMass(h, "charcoal", "solid");
    let kg = Math.min(feed, fuelAvailable);
    const o2Frac = roomGasFraction(w, r, "o2");
    if (o2Frac < 0.05) kg = 0;                       // a fire cannot burn under about 5% oxygen (a simplification)
    if (kg <= 0) { h.props.heatW = 0; return; }
    const c = carbonCombustion(kg, o2Frac);
    const o2Available = reg.contentMass(r, "o2", "gas");
    if (c.kgO2 > o2Available) { const s = o2Available / c.kgO2; kg *= s; }
    const cc = carbonCombustion(kg, o2Frac);
    reg.addContent(h, "charcoal", "solid", -kg);
    reg.addContent(r, "o2", "gas", -cc.kgO2);
    reg.addContent(r, "co2", "gas", cc.kgCO2);
    reg.addContent(r, "co", "gas", cc.kgCO);
    w.trace.record({ t: w.t, process: "combustion", quantity: "mass:charcoal", from: heater, to: "burned", chemicalChange: true, amount: kg });
    w.trace.record({ t: w.t, process: "combustion", quantity: "mass:o2", from: room, to: "burned", chemicalChange: true, amount: cc.kgO2 });
    w.trace.record({ t: w.t, process: "combustion", quantity: "mass:co2", from: "burned", to: room, chemicalChange: true, amount: cc.kgCO2 });
    if (cc.kgCO > 0) w.trace.record({ t: w.t, process: "combustion", quantity: "mass:co", from: "burned", to: room, chemicalChange: true, amount: cc.kgCO });
    // heat: the heater's efficiency (an open charcoal fire to a pot: about 0.3; a well-set furnace 0.5) goes to the vessel edge, the rest to the room
    const eff = (h.props.efficiency ?? 0.3) * h.condition.capability;
    const toVessel = cc.heatJ * eff, toRoom = cc.heatJ - toVessel;
    h.props.heatW = cc.heatJ / dt;
    for (const e of w.graph.from(heater, "heat")) { addHeat(w, reg.component(e.to), toVessel); w.trace.record({ t: w.t, process: "combustion", quantity: "energy", from: heater, to: e.to, amount: toVessel }); }
    addHeat(w, r, toRoom); w.trace.record({ t: w.t, process: "combustion", quantity: "energy", from: heater, to: room, amount: toRoom });
    w.trace.record({ t: w.t, process: "combustion", quantity: "energy", from: "fuel", to: heater, amount: cc.heatJ });
  } };
}

/** Convective losses from every component with props.area_m2 and props.h to the room's air. */
export function lossesProcess(room: string, components: string[]): Process {
  return { name: "losses", every: 1, step(w, dt) {
    const r = w.registry.component(room);
    for (const id of components) {
      const c = w.registry.component(id);
      const q = heatFlow(c.props.h ?? 10, c.props.area_m2 ?? 0, c.temperatureC - r.temperatureC) * dt;
      if (q === 0) continue;
      addHeat(w, c, -q); addHeat(w, r, q);
      w.trace.record({ t: w.t, process: "losses", quantity: "energy", from: id, to: room, amount: q });
    }
  } };
}

/** Free-surface evaporation below boiling: ASHRAE coefficient in physics.ts.
 * Vapour enters room air; latent heat is removed from the vessel. Explicit lumped step.
 */
export function evaporationProcess(vessel: string, room: string): Process {
  return { name: "evaporation", every: 1, step(w, dt) {
    const reg = w.registry, v = reg.component(vessel), r = reg.component(room);
    const liquid = reg.contentMass(v, "water", "liquid");
    if (dt <= 0 || liquid <= 0 || v.temperatureC < 1 || v.temperatureC >= waterBoilingPoint(r.props.pressurePa)) return;
    const partial = reg.contentMass(r, "water", "gas") / M.H2O * R_GAS * (r.temperatureC + C_TO_K) / r.props.volume_m3;
    const temperature = v.temperatureC, L = waterLatentHeat(temperature);
    // Limit to available sensible energy above Antoine's 1 C lower domain, including the departing water's capacity.
    const energyLimited = reg.heatCapacity(v) * (temperature - 1) / (L + CP.water * (temperature - 1));
    const kg = Math.min(liquid, energyLimited, surfaceEvaporationKgPerS(v.props.freeSurface_m2 ?? 0, temperature, partial) * dt);
    if (kg <= 0) return;
    reg.addContent(v, "water", "liquid", -kg);
    const roomEnergy = reg.heatCapacity(r) * r.temperatureC;
    reg.addContent(r, "water", "gas", kg);
    r.temperatureC = (roomEnergy + kg * CP.waterVapour * temperature) / reg.heatCapacity(r);
    addHeat(w, v, -kg * L);
    w.trace.record({ t: w.t, process: "evaporation", quantity: "mass:water", from: vessel, to: room, amount: kg });
    w.trace.record({ t: w.t, process: "evaporation", quantity: "energy", from: vessel, to: "latent", amount: kg * L });
    w.trace.record({ t: w.t, process: "evaporation", quantity: "energy", from: vessel, to: room, amount: kg * CP.water * temperature, note: "carried enthalpy relative to liquid at 0 C; vapour mixes at departure temperature" });
  } };
}

/** Lumped wall: h A (Tair-Twall), then U_out A (Twall-Toutside).
 * The tabulated whole-wall U includes the indoor film; remove 1/h from its resistance
 * so the explicit indoor film is not counted twice. Sources: BRICK_WALL in physics.ts.
 */
export function wallsProcess(room: string, walls: string): Process {
  return { name: "walls", every: 1, step(w, dt) {
    const r = w.registry.component(room), wall = w.registry.component(walls);
    const area = wall.props.area_m2, h = wall.props.h;
    const qIn = heatFlow(h, area, r.temperatureC - wall.temperatureC) * dt;
    const uOut = 1 / (1 / wall.props.U - 1 / h);
    const qOut = heatFlow(uOut, area, wall.temperatureC - w.env.outsideC) * dt;
    addHeat(w, r, -qIn); addHeat(w, wall, qIn - qOut);
    w.trace.record({ t: w.t, process: "walls", quantity: "energy", from: qIn >= 0 ? room : walls, to: qIn >= 0 ? walls : room, amount: Math.abs(qIn) });
    w.trace.record({ t: w.t, process: "walls", quantity: "energy", from: qOut >= 0 ? walls : "outside", to: qOut >= 0 ? "outside" : walls, amount: Math.abs(qOut) });
  } };
}

/**
 * Boiling in a vessel: when the water's vapour pressure reaches the pressure over it, the temperature holds at the boiling
 * point and the surplus heat vaporises water at the latent heat; the vapour goes down the gas edge to the condenser.
 */
export function boilingProcess(vessel: string, room: string): Process {
  return { name: "boiling", every: 1, step(w, dt) {
    const v = w.registry.component(vessel), r = w.registry.component(room), reg = w.registry;
    const tb = waterBoilingPoint(r.props.pressurePa);
    v.props.boilingPointC = tb;
    const liquid = reg.contentMass(v, "water", "liquid");
    if (liquid <= 0 || v.temperatureC < tb) return;
    const cap = reg.heatCapacity(v);
    const surplus = (v.temperatureC - tb) * cap;         // J above the boiling point this step
    if (surplus <= 0) return;
    const L = waterLatentHeat(tb);
    const kg = Math.min(liquid, surplus / L);
    reg.addContent(v, "water", "liquid", -kg);
    v.temperatureC = tb + (surplus - kg * L) / reg.heatCapacity(v);
    w.trace.record({ t: w.t, process: "boiling", quantity: "energy", from: vessel, to: "latent", amount: kg * L });
    const edges = w.graph.from(vessel, "gas");
    if (edges.length === 0) { reg.addContent(r, "water", "gas", kg); w.trace.record({ t: w.t, process: "boiling", quantity: "mass:water", from: vessel, to: room, amount: kg }); return; }
    const e = edges[0];
    const target = reg.component(e.to);
    reg.addContent(target, "water", "gas", kg);
    target.props.vapourInKgPerS = kg / dt; target.props.vapourTempC = tb;
    w.trace.record({ t: w.t, process: "boiling", quantity: "mass:water", from: vessel, to: e.to, amount: kg, note: `at ${tb.toFixed(2)} C` });
    void dt;
  } };
}

/** Counterflow condenser with isothermal steam (Cr=0): epsilon=1-exp(-UA/Ccold).
 * Coolant recirculates from and returns to the lumped tub; no external cold-water supply.
 * Water-side natural convection sets U; small circulation's forced-convection enhancement
 * is neglected. Liquid leaves at saturation temperature (no subcooling section), then mixes
 * with the collector. Sources and property approximations are in physics.ts.
 */
export function condensationProcess(condenser: string, tub: string, collector: string, room: string): Process {
  return { name: "condensation", every: 1, step(w, dt) {
    const c = w.registry.component(condenser), tb = w.registry.component(tub), col = w.registry.component(collector), r = w.registry.component(room), reg = w.registry;
    const vap = reg.contentMass(c, "water", "gas");
    if (vap <= 0 || dt <= 0) return;
    const tv = c.props.vapourTempC ?? 100;
    const L = waterLatentHeat(tv);
    const delta = Math.max(0, tv - tb.temperatureC);
    const flow = Math.min(Math.max(0, c.props.coolantKgPerS ?? 0), reg.contentMass(tb, "water", "liquid") / dt);
    const coldCapacityRate = flow * CP.water;
    const ua = condenserWaterCoefficient(delta, c.props.diameter_m) * c.props.area_m2 * c.condition.capability;
    const effectiveness = coldCapacityRate > 0 ? counterflowEffectiveness(ua / coldCapacityRate, 0) : 0;
    c.props.effectiveness = effectiveness;
    c.props.U = ua / c.props.area_m2;
    // Finite tub inventory also bounds a long step; the recirculating stream returns its heat.
    const qMax = Math.min(effectiveness * coldCapacityRate * delta * dt, reg.heatCapacity(tb) * delta);
    const kgCond = Math.min(vap, qMax / L);
    const kgLost = vap - kgCond;
    reg.addContent(c, "water", "gas", -vap);
    if (kgCond > 0) {
      const collectorEnergy = reg.heatCapacity(col) * col.temperatureC + kgCond * CP.water * tv;
      reg.addContent(col, "water", "liquid", kgCond);
      col.temperatureC = collectorEnergy / reg.heatCapacity(col);
      w.trace.record({ t: w.t, process: "condensation", quantity: "energy", from: condenser, to: collector, amount: kgCond * CP.water * tv, note: "saturated liquid sensible enthalpy, reference 0 C" });
      addHeat(w, tb, kgCond * L);
      w.trace.record({ t: w.t, process: "condensation", quantity: "mass:water", from: condenser, to: collector, amount: kgCond });
      w.trace.record({ t: w.t, process: "condensation", quantity: "energy", from: "latent", to: tub, amount: kgCond * L });
    }
    if (kgLost > 0) {
      reg.addContent(r, "water", "gas", kgLost);
      w.trace.record({ t: w.t, process: "condensation", quantity: "mass:water", from: condenser, to: room, amount: kgLost, note: "uncondensed, to the room" });
    }
  } };
}

/** The room's box model: ventilation exchanges its gases and heat with the outside at ACH; humidity from its vapour. It lives in atmosphere.ts. */
export function roomProcess(room: string): Process { return roomAirProcess(room); }

/** A thermometer on a component: reading = true + offset(drift x days) + noise(sigma); accuracy condition widens sigma. */
export function thermometerProcess(thermometer: string, target: string, daysSinceCalibration: number, rand: () => number): Process {
  return { name: "thermometer", every: 10, step(w) {
    const th = w.registry.component(thermometer), tg = w.registry.component(target);
    const offset = (th.props.driftKPerDay ?? 0.05) * daysSinceCalibration;
    const sigma = (th.props.sigmaK ?? 0.5) / Math.max(0.1, th.condition.accuracy);
    const n = (rand() + rand() + rand() - 1.5) * 2 * sigma; // roughly normal
    th.props.reading = tg.temperatureC + offset + n;
    th.props.trueValue = tg.temperatureC;
  } };
}

/** Wear: a vessel at heat loses control and capability slowly; a condenser scales; placeholders by material (SCIENTIFIC_EQUIPMENT 4). */
export function wearProcess(components: string[]): Process {
  return { name: "wear", every: 60, step(w, dt) {
    for (const id of components) {
      const c = w.registry.component(id);
      const mat = w.registry.material(c.material);
      const hot = c.temperatureC / mat.maxTemperatureC;
      const rate = (c.props.wearPerHourAtMax ?? 0.01) * Math.max(0, hot - 0.5) / 0.5 / 3600; // per second
      c.condition.control = Math.max(0, c.condition.control - rate * dt);
      c.condition.capability = Math.max(0, c.condition.capability - rate * dt * 0.5);
      if (c.temperatureC > mat.maxTemperatureC) { c.condition.capability = 0; w.trace.note(w.t, `${id} failed: ${c.temperatureC.toFixed(0)} C over ${mat.name}'s ${mat.maxTemperatureC}`); }
    }
  } };
}
