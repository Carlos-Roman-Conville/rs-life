import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { libraryRow, libraryTable } from "../src/library.ts";
import { bodyOutputs } from "../src/physiology.ts";
import {
  baselineMoves, breathingDrive, clockRules, concentration, dependence, dose, mealAvailability, neuroCircuits, neuroSubstance, neuroSubstances,
  neuroSystems, neurologyProcess, occupancy, onBoardKg, pkStep, rebound, recoveryStep, registerDrugs, synergyRule, toleranceStep,
  type NeuroParams,
} from "../src/neurology.ts";

const DAY = 86400, HOUR = 3600, MIN = 60;

interface Setup { body?: Record<string, number>; params?: NeuroParams; massKg?: number }

/** A 70 kg body with the neurology process alone, one-minute steps; clockH0 12 puts the first day close 24 h in. Asleep unless a test says otherwise, so no hours awake build. */
function build(s: Setup = {}) {
  const reg = defaultRegistry(), w = new World(reg);
  const body: Component = { id: "body", kind: "body", material: "flesh", mass: s.massKg ?? 70, temperatureC: 37, contents: [], ports: [],
    condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1, asleep: 1, ...s.body } };
  reg.addComponent(body);
  registerDrugs(w);
  const sch = new Scheduler();
  sch.add(neurologyProcess("body", { every: 1, clockH0: 12, params: s.params }));
  return { w, sch, body, out: bodyOutputs(body) };
}
type Built = ReturnType<typeof build>;
const run = (x: Built, seconds: number) => x.sch.run(x.w, seconds, MIN);

// the pk row for alcohol: absorption half-time 30 min, zero order 0.015 g/dL per hour, Widmark 0.68 (men)
const TA_H = 0.5, BETA = 0.015, R_MAN = 0.68;
const widmark = (grams: number, kg: number, tH: number) => grams / (R_MAN * kg) / 10 * (1 - Math.pow(2, -tH / TA_H)) - BETA * tH;

describe("the library rows", () => {
  it("reads the ten systems, the eight kinetic rows, the eleven circuits", () => {
    expect(neuroSystems()).toHaveLength(10);
    expect(neuroSystems().map(s => s.id)).toContain("histamine_orexin");
    expect(neuroSubstances().map(s => s.key)).toEqual(["alcohol", "laudanum", "tobacco", "caffeine", "quinine", "mercury", "lead", "hemp"]);
    expect(neuroCircuits()).toHaveLength(11);
    expect(neuroCircuits().map(c => c.id)).toEqual(["arousal", "motor-control", "reward-and-habit", "attention", "pain-gating", "memory-and-learning",
      "breathing-drive", "mood-regulation", "fear-and-stress", "appetite", "sleep"]);
  });
  it("parses kinetics, hits and the stated ranges from the row text", () => {
    const a = neuroSubstance("alcohol");
    expect(a.absorbHalfMin).toBe(30);
    expect(a.elimination).toEqual({ kind: "zero", gPerDLPerH: 0.015 });
    expect([a.vdMan, a.vdWoman]).toEqual([0.68, 0.55]);
    expect(a.hits.filter(h => !h.delayed).map(h => [h.system, h.potency])).toEqual([["gaba", 0.3], ["glutamate", -0.3], ["dopamine", 0.15], ["opioid", 0.1]]);
    expect(a.hits.find(h => h.system === "adenosine")?.delayed).toBe(true);
    expect(neuroSubstance("laudanum").elimination).toEqual({ kind: "half", hours: 3 });
    expect(neuroSubstance("hemp").elimination).toEqual({ kind: "half", hours: 36 });   // "1 to 2 days" at its middle
    expect(neuroSubstance("mercury").accumulates).toBe(true);
    expect(neuroSubstance("quinine").hits).toEqual([]);
    expect(neuroSubstance("caffeine").standardDose).toEqual({ lo: 80, hi: 80, unit: "mg" });
    const byId = (id: string) => neuroCircuits().find(c => c.id === id)!;
    expect([byId("arousal").lo, byId("arousal").hi]).toEqual([0, 2]);
    expect([byId("mood-regulation").lo, byId("mood-regulation").hi]).toEqual([-1, 1]);
    expect([byId("appetite").lo, byId("appetite").hi]).toEqual([0.5, 1.5]);
    expect(byId("motor-control").terms[0]).toMatchObject({ system: "gaba", weight: null, invertedU: true });
    expect(byId("sleep").terms.find(t => t.system === "histamine_orexin")?.weight).toBe(-0.3);
    expect(byId("memory-and-learning").blockedOverAlcohol).toBe(0.08);
  });
});

