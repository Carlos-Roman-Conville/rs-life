/** Plant physiology and resolution; parameters and supported forms are explicit data. */
import { SECOND, transaction, transfer } from "@rex/kernel";
import { libraryTable } from "./library.js";
import { createTissuePopulation, mergeRegions, organAggregate, splitRegions, stepTissue } from "./tissue.js";
import { NutrientLedger, SoilCell, transferNutrient } from "./soils.js";
import { Trace } from "./trace.js";
export class PlantParameterError extends Error {
    constructor(fields) { super(`plant: missing or invalid species values: ${fields.join(", ")}`); this.name = "PlantParameterError"; }
}
export class PlantFormError extends Error {
    constructor(id) { super(`plant: unavailable form or constant plants.forms.${id}`); this.name = "PlantFormError"; }
}
export class PlantEnvironmentError extends Error {
    constructor(field) { super(`plant: missing or invalid env.${field}`); this.name = "PlantEnvironmentError"; }
}
const formsTable = () => libraryTable("plants", "forms");
function form(id, forms) {
    const row = forms.find(r => r.id === `plants.forms.${id}`);
    // Equation rows intentionally have Value=null: their researched definition lives in Note.
    // A missing definition (or an unresearched placeholder) is unavailable, never a default.
    if (!row || typeof row.Note !== "string" || !row.Note.trim() || !row.Label || row.source === "open")
        throw new PlantFormError(id);
    return row;
}
function constant(id, forms) {
    const value = form(id, forms).Value;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
        throw new PlantFormError(id);
    return value;
}
const clamp = (x) => Math.max(0, Math.min(1, x));
function finite(name, value, min = 0, max = Infinity) {
    if (!Number.isFinite(value) || value < min || value > max)
        throw new RangeError(`plant: invalid ${name}`);
    return value;
}
/** plants.forms.temperature_beta_function supports a zero base only (2808).
 * A nonzero base requires the separately sourced cardinal form, currently absent. */
