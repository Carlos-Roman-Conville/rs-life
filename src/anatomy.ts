/** Organ assemblies on the same registry/graph as the still. Blood, gas and food
 * transfers remain owned by circulation, atmosphere and nutrition. Graph signals
 * are adequacies, not transfers of fictitious blood or nutrient mass.
 */
import { libraryRow, libraryTable, type LibraryRow } from "./library.ts";
import { bodyOutputs, restingMetabolicRate } from "./physiology.ts";
import { breathingProcess, respiratoryProfile, type RespiratoryProfile } from "./atmosphere.ts";
import { circulationProcess, initialiseCirculation, type CirculationOptions } from "./circulation.ts";
import { eatMeal, poolLevel, type MealItem, type MealOptions } from "./nutrition.ts";
import type { Component } from "./registry.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { crisesOf, trackCrisis, type Crisis } from "./crisis.ts";

export type AnatomyTable = "organs" | "tissues" | "damage_function" | "timescales" | "species";
export const anatomyRules = (table: AnatomyTable) => Object.fromEntries(libraryTable("anatomy", table).map(r => [String(r.id), r]));
const rule = (table: string, id: string) => libraryRow("anatomy", table, `anatomy.${table}.${id}`);
function number(text: unknown, pattern = /([\d.]+)/): number {
  const m = pattern.exec(String(text));
  if (!m) throw new Error(`anatomy: missing number in ${text}`);
  return Number(m[1]);
}
function fraction(v: number, name: string) {
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`anatomy: invalid ${name}`);
  return v;
}

export interface SpeciesProfile {
  fields: Record<string, string | number | boolean | null>;
  organs: string[];
  organMassKg: Record<string, number | null>;
  bloodMlKg: number;
  cardiacOutputLMinKg: number;
  temperatureC: number;
  haemoglobinGDL: number | null;
  respiratory: RespiratoryProfile | null;
}

/** Species differences come from columns, never a species switch in the process.
 * Organ masses, Hb and maximal ventilation are read from the library's slots; a null
 * slot (no cited source) stays null and the host can supply a profile.
 */
export function speciesProfile(column: "Human default" | "A horse (example)" = "Human default"): SpeciesProfile {
  const fields = Object.fromEntries(libraryTable("anatomy", "species").map(r => [String(r.id), r[column]]));
  const organRows = libraryTable("anatomy", "organs"), organs = organRows.map(r => String(r.id));
  const numeric = (v: unknown) => typeof v === "number" ? v : null;
  // The human fields point at the rows that hold the value; another species' are numbers or null.
  const hb = fields["anatomy.species.haemoglobin-g-dl"], ve = fields["anatomy.species.maximal-ventilation-l-min"];
  return { fields, organs, organMassKg: Object.fromEntries(organRows.map(r => [String(r.id), numeric(r[`Mass (kg, ${column})`])])),
    bloodMlKg: Number(fields["anatomy.species.blood-volume-ml-kg"]),
    cardiacOutputLMinKg: Number(fields["anatomy.species.resting-cardiac-output-l-min-per-kg"]),
    temperatureC: Number(fields["anatomy.species.body-temperature-set-point-c"]),
    haemoglobinGDL: hb === "circulation.quantities.haemoglobin" ? number(libraryRow("circulation", "quantities", hb)["Normal (70 kg man)"]) : numeric(hb),
    respiratory: ve === "anatomy.respiratory.ventilation-capacity-maximal" ? respiratoryProfile()
      : typeof ve === "number" ? respiratoryProfile({ maxVentilationLMin: ve }) : null };
}

/** Delegate the species cell to physiology; human measurements are unavailable here, so its rate is null. */
export function speciesRmr(profile: SpeciesProfile, massKg: number): number | null {
  return restingMetabolicRate({ mass: massKg, props: {} }, String(profile.fields["anatomy.species.rmr-formula"]));
}

export interface OrganState {
  component: string;
  row: LibraryRow;
  damage: number;
  function: number | null;
  massKg: number | null;
  /** Host supplies quantified insults/resistance; low function alone has no damage rate. */
  insult: number;
  resistance: number;
  repairAllowed: boolean;
}
export interface BodyAssembly {
  body: string;
  profile: SpeciesProfile;
  organs: Record<string, OrganState>;
  tissues: Record<string, { row: LibraryRow; integrity: number; component: string }>;
  crises: Crisis[];
  /** Qualitative source rows, never a fabricated potassium concentration or hazard;
   * kineticsSeconds is the organ row's cited cascade timescale, null while none is cited. */
  cascades: Record<string, { statement: string; kineticsSeconds: number | null }>;
  signals: Record<string, { component: string; output: string }>;
  elapsedSeconds: number;
}

