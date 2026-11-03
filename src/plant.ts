/** Daily, isolated physiology. No world writes; parameters and supported forms are explicit data. */
import { libraryTable } from "./library.ts";
import type { LibraryRow } from "./library.ts";
import { createTissuePopulation, organAggregate, stepTissue } from "./tissue.ts";
import type { TissuePopulation } from "./tissue.ts";

export class PlantParameterError extends Error {
  constructor(fields: readonly string[]) { super(`plant: missing or invalid species values: ${fields.join(", ")}`); this.name = "PlantParameterError"; }
}
export class PlantFormError extends Error {
  constructor(id: string) { super(`plant: unavailable form or constant plants.forms.${id}`); this.name = "PlantFormError"; }
}
export class PlantEnvironmentError extends Error {
  constructor(field: string) { super(`plant: missing or invalid env.${field}`); this.name = "PlantEnvironmentError"; }
}

export type PlantForms = readonly LibraryRow[];
const formsTable = (): PlantForms => libraryTable("plants", "forms");
function form(id: string, forms: PlantForms): LibraryRow {
  const row = forms.find(r => r.id === `plants.forms.${id}`);
  // Equation rows intentionally have Value=null: their researched definition lives in Note.
  // A missing definition (or an unresearched placeholder) is unavailable, never a default.
  if (!row || typeof row.Note !== "string" || !row.Note.trim() || !row.Label || row.source === "open")
    throw new PlantFormError(id);
  return row;
}
function constant(id: string, forms: PlantForms): number {
  const value = form(id, forms).Value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new PlantFormError(id);
  return value;
}
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
function finite(name: string, value: number, min = 0, max = Infinity): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`plant: invalid ${name}`);
  return value;
}

/** plants.forms.temperature_beta_function supports a zero base only (2808).
 * A nonzero base requires the separately sourced cardinal form, currently absent. */
export function plantTemperatureFactor(t: number, min: number, opt: number, max: number, forms = formsTable()): number {
  form(min === 0 ? "temperature_beta_function" : "temperature_cardinal_beta_function", forms);
  finite("temperature", t, -Infinity);
  if (!(min < opt && opt < max)) throw new PlantParameterError(["t_min < t_opt < t_max"]);
  if (t <= min || t >= max) return 0;
  return clamp((max - t) / (max - opt) * ((t - min) / (opt - min)) ** ((opt - min) / (max - opt)));
}

/** plants.forms.fao56_ks: remaining available water is TAW - Dr; units cancel. */
export function plantWaterFactor(available: number, totalAvailable: number, p: number, forms = formsTable()): number {
  form("fao56_ks", forms);
  finite("available water", available);
  if (!(totalAvailable > 0) || !Number.isFinite(totalAvailable) || !(p >= 0 && p < 1))
    throw new PlantParameterError(["totalAvailableWater > 0", "0 <= depletion_fraction_p < 1"]);
  return clamp(available / (totalAvailable * (1 - p)));
}

/** plants.forms.salinity_threshold_slope; slope is percent per conductivity unit. */
export function plantSalinityFactor(s: number, threshold: number, slope: number, forms = formsTable()): number {
  form("salinity_threshold_slope", forms);
  finite("salinity", s); finite("salinity threshold", threshold); finite("salinity slope", slope);
  return clamp(1 - Math.max(0, s - threshold) * slope / 100);
}

/** plants.forms.ph_trapezoid is absent in the current library: calling it throws. */
export function plantPhFactor(ph: number, min: number, low: number, high: number, max: number, forms = formsTable()): number {
  form("ph_trapezoid", forms);
  finite("pH", ph, 0, 14);
  if (!(min < low && low <= high && high < max)) throw new PlantParameterError(["pH cardinal order"]);
  if (ph <= min || ph >= max) return 0;
  return clamp(Math.min((ph - min) / (low - min), (max - ph) / (max - high)));
}

export type PlantOrganName = "leaf" | "stem" | "root" | "rhizome";
export type PlantNutrient = "n" | "p" | "k";
const organs: readonly PlantOrganName[] = ["leaf", "stem", "root", "rhizome"];
const nutrients: readonly PlantNutrient[] = ["n", "p", "k"];
type OrganValues = Record<PlantOrganName, number>;
type NutrientValues = Record<PlantNutrient, number>;
const emptyNutrients = (): NutrientValues => ({ n: 0, p: 0, k: 0 });