export function plantTemperatureFactor(t, min, opt, max, forms = formsTable()) {
    form(min === 0 ? "temperature_beta_function" : "temperature_cardinal_beta_function", forms);
    finite("temperature", t, -Infinity);
    if (!(min < opt && opt < max))
        throw new PlantParameterError(["t_min < t_opt < t_max"]);
    if (t <= min || t >= max)
        return 0;
    return clamp((max - t) / (max - opt) * ((t - min) / (opt - min)) ** ((opt - min) / (max - opt)));
}
/** plants.forms.fao56_ks: remaining available water is TAW - Dr; units cancel. */
export function plantWaterFactor(available, totalAvailable, p, forms = formsTable()) {
    form("fao56_ks", forms);
    finite("available water", available);
    if (!(totalAvailable > 0) || !Number.isFinite(totalAvailable) || !(p >= 0 && p < 1))
        throw new PlantParameterError(["totalAvailableWater > 0", "0 <= depletion_fraction_p < 1"]);
    return clamp(available / (totalAvailable * (1 - p)));
}
/** plants.forms.salinity_threshold_slope; slope is percent per conductivity unit. */
export function plantSalinityFactor(s, threshold, slope, forms = formsTable()) {
    form("salinity_threshold_slope", forms);
    finite("salinity", s);
    finite("salinity threshold", threshold);
    finite("salinity slope", slope);
    return clamp(1 - Math.max(0, s - threshold) * slope / 100);
}
/** plants.forms.ph_trapezoid is absent in the current library: calling it throws. */
export function plantPhFactor(ph, min, low, high, max, forms = formsTable()) {
    form("ph_trapezoid", forms);
    finite("pH", ph, 0, 14);
    if (!(min < low && low <= high && high < max))
        throw new PlantParameterError(["pH cardinal order"]);
    if (ph <= min || ph >= max)
        return 0;
    return clamp(Math.min((ph - min) / (low - min), (max - ph) / (max - high)));
}
const organs = ["leaf", "stem", "root", "rhizome"];
const nutrients = ["n", "p", "k"];
const emptyNutrients = () => ({ n: 0, p: 0, k: 0 });
function zeroFlux() {
    const litter = Object.fromEntries(organs.map(o => [o, { dryMassKg: 0, carbonKg: 0, nutrientsKg: emptyNutrients() }]));
    return { grossDryMassKg: 0, co2TakenKgC: 0, co2ReleasedKgC: 0, o2ReleasedKg: 0,
        waterTakenKg: 0, waterTranspiredKg: 0, nutrientsTakenKg: emptyNutrients(), litter,
        factors: { temperature: 0, water: 0, salinity: 0, nutrients: 0, ph: 0, co2: 0, combined: 0 } };
}
const param = (plant, field) => plant.parameters[field];
export function plantOrganMasses(plant) {
    return Object.fromEntries(organs.map(o => [o, organAggregate(plant.developmental.organs[o].populations).viableMassKg]));
}
function liveMass(plant) { return Object.values(plantOrganMasses(plant)).reduce((a, b) => a + b, 0); }
function inventory(plant) {
    return { carbon: (liveMass(plant) + plant.developmental.reserveKg) * param(plant, "carbon_fraction"),
        water: plant.organism.waterKg, nutrients: { ...plant.organism.nutrientsKg } };
}
function refresh(plant) {
    const mass = liveMass(plant);
    plant.developmental.leafAreaM2 = plantOrganMasses(plant).leaf * param(plant, "specific_leaf_area");
    for (const n of nutrients)
        plant.organism.tissueFractions[n] = mass === 0 ? 0 :
            plant.organism.nutrientsKg[n] / (mass * param(plant, `critical_${n}`) / 100);
    // A 365-day model year is a unit convention. No invented size-at-maturity threshold:
    // reproductive status requires living biomass and the table's age; see flags/plants.md.
    plant.developmental.maturity = mass > 0 && plant.developmental.ageDays >= param(plant, "age_at_maturity") * 365
        ? "reproductive" : "juvenile";
    if (typeof plant.parameters.lifespan === "number" && plant.developmental.ageDays >= plant.parameters.lifespan * 365)
        plant.developmental.maturity = "senescent";
}
/** Reads schema Field names, never positional species cells. All missing required rows are reported together. */
export function createPlant(speciesTable, init) {
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
    if (Object.hasOwn(parameters, "canopy_extinction_k"))
        required.push("canopy_extinction_k");
    if (Object.hasOwn(parameters, "alloc_rhizome") || init.massesKg.rhizome > 0)
        required.push("alloc_rhizome");
    if (Object.hasOwn(parameters, "salinity_opt"))
        required.push("salinity_min", "salinity_opt", "salinity_max");
    else
        required.push("salinity_threshold", "salinity_slope");
    if (isTree)
        required.push("allometry_a", "allometry_b", "max_height", "max_stem_diameter");
    const missing = required.filter(k => k === "life_form" ? typeof parameters[k] !== "string" || !parameters[k] :
        typeof parameters[k] !== "number" || !Number.isFinite(parameters[k]));
    if (missing.length)
        throw new PlantParameterError(missing);
    const p = (k) => parameters[k];
    const invalid = [];
    for (const key of required.filter(k => k !== "life_form" && !["t_min", "t_opt", "t_max"].includes(k)))
        if (p(key) < 0)
            invalid.push(key);
    for (const key of ["water_use_efficiency", "specific_leaf_area", "critical_n", "critical_p", "critical_k", "q10", "carbon_fraction"])
        if (p(key) <= 0)
            invalid.push(key);
    if (!(p("t_min") < p("t_opt") && p("t_opt") < p("t_max")))
        invalid.push("temperature cardinal order");
    if (!(p("ph_min") < p("ph_opt_low") && p("ph_opt_low") <= p("ph_opt_high") && p("ph_opt_high") < p("ph_max") && p("ph_max") <= 14))
        invalid.push("pH cardinal order");
    if (p("depletion_fraction_p") >= 1)
        invalid.push("depletion_fraction_p");
    if (p("growth_resp_fraction") >= 1)
        invalid.push("growth_resp_fraction");
    if (p("carbon_fraction") > 1)
        invalid.push("carbon_fraction");
    const allocation = organs.map(o => o === "rhizome" && !Object.hasOwn(parameters, "alloc_rhizome") ? 0 : p(`alloc_${o}`));
    if (allocation.some(v => v < 0 || v > 1) || Math.abs(allocation.reduce((a, b) => a + b, 0) - 1) > 1e-12)
        invalid.push("allocation fractions must sum to one");
    if (parameters.meristem_fraction != null && (typeof parameters.meristem_fraction !== "number" ||
        !Number.isFinite(parameters.meristem_fraction) || parameters.meristem_fraction < 0 || parameters.meristem_fraction >= 1))
        invalid.push("meristem_fraction");
    if (invalid.length)
        throw new PlantParameterError(invalid);
    finite("ageDays", init.ageDays);
    finite("reserveKg", init.reserveKg);
    finite("waterKg", init.waterKg);
    finite("waterStatus", init.waterStatus, 0, 1);
    finite("groundAreaM2", init.groundAreaM2, Number.MIN_VALUE);
    organs.forEach(o => finite(`massesKg.${o}`, init.massesKg[o]));
    nutrients.forEach(n => finite(`tissueFractions.${n}`, init.tissueFractions[n]));
    const forms = structuredClone(init.forms ?? formsTable());
    // plants.forms.allometry_agb_eq4 needs density AND a height/diameter relation; neither is
    // in this schema. Inverting one biomass equation for two unknowns would invent a form.
    if (isTree)
        throw new PlantFormError("allometry_height_diameter");
    const cellTypes = {
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
    }));
    const plant = {
        id: init.id ?? null, region: init.region ?? null,
        species: init.speciesId ?? (typeof speciesTable === "string" ? speciesTable : null),
        genetic: Object.freeze({ cultivar: init.cultivar, variants: Object.freeze({ ...init.variants }) }),
        developmental: { ageDays: init.ageDays, organs: organState, leafAreaM2: 0, reserveKg: init.reserveKg,
            heightM: null, stemDiameterCm: null, maturity: "juvenile" },
        organism: { waterStatus: init.waterStatus, waterKg: init.waterKg, nutrientsKg: emptyNutrients(),
            tissueFractions: { ...init.tissueFractions }, accumulatedStressDays: 0, alive: true, cause: null },
        parameters: Object.freeze(parameters), forms, groundAreaM2: init.groundAreaM2,
        ledger: { initial: { carbon: 0, water: 0, nutrients: emptyNutrients() }, totals: zeroFlux(), notes: [] },
    };
    for (const n of nutrients)
        plant.organism.nutrientsKg[n] = liveMass(plant) * p(`critical_${n}`) / 100 * init.tissueFractions[n];
    refresh(plant);
    plant.ledger.initial = inventory(plant);
    return plant;
}
/** Same immutable genotype, independent populations and ledger history. */
export function clonePlant(parent) {
    const clone = structuredClone(parent);
    clone.genetic = parent.genetic;
    clone.parameters = parent.parameters;
    return clone;
}
/** A fresh read, including the existing carbohydrate reserve; never an integrated stock. */
export function vegetationStock(records, region) {
    const organsKg = { leaf: 0, stem: 0, root: 0, rhizome: 0 };
    let reserveKg = 0;
    for (const record of records.filter(p => p.region === region)) {
        const mass = plantOrganMasses(record);
        for (const o of organs)
            organsKg[o] += mass[o];
        reserveKg += record.developmental.reserveKg;
    }
    return { organsKg, reserveKg, totalKg: Object.values(organsKg).reduce((a, b) => a + b, reserveKg) };
}
function identified(plant) {
    if (!plant.id?.trim() || !plant.region?.trim() || !plant.species?.trim())
        throw new Error("plant: host id, region and species identity required");
}
/** All extensive values outside tissue populations, including accounting history. */
function mapPools(target, sources, combine) {
    target.groundAreaM2 = combine(sources.map(p => p.groundAreaM2));
    target.developmental.reserveKg = combine(sources.map(p => p.developmental.reserveKg));
    target.organism.waterKg = combine(sources.map(p => p.organism.waterKg));
    for (const n of nutrients) {
        target.organism.nutrientsKg[n] = combine(sources.map(p => p.organism.nutrientsKg[n]));
        target.ledger.initial.nutrients[n] = combine(sources.map(p => p.ledger.initial.nutrients[n]));
        target.ledger.totals.nutrientsTakenKg[n] = combine(sources.map(p => p.ledger.totals.nutrientsTakenKg[n]));
    }
    for (const key of ["carbon", "water"])
        target.ledger.initial[key] = combine(sources.map(p => p.ledger.initial[key]));
    for (const key of ["grossDryMassKg", "co2TakenKgC", "co2ReleasedKgC", "o2ReleasedKg", "waterTakenKg", "waterTranspiredKg"])
        target.ledger.totals[key] = combine(sources.map(p => p.ledger.totals[key]));
    for (const o of organs) {
        for (const key of ["dryMassKg", "carbonKg"])
            target.ledger.totals.litter[o][key] = combine(sources.map(p => p.ledger.totals.litter[o][key]));
        for (const n of nutrients)
            target.ledger.totals.litter[o].nutrientsKg[n] = combine(sources.map(p => p.ledger.totals.litter[o].nutrientsKg[n]));
    }
}
function resolutionNote(plant, text, trace, t) {
    plant.ledger.notes.push({ t, text });
    trace?.note(t, text);
}
/** Replace the input records with the result in the host registry (do not retain both resolutions).
 * Tissue states follow mergeRegions; organism age/stress/water status use ground-area means.
 * Distinct genotypes, forms or life/death states cannot be represented by this single record. */