describe("alcohol on the Widmark curve", () => {
  it.each(["alcohol", "caffeine"])("counts %s once through 12 hours, including a second dose", key => {
    const x = build(), quantity = `mass:drug:${key}`;
    x.w.conserve(`drug:${key}`, ["body"], 1e-12);
    const doseKg = key === "alcohol" ? 0.035 : 80e-6;
    let total = 0;
    const check = () => {
      const gut = x.body.props[`neu_gut_${key}`] ?? 0;
      const central = x.body.props[`neu_c_${key}`] ?? 0;
      const eliminated = x.w.trace.into("elimination", quantity);
      expect(Math.abs(gut + central - (total - eliminated))).toBeLessThanOrEqual(1e-12);
      expect(x.w.registry.contentMass(x.body, `drug:${key}`)).toBe(gut + central);
      expect(onBoardKg(x.w, "body", key)).toBe(gut + central);
      const absorbed = x.w.trace.into("body:central", quantity);
      expect(Math.abs(gut - (total - absorbed))).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(central - (absorbed - eliminated))).toBeLessThanOrEqual(1e-12);
    };
    for (let minute = 0; minute < 12 * 60; minute++) {
      if (minute === 0 || minute === 6 * 60) {
        dose(x.w, "body", key, doseKg * 1000, { unit: "g" });
        total += doseKg;
        check();
      }
      run(x, MIN);
      check();
    }
    expect(x.w.trace.into("body", quantity)).toBe(total);
    expect(x.w.trace.failed()).toEqual([]);
  });
  it("reads compartment mass and repairs a stale registry view on a PK step", () => {
    const x = build();
    dose(x.w, "body", "alcohol", 35);
    x.body.contents.find(c => c.substance === "drug:alcohol")!.mass = 1;
    expect(onBoardKg(x.w, "body", "alcohol")).toBe(0.035);
    run(x, MIN);
    expect(x.w.registry.contentMass(x.body, "drug:alcohol")).toBe(onBoardKg(x.w, "body", "alcohol"));
    x.body.props.neu_gut_alcohol = 0;
    x.body.props.neu_c_alcohol = 0;
    run(x, MIN);
    expect(x.w.registry.contentMass(x.body, "drug:alcohol")).toBe(0);
  });
  it("peaks 30 to 90 minutes after 0.5 g/kg in a 70 kg man and clears at 0.015 g/dL an hour", () => {
    const x = build();
    x.w.conserve("drug:alcohol", ["body"], 1e-12);
    dose(x.w, "body", "alcohol", 0.5 * 70);                                 // 35 g
    const conc: number[] = [];
    for (let i = 0; i < 600; i++) { run(x, MIN); conc.push(Number(x.out.conc_alcohol)); }
    // concentration after step i is the state at (i + 1) minutes, to the closed form of the row
    let peakI = 0;
    conc.forEach((c, i) => { if (c > conc[peakI]!) peakI = i; });
    for (let i = 0; i < 600; i++) {
      const tH = (i + 1) / 60, want = widmark(35, 70, tH);
      if (want > 1e-6) expect(conc[i]!).toBeCloseTo(want, 8);
    }
    const peakMin = peakI + 1;
    expect(peakMin).toBeGreaterThanOrEqual(30);
    expect(peakMin).toBeLessThanOrEqual(90);
    // the closed-form peak: absorption rate D ln2 / ta = beta
    const D = 35 / (R_MAN * 70) / 10, tPeakH = TA_H * Math.log2(D * Math.LN2 / (TA_H * BETA));
    expect(Math.abs(peakMin - tPeakH * 60)).toBeLessThanOrEqual(1);
    expect(conc[peakI]!).toBeCloseTo(widmark(35, 70, tPeakH), 3);
    expect(conc[peakI]!).toBeCloseTo(0.042, 3);
    // cleared where the closed form crosses zero
    let lo = tPeakH, hi = 12;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (widmark(35, 70, m) > 0) lo = m; else hi = m; }
    const clearI = conc.findIndex((c, i) => i > peakI && c <= 1e-12);
    expect(Math.abs((clearI + 1) / 60 - lo)).toBeLessThan(2 / 60);
    // what is left is the first-order tail of the gut, 35 g x 2^-20
    expect(onBoardKg(x.w, "body", "alcohol")).toBeLessThan(1e-7);
    expect(x.w.trace.outOf("body", "mass:drug:alcohol")).toBeCloseTo(0.035, 6);
    expect(x.w.trace.failed()).toEqual([]);
  });
  it("is slower with a damaged liver, lower in a woman (0.55) and after a meal (66 to 71% available)", () => {
    const clears = (s: Setup, meal = false) => {
      const x = build(s);
      dose(x.w, "body", "alcohol", 35, { meal });
      for (let i = 0; i < 900; i++) { run(x, MIN); if (Number(x.out.conc_alcohol) <= 1e-12 && i > 90) return { min: i + 1, x }; }
      return { min: 900, x };
    };
    expect(clears({ body: { liver_function: 0.5 } }).min).toBeGreaterThan(clears({}).min * 1.5);
    const woman = build({ body: { male: 0 } });
    dose(woman.w, "body", "alcohol", 35);
    run(woman, 90 * MIN);
    const man = build();
    dose(man.w, "body", "alcohol", 35);
    run(man, 90 * MIN);
    expect(Number(woman.out.conc_alcohol)).toBeGreaterThan(Number(man.out.conc_alcohol));
    expect(mealAvailability()).toBeCloseTo(0.685, 9);
    const fed = build();
    dose(fed.w, "body", "alcohol", 35, { meal: true });
    expect(onBoardKg(fed.w, "body", "alcohol")).toBeCloseTo(0.035 * 0.685, 12);
    expect(fed.w.trace.into("unabsorbed", "mass:drug:alcohol")).toBeCloseTo(0.035 * 0.315, 12);
  });
  it("gives mg/L for the other substances and a burden, not a concentration, for mercury", () => {
    const lau = neuroSubstance("laudanum");
    expect(concentration(lau, 15e-6, 70)).toBeCloseTo(15 / (3.5 * 70), 12);
    expect(concentration(neuroSubstance("mercury"), 1e-3, 70)).toBeNull();
    // half-life 3 h, no gut: a half after three hours (liver function 1)
    const r = pkStep(lau, { gutKg: 0, centralKg: 1e-5 }, 180, 70);
    expect(r.centralKg).toBeCloseTo(0.5e-5, 12);
    expect(r.eliminatedKg).toBeCloseTo(0.5e-5, 12);
    // mercury: half-life about 60 days
    const hg = pkStep(neuroSubstance("mercury"), { gutKg: 0, centralKg: 1e-3 }, 60 * 1440, 70);
    expect(hg.centralKg).toBeCloseTo(0.5e-3, 12);
  });
  it("keeps a burden and no effect for the poisons, and traces every mg", () => {
    const x = build({ params: { ec50: { alcohol: 0.05 } } });
    x.w.conserve("drug:mercury", ["body"], 1e-12);
    dose(x.w, "body", "mercury", 1, { unit: "g" });
    run(x, 2 * DAY);
    expect(Number(x.out.burden_mercury)).toBeGreaterThan(0);
    expect(Number(x.out.tone_glutamate)).toBe(1);
    expect(Number(x.out.tone_acetylcholine)).toBe(1);
    expect(x.w.trace.failed()).toEqual([]);
  });
});

