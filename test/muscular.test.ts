import { describe, expect, it } from "vitest";
import { libraryRow, libraryTable } from "../src/library.ts";
import { Trace } from "../src/trace.ts";
import { adaptMuscleDay, createMuscularState, muscularActivation, muscularBanisterDay,
  muscularEnduranceReference, muscularOutputs, muscularRates, muscularStimuli, stepMuscleFatigue } from "../src/muscular.ts";

const initial = () => createMuscularState({ contractile: 50, oxidative: 50, min: 10, max: 100, recruitment: 50 });
const fresh = { resting: 1, active: 0, fatigued: 0 };
const day = { tension: 10, aerobic: 0, used: true, hoursSinceHardSession: 48,
  proteinGate: 1, energyGate: 1, sleepGate: 1, ageGate: 1 };

describe("muscular library and states", () => {
  it("preserves 31 group ids, sides, and all action values at their MET", () => {
    const state = initial();
    expect(Object.keys(state.groups)).toHaveLength(31);
    expect(Object.keys(state.groups.biceps)).toEqual(["L", "R"]);
    expect(Object.keys(state.groups.abs)).toEqual(["one"]);
    for (const row of libraryTable("muscular", "activations")) {
      const action = muscularActivation(String(row.id));
      expect(action.met).toBe(row["Intensity (MET)"]);
      for (const id of Object.keys(state.groups)) expect(action.groups[id]).toBe(typeof row[id] === "number" ? Number(row[id]) / 100 : null);
      expect(action.groups.diaphragm).toBeNull();
    }
    expect(muscularOutputs(state).fatigue.biceps).toEqual({ L: 0, R: 0 });
    expect(muscularOutputs(state).fatigue.neck).toEqual({ L: null, R: null });
  });
  it("patterns describe movements, never action names, and retain independent sides", () => {
    const actions = libraryTable("muscular", "activations").map(r => String(r.id).split(".").at(-1));
    for (const p of libraryTable("muscular", "patterns")) expect(actions).not.toContain(String(p.id).split(".").at(-1));
    const state = initial(), id = "muscular.patterns.fine-manipulation";
    state.patterns[id].L!.recruitment = 60;
    expect(muscularOutputs(state).patternSkill[id]).toEqual({ L: 60, R: 50 });
    expect(Object.keys(state.tendons)).toHaveLength(7);
    expect(muscularOutputs(state).neuralAdaptation).toBeNull();
    expect(Object.values(muscularOutputs(state).limbStrength).every(x => x === null)).toBe(true);
  });
});

describe("seconds-based three-compartment fatigue", () => {
  it("conserves compartments through long rest (2832) and rejects corrupted state", () => {
    const group = "delt_mid";
    const effort = muscularActivation("muscular.activations.smithing-the-hammer-at-the-anvil").groups[group]!;
    expect(effort).toBeGreaterThan(0);
    let s = { ...fresh };
    for (let t = 0; t < 4 * 3600; t += 60) s = stepMuscleFatigue(s, group, effort, 60, 1)!;
    expect(s.fatigued).toBeGreaterThan(0);
    for (let t = 0; t < 12 * 3600; t += 60) {
      s = stepMuscleFatigue(s, group, 0, 60, 1)!;
      for (const value of Object.values(s)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(s.resting + s.active + s.fatigued - 1)).toBeLessThanOrEqual(1e-12);
    }
    expect(Math.abs(s.resting - 1)).toBeLessThanOrEqual(1e-12);
    expect(s.active).toBeLessThanOrEqual(1e-12);
    expect(s.fatigued).toBeLessThanOrEqual(1e-12);
    expect(() => stepMuscleFatigue({ ...fresh, resting: 1.001 }, group, 0, 60, 1)).toThrow();
  });
  it("traces transfers and conserves fibres every second; split steps agree", () => {
    const trace = new Trace();
    const result = stepMuscleFatigue(fresh, "hand", 0.5, 120, 1, trace)!;
    const half = stepMuscleFatigue(fresh, "hand", 0.5, 60, 1)!;
    expect(stepMuscleFatigue(half, "hand", 0.5, 60, 1)).toEqual(result);
    expect(trace.failed()).toEqual([]);
    expect(trace.checks).toHaveLength(120);
    expect(trace.transfers.length).toBeGreaterThan(120);
    for (const [key, v] of Object.entries(result)) {
      const node = `hand:${key}`;
      expect((key === "resting" ? 1 : 0) + trace.into(node, "muscle-fraction:hand") - trace.outOf(node, "muscle-fraction:hand")).toBeCloseTo(v, 12);
    }
  });
  it("exposes the 50% endurance observation and the incompatible 3CC prediction without retuning F", () => {
    const reference = muscularEnduranceReference(0.5)!;
    expect(reference.seconds).toBe(120);
    expect(reference.exhaustionSeconds).toBeNull();
    const held = stepMuscleFatigue(fresh, "hand", 0.5, reference.seconds, 1)!;
    // With the sourced 2012 hand/grip rates (2560) two minutes at 50% leaves under half the fibres unfatigued.
    expect(held.resting + held.active).toBeLessThan(0.5);
    const rates = muscularRates("hand")!;
    expect(rates.F / (rates.F + rates.R)).toBeGreaterThan(0.5);
    expect(muscularEnduranceReference(0.15)?.lowerBound).toBe(true);
    expect(muscularEnduranceReference(0.3)).toBeNull();
  });
  it("recovers exactly by R and handles a whole night without Euler instability", () => {
    const s = { resting: 0.2, active: 0.3, fatigued: 0.5 }, R = muscularRates("hand")!.R;
    expect(stepMuscleFatigue(s, "hand", 0, 120, 0.5)!.fatigued).toBeCloseTo(0.5 * Math.exp(-R * 0.5 * 120), 14);
    const night = stepMuscleFatigue(s, "hand", 0, 8 * 3600, 1)!;
    expect(night.fatigued).toBeCloseTo(0.5 * Math.exp(-R * 8 * 3600), 14);
    expect(night.active).toBe(0);
    expect(stepMuscleFatigue(s, "hand", 0, 0, 1)).toEqual(s);
    expect(stepMuscleFatigue(fresh, "neck", 0.5, 1, 1)).toBeNull();
    expect(() => stepMuscleFatigue(fresh, "hand", 2, 1, 1)).toThrow();
  });
});