export interface PlantEnvironment {
  /** MJ PAR / m2 / day. A photon-mol port needs an explicit spectral conversion upstream. */
  par?: number;
  airTemperatureC?: number;
  vpdKPa?: number;
  co2Ppm?: number;
  /** Per-individual root-zone available water and TAW, kg; no field-capacity default. */
  soilWater?: { availableKg: number; totalAvailableKg: number };
  availableN?: number;
  availableP?: number;
  availableK?: number;
  soilPh?: number;
  /** dS/m for threshold/slope; same units as the supplied cardinals for a beta. */
  salinity?: number;
  waterDepthM?: number;
  kdPerM?: number;
  inundation?: number;
}

export interface PlantInit {
  cultivar: string | null;
  variants: Readonly<Record<string, string | number | boolean | null>>;
  ageDays: number;
  massesKg: OrganValues;
  reserveKg: number;
  groundAreaM2: number;
  waterKg: number;
  waterStatus: number;
  tissueFractions: NutrientValues;
  /** Explicit alternate data provider, primarily for test-only forms. Never fills library rows. */
  forms?: PlantForms;
}

export interface PlantLitter {
  dryMassKg: number;
  carbonKg: number;
  nutrientsKg: NutrientValues;
}
export interface PlantFluxes {
  grossDryMassKg: number;
  co2TakenKgC: number;
  co2ReleasedKgC: number;
  o2ReleasedKg: number;
  waterTakenKg: number;
  waterTranspiredKg: number;
  nutrientsTakenKg: NutrientValues;
  litter: Record<PlantOrganName, PlantLitter>;
  factors: { temperature: number; water: number; salinity: number; nutrients: number; ph: number; co2: number; combined: number };
}
interface Inventory { carbon: number; water: number; nutrients: NutrientValues }
export interface Plant {
  genetic: { readonly cultivar: string | null; readonly variants: Readonly<Record<string, string | number | boolean | null>> };
  developmental: {
    ageDays: number;
    organs: Record<PlantOrganName, { populations: TissuePopulation[] }>;
    leafAreaM2: number;
    reserveKg: number;
    heightM: number | null;
    stemDiameterCm: number | null;
    maturity: "juvenile" | "reproductive" | "senescent";
  };
  organism: {
    waterStatus: number;
    waterKg: number;
    nutrientsKg: NutrientValues;
    tissueFractions: NutrientValues;
    accumulatedStressDays: number;
    alive: boolean;
    cause: "carbon starvation" | null;
  };
  parameters: Readonly<Record<string, string | number | boolean | null>>;
  forms: PlantForms;
  groundAreaM2: number;
  ledger: { initial: Inventory; totals: PlantFluxes };
}

function zeroFlux(): PlantFluxes {
  const litter = Object.fromEntries(organs.map(o => [o, { dryMassKg: 0, carbonKg: 0, nutrientsKg: emptyNutrients() }])) as PlantFluxes["litter"];
  return { grossDryMassKg: 0, co2TakenKgC: 0, co2ReleasedKgC: 0, o2ReleasedKg: 0,
    waterTakenKg: 0, waterTranspiredKg: 0, nutrientsTakenKg: emptyNutrients(), litter,
    factors: { temperature: 0, water: 0, salinity: 0, nutrients: 0, ph: 0, co2: 0, combined: 0 } };
}
const param = (plant: Plant, field: string): number => plant.parameters[field] as number;
export function plantOrganMasses(plant: Plant): OrganValues {
  return Object.fromEntries(organs.map(o => [o, organAggregate(plant.developmental.organs[o].populations).viableMassKg])) as OrganValues;
}
function liveMass(plant: Plant): number { return Object.values(plantOrganMasses(plant)).reduce((a, b) => a + b, 0); }
function inventory(plant: Plant): Inventory {
  return { carbon: (liveMass(plant) + plant.developmental.reserveKg) * param(plant, "carbon_fraction"),
    water: plant.organism.waterKg, nutrients: { ...plant.organism.nutrientsKg } };
}
function refresh(plant: Plant): void {
  const mass = liveMass(plant);
  plant.developmental.leafAreaM2 = plantOrganMasses(plant).leaf * param(plant, "specific_leaf_area");
  for (const n of nutrients) plant.organism.tissueFractions[n] = mass === 0 ? 0 :
    plant.organism.nutrientsKg[n] / (mass * param(plant, `critical_${n}`) / 100);
  // A 365-day model year is a unit convention. No invented size-at-maturity threshold:
  // reproductive status requires living biomass and the table's age; see flags/plants.md.
  plant.developmental.maturity = mass > 0 && plant.developmental.ageDays >= param(plant, "age_at_maturity") * 365
    ? "reproductive" : "juvenile";
  if (typeof plant.parameters.lifespan === "number" && plant.developmental.ageDays >= plant.parameters.lifespan * 365)
    plant.developmental.maturity = "senescent";
}