describe("the baseline drivers", () => {
  it("moves adenosine +0.05 per hour awake: 20 h awake with a 20 h sleep debt", () => {
    const row = String(libraryTable("neurology", "baseline").find(r => String(r.id).includes("hours-awake"))!["Systems moved (tone)"]);
    const per = Number(/adenosine \+([\d.]+) per hour awake/.exec(row)![1]);
    expect(per).toBe(0.05);
    const b = baselineMoves({ hoursAwake: 20, sleepDebtH: 20 });
    expect(b.move.adenosine).toBeCloseTo(per * 20, 12);
    for (const s of neuroSystems()) if (s.id !== "adenosine") expect(b.move[s.id]).toBe(0);
    expect(b.active).toEqual([String(libraryRow("neurology", "baseline", "neurology.baseline.hours-awake-physiology-3").id)]);
    expect(b.unsized).toEqual([]);
    // over 24 h of debt the row names glutamate and noradrenaline, with no size: listed, not moved
    const over = baselineMoves({ sleepDebtH: 30 });
    expect(over.unsized).toEqual([{ row: "neurology.baseline.sleep-debt-over-24-h-physiology", systems: ["glutamate", "noradrenaline"] }]);
    expect(over.move.glutamate).toBe(0);
  });
  it("moves the tone of a body that has been awake, and a sleeping body is reset", () => {
    const x = build({ body: { asleep: 0, hours_awake: 10, sleep_debt: 20 } });
    run(x, MIN);
    expect(Number(x.out.tone_adenosine)).toBeCloseTo(1 + 0.05 * (10 + 1 / 60), 9);
    expect(Number(x.out.arousal)).toBeCloseTo(1 - 0.3 * (Number(x.out.tone_adenosine) - 1), 9);   // adenosine -0.3 in the arousal read
    expect(Number(x.out.sleep)).toBeCloseTo(1 + 0.5 * (Number(x.out.tone_adenosine) - 1), 9);      // adenosine +0.5 in the sleep read
    x.body.props.asleep = 1;
    run(x, MIN);
    expect(Number(x.out.hours_awake)).toBe(0);
    expect(Number(x.out.tone_adenosine)).toBe(1);
  });
  it("reads each row's thresholds and sizes from the table", () => {
    expect(baselineMoves({ met: 6 }).active).toEqual([]);
    expect(baselineMoves({ met: 7 }).move).toMatchObject({ noradrenaline: 0.3, dopamine: 0.1, opioid: 0 });
    expect(baselineMoves({ met: 3, hoursSinceHardExercise: 1.5 }).move.opioid).toBe(0.2);
    expect(baselineMoves({ met: 3, hoursSinceHardExercise: 2.5 }).move.opioid).toBe(0);
    expect(baselineMoves({ pain: 5 }).active).toEqual([]);
    expect(baselineMoves({ pain: 6 }).move).toMatchObject({ noradrenaline: 0.3, opioid: 0.2 });
    expect(baselineMoves({ fearEvent: true }).move.noradrenaline).toBeCloseTo(0.6, 12);   // 0.5 for the event and 0.1 for the day
    expect(baselineMoves({ fearToday: true }).move.noradrenaline).toBeCloseTo(0.1, 12);
    expect(baselineMoves({ hunger: 0.7 }).move).toMatchObject({ histamine_orexin: 0.2, dopamine: 0.1 });
    expect(baselineMoves({ hunger: 0.6 }).active).toEqual([]);
    expect(baselineMoves({ starvationStage: 2 }).move).toMatchObject({ serotonin: -0.2, dopamine: -0.1 });
    expect(baselineMoves({ starvationStage: 1 }).active).toEqual([]);
    expect(baselineMoves({ praiseToday: true }).move).toMatchObject({ dopamine: 0.2, opioid: 0.1 });
    expect(baselineMoves({ isolation: true }).move).toMatchObject({ serotonin: -0.1, noradrenaline: 0.1 });
    expect(baselineMoves({ heatStrain: true }).move.noradrenaline).toBe(0.2);
    const old = baselineMoves({ ageY: 60 }).scale;
    expect(old.dopamine).toBeCloseTo(0.9, 12);
    expect(old.acetylcholine).toBeCloseTo(0.94, 12);
    expect(baselineMoves({ ageY: 40 }).scale.dopamine).toBe(1);
    const fever = baselineMoves({ fever: true, coreC: 39.6 });
    expect(fever.delirium).toBe(true);
    expect(fever.feverAttention).toBe(-0.3);
    expect(baselineMoves({ fever: true, coreC: 39.4 }).delirium).toBe(false);
  });
  it("reads the body state the process is given: pain over 5 raises noradrenaline and the opioid system, and the circuits follow", () => {
    const x = build({ body: { pain: 7 } });
    run(x, MIN);
    expect(Number(x.out.tone_noradrenaline)).toBeCloseTo(1.3, 12);
    expect(Number(x.out.tone_opioid)).toBeCloseTo(1.2, 12);
    // arousal: noradrenaline +0.4, opioid -0.2; pain gating: opioid +0.6, noradrenaline +0.2
    expect(Number(x.out.arousal)).toBeCloseTo(1 + 0.4 * 0.3 - 0.2 * 0.2, 12);
    expect(Number(x.out["pain-gating"])).toBeCloseTo(0.6 * 0.2 + 0.2 * 0.3, 12);
  });
});