export function coarsen(records, trace, t = 0) {
    if (!records.length)
        throw new Error("plant: no records to coarsen");
    records.forEach(identified);
    if (new Set(records.map(p => p.id)).size !== records.length)
        throw new Error("plant: duplicate record id");
    const first = records[0];
    for (const p of records) {
        if (p.region !== first.region || p.species !== first.species ||
            JSON.stringify(p.parameters) !== JSON.stringify(first.parameters) ||
            JSON.stringify(p.genetic) !== JSON.stringify(first.genetic) ||
            JSON.stringify(p.forms) !== JSON.stringify(first.forms) ||
            p.organism.alive !== first.organism.alive || p.organism.cause !== first.organism.cause ||
            p.developmental.heightM !== first.developmental.heightM || p.developmental.stemDiameterCm !== first.developmental.stemDiameterCm)
            throw new Error("plant: incompatible records to coarsen");
        finite("groundAreaM2", p.groundAreaM2, Number.MIN_VALUE);
    }
    const result = clonePlant(first);
    result.id = `coarse:${JSON.stringify(records.map(p => p.id).sort())}`;
    mapPools(result, records, xs => xs.reduce((a, b) => a + b, 0));
    const mean = (get) => records.reduce((sum, p) => sum + get(p) * p.groundAreaM2, 0) / result.groundAreaM2;
    result.developmental.ageDays = mean(p => p.developmental.ageDays);
    result.organism.accumulatedStressDays = mean(p => p.organism.accumulatedStressDays);
    result.organism.waterStatus = mean(p => p.organism.waterStatus);
    for (const key of Object.keys(result.ledger.totals.factors))
        result.ledger.totals.factors[key] = mean(p => p.ledger.totals.factors[key]);
    for (const o of organs) {
        const groups = new Map();
        for (const p of records)
            for (const pop of p.developmental.organs[o].populations) {
                const key = JSON.stringify([pop.id, pop.cellType, pop.region ?? null]);
                const group = groups.get(key) ?? [];
                group.push(pop);
                groups.set(key, group);
            }
        result.developmental.organs[o].populations = [...groups.values()].map(group => ({
            ...mergeRegions(group), region: group[0].region,
        }));
    }
    result.ledger.notes = records.flatMap(p => p.ledger.notes.map(note => ({ ...note })));
    refresh(result);
    resolutionNote(result, `plant.coarsen: ${records.map(p => p.id).join(", ")} -> ${result.id}; representation only`, trace, t);
    return result;
}
/** Positive shares name child records, not new places. The last child receives roundoff remainders. */
export function refine(record, shares, trace, t = 0) {
    identified(record);
    finite("groundAreaM2", record.groundAreaM2, Number.MIN_VALUE);
    const entries = Object.entries(shares);
    if (!entries.length || entries.some(([id, share]) => !id.trim() || !Number.isFinite(share) || share <= 0 || share > 1) ||
        Math.abs(entries.reduce((sum, [, share]) => sum + share, 0) - 1) > 1e-12)
        throw new Error("plant: positive refinement shares must sum to one");
    const remaining = clonePlant(record);
    const children = entries.map(([id, share], i) => {
        const child = clonePlant(record);
        child.id = `${record.id}/${id}`;
        mapPools(child, [record, remaining], ([whole, rest]) => i === entries.length - 1 ? rest : Math.min(rest, whole * share));
        if (child.groundAreaM2 <= 0)
            throw new Error("plant: refinement shares leave an empty ground area");
        mapPools(remaining, [remaining, child], ([rest, part]) => rest - part);
        return child;
    });
    for (const o of organs) {
        const splits = record.developmental.organs[o].populations.map(pop => splitRegions(pop, shares));
        children.forEach((child, i) => {
            child.developmental.organs[o].populations = splits.map((split, j) => ({
                ...split[i], region: record.developmental.organs[o].populations[j].region,
            }));
        });
    }
    for (const child of children) {
        refresh(child);
        resolutionNote(child, `plant.refine: ${record.id} -> ${child.id}; representation only`, undefined, t);
    }
    trace?.note(t, `plant.refine: ${record.id} -> ${children.map(p => p.id).join(", ")}; representation only`);
    return children;
}
const soilElement = { n: "N", p: "P", k: "K" };
/** A destination adapter, not a second account: the kernel credit writes tissue itself.
 * The host NutrientLedger continues to hold only non-plant accounts. */
