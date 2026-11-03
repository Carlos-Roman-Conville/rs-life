import { describe, expect, it } from "vitest";
import { libraryTable } from "../src/library.ts";
import type { LibraryRow } from "../src/library.ts";
import { clonePlant, coarsen, createPlant, refine, vegetationStock, plantUptake, plantLedgerError, plantOrganMasses, plantPhFactor, plantSalinityFactor,
  plantTemperatureFactor, plantWaterFactor, stepPlant, PlantEnvironmentError, PlantFormError, PlantParameterError } from "../src/plant.ts";
import type { Plant, PlantEnvironment, PlantInit } from "../src/plant.ts";
import { mergeRegions, organAggregate, splitRegions } from "../src/tissue.ts";
import { NutrientLedger, SoilCell } from "../src/soils.ts";
import { createField, harvest } from "../src/ecology.ts";
import { Trace } from "../src/trace.ts";

// TEST-ONLY synthetic species AND missing-form fixtures. Numbers are test inputs, not science.
// These in-memory records are never written to the library or used as production fallbacks.
const values: Record<string, string | number | null> = {
  life_form: "crop", radiation_use_efficiency: 4, canopy_extinction_k: 0.6,
  t_min: 0, t_opt: 20, t_max: 40, depletion_fraction_p: 0.5, water_use_efficiency: 4,
  salinity_threshold: 2, salinity_slope: 10, ph_min: 4, ph_opt_low: 6, ph_opt_high: 8, ph_max: 10,
  critical_n: 2, critical_p: 0.2, critical_k: 1, age_at_maturity: 0.5,
  alloc_leaf: 0.3, alloc_stem: 0.3, alloc_root: 0.3, alloc_rhizome: 0.1,
  specific_leaf_area: 10, leaf_turnover: 0.3, root_turnover: 0.2,
  maintenance_resp_25c: 0.001, q10: 2, growth_resp_fraction: 0.2, carbon_fraction: 0.45,
};
function species(overrides: Record<string, string | number | null> = {}): LibraryRow[] {
  return Object.entries({ ...values, ...overrides }).map(([Field, Value]) => ({ id: `fixture.${Field}`, Field, Value }));
}
function fixtureForm(id: string, Note: string, Value: number | null = null): LibraryRow {
  return { id: `plants.forms.${id}`, Field: id, Value, Note, Label: "test-only", source: "synthetic fixture; not science" };
}
const fixtureForms: LibraryRow[] = [
  ...structuredClone(libraryTable("plants", "forms")),
  fixtureForm("ph_trapezoid", "Test-only piecewise linear trapezoid on four cardinals."),
  fixtureForm("temperature_cardinal_beta_function", "Test-only shifted beta on three cardinals."),
  fixtureForm("salinity_beta_function", "Test-only beta on three salinity cardinals."),
  fixtureForm("growth_respiration_fraction_of_assimilate", "Test-only fraction of positive post-maintenance assimilate respired."),
  fixtureForm("photosynthetic_oxygen_per_carbon", "Test-only gas mass ratio, not a library constant.", 2.5),
];
function init(overrides: Partial<PlantInit> = {}): PlantInit {
  return { cultivar: "fixture", variants: { marker: "a", trait: 2 }, ageDays: 0,
    massesKg: { leaf: 0.1, stem: 0.2, root: 0.2, rhizome: 0.1 }, reserveKg: 0.01,
    groundAreaM2: 1, waterKg: 0.3, waterStatus: 1, tissueFractions: { n: 1, p: 1, k: 1 },
    forms: fixtureForms, ...overrides };
}
function env(overrides: Partial<PlantEnvironment> = {}): PlantEnvironment {
  return { par: 20, airTemperatureC: 20, soilWater: { availableKg: 10, totalAvailableKg: 10 },
    availableN: 1, availableP: 1, availableK: 1, soilPh: 7, salinity: 1, ...overrides };
}
const sample = (overrides: Record<string, string | number | null> = {}, initial: Partial<PlantInit> = {}): Plant => createPlant(species(overrides), init(initial));

const named = (id = "a", overrides: Record<string, string | number | null> = {}, initial: Partial<PlantInit> = {}): Plant =>
  sample(overrides, { id, region: "field", speciesId: "fixture", ...initial });