describe("the circuits at rest and under the interaction rules", () => {
  it("reads 1 for the tone-scale outputs, 0 for the offset ones, with the row id beside each", () => {
    const x = build();
    run(x, MIN);
    for (const id of ["arousal", "motor-control", "reward-and-habit", "attention", "memory-and-learning", "breathing-drive", "fear-and-stress", "appetite", "sleep"]) expect(Number(x.out[id])).toBeCloseTo(1, 12);
    expect(Number(x.out["pain-gating"])).toBeCloseTo(0, 12);
    expect(Number(x.out["mood-regulation"])).toBeCloseTo(0, 12);
    for (const c of neuroCircuits()) expect(x.out[`${c.id}_row`]).toBe(`neurology.circuits.${c.id}`);
  });
  it("gives a substance no acute effect without an EC50 (flagged), though it has a concentration", () => {
    const x = build({ params: { ec50: { alcohol: null } } });   // the library's alcohol EC50 switched off
    dose(x.w, "body", "alcohol", 35);
    run(x, 90 * MIN);
    expect(Number(x.out.conc_alcohol)).toBeGreaterThan(0.03);
    expect(x.out.occupancy_alcohol).toBeNull();
    expect(Number(x.out.tone_gaba)).toBe(1);
    expect(Number(x.out.arousal)).toBeCloseTo(1, 12);
  });
  it("adds tones: a drink moves gaba by potency x occupancy, and arousal falls once by the weighted sum", () => {
    const ec50 = 0.03;
    const x = build({ params: { ec50: { alcohol: ec50 } } });
    dose(x.w, "body", "alcohol", 35);
    run(x, 90 * MIN);
    const c = Number(x.out.conc_alcohol), oc = occupancy(c, ec50);
    expect(Number(x.out.occupancy_alcohol)).toBeCloseTo(oc, 12);
    expect(Number(x.out.tone_gaba)).toBeCloseTo(1 + 0.3 * oc, 12);
    expect(Number(x.out.tone_glutamate)).toBeCloseTo(1 - 0.3 * oc, 12);
    expect(Number(x.out.tone_dopamine)).toBeCloseTo(1 + 0.15 * oc, 12);
    expect(Number(x.out.arousal)).toBeCloseTo(1 - 0.3 * 0.3 * oc - 0.2 * 0.1 * oc, 12);
    expect(Number(x.out.arousal)).toBeLessThan(1);
  });
  it("lets coffee raise arousal on rum while the gaba tone stays where the rum put it", () => {
    const params = { ec50: { alcohol: 0.03, caffeine: 0.5 } };
    const rum = build({ params }), both = build({ params });
    dose(rum.w, "body", "alcohol", 35);
    dose(both.w, "body", "alcohol", 35);
    dose(both.w, "body", "caffeine", 80);
    run(rum, 80 * MIN); run(both, 80 * MIN);
    expect(Number(both.out.tone_gaba)).toBeCloseTo(Number(rum.out.tone_gaba), 12);
    expect(Number(both.out.tone_adenosine)).toBeLessThan(1);
    expect(Number(both.out.arousal)).toBeGreaterThan(Number(rum.out.arousal));
  });
  it("is worse for breathing with rum and laudanum than with either: the product form and the two-depressant factor", () => {
    const params = { ec50: { alcohol: 0.03, laudanum: 0.02 } };
    const drive = (...doses: [string, number][]) => {
      const x = build({ params });
      for (const [k, a] of doses) dose(x.w, "body", k, a);
      run(x, 90 * MIN);
      return x;
    };
    const rum = drive(["alcohol", 35]), lau = drive(["laudanum", 15]), both = drive(["alcohol", 35], ["laudanum", 15]);
    expect(Number(rum.out["breathing-drive"])).toBeLessThan(1);
    expect(Number(lau.out["breathing-drive"])).toBeLessThan(1);
    expect(Number(both.out["breathing-drive"])).toBeLessThan(Math.min(Number(rum.out["breathing-drive"]), Number(lau.out["breathing-drive"])));
    // the formula of the interactions row, by hand
    const r = synergyRule();
    expect([r.opioid, r.gaba, r.alcohol, r.both, r.occupancyOver]).toEqual([0.6, 0.3, 0.2, 0.8, 0.3]);
    expect(breathingDrive(0.5, 0.5, 0.3, 2)).toBeCloseTo((1 - 0.3) * (1 - 0.15) * (1 - 0.06) * 0.8, 12);
    expect(breathingDrive(0.5, 0.5, 0.3, 1)).toBeCloseTo((1 - 0.3) * (1 - 0.15) * (1 - 0.06), 12);
    expect(breathingDrive(5, 5, 5, 2)).toBe(0);
  });
  it("blocks memory encoding over 0.08 g/dL of alcohol (the blackout) and not under it", () => {
    const x = build({ params: { ec50: { alcohol: null } } });   // isolates the block from the acute effect on the other systems
    dose(x.w, "body", "alcohol", 35);
    run(x, 20 * MIN);
    expect(Number(x.out.conc_alcohol)).toBeLessThan(0.08);
    expect(Number(x.out["memory-and-learning"])).toBeCloseTo(1, 12);
    const y = build();
    dose(y.w, "body", "alcohol", 70);
    run(y, 90 * MIN);
    expect(Number(y.out.conc_alcohol)).toBeGreaterThan(0.08);
    expect(Number(y.out["memory-and-learning"])).toBe(0);
  });
});