function node(id: string, kind: string, temperatureC: number, mass = 0): Component {
  return { id, kind, material: "flesh", mass, temperatureC, contents: [],
    ports: [{ id: "blood_in", kind: "fluid", direction: "in" }, { id: "blood_out", kind: "fluid", direction: "out" }],
    condition: { capability: 1, control: 1, accuracy: 1 }, props: {} };
}

/** Adds an assembly to an existing host body. Zero-mass shells are views into the
 * body's existing mass, not extra thermal tissue. Unknown organ masses stay null.
 */
export function assembleBody(w: World, body: string, profile = speciesProfile()): BodyAssembly {
  const b = w.registry.component(body);
  const rows = profile.organs.map(id => libraryRow("anatomy", "organs", id)); // validate before mutation
  if (new Set(profile.organs).size !== rows.length) throw new Error("anatomy: duplicate organ");
  if (!(b.mass > 0) || !Number.isFinite(b.mass)) throw new Error("anatomy: invalid body mass");
  for (const value of [profile.bloodMlKg, profile.cardiacOutputLMinKg])
    if (!(value > 0) || !Number.isFinite(value)) throw new Error("anatomy: invalid profile");
  if (!Number.isFinite(profile.temperatureC)) throw new Error("anatomy: invalid temperature");
  if (profile.haemoglobinGDL !== null && (!Number.isFinite(profile.haemoglobinGDL) || profile.haemoglobinGDL < 0)) throw new Error("anatomy: invalid haemoglobin");
  const ids = [...profile.organs.map(id => `${body}:${id}`), ...libraryTable("anatomy", "tissues").map(r => `${body}:${r.id}`), `${body}:vessels`];
  if (ids.some(id => w.registry.components.has(id))) throw new Error("anatomy: assembly already exists");
  for (const id of profile.organs) {
    const mass = profile.organMassKg[id];
    if (mass != null && (!Number.isFinite(mass) || mass < 0)) throw new Error(`anatomy: invalid mass for ${id}`);
  }
  if (b.props.circulation_initial_ml !== undefined && b.props.circulation_initial_ml !== b.mass * profile.bloodMlKg)
    throw new Error("anatomy: existing circulation disagrees with species blood volume");
  const a: BodyAssembly = { body, profile, organs: {}, tissues: {}, crises: [], cascades: {}, signals: {}, elapsedSeconds: 0 };
  const vessels = w.registry.addComponent(node(`${body}:vessels`, "vessels", profile.temperatureC));
  for (const r of rows) {
    const id = String(r.id), c = w.registry.addComponent(node(`${body}:${id}`, "organ", profile.temperatureC));
    c.props.function = 1; c.props.damage = 0;
    a.organs[id] = { component: c.id, row: r, function: 1, damage: 0, massKg: profile.organMassKg[id] ?? null,
      insult: 0, resistance: 0, repairAllowed: false };
    const input = w.graph.connect({ id: `${c.id}:supply`, from: vessels.id, fromPort: "blood_out", to: c.id, toPort: "blood_in", kind: "fluid", props: {} });
    a.signals[input.id] = { component: vessels.id, output: id };
    bodyOutputs(vessels)[id] = 1;
    w.graph.connect({ id: `${c.id}:return`, from: c.id, fromPort: "blood_out", to: vessels.id, toPort: "blood_in", kind: "fluid", props: {} });
    bodyOutputs(b)[id] = 1;
  }
  for (const r of libraryTable("anatomy", "tissues")) {
    const c = w.registry.addComponent(node(`${body}:${r.id}`, "tissue", profile.temperatureC));
    a.tissues[String(r.id)] = { row: r, integrity: 1, component: c.id };
    bodyOutputs(c)[String(r.id)] = 1;
    bodyOutputs(b)[String(r.id)] = 1;
  }
  // The tissue rows' Where fields identify these structural inputs. Rates for
  // other tissue insults remain host inputs, not inferred from nutrient deficits.
  const tissues: Record<string, string[]> = { "connective-tissue-collagen": ["skin"], bone: ["marrow"],
    "epithelium-skin-and-gut-lining": ["skin", "intestines", "lungs"], muscle: ["heart", "stomach", "intestines"], "nervous-tissue": ["brain"] };
  for (const [tissue, organs] of Object.entries(tissues)) for (const organ of organs) if (a.organs[organ]) {
    const id = `anatomy.tissues.${tissue}`;
    connectOrganInput(w, a, organ, a.tissues[id].component, id);
  }
  if (profile.haemoglobinGDL !== null) initialiseCirculation(w, body, { bloodVolumeMl: b.mass * profile.bloodMlKg, haemoglobinGDL: profile.haemoglobinGDL });
  bodyOutputs(b)["anatomy.species.blood-volume-ml-kg"] = profile.bloodMlKg;
  w.trace.note(w.t, `anatomy: ${body} assembled; organ shells carry no additional mass; unspecified organ masses and cascade kinetics are null`);
  return a;
}