class PlantNutrientAccount extends NutrientLedger {
    plant;
    constructor(plant, ledger) {
        identified(plant);
        super({}, ledger.journal, `plant-tissue:${plant.id}`);
        this.plant = plant;
        if (nutrients.some(n => ledger.balance(`plant:${plant.id}`, soilElement[n]) !== 0))
            throw new Error("plant: duplicate plant stock in host nutrient ledger");
    }
    unit(account, quantity) {
        if (account !== `plant:${this.plant.id}`)
            throw new Error("plant: unknown tissue account");
        return super.unit(account, quantity);
    }
    balance(account, el) {
        this.unit(account, `nutrient:${el}`);
        return this.plant.organism.nutrientsKg[el.toLowerCase()];
    }
    total(el) { return this.balance(`plant:${this.plant.id}`, el); }
    apply(account, quantity, delta) {
        this.unit(account, quantity);
        const n = quantity.slice("nutrient:".length).toLowerCase();
        this.plant.organism.nutrientsKg[n] = finite("tissue nutrient balance", this.plant.organism.nutrientsKg[n] + delta);
    }
    snapshot() {
        return new Map([[`plant:${this.plant.id}`, { N: this.total("N"), P: this.total("P"), K: this.total("K") }]]);
    }
    restore(snapshot) {
        const pool = snapshot.get(`plant:${this.plant.id}`);
        this.plant.organism.nutrientsKg = { n: pool.N, p: pool.P, k: pool.K };
    }
}
function appendTrace(target, pending) {
    if (!target)
        return;
    for (const entry of pending.transfers)
        target.record(entry);
    for (const check of pending.checks)
        target.check(check.t, check.quantity, check.expected, check.actual, check.tolerance);
}
/** One immediate soil debit/tissue credit per nonzero element; all elements roll back on refusal.
 * Call with a new uptake flux, never reapply a flux returned by an already integrated step. */
