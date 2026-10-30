/**
 * Human energy, heat, sleep and water as one engine process on a `body` component (kind "body", `props`). Every table
 * number comes from `data/library/physiology.json` through library.ts; the formulas are Mifflin-St Jeor (physiology.ts,
 * PHY-MSJ), the MET cost (physics.ts metabolicHeat, PHY-MET) and the drift rule of PHYSIOLOGY.md section 4. What the docs
 * ask for and the library cannot support is listed in FLAGS.md and left disabled here.
 *
 * Inputs on `body.props` (all optional): height_cm, age_y, male (1 or 0) for the resting rate; acclimatisation (0 to 1,
 * default 1: the table's ceilings are the acclimatised ones); core_c (default: the recovery table's resting core);
 * sheltered (1 default; 0 for a wet cold night); work_w (external work, W); intake_kcal (food energy eaten); area_m2 (else
 * DuBois from height_cm) and h (else ISO 7730's convection and radiation). On the room: rh (atmosphere's) and air_speed_ms (0).
 * Outputs by library id on `body.props.outputs` (read them with `bodyOutputs`): alertness, sleep_debt, circadian,
 * core_c, core_state, work_capacity_heat, water_deficit_pct, hydration_state, endurance_hydration, work_capacity_hydration,
 * energy_balance_kcal, metabolic_w,
 * pal, rmr_kcal, rmr_label, sweat_l_per_h, breath_water_l_per_h, skin_diffusion_l_per_h, urine_l_per_h, wbgt_c, wbgt_ceiling_c,
 * acclimatisation, fatigue_met_hours, and the matching `*_row` ids. A water deficit in a band whose row says work stops
 * ("incapacitated") or death opens a crisis record for that row (crisis.ts); the engine kills no one.
 */
import type { Process } from "./scheduler.ts";
import { addHeat, type World } from "./world.ts";
import type { Component } from "./registry.ts";
import { C_TO_K, KCAL_J, M, O2_ENERGY_J_PER_L, P_SEA_LEVEL, SWEAT_LATENT, heatFlow, metabolicHeat, molesInVolume, waterVapourPressure } from "./physics.ts";
import { libraryMeta, libraryRow, libraryTable, type LibraryRow } from "./library.ts";
import { accumulateExposure } from "./atmosphere.ts";
import { trackCrisis } from "./crisis.ts";
import { bodyMassDelta } from "./nutrition.ts";

export type BodyOutputs = Record<string, number | string | null>;

/** The outputs record of a body, created on first use. It lives at `props.outputs` (props is typed numbers only). */
export function bodyOutputs(body: Component): BodyOutputs {
  const p = body.props as unknown as { outputs?: BodyOutputs };
  return (p.outputs ??= {});
}

/**
 * Heat exchange of the skin and the breath, ISO 7730:2005 section 4 (Fanger 1970, the PMV heat balance), per m2
 * of skin with M - W in W/m2 and the vapour pressure pa in Pa: skin temperature in comfort 35.7 - 0.028 (M - W); skin
 * diffusion 3.05e-3 (5733 - 6.99 (M - W) - pa); respiratory latent 1.7e-5 M (5867 - pa) and dry 0.0014 M (34 - ta);
 * radiation 3.96e-8 fcl (Tcl^4 - Tr^4) with fcl 1 (no clothing) and the mean radiant temperature taken as the air's;
 * convection hc = max(2.38 |tcl - ta|^0.25, 12.1 sqrt(v)). The Lewis relation, 16.5 K/kPa, is ASHRAE Handbook Fundamentals
 * ch. 9 (Thermal Comfort). Body surface area is DuBois and DuBois 1916 (Arch Intern Med 17:863), 0.007184 W^0.425 H^0.725
 * (W kg, H cm). None is a library row yet and none was re-opened in session 2540 (web access denied): FLAGS.md, physiology.
 */
const PMV = { skinC: 35.7, skinPerW: 0.028, diff: 3.05e-3, diffPa: 5733, diffPerW: 6.99, resLatent: 1.7e-5, resPa: 5867,
  resDry: 0.0014, resC: 34, rad: 3.96e-8, hcFree: 2.38, hcForced: 12.1, lewisKPerKPa: 16.5 } as const;
const DUBOIS = { k: 0.007184, mass: 0.425, height: 0.725 } as const;

