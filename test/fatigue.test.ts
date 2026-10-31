import { describe, expect, it } from "vitest";
import validation from "../data/library/validation.json";
import { libraryRow } from "../src/library.ts";
import { createMuscularState, muscularActivation, muscularFatigueProcess, muscularOutputs, muscularRates,
  stepMuscleFatigue, type MuscularFatigueOptions } from "../src/muscular.ts";
import { nutritionProcess } from "../src/nutrition.ts";
import { bodyOutputs, metOf, physiologyProcess, type ScheduleEntry } from "../src/physiology.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { Scheduler } from "../src/scheduler.ts";
import { World } from "../src/world.ts";

const HOUR = 3600;
const SEWING = "muscular.activations.mending-sail-seated-palm-and-needle";
const ROWING = "muscular.activations.rowing-the-boat";
const fresh = { resting: 1, active: 0, fatigued: 0 };

function build(schedule: ScheduleEntry[], options: MuscularFatigueOptions = {}) {
  const w = new World(defaultRegistry()), sch = new Scheduler();
  const room: Component = { id: "room", kind: "room", material: "air_mass", mass: 1e6, temperatureC: 22,
    contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: {} };
  const body: Component = { ...room, id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37,
    contents: [], props: { area_m2: 1.9, h: 10, fat_kg: 14 } };
  w.registry.addComponent(room); w.registry.addComponent(body);
  const state = createMuscularState({ contractile: 50, oxidative: 50, min: 10, max: 100, recruitment: 50 });
  sch.add(physiologyProcess(body.id, room.id, { schedule, met: 1, every: options.every ?? 10 }));
  sch.add(muscularFatigueProcess(body.id, state, options));
  return { w, sch, body, state, out: bodyOutputs(body) };
}

