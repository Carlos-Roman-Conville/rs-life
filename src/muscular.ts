/** Library-driven muscular indices. No tissue mass/energy is created: physiology owns
 * metabolic work and nutrition owns mass. Unsupported mechanisms remain null (FLAGS.md).
 * Equations: MUSCULAR.md sections 4 and 5a; all fitted constants come from library.ts. */
import { libraryColumns, libraryRow, libraryTable } from "./library.ts";
import type { Trace } from "./trace.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { bodyOutputs } from "./physiology.ts";

const table = (name: string) => libraryTable("muscular", name);
const training = (slug: string) => libraryRow("muscular", "training", `muscular.training.${slug}`);
function numbers(text: unknown): number[] {
  return (String(text).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}
function bounded(value: number, lo: number, hi: number, name: string): number {
  if (!Number.isFinite(value) || value < lo || value > hi) throw new Error(`muscular: invalid ${name}: ${value}`);
  return value;
}
export function muscularRange(id: string): readonly [number, number] {
  const row = libraryRow("muscular", "values", id);
  const match = /^(\d+) to (\d+)/.exec(String(row.Range));
  if (!match) throw new Error(`muscular: ${id} is not a numeric index`);
  return [Number(match[1]), Number(match[2])];
}
const indexMax = () => muscularRange("muscular.values.contractile-was-development")[1];
export const muscularTables = () => ({ groups: table("groups"), values: table("values"),
  adaptation: table("adaptation"), patterns: table("patterns"), tendons: table("tendons"), training: table("training") });

/** Only memberships explicitly named by fatigue_rates; no inferred joint for chest/back/neck. */
const rateGroups = [
  ["delt_front", "delt_mid", "delt_rear", "rotator_cuff"],
  ["biceps", "brachialis", "triceps"],
  ["forearm_flex", "forearm_ext", "hand"],
  ["erectors", "abs", "obliques"],
  ["glute_max", "glute_med", "quads", "hamstrings"],
  ["calves", "tibialis"],
];
const rateSlugs = ["shoulder-deltoids-rotator-cuff", "elbow-biceps-brachialis-triceps", "grip-forearm-hand",
  "trunk-erectors-abs-obliques", "hip-and-knee-glutes-quads-hamstrings", "ankle-calves-tibialis"];
export function muscularRates(group: string) {
  libraryRow("muscular", "groups", group);
  const i = rateGroups.findIndex(groups => groups.includes(group));
  if (i < 0) return null;
  const row = libraryRow("muscular", "fatigue_rates", `muscular.fatigue_rates.${rateSlugs[i]}`);
  return { id: String(row.id), F: Number(row["F (per s)"]), R: Number(row["R (per s)"]) };
}

/** At the row's MET only. There are 30 activation columns for 31 groups: diaphragm is null. */
export function muscularActivation(actionId: string) {
  const row = libraryRow("muscular", "activations", actionId);
  return { id: actionId, met: Number(row["Intensity (MET)"]), groups: Object.fromEntries(table("groups").map(g => {
    const id = String(g.id), value = row[id];
    return [id, typeof value === "number" ? value / indexMax() : null];
  })) as Record<string, number | null> };
}

export interface Compartments { resting: number; active: number; fatigued: number }
/** Exact constant-effort evolution in seconds (gears/muscular-3cc.md).
 * At rest active fibres are released; MF then follows the documented exact exponential.
 * Transfers and sum-to-one checks are returned through the shared Trace when supplied. */
export function stepMuscleFatigue(state: Compartments, group: string, effort: number, seconds: number,
  recoveryMultiplier: number, trace?: Trace, t = 0): Compartments | null {
  bounded(effort, 0, 1, "effort"); bounded(seconds, 0, Infinity, "seconds");
  bounded(recoveryMultiplier, 0, 1, "recovery multiplier");
  for (const value of Object.values(state)) bounded(value, 0, 1, "compartment");
  if (Math.abs(state.resting + state.active + state.fatigued - 1) > 1e-12) throw new Error("muscular: compartments must sum to one");
  const rates = muscularRates(group);
  if (!rates) return null;
  const s = { ...state }, R = rates.R * recoveryMultiplier;
  const move = (from: keyof Compartments, to: keyof Compartments, amount: number, time: number) => {
    s[from] -= amount; s[to] += amount;
    if (amount) trace?.record({ t: time, process: "muscular", quantity: `muscle-fraction:${group}`,
      from: `${group}:${from}`, to: `${group}:${to}`, amount });
  };
  const check = (time: number) => {
    const total = s.resting + s.active + s.fatigued;
    trace?.check(time, `muscle-fraction:${group}`, 1, total, 1e-12);
    if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-12 || Object.values(s).some(x => x < -1e-12 || x > 1 + 1e-12))
      throw new Error("muscular: compartment conservation failed");
    // Repair only roundoff, after checking the uncorrected conservation residual.
    s.resting = Math.max(0, Math.min(1, s.resting));
    s.active = Math.max(0, Math.min(1, s.active));
    s.fatigued = Math.max(0, Math.min(1, s.fatigued));
    const clampedTotal = s.resting + s.active + s.fatigued;
    s.resting /= clampedTotal; s.active /= clampedTotal; s.fatigued /= clampedTotal;
  };
  if (seconds === 0) return s;
  if (effort === 0) {
    move("active", "resting", s.active, t);
    move("fatigued", "resting", s.fatigued * -Math.expm1(-R * seconds), t);
    check(t + seconds);
  } else {
    // x' = A x + (e, 0), A = [-(e+F), -e; F, -R].
    // exp(A T) = (1+c) I + b (A+h I), h = -tr(A)/2.
    const e = effort, F = rates.F, h = (e + F + R) / 2;
    const determinant = e * (F + R) + F * R;
    const aStar = e * R / determinant, fStar = e * F / determinant;
    const a = s.active - aStar, f = s.fatigued - fStar;
    const discriminant = h * h - determinant;
    let c: number, b: number;
    if (discriminant > 0) {
      const d = Math.sqrt(discriminant);
      // Both exponents are nonpositive: avoid exp(-hT)*cosh(dT) overflow
      // and cancellation in the slow eigenvalue -h+d.
      const slow = -determinant / (h + d), fast = -h - d;
      c = (Math.expm1(slow * seconds) + Math.expm1(fast * seconds)) / 2;
      b = Math.exp(slow * seconds) * -Math.expm1(-2 * d * seconds) / (2 * d);
    } else if (discriminant < 0) {
      const d = Math.sqrt(-discriminant), angle = d * seconds, decay = Math.exp(-h * seconds);
      c = Math.expm1(-h * seconds) - 2 * decay * Math.sin(angle / 2) ** 2;
      b = decay * Math.sin(angle) / d;
    } else {
      c = Math.expm1(-h * seconds);
      b = Math.exp(-h * seconds) * seconds;
    }
    const da = c * a + b * ((h - e - F) * a - e * f);
    const df = c * f + b * (F * a + (h - R) * f);
    s.active += da; s.fatigued += df;
    s.resting = 1 - s.active - s.fatigued;
    if (trace) {
      // Integrate the rates over the call, preserving circulation as well as
      // endpoint differences. Integral(x-x*) = A^-1 (x(T)-x(0)).
      let fatigue = F * (aStar * seconds + (-R * da + e * df) / determinant);
      let recruit = fatigue + da, recover = fatigue - df;
      if (2 * h * seconds < 0.5) {
        // Analytic Taylor integral for short calls avoids subtracting nearly
        // equal terms above. These are 18 matrix powers, never time substeps;
        // the omitted tail is below double precision for ||Q T||_1 < 1.
        let rTerm = state.resting * seconds, aTerm = state.active * seconds, fTerm = state.fatigued * seconds;
        let rIntegral = rTerm, aIntegral = aTerm, fIntegral = fTerm;
        for (let k = 2; k <= 19; k++) {
          const scale = seconds / k;
          const nextR = (-e * rTerm + R * fTerm) * scale;
          const nextA = (e * rTerm - F * aTerm) * scale;
          const nextF = (F * aTerm - R * fTerm) * scale;
          rIntegral += nextR; aIntegral += nextA; fIntegral += nextF;
          rTerm = nextR; aTerm = nextA; fTerm = nextF;
        }
        recruit = e * rIntegral; fatigue = F * aIntegral; recover = R * fIntegral;
      }
      for (const [from, to, amount] of [
        ["resting", "active", recruit], ["active", "fatigued", fatigue], ["fatigued", "resting", recover],
      ] as const) {
        if (amount) trace.record({ t, process: "muscular", quantity: `muscle-fraction:${group}`,
          from: `${group}:${from}`, to: `${group}:${to}`, amount: Math.max(0, amount) });
      }
    }
    check(t + seconds);
  }
  return s;
}