/** Wire a quantified adequacy from any graph component (including another organ).
 * Dependencies alone do not imply that potassium adequacy equals kidney function.
 */
export function connectOrganInput(w: World, a: BodyAssembly, organ: string, source: string, output: string) {
  const target = a.organs[organ];
  if (!target) throw new Error(`anatomy: absent organ ${organ}`);
  const c = w.registry.component(source), dest = w.registry.component(target.component);
  const id = `${dest.id}:input:${source}:${output}`;
  if (a.signals[id]) throw new Error(`anatomy: duplicate input ${id}`);
  c.ports.push({ id, kind: "power", direction: "out" });
  dest.ports.push({ id, kind: "power", direction: "in" });
  w.graph.connect({ id, from: source, fromPort: id, to: dest.id, toPort: id, kind: "power", props: {} });
  a.signals[id] = { component: source, output };
}

/** Level-5 hypotheses, specified in gears/anatomy-crisis-floors.md; the library
 * is their single numeric home. Crossing a floor opens a crisis, never a death roll. */
const floors = new Map(libraryTable("anatomy", "crisis_floors").map(r => [String(r.Organ), r]));
function crisis(w: World, a: BodyAssembly, id: string, active: boolean, value: number | null, capacity: number, source: string) {
  const c = trackCrisis(w, a.body, id, active, { source, organ: id, function: value, remainingCapacity: capacity });
  if (c && !a.crises.includes(c)) a.crises.push(c);
}

/** Run after circulation/breathing and on input-change events (dt=0 supported).
 * Daily damage uses only explicit insults. Repair needs an explicit nutrition gate.
 */