/**
 * Urine, Guyton and Hall, Textbook of Medical Physiology, ch. 29 (the library's ANA-ORG reference): a 70 kg adult excretes about 600 mOsm of
 * solute a day; the kidney concentrates urine to at most 1,200 mOsm/L (the obligatory volume, 600/1200 = 0.5 L/day) and
 * dilutes it to as little as 50 mOsm/L (600/50 = 12 L/day at most). Urine is taken as 1 kg/L.
 */
const URINE = { soluteMosmDay: 600, maxMosmL: 1200, minMosmL: 50 } as const;

/** Body surface area, m2: the host's `area_m2`, else DuBois from height and mass; null when neither is known. */
export function bodyArea(body: Component): number | null {
  if (body.props.area_m2 !== undefined) return body.props.area_m2;
  const h = body.props.height_cm;
  return h === undefined ? null : DUBOIS.k * Math.pow(body.mass, DUBOIS.mass) * Math.pow(h, DUBOIS.height);
}

/** Dry (convective plus radiant) heat flow from skin at `skinC` to air at `airC`, W: the host's `h` if it gives one, else ISO 7730. */
function dryHeatW(body: Component, area: number, skinC: number, airC: number, windMS: number): number {
  if (body.props.h !== undefined) return heatFlow(body.props.h, area, skinC - airC);
  const k = (c: number) => c + C_TO_K;
  return area * (PMV.rad * (k(skinC) ** 4 - k(airC) ** 4) + convectionH(skinC, airC, windMS) * (skinC - airC));
}

function convectionH(skinC: number, airC: number, windMS: number): number {
  return Math.max(PMV.hcFree * Math.abs(skinC - airC) ** 0.25, PMV.hcForced * Math.sqrt(windMS));
}

interface Band { lo: number; hi: number; row: LibraryRow }

/** "0 to 4", "over 40", ">= 40.0", "< 32.0" as the half-open interval [lo, hi). */
function parseBand(label: string): { lo: number; hi: number } {
  let m = /^(?:>=|over)\s*(-?[\d.]+)$/.exec(label);
  if (m) return { lo: Number(m[1]), hi: Infinity };
  m = /^(?:<|under)\s*(-?[\d.]+)$/.exec(label);
  if (m) return { lo: -Infinity, hi: Number(m[1]) };
  m = /^(-?[\d.]+) to (-?[\d.]+)$/.exec(label);
  if (m) return { lo: Number(m[1]), hi: Number(m[2]) };
  throw new Error(`physiology: cannot read the band "${label}"`);
}

function bandsOf(table: string, column: string): Band[] {
  return libraryTable("physiology", table).map(row => ({ ...parseBand(String(row[column])), row }));
}

function bandAt(bands: Band[], v: number): Band {
  return bands.find(b => v >= b.lo && v < b.hi) ?? (v < bands[0]!.lo ? bands[0]! : bands[bands.length - 1]!);
}

interface WbgtClass { lo: number; loIncl: boolean; hi: number; hiIncl: boolean; ceilingC: number; unacclimatisedC: number; driftCPerHPerC: number; row: LibraryRow }

interface Tables {
  met: Map<string, number>;
  sleepDebt: Band[]; circadian: Band[]; core: Band[]; hydration: Band[]; wbgt: WbgtClass[];
  palMin: number; palMax: number;
  needH: number; splitQuality: number; fatigueResetH: number; restCoreC: number;
  heatGainDays: number; heatLossDays: number;
  sweatMaxLph: number; rq: number;
}

let tables: Tables | null = null;

function num(text: string, re: RegExp, what: string, group = 1): number {
  const m = re.exec(text);
  if (!m) throw new Error(`physiology: the library text for ${what} no longer reads ${re}`);
  return Number(m[group]);
}