/** Reads schema Field names, never positional species cells. All missing required rows are reported together. */
export function createPlant(speciesTable: string | readonly LibraryRow[], init: PlantInit): Plant {
  const rows = typeof speciesTable === "string" ? libraryTable("plants", speciesTable) : speciesTable;
  const schema = new Set(libraryTable("plants", "schema").map(r => r.Field));
  const parameters = Object.fromEntries(rows.filter(r => schema.has(r.Field) || r.Field === "meristem_fraction")
    .map(r => [String(r.Field), r.Value]));
  const isTree = typeof parameters.life_form === "string" && /\btree\b/.test(parameters.life_form);
  const required = ["life_form", "radiation_use_efficiency", "t_min", "t_opt", "t_max", "depletion_fraction_p",
    "water_use_efficiency", "ph_min", "ph_opt_low", "ph_opt_high", "ph_max", "critical_n", "critical_p", "critical_k",
    "age_at_maturity", "alloc_leaf", "alloc_stem", "alloc_root", "specific_leaf_area", "leaf_turnover", "root_turnover",
    "maintenance_resp_25c", "q10", "growth_resp_fraction", "carbon_fraction"];
  // Presence of a nullable row is a requirement, not permission to replace its value.
  if (Object.hasOwn(parameters, "canopy_extinction_k")) required.push("canopy_extinction_k");
  if (Object.hasOwn(parameters, "alloc_rhizome") || init.massesKg.rhizome > 0) required.push("alloc_rhizome");
  if (Object.hasOwn(parameters, "salinity_opt")) required.push("salinity_min", "salinity_opt", "salinity_max");
  else required.push("salinity_threshold", "salinity_slope");
  if (isTree) required.push("allometry_a", "allometry_b", "max_height", "max_stem_diameter");
  const missing = required.filter(k => k === "life_form" ? typeof parameters[k] !== "string" || !parameters[k] :
    typeof parameters[k] !== "number" || !Number.isFinite(parameters[k]));
  if (missing.length) throw new PlantParameterError(missing);
  const p = (k: string): number => parameters[k] as number;
  const invalid: string[] = [];
  for (const key of required.filter(k => k !== "life_form" && !["t_min", "t_opt", "t_max"].includes(k)))
    if (p(key) < 0) invalid.push(key);
  for (const key of ["water_use_efficiency", "specific_leaf_area", "critical_n", "critical_p", "critical_k", "q10", "carbon_fraction"])
    if (p(key) <= 0) invalid.push(key);
  if (!(p("t_min") < p("t_opt") && p("t_opt") < p("t_max"))) invalid.push("temperature cardinal order");
  if (!(p("ph_min") < p("ph_opt_low") && p("ph_opt_low") <= p("ph_opt_high") && p("ph_opt_high") < p("ph_max") && p("ph_max") <= 14))
    invalid.push("pH cardinal order");
  if (p("depletion_fraction_p") >= 1) invalid.push("depletion_fraction_p");
  if (p("growth_resp_fraction") >= 1) invalid.push("growth_resp_fraction");
  if (p("carbon_fraction") > 1) invalid.push("carbon_fraction");
  const allocation = organs.map(o => o === "rhizome" && !Object.hasOwn(parameters, "alloc_rhizome") ? 0 : p(`alloc_${o}`));
  if (allocation.some(v => v < 0 || v > 1) || Math.abs(allocation.reduce((a, b) => a + b, 0) - 1) > 1e-12)
    invalid.push("allocation fractions must sum to one");
  if (parameters.meristem_fraction != null && (typeof parameters.meristem_fraction !== "number" ||
    !Number.isFinite(parameters.meristem_fraction) || parameters.meristem_fraction < 0 || parameters.meristem_fraction >= 1)) invalid.push("meristem_fraction");
  if (invalid.length) throw new PlantParameterError(invalid);
  finite("ageDays", init.ageDays); finite("reserveKg", init.reserveKg); finite("waterKg", init.waterKg);
  finite("waterStatus", init.waterStatus, 0, 1);
  finite("groundAreaM2", init.groundAreaM2, Number.MIN_VALUE);
  organs.forEach(o => finite(`massesKg.${o}`, init.massesKg[o]));
  nutrients.forEach(n => finite(`tissueFractions.${n}`, init.tissueFractions[n]));
  const forms = structuredClone(init.forms ?? formsTable());
  // plants.forms.allometry_agb_eq4 needs density AND a height/diameter relation; neither is
  // in this schema. Inverting one biomass equation for two unknowns would invent a form.
  if (isTree) throw new PlantFormError("allometry_height_diameter");
  const cellTypes: Record<PlantOrganName, string> = {
    leaf: "leaf-mesophyll", stem: isTree ? "stem-wood" : "stem-storage-parenchyma",
    root: "root-absorptive", rhizome: "rhizome",
  };
  const organState = Object.fromEntries(organs.map(o => {
    const population = createTissuePopulation({ id: o, organ: o, cellType: cellTypes[o], region: null,
      viableMassKg: init.massesKg[o], capacity: 1, injury: 0, repairCapacity: null,
      senescentFraction: 0, fibroticFraction: 0,
      turnoverPerDay: o === "leaf" || o === "root" ? p(`${o}_turnover`) / 365 : null });
    // Intact initial capacity and zero accumulated damage define a new, healthy compartment.
    const fraction = parameters.meristem_fraction;
    const populations = [population];
    if (typeof fraction === "number" && fraction > 0) {
      const meristemMass = population.viableMassKg * fraction;
      population.viableMassKg -= meristemMass;
      populations.push({ ...population, id: `${o}:meristem`, cellType: "meristem", viableMassKg: meristemMass });
    }
    return [o, { populations }];
  })) as Plant["developmental"]["organs"];
  const plant: Plant = {
    genetic: Object.freeze({ cultivar: init.cultivar, variants: Object.freeze({ ...init.variants }) }),
    developmental: { ageDays: init.ageDays, organs: organState, leafAreaM2: 0, reserveKg: init.reserveKg,
      heightM: null, stemDiameterCm: null, maturity: "juvenile" },
    organism: { waterStatus: init.waterStatus, waterKg: init.waterKg, nutrientsKg: emptyNutrients(),
      tissueFractions: { ...init.tissueFractions }, accumulatedStressDays: 0, alive: true, cause: null },
    parameters: Object.freeze(parameters), forms, groundAreaM2: init.groundAreaM2,
    ledger: { initial: { carbon: 0, water: 0, nutrients: emptyNutrients() }, totals: zeroFlux() },
  };
  for (const n of nutrients) plant.organism.nutrientsKg[n] = liveMass(plant) * p(`critical_${n}`) / 100 * init.tissueFractions[n];
  refresh(plant);
  plant.ledger.initial = inventory(plant);
  return plant;
}