export function anatomyProcess(a: BodyAssembly): Process {
  const repair = String(rule("damage_function", "repair")["Formula or statement"]);
  const rates: Record<string, number> = { liver: number(repair, /liver ([\d.]+)/), skin: number(repair, /lining ([\d.]+)/),
    intestines: number(repair, /lining ([\d.]+)/), heart: number(repair, /nerves ([\d.]+)/), brain: number(repair, /nerves ([\d.]+)/), kidneys: number(repair, /kidney ([\d.]+)/) };
  return { name: "anatomy", every: 1, step(w, dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error("anatomy: invalid time");
    const out = bodyOutputs(w.registry.component(a.body)), vessels = w.registry.component(`${a.body}:vessels`);
    const daily = Math.floor((a.elapsedSeconds + dt) / 86400) - Math.floor(a.elapsedSeconds / 86400);
    a.elapsedSeconds += dt;
    a.cascades = {};
    const collagen = a.tissues["anatomy.tissues.connective-tissue-collagen"];
    const collagenRule = String(collagen.row["Integrity falls with"]);
    if (daily && w.registry.component(a.body).props.nut_stocked === 1 && poolLevel(w, a.body, "vit_c") < number(collagenRule, /under ([\d.]+) mg/))
      collagen.integrity = Math.max(0, collagen.integrity - daily * number(collagenRule, /integrity -([\d.]+)/));
    for (const [id, tissue] of Object.entries(a.tissues)) {
      out[id] = fraction(tissue.integrity, id);
      bodyOutputs(w.registry.component(tissue.component))[id] = tissue.integrity;
    }
    const atRest = out["circulation.bleeding.i"] === 1 || out["circulation.bleeding.i"] === undefined;
    for (const [id, s] of Object.entries(a.organs)) {
      fraction(s.damage, "damage"); fraction(s.insult, "insult"); fraction(s.resistance, "resistance");
      if (daily) s.damage = Math.max(0, Math.min(1, s.damage + daily * s.insult * (1 - s.resistance) -
        (s.insult === 0 && s.repairAllowed ? daily * (rates[id] ?? 0) : 0)));
      const perfusion = out[`circulation.quantities.perfusion-per-organ.${id === "intestines" || id === "stomach" ? "gut" : id}`];
      bodyOutputs(vessels)[id] = typeof perfusion === "number" ? perfusion : atRest ? 1 : null;
    }
    // Snapshot all graph inputs before publishing to avoid organ enumeration order
    // changing cyclic dependencies. Hosts call again after new upstream outputs.
    const next: Record<string, number | null> = {};
    for (const [id, s] of Object.entries(a.organs)) {
      const edges = w.graph.to(s.component).filter(e => a.signals[e.id]);
      const values = edges.map(e => {
        const input = a.signals[e.id];
        const v = bodyOutputs(w.registry.component(input.component))[input.output];
        return typeof v === "number" ? fraction(v, `input ${e.id}`) : null;
      });
      next[id] = !edges.some(e => e.id === `${s.component}:supply`) || values.includes(null) ? null : Math.min(...values as number[]) * (1 - s.damage);
    }
    for (const [id, s] of Object.entries(a.organs)) {
      s.function = next[id]; out[id] = s.function;
      const c = w.registry.component(s.component);
      bodyOutputs(c)[id] = s.function; c.props.damage = s.damage;
      if (s.function === null) delete c.props.function; else c.props.function = s.function;
      if (s.function !== null && s.function < 1) a.cascades[id] = { statement: String(s.row["Failure cascade (model)"]),
        kineticsSeconds: typeof s.row["Cascade kinetics (s)"] === "number" ? s.row["Cascade kinetics (s)"] : null };
      const floor = floors.get(id);
      if (floor && s.function !== null) crisis(w, a, id, s.function <= Number(floor.Floor), s.function, 1 - s.damage,
        `${floor.id}: ${floor.Source}; level ${floor.Level} hypothesis; gears/anatomy-crisis-floors.md`);
    }
    for (const [id, tissue] of Object.entries(a.tissues)) out[id] = fraction(tissue.integrity, id);
    // The bleed class's own crisis is opened by circulation (the row says dying); the assembly lists it with the organ crises.
    for (const c of crisesOf(w, a.body)) if (c.cause.startsWith("circulation.bleeding.") && !a.crises.includes(c)) a.crises.push(c);
    w.afterStep(); // physical transfers remain checked by their owning modules
  } };
}

/** Shared process factories: no duplicated gas exchange or perfusion formula. */
export function assemblyCirculation(a: BodyAssembly, options: CirculationOptions = {}): Process {
  if (a.profile.haemoglobinGDL === null) throw new Error("anatomy: profile haemoglobin missing; circulation disabled");
  return { name: "circulation", every: options.every ?? 1, step(w, dt) {
    const b = w.registry.component(a.body);
    const resting = b.props.blood_lost_ml === 0 && a.organs.heart?.function === 1;
    circulationProcess(a.body, { ...options, cardiacOutputLMin: options.cardiacOutputLMin ??
      (options.resistance === undefined && resting ? b.mass * a.profile.cardiacOutputLMinKg : undefined) }).step(w, dt);
  } };
}
export function assemblyBreathing(a: BodyAssembly, room: string): Process {
  if (!a.profile.respiratory) throw new Error("anatomy: profile ventilation missing; breathing disabled");
  return breathingProcess(a.body, room, { profile: a.profile.respiratory });
}

/** Intestines' absorption x function rule; nutrition owns all food transfers. */
export function feedAssembly(w: World, a: BodyAssembly, meal: MealItem[], options: MealOptions = {}) {
  if (a.profile.fields["anatomy.species.diet-and-absorption"] !== rule("species", "diet-and-absorption")["Human default"])
    throw new Error("anatomy: species absorption parameters missing; feeding disabled");
  const gut = a.organs.intestines?.function;
  if (gut == null) throw new Error("anatomy: gut function unknown; absorption disabled");
  eatMeal(w, a.body, meal, { ...options, gutFunction: gut });
}
