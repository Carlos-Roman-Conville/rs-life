import { describe, expect, it, vi } from "vitest";
import * as library from "../src/library.ts";
import { libraryRow, libraryTable } from "../src/library.ts";
import { Trace } from "../src/trace.ts";
import { adaptMuscleDay, createMuscularState, muscularActivation, muscularBanisterDay,
  muscularEnduranceReference, muscularOutputs, muscularRates, muscularStimuli, stepMuscleFatigue,
  type Compartments } from "../src/muscular.ts";

const initial = () => createMuscularState({ contractile: 50, oxidative: 50, min: 10, max: 100, recruitment: 50 });
const fresh = { resting: 1, active: 0, fatigued: 0 };
// Pre-2833 integrator, retained only here; dt=1 reproduces its explicit Euler
// transfers and 2832 roundoff repair. Smaller dt measures its truncation error.
function euler(state: Compartments, e: number, F: number, R: number, seconds: number, step = 1) {
  const s = { ...state }, flows = { recruit: 0, fatigue: 0, recover: 0 };
  for (let elapsed = 0; elapsed < seconds;) {
    const dt = Math.min(step, seconds - elapsed);
    const recruit = e * s.resting * dt, fatigue = F * s.active * dt, recover = R * s.fatigued * dt;
    s.resting -= recruit; s.active += recruit;
    s.active -= fatigue; s.fatigued += fatigue;
    s.fatigued -= recover; s.resting += recover;
    flows.recruit += recruit; flows.fatigue += fatigue; flows.recover += recover;
    s.resting = Math.max(0, Math.min(1, s.resting));
    s.active = Math.max(0, Math.min(1, s.active));
    s.fatigued = Math.max(0, Math.min(1, s.fatigued));
    const total = s.resting + s.active + s.fatigued;
    s.resting /= total; s.active /= total; s.fatigued /= total;
    elapsed += dt;
  }
  return { state: s, flows };
}
const distance = (a: Compartments, b: Compartments) =>
  Math.max(...(['resting', 'active', 'fatigued'] as const).map(k => Math.abs(a[k] - b[k])));

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
  it("traces integrated transfers and conserves fibres once per call; split steps agree", () => {
    const trace = new Trace();
    const result = stepMuscleFatigue(fresh, "hand", 0.5, 120, 1, trace)!;
    const half = stepMuscleFatigue(fresh, "hand", 0.5, 60, 1)!;
    expect(distance(stepMuscleFatigue(half, "hand", 0.5, 60, 1)!, result)).toBeLessThanOrEqual(1e-12);
    expect(trace.failed()).toEqual([]);
    expect(trace.checks).toHaveLength(1);
    expect(trace.checks[0].t).toBe(120);
    expect(trace.transfers).toHaveLength(3);
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

describe("exact 3CC (2833)", () => {
  it('keeps the group 7 schedule endpoint within Euler refinement error', () => {
    const sewing = muscularActivation('muscular.activations.mending-sail-seated-palm-and-needle').groups.hand!;
    const rowing = muscularActivation('muscular.activations.rowing-the-boat').groups.hand!;
    const { F, R } = muscularRates('hand')!;
    const run = (dt: number) => euler(euler(fresh, sewing, F, R, 3600, dt).state, rowing, F, R, 3600, dt).state;
    const coarse = run(1), fine = run(0.1);
    const exact = stepMuscleFatigue(stepMuscleFatigue(fresh, 'hand', sewing, 3600, 1)!, 'hand', rowing, 3600, 1)!;
    // Both bouts reach equilibrium: the discretisation error is below roundoff.
    expect(distance(coarse, exact)).toBeLessThanOrEqual(1.1 * distance(coarse, fine) / 0.9 + 1e-12);
  });
  it.each([['hand', 0.5, 1], ['biceps', 1, 1], ['quads', 1, 1], ['delt_mid', 0.2, 0.5]] as const)(
    "%s agrees within Euler error and converges linearly at 1, 0.1, 0.01 s", (group, effort, multiplier) => {
      const { F, R: rowR } = muscularRates(group)!, R = rowR * multiplier, seconds = 120;
      const exact = stepMuscleFatigue(fresh, group, effort, seconds, multiplier)!;
      const errors = [1, 0.1, 0.01].map(dt => distance(euler(fresh, effort, F, R, seconds, dt).state, exact));
      for (let i = 1; i < errors.length; i++) {
        expect(errors[i - 1] / errors[i]).toBeGreaterThan(9);
        expect(errors[i - 1] / errors[i]).toBeLessThan(11);
      }
      // Q is a Markov generator: exp(tQ) and I+hQ contract in the 1-norm.
      // Telescoping local Taylor remainders gives ||error||_1 <= T*h*||Q²p0||_1/2.
      const q2Norm = effort * effort + effort * (effort + F) + effort * F;
      expect(errors[0]).toBeLessThanOrEqual(seconds * q2Norm / 2);
      // A much tighter, observed first-order estimate from the two Euler grids.
      const coarse = euler(fresh, effort, F, R, seconds).state;
      const fine = euler(fresh, effort, F, R, seconds, 0.1).state;
      expect(errors[0]).toBeLessThanOrEqual(1.1 * distance(coarse, fine) / 0.9);
    });

  it.each([
    { name: 'real distinct', e: 0.5, F: 0.25, R: 0, sign: 1 },
    { name: 'repeated', e: 1, F: 0.25, R: 0.25, sign: 0 },
    { name: 'complex', e: 0.25, F: 0.25, R: 0.25, sign: -1 },
  ])("handles $name eigenvalues with test-only rates", ({ name, e, F, R, sign }) => {
    const row = library.libraryRow;
    const spy = vi.spyOn(library, 'libraryRow').mockImplementation((file, table, id) => {
      const result = row(file, table, id);
      return file === 'muscular' && table === 'fatigue_rates' ? { ...result, 'F (per s)': F, 'R (per s)': R } : result;
    });
    try {
      expect(Math.sign((e + F + R) ** 2 / 4 - (e * F + e * R + F * R))).toBe(sign);
      const T = 3, next = stepMuscleFatigue(fresh, 'hand', e, T, 1)!;
      let expected: Compartments;
      if (name === 'real distinct') {
        const resting = Math.exp(-e * T), active = e * (Math.exp(-e * T) - Math.exp(-F * T)) / (F - e);
        expected = { resting, active, fatigued: 1 - resting - active };
      } else if (name === 'repeated') {
        const active = 4 / 9 + (-4 / 9 + 2 * T / 3) * Math.exp(-3 * T / 4);
        const fatigued = 4 / 9 + (-4 / 9 - T / 3) * Math.exp(-3 * T / 4);
        expected = { resting: 1 - active - fatigued, active, fatigued };
      } else {
        const p = (k: number) => (1 + 2 * Math.exp(-3 * e * T / 2) * Math.cos(Math.sqrt(3) * e * T / 2 - 2 * Math.PI * k / 3)) / 3;
        expected = { resting: p(0), active: p(1), fatigued: p(2) };
      }
      expect(distance(next, expected)).toBeLessThanOrEqual(1e-12);
      expect(distance(next, euler(fresh, e, F, R, T, 0.0001).state)).toBeLessThan(2e-5);
      let split = { ...fresh };
      for (let i = 0; i < 30; i++) split = stepMuscleFatigue(split, 'hand', e, T / 30, 1)!;
      expect(distance(next, split)).toBeLessThanOrEqual(1e-12);
    } finally { spy.mockRestore(); }
  });

  it.each([0, 0.5, 1])("is step independent through transients and 12 hours at recovery multiplier %s", multiplier => {
    for (const group of ['hand', 'biceps', 'delt_mid', 'quads', 'abs', 'calves']) {
      for (const effort of [1e-10, 0.01, 0.5, 1]) for (const T of [0.01, 3, 120, 43200]) {
        const start = { resting: 0.2, active: 0.3, fatigued: 0.5 };
        const whole = stepMuscleFatigue(start, group, effort, T, multiplier)!;
        for (const n of [2, 17, 100]) {
          let split = { ...start };
          for (let i = 0; i < n; i++) split = stepMuscleFatigue(split, group, effort, T / n, multiplier)!;
          expect(distance(whole, split)).toBeLessThanOrEqual(1e-12);
        }
        for (const value of Object.values(whole)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
        expect(Math.abs(whole.resting + whole.active + whole.fatigued - 1)).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it.each([1e-8, 0.1, 0.9, 1, 120, 43200])("accounts for integrated flows and one final check over %s seconds", T => {
    const start = { resting: 0.2, active: 0.3, fatigued: 0.5 }, trace = new Trace(), splitTrace = new Trace();
    const result = stepMuscleFatigue(start, 'hand', 0.5, T, 1, trace, 7)!;
    let split = { ...start };
    for (let i = 0; i < 10; i++) split = stepMuscleFatigue(split, 'hand', 0.5, T / 10, 1, splitTrace)!;
    expect(trace.checks).toHaveLength(1); expect(trace.checks[0].t).toBe(7 + T);
    expect(trace.failed()).toEqual([]); expect(trace.transfers).toHaveLength(3);
    for (const key of ['resting', 'active', 'fatigued'] as const) {
      const node = `hand:${key}`, quantity = 'muscle-fraction:hand';
      expect(Math.abs(start[key] + trace.into(node, quantity) - trace.outOf(node, quantity) - result[key])).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(trace.outOf(node, quantity) - splitTrace.outOf(node, quantity))).toBeLessThanOrEqual(1e-12);
    }
    for (const transfer of trace.transfers) expect(transfer.amount).toBeGreaterThanOrEqual(0);
    if (T === 120) {
      const { F, R } = muscularRates('hand')!, reference = euler(start, 0.5, F, R, T, 0.001);
      for (const [i, key] of (['recruit', 'fatigue', 'recover'] as const).entries())
        expect(Math.abs(trace.transfers[i].amount - reference.flows[key])).toBeLessThan(1e-5);
    }
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