/** Same immutable genotype, independent populations and ledger history. */
export function clonePlant(parent: Plant): Plant {
  const clone = structuredClone(parent);
  clone.genetic = parent.genetic;
  clone.parameters = parent.parameters;
  return clone;
}

function environment(env: PlantEnvironment, key: Exclude<keyof PlantEnvironment, "soilWater">, min = 0): number {
  const value = env[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) throw new PlantEnvironmentError(key);
  return value;
}

function factors(plant: Plant, env: PlantEnvironment): PlantFluxes["factors"] {
  const p = (k: string) => param(plant, k);
  const f = plant.forms;
  const temperature = plantTemperatureFactor(environment(env, "airTemperatureC", -Infinity), p("t_min"), p("t_opt"), p("t_max"), f);
  if (!env.soilWater || !Number.isFinite(env.soilWater.availableKg) || env.soilWater.availableKg < 0 ||
    !Number.isFinite(env.soilWater.totalAvailableKg) || env.soilWater.totalAvailableKg <= 0)
    throw new PlantEnvironmentError("soilWater");
  const water = plantWaterFactor(env.soilWater.availableKg, env.soilWater.totalAvailableKg, p("depletion_fraction_p"), f);
  const s = environment(env, "salinity");
  let salinity: number;
  if (Object.hasOwn(plant.parameters, "salinity_opt")) {
    // plants.forms.salinity_beta_function is absent; never borrow a temperature response silently.
    form("salinity_beta_function", f);
    const min = p("salinity_min"), opt = p("salinity_opt"), max = p("salinity_max");
    if (!(min < opt && opt < max)) throw new PlantParameterError(["salinity cardinal order"]);
    salinity = s <= min || s >= max ? 0 : clamp((max - s) / (max - opt) * ((s - min) / (opt - min)) ** ((opt - min) / (max - opt)));
  } else salinity = plantSalinityFactor(s, p("salinity_threshold"), p("salinity_slope"), f);
  // plants.forms.critical_nutrient_concentration defines critical; the linear fraction is Rex's rule.
  form("critical_nutrient_concentration", f);
  form("liebig_law_of_minimum", f); // plants.forms.liebig_law_of_minimum
  const mass = liveMass(plant);
  const nutrient = Math.min(...nutrients.map(n => mass === 0 ? 0 : clamp(plant.organism.nutrientsKg[n] / (mass * p(`critical_${n}`) / 100))));
  const ph = plantPhFactor(environment(env, "soilPh"), p("ph_min"), p("ph_opt_low"), p("ph_opt_high"), p("ph_max"), f);
  // plants.forms.stress_combination_multiplicative plus Rex's nutrient minimum (2026-10-31).
  form("stress_combination_multiplicative", f);
  const co2 = 1; // Unsourced neutral CO2 response, explicitly required; flags/plants.md (2815).
  return { temperature, water, salinity, nutrients: nutrient, ph, co2, combined: temperature * water * salinity * nutrient * ph * co2 };
}