describe("the four clocks", () => {
  const params: NeuroParams = { ec50: { alcohol: 0.05 }, kTol: { alcohol: 0.5 }, reboundPeakH: { alcohol: 24 } };   // formula-test values: the library gives neither (null cells)
  /** n days of one 35 g drink at the start of each, with the mean gaba occupancy of each day sampled from the outputs. */
  function drinkDays(n: number, p: NeuroParams) {
    const x = build({ params: p }), means: number[] = [], peakEffect: number[] = [];
    for (let d = 0; d < n; d++) {
      dose(x.w, "body", "alcohol", 35);
      let sum = 0, peak = 0;
      for (let i = 0; i < 1440; i++) { run(x, MIN); sum += Number(x.out.occupancy_alcohol); peak = Math.max(peak, Number(x.out.tone_gaba) - Number(x.out.withdrawal_gaba) - 1); }
      means.push(sum / 1440); peakEffect.push(peak);
    }
    return { x, means, peakEffect };
  }
  it("builds tolerance by sensitivity -= k_tol x mean occupancy over the day, to the floor", () => {
    const { x, means, peakEffect } = drinkDays(14, params);
    run(x, MIN);                                                      // the step that closes the fourteenth day
    expect(x.body.props.neu_day_index).toBe(14);
    let want = 1;
    for (const m of means) want = Math.max(0.3, want - 0.5 * m);
    expect(want).toBeGreaterThan(0.3);
    expect(Number(x.out.sensitivity_gaba)).toBeCloseTo(want, 9);
    expect(want).toBeLessThan(0.6);
    expect(Number(x.out.sensitivity_glutamate)).toBeCloseTo(want, 9);   // the same occupancy: every system the drink hits adapts
    expect(Number(x.out.sensitivity_adenosine)).toBe(1);                // tolerance is per system: the later adenosine hit is off, so no change
    // the same dose does less: the day-15 peak effect (the tone less the withdrawal swing) is the day-1 peak times the sensitivity
    dose(x.w, "body", "alcohol", 35);
    let peak = 0;
    for (let i = 0; i < 1440; i++) { run(x, MIN); peak = Math.max(peak, Number(x.out.tone_gaba) - Number(x.out.withdrawal_gaba) - 1); }
    expect(peak / peakEffect[0]!).toBeCloseTo(want, 3);
    expect(toleranceStep(0.35, 0.2, 1)).toBe(0.3);                        // the floor
  });
  it("makes dependence (1 - sensitivity) x exposure days / 14 and a withdrawal that swings opposite to the drink", () => {
    const { x } = drinkDays(13, params);
    dose(x.w, "body", "alcohol", 35);                                 // the last drink, on the fourteenth day
    run(x, 12 * HOUR);
    const sens = Number(x.out.sensitivity_gaba), days = Number(x.body.props.neu_expd_gaba);
    expect(days).toBe(13);
    expect(Number(x.out.dependence_gaba)).toBeCloseTo(dependence(sens, days), 12);
    expect(Number(x.out.dependence_gaba)).toBeCloseTo((1 - sens) * 13 / 14, 12);
    expect(dependence(0.5, 7)).toBeCloseTo(0.25, 12);
    // 12 h on, the alcohol is gone and the rebound is half way to its 24 h peak
    const hours = (x.w.t - MIN - Number(x.body.props.neu_dose_t_alcohol)) / HOUR;
    expect(Number(x.out.conc_alcohol)).toBe(0);
    const dep = Number(x.out.dependence_gaba), r = rebound(hours, 24, 5);
    expect(r).toBeGreaterThan(0.49);
    expect(r).toBeLessThan(0.5);
    expect(Number(x.out.withdrawal_gaba)).toBeCloseTo(-0.3 * dep * r, 9);          // gaba under
    expect(Number(x.out.withdrawal_glutamate)).toBeCloseTo(0.3 * dep * r, 9);      // glutamate over
    expect(Number(x.out.tone_gaba)).toBeCloseTo(1 - 0.3 * dep * r, 9);
    expect(Number(x.out.tone_glutamate)).toBeCloseTo(1 + 0.3 * dep * r, 9);
    expect(x.out.alcohol_withdrawal_stage).toBe("onset");
    // a drink during the withdrawal fills the occupancy and the rebound falls at once
    const before = Number(x.out.withdrawal_gaba);
    dose(x.w, "body", "alcohol", 35);
    run(x, 90 * MIN);
    expect(Math.abs(Number(x.out.withdrawal_gaba))).toBeLessThan(Math.abs(before) * 0.2);
    run(x, 30 * HOUR);
    expect(x.out.alcohol_withdrawal_stage).toBe("seizure");                         // 24 h and past, dependence under 0.7
    expect(Number(x.out.withdrawal_gaba)).toBeLessThan(0);
  });
  it("shows no withdrawal in a man who has not adapted, and none without the clocks' numbers", () => {
    const fresh = build({ params });
    dose(fresh.w, "body", "alcohol", 35);
    run(fresh, 20 * HOUR);                                            // before the first day closes
    expect(Number(fresh.out.dependence_gaba)).toBe(0);
    expect(Number(fresh.out.withdrawal_gaba)).toBe(0);
    expect(fresh.out.alcohol_withdrawal_stage).toBe("none");
    const noRate = drinkDays(5, { ec50: { alcohol: 0.05 }, kTol: { alcohol: null }, reboundPeakH: { alcohol: 24 } }).x;   // k_tol null
    run(noRate, MIN);
    expect(Number(noRate.out.sensitivity_gaba)).toBe(1);
    expect(Number(noRate.out.dependence_gaba)).toBe(0);
    const noPeak = drinkDays(14, { ec50: { alcohol: 0.05 }, kTol: { alcohol: 1 } }).x;                      // no rebound peak for alcohol
    run(noPeak, 13 * HOUR);
    expect(Number(noPeak.out.dependence_gaba)).toBeGreaterThan(0);
    expect(Number(noPeak.out.withdrawal_gaba)).toBe(0);
  });
  it("reaches delirium at 48 h only over 0.7 dependence, which takes more than the 14 days at the floor", () => {
    const { x } = drinkDays(22, { ec50: { alcohol: 0.05 }, kTol: { alcohol: 3 }, reboundPeakH: { alcohol: 24 } });
    run(x, MIN);
    expect(Number(x.out.sensitivity_gaba)).toBeCloseTo(0.3, 9);
    expect(Number(x.out.dependence_gaba)).toBe(1);                                 // 0.7 x 22 / 14 held to 1
    run(x, 50 * HOUR);
    expect(x.out.alcohol_withdrawal_stage).toBe("delirium");
    expect(clockRules().deliriumDependenceOver).toBe(0.7);
    expect(clockRules().deliriumDeathRollPerDay).toBeCloseTo(0.1, 12);
  });
  it("recovers sensitivity toward 1 at the system's time constant when exposure stops", () => {
    expect(recoveryStep(0.5, 5, 5)).toBeCloseTo(1 - 0.5 * Math.exp(-1), 12);
    const { x } = drinkDays(10, params);
    run(x, MIN);
    const low = Number(x.out.sensitivity_gaba);
    run(x, 5 * DAY);
    const back = Number(x.out.sensitivity_gaba);
    expect(back).toBeGreaterThan(low);
    // five idle days at gaba's recovery time of 5 days: the gap shrinks by e^-1
    expect(1 - back).toBeCloseTo((1 - low) * Math.exp(-1), 9);
  });
  it("gives the opioids a rebound peak from the library's range, and others none", () => {
    expect(clockRules().opioidReboundPeakH).toBe(48);          // "peak 1 to 3 days" at its middle
    expect(clockRules().toleranceFloor).toBe(0.3);
    expect(clockRules().dependenceDays).toBe(14);
    expect(rebound(0, 24, 5)).toBe(0);
    expect(rebound(24, 24, 5)).toBe(1);
    expect(rebound(24 + 5 * 24, 24, 5)).toBeCloseTo(Math.exp(-1), 12);
  });
});

