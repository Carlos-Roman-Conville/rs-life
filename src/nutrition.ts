/**
 * Nutrient pools, absorption, deficiency stages and body composition on a `body` component (kind "body", `props`). Every
 * number is read from `data/library/nutrition.json` through library.ts (the `nutrients`, `foods`, `foods_more`, `absorption`,
 * `depletion` and `body_composition` tables); the rule texts are parsed, so a changed table changes the model. What the docs
 * ask for and the library cannot support is listed in FLAGS.md and left disabled here.
 *
 * Each nutrient with a reserve in the depletion table is a pool: a content of the body (substance `nutrient:<id>`, kg), filled
 * by `eat` (intake times the absorption fraction, added to the pool) and drained once a day, after which the pool is capped at its full level and the rest traced to "excreta"
 * by the table's daily use. `stockPools` fills the pools; call it before `World.conserve("nutrient:vit_c", ["body"])`.
 *
 * Inputs on `body.props` (all optional): male (1 default, 0 for the woman's columns), fat_kg (the fat store; without it the
 * energy balance has nowhere to go and is reported as unplaced), glycogen_g (default: the full reserve), fever, pregnant,
 * menstrual, diarrhoea, rum_heavy, flux, chronic_flux (1 while the condition lasts), blood_lost_l (cumulative litres).
 * Outputs by library id on `body.props.outputs` (`bodyOutputs`): pool_<id>, pool_frac_<id>, deficiency_<id> (stage 0 to 3) and
 * deficiency_<id>_row for every pool; fat_kg, glycogen_g, glycogen_factor, glycogen_bound_water_kg, water_change_kg (the day's change of the water ledger), energy_balance_day_kcal, energy_unplaced_kcal,
 * starvation_limit, protein_need_g, intake_<id> (last closed day, in the food column's unit).
 */
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { trackCrisis } from "./crisis.ts";
import type { Component } from "./registry.ts";
import { KCAL_J } from "./physics.ts";
import { libraryRow, libraryTable, type LibraryRow } from "./library.ts";
import { setBodyGlycogen, bodyOutputs, ingest } from "./physiology.ts";

const UNIT_KG = { g: 1e-3, mg: 1e-6, mcg: 1e-9 } as const;
type Unit = keyof typeof UNIT_KG;

const num = (s: string) => Number(s.replace(/,/g, ""));
function grab(text: string, rx: RegExp, what: string, group = 1): number {
  const m = rx.exec(text);
  if (!m) throw new Error(`nutrition: the library text for ${what} no longer reads ${rx}`);
  return num(m[group]!);
}
/** "1,500 mg (...)" to kg and its unit, or null when the text gives no amount ("small", "fat stores", "-"). */
function qty(text: string): { kg: number; unit: Unit } | null {
  const m = /^([\d,.]+)\s*(mcg|mg|g)\b/.exec(text.trim());
  return m ? { kg: num(m[1]!) * UNIT_KG[m[2] as Unit], unit: m[2] as Unit } : null;
}

// ---------------------------------------------------------------------------------------------------------------- nutrients

export interface NutrientInfo {
  id: string; name: string; unit: string; row: LibraryRow;
  needMan: number | null; needWoman: number | null; perKg: boolean;   // the leading number of the need text; perKg when it is per kg of body
  daysToSignsLo: number | null; daysToSignsHi: number | null;          // with zero intake, from the table
}

let nutrientMap: Map<string, NutrientInfo> | null = null;
function nutrients(): Map<string, NutrientInfo> {
  if (nutrientMap) return nutrientMap;
  nutrientMap = new Map();
  for (const row of libraryTable("nutrition", "nutrients")) {
    const lead = (t: unknown) => { const m = /^([\d,.]+)/.exec(String(t)); return m ? num(m[1]!) : null; };
    const man = String(row["Daily need (man)"]);
    const days = /^(\d+)(?: to (\d+))?/.exec(String(row["Days to deficiency signs with zero intake"]));
    nutrientMap.set(String(row.id), {
      id: String(row.id), name: String(row.Nutrient), unit: String(row.Unit), row,
      needMan: lead(man), needWoman: lead(row["Daily need (woman)"]) ?? (/^the same/.test(String(row["Daily need (woman)"])) ? lead(man) : null),
      perKg: /^[\d.]+ g\/kg/.test(man),
      daysToSignsLo: days ? Number(days[1]) : null, daysToSignsHi: days ? Number(days[2] ?? days[1]) : null,
    });
  }
  return nutrientMap;
}

/** A nutrient's library row and parsed need and clock; throws for an unknown id. */
export function nutrientInfo(id: string): NutrientInfo {
  const n = nutrients().get(id);
  if (!n) throw new Error(`nutrition: no nutrient ${id}`);
  return n;
}