/** Level 4 assumption: organ allocation is spread by viable-mass share, not a second pool.
 * A single empty population can restart; several empty populations have no defined shares. */
function allocate(plant: Plant, organ: PlantOrganName, mass: number): void {
  if (mass === 0) return;
  const pops = plant.developmental.organs[organ].populations;
  const total = organAggregate(pops).viableMassKg;
  if (total === 0 && pops.length !== 1) throw new PlantParameterError([`${organ}: empty population allocation shares`]);
  let remaining = mass;
  pops.forEach((pop, i) => {
    const add = i === pops.length - 1 ? remaining : mass * pop.viableMassKg / total;
    pop.viableMassKg += add;
    remaining -= add;
  });
}

function removeNutrients(plant: Plant, mass: number, concentration: NutrientValues, litter: PlantLitter): void {
  for (const n of nutrients) {
    const out = Math.min(plant.organism.nutrientsKg[n], mass * concentration[n]);
    plant.organism.nutrientsKg[n] -= out;
    litter.nutrientsKg[n] += out;
  }
}

/** One explicit interval at constant forcing; days is not an internal subdivision or convergence claim.
 * Works on a copy first: any missing input/form leaves the caller's state and ledger unchanged. */
export function stepPlant(plant: Plant, env: PlantEnvironment, days: number): PlantFluxes {
  finite("days", days);
  if (days === 0 || !plant.organism.alive) return zeroFlux();
  const next = clonePlant(plant);
  const flux = advance(next, env, days);
  plant.developmental = next.developmental;
  plant.organism = next.organism;
  plant.ledger = next.ledger;
  return flux;
}

