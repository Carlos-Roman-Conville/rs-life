import { describe, expect, it } from "vitest";
import { createTissuePopulation, mergeRegions, organAggregate, splitRegions, stepTissue } from "../src/tissue.ts";

const intact = () => createTissuePopulation({ id: "sample", organ: "sample", cellType: "fixture", region: null,
  viableMassKg: 12, capacity: 0.8, injury: 0.2, repairCapacity: null, senescentFraction: 0.1,
  turnoverPerDay: null, fibroticFraction: 0.25 });
const noInputs = { injuryRate: null, repairRate: null, matrixChangeRate: null };

describe("tissue populations (2815)", () => {
  it("null inputs and null turnover leave the state unchanged, including intact matrix", () => {
    const pop = intact(), before = structuredClone(pop);
    expect(stepTissue(pop, 20, noInputs).deadMassKg).toBe(0);
    expect(pop).toEqual(before);
    expect(pop.matrixIntegrity).toBe(1);
  });

  it("integrates injury minus repair linearly over days and floors injury at zero", () => {
    const pop = intact();
    stepTissue(pop, 4, { ...noInputs, injuryRate: 0.3, repairRate: 0.1 });
    expect(pop.injury).toBeCloseTo(1, 12);
    stepTissue(pop, 2, { ...noInputs, repairRate: 0.6 });
    expect(pop.injury).toBe(0);
    stepTissue(pop, 3, { ...noInputs, injuryRate: 0.1 });
    expect(pop.injury).toBeCloseTo(0.3, 12);
  });

  it("matrix rates integrate linearly and clamp at both bounds independently of capacity", () => {
    const pop = intact();
    stepTissue(pop, 2, { ...noInputs, matrixChangeRate: -0.2 });
    expect(pop.matrixIntegrity).toBeCloseTo(0.6, 12);
    expect(pop.capacity).toBe(0.8);
    stepTissue(pop, 10, { ...noInputs, matrixChangeRate: -0.2 });
    expect(pop.matrixIntegrity).toBe(0);
    stepTissue(pop, 10, { ...noInputs, matrixChangeRate: 0.2 });
    expect(pop.matrixIntegrity).toBe(1);
  });

  it("aggregates mass and viable-mass-weighted states with the fibrotic reduction", () => {
    const a = intact(), b = { ...intact(), viableMassKg: 4, capacity: 0.4, injury: 1,
      fibroticFraction: 0.5, matrixIntegrity: 0.2 };
    const result = organAggregate([a, b]);
    expect(result.viableMassKg).toBe(16);
    expect(result.capacity).toBeCloseTo(0.7 * (1 - 0.3125), 12);
    expect(result.injury).toBeCloseTo(0.4, 12);
    expect(result.matrixIntegrity).toBeCloseTo(0.8, 12);
    expect(organAggregate([{ ...a, viableMassKg: 0 }]).capacity).toBe(0);
  });

  it("split then merge preserves every weighted state and mass to 1e-12", () => {
    const pop = { ...intact(), viableMassKg: 17.891, matrixIntegrity: 0.63, repairCapacity: 0.2, turnoverPerDay: 0.03 };
    const regions = splitRegions(pop, { first: 0.1, second: 0.2, third: 0.7 });
    expect(organAggregate(regions).viableMassKg).toBeCloseTo(pop.viableMassKg, 12);
    const merged = mergeRegions(regions);
    for (const key of Object.keys(pop) as (keyof typeof pop)[]) {
      if (typeof pop[key] === "number") expect(merged[key]).toBeCloseTo(pop[key] as number, 12);
      else expect(merged[key]).toEqual(pop[key]);
    }
    expect(organAggregate([merged])).toEqual(organAggregate(regions));
    expect(mergeRegions(splitRegions({ ...pop, viableMassKg: 0 }, { a: 0.5, b: 0.5 }))).toEqual({ ...pop, viableMassKg: 0 });
  });

  it("turnover returns a conserved dead-mass flux, capped by available mass", () => {
    const pop = { ...intact(), turnoverPerDay: 0.1 };
    const first = stepTissue(pop, 3, noInputs).deadMassKg;
    expect(first).toBeCloseTo(3.6, 12);
    expect(first + pop.viableMassKg).toBe(12);
    const second = stepTissue(pop, 100, noInputs).deadMassKg;
    expect(pop.viableMassKg).toBe(0);
    expect(first + second).toBe(12);
  });

  it("rejects invalid shares, incompatible organs and invalid rates before mutation", () => {
    const pop = intact(), before = structuredClone(pop);
    expect(() => splitRegions(pop, { a: 0.2 })).toThrow("sum to one");
    expect(() => organAggregate([pop, { ...pop, organ: "different" }])).toThrow("mixed organs");
    expect(() => stepTissue(pop, 1, { ...noInputs, matrixChangeRate: NaN })).toThrow();
    expect(pop).toEqual(before);
  });
});
