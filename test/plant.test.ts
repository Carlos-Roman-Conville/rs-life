import { describe, expect, it } from "vitest";
import { libraryTable } from "../src/library.ts";
import type { LibraryRow } from "../src/library.ts";
import { clonePlant, createPlant, plantLedgerError, plantOrganMasses, plantPhFactor, plantSalinityFactor,
  plantTemperatureFactor, plantWaterFactor, stepPlant, PlantEnvironmentError, PlantFormError, PlantParameterError } from "../src/plant.ts";
import type { Plant, PlantEnvironment, PlantInit } from "../src/plant.ts";
import { organAggregate, splitRegions } from "../src/tissue.ts";

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