describe("one schedule drives local and systemic fatigue", () => {
  it("fatigues exactly the supported active groups during an hour and publishes every group and side", () => {
    const x = build([{ fromH: 0, toH: 1, activity: SEWING }]);
    x.sch.run(x.w, HOUR, 1);
    const activation = muscularActivation(SEWING), fatigue = muscularOutputs(x.state).fatigue;
    expect(x.out.activity).toBe(SEWING);
    expect(x.out.met).toBe(activation.met);
    expect(Math.abs(Number(x.out.fatigue_met_hours) - activation.met)).toBeLessThanOrEqual(1e-9);
    let active = 0, inactive = 0, unsupported = 0;
    for (const [group, sides] of Object.entries(fatigue)) {
      for (const [side, value] of Object.entries(sides)) {
        expect(x.out[`muscular.fatigue_3cc.${group}.${side}`]).toBe(value);
        if (muscularRates(group) === null) { expect(value).toBeNull(); unsupported++; }
        else if (activation.groups[group]! > 0) { expect(value).toBeGreaterThan(0); active++; }
        else { expect(value).toBe(0); inactive++; }
      }
    }
    expect(active).toBeGreaterThan(0); expect(inactive).toBeGreaterThan(0); expect(unsupported).toBeGreaterThan(0);
  });

  it("sums two different bouts and switches local effort at the same schedule boundary", () => {
    const x = build([{ fromH: 0, toH: 1, activity: SEWING }, { fromH: 1, toH: 2, activity: ROWING }], { every: 1 });
    x.sch.run(x.w, HOUR, 60);
    expect(x.state.groups.hamstrings.L!.compartments!.fatigued).toBe(0);
    const afterSewing = { ...x.state.groups.hand.L!.compartments! };
    x.sch.run(x.w, HOUR, 60);
    expect(x.out.activity).toBe(ROWING);
    expect(Math.abs(Number(x.out.fatigue_met_hours) - metOf(SEWING) - metOf(ROWING))).toBeLessThanOrEqual(1e-9);
    expect(x.state.groups.hamstrings.L!.compartments!.fatigued).toBeGreaterThan(0);
    expect(x.state.groups.hand.L!.compartments).toEqual(
      stepMuscleFatigue(afterSewing, "hand", muscularActivation(ROWING).groups.hand!, HOUR, 1));
  });

  it.each([1, 0.5, 0])("recovers every fatigued group in an hour of bare-MET rest at R x %s", recoveryMultiplier => {
    const x = build([{ fromH: 0, toH: 1, activity: SEWING }, { fromH: 1, toH: 2, activity: 1 }],
      { every: 1, recoveryMultiplier });
    x.sch.run(x.w, HOUR, 60);
    const before = muscularOutputs(x.state).fatigue;
    x.sch.run(x.w, HOUR, 60);
    expect(x.out.activity).toBeNull();
    for (const [group, sides] of Object.entries(muscularOutputs(x.state).fatigue)) {
      for (const [side, value] of Object.entries(sides)) {
        const prior = before[group][side];
        if (prior === null) { expect(value).toBeNull(); continue; }
        const expected = prior * Math.exp(-muscularRates(group)!.R * recoveryMultiplier * HOUR);
        expect(Math.abs(value! - expected)).toBeLessThanOrEqual(1e-9);
        if (prior > 0 && recoveryMultiplier > 0) expect(value).toBeLessThan(prior);
      }
    }
    expect(Math.abs(Number(x.out.fatigue_met_hours) - metOf(SEWING) - 1)).toBeLessThanOrEqual(1e-9);
  });

  it("canonicalises physiology rows and clears the prior activity when the default MET applies", () => {
    const x = build([{ fromH: 0, toH: 1, activity: SEWING }, { fromH: 1, toH: 2, activity: "sleeping" }], { every: 1 });
    x.sch.run(x.w, HOUR, 60);
    const prior = x.state.groups.hand.L!.compartments!.fatigued;
    x.sch.run(x.w, HOUR, 60);
    expect(x.out.activity).toBe("physiology.met.sleeping");
    expect(x.state.groups.hand.L!.compartments!.fatigued).toBeLessThan(prior);
    x.sch.stepOnce(x.w, 60);
    expect(x.out.activity).toBeNull(); expect(x.out.met).toBe(1);
    expect(() => metOf("muscular.activations.missing")).toThrow();
  });

  it("runs physiology, muscular fatigue and nutrition together through glycogen use above the MET threshold", () => {
    const x = build([{ fromH: 0, toH: 1, activity: ROWING }], { every: 1 });
    // Energy-neutral intake fixture isolates the existing work-driven glycogen rule from extra deficit draw.
    x.sch.add({ name: "energy-neutral-intake-fixture", every: 1, step() {
      x.body.props.intake_kcal = x.body.props.expenditure_kcal;
    } });
    x.sch.add(nutritionProcess(x.body.id, { every: 1, dayStartH: 1 }));
    const rule = String(libraryRow("nutrition", "body_composition", "nutrition.body_composition.glycogen").Rule);
    const cap = Number(/up to ([\d.]+) g/.exec(rule)![1]);
    const rate = Number(/about ([\d.]+) g per MET-hour/.exec(rule)![1]);
    const threshold = Number(/over ([\d.]+) MET/.exec(rule)![1]);
    const metHours = Math.max(0, metOf(ROWING) - threshold);
    x.sch.run(x.w, HOUR - 60, 60);
    expect(Math.abs(x.body.props.nut_met_over_h - metHours * (HOUR - 60) / HOUR)).toBeLessThanOrEqual(1e-9);
    x.sch.stepOnce(x.w, 60);
    expect(Math.abs(Number(x.out.glycogen_g) - Math.max(0, cap - rate * metHours))).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(Number(x.out.fatigue_met_hours) - metOf(ROWING))).toBeLessThanOrEqual(1e-9);
    expect(x.out["muscular.fatigue_3cc.hand.L"]).toBeGreaterThan(0);
    expect(x.w.trace.failed()).toEqual([]);
  });
});

describe("independent reference checks", () => {
  it.each([SEWING, ROWING])("validation (2634): %s MET agrees with the 2011 Compendium range or within 1 MET", activity => {
    // Opened by 2645: https://cdn-links.lww.com/permalink/mss/a/mss_43_8_2011_06_13_ainsworth_202093_sdc1.pdf
    const row = validation.met_compendium.rows.find(r => r[1] === activity)!;
    expect(row).toBeDefined();
    expect(row[3]).not.toBeNull(); expect(row[4]).not.toBeNull();
    const met = metOf(activity), low = Number(row[3]), high = Number(row[4]);
    expect(Math.max(low - met, met - high, 0)).toBeLessThanOrEqual(1);
  });

  it.each([["biceps", "vernillo-ef-end"], ["quads", "vernillo-ke-end"]])(
    "validation (2634): %s remaining force at 120 s lies within Vernillo 2018's measured spread", (group, slug) => {
      // Opened by 2645: https://paulogentil.com/pdf/Mechanisms%20of%20fatigue%20and%20recovery%20in%20upper%20versus%20lower%20limbs%20in%20men.pdf
      // Published after the 2012 fit. Compare fresh-normalised force potential (1 - MF), not active fibres alone.
      const row = validation.muscle_fatigue_data.rows.find(r => r[0] === `validation.muscle_fatigue_data.${slug}`)!;
      expect(row[3]).not.toBeNull(); expect(row[4]).not.toBeNull();
      const remaining = 100 * (1 - stepMuscleFatigue(fresh, group, 1, 120, 1)!.fatigued);
      expect(remaining).toBeGreaterThanOrEqual(Number(row[3]));
      expect(remaining).toBeLessThanOrEqual(Number(row[4]));
    });
});