/** The daily need in the nutrient's table unit, or null where the table gives none (energy comes from physiology). Per-kg needs use the body mass. */
export function dailyNeed(id: string, male: boolean, massKg = 0): number | null {
  const n = nutrientInfo(id), v = male ? n.needMan : n.needWoman;
  return v === null ? null : n.perKg ? v * massKg : v;
}

// ---------------------------------------------------------------------------------------------------------------- foods

/** Food column to nutrient id. The column's unit (g, mg, mcg) comes from its heading. */
const FOOD_COLUMNS: Record<string, string> = {
  "Protein g": "protein", "Carb g": "carb", "Fat g": "fat", "Water g": "water", "Sodium mg": "sodium", "Potassium mg": "potassium",
  "Vit C mg": "vit_c", "Thiamin mg": "vit_b1", "Niacin mg": "vit_b3", "Vit A mcg": "vit_a", "Iron mg": "iron",
  "Folate mcg": "vit_b9", "B12 mcg": "vit_b12", "Riboflavin mg": "vit_b2", "B6 mg": "vit_b6", "Vit E mg": "vit_e", "Vit K mcg": "vit_k",
  "Magnesium mg": "magnesium", "Zinc mg": "zinc", "Calcium mg": "calcium",
};

/** FLAGS.md: the library has no food class, so the haem-iron foods (meat and fish, absorption table) are named here by food id. */
const HAEM_FOODS = /salt-beef|salt-pork|salt-fish|herring|fresh-fish|green-turtle|boucan|tasajo|coast-provisions/;

export interface Food {
  id: string; slug: string; kcalPerKg: number;
  /** Nutrient id to the food column's unit per 100 g, kept with the unit so the amounts read as the table does. */
  per100: Map<string, { value: number; unit: Unit }>;
  haem: boolean;
}

let foodList: Food[] | null = null;
function foods(): Food[] {
  if (foodList) return foodList;
  const main = libraryTable("nutrition", "foods"), more = libraryTable("nutrition", "foods_more");
  if (main.length !== more.length) throw new Error("nutrition: foods and foods_more no longer have the same rows");
  foodList = main.map((row, i) => {
    const per100 = new Map<string, { value: number; unit: Unit }>();
    for (const r of [row, more[i]!]) for (const [col, v] of Object.entries(r)) {
      const id = FOOD_COLUMNS[col];
      if (id && typeof v === "number") per100.set(id, { value: v, unit: / (g|mg|mcg)$/.exec(col)![1] as Unit });
    }
    const slug = String(row.id).replace("nutrition.foods.", "");
    return { id: String(row.id), slug, kcalPerKg: Number(row.kcal) * 10, per100, haem: HAEM_FOODS.test(slug) };
  });
  return foodList;
}

/** A food by its `foods` id, its slug, or the `foods_more` slug of the same row. */
export function foodRow(id: string): Food {
  const slug = id.replace(/^nutrition\.foods(?:_more)?\./, "");
  const list = foods(), more = libraryTable("nutrition", "foods_more");
  const hit = list.find(f => f.slug === slug) ?? list[more.findIndex(r => String(r.id).endsWith(`.${slug}`))];
  if (!hit) throw new Error(`nutrition: no food ${id}`);
  return hit;
}

/** Amount of a nutrient in a mass of food, in the food column's unit (kcal for "energy"). */
export function foodContent(food: Food, nutrient: string, kg: number): number {
  if (nutrient === "energy") return food.kcalPerKg * kg;
  const c = food.per100.get(nutrient);
  return c ? c.value * kg * 10 : 0;
}

// ---------------------------------------------------------------------------------------------------------------- pools

export interface PoolSpec {
  id: string; rowId: string; name: string; unit: Unit;
  fullMan: number; fullWoman: number;           // kg
  useFrac: number; useMin: number; useFixed: number; // use/day = max(useFrac x pool, useMin) + useFixed, kg
  thresholdKg: number | null;                   // signs below this pool
  recoveryDays: number | null;                  // days the stage holds after the pool is back over the threshold; null: not a number in the table
  sweatPerL: number; menstrualDay: number; bloodPerL: number; feverX: number; diarrhoea: number; rumHeavy: number; // extras, kg
}

const POOL_OF: Record<string, string> = {
  "vitamin-c": "vit_c", thiamin: "vit_b1", niacin: "vit_b3", "vitamin-a": "vit_a", iron: "iron", sodium: "sodium", folate: "vit_b9",
  b12: "vit_b12", riboflavin: "vit_b2", "vitamin-k": "vit_k", magnesium: "magnesium", "essential-fatty-acids": "efa",
};

