/**
 * Signalling systems, baseline drivers, one-compartment kinetics, the four receptor clocks, the eleven circuits and the
 * interaction rules on a `body` component (kind "body", `props`). Every table number comes from `data/library/neurology.json`
 * through library.ts (`systems`, `baseline`, `pk`, `receptor`, `circuits`, `interactions`); the rule texts are parsed, so a
 * changed table changes the model. What NEUROLOGY.md asks for and the library cannot support (the EC50 and tolerance rate of all but alcohol, whose
 * pk-table values are design values, the rebound peak of most substances, the sizes of several drivers, the inverted-U shapes) is listed in FLAGS.md and left
 * disabled here: a `null` parameter switches its path off, and the caller may supply the number (`NeuroParams`).
 *
 * Tones: a system's tone is 1 at rest (0 to 2). tone = (1 + driver moves + sum of substance effects x sensitivity + withdrawal
 * swing) x the age scale, clamped. A circuit reads the tones once: read = 1 + sum of weight x (tone - 1), then the row's own
 * output range (neuroCircuits). Substances act only through the systems; no substance carries a penalty of its own.
 *
 * Dose: `dose(w, body, key, amount)` puts a substance in the gut (ledger substance `drug:<key>`, kg, traced from "intake");
 * `neurologyProcess` absorbs it (first order by the row's half-time), eliminates it (the row's half-life, or the zero-order
 * rate for alcohol, times `props.liver_function`, default 1; traced to "elimination") and reads the systems. Call
 * `registerDrugs(w)` and then `w.conserve("drug:alcohol", ["body"], 1e-12)` to have each substance's mass checked every step.
 *
 * Inputs on `body.props` (all optional): male (1 default), age_y, liver_function (1), pain (0 to 10), hunger (0 to 1),
 * starvation_stage, fever (1), fear_event (1 while it lasts), praise (1 on the event), isolation (1 while it lasts),
 * hours_awake (kept by the process: zeroed while asleep), asleep (1 or 0; absent: read from physiology's sleep hours), and
 * physiology's own outputs (met, sleep_debt, core_c, wbgt_c, wbgt_ceiling_c).
 * Outputs by library id on `body.props.outputs` (read them with `bodyOutputs`): one entry per circuit id (arousal,
 * motor-control, reward-and-habit, attention, pain-gating, memory-and-learning, breathing-drive, mood-regulation,
 * fear-and-stress, appetite, sleep) with its `<id>_row`, tone_<system>, sensitivity_<system>, dependence_<system>,
 * withdrawal_<system>, conc_<key>, occupancy_<key>, burden_<key>, alcohol_withdrawal_stage, fever_delirium, hours_awake.
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { libraryMeta, libraryTable, type LibraryRow } from "./library.ts";
import { bodyOutputs } from "./physiology.ts";

// ---------------------------------------------------------------------------------------------------------------- text reading

const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, ""));
function grab(text: string, rx: RegExp, what: string, group = 1): number {
  const m = rx.exec(text);
  if (!m) throw new Error(`neurology: the library text for ${what} no longer reads ${rx}`);
  return num(m[group]);
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** A range "a to b" in the text (or a single number) as its mean: a range is read at its middle, never at an end. */
const mid = (lo: string, hi: string | undefined) => (num(lo) + (hi === undefined ? num(lo) : num(hi))) / 2;

const slug = (row: LibraryRow, table: string) => String(row.id).replace(`neurology.${table}.`, "");

// ---------------------------------------------------------------------------------------------------------------- systems

export interface NeuroSystem { id: string; name: string; recoveryDays: number; row: LibraryRow }

interface SystemScale { toneLo: number; toneHi: number; sensLo: number; sensHi: number }

let systemList: NeuroSystem[] | null = null;
let systemScale: SystemScale | null = null;