function lib(): Tables {
  if (tables) return tables;
  const met = new Map(libraryTable("physiology", "met").map(r => [String(r.id), Number(r.MET)]));
  const recovery = new Map(libraryTable("physiology", "recovery").map(r => [String(r.id), String(r["Overnight rule"])]));
  const rec = (id: string) => recovery.get(`physiology.recovery.${id}`) ?? "";
  const sleepRule = rec("sleep-debt"), fatigueRule = rec("whole-body-fatigue-the-days-met-hours");
  const heat = libraryTable("physiology", "acclimatisation").find(r => r.id === "physiology.acclimatisation.heat-acclimatisation")!;
  const pals = libraryTable("physiology", "pal").map(r => Number(r.PAL));
  const hours = (s: string) => { const [h, m] = s.split(":").map(Number); return h! + m! / 60; };
  const circadian = libraryTable("physiology", "circadian").map(row => {
    const m = /^(\d\d:\d\d) to (\d\d:\d\d)$/.exec(String(row["Ship's time"]));
    if (!m) throw new Error(`physiology: cannot read the time band "${String(row["Ship's time"])}"`);
    return { lo: hours(m[1]!), hi: hours(m[2]!), row };
  });
  const wbgt = libraryTable("physiology", "wbgt_limits").map((row): WbgtClass => {
    const label = String(row["Work class (MET)"]);
    let lo = -Infinity, hi = Infinity, loIncl = false, hiIncl = false;
    let m = /\(under ([\d.]+)\)/.exec(label);
    if (m) hi = Number(m[1]);
    else if ((m = /\(over ([\d.]+)\)/.exec(label))) lo = Number(m[1]);
    else if ((m = /\(([\d.]+) to ([\d.]+)\)/.exec(label))) { lo = Number(m[1]); hi = Number(m[2]); loIncl = hiIncl = true; }
    else throw new Error(`physiology: cannot read the work class "${label}"`);
    return { lo, loIncl, hi, hiIncl, ceilingC: Number(row["WBGT ceiling, acclimatised (C)"]), unacclimatisedC: Number(row["Unacclimatised (C)"]),
      driftCPerHPerC: Number(row["Model: core drift above ceiling (C per hour per C over)"]), row };
  });
  tables = {
    met,
    sleepDebt: bandsOf("sleep_debt", "Cumulative debt (hours below 8 h)"),
    circadian, core: bandsOf("core_temp", "Core (C)"), hydration: bandsOf("hydration", "Deficit (% body mass)"), wbgt,
    palMin: Math.min(...pals), palMax: Math.max(...pals),
    needH: num(sleepRule, /debt \+= max\(0, ([\d.]+) - hours slept\)/, "the sleep need"),
    splitQuality: num(sleepRule, /counts ([\d.]+) of its hours/, "the split-sleep quality"),
    fatigueResetH: num(fatigueRule, /after ([\d.]+)\+ hours/, "the fatigue reset"),
    restCoreC: num(rec("core-temperature"), /returns to ([\d.]+) if sheltered/, "the resting core"),
    heatGainDays: num(String(heat["Time to gain"]), /([\d.]+) to ([\d.]+) days/, "the heat gain clock", 2),
    heatLossDays: num(String(heat["Time to lose"]), /about ([\d.]+) days/, "the heat loss clock"),
    // the hydration table's source (PHY-HYD): "sweat rates 0.5 to over 2.5 L/h in heat"; the core_temp row's "sweat rate at max"
    sweatMaxLph: num(libraryMeta("physiology", "hydration").source, /sweat rates [\d.]+ to over ([\d.]+) L\/h/, "the maximum sweat rate"),
    rq: num(String(libraryRow("gasdynamics", "box_model", "gasdynamics.box_model.oxygen-and-carbon-dioxide-move-together").Formula), /produced \/ ([\d.]+)/, "the respiratory quotient"),
  };
  return tables;
}

/** MET of a library activity: a full id (`physiology.met.smithing`), its slug (`smithing`), or a number as given. */
export function metOf(activity: number | string): number {
  if (typeof activity === "number") return activity;
  const t = lib().met, v = t.get(activity) ?? t.get(`physiology.met.${activity}`);
  if (v === undefined) throw new Error(`physiology: no MET row ${activity}`);
  return v;
}

/** The work class (light, moderate, heavy) of a MET: its WBGT ceilings and core drift rate. */
export function wbgtClass(met: number) {
  const c = lib().wbgt.find(x => (met > x.lo || (x.loIncl && met === x.lo)) && (met < x.hi || (x.hiIncl && met === x.hi)));
  if (!c) throw new Error(`physiology: no work class for MET ${met}`);
  return c;
}

/** The WBGT ceiling for continuous work at this MET, between the unacclimatised (0) and acclimatised (1) columns. */
export function wbgtCeiling(met: number, acclimatisation: number): number {
  const c = wbgtClass(met);
  return c.unacclimatisedC + acclimatisation * (c.ceilingC - c.unacclimatisedC);
}