const elements = [["n", "N"], ["p", "P"], ["k", "K"]] as const;
const plantOrgans = ["leaf", "stem", "root", "rhizome"] as const;
function extensive(p: Plant): number[] {
  const { factors: _factors, ...totals } = p.ledger.totals;
  const numbers = (value: unknown): number[] => typeof value === "number" ? [value] :
    Object.values(value as Record<string, unknown>).flatMap(numbers);
  return numbers({ masses: plantOrganMasses(p), reserve: p.developmental.reserveKg,
    water: p.organism.waterKg, nutrients: p.organism.nutrientsKg, area: p.groundAreaM2,
    initial: p.ledger.initial, totals });
}
function expectPoolsEqual(a: readonly Plant[], b: readonly Plant[]): void {
  const sums = (plants: readonly Plant[]) => plants.map(extensive).reduce((sum, xs) => xs.map((x, i) => x + (sum[i] ?? 0)), []);
  const left = sums(a), right = sums(b);
  expect(left).toHaveLength(right.length);
  left.forEach((value, i) => expect(Math.abs(value - right[i])).toBeLessThanOrEqual(1e-12));
}

describe("one biomass store (CG-21)", () => {
  it("vegetationStock is a derived regional read of tissue and reserve", () => {
    const a = named(), b = named("b"), elsewhere = named("elsewhere", {}, { region: "other" });
    const records = [a, b, elsewhere], before = structuredClone(records);
    const stock = vegetationStock(records, "field");
    expect(stock).toEqual({ organsKg: { leaf: 0.2, stem: 0.4, root: 0.4, rhizome: 0.2 }, reserveKg: 0.02, totalKg: 1.22 });
    expect(records).toEqual(before);
    a.developmental.organs.leaf.populations[0].viableMassKg += 0.125;
    expect(vegetationStock(records, "field").organsKg.leaf).toBe(0.325);
    stock.organsKg.stem = 123;
    expect(vegetationStock(records, "field").organsKg.stem).toBe(0.4);
    expect(vegetationStock(records, "missing").totalKg).toBe(0);
  });

  it("coarsen and refine conserve every pool and mergeRegions tissue states to 1e-12", () => {
    const a = named("a", { meristem_fraction: 0.02 }), b = named("b", { meristem_fraction: 0.02 }, { groundAreaM2: 2, ageDays: 30 });
    stepPlant(a, env(), 5); stepPlant(b, env(), 11);
    for (const o of plantOrgans) {
      a.developmental.organs[o].populations.forEach(p => Object.assign(p, {
        injury: 0.2, capacity: 0.8, repairCapacity: 0.01, matrixIntegrity: 0.6, fibroticFraction: 0.1, senescentFraction: 0.2,
      }));
      b.developmental.organs[o].populations.forEach(p => Object.assign(p, {
        injury: 0.6, capacity: 0.5, repairCapacity: null, matrixIntegrity: 0.9, fibroticFraction: 0.3, senescentFraction: 0.7,
      }));
    }
    const before = structuredClone([a, b]), trace = new Trace();
    const coarse = coarsen([a, b], trace, 12);
    expectPoolsEqual([a, b], [coarse]);
    expect(coarse.developmental.ageDays).toBe((5 + 41 * 2) / 3);
    for (const o of plantOrgans) coarse.developmental.organs[o].populations.forEach((pop, i) => {
      expect(pop).toEqual(mergeRegions([a.developmental.organs[o].populations[i], b.developmental.organs[o].populations[i]]));
    });
    const parts = refine(coarse, { young: 0.1, middle: 0.2, old: 0.7 }, trace, 13);
    expectPoolsEqual([coarse], parts);
    for (const part of parts) {
      expect(part.region).toBe("field");
      expectClosed(part);
      for (const o of plantOrgans) part.developmental.organs[o].populations.forEach((pop, i) => {
        const { viableMassKg: _mass, ...state } = pop;
        const { viableMassKg: _originalMass, ...original } = coarse.developmental.organs[o].populations[i];
        expect(state).toEqual(original);
      });
    }
    const roundTrip = coarsen(parts, trace, 14);
    expectPoolsEqual([coarse], [roundTrip]);
    expectClosed(roundTrip);
    expect([a, b]).toEqual(before);
    expect(trace.transfers).toEqual([]);
    expect(trace.notes.map(n => n.text.split(":")[0])).toEqual(["plant.coarsen", "plant.refine", "plant.coarsen"]);
    expect(roundTrip.ledger.notes.length).toBeGreaterThan(0);
    parts[0].developmental.organs.leaf.populations[0].injury = 99;
    expect(parts[1].developmental.organs.leaf.populations[0].injury).not.toBe(99);
  });

  it("retains empty tissue definitions and anatomical regions", () => {
    const p = named("empty", {}, { massesKg: { leaf: 0.1, stem: 0.2, root: 0.2, rhizome: 0 } });
    p.developmental.organs.leaf.populations = splitRegions(p.developmental.organs.leaf.populations[0], { inner: 0.2, outer: 0.8 });
    p.developmental.organs.rhizome.populations[0].injury = 0.4;
    const result = coarsen(refine(p, { a: 0.4, b: 0.6 }));
    expectPoolsEqual([p], [result]);
    expect(result.developmental.organs.leaf.populations.map(p => p.region)).toEqual(["inner", "outer"]);
    expect(result.developmental.organs.rhizome.populations[0].injury).toBe(0.4);
  });

  it("rejects incompatible records and invalid shares without changing inputs", () => {
    const a = named(), before = structuredClone(a);
    expect(() => coarsen([])).toThrow();
    expect(() => coarsen([a, a])).toThrow("duplicate");
    expect(() => coarsen([a, sample()])).toThrow("identity");
    for (const patch of [{ region: "elsewhere" }, { speciesId: "different" }, { cultivar: "different" }])
      expect(() => coarsen([a, named("b", {}, patch)])).toThrow("incompatible");
    expect(() => coarsen([a, named("b", { q10: 3 })])).toThrow("incompatible");
    const invalidShares: Record<string, number>[] = [{}, { a: 0.2 }, { a: -0.1, b: 1.1 }, { a: NaN }, { a: 0, b: 1 }, { a: 1, b: 1e-13 }];
    for (const shares of invalidShares)
      expect(() => refine(a, shares)).toThrow("shares");
    expect(a).toEqual(before);
  });

  it("measures coarse versus refined 365-day stepping without an invented error band", () => {
    const coarse = named(), parts = refine(coarse, { a: 0.25, b: 0.75 });
    const daily = refine(coarse, { a: 0.25, b: 0.75 });
    const forcing = (p: Plant) => env({ availableN: p.groundAreaM2, availableP: p.groundAreaM2, availableK: p.groundAreaM2,
      soilWater: { availableKg: 10 * p.groundAreaM2, totalAvailableKg: 10 * p.groundAreaM2 } });
    stepPlant(coarse, forcing(coarse), 365);
    for (const p of parts) stepPlant(p, forcing(p), 365);
    for (let day = 0; day < 365; day++) for (const p of daily) stepPlant(p, forcing(p), 1);
    const heterogeneous = [named("sparse", {}, { groundAreaM2: 3 }), named("dense", {}, { groundAreaM2: 0.5, tissueFractions: { n: 0.5, p: 1, k: 1 } })];
    const merged = coarsen(heterogeneous);
    stepPlant(merged, forcing(merged), 365);
    for (const p of heterogeneous) stepPlant(p, forcing(p), 365);
    const mass = (ps: Plant[]) => vegetationStock(ps, "field").totalKg;
    const measured = { sameIntervalKg: mass([coarse]) - mass(parts),
      annualMinusDailyKg: mass([coarse]) - mass(daily), heterogeneousKg: mass([merged]) - mass(heterogeneous) };
    for (const difference of Object.values(measured)) expect(Number.isFinite(difference)).toBe(true);
    for (const p of [coarse, ...parts, ...daily, merged, ...heterogeneous]) expectClosed(p);
    console.log("(3015) coarse-minus-refined dry mass", JSON.stringify(measured));
  });
});

