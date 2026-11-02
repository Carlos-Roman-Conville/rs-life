import { describe, expect, it } from "vitest";
import { NutrientLedger, SoilCell } from "../src/soils.ts";
import { Trace } from "../src/trace.ts";
import { clearForest, collapseYears, cropDemand, crawlFoodKg, createField, createStock, dailyCatch, dryYearFactor, erode, fallow, fishedOutCatchFactor,
  fishedOutFraction, harvest, isFishedOut, logisticYears, manure, msyPerYear, recoveryYears, stepStock, takeNestingFemales } from "../src/ecology.ts";

const r = 0.4, K = 1000;

describe("the logistic stock", () => {
  it("holds at MSY: r K / 4 a year taken from K / 2 leaves it where it was", () => {
    const s = createStock("reef", K / 2, K, r);
    const daily = msyPerYear(s) / 365;
    const trace = new Trace();
    for (let i = 0; i < 3650; i++) stepStock(s, daily, trace);
    expect(s.B).toBeCloseTo(K / 2, 6);
    expect(trace.failed()).toEqual([]);
    expect(trace.into("reef", "stock:reef")).toBeGreaterThan(0);
    expect(trace.outOf("reef", "stock:reef")).toBeCloseTo(daily * 3650, 6);
  });

  it("collapses at twice MSY on the logistic curve, in pi / (2 r) years", () => {
    const s = createStock("reef", K / 2, K, r);
    const daily = 2 * msyPerYear(s) / 365;
    const years = collapseYears(s, K / 2, 2 * msyPerYear(s))!;
    expect(years).toBeCloseTo(Math.PI / (2 * r), 10);
    let day = 0;
    const trace = new Trace();
    while (s.B > 0 && day < 5000) { stepStock(s, daily, trace); day++; }
    expect(s.B).toBe(0);
    // The daily Euler step follows the curve to within a day or two of the closed form.
    expect(Math.abs(day / 365 - years)).toBeLessThan(2 / 365);
    expect(trace.failed()).toEqual([]);
    // Midway the stock stands where the curve puts it: u = -(K/2) tan(r t / 2).
    const m = createStock("reef", K / 2, K, r);
    for (let i = 0; i < 365; i++) stepStock(m, daily);
    expect(m.B).toBeCloseTo(K / 2 - (K / 2) * Math.tan(r / 2), 0);
  });

  it("recovers from 0.2 K to 0.8 K in about 2.8 / r years", () => {
    expect(recoveryYears(r)).toBeCloseTo(2.8 / r, 0);
    expect(logisticYears(r, 0.2, 0.8)).toBeCloseTo(Math.log(16) / r, 12);
    const s = createStock("reef", 0.2 * K, K, r);
    let days = 0;
    while (s.B < 0.8 * K) { stepStock(s, 0); days++; }
    expect(Math.abs(days / 365 - recoveryYears(r))).toBeLessThan(0.02);
  });

  it("is fished out under 0.2 K and the catch falls to a fifth", () => {
    expect(fishedOutFraction()).toBe(0.2);
    expect(fishedOutCatchFactor()).toBe(0.2);
    const a = createStock("a", 0.5 * K, K, r), b = createStock("b", 0.1 * K, K, r);
    expect(isFishedOut(a)).toBe(false);
    expect(isFishedOut(b)).toBe(true);
    expect(dailyCatch(a, 0.01, 10)).toBeCloseTo(0.01 * 10 * 0.5);
    expect(dailyCatch(b, 0.01, 10)).toBeCloseTo(0.01 * 10 * 0.1 * 0.2);
  });

  it("cuts a catch beyond what stands and reports the rest as unmet", () => {
    const s = createStock("tiny", 1, K, r);
    const trace = new Trace();
    const step = stepStock(s, 50, trace);
    expect(s.B).toBe(0);
    expect(step.catch).toBeCloseTo(1 + step.growth);
    expect(step.unmet).toBeCloseTo(50 - step.catch);
    expect(trace.failed()).toEqual([]);
  });

  it("does not breed penned stock, and halves r for a decade after a beach take", () => {
    const pen = createStock("pen", 100, K, r, { penned: true });
    stepStock(pen, 0);
    expect(pen.B).toBe(100);
    expect(crawlFoodKg(4)).toBe(120);
    const free = createStock("t", 300, K, r), taken = createStock("t2", 300, K, r);
    takeNestingFemales(taken);
    stepStock(free, 0); stepStock(taken, 0);
    expect(taken.B - 300).toBeCloseTo((free.B - 300) / 2, 12);
    taken.day = 3650;
    const before = taken.B;
    const freeAgain = createStock("t3", before, K, r);
    stepStock(taken, 0); stepStock(freeAgain, 0);
    expect(taken.B).toBeCloseTo(freeAgain.B, 12);
  });
});

describe("the soil", () => {
  it("reads the former crop demands for historical inspection only", () => {
    expect(cropDemand()).toEqual({ cane: 0.06, tobacco: 0.08, maize: 0.03, cassava: 0.01, pease: -0.02 });
  });

  it("yields max x (0.3 + 0.7 f) x rain x labour and transfers crop nutrients", () => {
    const f = createField("a", 0.9, new SoilCell("a", 10000, { N: 1000, P: 1000, K: 1000 }));
    const trace = new Trace();
    const h = harvest(f, "cane", 100, 1, 0.8, trace, 1);
    expect(h.yield).toBeCloseTo(100 * (0.3 + 0.7 * 0.9) * 0.8);
    expect(f.f).toBeCloseTo(0.9 * (1000 - h.yield * 1.28) / 1000);
    expect(trace.failed()).toEqual([]);
    expect(trace.outOf("soil:a", "nutrient:K")).toBeCloseTo(h.yield * 1.28);
    const pea = harvest(f, "pease", 10, 1, 1);
    expect(f.f).toBeCloseTo(0.9 * (1000 - h.yield * 0.57 - pea.yield * 39) / 1000);
  });

  it("restores by manure and fallow and loses on slopes; the index stays in [0, 1]", () => {
    const ledger = new NutrientLedger({ manure: { N: 1000, P: 1000, K: 1000 }, "inputs:fallow": { N: 1000, P: 1000, K: 1000 } });
    const f = createField("a", 0.5, new SoilCell("a", 10000, { N: 1000, P: 1000, K: 1000 }), ledger);
    expect(manure(f, 20)).toEqual({ N: 110, P: 30.6, K: 83 });
    expect(fallow(f, 365)).toBeCloseTo(0.02);
    expect(fallow(f, 365, true)).toBeCloseTo(0.04);
    expect(erode(f, 365)).toBeCloseTo(-0.02);
    expect(f.f).toBeCloseTo(0.5 * (1 + 30.6 / 1000) + 0.02 + 0.04 - 0.02);
    const full = createField("b", 0.99, new SoilCell("b", 10000, { N: 1000, P: 1000, K: 1000 }), ledger);
    expect(manure(full, 100)).toEqual({ N: 550, P: 153, K: 100 * 4.15 });
    expect(full.f).toBe(1);
    expect(clearForest("n", new SoilCell("n", 10000, { N: 1000, P: 1000, K: 1000 })).f).toBe(0.9);
  });

  it("halves yields in a dry year and leaves other rain to the host", () => {
    expect(dryYearFactor(0.5)).toBe(0.5);
    expect(dryYearFactor(0.8)).toBeNull();
  });
});