describe("separate training signals and daily adaptation", () => {
  it("uses tension, aerobic and practice rules independently", () => {
    expect(muscularStimuli(0.5, 0.8, 2, 30, 0.5, 0.5)).toEqual({ tension: 100, aerobic: 0, practice: 15 });
    const moderate = muscularStimuli(0.5, 0.3, 2, 30, 0.5, 0.5);
    expect(moderate).toEqual({ tension: 0, aerobic: 15, practice: 15 });
    expect(muscularStimuli(1, 0.5, 1, 10, 0.5, 0).aerobic).toBe(0);
  });
  it("raises contractile over fourteen daily tension stimuli by the library conversion rate", () => {
    let s = initial().groups.hand.L!;
    for (let i = 0; i < 14; i++) s = adaptMuscleDay(s, day);
    const rate = Number(libraryRow("muscular", "training", "muscular.training.conversion-rate-trained-development-40-to-70").Value);
    expect(s.contractile).toBeCloseTo(100 - 50 * (1 - rate / 100) ** 14, 12);
    expect(s.contractile).toBeGreaterThan(50);
    expect(s.oxidative).toBe(50); // k_o absent, no fabricated timescale
  });
  it("preserves the first detrained week, then loses 0.3/day after fourteen idle days, stopping at genetic min", () => {
    let s = initial().groups.hand.L!;
    const rest = { ...day, tension: 0, used: false };
    for (let i = 0; i < 7; i++) s = adaptMuscleDay(s, rest);
    expect(s.contractile).toBe(50);
    for (let i = 0; i < 14; i++) s = adaptMuscleDay(s, rest);
    expect(s.contractile).toBeCloseTo(50 - 7 * 0.3, 12);
    for (let i = 0; i < 200; i++) s = adaptMuscleDay(s, rest);
    expect(s.contractile).toBe(s.min);
  });
  it("carries gated signal and stalls conversion above the library fatigue threshold", () => {
    let s = initial().groups.hand.L!;
    s = adaptMuscleDay(s, { ...day, proteinGate: 0 });
    expect(s.tension).toBe(10); expect(s.contractile).toBe(50);
    s.compartments = { resting: 0.3, active: 0, fatigued: 0.7 };
    s = adaptMuscleDay(s, day);
    expect(s.tension).toBe(20); expect(s.contractile).toBe(50);
  });
  // Source: https://arxiv.org/html/2505.20859 (Busso 1991 means: k1 0.048, k2 0.117, tau1 38, tau2 1.9). The source prints
  // no daily loads with predicted performance (the impulse profile is only a plot), so this is not a reproduced example:
  // it checks the closed form for a single impulse.
  it("worked example: a single impulse decays as load x exp(-t/tau) with the library constants", () => {
    const impulse = muscularBanisterDay({ fitness: 0, fatigue: 0 }, 10, 104.8);
    let s = impulse;
    for (let t = 1; t <= 5; t++) s = muscularBanisterDay(s, 0, 104.8);
    expect(s.fitness).toBeCloseTo(10 * Math.exp(-5 / 38), 12);
    expect(s.fatigue).toBeCloseTo(10 * Math.exp(-5 / 1.9), 12);
    expect(s.performance).toBeCloseTo(104.8 + 0.048 * s.fitness - 0.117 * s.fatigue, 12);
  });
});