/** A reference observation, not a stopping threshold for 3CC (the rows are inconsistent). */
export function muscularEnduranceReference(effort: number) {
  const row = table("endurance_time").find(r => Number(r["Effort (% of the group's max)"]) / indexMax() === effort);
  if (!row) return null;
  const text = String(row["Endurance time (fresh)"]);
  return { id: String(row.id), seconds: numbers(text)[0]! * (text.includes("min") ? 60 : 1),
    lowerBound: text.startsWith("over"), exhaustionSeconds: null };
}

export interface MuscleState {
  contractile: number; oxidative: number | null; condition: number;
  min: number; max: number; idleDays: number; tension: number; aerobic: number;
  compartments: Compartments | null;
}
export type MuscleSide = "L" | "R" | "one";
export interface MuscularState {
  groups: Record<string, Partial<Record<MuscleSide, MuscleState>>>;
  patterns: Record<string, Partial<Record<MuscleSide, { recruitment: number; practice: number; adaptation: null }>>>;
  tendons: Record<string, { tolerance: number | null; adaptation: null; injury: null }>;
}
/** Genetic limits and initial levels are host inputs, not inferred from game stats. */
export function createMuscularState(initial: { contractile: number; oxidative: number | null; min: number; max: number; recruitment: number }): MuscularState {
  bounded(initial.min, 0, indexMax(), "genetic minimum");
  bounded(initial.max, initial.min, indexMax(), "genetic maximum");
  bounded(initial.contractile, initial.min, initial.max, "contractile");
  if (initial.oxidative !== null) bounded(initial.oxidative, 0, indexMax(), "oxidative");
  bounded(initial.recruitment, 0, indexMax(), "recruitment");
  const sides = (s: unknown): MuscleSide[] => s === "L/R" ? ["L", "R"] : ["one"];
  return {
    groups: Object.fromEntries(table("groups").map(row => [String(row.id), Object.fromEntries(sides(row.Sides).map(side => [side, {
      contractile: initial.contractile, oxidative: initial.oxidative, min: initial.min, max: initial.max,
      condition: 1, idleDays: 0, tension: 0, aerobic: 0,
      compartments: muscularRates(String(row.id)) ? { resting: 1, active: 0, fatigued: 0 } : null,
    }]))])),
    patterns: Object.fromEntries(table("patterns").map(row => [String(row.id), Object.fromEntries(sides(row.Sides).map(side =>
      [side, { recruitment: initial.recruitment, practice: 0, adaptation: null }]))])),
    tendons: Object.fromEntries(table("tendons").map(row => [String(row.id), { tolerance: null, adaptation: null, injury: null }])),
  };
}