export function plantUptake(cell, plant, fluxes, ledger, trace, t = 0) {
    const tissue = new PlantNutrientAccount(plant, ledger), pending = new Trace();
    transaction([cell, tissue, ledger.journal], () => {
        for (const n of nutrients)
            transferNutrient(cell, soilElement[n], fluxes.nutrientsTakenKg[n], `plant:${plant.id}`, "plant.uptake", tissue, pending, t);
    });
    for (const n of nutrients)
        plant.ledger.totals.nutrientsTakenKg[n] += fluxes.nutrientsTakenKg[n];
    refresh(plant);
    appendTrace(trace, pending);
}
function litterTransfer(plant, n, q, soil) {
    if (q === 0)
        return;
    const tissue = new PlantNutrientAccount(plant, soil.ledger), quantity = `nutrient:${soilElement[n]}`;
    transfer(soil.ledger.journal, { t: soil.t * SECOND, process: "plant.litter", quantity, unit: "kg", amount: q,
        from: { ledger: tissue, account: `plant:${plant.id}` }, to: { ledger: soil.ledger, account: "detritus" } });
    soil.trace?.record({ t: soil.t, process: "plant.litter", quantity, amount: q, from: `plant:${plant.id}`, to: "detritus" });
}
function environment(env, key, min = 0) {
    const value = env[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min)
        throw new PlantEnvironmentError(key);
    return value;
}
function factors(plant, env) {
    const p = (k) => param(plant, k);
    const f = plant.forms;
    const temperature = plantTemperatureFactor(environment(env, "airTemperatureC", -Infinity), p("t_min"), p("t_opt"), p("t_max"), f);
    if (!env.soilWater || !Number.isFinite(env.soilWater.availableKg) || env.soilWater.availableKg < 0 ||
        !Number.isFinite(env.soilWater.totalAvailableKg) || env.soilWater.totalAvailableKg <= 0)
        throw new PlantEnvironmentError("soilWater");
    const water = plantWaterFactor(env.soilWater.availableKg, env.soilWater.totalAvailableKg, p("depletion_fraction_p"), f);
    const s = environment(env, "salinity");
    let salinity;
    if (Object.hasOwn(plant.parameters, "salinity_opt")) {
        // plants.forms.salinity_beta_function is absent; never borrow a temperature response silently.
        form("salinity_beta_function", f);
        const min = p("salinity_min"), opt = p("salinity_opt"), max = p("salinity_max");
        if (!(min < opt && opt < max))
            throw new PlantParameterError(["salinity cardinal order"]);
        salinity = s <= min || s >= max ? 0 : clamp((max - s) / (max - opt) * ((s - min) / (opt - min)) ** ((opt - min) / (max - opt)));
    }
    else
        salinity = plantSalinityFactor(s, p("salinity_threshold"), p("salinity_slope"), f);
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
function allocate(plant, organ, mass) {
    if (mass === 0)
        return;
    const pops = plant.developmental.organs[organ].populations;
    const total = organAggregate(pops).viableMassKg;
    if (total === 0 && pops.length !== 1)
        throw new PlantParameterError([`${organ}: empty population allocation shares`]);
    let remaining = mass;
    pops.forEach((pop, i) => {
        const add = i === pops.length - 1 ? remaining : mass * pop.viableMassKg / total;
        pop.viableMassKg += add;
        remaining -= add;
    });
}
function removeNutrients(plant, mass, concentration, litter, soil) {
    for (const n of nutrients) {
        const out = Math.min(plant.organism.nutrientsKg[n], mass * concentration[n]);
        if (soil)
            litterTransfer(plant, n, out, soil);
        else
            plant.organism.nutrientsKg[n] -= out;
        litter.nutrientsKg[n] += out;
    }
}
/** One explicit interval at constant forcing; days is not an internal subdivision or convergence claim.
 * Works on a copy first: any missing input/form leaves the caller's state and ledger unchanged. */
export function stepPlant(plant, env, days, soil) {
    finite("days", days);
    if (days === 0 || !plant.organism.alive)
        return zeroFlux();
    const next = clonePlant(plant);
    let flux;
    if (soil) {
        const pending = new Trace();
        // Host supplies are kg for this record and interval. The cell also bounds them:
        // hosts can pass poolPerArea(cell, el) * rootAreaM2 for a smaller root zone.
        const capped = { ...env,
            availableN: Math.min(environment(env, "availableN"), soil.cell.pool.N),
            availableP: Math.min(environment(env, "availableP"), soil.cell.pool.P),
            availableK: Math.min(environment(env, "availableK"), soil.cell.pool.K) };
        flux = transaction([soil.cell, soil.ledger, soil.ledger.journal], () => advance(next, capped, days, { ...soil, trace: pending }));
        appendTrace(soil.trace, pending);
    }
    else
        flux = advance(next, env, days);
    plant.developmental = next.developmental;
    plant.organism = next.organism;
    plant.ledger = next.ledger;
    return flux;
}
function advance(plant, env, days, soil) {
    const p = (k) => param(plant, k), f = plant.forms;
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
    const concentration = Object.fromEntries(nutrients.map(n => [n, massBefore === 0 ? 0 : plant.organism.nutrientsKg[n] / massBefore]));
    const maintenance = massBefore * p("maintenance_resp_25c") * p("q10") ** ((environment(env, "airTemperatureC", -Infinity) - 25) / 10) * days;
    if (!Number.isFinite(maintenance) || !Number.isFinite(flux.grossDryMassKg))
        throw new RangeError("plant: nonfinite metabolic flux");
    const net = flux.grossDryMassKg - maintenance;
    if (net >= 0) {
        const growthResp = net * p("growth_resp_fraction");
        const growth = net - growthResp;
        flux.co2ReleasedKgC = (maintenance + growthResp) * carbon;
        for (const o of organs)
            allocate(plant, o, growth * (o === "rhizome" && !Object.hasOwn(plant.parameters, "alloc_rhizome") ? 0 : p(`alloc_${o}`)));
        for (const n of nutrients) {
            const demand = Math.max(0, liveMass(plant) * p(`critical_${n}`) / 100 - plant.organism.nutrientsKg[n]);
            flux.nutrientsTakenKg[n] = Math.min(demand, supplies[n]);
        }
        if (soil)
            plantUptake(soil.cell, plant, flux, soil.ledger, soil.trace, soil.t);
        else
            for (const n of nutrients) {
                plant.organism.nutrientsKg[n] += flux.nutrientsTakenKg[n];
                plant.ledger.totals.nutrientsTakenKg[n] += flux.nutrientsTakenKg[n];
            }
    }
    else {
        let debt = -net;
        const reservePaid = Math.min(plant.developmental.reserveKg, debt);
        plant.developmental.reserveKg -= reservePaid;
        debt -= reservePaid;
        const leaf = plant.developmental.organs.leaf.populations;
        const leafMass = organAggregate(leaf).viableMassKg;
        const leafPaid = Math.min(leafMass, debt);
        leaf.forEach(pop => { pop.viableMassKg *= leafMass === 0 ? 0 : 1 - leafPaid / leafMass; });
        // Oxidised tissue's N/P/K becomes nutrient residue in litter; its C is respiration, not litter C.
        removeNutrients(plant, leafPaid, concentration, flux.litter.leaf, soil);
        flux.co2ReleasedKgC = (flux.grossDryMassKg + reservePaid + leafPaid) * carbon;
    }
    // Water-use efficiency in g dry mass/kg water; gross assimilation defines this interval's demand.
    flux.waterTakenKg = Math.min(env.soilWater.availableKg, flux.grossDryMassKg * 1000 / p("water_use_efficiency"));
    flux.waterTranspiredKg = flux.waterTakenKg;
    plant.organism.waterStatus = clamp((env.soilWater.availableKg - flux.waterTakenKg) / env.soilWater.totalAvailableKg);
    const massAtTurnover = liveMass(plant);
    const turnoverConcentration = Object.fromEntries(nutrients.map(n => [n, massAtTurnover === 0 ? 0 : plant.organism.nutrientsKg[n] / massAtTurnover]));
    for (const o of organs) {
        for (const pop of plant.developmental.organs[o].populations) {
            // No tissue-response source is opened: null injury, repair AND matrix rates (2815).
            const loss = stepTissue(pop, days, { injuryRate: null, repairRate: null, matrixChangeRate: null }).deadMassKg;
            flux.litter[o].dryMassKg += loss;
            flux.litter[o].carbonKg += loss * carbon;
            removeNutrients(plant, loss, turnoverConcentration, flux.litter[o], soil);
        }
    }
    if (plant.developmental.reserveKg === 0 && plantOrganMasses(plant).leaf === 0) {
        plant.organism.alive = false;
        plant.organism.cause = "carbon starvation";
        // Death opens detritus fluxes; no remaining structural mass disappears.
        const remainingMass = liveMass(plant);
        const deathConcentration = Object.fromEntries(nutrients.map(n => [n, remainingMass === 0 ? 0 : plant.organism.nutrientsKg[n] / remainingMass]));
        for (const o of organs)
            for (const pop of plant.developmental.organs[o].populations) {
                flux.litter[o].dryMassKg += pop.viableMassKg;
                flux.litter[o].carbonKg += pop.viableMassKg * carbon;
                removeNutrients(plant, pop.viableMassKg, deathConcentration, flux.litter[o], soil);
                pop.viableMassKg = 0;
            }
    }
    plant.developmental.ageDays += days;
    plant.organism.accumulatedStressDays += (1 - flux.factors.combined) * days;
    refresh(plant);
    const totals = plant.ledger.totals;
    for (const key of ["grossDryMassKg", "co2TakenKgC", "co2ReleasedKgC", "o2ReleasedKg", "waterTakenKg", "waterTranspiredKg"])
        totals[key] += flux[key];
    for (const o of organs) {
        totals.litter[o].dryMassKg += flux.litter[o].dryMassKg;
        totals.litter[o].carbonKg += flux.litter[o].carbonKg;
        for (const n of nutrients)
            totals.litter[o].nutrientsKg[n] += flux.litter[o].nutrientsKg[n];
    }
    totals.factors = { ...flux.factors };
    return flux;
}
/** Absolute residuals in kg C, kg water, and kg N/P/K, independently using initial/current inventories. */
export function plantLedgerError(plant) {
    const current = inventory(plant), { initial, totals } = plant.ledger;
    const result = { carbon: initial.carbon + totals.co2TakenKgC - current.carbon - totals.co2ReleasedKgC -
            organs.reduce((sum, o) => sum + totals.litter[o].carbonKg, 0),
        water: initial.water + totals.waterTakenKg - current.water - totals.waterTranspiredKg, n: 0, p: 0, k: 0 };
    for (const n of nutrients)
        result[n] = initial.nutrients[n] + totals.nutrientsTakenKg[n] - current.nutrients[n] -
            organs.reduce((sum, o) => sum + totals.litter[o].nutrientsKg[n], 0);
    return result;
}