function advance(plant: Plant, env: PlantEnvironment, days: number): PlantFluxes {
  const p = (k: string) => param(plant, k), f = plant.forms;
  const flux = zeroFlux();
  flux.factors = factors(plant, env);
  const par = environment(env, "par");
  const supplies = { n: environment(env, "availableN"), p: environment(env, "availableP"), k: environment(env, "availableK") };
  // No VPD/CO2 response is implemented, so neither input is required or defaulted.
  if (Object.hasOwn(plant.parameters, "inundation_tolerance")) {
    environment(env, "inundation");
    throw new PlantFormError("inundation_response");
  }
  let light = par;
  if (env.waterDepthM !== undefined || env.kdPerM !== undefined || Object.hasOwn(plant.parameters, "depth_min")) {
    form("water_light_at_depth", f); // plants.forms.water_light_at_depth
    light *= Math.exp(-environment(env, "kdPerM") * environment(env, "waterDepthM"));
  }
  form("canopy_light_interception", f); // plants.forms.canopy_light_interception
  const k = Object.hasOwn(plant.parameters, "canopy_extinction_k") ? p("canopy_extinction_k") : constant("canopy_extinction_k", f);
  const area = plantOrganMasses(plant).leaf * p("specific_leaf_area");
  const absorbed = light * plant.groundAreaM2 * -Math.expm1(-k * area / plant.groundAreaM2);
  form("rue_definition", f); // plants.forms.rue_definition; g/MJ -> kg/MJ is a unit conversion.
  flux.grossDryMassKg = p("radiation_use_efficiency") / 1000 * absorbed * flux.factors.combined * days;
  const carbon = p("carbon_fraction");
  flux.co2TakenKgC = flux.grossDryMassKg * carbon;
  // plants.forms.photosynthetic_oxygen_per_carbon is absent: no invented gas stoichiometry.
  flux.o2ReleasedKg = flux.co2TakenKgC * constant("photosynthetic_oxygen_per_carbon", f);
  form("respiration_growth_maintenance", f); // plants.forms.respiration_growth_maintenance
  form("respiration_q10", f); // plants.forms.respiration_q10; 25 C reference and 10 C interval are definitions.
  // The schema says fraction of total respiration, while the design requests a growth efficiency.
  // Require an explicit convention from the data provider rather than silently reinterpret it.
  form("growth_respiration_fraction_of_assimilate", f);
  const massBefore = liveMass(plant);
  const concentration = Object.fromEntries(nutrients.map(n => [n, massBefore === 0 ? 0 : plant.organism.nutrientsKg[n] / massBefore])) as NutrientValues;
  const maintenance = massBefore * p("maintenance_resp_25c") * p("q10") ** ((environment(env, "airTemperatureC", -Infinity) - 25) / 10) * days;
  if (!Number.isFinite(maintenance) || !Number.isFinite(flux.grossDryMassKg)) throw new RangeError("plant: nonfinite metabolic flux");
  const net = flux.grossDryMassKg - maintenance;
  if (net >= 0) {
    const growthResp = net * p("growth_resp_fraction");
    const growth = net - growthResp;
    flux.co2ReleasedKgC = (maintenance + growthResp) * carbon;
    for (const o of organs) allocate(plant, o, growth * (o === "rhizome" && !Object.hasOwn(plant.parameters, "alloc_rhizome") ? 0 : p(`alloc_${o}`)));
    for (const n of nutrients) {
      const demand = Math.max(0, liveMass(plant) * p(`critical_${n}`) / 100 - plant.organism.nutrientsKg[n]);
      flux.nutrientsTakenKg[n] = Math.min(demand, supplies[n]);
      plant.organism.nutrientsKg[n] += flux.nutrientsTakenKg[n];
    }
  } else {
    let debt = -net;
    const reservePaid = Math.min(plant.developmental.reserveKg, debt);
    plant.developmental.reserveKg -= reservePaid;
    debt -= reservePaid;
    const leaf = plant.developmental.organs.leaf.populations;
    const leafMass = organAggregate(leaf).viableMassKg;
    const leafPaid = Math.min(leafMass, debt);
    leaf.forEach(pop => { pop.viableMassKg *= leafMass === 0 ? 0 : 1 - leafPaid / leafMass; });
    // Oxidised tissue's N/P/K becomes nutrient residue in litter; its C is respiration, not litter C.
    removeNutrients(plant, leafPaid, concentration, flux.litter.leaf);
    flux.co2ReleasedKgC = (flux.grossDryMassKg + reservePaid + leafPaid) * carbon;
  }
  // Water-use efficiency in g dry mass/kg water; gross assimilation defines this interval's demand.
  flux.waterTakenKg = Math.min(env.soilWater!.availableKg, flux.grossDryMassKg * 1000 / p("water_use_efficiency"));
  flux.waterTranspiredKg = flux.waterTakenKg;
  plant.organism.waterStatus = clamp((env.soilWater!.availableKg - flux.waterTakenKg) / env.soilWater!.totalAvailableKg);
  const massAtTurnover = liveMass(plant);
  const turnoverConcentration = Object.fromEntries(nutrients.map(n => [n, massAtTurnover === 0 ? 0 : plant.organism.nutrientsKg[n] / massAtTurnover])) as NutrientValues;
  for (const o of organs) {
    for (const pop of plant.developmental.organs[o].populations) {
      // No tissue-response source is opened: null injury, repair AND matrix rates (2815).
      const loss = stepTissue(pop, days, { injuryRate: null, repairRate: null, matrixChangeRate: null }).deadMassKg;
      flux.litter[o].dryMassKg += loss;
      flux.litter[o].carbonKg += loss * carbon;
      removeNutrients(plant, loss, turnoverConcentration, flux.litter[o]);
    }
  }
  if (plant.developmental.reserveKg === 0 && plantOrganMasses(plant).leaf === 0) {
    plant.organism.alive = false;
    plant.organism.cause = "carbon starvation";
    // Death opens detritus fluxes; no remaining structural mass disappears.
    const remainingMass = liveMass(plant);
    const deathConcentration = Object.fromEntries(nutrients.map(n => [n, remainingMass === 0 ? 0 : plant.organism.nutrientsKg[n] / remainingMass])) as NutrientValues;
    for (const o of organs) for (const pop of plant.developmental.organs[o].populations) {
      flux.litter[o].dryMassKg += pop.viableMassKg;
      flux.litter[o].carbonKg += pop.viableMassKg * carbon;
      removeNutrients(plant, pop.viableMassKg, deathConcentration, flux.litter[o]);
      pop.viableMassKg = 0;
    }
  }
  plant.developmental.ageDays += days;
  plant.organism.accumulatedStressDays += (1 - flux.factors.combined) * days;
  refresh(plant);
  const totals = plant.ledger.totals;
  for (const key of ["grossDryMassKg", "co2TakenKgC", "co2ReleasedKgC", "o2ReleasedKg", "waterTakenKg", "waterTranspiredKg"] as const) totals[key] += flux[key];
  for (const n of nutrients) totals.nutrientsTakenKg[n] += flux.nutrientsTakenKg[n];
  for (const o of organs) {
    totals.litter[o].dryMassKg += flux.litter[o].dryMassKg;
    totals.litter[o].carbonKg += flux.litter[o].carbonKg;
    for (const n of nutrients) totals.litter[o].nutrientsKg[n] += flux.litter[o].nutrientsKg[n];
  }
  totals.factors = { ...flux.factors };
  return flux;
}

/** Absolute residuals in kg C, kg water, and kg N/P/K, independently using initial/current inventories. */
export function plantLedgerError(plant: Plant): { carbon: number; water: number; n: number; p: number; k: number } {
  const current = inventory(plant), { initial, totals } = plant.ledger;
  const result = { carbon: initial.carbon + totals.co2TakenKgC - current.carbon - totals.co2ReleasedKgC -
    organs.reduce((sum, o) => sum + totals.litter[o].carbonKg, 0),
  water: initial.water + totals.waterTakenKg - current.water - totals.waterTranspiredKg, n: 0, p: 0, k: 0 };
  for (const n of nutrients) result[n] = initial.nutrients[n] + totals.nutrientsTakenKg[n] - current.nutrients[n] -
    organs.reduce((sum, o) => sum + totals.litter[o].nutrientsKg[n], 0);
  return result;
}