describe("the fence", () => {
  // node's own fs, reached without @types/node (tsconfig has no node types)
  const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(u: URL, enc: string): string } } }).process.getBuiltinModule("node:fs");
  const text = fs.readFileSync(new URL("../src/neurology.ts", import.meta.url), "utf8");
  it("names no game meter, attribute or sibling doc, and imports nothing from a game", () => {
    for (const word of ["Dexterity", "Agility", "Reflexes", "Perception", "Wits", "Pattern Recognition", "drinkFactor", "PSYCHOLOGY", "MEDICINE", "MUSCULAR", "COMBAT", "NUTRITION", "STATS", "BODY.md", "pirate"])
      expect(text, word).not.toContain(word);
    const imports = [...text.matchAll(/^import .* from "([^"]+)"/gm)].map(m => m[1]);
    expect(imports.every(i => i!.startsWith("./"))).toBe(true);
  });
  it("builds tolerance only for a substance with a k_tol: the library's cells are null, so none without parameters, and null switches it off", () => {
    for (const s of neuroSubstances()) { expect(s.ec50, s.key).toBeNull(); expect(s.kTol, s.key).toBeNull(); }
    const x = build();
    dose(x.w, "body", "alcohol", 35);
    for (let d = 0; d < 3; d++) run(x, DAY);
    expect(Number(x.out.sensitivity_gaba)).toBe(1);
    const y = build({ params: { ec50: { alcohol: 0.05 }, kTol: { alcohol: null } } });
    dose(y.w, "body", "alcohol", 35);
    for (let d = 0; d < 3; d++) run(y, DAY);
    expect(Number(y.out.sensitivity_gaba)).toBe(1);
    expect(Number(y.out.dependence_gaba)).toBe(0);
    const z = build({ params: { ec50: { alcohol: 0.05 }, kTol: { alcohol: 0.5 } } });   // a rate given for one substance builds tolerance for it
    dose(z.w, "body", "alcohol", 35);
    for (let d = 0; d < 3; d++) run(z, DAY);
    expect(Number(z.out.sensitivity_gaba)).toBeLessThan(1);
  });

});