/** Sleep debt (hours below need) to the table row and its alertness multiplier. */
export function sleepDebtRow(debtH: number) { const b = bandAt(lib().sleepDebt, debtH); return { row: b.row, multiplier: Number(b.row["Alertness multiplier"]) }; }

/** Clock hour (0 to 24) to the circadian row and factor; a band such as 22:00 to 02:00 wraps midnight. */
export function circadianRow(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const b = lib().circadian.find(x => (x.lo <= x.hi ? h >= x.lo && h < x.hi : h >= x.lo || h < x.hi));
  if (!b) throw new Error(`physiology: no circadian band for ${h} h`);
  return { row: b.row, factor: Number(b.row.Factor) };
}

/** Core temperature to its state row; `workCapacity` is the row's "work capacity xN" (1 for normal, null where the text gives none). */
export function coreRow(coreC: number) {
  const row = bandAt(lib().core, coreC).row, effect = String(row["What the sim does"]);
  const m = /work capacity x([\d.]+)/.exec(effect);
  return { row, state: String(row.State), effect, workCapacity: m ? Number(m[1]) : effect === "none" ? 1 : null, sweatAtMax: effect.includes("sweat rate at max") };
}

/** The hydration rows whose effect says work stops ("incapacitated") or death: where a water deficit opens a crisis. */
const HYDRATION_STOPS = /incapacitated|death/;
export const hydrationCrisisRows = () => lib().hydration.filter(b => HYDRATION_STOPS.test(String(b.row["Effect in the model"])));

/** Water deficit (% of body mass) to its row; `endurance` is the Endurance factor (the in-heat one when hot), null where the text gives none;
 * `workCapacity` is 1 where the row says none, 0 where it says work stops or death, null where it gives no work figure. */
export function hydrationRow(deficitPct: number, hot: boolean) {
  const row = bandAt(lib().hydration, deficitPct).row, effect = String(row["Effect in the model"]);
  const m = /Endurance(?: pool)? x([\d.]+)(?: \(x([\d.]+) in heat\))?/.exec(effect);
  const endurance = m ? Number(hot && m[2] ? m[2] : m[1]) : effect === "none" ? 1 : null;
  return { row, effect, endurance, workCapacity: effect === "none" ? 1 : HYDRATION_STOPS.test(effect) ? 0 : null };
}

/**
 * The overnight tick for sleep and fatigue (recovery table): debt += max(0, need - slept) - max(0, slept - need), floored at 0;
 * fatigue resets after the table's hours, else carries (need - slept)/need of itself. `slept` is already quality-weighted.
 */
export function overnight(debtH: number, fatigueMetH: number, sleptH: number) {
  const { needH, fatigueResetH } = lib();
  return {
    debtH: Math.max(0, debtH + Math.max(0, needH - sleptH) - Math.max(0, sleptH - needH)),
    fatigueMetH: sleptH >= fatigueResetH ? 0 : fatigueMetH * (needH - sleptH) / needH,
  };
}

/** The recovery table's weight of a split (watch) night's hours. */
export function splitSleepQuality(): number { return lib().splitQuality; }

/** The PAL bands' lowest and highest value (FAO 2004 as the library has them). */
export function palRange() { return { min: lib().palMin, max: lib().palMax }; }

/** Resting rate in kcal/day, selected by anatomy.species.rmr-formula (human column by default).
 * Mifflin-St Jeor 1990 (PHY-MSJ): null when height, age or sex is missing.
 * Power-law coefficients come from the species cell, including the Kleiber horse example.
 * Explicit host overrides require an estimate or fiction label.
 */
export interface RmrOverride { kcalDay: number; label: "estimate" | "fiction" }