describe("uptake is one transfer (CG-3)", () => {
  it("credits tissue in the soil transaction once per element and rolls back a late refusal", () => {
    const plant = named(), cell = new SoilCell("a", 1, { N: 1, P: 0.1, K: 0.5 });
    const ledger = new NutrientLedger(), trace = new Trace();
    const before = structuredClone(plant), soilBefore = cell.pool;
    const flux = { nutrientsTakenKg: { n: 0.01, p: 0.001, k: 0.005 } };
    plantUptake(cell, plant, flux, ledger, trace, 42);
    for (const [n, el] of elements) {
      expect(Math.abs((soilBefore[el] - cell.pool[el]) - (plant.organism.nutrientsKg[n] - before.organism.nutrientsKg[n]))).toBeLessThanOrEqual(1e-12);
      expect(ledger.balance(`plant:${plant.id}`, el)).toBe(0);
      expect(trace.transfers.filter(x => x.quantity === `nutrient:${el}`)).toEqual([
        { t: 42, process: "plant.uptake", quantity: `nutrient:${el}`, from: "soil:a", to: "plant:a", amount: flux.nutrientsTakenKg[n] },
      ]);
    }
    expect(ledger.journal.entries()).toHaveLength(3);
    expect(ledger.journal.entries().every(entry => entry.t === 42000)).toBe(true);
    expectClosed(plant);
    for (const bad of [0.2, -1, NaN, Infinity]) {
      const saved = structuredClone(plant), soilSaved = cell.pool, journal = ledger.journal.entries();
      expect(() => plantUptake(cell, plant, { nutrientsTakenKg: { n: 0.01, p: bad, k: 0 } }, ledger, trace, 43)).toThrow();
      expect(plant).toEqual(saved); expect(cell.pool).toEqual(soilSaved);
      expect(ledger.journal.entries()).toEqual(journal); expect(trace.transfers).toHaveLength(3);
    }
    plantUptake(cell, plant, { nutrientsTakenKg: { n: 0, p: 0, k: 0 } }, ledger, trace, 44);
    expect(trace.transfers).toHaveLength(3);
    expect(trace.failed()).toEqual([]);
  });

  it("caps demand by the current cell and host allowance, with no negative soil or duplicate credits", () => {
    const cell = new SoilCell("a", 100, { N: 0.00001, P: 0.00001, K: 0.00001 });
    const plant = named(), ledger = new NutrientLedger();
    const flux = stepPlant(plant, env({ availableP: 0.000001 }), 1, { cell, ledger, t: 0 });
    expect(flux.nutrientsTakenKg).toEqual({ n: 0.00001, p: 0.000001, k: 0.00001 });
    expect(cell.pool.N).toBe(0); expect(cell.pool.K).toBe(0);
    const second = stepPlant(named("b"), env(), 1, { cell, ledger, t: 1 });
    expect(second.nutrientsTakenKg.n).toBe(0); expect(second.nutrientsTakenKg.k).toBe(0);
    expect(Object.values(cell.pool).every(q => q >= 0)).toBe(true);
    expectClosed(plant);
    const duplicate = new NutrientLedger({ "plant:a": { N: 1, P: 0, K: 0 } });
    expect(() => plantUptake(cell, plant, { nutrientsTakenKg: { n: 0, p: 0, k: 0 } }, duplicate)).toThrow("duplicate plant stock");
  });

  it("returns turnover and terminal death only to detritus, leaving soil untouched", () => {
    const plant = named("dying", { maintenance_resp_25c: 0.1 }), cell = new SoilCell("a", 1, { N: 1, P: 1, K: 1 });
    const ledger = new NutrientLedger(), trace = new Trace(), initial = { ...plant.organism.nutrientsKg };
    for (let day = 0; day < 365 && plant.organism.alive; day++)
      stepPlant(plant, env({ par: 0 }), 1, { cell, ledger, trace, t: day * 86400 });
    expect(plant.organism.alive).toBe(false);
    expect(cell.pool).toEqual({ N: 1, P: 1, K: 1 });
    for (const [n, el] of elements) {
      expect(Math.abs(ledger.balance("detritus", el) - initial[n])).toBeLessThanOrEqual(1e-12);
      expect(plant.organism.nutrientsKg[n]).toBeLessThanOrEqual(1e-12);
    }
    expect(trace.transfers.length).toBeGreaterThan(0);
    expect(trace.transfers.every(x => x.from === "plant:dying" && x.to === "detritus")).toBe(true);
    expectClosed(plant);
  });

  it("rolls back the whole growth step when a detritus account refuses a late element", () => {
    class RefusingLedger extends NutrientLedger {
      override apply(account: string, quantity: string, delta: number): void {
        if (account === "detritus" && quantity === "nutrient:K") throw new Error("fixture refusal");
        super.apply(account, quantity, delta);
      }
    }
    const plant = named(), before = structuredClone(plant), cell = new SoilCell("a", 1, { N: 1, P: 1, K: 1 });
    const ledger = new RefusingLedger(), trace = new Trace();
    expect(() => stepPlant(plant, env(), 1, { cell, ledger, trace, t: 0 })).toThrow("fixture refusal");
    expect(plant).toEqual(before); expect(cell.pool).toEqual({ N: 1, P: 1, K: 1 });
    expect(ledger.total("N")).toBe(0); expect(ledger.total("P")).toBe(0);
    expect(ledger.journal.entries()).toEqual([]); expect(trace.transfers).toEqual([]); expect(trace.checks).toEqual([]);
  });

  it("closes pools + accounts + tissue for each element over 365 days and harvest with uptakeByPlant", () => {
    const plant = named(), cell = new SoilCell("a", 1, { N: 1, P: 0.1, K: 0.5 });
    const ledger = new NutrientLedger(), trace = new Trace(), field = createField("a", 0.9, cell, ledger);
    const soilBefore = cell.pool;
    const initial = elements.map(([n, el]) => cell.pool[el] + ledger.total(el) + plant.organism.nutrientsKg[n]);
    let maxResidual = 0;
    for (let day = 0; day < 365; day++) {
      const tissueBefore = { ...plant.organism.nutrientsKg }, soilBeforeStep = cell.pool, mark = trace.transfers.length;
      const flux = stepPlant(plant, env({ par: 14 + 8 * Math.sin(day / 17), airTemperatureC: 20 + 12 * Math.sin(day / 30) }),
        1, { cell, ledger, trace, t: day * 86400 });
      for (const [index, [n, el]] of elements.entries()) {
        const uptake = trace.transfers.slice(mark).filter(x => x.process === "plant.uptake" && x.quantity === `nutrient:${el}`);
        expect(uptake).toHaveLength(flux.nutrientsTakenKg[n] > 0 ? 1 : 0);
        const litter = plantOrgans.reduce((sum, o) => sum + flux.litter[o].nutrientsKg[n], 0);
        const debit = soilBeforeStep[el] - cell.pool[el];
        expect(Math.abs(debit - flux.nutrientsTakenKg[n])).toBeLessThanOrEqual(1e-12);
        expect(Math.abs(debit - (plant.organism.nutrientsKg[n] - tissueBefore[n] + litter))).toBeLessThanOrEqual(1e-12);
        expect(cell.pool[el]).toBeGreaterThanOrEqual(0);
        const residual = Math.abs(cell.pool[el] + ledger.total(el) + plant.organism.nutrientsKg[n] - initial[index]);
        expect(residual).toBeLessThanOrEqual(1e-12); maxResidual = Math.max(maxResidual, residual);
        expect(Math.abs(plantLedgerError(plant)[n])).toBeLessThanOrEqual(1e-12);
      }
      expect(flux.waterTakenKg).toBe(flux.waterTranspiredKg);
    }
    const beforeHarvest = cell.pool, journalLength = ledger.journal.entries().length;
    const crop = harvest(field, "maize", 0.001, 1, 1, trace, 365, { uptakeByPlant: true });
    expect(crop.yield).toBeGreaterThan(0);
    expect(crop.transferred).toEqual({ N: 0, P: 0, K: 0 });
    expect(cell.pool).toEqual(beforeHarvest);
    expect(ledger.journal.entries()).toHaveLength(journalLength);
    for (const [n, el] of elements)
      expect(Math.abs(soilBefore[el] - cell.pool[el] - plant.ledger.totals.nutrientsTakenKg[n])).toBeLessThanOrEqual(1e-12);
    expect(ledger.balance("detritus", "N")).toBeGreaterThan(0);
    expect(trace.transfers.every(x => x.process !== "plant.litter" || x.to === "detritus")).toBe(true);
    expect(trace.failed()).toEqual([]);
    console.log("(3015) maximum 365-day element closure residual kg", maxResidual);
  });
});