/** Three separate signals; effort and oxidativeShare are fractions, activation uses the library percent.
 * Linear load-factor interpolation is used between the two stated anchors. Pattern shares are host inputs. */
export function muscularStimuli(activation: number, effort: number, reps: number, minutes: number, oxidativeShare: number,
  patternShare: number) {
  for (const [name, v] of Object.entries({ activation, effort, patternShare })) bounded(v, 0, 1, name);
  bounded(reps, 0, Infinity, "reps"); bounded(minutes, 0, Infinity, "minutes"); bounded(oxidativeShare, Number.MIN_VALUE, 1, "oxidative share");
  const threshold = Number(training("overload-threshold-tension").Value) / indexMax();
  const upper = numbers(training("tension-stimulus-per-action").Value).at(-1)! / indexMax();
  const load = Math.max(0, Math.min(1, (effort - threshold) / (upper - threshold)));
  const aerobicRule = numbers(training("aerobic-stimulus-per-action").Value);
  const [divisor, , duration, low, high] = aerobicRule;
  return { tension: activation * indexMax() * reps * load,
    aerobic: minutes > duration! && effort >= low! / indexMax() && effort <= high! / indexMax()
      ? activation * indexMax() * minutes / divisor! * Math.min(1, effort / oxidativeShare) : 0,
    practice: minutes * patternShare };
}