export function restingMetabolicRate(body: Pick<Component, "mass" | "props">, rmrFormula?: string, rmrOverride?: RmrOverride): number | null {
  if (rmrOverride !== undefined) {
    if (rmrOverride.label !== "estimate" && rmrOverride.label !== "fiction")
      throw new Error("physiology: rmr_override_label must be estimate or fiction");
    return rmrOverride.kcalDay;
  }
  const formula = rmrFormula ?? String(libraryRow("anatomy", "species", "anatomy.species.rmr-formula")["Human default"]);
  if (formula === "Mifflin-St Jeor (PHYSIOLOGY)") {
    const { height_cm: h, age_y: a, male } = body.props;
    if (h === undefined || a === undefined || male === undefined) return null;
    return 10 * body.mass + 6.25 * h - 5 * a + (male === 1 ? 5 : -161);
  }
  const power = /^(?:Kleiber's law )?(\d+(?:\.\d+)?) x kg\^(\d+(?:\.\d+)?)$/.exec(formula);
  if (power) return Number(power[1]) * Math.pow(body.mass, Number(power[2]));
  throw new Error(`physiology: unsupported RMR formula "${formula}"`);
}

/** Metabolic power owned by physiology; an explicit resting rate carries species/host selection. */
export function metabolicRateW(met: number, body: Pick<Component, "mass" | "props">,
  rmr: number | null = restingMetabolicRate(body)): number {
  const scale = rmr === null ? 1 : rmr * KCAL_J / 86400 / metabolicHeat(1, body.mass);
  return metabolicHeat(met, body.mass) * scale;
}

/** Oxygen demand in L/min for metabolic power in W (J/s). */
export function oxygenLitresPerMin(metabolicW: number): number {
  return metabolicW * 60 / O2_ENERGY_J_PER_L;
}

export interface ScheduleEntry {
  fromH: number; toH: number;          // clock hours; toH <= fromH wraps midnight
  activity: number | string;           // a MET or a library MET row (id or slug)
  sleepQuality?: number;               // present: asleep; hours count at this weight toward the night
}

export interface PhysiologyOptions {
  rmrFormula?: string;                 // species RMR-formula cell; defaults to the human column
  rmrOverride?: RmrOverride;           // host-set resting rate, labelled estimate or fiction
  met?: number;                        // constant MET when there is no schedule (or no window matches)
  schedule?: ScheduleEntry[];          // first matching window wins
  every?: number;                      // run every N fast steps (default 10)
  clockH0?: number;                    // clock hour at world time 0 (default 0)
  dayStartH?: number;                  // the hour the day's books close (default 12: the nautical day)
}

/** Establish the reference once, before even a pre-step meal. Initial water is already part of body mass. */
function initialiseBodyWater(w: World, b: Component) {
  if (b.props.water_start_kg !== undefined) return;
  if (!b.contents.some(x => x.substance === "water")) {
    const id = `physiology.body_water.total-body-water-fraction-${b.props.male === 0 ? "women" : "men"}`;
    const fraction = libraryRow("physiology", "body_water", id).Value;
    if (typeof fraction !== "number" || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) throw new Error(`physiology: missing valid numeric row ${id}`);
    const kg = fraction * b.mass;
    w.registry.addContent(b, "water", "liquid", kg);
    w.trace.record({ t: w.t, process: "realism.physiology.water_balance", quantity: "mass:water", from: "initial-body-water", to: b.id, amount: kg, note: "initial water already included in body mass" });
  }
  b.props.water_start_kg = w.registry.contentMass(b, "water");
  b.props.water_start_mass_kg = b.mass;
}

/** Derived views only: the fixed reference mass keeps deficit in % of starting body mass. */
function deriveBodyWater(w: World, b: Component) {
  b.props.waterDeficitKg = b.props.water_start_kg - w.registry.contentMass(b, "water");
  b.props.waterDeficitPct = b.props.waterDeficitKg / b.props.water_start_mass_kg * 100;
  bodyOutputs(b).water_deficit_pct = b.props.waterDeficitPct;
}

/** Physiology owns registry water; every actual transfer also changes body mass immediately.
 * `other` names an external source/sink; default is the caller's process (e.g. glycogen storage).
 */
export function addBodyWater(w: World, body: string, kg: number, process: string, note: string, other = process) {
  const b = w.registry.component(body);
  if (b.kind !== "body" || !Number.isFinite(kg) || !Number.isFinite(b.mass) || b.mass <= 0 || b.mass + kg < 0)
    throw new Error("physiology: invalid body water delta");
  initialiseBodyWater(w, b);
  if (w.registry.contentMass(b, "water", "liquid") + kg < -1e-12) throw new Error("physiology: body water overdraw");
  w.registry.addContent(b, "water", "liquid", kg);
  bodyMassDelta(w, body, kg, process, note);
  w.trace.record({ t: w.t, process, quantity: "mass:water", from: kg >= 0 ? other : body, to: kg >= 0 ? body : other, amount: Math.abs(kg), note });
  deriveBodyWater(w, b);
}

/** Eat or drink in kind: water enters the single content ledger, energy enters its intake counter. */
export function ingest(w: World, body: string, food: { kcal?: number; waterKg?: number }, process = "ingest") {
  const b = w.registry.component(body);
  if (food.kcal) {
    b.props.intake_kcal = (b.props.intake_kcal ?? 0) + food.kcal;
    w.trace.record({ t: w.t, process, quantity: "energy:chemical", from: "food", to: body, amount: food.kcal * KCAL_J });
  }
  if (food.waterKg) {
    addBodyWater(w, body, food.waterKg, process, "intake", "intake");
  }
}

/** Close the day: sleep and fatigue by the overnight table, the core back to rest if sheltered, acclimatisation, the day's PAL. */
function closeDay(b: Component, rmr: number | null) {
  const p = b.props, t = lib();
  const n = overnight(p.sleep_debt ?? 0, p.fatigue_met_hours ?? 0, p.slept_effective_h ?? 0);
  p.sleep_debt = n.debtH; p.fatigue_met_hours = n.fatigueMetH; p.slept_effective_h = 0;
  if ((p.sheltered ?? 1) === 1) p.core_c = t.restCoreC;
  const gain = p.heat_day === 1;
  p.acclimatisation = Math.min(1, Math.max(0, (p.acclimatisation ?? 1) + (gain ? 1 / t.heatGainDays : -1 / t.heatLossDays)));
  p.heat_day = 0;
  p.days_closed = (p.days_closed ?? 0) + 1;
  p.pal_last = rmr ? (p.day_expenditure_kcal ?? 0) / rmr : 0;
  p.day_expenditure_kcal = 0;
}

export function physiologyProcess(body: string, room: string, o: PhysiologyOptions = {}): Process {
  const clockH0 = o.clockH0 ?? 0, dayStartH = o.dayStartH ?? 12;
  const schedule = (o.schedule ?? []).map(e => ({ ...e, met: metOf(e.activity) }));
  const activityAt = (hour: number) => {
    for (const e of schedule) {
      const inside = e.fromH < e.toH ? hour >= e.fromH && hour < e.toH : hour >= e.fromH || hour < e.toH;
      if (inside) return { met: e.met, quality: e.sleepQuality ?? null };
    }
    if (o.met === undefined) throw new Error(`physiology: no activity at ${hour} h and no default MET`);
    return { met: o.met, quality: null };
  };
  return { name: "body", every: o.every ?? 10, step(w, dt) {
    const b = w.registry.component(body), r = w.registry.component(room), reg = w.registry, p = b.props, t = lib();
    initialiseBodyWater(w, b); deriveBodyWater(w, b);
    const dtH = dt / 3600;
    const clock = clockH0 + w.t / 3600, hour = ((clock % 24) + 24) % 24;
    p.core_c ??= t.restCoreC;
    p.acclimatisation ??= 1;
    const rmr = restingMetabolicRate(b, o.rmrFormula, o.rmrOverride);
    const dayIndex = Math.floor((clock - dayStartH) / 24);
    if (p.day_index === undefined) p.day_index = dayIndex;


    const act = activityAt(hour), met = act.met;
    // energy: the MET cost, corrected to this body's resting rate when it has one (PHYSIOLOGY.md section 4); heat is M - W
    const mWatt = metabolicRateW(met, b, rmr);
    const workWatt = Math.min(p.work_w ?? 0, mWatt);
    const heatWatt = mWatt - workWatt;
    const spent = mWatt * dt;
    w.trace.record({ t: w.t, process: "body", quantity: "energy:chemical", from: body, to: "metabolism", amount: spent });
    addHeat(w, b, heatWatt * dt);
    w.trace.record({ t: w.t, process: "body", quantity: "energy", from: "metabolism", to: body, amount: heatWatt * dt });
    if (workWatt > 0) w.trace.record({ t: w.t, process: "body", quantity: "energy", from: "metabolism", to: "work", amount: workWatt * dt, note: "external work" });
    p.expenditure_kcal = (p.expenditure_kcal ?? 0) + spent / KCAL_J;
    p.day_expenditure_kcal = (p.day_expenditure_kcal ?? 0) + spent / KCAL_J;
    p.fatigue_met_hours = (p.fatigue_met_hours ?? 0) + met * dtH;
    if (act.quality !== null) p.slept_effective_h = (p.slept_effective_h ?? 0) + dtH * act.quality;

    // the air: temperature, vapour pressure (the room's rh, which atmosphere keeps; a room without one is dry air) and air speed
    const area = bodyArea(b);
    if (area === null) throw new Error(`physiology: ${body} has neither area_m2 nor height_cm for its skin area`);
    const airC = r.temperatureC, paPa = (r.props.rh ?? 0) * waterVapourPressure(airC), windMS = r.props.air_speed_ms ?? 0;

    // heat stress: WBGT against the work class's ceiling, core drift above it (WBGT is the room's dry temperature unless it carries wbgt_c)
    const wbgt = r.props.wbgt_c ?? r.temperatureC;
    const ceiling = wbgtCeiling(met, p.acclimatisation);
    const over = Math.max(0, wbgt - ceiling);
    if (act.quality === null && wbgt > wbgtCeiling(met, 0)) p.heat_day = 1;
    p.core_c += over * wbgtClass(met).driftCPerHPerC * dtH;

    // ISO 7730 heat balance (PMV): the breath's dry and latent heat, the skin's diffusion, and the sweat the balance requires at
    // the comfort skin temperature (ISO 7933's required evaporation, Ereq = M - W - Cres - Eres - C - R), at most the library's
    // maximum, which the core_temp row's "sweat rate at max" takes; evaporation is capped by the Lewis relation, the rest drips
    const netWm2 = heatWatt / area, skinC = PMV.skinC - PMV.skinPerW * netWm2;
    const resDryW = PMV.resDry * mWatt * (PMV.resC - airC);
    const resLatentW = Math.max(0, PMV.resLatent * mWatt * (PMV.resPa - paPa));
    const diffW = Math.max(0, PMV.diff * area * (PMV.diffPa - PMV.diffPerW * netWm2 - paPa));
    const requiredW = heatWatt - resDryW - resLatentW - dryHeatW(b, area, skinC, airC, windMS);
    const evapMaxW = PMV.lewisKPerKPa * convectionH(skinC, airC, windMS) * area * Math.max(0, waterVapourPressure(skinC) - paPa) / 1000;
    const hotCore = coreRow(p.core_c).sweatAtMax;
    const sweatW = hotCore ? t.sweatMaxLph / 3600 * SWEAT_LATENT : Math.min(t.sweatMaxLph / 3600 * SWEAT_LATENT, Math.max(0, requiredW - diffW));
    let breathKg = resLatentW * dt / SWEAT_LATENT;
    let diffKg = Math.min(diffW, evapMaxW) * dt / SWEAT_LATENT;
    let sweatKg = sweatW * dt / SWEAT_LATENT;
    let evapSweatKg = Math.min(sweatKg, Math.max(0, evapMaxW * dt / SWEAT_LATENT - diffKg));
    // metabolic water: oxidising glucose (6 O2 -> 6 CO2 + 6 H2O) or a fatty acid (palmitic, 23 O2 -> 16 CO2 + 16 H2O) gives one
    // H2O per CO2, so water = RQ x O2, with the O2 of the MET cost (STPD litres at physics.ts's energy per litre) and the
    // library's RQ (gasdynamics box_model); protein's share (its nitrogen leaves as urea) is not separated
    const metabolicKg = t.rq * molesInVolume(P_SEA_LEVEL, mWatt / O2_ENERGY_J_PER_L / 1000, C_TO_K) * M.H2O * dt;
    // urine: the kidney passes the surplus over the body's starting water, between the obligatory and the most dilute volume
    const urineDay = (osm: number) => URINE.soluteMosmDay / osm / 86400 * dt;
    let urineKg = Math.min(urineDay(URINE.minMosmL), Math.max(urineDay(URINE.maxMosmL), metabolicKg - (p.waterDeficitKg ?? 0) - breathKg - diffKg - sweatKg));
    // Apply the water transfers after the heat calculation, so its interval uses one thermal capacity.
    const availableKg = reg.contentMass(b, "water", "liquid") + metabolicKg;
    const outKg = breathKg + diffKg + sweatKg + urineKg;
    if (outKg > availableKg) {
      const s = availableKg / outKg;
      breathKg *= s; diffKg *= s; sweatKg *= s; evapSweatKg *= s; urineKg *= s;
    }
    const dripKg = sweatKg - evapSweatKg;
    const sweatLph = sweatKg * 3600 / dt;
    const dryJ = dryHeatW(b, area, b.temperatureC, airC, windMS) * dt, resDryJ = resDryW * dt;
    const skinLatentJ = (diffKg + evapSweatKg) * SWEAT_LATENT, breathLatentJ = breathKg * SWEAT_LATENT;
    addHeat(w, b, -(dryJ + resDryJ + skinLatentJ + breathLatentJ)); addHeat(w, r, dryJ + resDryJ);
    w.trace.record({ t: w.t, process: "body", quantity: "energy", from: body, to: room, amount: dryJ, note: "skin convection and radiation" });
    w.trace.record({ t: w.t, process: "body", quantity: "energy", from: body, to: room, amount: resDryJ, note: "breath, dry" });
    w.trace.record({ t: w.t, process: "body", quantity: "energy", from: body, to: "sweat-latent", amount: skinLatentJ });
    w.trace.record({ t: w.t, process: "body", quantity: "energy", from: body, to: "breath-latent", amount: breathLatentJ });
    p.sweat_kg = (p.sweat_kg ?? 0) + sweatKg;
    p.urine_kg = (p.urine_kg ?? 0) + urineKg;
    reg.addContent(r, "water", "gas", breathKg + diffKg + evapSweatKg);
    const waterProcess = "realism.physiology.water_balance";
    addBodyWater(w, body, metabolicKg, waterProcess, "metabolic water", "oxidation");
    addBodyWater(w, body, -evapSweatKg, waterProcess, "sweat", room);
    if (dripKg > 0) addBodyWater(w, body, -dripKg, waterProcess, "sweat", "drip");
    addBodyWater(w, body, -diffKg, waterProcess, "skin diffusion", room);
    addBodyWater(w, body, -breathKg, waterProcess, "breath", room);
    addBodyWater(w, body, -urineKg, waterProcess, "urine", "urine");

    // exposure
    accumulateExposure(b, r, dt);

    // Close after the final interval, so downstream nutrition sees exactly this day's totals.
    const endDayIndex = Math.floor((clockH0 + (w.t + dt) / 3600 - dayStartH) / 24);
    while (p.day_index < endDayIndex) { closeDay(b, rmr); p.day_index++; }

    // outputs by library id
    const out = bodyOutputs(b), debt = sleepDebtRow(p.sleep_debt ?? 0), circ = circadianRow(hour), core = coreRow(p.core_c);
    const hyd = hydrationRow(p.waterDeficitPct, over > 0);
    p.intake_kcal ??= 0;
    out.met = met;
    out.metabolic_w = mWatt;
    out.rmr_kcal = rmr;
    out.rmr_label = o.rmrOverride !== undefined ? o.rmrOverride.label : rmr === null ? null : "researched";
    out.energy_balance_kcal = p.intake_kcal - p.expenditure_kcal;
    out.energy_expenditure_kcal = p.expenditure_kcal;
    out.day_expenditure_kcal = p.day_expenditure_kcal;
    out.pal = rmr !== null && (p.days_closed ?? 0) > 0 ? p.pal_last : null;
    out.sleep_debt = p.sleep_debt ?? 0; out.sleep_debt_row = String(debt.row.id);
    out.circadian = circ.factor; out.circadian_row = String(circ.row.id);
    out.alertness = debt.multiplier * circ.factor;
    out.fatigue_met_hours = p.fatigue_met_hours;
    out.wbgt_c = wbgt; out.wbgt_ceiling_c = ceiling; out.wbgt_row = String(wbgtClass(met).row.id);
    out.acclimatisation = p.acclimatisation;
    out.core_c = p.core_c; out.core_state = core.state; out.core_row = String(core.row.id); out.work_capacity_heat = core.workCapacity;
    out.sweat_l_per_h = sweatLph;
    out.breath_water_l_per_h = breathKg * 3600 / dt; out.skin_diffusion_l_per_h = diffKg * 3600 / dt; out.urine_l_per_h = urineKg * 3600 / dt;
    out.water_deficit_pct = p.waterDeficitPct; out.hydration_state = hyd.effect; out.hydration_row = String(hyd.row.id); out.endurance_hydration = hyd.endurance;
    out.work_capacity_hydration = hyd.workCapacity;
    for (const band of hydrationCrisisRows()) trackCrisis(w, b.id, String(band.row.id), p.waterDeficitPct >= band.lo,
      { source: `${band.row.id}: ${String(band.row["Effect in the model"])} (deficit ${String(band.row["Deficit (% body mass)"])}% of body mass)` });
  } };
}