/** The ten systems in table order. */
export function neuroSystems(): NeuroSystem[] {
  return systemList ??= libraryTable("neurology", "systems").map(row => ({
    id: String(row.id), name: String(row.System), recoveryDays: Number(row["Sensitivity recovery (days, model)"]), row,
  }));
}
export function neuroSystem(id: string): NeuroSystem {
  const s = neuroSystems().find(x => x.id === id);
  if (!s) throw new Error(`neurology: no system ${id}`);
  return s;
}
function scale(): SystemScale {
  if (systemScale) return systemScale;
  const src = libraryMeta("neurology", "systems").source;
  return systemScale = {
    toneLo: grab(src, /tone \((\d+) to (\d+), 1 = normal\)/, "the tone range", 1), toneHi: grab(src, /tone \((\d+) to (\d+), 1 = normal\)/, "the tone range", 2),
    sensLo: grab(src, /receptor sensitivity \((\d+) to (\d+), 1 = normal/, "the sensitivity range", 1), sensHi: grab(src, /receptor sensitivity \((\d+) to (\d+), 1 = normal/, "the sensitivity range", 2),
  };
}

// ---------------------------------------------------------------------------------------------------------------- baseline

interface BaselineRules {
  awakeAdenosinePerH: number;
  exercise: { overMet: number; noradrenaline: number; opioid: number; opioidAfterH: number; dopamine: number };
  pain: { over: number; noradrenaline: number; opioid: number };
  fear: { event: number; day: number };
  hunger: { over: number; orexin: number; dopamine: number };
  starvation: { stage: number; serotonin: number; dopamine: number };
  sleepDebtOverH: number;
  praise: { dopamine: number; opioid: number };
  isolation: { serotonin: number; noradrenaline: number };
  fever: { attention: number; deliriumC: number };
  heat: { noradrenaline: number };
  age: { dopaminePerDecade: number; acetylcholinePerDecade: number; afterY: number };
}

let rulesCache: BaselineRules | null = null;
function baselineRules(): BaselineRules {
  if (rulesCache) return rulesCache;
  const rows = libraryTable("neurology", "baseline");
  const row = (prefix: string) => rows.find(r => slug(r, "baseline").startsWith(prefix)) ?? (() => { throw new Error(`neurology: no baseline row ${prefix}`); })();
  const moved = (p: string) => String(row(p)["Systems moved (tone)"]), driver = (p: string) => String(row(p)["Driver (from)"]);
  const aw = moved("hours-awake"), ex = moved("hard-exercise"), pa = moved("pain"), fe = moved("fear"), hu = moved("hunger"), st = moved("starvation"),
    pr = moved("social-praise"), is = moved("social-isolation"), fv = moved("fever"), ht = moved("heat-strain"), ag = moved("age");
  return rulesCache = {
    awakeAdenosinePerH: grab(aw, /adenosine \+([\d.]+) per hour awake/, "adenosine per hour awake"),
    exercise: {
      overMet: grab(driver("hard-exercise"), /MET over ([\d.]+)/, "the hard exercise MET"),
      noradrenaline: grab(ex, /noradrenaline \+([\d.]+) during/, "exercise noradrenaline"), opioid: grab(ex, /opioid \+([\d.]+) for/, "exercise opioid"),
      opioidAfterH: grab(ex, /opioid \+[\d.]+ for ([\d.]+) h after/, "exercise opioid hours"), dopamine: grab(ex, /dopamine \+([\d.]+)/, "exercise dopamine"),
    },
    pain: { over: grab(driver("pain"), /Pain over ([\d.]+)/, "the pain threshold"), noradrenaline: grab(pa, /noradrenaline \+([\d.]+)/, "pain noradrenaline"), opioid: grab(pa, /opioid \+([\d.]+)/, "pain opioid") },
    fear: { event: grab(fe, /noradrenaline \+([\d.]+) for the event/, "fear for the event"), day: grab(fe, /\+([\d.]+) for the day/, "fear for the day") },
    hunger: { over: grab(driver("hunger"), /Hunger over ([\d.]+)/, "the hunger threshold"), orexin: grab(hu, /histamine_orexin \+([\d.]+)/, "hunger orexin"), dopamine: grab(hu, /dopamine seeking \+([\d.]+)/, "hunger dopamine") },
    starvation: { stage: grab(driver("starvation"), /stage (\d)\+/, "the starvation stage"), serotonin: grab(st, /serotonin (-[\d.]+)/, "starvation serotonin"), dopamine: grab(st, /dopamine (-[\d.]+)/, "starvation dopamine") },
    sleepDebtOverH: grab(driver("sleep-debt"), /over (\d+) h/, "the sleep debt threshold"),
    praise: { dopamine: grab(pr, /dopamine \+([\d.]+) for the day/, "praise dopamine"), opioid: grab(pr, /opioid \+([\d.]+)/, "praise opioid") },
    isolation: { serotonin: grab(is, /serotonin (-[\d.]+) a day/, "isolation serotonin"), noradrenaline: grab(is, /noradrenaline \+([\d.]+)/, "isolation noradrenaline") },
    fever: { attention: grab(fv, /attention (-[\d.]+)/, "fever attention"), deliriumC: grab(fv, /over ([\d.]+) C/, "the delirium temperature") },
    heat: { noradrenaline: grab(ht, /noradrenaline \+([\d.]+)/, "heat strain noradrenaline") },
    age: {
      dopaminePerDecade: grab(ag, /dopamine -([\d.]+)% per decade/, "age dopamine") / 100, acetylcholinePerDecade: grab(ag, /acetylcholine -([\d.]+)%/, "age acetylcholine") / 100,
      afterY: grab(ag, /after (\d+)/, "the age the decline starts"),
    },
  };
}

/** What the body and the day are doing, as the baseline rows read it. Everything optional (absent: the driver is off). */
export interface BaselineState {
  hoursAwake?: number;
  sleepDebtH?: number;
  met?: number;
  /** Hours since a hard exercise bout ended (null or absent: none lately). */
  hoursSinceHardExercise?: number | null;
  pain?: number;
  fearEvent?: boolean;
  fearToday?: boolean;
  hunger?: number;
  starvationStage?: number;
  praiseToday?: boolean;
  isolation?: boolean;
  fever?: boolean;
  coreC?: number;
  heatStrain?: boolean;
  ageY?: number;
}

export interface BaselineResult {
  /** Tone moves by system id (added to the resting tone of 1). */
  move: Record<string, number>;
  /** Multiplicative scale on the tone by system id (age). 1 where nothing scales it. */
  scale: Record<string, number>;
  /** The baseline rows (ids) that are moving something now. */
  active: string[];
  /** Active rows whose systems the library names but whose size it does not give (FLAGS.md). */
  unsized: { row: string; systems: string[] }[];
  /** Fever's change to the attention read (the row names the circuit, not a system); 0 off. */
  feverAttention: number;
  /** Fever above the delirium temperature (the row's own 39.5 C). */
  delirium: boolean;
}

/** The baseline drivers' moves on the systems, from the body and the day. Pure. */
export function baselineMoves(s: BaselineState): BaselineResult {
  const r = baselineRules(), move: Record<string, number> = {}, sc: Record<string, number> = {}, active: string[] = [], unsized: BaselineResult["unsized"] = [];
  for (const sys of neuroSystems()) { move[sys.id] = 0; sc[sys.id] = 1; }
  const rowId = (p: string) => String(libraryTable("neurology", "baseline").find(x => slug(x, "baseline").startsWith(p))!.id);
  const add = (p: string, sys: string, v: number) => { move[sys] = move[sys]! + v; if (!active.includes(rowId(p))) active.push(rowId(p)); };

  if ((s.hoursAwake ?? 0) > 0) add("hours-awake", "adenosine", r.awakeAdenosinePerH * s.hoursAwake!);
  const hard = (s.met ?? 0) > r.exercise.overMet;
  if (hard) { add("hard-exercise", "noradrenaline", r.exercise.noradrenaline); add("hard-exercise", "dopamine", r.exercise.dopamine); }
  if (!hard && s.hoursSinceHardExercise != null && s.hoursSinceHardExercise < r.exercise.opioidAfterH) add("hard-exercise", "opioid", r.exercise.opioid);
  if ((s.pain ?? 0) > r.pain.over) { add("pain", "noradrenaline", r.pain.noradrenaline); add("pain", "opioid", r.pain.opioid); }
  if (s.fearEvent) add("fear", "noradrenaline", r.fear.event);
  if (s.fearToday || s.fearEvent) add("fear", "noradrenaline", r.fear.day);
  if ((s.hunger ?? 0) > r.hunger.over) { add("hunger", "histamine_orexin", r.hunger.orexin); add("hunger", "dopamine", r.hunger.dopamine); }
  if ((s.starvationStage ?? 0) >= r.starvation.stage) { add("starvation", "serotonin", r.starvation.serotonin); add("starvation", "dopamine", r.starvation.dopamine); }
  if ((s.sleepDebtH ?? 0) > r.sleepDebtOverH) { active.push(rowId("sleep-debt")); unsized.push({ row: rowId("sleep-debt"), systems: ["glutamate", "noradrenaline"] }); }
  if (s.praiseToday) { add("social-praise", "dopamine", r.praise.dopamine); add("social-praise", "opioid", r.praise.opioid); }
  if (s.isolation) { add("social-isolation", "serotonin", r.isolation.serotonin); add("social-isolation", "noradrenaline", r.isolation.noradrenaline); }
  let feverAttention = 0, delirium = false;
  if (s.fever) {
    active.push(rowId("fever")); feverAttention = r.fever.attention; delirium = (s.coreC ?? 0) > r.fever.deliriumC;
    unsized.push({ row: rowId("fever"), systems: neuroSystems().map(x => x.id) });
  }
  if (s.heatStrain) { add("heat-strain", "noradrenaline", r.heat.noradrenaline); unsized.push({ row: rowId("heat-strain"), systems: ["serotonin"] }); }
  const decades = Math.max(0, ((s.ageY ?? 0) - r.age.afterY) / 10);
  if (decades > 0) {
    sc.dopamine = 1 - r.age.dopaminePerDecade * decades; sc.acetylcholine = 1 - r.age.acetylcholinePerDecade * decades;
    active.push(rowId("age"));
  }
  return { move, scale: sc, active, unsized, feverAttention, delirium };
}

// ---------------------------------------------------------------------------------------------------------------- substances

export interface SystemHit { system: string; potency: number; /** the row says the effect comes "later": no delay is given, so the hit is off */ delayed: boolean }

export type Elimination = { kind: "zero"; gPerDLPerH: number } | { kind: "half"; hours: number };

export interface NeuroSubstance {
  /** A short name for the row (alcohol, laudanum, tobacco, caffeine, quinine, mercury, lead, hemp). */
  key: string;
  id: string;
  name: string;
  row: LibraryRow;
  absorbHalfMin: number | null;
  elimination: Elimination | null;
  /** L/kg of the Widmark form for men and women, or the single value; null where the row gives "accumulates". */
  vdMan: number | null;
  vdWoman: number | null;
  /** A body burden: it has no concentration, only an amount that decays by its half-life. */
  accumulates: boolean;
  hits: SystemHit[];
  /** The amount of one standard dose (a range where the row gives one) and its unit, null where the row gives none. */
  standardDose: { lo: number; hi: number; unit: "g" | "mg" } | null;
  /** The unit a concentration is quoted in: g/dL for the alcohol form, mg/L otherwise. */
  concUnit: "g/dL" | "mg/L";
  /** The library's EC50 in `concUnit`, null where the pk table gives none (no acute effect). */
  ec50: number | null;
  /** The library's tolerance rate per day per unit of mean occupancy, null where the pk table gives none. */
  kTol: number | null;
}

const KEYS: [string, string][] = [
  ["alcohol", "alcohol-"], ["laudanum", "opium-"], ["tobacco", "tobacco-"], ["caffeine", "coffee-"], ["quinine", "peruvian-"],
  ["mercury", "mercury-"], ["lead", "lead-"], ["hemp", "hemp-"],
];

let substanceList: NeuroSubstance[] | null = null;

const numOrNull = (v: unknown) => typeof v === "number" ? v : null;

function parseSubstance(key: string, row: LibraryRow): NeuroSubstance {
  const elim = String(row.Elimination), vd = String(row["Volume of distribution (L/kg)"]), dose = String(row["Standard dose"]);
  let elimination: Elimination | null = null;
  const zero = /zero order, ([\d.]+) g\/dL per hour/.exec(elim), half = /half-life (?:about )?([\d.]+)(?: to ([\d.]+))? (h|days?)/.exec(elim);
  if (zero) elimination = { kind: "zero", gPerDLPerH: num(zero[1]) };
  else if (half) elimination = { kind: "half", hours: mid(half[1]!, half[2]) * (half[3] === "h" ? 1 : 24) };
  let vdMan: number | null = null, vdWoman: number | null = null;
  const sexed = /^([\d.]+) \(men\) ([\d.]+) \(women\)/.exec(vd), single = /^([\d.]+)\s*$/.exec(vd);
  if (sexed) { vdMan = num(sexed[1]); vdWoman = num(sexed[2]); } else if (single) { vdMan = vdWoman = num(single[1]); }
  const hits: SystemHit[] = [];
  for (const seg of String(row["Systems hit (direction, potency per standard dose)"]).split(";")) {
    const m = /^\s*([a-z_]+) ([+-][\d.]+)/.exec(seg);
    if (m && neuroSystems().some(s => s.id === m[1])) hits.push({ system: m[1]!, potency: num(m[2]), delayed: /\blater\b/.test(seg) });
  }
  const amt = /([\d.]+)(?: to ([\d.]+))?\s*(g|mg)\b/.exec(dose);
  return {
    key, id: String(row.id), name: String(row["Substance (good)"]), row,
    absorbHalfMin: typeof row["Absorption half-time (min)"] === "number" ? row["Absorption half-time (min)"] : null,
    elimination, vdMan, vdWoman, accumulates: /accumulates/.test(vd), hits,
    standardDose: amt ? { lo: num(amt[1]), hi: num(amt[2] ?? amt[1]), unit: amt[3] as "g" | "mg" } : null,
    concUnit: zero ? "g/dL" : "mg/L",
    ec50: numOrNull(row["EC50 (g/dL for alcohol, mg/L otherwise)"]), kTol: numOrNull(row["k_tol (per day per unit of mean occupancy)"]),
  };
}

/** The substances of the pk table that carry a kinetics row (the tagged row says "as its row" and has none). */
export function neuroSubstances(): NeuroSubstance[] {
  if (substanceList) return substanceList;
  const rows = libraryTable("neurology", "pk");
  return substanceList = KEYS.map(([key, prefix]) => {
    const row = rows.find(r => slug(r, "pk").startsWith(prefix));
    if (!row) throw new Error(`neurology: no pk row for ${key}`);
    return parseSubstance(key, row);
  });
}
export function neuroSubstance(key: string): NeuroSubstance {
  const s = neuroSubstances().find(x => x.key === key || x.id === key);
  if (!s) throw new Error(`neurology: no substance ${key}`);
  return s;
}

/** The share of a drink that is available after a meal (the pk table's "availability 66 to 71% after a meal", at its middle). */
export function mealAvailability(): number {
  const m = /availability ([\d.]+) to ([\d.]+)% after a meal/.exec(libraryMeta("neurology", "pk").source);
  if (!m) throw new Error("neurology: the pk table no longer gives the availability after a meal");
  return mid(m[1]!, m[2]) / 100;
}

// ---------------------------------------------------------------------------------------------------------------- kinetics

export interface PkState { gutKg: number; centralKg: number }

/** An amount under this is zero: the registry's own floor for a content (addContent), so a first-order tail ends and a substance clears. */
const NEGLIGIBLE_KG = 1e-12;

const UNIT_KG = { g: 1e-3, mg: 1e-6, kg: 1 } as const;
export type DoseUnit = keyof typeof UNIT_KG;

/** The volume of distribution in litres for this body (the Widmark factor times mass for alcohol), null where the row has none. */
export function distributionLitres(s: NeuroSubstance, massKg: number, male = true): number | null {
  const v = male ? s.vdMan : s.vdWoman;
  return v === null ? null : v * massKg;
}

/** Concentration of the central amount: g/dL for alcohol (Widmark: A / (r W)), mg/L for the rest; null for a burden. */
export function concentration(s: NeuroSubstance, centralKg: number, massKg: number, male = true): number | null {
  const litres = distributionLitres(s, massKg, male);
  if (litres === null) return null;
  return s.concUnit === "g/dL" ? centralKg * 1e3 / litres / 10 : centralKg * 1e6 / litres;
}

/** Advance the gut and central amounts by `dtMin` minutes, in sub-steps of at most one minute: first-order absorption, then elimination. */
export function pkStep(s: NeuroSubstance, st: PkState, dtMin: number, massKg: number, male = true, liver = 1): PkState & { absorbedKg: number; eliminatedKg: number } {
  if (s.absorbHalfMin === null || s.elimination === null) return { ...st, absorbedKg: 0, eliminatedKg: 0 };
  const n = Math.max(1, Math.ceil(dtMin)), h = dtMin / n;
  let gut = st.gutKg, central = st.centralKg, absorbed = 0, eliminated = 0;
  const litres = distributionLitres(s, massKg, male) ?? 0;
  for (let i = 0; i < n; i++) {
    const a = gut * (1 - Math.pow(2, -h / s.absorbHalfMin));
    gut -= a; central += a; absorbed += a;
    const e = s.elimination.kind === "zero"
      ? Math.min(central, s.elimination.gPerDLPerH / 60 * h * 10 * litres * 1e-3 * liver)
      : central * (1 - Math.pow(2, -h * liver / (s.elimination.hours * 60)));
    central -= e; eliminated += e;
    if (gut < NEGLIGIBLE_KG) { central += gut; absorbed += gut; gut = 0; }
    if (central < NEGLIGIBLE_KG) { eliminated += central; central = 0; }
  }
  return { gutKg: gut, centralKg: central, absorbedKg: absorbed, eliminatedKg: eliminated };
}

/** Occupancy of the receptors by a concentration: C / (C + EC50) (Hill, n = 1). */
export const occupancy = (c: number, ec50: number) => c / (c + ec50);

// ---------------------------------------------------------------------------------------------------------------- clocks

interface ClockRules { floor: number; dependenceDays: number; delirium: { loH: number; dependenceOver: number; deathRollPerDay: number }; seizureLoH: number; onsetLoH: number; opioidPeakH: number | null }

let clockCache: ClockRules | null = null;
function clocks(): ClockRules {
  if (clockCache) return clockCache;
  const rows = libraryTable("neurology", "receptor");
  const f = (p: string) => String(rows.find(r => slug(r, "receptor").startsWith(p))!["Formula (model)"]);
  const tol = f("2-tolerance"), dep = f("3-dependence"), wd = f("4-withdrawal"), src = libraryMeta("neurology", "receptor").source;
  const op = /opioids onset [\d.]+ to [\d.]+ h, peak ([\d.]+) to ([\d.]+) days/.exec(src);
  return clockCache = {
    floor: grab(tol, /floor ([\d.]+)/, "the tolerance floor"), dependenceDays: grab(dep, /exposure days \/ ([\d.]+)/, "the dependence days"),
    delirium: { loH: grab(wd, /delirium at (\d+) to (\d+) h/, "the delirium onset"), dependenceOver: grab(wd, /if dependence over ([\d.]+)/, "the delirium dependence"), deathRollPerDay: grab(wd, /death roll ([\d.]+)% per day/, "the death roll") / 100 },
    seizureLoH: grab(wd, /fits at (\d+) to (\d+) h/, "the seizure onset"), onsetLoH: grab(src, /alcohol (\d+) to (\d+) h onset/, "the alcohol withdrawal onset"),
    opioidPeakH: op ? mid(op[1]!, op[2]) * 24 : null,
  };
}

/** The tolerance floor, the dependence time and the rebound peak the library gives (opioids: the middle of "peak 1 to 3 days", in hours). */
export function clockRules() { const c = clocks(); return { toleranceFloor: c.floor, dependenceDays: c.dependenceDays, deliriumDependenceOver: c.delirium.dependenceOver, deliriumDeathRollPerDay: c.delirium.deathRollPerDay, opioidReboundPeakH: c.opioidPeakH }; }

/** Tolerance: sensitivity falls by kTol x the day's mean occupancy, to the floor. */
export function toleranceStep(sensitivity: number, meanOccupancy: number, kTol: number): number { return Math.max(clocks().floor, sensitivity - kTol * meanOccupancy); }

/** Recovery with no exposure: sensitivity moves toward 1 at the system's time constant, for `days`. */
export function recoveryStep(sensitivity: number, recoveryDays: number, days = 1): number { return sensitivity + (1 - sensitivity) * (1 - Math.exp(-days / recoveryDays)); }

/** dependence = clamp(1 - sensitivity, 0, 1) x exposure days / 14, held to 0..1. */
export function dependence(sensitivity: number, exposureDays: number): number { return clamp(clamp(1 - sensitivity, 0, 1) * exposureDays / clocks().dependenceDays, 0, 1); }

/** Rebound: rises from 0 at the last dose to 1 at the peak, then fades on the system's recovery constant. */
export function rebound(hoursSinceDose: number, peakH: number, recoveryDays: number): number {
  if (hoursSinceDose <= 0) return 0;
  return hoursSinceDose < peakH ? hoursSinceDose / peakH : Math.exp(-(hoursSinceDose - peakH) / (recoveryDays * 24));
}

// ---------------------------------------------------------------------------------------------------------------- circuits

export interface CircuitTerm { system: string | null; weight: number | null; note: string; via: "alcohol" | null; invertedU: boolean }

export interface Circuit {
  id: string;
  rowId: string;
  name: string;
  terms: CircuitTerm[];
  /** The output's stated range from the row's Output text (null ends: none stated). */
  lo: number | null;
  hi: number | null;
  /** "offset": the read minus 1 is the output (normal = 0); "read": the read itself. */
  form: "read" | "offset";
  goesTo: string;
  /** Alcohol over this g/dL blocks the circuit (the memory row), null elsewhere. */
  blockedOverAlcohol: number | null;
  row: LibraryRow;
}

function splitTop(text: string): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (const ch of text) {
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseTerm(part: string): CircuitTerm {
  const inside = [...part.matchAll(/\(([^)]*)\)/g)].map(m => m[1]!).join(" "), outside = part.replace(/\([^)]*\)/g, " ");
  const name = /^[a-z_]+/.exec(part.trim())?.[0] ?? null, w = /([+-][\d.]+)/.exec(outside);
  const named = name === "orexin" ? "histamine_orexin" : name === "nicotine" ? /[a-z_]+/.exec(inside)?.[0] ?? null : name;
  const system = named !== null && neuroSystems().some(s => s.id === named) ? named : null;
  return { system, weight: w ? num(w[1]) : null, note: inside, via: name === "alcohol" ? "alcohol" : null, invertedU: /inverted U/.test(part) };
}

function parseRange(text: string): { lo: number | null; hi: number | null } {
  const m = /(?:^|\s)x?(-?[\d.]+) to x?\+?(-?[\d.]+)/.exec(text);
  return m ? { lo: num(m[1]), hi: num(m[2]) } : { lo: null, hi: null };
}

let circuitList: Circuit[] | null = null;
/** The eleven circuits as weighted reads of systems, from the circuits table. */
export function neuroCircuits(): Circuit[] {
  if (circuitList) return circuitList;
  return circuitList = libraryTable("neurology", "circuits").map(row => {
    const id = slug(row, "circuits"), reads = String(row["Reads (systems, weight)"]), out = String(row.Output);
    const terms = splitTop(reads).map(parseTerm);
    const block = /alcohol over ([\d.]+) g\/dL blocks/.exec(reads);
    const range = parseRange(out);
    const offset = id === "pain-gating" || id === "mood-regulation";
    return {
      id, rowId: String(row.id), name: String(row.Circuit), terms, lo: id === "pain-gating" ? null : range.lo, hi: range.hi, form: offset ? "offset" : "read",
      goesTo: String(row["Goes to"]), blockedOverAlcohol: block ? num(block[1]) : null, row,
    } satisfies Circuit;
  });
}
export function neuroCircuit(id: string): Circuit {
  const c = neuroCircuits().find(x => x.id === id);
  if (!c) throw new Error(`neurology: no circuit ${id}`);
  return c;
}

/** What a circuit reads once the terms the library can support are summed: 1 + sum of weight x (tone - 1). Disabled terms add nothing. */
export function circuitRead(c: Circuit, tone: Record<string, number>): number {
  let r = 1;
  for (const t of c.terms) if (t.system !== null && t.weight !== null && !t.invertedU && t.via === null) r += t.weight * ((tone[t.system] ?? 1) - 1);
  return r;
}

/** The terms of a circuit that are switched off for want of a number or a shape in the library (FLAGS.md). */
export function disabledTerms(c: Circuit): CircuitTerm[] { return c.terms.filter(t => t.invertedU || (t.system !== null && t.weight === null)); }

interface SynergyRule { opioid: number; gaba: number; alcohol: number; both: number; occupancyOver: number }
let synergyCache: SynergyRule | null = null;
/** The depressant synergy on breathing, from the interactions table. */
export function synergyRule(): SynergyRule {
  if (synergyCache) return synergyCache;
  const t = String(libraryTable("neurology", "interactions").find(r => slug(r, "interactions") === "depressant-synergy-on-breathing")!["Formula or statement"]);
  return synergyCache = {
    opioid: grab(t, /\(1 - ([\d.]+) opioidEffect\)/, "the opioid factor"), gaba: grab(t, /\(1 - ([\d.]+) gabaEffect\)/, "the gaba factor"),
    alcohol: grab(t, /\(1 - ([\d.]+) alcoholEffect\)/, "the alcohol factor"), both: grab(t, /then x([\d.]+) if two or more depressants/, "the two-depressant factor"),
    occupancyOver: grab(t, /over ([\d.]+) occupancy/, "the depressant occupancy"),
  };
}

/** Respiratory drive by the product form: (1 - 0.6 opioid) x (1 - 0.3 gaba) x (1 - 0.2 alcohol), x0.8 with two depressants over the occupancy. */
export function breathingDrive(opioidEffect: number, gabaEffect: number, alcoholEffect: number, depressantsOver: number): number {
  const r = synergyRule();
  const d = (1 - r.opioid * opioidEffect) * (1 - r.gaba * gabaEffect) * (1 - r.alcohol * alcoholEffect) * (depressantsOver >= 2 ? r.both : 1);
  return clamp(d, 0, 1);
}

// ---------------------------------------------------------------------------------------------------------------- the body

/** The numbers the library calls placeholders and does not give. Each `null` or absent entry switches its path off (FLAGS.md). */
export interface NeuroParams {
  /** EC50 per substance key, in the concentration unit of `NeuroSubstance.concUnit`; overrides the pk table's column, null switches the substance's acute effect off. */
  ec50?: Record<string, number | null>;
  /** The tolerance rate k_tol per substance key, per day per unit of mean occupancy; overrides the pk table's cell, null switches that substance's tolerance off. A substance with no number anywhere builds none. */
  kTol?: Record<string, number | null>;
  /** Hours from the last dose to the rebound peak, per substance key. Absent: no withdrawal for it (opioids: the library's range). */
  reboundPeakH?: Record<string, number>;
}

export interface NeurologyOptions {
  every?: number;      // run every N fast steps (default 10)
  clockH0?: number;    // clock hour at world time 0 (default 0)
  dayStartH?: number;  // the hour the day's books close (default 12: the nautical day, as physiology)
  params?: NeuroParams;
}

const sub = (key: string) => `drug:${key}`;

/** Register the ledger substances (`drug:<key>`, mass only). Call before `World.conserve`. */
export function registerDrugs(w: World) {
  for (const s of neuroSubstances()) {
    if (w.registry.substances.has(sub(s.key))) continue;
    w.registry.addSubstance({ id: sub(s.key), name: `${s.name} (on board)`, molarMass: 1, formula: "", cp: {}, source: "data/library/neurology.json", provenance: "Historical", checked: "unverified: a marker substance for the neurology library, no reference values" });
  }
}

/** The amount on board in kg: gut plus central. */
export function onBoardKg(w: World, bodyId: string, key: string): number {
  const p = w.registry.component(bodyId).props;
  return (p[`neu_gut_${key}`] ?? 0) + (p[`neu_c_${key}`] ?? 0);
}

/** realism.neurology.pk owns mass; registry contents are only its exact projection. */
function syncDrugContent(w: World, bodyId: string, key: string) {
  const b = w.registry.component(bodyId), mass = onBoardKg(w, bodyId, key);
  const index = b.contents.findIndex(x => x.substance === sub(key));
  // Replace the projection entry, including any old registry accumulation carry.
  if (index >= 0) b.contents[index] = { ...b.contents[index]!, mass };
  else if (mass > 0) b.contents.push({ substance: sub(key), phase: "solid", mass });
}

/**
 * Take a dose: `amount` in `unit` (default: the unit of the row's standard dose) goes into the gut, traced from "intake".
 * With `meal` the share the pk table gives for a meal is available; the rest is traced to "unabsorbed" and never enters.
 */
export function dose(w: World, bodyId: string, key: string, amount: number, o: { unit?: DoseUnit; meal?: boolean } = {}) {
  const s = neuroSubstance(key), unit = o.unit ?? s.standardDose?.unit;
  if (!unit) throw new Error(`neurology: ${key} has no standard dose unit; pass one`);
  registerDrugs(w);
  const b = w.registry.component(bodyId), p = b.props;
  const total = amount * UNIT_KG[unit], kg = o.meal ? total * mealAvailability() : total;
  w.trace.record({ t: w.t, process: "dose", quantity: `mass:${sub(s.key)}`, from: "intake", to: bodyId, amount: kg, note: o.meal ? "intake to gut after a meal" : "intake to gut" });
  if (kg < total) w.trace.record({ t: w.t, process: "dose", quantity: `mass:${sub(s.key)}`, from: "intake", to: "unabsorbed", amount: total - kg, note: "not available after a meal" });
  p[`neu_gut_${s.key}`] = (p[`neu_gut_${s.key}`] ?? 0) + kg;
  syncDrugContent(w, bodyId, s.key);
  p[`neu_dose_t_${s.key}`] = w.t;
}

/** The neurology process: kinetics each step, the tones and circuits, and the tolerance clocks at each day's close. Run it after `physiologyProcess`. */
export function neurologyProcess(body: string, o: NeurologyOptions = {}): Process {
  const clockH0 = o.clockH0 ?? 0, dayStartH = o.dayStartH ?? 12, params = o.params ?? {};
  const systems = neuroSystems(), substances = neuroSubstances(), circuits = neuroCircuits();
  const kTolOf = (s: NeuroSubstance): number | null => params.kTol && s.key in params.kTol ? params.kTol[s.key]! : s.kTol;
  const reboundPeak = (key: string): number | null => params.reboundPeakH?.[key] ?? (key === "laudanum" ? clocks().opioidPeakH : null);

  return { name: "neurology", every: o.every ?? 10, step(w, dt) {
    registerDrugs(w);
    const b = w.registry.component(body), p = b.props, out = bodyOutputs(b), male = p.male !== 0, liver = p.liver_function ?? 1;
    const dtH = dt / 3600, dtMin = dt / 60, scaleR = scale();
    const clock = clockH0 + w.t / 3600, dayIndex = Math.floor((clock - dayStartH) / 24);
    const c = clocks();
    p.neu_day_index ??= dayIndex;

    // the day closes: tolerance builds under exposure, recovers without it
    while (p.neu_day_index < dayIndex) {
      const secs = p.neu_occ_s ?? 0;
      for (const sys of systems) {
        const mean = secs > 0 ? (p[`neu_occ_${sys.id}`] ?? 0) / secs : 0, key = `neu_sens_${sys.id}`;
        let sens = p[key] ?? 1;
        if (mean > 0) {
          p[`neu_expd_${sys.id}`] = (p[`neu_expd_${sys.id}`] ?? 0) + 1;
          const rate = secs > 0 ? (p[`neu_tol_${sys.id}`] ?? 0) / secs : 0;   // the day's mean of k_tol x occupancy over the substances that have a k_tol
          if (rate > 0) sens = toleranceStep(sens, rate, 1);
        } else {
          sens = recoveryStep(sens, sys.recoveryDays);
          if (1 - sens < 1e-6) { sens = 1; p[`neu_expd_${sys.id}`] = 0; }
        }
        p[key] = clamp(sens, scaleR.sensLo, scaleR.sensHi);
        p[`neu_occ_${sys.id}`] = 0; p[`neu_tol_${sys.id}`] = 0;
      }
      p.neu_occ_s = 0; p.neu_day_index++;
    }

    // sleep: asleep when the caller says so or physiology's effective sleep hours grew; the hours awake count resets while asleep
    const slept = p.slept_effective_h ?? 0;
    const asleep = p.asleep !== undefined ? p.asleep === 1 : slept > (p.neu_slept_mark ?? 0) + 1e-12;
    p.neu_slept_mark = slept;
    p.hours_awake = asleep ? 0 : (p.hours_awake ?? 0) + dtH;

    // kinetics
    const conc: Record<string, number | null> = {}, occ: Record<string, number | null> = {};
    for (const s of substances) {
      const key = s.key, gut0 = p[`neu_gut_${key}`] ?? 0, cen0 = p[`neu_c_${key}`] ?? 0;
      if (gut0 > 0 || cen0 > 0) {
        const r = pkStep(s, { gutKg: gut0, centralKg: cen0 }, dtMin, b.mass, male, liver);
        p[`neu_gut_${key}`] = r.gutKg; p[`neu_c_${key}`] = r.centralKg;
        // Internal endpoints keep absorption out of the whole-body boundary ledger.
        if (r.absorbedKg > 0) w.trace.record({ t: w.t, process: "neurology", quantity: `mass:${sub(key)}`, from: `${body}:gut`, to: `${body}:central`, amount: r.absorbedKg, note: "gut to central" });
        if (r.eliminatedKg > 0) {
          w.trace.record({ t: w.t, process: "neurology", quantity: `mass:${sub(key)}`, from: body, to: "elimination", amount: r.eliminatedKg, note: "central to elimination (clearance)" });
        }
      }
      syncDrugContent(w, body, key);
      const central = p[`neu_c_${key}`] ?? 0;
      conc[key] = s.accumulates ? null : concentration(s, central, b.mass, male);
      const ec = params.ec50 && key in params.ec50 ? params.ec50[key] : s.ec50;
      occ[key] = conc[key] != null && ec != null ? occupancy(conc[key]!, ec) : null;
      if (s.accumulates) out[`burden_${key}`] = central;
      else if (conc[key] !== null) out[`conc_${key}`] = conc[key]!;
      out[`occupancy_${key}`] = occ[key];
    }

    // baseline drivers
    const met = Number(out.met ?? 0);
    if (met > baselineRules().exercise.overMet) p.neu_hard_t = w.t;
    const sinceHard = p.neu_hard_t === undefined || met > baselineRules().exercise.overMet ? null : (w.t - p.neu_hard_t) / 3600;
    if (p.fear_event === 1) p.neu_fear_day = dayIndex;
    if (p.praise === 1) p.neu_praise_day = dayIndex;
    const heatStrain = out.wbgt_c != null && out.wbgt_ceiling_c != null && Number(out.wbgt_c) > Number(out.wbgt_ceiling_c);
    const base = baselineMoves({
      hoursAwake: p.hours_awake, sleepDebtH: p.sleep_debt ?? Number(out.sleep_debt ?? 0), met, hoursSinceHardExercise: sinceHard, pain: p.pain, fearEvent: p.fear_event === 1,
      fearToday: p.neu_fear_day === dayIndex, hunger: p.hunger, starvationStage: p.starvation_stage, praiseToday: p.neu_praise_day === dayIndex,
      isolation: p.isolation === 1, fever: p.fever === 1, coreC: p.core_c ?? Number(out.core_c ?? 0), heatStrain, ageY: p.age_y,
    });

    // acute effect per system: potency x occupancy x sensitivity, summed over substances; the system's own occupancy (capped at 1)
    const effect: Record<string, number> = {}, sysOcc: Record<string, number> = {}, swing: Record<string, number> = {}, dep: Record<string, number> = {};
    let alcoholGaba = 0, depressants = 0;
    const tolRate: Record<string, number> = {};
    for (const sys of systems) {
      const sens = p[`neu_sens_${sys.id}`] ?? 1;
      effect[sys.id] = 0; sysOcc[sys.id] = 0; swing[sys.id] = 0;
      dep[sys.id] = dependence(sens, p[`neu_expd_${sys.id}`] ?? 0);
    }
    for (const s of substances) {
      const oc = occ[s.key];
      if (oc === null || oc === undefined) continue;
      let depressant = false;
      const kt = kTolOf(s);
      for (const h of s.hits) {
        if (h.delayed) continue;
        if (kt !== null) tolRate[h.system] = (tolRate[h.system] ?? 0) + kt * oc;
        const sens = p[`neu_sens_${h.system}`] ?? 1, e = h.potency * oc * sens;
        effect[h.system] = effect[h.system]! + e; sysOcc[h.system] = Math.min(1, sysOcc[h.system]! + oc);
        if (s.key === "alcohol" && h.system === "gaba") alcoholGaba += e;
        if ((h.system === "gaba" || h.system === "opioid") && h.potency > 0) depressant = true;
      }
      if (depressant && oc > synergyRule().occupancyOver) depressants++;
    }
    // withdrawal: the rebound of the adapted system without the drug, opposite to what the drug did
    for (const s of substances) {
      const peak = reboundPeak(s.key), last = p[`neu_dose_t_${s.key}`];
      if (peak === null || last === undefined || occ[s.key] == null) continue;
      const hours = (w.t - last) / 3600;
      for (const h of s.hits) {
        if (h.delayed) continue;
        const sysId = h.system, rec = neuroSystem(sysId).recoveryDays;
        swing[sysId] = swing[sysId]! - h.potency * dep[sysId]! * (1 - sysOcc[sysId]!) * rebound(hours, peak, rec);
      }
    }
    const tone: Record<string, number> = {};
    for (const sys of systems) {
      tone[sys.id] = clamp((1 + base.move[sys.id]! + effect[sys.id]! + swing[sys.id]!) * base.scale[sys.id]!, scaleR.toneLo, scaleR.toneHi);
      out[`tone_${sys.id}`] = tone[sys.id]!;
      out[`sensitivity_${sys.id}`] = p[`neu_sens_${sys.id}`] ?? 1;
      out[`dependence_${sys.id}`] = dep[sys.id]!;
      out[`withdrawal_${sys.id}`] = swing[sys.id]!;
      p[`neu_occ_${sys.id}`] = (p[`neu_occ_${sys.id}`] ?? 0) + sysOcc[sys.id]! * dt;
      p[`neu_tol_${sys.id}`] = (p[`neu_tol_${sys.id}`] ?? 0) + (tolRate[sys.id] ?? 0) * dt;
    }
    p.neu_occ_s = (p.neu_occ_s ?? 0) + dt;

    // circuits: each reads the summed tones once
    for (const ci of circuits) {
      let v: number;
      if (ci.id === "breathing-drive") {
        v = breathingDrive(Math.max(0, effect.opioid!), Math.max(0, effect.gaba!), Math.max(0, alcoholGaba), depressants);
      } else {
        v = circuitRead(ci, tone);
        if (ci.id === "attention") v += base.feverAttention;
        if (ci.form === "offset") v -= 1;
        if (ci.blockedOverAlcohol !== null && (conc.alcohol ?? 0) > ci.blockedOverAlcohol) v = ci.lo ?? 0;
        v = clamp(v, ci.id === "pain-gating" ? -Infinity : ci.lo ?? scaleR.toneLo, ci.hi ?? scaleR.toneHi);
      }
      out[ci.id] = v; out[`${ci.id}_row`] = ci.rowId;
    }

    // withdrawal stage of alcohol, from the hours since the last drink and the gaba dependence
    const lastDrink = p.neu_dose_t_alcohol;
    const hrs = lastDrink === undefined ? 0 : (w.t - lastDrink) / 3600, depG = dep.gaba!;
    out.alcohol_withdrawal_stage = lastDrink === undefined || depG <= 0 ? "none"
      : hrs >= c.delirium.loH && depG > c.delirium.dependenceOver ? "delirium" : hrs >= c.seizureLoH ? "seizure" : hrs >= c.onsetLoH ? "onset" : "none";
    out.fever_delirium = base.delirium ? 1 : 0;
    out.hours_awake = p.hours_awake;
  } };
}