export interface MuscularDay {
  tension: number; aerobic: number; used: boolean; hoursSinceHardSession: number;
  /** Resolved multipliers from the training rows; ambiguous intermediate gate values are the caller's. */
  proteinGate: number; energyGate: number; sleepGate: number; ageGate: number;
}
/** One overnight conversion, MUSCULAR.md 5a. No invented k_o, k_n or k_t.
 * Consumed tension is the gated portion; unconverted signal carries to the next night. */
export function adaptMuscleDay(state: MuscleState, day: MuscularDay): MuscleState {
  for (const key of ["proteinGate", "energyGate", "sleepGate", "ageGate"] as const) bounded(day[key], 0, 1, key);
  for (const key of ["tension", "aerobic", "hoursSinceHardSession"] as const) bounded(day[key], 0, Infinity, key);
  const s = { ...state };
  const cap = muscularRange("muscular.values.stimulus-tension-stimulus-aerobic")[1];
  s.tension = Math.min(cap, s.tension + day.tension); s.aerobic = Math.min(cap, s.aerobic + day.aerobic);
  s.idleDays = day.used ? 0 : s.idleDays + 1;
  const windowText = String(training("conversion-window").Note);
  const recoveryHours = /hoursSinceLastHardSession \/ ([\d.]+)/.exec(windowText);
  const fatigueLimit = /fatigue over ([\d.]+)/.exec(windowText);
  if (!recoveryHours || !fatigueLimit) throw new Error("muscular: conversion window schema changed");
  const rest = state.compartments === null ? null : state.compartments.fatigued > Number(fatigueLimit[1]) ? 0 : Math.min(1, day.hoursSinceHardSession / Number(recoveryHours[1]));
  const novice = training("conversion-rate-novice-development-under-40"), trained = training("conversion-rate-trained-development-40-to-70"), advanced = training("conversion-rate-advanced-over-70");
  const rate = s.contractile < numbers(novice.Constant)[0]! ? novice : s.contractile <= numbers(trained.Constant)[1]! ? trained : advanced;
  if (rest !== null && s.max > 0) {
    const consumed = s.tension * rest * day.proteinGate * day.energyGate * day.sleepGate * day.ageGate;
    s.contractile = Math.min(s.max, s.contractile + Number(rate.Value) / numbers(rate.Unit)[0]! * consumed * (1 - s.contractile / s.max));
    s.tension -= consumed;
  }
  const disuse = numbers(training("disuse-decay").Value);
  if (s.idleDays > disuse[0]!) s.contractile = Math.max(s.min, s.contractile - Math.abs(disuse[1]!));
  return s;
}

const banisterValue = (slug: string) => Number(libraryRow("physiology", "banister", `physiology.banister.${slug}`).Value);
function banisterPerformance(state: { fitness: number; fatigue: number }, base: number) {
  return base + banisterValue("k1-fitness-gain") * state.fitness - banisterValue("k2-fatigue-weight") * state.fatigue;
}

/** Proposed, uncalibrated clamp (gears/aerobic-training-clamp.md); sole training input to circulation.
 * Normalisation rows reference the existing k rows, never a second fitted constant set. */
export function trainingFactor(state: { fitness: number; fatigue: number }): number {
  for (const v of [state.fitness, state.fatigue]) bounded(v, 0, Infinity, "Banister state");
  const low = banisterValue("training-factor-min"), high = banisterValue("training-factor-max");
  for (const [normalisation, coefficient] of [["training-k1-normalisation", "k1-fitness-gain"],
    ["training-k2-normalisation", "k2-fatigue-weight"]]) {
    if (libraryRow("physiology", "banister", `physiology.banister.${normalisation}`).Value !== `physiology.banister.${coefficient}`)
      throw new Error("muscular: unsupported Banister normalisation");
  }
  return Math.max(low, Math.min(high, banisterPerformance(state, low)));
}