function expectClosed(plant: Plant): void {
  const residual = plantLedgerError(plant), initial = plant.ledger.initial, totals = plant.ledger.totals;
  expect(Math.abs(residual.carbon) / Math.max(initial.carbon, totals.co2TakenKgC)).toBeLessThan(1e-9);
  expect(Math.abs(residual.water) / Math.max(initial.water, totals.waterTakenKg)).toBeLessThan(1e-9);
  for (const n of ["n", "p", "k"] as const)
    expect(Math.abs(residual[n]) / Math.max(initial.nutrients[n], totals.nutrientsTakenKg[n])).toBeLessThan(1e-9);
}

describe("plant growth (2815)", () => {
  it("temperature is one at the optimum, zero beyond limits, and monotone on both sides", () => {
    for (const min of [0, -10]) {
      const factor = (t: number) => plantTemperatureFactor(t, min, 20, 40, fixtureForms);
      expect(factor(20)).toBe(1);
      for (const t of [min - 10, min, 40, 50]) expect(factor(t)).toBe(0);
      let previous = 0;
      for (let t = min; t <= 20; t++) { expect(factor(t)).toBeGreaterThanOrEqual(previous); previous = factor(t); }
      for (let t = 20; t <= 40; t++) { expect(factor(t)).toBeLessThanOrEqual(previous); previous = factor(t); }
    }
  });

  it("water, salinity and pH have bounded monotone ramps and optimum plateaux", () => {
    expect(plantWaterFactor(0, 10, 0.5)).toBe(0);
    expect(plantWaterFactor(5, 10, 0.5)).toBe(1);
    expect(plantWaterFactor(20, 10, 0.5)).toBe(1);
    for (let i = 0; i < 10; i++) expect(plantWaterFactor(i + 1, 10, 0.5)).toBeGreaterThanOrEqual(plantWaterFactor(i, 10, 0.5));
    expect(plantSalinityFactor(2, 2, 10)).toBe(1);
    expect(plantSalinityFactor(12, 2, 10)).toBe(0);
    expect(plantSalinityFactor(20, 2, 10)).toBe(0);
    for (let i = 0; i < 20; i++) expect(plantSalinityFactor(i + 1, 2, 10)).toBeLessThanOrEqual(plantSalinityFactor(i, 2, 10));
    const ph = (x: number) => plantPhFactor(x, 4, 6, 8, 10, fixtureForms);
    for (const x of [0, 4, 10, 14]) expect(ph(x)).toBe(0);
    for (const x of [6, 7, 8]) expect(ph(x)).toBe(1);
    for (let i = 4; i < 6; i += 0.25) expect(ph(i + 0.25)).toBeGreaterThanOrEqual(ph(i));
    for (let i = 8; i < 10; i += 0.25) expect(ph(i + 0.25)).toBeLessThanOrEqual(ph(i));
  });

  it("uses Liebig's nutrient minimum and clips fractions to [0,1]", () => {
    const gain = (n: number, p: number, k: number) => stepPlant(sample({}, { tissueFractions: { n, p, k } }), env(), 1).grossDryMassKg;
    expect(gain(0.25, 1, 1)).toBeCloseTo(gain(0.5, 1, 1) / 2, 12);
    expect(gain(0.25, 0.5, 1)).toBe(gain(0.25, 1, 1));
    expect(gain(0, 1, 1)).toBe(0);
    expect(gain(2, 2, 2)).toBe(gain(1, 1, 1));
  });

  it("two half-strength stresses multiply to one quarter", () => {
    const halfTemperature = 20 * (1 - Math.sqrt(0.5)); // symmetric beta 1 - ((T-20)/20)^2
    const baseline = stepPlant(sample(), env(), 1);
    const stressed = stepPlant(sample(), env({ airTemperatureC: halfTemperature,
      soilWater: { availableKg: 2.5, totalAvailableKg: 10 } }), 1);
    expect(stressed.factors.temperature).toBeCloseTo(0.5, 12);
    expect(stressed.factors.water).toBe(0.5);
    expect(stressed.grossDryMassKg / baseline.grossDryMassKg).toBeCloseTo(0.25, 12);
  });

  it("zero PAR gives zero gain; depth attenuates gain by exp(-Kd z)", () => {
    expect(stepPlant(sample(), env({ par: 0 }), 1).grossDryMassKg).toBe(0);
    const surface = stepPlant(sample(), env({ waterDepthM: 0, kdPerM: 0.7 }), 1);
    const deep = stepPlant(sample(), env({ waterDepthM: 3, kdPerM: 0.7 }), 1);
    expect(deep.grossDryMassKg / surface.grossDryMassKg).toBeCloseTo(Math.exp(-2.1), 12);
    expect(surface.o2ReleasedKg).toBe(surface.co2TakenKgC * 2.5);
  });

  it("uses explicit ground area for LAI and energy, not leaf area as LAI", () => {
    const p = sample({}, { groundAreaM2: 2 });
    const flux = stepPlant(p, env(), 1);
    expect(flux.grossDryMassKg).toBeCloseTo(4 / 1000 * 20 * 2 * (1 - Math.exp(-0.6 * 1 / 2)), 12);
  });

  it("closes C, water and nutrient ledgers for 365 varying days with population-backed organs", () => {
    const p = sample();
    p.developmental.organs.leaf.populations = splitRegions(p.developmental.organs.leaf.populations[0], { a: 0.3, b: 0.7 });
    for (let day = 0; day < 365; day++) {
      const forcing = env({ par: 14 + 8 * Math.sin(day / 17), airTemperatureC: 20 + 12 * Math.sin(day / 30),
        salinity: 2 + 3 * (1 + Math.sin(day / 31)), soilPh: 6 + Math.sin(day / 20),
        availableN: day % 7 === 0 ? 0 : 0.003, availableP: 0.001, availableK: 0.004,
        soilWater: { availableKg: 2 + day % 8, totalAvailableKg: 10 } });
      const flux = stepPlant(p, forcing, 1);
      expect(flux.waterTakenKg).toBe(flux.waterTranspiredKg);
      expect(flux.waterTakenKg).toBeLessThanOrEqual(forcing.soilWater!.availableKg);
      expect(flux.nutrientsTakenKg.n).toBeLessThanOrEqual(forcing.availableN!);
      for (const o of ["leaf", "stem", "root", "rhizome"] as const) {
        const pops = p.developmental.organs[o].populations;
        expect(plantOrganMasses(p)[o]).toBeCloseTo(pops.reduce((s, x) => s + x.viableMassKg, 0), 12);
        expect(pops.every(x => x.injury === 0 && x.matrixIntegrity === 1)).toBe(true);
      }
      expect(p.developmental.leafAreaM2).toBeCloseTo(organAggregate(p.developmental.organs.leaf.populations).viableMassKg * 10, 12);
      expectClosed(p);
    }
    expect(p.organism.alive).toBe(true);
    expect(p.ledger.totals.litter.leaf.dryMassKg).toBeGreaterThan(0);
    expect(p.ledger.totals.litter.root.dryMassKg).toBeGreaterThan(0);
    expect(p.developmental.maturity).toBe("reproductive");
  });

  it("reserve pays first, then leaf area, then starvation sends all remaining tissue to litter", () => {
    const p = sample({ maintenance_resp_25c: 0.1 });
    const initialLeaf = p.developmental.leafAreaM2;
    stepPlant(p, env({ airTemperatureC: -1 }), 0.01);
    expect(p.developmental.reserveKg).toBeLessThan(0.01);
    expect(p.developmental.leafAreaM2).toBeLessThanOrEqual(initialLeaf);
    for (let day = 0; day < 365 && p.organism.alive; day++) { stepPlant(p, env({ airTemperatureC: -1 }), 1); expectClosed(p); }
    expect(p.organism).toMatchObject({ alive: false, cause: "carbon starvation" });
    expect(p.developmental.reserveKg).toBe(0);
    expect(p.developmental.leafAreaM2).toBe(0);
    expect(Object.values(plantOrganMasses(p))).toEqual([0, 0, 0, 0]);
    const before = structuredClone(p);
    expect(stepPlant(p, {}, 1).co2ReleasedKgC).toBe(0);
    expect(p).toEqual(before);
  });

  it("caps water and nutrient uptake and lowers tissue fractions when supply is insufficient", () => {
    const p = sample({ water_use_efficiency: 0.001 });
    const flux = stepPlant(p, env({ availableN: 0, availableP: 0, availableK: 0 }), 1);
    expect(flux.waterTakenKg).toBe(10);
    expect(flux.nutrientsTakenKg).toEqual({ n: 0, p: 0, k: 0 });
    expect(p.organism.tissueFractions.n).toBeLessThan(1);
    expectClosed(p);
  });

  it("clones share exactly the immutable genetic profile, with independent tissue and ledger", () => {
    const p = sample(), clone = clonePlant(p), before = structuredClone(p);
    expect(clone.genetic).toBe(p.genetic);
    expect(Object.isFrozen(p.genetic.variants)).toBe(true);
    stepPlant(clone, env(), 1);
    expect(p).toEqual(before);
    expect(clone.developmental.organs.leaf.populations).not.toBe(p.developmental.organs.leaf.populations);
    expectClosed(clone);
  });

  it("missing required environment fields throw named errors without changing state", () => {
    for (const field of ["par", "airTemperatureC", "soilWater", "availableN", "availableP", "availableK", "soilPh", "salinity"] as const) {
      const p = sample(), before = structuredClone(p);
      expect(() => stepPlant(p, env({ [field]: undefined }), 1)).toThrow(PlantEnvironmentError);
      expect(p).toEqual(before);
    }
    expect(() => stepPlant(sample(), env({ waterDepthM: 2 }), 1)).toThrow("kdPerM");
    expect(() => stepPlant(sample(), env({ kdPerM: 0.5 }), 1)).toThrow("waterDepthM");
    // Unused inputs are not assigned ambient defaults.
    expect(() => stepPlant(sample(), env({ vpdKPa: undefined, co2Ppm: undefined }), 1)).not.toThrow();
  });

  it("reports every null species requirement; rejects invalid allocation and numeric inputs", () => {
    expect(() => sample({ t_min: null, critical_n: null })).toThrow("t_min, critical_n");
    expect(() => sample({ t_min: null })).toThrow(PlantParameterError);
    expect(() => sample({ canopy_extinction_k: null })).toThrow("canopy_extinction_k");
    expect(() => sample({ alloc_leaf: 0.9 })).toThrow("allocation");
    expect(() => sample({ water_use_efficiency: 0 })).toThrow("water_use_efficiency");
    expect(() => stepPlant(sample(), env({ par: NaN }), 1)).toThrow(PlantEnvironmentError);
  });

  it("never substitutes for unavailable forms or null constants in the real library", () => {
    expect(() => plantPhFactor(7, 4, 6, 8, 10)).toThrow(PlantFormError);
    expect(() => plantTemperatureFactor(20, -5, 20, 40)).toThrow("temperature_cardinal_beta_function");
    const real = sample({}, { forms: undefined }), before = structuredClone(real);
    expect(() => stepPlant(real, env(), 1)).toThrow("ph_trapezoid");
    expect(real).toEqual(before);
    for (const id of ["canopy_light_interception", "respiration_growth_maintenance", "growth_respiration_fraction_of_assimilate", "photosynthetic_oxygen_per_carbon"]) {
      const p = sample({}, { forms: fixtureForms.filter(r => r.id !== `plants.forms.${id}`) });
      expect(() => stepPlant(p, env(), 1)).toThrow(id);
    }
    const forms = fixtureForms.map(r => r.id === "plants.forms.photosynthetic_oxygen_per_carbon" ? { ...r, Value: null } : r);
    expect(() => stepPlant(sample({}, { forms }), env(), 1)).toThrow("photosynthetic_oxygen_per_carbon");
    const withoutK = species().filter(r => r.Field !== "canopy_extinction_k");
    expect(() => stepPlant(createPlant(withoutK, init()), env(), 1)).not.toThrow();
  });

  it("supports an explicitly provided beta salinity form and reports unsupported tree/inundation forms", () => {
    const base = { salinity_min: 0, salinity_opt: 10, salinity_max: 20 };
    const response = (s: number) => stepPlant(sample(base), env({ salinity: s }), 1).factors.salinity;
    expect(response(10)).toBe(1);
    expect(response(0)).toBe(0);
    expect(response(20)).toBe(0);
    expect(response(30)).toBe(0);
    for (let s = 0; s < 10; s++) expect(response(s + 1)).toBeGreaterThanOrEqual(response(s));
    for (let s = 10; s < 20; s++) expect(response(s + 1)).toBeLessThanOrEqual(response(s));
    expect(() => sample({ life_form: "tree", allometry_a: 1, allometry_b: 2, max_height: 10, max_stem_diameter: 20 })).toThrow("allometry_height_diameter");
    expect(() => stepPlant(sample({ inundation_tolerance: 0.5 }), env({ inundation: 0.2 }), 1)).toThrow("inundation_response");
  });

  it("adds no meristem unless a fraction is supplied, and distributes growth by population share", () => {
    expect(sample().developmental.organs.stem.populations.map(p => p.cellType)).toEqual(["stem-storage-parenchyma"]);
    const p = sample({ meristem_fraction: 0.02 });
    expect(p.developmental.organs.leaf.populations.map(x => x.cellType)).toEqual(["leaf-mesophyll", "meristem"]);
    stepPlant(p, env(), 1);
    for (const o of ["leaf", "stem", "root", "rhizome"] as const) {
      const pops = p.developmental.organs[o].populations;
      expect(pops[1].viableMassKg / organAggregate(pops).viableMassKg).toBeCloseTo(0.02, 12);
    }
    expectClosed(p);
  });
});
