import { describe, expect, it, vi } from "vitest";
import { TransferJournal } from "@rex/kernel";
import * as library from "../src/library.ts";
import { Trace } from "../src/trace.ts";
import { createField, erode, fallow, harvest, manure, nutrientRemoval, soilOutputs } from "../src/ecology.ts";
import { addNutrient, NUTRIENTS, NutrientLedger, poolPerArea, SoilCell, transferNutrient, transferNutrients } from "../src/soils.ts";

const cell = (id = "a") => new SoilCell(id, 10000, { N: 1000, P: 100, K: 500 });

describe("soil nutrient ledger", () => {
  it("one transfer (3001): closes stocks, accounts, trace and journal; refusal changes nothing", () => {
    const soil = cell(), journal = new TransferJournal(), ledger = new NutrientLedger({}, journal), trace = new Trace();
    const before = soil.pool.N + ledger.total("N");
    transferNutrient(soil, "N", 23, "crop:a", "uptake", ledger, trace, 12);
    expect(soil.pool.N).toBe(977);
    expect(ledger.balance("crop:a", "N")).toBe(23);
    expect(soil.pool.N + ledger.total("N")).toBe(before);
    expect(trace.transfers).toEqual([{ t: 12, process: "uptake", quantity: "nutrient:N", from: "soil:a", to: "crop:a", amount: 23 }]);
    expect(trace.checks).toHaveLength(1);
    expect(trace.failed()).toEqual([]);
    expect(journal.net("a/soil:a", "nutrient:N")).toBe(-23);
    expect(journal.net("nutrients/crop:a", "nutrient:N")).toBe(23);
    const stocks = soil.snapshot(), accounts = ledger.snapshot(), entries = journal.entries();
    expect(() => transferNutrient(soil, "N", 978, "crop:a", "uptake", ledger, trace, 12)).toThrow();
    expect(soil.snapshot()).toEqual(stocks);
    expect(ledger.snapshot()).toEqual(accounts);
    expect(journal.entries()).toEqual(entries);
    expect(trace.transfers).toHaveLength(1);
    expect(trace.checks).toHaveLength(1);
    addNutrient(soil, "N", 23, "crop:a", "return", ledger, trace, 13);
    expect(soil.pool.N).toBe(1000);
    expect(ledger.balance("crop:a", "N")).toBe(0);
    expect(trace.transfers[1]).toMatchObject({ from: "crop:a", to: "soil:a", amount: 23 });
    expect(trace.failed()).toEqual([]);
  });

  it("no clamp (3001): refuses overdraws and retains all manure on a full field", () => {
    const soil = cell(), ledger = new NutrientLedger({ manure: { N: 550, P: 153, K: 100 * 4.15 } });
    const field = createField("a", 1, soil, ledger), trace = new Trace();
    for (const q of [-1, 1001, NaN, Infinity]) {
      expect(() => transferNutrient(soil, "N", q, "loss:erosion", "loss", ledger, trace)).toThrow();
    }
    expect(ledger.journal.entries()).toEqual([]);
    const totals = NUTRIENTS.map(el => soil.pool[el] + ledger.total(el));
    expect(manure(field, 100, trace)).toEqual({ N: 550, P: 153, K: 100 * 4.15 });
    expect(field.f).toBe(1);
    expect(soil.pool).toEqual({ N: 1550, P: 253, K: 915 });
    expect(NUTRIENTS.map(el => soil.pool[el] + ledger.total(el))).toEqual(totals);
    expect(ledger.balance("manure", "N")).toBe(0);
    expect(trace.transfers).toHaveLength(3);
    expect(trace.failed()).toEqual([]);
    expect(() => manure(field, 1, trace)).toThrow();
    expect(soil.pool).toEqual({ N: 1550, P: 253, K: 915 });
  });

  it("integration rule (3001): daily and hourly annual fluxes agree and close without a yearly update", () => {
    function run(steps: number) {
      const soil = cell(), ledger = new NutrientLedger(), trace = new Trace();
      for (let i = 0; i < steps; i++) {
        transferNutrients(soil, { N: 365 / steps, P: 36.5 / steps, K: 182.5 / steps }, "plant:a", "uptake",
          ledger, trace, i * 365 * 86400 / steps);
      }
      for (const el of NUTRIENTS) {
        expect(Math.abs(soil.pool[el] + ledger.total(el) - cell().pool[el]) / cell().pool[el]).toBeLessThan(1e-9);
        const amount = ({ N: 365, P: 36.5, K: 182.5 }[el] / steps) * steps;
        const source = ledger.journal.net("a/soil:a", `nutrient:${el}`);
        const destination = ledger.journal.net("nutrients/plant:a", `nutrient:${el}`);
        expect(source).toBe(-amount);
        expect(destination).toBe(amount);
        expect(source + destination).toBe(0);
      }
      expect(trace.failed()).toEqual([]);
      return soil;
    }
    const daily = run(365), hourly = run(8760);
    for (const el of NUTRIENTS) expect(Math.abs(daily.pool[el] - hourly.pool[el]) / daily.pool[el]).toBeLessThan(1e-9);
    expect(daily.pool.N).toBe(635);
  }, 60_000);

  it("uptake once (3001): Life uptake plus harvest and lumped harvest debit the same nutrients once", () => {
    const lumped = createField("lumped", 0.9, cell("lumped"));
    const plant = createField("plant", 0.9, cell("plant"));
    const trace = new Trace();
    const result = harvest(lumped, "cane", 100, 1, 1);
    for (const el of NUTRIENTS) transferNutrient(plant.cell, el, result.removal[el], "plant:plant", "life.uptake", plant.ledger, trace);
    const debited = plant.cell.pool;
    // Fertility is already lower after uptake. Host maxYield is adjusted only to compare
    // equal harvested tonnage; harvest must still use its current pre-transfer f.
    const sameYield = result.yield / (0.3 + 0.7 * plant.f);
    const exported = harvest(plant, "cane", sameYield, 1, 1, trace, 1, { uptakeByPlant: true });
    expect(exported.yield).toBeCloseTo(result.yield, 12);
    expect(exported.transferred).toEqual({ N: 0, P: 0, K: 0 });
    expect(exported.shortfall).toEqual({ N: 0, P: 0, K: 0 });
    expect(plant.cell.pool).toEqual(debited);
    expect(plant.cell.pool).toEqual(lumped.cell.pool);
    expect(trace.transfers).toHaveLength(3);
    for (const el of NUTRIENTS) {
      expect(plant.ledger.balance("plant:plant", el)).toBe(result.removal[el]);
      expect(lumped.ledger.balance("crop:lumped", el)).toBe(result.removal[el]);
    }
  });

  it("rolls back every element and the journal when a later element is refused", () => {
    const soil = cell(), ledger = new NutrientLedger({ manure: { N: 550, P: 0, K: 415 } }), trace = new Trace();
    const field = createField("a", 0.9, soil, ledger);
    const before = soil.snapshot(), accounts = ledger.snapshot();
    expect(() => manure(field, 100, trace)).toThrow(); // N succeeds before P refuses.
    expect(soil.snapshot()).toEqual(before);
    expect(ledger.snapshot()).toEqual(accounts);
    expect(() => transferNutrients(soil, { N: 1, P: 101 }, "loss:erosion", "loss", ledger, trace)).toThrow();
    expect(soil.snapshot()).toEqual(before);
    expect(ledger.snapshot()).toEqual(accounts);
    expect(ledger.journal.entries()).toEqual([]);
    expect(trace.transfers).toEqual([]);
    expect(trace.checks).toEqual([]);
    // An owner refusal on the second element also rolls back the harvest itself.
    const apply = ledger.apply.bind(ledger);
    vi.spyOn(ledger, "apply").mockImplementation((account, quantity, delta) => {
      if (quantity === "nutrient:P") throw new Error("owner refusal");
      apply(account, quantity, delta);
    });
    expect(() => harvest(field, "cane", 1, 1, 1, trace)).toThrow("owner refusal");
    expect(soil.snapshot()).toEqual(before);
    expect(ledger.snapshot()).toEqual(accounts);
    expect(ledger.journal.entries()).toEqual([]);
    expect(trace.transfers).toEqual([]);
  });

  it("reports harvest shortfalls per element without creating mass or crediting fixed N", () => {
    const field = createField("a", 1, new SoilCell("a", 1, { N: 1, P: 2, K: 3 }));
    const result = harvest(field, "pease", 1, 1, 1);
    expect(result.removal).toEqual({ N: 39, P: 5.02, K: 9.82 });
    expect(result.transferred).toEqual({ N: 1, P: 2, K: 3 });
    expect(result.shortfall).toEqual({ N: 38, P: 5.02 - 2, K: 9.82 - 3 });
    expect(field.cell.pool).toEqual({ N: 0, P: 0, K: 0 });
    expect(field.f).toBe(0);
    expect(field.ledger.journal.entries()).toHaveLength(3);
    for (const el of NUTRIENTS) expect(field.ledger.balance("crop:a", el)).toBe(result.transferred[el]);
  });

  it("names a null removal row and does not mutate state", () => {
    const field = createField("a", 0.9, cell()), original = library.libraryRow;
    const rowId = "ecology.nutrient_removal.sugarcane-howeler";
    const spy = vi.spyOn(library, "libraryRow").mockImplementation((file, table, id) => {
      const row = original(file, table, id);
      return id === rowId ? { ...row, "P kg/t": null } : row;
    });
    try {
      expect(() => harvest(field, "cane", 10, 1, 1)).toThrow(rowId);
      expect(() => harvest(field, "cane", 10, 1, 1, undefined, 0, { uptakeByPlant: true })).toThrow(rowId);
      expect(field.cell.pool).toEqual(cell().pool);
      expect(field.ledger.journal.entries()).toEqual([]);
    } finally { spy.mockRestore(); }
    expect(nutrientRemoval("ecology.nutrient_removal.sugarcane-leite")).toEqual({ N: 0.72, P: 0.15, K: 2.1 });
  });

  it("derives the limiting index, area outputs and placeholder rates from the host stocks", () => {
    const soil = cell(), ledger = new NutrientLedger({ "inputs:fallow": { N: 100, P: 10, K: 50 } });
    const field = createField("a", 0.5, soil, ledger), trace = new Trace();
    expect(poolPerArea(soil, "N")).toBe(0.1);
    expect(fallow(field, 365, false, trace)).toBeCloseTo(0.02, 12);
    expect(soil.pool).toEqual({ N: 1040, P: 104, K: 520 });
    expect(erode(field, 365, trace)).toBeCloseTo(-0.02, 12);
    expect(soil.pool).toEqual(cell().pool);
    expect(ledger.balance("loss:erosion", "N")).toBe(40);
    transferNutrient(soil, "P", 50, "plant:a", "uptake", ledger, trace);
    expect(field.f).toBe(0.25);
    expect(soilOutputs(field)).toMatchObject({ "ecology.soil.fertility": 0.25, "ecology.soil.N.kg": 1000,
      "ecology.soil.N.kg/m2": 0.1, "ecology.soil.P.kg": 50, "ecology.soil.P.kg/m2": 0.005 });
    expect(trace.failed()).toEqual([]);
    expect(() => createField("zero", 0.5, new SoilCell("zero", 1, { N: 0, P: 1, K: 1 }))).toThrow("reference");
    const zero = createField("zero-index", 0, cell("zero-index"));
    expect(zero.f).toBe(0);
    expect(() => fallow(zero, 1)).toThrow("f0 > 0");
    expect(() => new SoilCell("bad", 0, { N: 1, P: 1, K: 1 })).toThrow();
  });
});