/** Banister's daily impulse followed by decay on subsequent days; base is host supplied.
 * These are MET-hour sums, not a calibrated VO2 ceiling or the circulation aerobic_today. */
export function muscularBanisterDay(state: { fitness: number; fatigue: number }, loadMetHours: number, base: number) {
  bounded(loadMetHours, 0, Infinity, "daily load");
  for (const v of [state.fitness, state.fatigue, base]) bounded(v, 0, Infinity, "Banister state");
  const value = banisterValue;
  const fitness = state.fitness * Math.exp(-1 / value("tau-fitness")) + loadMetHours;
  const fatigue = state.fatigue * Math.exp(-1 / value("tau-fatigue")) + loadMetHours;
  return { fitness, fatigue, performance: banisterPerformance({ fitness, fatigue }, base) };
}

/** Read the body's daily Banister state; an untracked body retains full capacity. */
export function bodyTrainingFactor(w: World, body: string): number {
  const p = w.registry.component(body).props;
  if (p.muscular_fitness === undefined && p.muscular_fatigue === undefined) return 1;
  return trainingFactor({ fitness: p.muscular_fitness, fatigue: p.muscular_fatigue });
}

/** Host calls once per training day with its daily MET-hour load, including rest days.
 * Stores only fitness/fatigue; the existing pure daily calculation owns adaptation. */
export function bodyBanisterDay(w: World, body: string, loadMetHours: number, base: number) {
  const p = w.registry.component(body).props;
  const next = muscularBanisterDay({ fitness: p.muscular_fitness ?? 0, fatigue: p.muscular_fatigue ?? 0 }, loadMetHours, base);
  p.muscular_fitness = next.fitness; p.muscular_fatigue = next.fatigue;
  return next;
}

export function muscularOutputs(state: MuscularState) {
  return {
    fatigue: Object.fromEntries(Object.entries(state.groups).map(([id, sides]) => [id,
      Object.fromEntries(Object.entries(sides).map(([side, s]) => [side, s.compartments?.fatigued ?? null]))])),
    patternSkill: Object.fromEntries(Object.entries(state.patterns).map(([id, sides]) => [id,
      Object.fromEntries(Object.entries(sides).map(([side, s]) => [side, s.recruitment]))])),
    limbStrength: Object.fromEntries(table("limb_strength").map(row => [String(row.id), null])),
    oxidativeAdaptation: null, tendonAdaptation: null, neuralAdaptation: null, massKg: null,
  };
}

/** Useful to adapters validating their action coverage, including missing group columns. */
export const muscularActivationColumns = () => libraryColumns("muscular", "activations");

export interface MuscularFatigueOptions {
  /** Match physiology's cadence and place this process after it. */
  every?: number;
  recoveryMultiplier?: number;
}

/** Local fatigue reads the same work record as systemic MET-hours, never that counter.
 * Numeric METs and activities without an activation row mean local rest. Missing rates remain null.
 * Outputs are scalar ids: muscular.fatigue_3cc.<group>.<side>. Banister's daily state is separate. */
export function muscularFatigueProcess(body: string, state: MuscularState, o: MuscularFatigueOptions = {}): Process {
  const recovery = bounded(o.recoveryMultiplier ?? 1, 0, 1, "recovery multiplier");
  return { name: "muscular", every: o.every ?? 10, step(w, dt) {
    const out = bodyOutputs(w.registry.component(body)), activity = out.activity;
    const activation = typeof activity === "string" && activity.startsWith("muscular.activations.")
      ? muscularActivation(activity) : null;
    for (const [group, sides] of Object.entries(state.groups)) {
      for (const muscle of Object.values(sides)) {
        if (muscle.compartments !== null)
          muscle.compartments = stepMuscleFatigue(muscle.compartments, group, activation?.groups[group] ?? 0, dt, recovery);
      }
    }
    for (const [group, sides] of Object.entries(muscularOutputs(state).fatigue))
      for (const [side, fatigue] of Object.entries(sides)) out[`muscular.fatigue_3cc.${group}.${side}`] = fatigue;
  } };
}