let poolMap: Map<string, PoolSpec> | null = null;
function pools(): Map<string, PoolSpec> {
  if (poolMap) return poolMap;
  poolMap = new Map();
  for (const row of libraryTable("nutrition", "depletion")) {
    const id = POOL_OF[String(row.id).replace("nutrition.depletion.", "")];
    if (!id) continue; // water is physiology's
    const poolText = String(row["Pool full"]), useText = String(row["Daily use"]), signs = String(row["Signs below"]);
    let useFrac = 0, useMin = 0, useFixed = 0, unit: Unit | null = null;
    const fr = /^([\d.]+)% of pool \(min ([\d.,]+ \w+)\)/.exec(useText);
    if (fr) { useFrac = Number(fr[1]) / 100; const q = qty(fr[2]!); if (!q) continue; useMin = q.kg; unit = q.unit; }
    else { const q = qty(useText); if (!q) continue; useFixed = q.kg; unit = q.unit; }
    // the pool: an amount, or a buffer counted in days of use; "small" and "fat stores" give none, so the nutrient is not pooled
    const buffer = /worth (\d+) days|a (\d+)-day buffer/.exec(poolText);
    let fullMan: number, fullWoman: number;
    if (buffer) fullMan = fullWoman = num(buffer[1] ?? buffer[2]!) * useFixed;
    else {
      const ex = /([\d.,]+ (?:mcg|mg|g)) exchangeable/.exec(poolText), q = qty(ex ? ex[1]! : poolText);
      if (!q) continue;
      unit = q.unit; fullMan = fullWoman = q.kg;
      const w = /\(men\), ([\d.,]+) \(women\)/.exec(poolText);
      if (w) fullWoman = num(w[1]!) * UNIT_KG[q.unit];
    }
    const left = /^(\d+) days left/.exec(signs), sq = qty(signs);
    const thresholdKg = left ? Number(left[1]) * useFixed : sq ? sq.kg : null;
    const rec = /^(\d+) (week|day)s?$/.exec(String(row["Recovery on full intake"]));
    const extra = (rx: RegExp) => { const m = rx.exec(useText); return m ? num(m[1]!) * UNIT_KG[unit!] : 0; };
    const sweat = /\+ ([\d.,]+) (mcg|mg|g) per litre of sweat/.exec(useText);
    poolMap.set(id, {
      id, rowId: String(row.id), name: String(row.Nutrient), unit: unit!, fullMan, fullWoman, useFrac, useMin, useFixed, thresholdKg,
      recoveryDays: rec ? Number(rec[1]) * (rec[2] === "week" ? 7 : 1) : null,
      sweatPerL: sweat ? num(sweat[1]!) * UNIT_KG[sweat[2] as Unit] : 0,
      menstrualDay: extra(/\+([\d.,]+) per menstrual day/), bloodPerL: extra(/\+([\d.,]+) per litre of blood lost/),
      feverX: (() => { const m = /\(x([\d.]+) with fever/.exec(useText); return m ? Number(m[1]) : 1; })(),
      diarrhoea: extra(/diarrhoea ([\d.]+)/), rumHeavy: extra(/heavy rum ([\d.]+)/),
    });
  }
  return poolMap;
}

/** The pooled nutrient ids (those with a numeric reserve and daily use in the depletion table). */
export function pooledNutrients(): string[] { return [...pools().keys()]; }
/** A pool's parsed depletion row. */
export function poolSpec(id: string): PoolSpec {
  const s = pools().get(id);
  if (!s) throw new Error(`nutrition: no pool for ${id}`);
  return s;
}

const substanceOf = (id: string) => `nutrient:${id}`;
function registerPools(w: World) {
  for (const s of pools().values()) {
    if (w.registry.substances.has(substanceOf(s.id))) continue;
    // a ledger substance: it carries mass only, no atoms (empty formula), so the element ledger counts nothing for it
    w.registry.addSubstance({ id: substanceOf(s.id), name: `${s.name} (body pool)`, molarMass: 1, formula: "", cp: {},
      source: "data/library/nutrition.json", provenance: "Historical", checked: "unverified: a marker substance for the nutrition library, no reference values" });
  }
}

/** Fill the body's pools to the table's full reserve (times `fractions[id]`, default 1) for its sex. Call before `World.conserve`. */
export function stockPools(w: World, bodyId: string, fractions: Record<string, number> = {}) {
  registerPools(w);
  const b = w.registry.component(bodyId), male = b.props.male !== 0;
  for (const s of pools().values()) {
    const target = (male ? s.fullMan : s.fullWoman) * (fractions[s.id] ?? 1), have = w.registry.contentMass(b, substanceOf(s.id));
    if (target !== have) w.registry.addContent(b, substanceOf(s.id), "solid", target - have);
  }
  b.props.nut_stocked = 1;
}

/** A pool's level in its table unit (mg, mcg or g). */
export function poolLevel(w: World, bodyId: string, id: string): number {
  return w.registry.contentMass(w.registry.component(bodyId), substanceOf(id)) / UNIT_KG[poolSpec(id).unit];
}

/** The deficiency stage of every pooled nutrient above 0: `{vit_c: 1}`. The stage is 1 under the table's "signs below" level; 2 and 3 only where the caller gave their levels. */
export function deficiencySignals(body: Component): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of pools().keys()) { const s = body.props[`stage_${id}`] ?? 0; if (s > 0) out[id] = s; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- absorption

interface Absorption {
  ironHaem: number; ironNon: number; ironVitCMg: number; ironVitCx: number; ironTeaX: number;
  maizeNiacin: number; thiaminRawFishX: number; thiaminRumX: number; folateCooked: number; folateRumX: number;
  b12: number; vitC: number; vitCCookedX: number; fatG: number; noFatX: number; fatFluxX: number;
  calcium: number; zinc: number; zincGrain: number; magnesium: number; flux: number;
}

let absorption: Absorption | null = null;
function absorb(): Absorption {
  if (absorption) return absorption;
  const rows = new Map(libraryTable("nutrition", "absorption").map(r => [String(r.id).replace("nutrition.absorption.", ""), r]));
  const rule = (slug: string) => String(rows.get(slug)?.["Model rule"] ?? (() => { throw new Error(`nutrition: no absorption row ${slug}`); })());
  const fat = rows.get("vitamins-a-d-e-k-fat-soluble")!;
  const non = rule("iron-non-haem-pease-grain-greens"), thi = rule("thiamin"), fol = rule("folate"), vc = rule("vitamin-c"), fs = rule("vitamins-a-d-e-k-fat-soluble");
  absorption = {
    ironHaem: grab(rule("iron-haem-meat-fish"), /intake x ([\d.]+)/, "haem iron"),
    ironNon: grab(non, /intake x ([\d.]+)/, "non-haem iron"),
    ironVitCx: grab(non, /x([\d.]+) with ([\d.]+)\+ mg vitamin C/, "iron with vitamin C"),
    ironVitCMg: grab(non, /x([\d.]+) with ([\d.]+)\+ mg vitamin C/, "iron with vitamin C", 2),
    ironTeaX: grab(non, /x([\d.]+) with tea or whole grain/, "iron with tea"),
    maizeNiacin: grab(rule("niacin-from-maize"), /maize niacin x ([\d.]+)/, "niacin from maize"),
    thiaminRawFishX: grab(thi, /raw-fish meal x([\d.]+)/, "thiamin and raw fish"),
    thiaminRumX: grab(thi, /heavy rum day x([\d.]+)/, "thiamin and rum"),
    folateCooked: grab(fol, /cooked food x ([\d.]+)/, "folate cooked"),
    folateRumX: grab(fol, /rum day x([\d.]+)/, "folate and rum"),
    b12: grab(rule("vitamin-b12"), /intake x ([\d.]+)/, "B12"),
    vitC: grab(vc, /intake x ([\d.]+)/, "vitamin C"),
    vitCCookedX: grab(vc, /cooking x([\d.]+)/, "vitamin C cooked"),
    fatG: grab(String(fat["Raised by"]), /with (\d+)\+ g fat/, "the fat in the meal"),
    noFatX: grab(fs, /x([\d.]+) without fat/, "fat-soluble without fat"),
    fatFluxX: grab(fs, /x([\d.]+) during a flux/, "fat-soluble in a flux"),
    calcium: grab(rule("calcium"), /intake x ([\d.]+)/, "calcium"),
    zinc: grab(rule("zinc"), /intake x ([\d.]+)/, "zinc"),
    zincGrain: grab(rule("zinc"), /x([\d.]+) on a grain-and-pease/, "zinc on grain and pease"),
    magnesium: grab(rule("magnesium"), /intake x ([\d.]+)/, "magnesium"),
    flux: grab(rule("everything-during-a-flux"), /every intake x ([\d.]+)/, "absorption in a flux"),
  };
  return absorption;
}

/** The state of the eater and the meal that the absorption rules read. */
export interface MealOptions {
  /** anatomy.organs intestines: absorption x function; omitted means intact gut. */
  gutFunction?: number;
  cooked?: boolean;        // boiled or cooked: vitamin C and folate fall by the table's factor
  rawFish?: boolean;       // a raw fish or shellfish meal: thiaminase
  nixtamalised?: boolean;  // maize treated with lime water: niacin is fully available
  wholeGrain?: boolean;    // phytate: non-haem iron falls by the tea factor
  tea?: boolean;           // tea or coffee tannins in the meal (also set by a tea-brewed item)
  grainAndPease?: boolean; // a grain-and-pease diet: zinc at the lower fraction
}

interface Meal extends MealOptions { vitCMg: number; fatG: number; flux: boolean; chronicFlux: boolean; rum: boolean }

const FAT_SOLUBLE = new Set(["vit_a", "vit_d", "vit_e", "vit_k"]);

/** The fraction of a nutrient that the body keeps from this food in this meal (absorption table; 1 where the table has no rule). */
export function absorbedFraction(nutrient: string, food: Food, m: Meal): number {
  const gut = m.gutFunction ?? 1;
  if (!Number.isFinite(gut) || gut < 0 || gut > 1) throw new Error("nutrition: invalid gut function");
  const a = absorb();
  let f: number;
  switch (nutrient) {
    case "iron": f = food.haem ? a.ironHaem : a.ironNon * (m.vitCMg >= a.ironVitCMg ? a.ironVitCx : 1) * (m.tea || m.wholeGrain ? a.ironTeaX : 1); break;
    case "vit_b3": f = /maize/.test(food.slug) && !m.nixtamalised ? a.maizeNiacin : 1; break;
    case "vit_b1": f = (m.rawFish ? a.thiaminRawFishX : 1) * (m.rum ? a.thiaminRumX : 1); break;
    case "vit_b9": f = (m.cooked ? a.folateCooked : 1) * (m.rum ? a.folateRumX : 1); break;
    case "vit_b12": f = m.chronicFlux ? 0 : a.b12; break;
    case "vit_c": f = a.vitC * (m.cooked ? a.vitCCookedX : 1); break;
    case "calcium": f = a.calcium; break;
    case "zinc": f = m.grainAndPease ? a.zincGrain : a.zinc; break;
    case "magnesium": f = a.magnesium; break;
    default: f = 1;
  }
  if (FAT_SOLUBLE.has(nutrient)) return gut * (m.flux ? a.fatFluxX : f * (m.fatG >= a.fatG ? 1 : a.noFatX));
  if (m.flux && nutrient !== "sodium" && nutrient !== "potassium" && nutrient !== "water") f *= a.flux;
  return f * gut;
}

export interface MealItem { food: string; kg: number }

/** Eat several foods as one meal (the vitamin C and fat of the meal change the absorption of its iron and fat-soluble vitamins). */
export function eatMeal(w: World, bodyId: string, items: MealItem[], opts: MealOptions = {}, process = "eat") {
  const b = w.registry.component(bodyId), p = b.props, list = items.map(i => ({ food: foodRow(i.food), kg: i.kg }));
  if (!p.nut_stocked) stockPools(w, bodyId);
  const sum = (n: string) => list.reduce((a, i) => a + foodContent(i.food, n, i.kg), 0);
  const meal: Meal = { ...opts, tea: opts.tea || list.some(i => /^tea-brewed/.test(i.food.slug)), vitCMg: sum("vit_c"), fatG: sum("fat"),
    flux: p.flux === 1 || p.chronic_flux === 1, chronicFlux: p.chronic_flux === 1, rum: p.rum_heavy === 1 };
  let kcal = 0, waterKg = 0;
  for (const { food, kg } of list) {
    const eatenKcal = food.kcalPerKg * kg, keptKcal = eatenKcal * absorbedFraction("energy", food, meal);
    kcal += keptKcal;
    if (eatenKcal > keptKcal) w.trace.record({ t: w.t, process, quantity: "energy:chemical", from: "food", to: "waste", amount: (eatenKcal - keptKcal) * KCAL_J, note: "unabsorbed" });
    for (const [n, c] of food.per100) {
      const eaten = c.value * kg * 10, kept = eaten * absorbedFraction(n, food, meal);
      p[`nut_in_${n}`] = (p[`nut_in_${n}`] ?? 0) + kept;
      if (n === "carb") p.nut_carb_eaten_g = (p.nut_carb_eaten_g ?? 0) + eaten;
      if (n === "water") {
        waterKg += kept * UNIT_KG[c.unit]; // retained water enters through physiology's ingest
        if (eaten > kept) w.trace.record({ t: w.t, process, quantity: "mass:water", from: "food", to: "unabsorbed", amount: (eaten - kept) * UNIT_KG[c.unit] });
        continue;
      }
      const pool = pools().get(n);
      if (!pool) continue;
      const sub = substanceOf(n), unit = UNIT_KG[c.unit], q = `mass:${sub}`;
      w.trace.record({ t: w.t, process, quantity: q, from: "food", to: bodyId, amount: kept * unit, note: food.slug });
      if (eaten > kept) w.trace.record({ t: w.t, process, quantity: q, from: "food", to: "unabsorbed", amount: (eaten - kept) * unit, note: food.slug });
      w.registry.addContent(b, sub, "solid", kept * unit);
    }
  }
  ingest(w, bodyId, { kcal, waterKg }, process);
}

/** Eat `kg` of a library food: its energy and water in through physiology's `ingest`, its nutrients absorbed into the pools, all traced. */
export function eat(w: World, bodyId: string, foodId: string, kg: number, opts: MealOptions = {}) {
  eatMeal(w, bodyId, [{ food: foodId, kg }], opts);
}

// ---------------------------------------------------------------------------------------------------------------- body composition

interface Composition {
  kcalPerKgFat: number; fatFloorKg: number; glycogenCapG: number; glycogenFromCarb: number; glycogenPerMetHour: number; glycogenOverMet: number;
  kcalPerGlycogenG: number; factorBase: number; factorSlope: number; startMassLimit: number;
}

let comp: Composition | null = null;
function composition(): Composition {
  if (comp) return comp;
  const rules = new Map(libraryTable("nutrition", "body_composition").map(r => [String(r.id).replace("nutrition.body_composition.", ""), String(r.Rule)]));
  const get = (s: string) => rules.get(s) ?? (() => { throw new Error(`nutrition: no body_composition row ${s}`); })();
  const energy = String(nutrientInfo("energy").row["Body reserve (full)"]);
  const fatRule = get("fat-mass"), gly = get("glycogen");
  const kcalPerKgFat = grab(fatRule, /balance \/ ([\d,]+)/, "the fat energy density");
  if (grab(energy, /fat mass x ([\d,]+) kcal\/kg/, "the fat energy density in nutrients") !== kcalPerKgFat) throw new Error("nutrition: the library gives two energy densities for fat");
  const capG = grab(gly, /up to ([\d.]+) g/, "the glycogen cap");
  comp = {
    kcalPerKgFat, fatFloorKg: grab(fatRule, /floor ([\d.]+) kg/, "the fat floor"),
    glycogenCapG: capG, glycogenFromCarb: grab(gly, /carb intake x ([\d.]+)/, "glycogen from carbohydrate"),
    glycogenPerMetHour: grab(gly, /about ([\d.]+) g per MET-hour/, "glycogen work cost"), glycogenOverMet: grab(gly, /over ([\d.]+) MET/, "glycogen work threshold"),
    kcalPerGlycogenG: grab(energy, /glycogen about ([\d,]+) g = ([\d,]+) kcal/, "the glycogen energy", 2) / grab(energy, /glycogen about ([\d,]+) g = ([\d,]+) kcal/, "the glycogen energy", 1),
    factorBase: grab(gly, /glycogenFactor = ([\d.]+) \+ ([\d.]+) x glycogen/, "the glycogen factor", 1),
    factorSlope: grab(gly, /glycogenFactor = ([\d.]+) \+ ([\d.]+) x glycogen/, "the glycogen factor", 2),
    startMassLimit: grab(get("starvation-stages"), /mass under ([\d.]+)% of start/, "the starvation mass limit") / 100,
  };
  return comp;
}

/** The library's convention, not an exact physiological constant; null disables this transfer. */
export const GLYCOGEN_BOUND_WATER: number | null = (() => {
  const value = libraryRow("nutrition", "body_composition", "nutrition.body_composition.glycogen-bound-water").Rule;
  return value === null ? null : typeof value === "number" ? value : grab(String(value), /([\d.]+) g of water/, "glycogen-bound water");
})();

/** Water already inside the body, held by its current glycogen reserve. */
export function glycogenBoundWaterKg(body: Component): number {
  return (body.props.glycogen_g ?? composition().glycogenCapG) / 1000 * (GLYCOGEN_BOUND_WATER ?? 0);
}

/** realism.nutrition.body_mass: the sole runtime writer of body component mass. */
export function bodyMassDelta(w: World, body: string, kg: number, process: string, note: string) {
  const b = w.registry.component(body), before = b.mass;
  if (b.kind !== "body" || !Number.isFinite(before) || !Number.isFinite(kg) || before + kg < 0) throw new Error("nutrition: invalid body mass delta");
  b.mass += kg;
  w.trace.record({ t: w.t, process, quantity: "mass:body", from: kg >= 0 ? process : body, to: kg >= 0 ? body : process, amount: Math.abs(kg), note });
  w.trace.check(w.t, "mass:body", before + kg, b.mass, 1e-9);
}

/** The energy density of stored fat the library gives (kcal/kg), 7,700 in the table. */
export function fatKcalPerKg(): number { return composition().kcalPerKgFat; }
/** The Endurance pool's glycogen factor from the glycogen reserve (g): 0.5 + 0.5 x glycogen/400 in the table. */
export function glycogenFactor(glycogenG: number): number { const c = composition(); return c.factorBase + c.factorSlope * glycogenG / c.glycogenCapG; }

// ---------------------------------------------------------------------------------------------------------------- the daily process

export interface NutritionOptions {
  every?: number;      // run every N fast steps (default 10)
  clockH0?: number;    // clock hour at world time 0 (default 0)
  dayStartH?: number;  // the hour the day's books close (default 12: the nautical day, as physiology)
  /** Pool levels (the pool's table unit) under which a deficiency is stage 2 and stage 3. The library gives only the "signs below" level (stage 1); the game's adapter rows give these. */
  stages?: Record<string, { stage2?: number; stage3?: number }>;
}

function closeDay(w: World, bodyId: string, o: NutritionOptions, sweatKg: number) {
  const b = w.registry.component(bodyId), p = b.props, reg = w.registry, out = bodyOutputs(b), male = p.male !== 0, c = composition();
  const days = (p.nut_days = (p.nut_days ?? 0) + 1);
  // pools: debit the day's use (never below empty), then the stage by the pool and the recovery clock
  for (const s of pools().values()) {
    const sub = substanceOf(s.id), pool = reg.contentMass(b, sub);
    let use = Math.max(s.useFrac * pool, s.useMin) + s.useFixed * (p.fever === 1 || p.pregnant === 1 ? s.feverX : 1);
    use += s.sweatPerL * sweatKg;
    if (!male && p.menstrual === 1) use += s.menstrualDay;
    use += s.bloodPerL * Math.max(0, (p.blood_lost_l ?? 0) - (p.nut_blood_mark ?? 0));
    if (p.diarrhoea === 1) use += s.diarrhoea;
    if (p.rum_heavy === 1) use += s.rumHeavy;
    const spent = Math.min(use, pool);
    reg.addContent(b, sub, "solid", -spent);
    w.trace.record({ t: w.t, process: "nutrition", quantity: `mass:${sub}`, from: bodyId, to: "metabolism", amount: spent, note: "daily use" });
    // the cap comes after the day's use: a pool that starts the day full still keeps what the day's food adds over what the day spends
    const over = reg.contentMass(b, sub) - (male ? s.fullMan : s.fullWoman);
    if (over > 0) {
      reg.addContent(b, sub, "solid", -over);
      w.trace.record({ t: w.t, process: "nutrition", quantity: `mass:${sub}`, from: bodyId, to: "excreta", amount: over, note: "over the full pool" });
    }
    const level = reg.contentMass(b, sub) / UNIT_KG[s.unit], st = o.stages?.[s.id];
    const raw = s.thresholdKg === null ? 0
      : st?.stage3 !== undefined && level < st.stage3 ? 3
      : st?.stage2 !== undefined && level < st.stage2 ? 2
      : level < s.thresholdKg / UNIT_KG[s.unit] ? 1 : 0;
    const key = `stage_${s.id}`, was = p[key] ?? 0;
    let stage = was;
    if (raw >= was) { stage = raw; p[`recov_${s.id}`] = 0; }
    else if (s.recoveryDays === null) stage = raw;
    else { p[`recov_${s.id}`] = (p[`recov_${s.id}`] ?? 0) + 1; if (p[`recov_${s.id}`]! >= s.recoveryDays) { stage = raw; p[`recov_${s.id}`] = 0; } }
    if (stage !== was) w.trace.note(w.t, `deficiency ${s.id} stage ${was} -> ${stage} (pool ${level.toPrecision(4)} ${s.unit}, day ${days})`);
    p[key] = stage;
    out[`pool_${s.id}`] = level;
    out[`pool_frac_${s.id}`] = level / ((male ? s.fullMan : s.fullWoman) / UNIT_KG[s.unit]);
    out[`deficiency_${s.id}`] = stage;
    out[`deficiency_${s.id}_row`] = s.rowId;
  }
  p.nut_blood_mark = p.blood_lost_l ?? 0;

  // energy closes with physiology's balance: intake - expenditure = change of glycogen + fat (+ what had no store)
  const balance = ((p.intake_kcal ?? 0) - (p.nut_intake_mark ?? 0)) - ((p.expenditure_kcal ?? 0) - (p.nut_spent_mark ?? 0));
  p.nut_intake_mark = p.intake_kcal ?? 0; p.nut_spent_mark = p.expenditure_kcal ?? 0;
  let glycogen = p.glycogen_g ?? c.glycogenCapG;
  const candidate = (p.nut_carb_eaten_g ?? 0) * c.glycogenFromCarb - (p.nut_met_over_h ?? 0) * c.glycogenPerMetHour;
  let g = Math.min(c.glycogenCapG, Math.max(0, glycogen + candidate)) - glycogen;
  let rest = balance - g * c.kcalPerGlycogenG;                 // kcal for the fat store
  if (rest < 0 && glycogen + g > 0) { const draw = Math.min(glycogen + g, -rest / c.kcalPerGlycogenG); g -= draw; rest += draw * c.kcalPerGlycogenG; }
  glycogen += g;
  let fatDelta = 0, unplaced = rest;
  if (p.fat_kg !== undefined) {
    const next = Math.max(c.fatFloorKg, p.fat_kg + rest / c.kcalPerKgFat);
    fatDelta = next - p.fat_kg; unplaced = rest - fatDelta * c.kcalPerKgFat;
    p.fat_kg = next;
  }
  // Glycogen binds/releases existing body water; only dry stores change body mass.
  const glycogenKg = g / 1000;
  if (GLYCOGEN_BOUND_WATER === null) w.trace.note(w.t, "(2623) unvalidated: null glycogen-bound-water row; water delta disabled");
  setBodyGlycogen(w, bodyId, glycogen);
  bodyMassDelta(w, bodyId, fatDelta, "nutrition", "fat storage");
  bodyMassDelta(w, bodyId, glycogenKg, "nutrition", "glycogen storage");
  out.glycogen_bound_water_kg = GLYCOGEN_BOUND_WATER === null ? null : glycogen / 1000 * GLYCOGEN_BOUND_WATER;
  const waterChangeKg = -(p.waterDeficitKg ?? 0);
  out.water_change_kg = waterChangeKg - (p.nut_water_report_mark ?? 0);
  p.nut_water_report_mark = waterChangeKg; // reporting only; never applied to mass
  p.nut_balance_kcal = (p.nut_balance_kcal ?? 0) + balance;
  p.nut_unplaced_kcal = (p.nut_unplaced_kcal ?? 0) + unplaced;
  p.nut_stored_kcal = (p.nut_stored_kcal ?? 0) + g * c.kcalPerGlycogenG + fatDelta * c.kcalPerKgFat;
  const stored = (g * c.kcalPerGlycogenG + fatDelta * c.kcalPerKgFat) * KCAL_J;
  w.trace.record({ t: w.t, process: "nutrition", quantity: "energy:stored", from: stored >= 0 ? "balance" : bodyId, to: stored >= 0 ? bodyId : "balance", amount: Math.abs(stored), note: "glycogen and fat" });
  w.trace.check(w.t, "energy:stored", p.nut_balance_kcal * KCAL_J, (p.nut_stored_kcal + p.nut_unplaced_kcal) * KCAL_J, 1e-3);
  p.nut_carb_eaten_g = 0; p.nut_met_over_h = 0;
  for (const n of nutrients().keys()) if (p[`nut_in_${n}`] !== undefined) { out[`intake_${n}`] = p[`nut_in_${n}`]!; p[`nut_in_${n}`] = 0; }

  out.fat_kg = p.fat_kg ?? null; out.glycogen_g = glycogen; out.glycogen_factor = glycogenFactor(glycogen);
  out.energy_balance_day_kcal = balance; out.energy_unplaced_kcal = p.nut_unplaced_kcal;
  out.starvation_limit = (p.fat_kg !== undefined && p.fat_kg <= c.fatFloorKg && unplaced < 0) || b.mass < c.startMassLimit * p.nut_start_mass ? 1 : 0;
  trackCrisis(w, bodyId, "nutrition.body_composition.starvation-stages", out.starvation_limit === 1,
    { source: "nutrition.body_composition.starvation-stages; nutrition.body_composition.fat-mass" });
  out.protein_need_g = dailyNeed("protein", male, b.mass);
}

/** The daily nutrition process: closes each day's books (pool use, stages, glycogen and fat) at `dayStartH`; run it after `physiologyProcess`. */
export function nutritionProcess(body: string, o: NutritionOptions = {}): Process {
  const clockH0 = o.clockH0 ?? 0, dayStartH = o.dayStartH ?? 12;
  return { name: "nutrition", every: o.every ?? 10, step(w, dt) {
    const b = w.registry.component(body), p = b.props;
    if (!p.nut_stocked) stockPools(w, body);
    const clock = clockH0 + w.t / 3600, dayIndex = Math.floor((clock - dayStartH) / 24);
    if (p.nut_day_index === undefined) {
      // the marks start at zero: physiology's totals and the blood lost count from the body's beginning, so the first day holds all of them
      p.nut_day_index = dayIndex; p.nut_intake_mark = 0; p.nut_spent_mark = 0; p.nut_sweat_mark = 0; p.nut_blood_mark = 0; p.nut_start_mass = b.mass;
    }
    p.nut_met_over_h = (p.nut_met_over_h ?? 0) + Math.max(0, Number(bodyOutputs(b).met ?? 0) - composition().glycogenOverMet) * dt / 3600;
    const endDayIndex = Math.floor((clockH0 + (w.t + dt) / 3600 - dayStartH) / 24);
    while (p.nut_day_index < endDayIndex) {
      closeDay(w, body, o, (p.sweat_kg ?? 0) - p.nut_sweat_mark!);
      p.nut_sweat_mark = p.sweat_kg ?? 0; p.nut_day_index++;
    }
  } };
}
