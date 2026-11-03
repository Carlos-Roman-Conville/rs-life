import { describe, expect, it, vi } from "vitest";
import * as library from "../src/library.ts";
import {
  energyRequirement, householdRequirement, type EnergyRequirementOptions, type EnergyRequirementResult,
  type HouseholdRequirementResult, type Component, defaultRegistry, World, Scheduler,
  absorbedFraction, foodRow, ingest, physiologyProcess, libraryColumns, libraryTable,
} from "../src/index.ts";

const DAY = 86400;
const schedule = [{ met: 0.95, seconds: 8 * 3600 }, { met: 2.5, seconds: 10 * 3600 }, { met: 4, seconds: 6 * 3600 }];
const bodyInput = () => ({ mass: 70, props: { height_cm: 175, age_y: 30, male: 1 } });
const food = foodRow("ships-biscuit");
const meal: NonNullable<EnergyRequirementOptions["meal"]> = {
  vitCMg: 0, fatG: 0, flux: false, chronicFlux: false, rum: false,
};

function fixture() {
  const registry = defaultRegistry(), w = new World(registry);
  const body: Component = { id: "body", kind: "body", material: "flesh", ...bodyInput(),
    temperatureC: 37, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 } };
  const room: Component = { id: "room", kind: "room", material: "air_mass", mass: 1e6,
    temperatureC: 22, contents: [], ports: [], props: {}, condition: { capability: 1, control: 1, accuracy: 1 } };
  registry.addComponent(body); registry.addComponent(room);
  return { w, body };
}

describe("subsistence requirement (GOV)", () => {
  it("agrees with physiology expenditure_kcal over the same day to 1e-9 relative", () => {
    const { w, body } = fixture(), scheduler = new Scheduler();
    const expected = energyRequirement(body, schedule).absorbedKcal!;
    let hour = 0;
    scheduler.add(physiologyProcess("body", "room", { every: 1, schedule: schedule.map(entry => {
      const fromH = hour;
      hour += entry.seconds / 3600;
      return { fromH, toH: hour, activity: entry.met };
    }) }));
    for (let t = 0; t < DAY; t += 60) {
      scheduler.run(w, 60, 60);
      // Replace the water lost each step so both integrals use the same body mass/RMR.
      ingest(w, "body", { waterKg: 70 - body.mass });
    }
    expect(w.t).toBe(DAY);
    expect(Math.abs(body.props.expenditure_kcal - expected) / expected).toBeLessThanOrEqual(1e-9);
  });

  it.each([[], [{ met: 1, seconds: DAY - 1 }], [{ met: 1, seconds: DAY + 1 }]].map(entries => ({ entries })))(
    "rejects a schedule not summing to 86400 seconds ($entries)", ({ entries }) => {
      expect(() => energyRequirement(bodyInput(), entries)).toThrow("86400");
    });

  it.each([
    [{ met: 1, seconds: -1 }, { met: 1, seconds: DAY + 1 }],
    [{ met: 1, seconds: NaN }], [{ met: 1, seconds: Infinity }],
    [{ met: NaN, seconds: DAY }], [{ met: Infinity, seconds: DAY }], [{ met: -1, seconds: DAY }],
  ].map(entries => ({ entries })))("rejects invalid schedule entries ($entries)", ({ entries }) => {
    expect(() => energyRequirement(bodyInput(), entries)).toThrow();
  });

  it.each(["height_cm", "age_y", "male"])("returns null without %s, never a fallback", field => {
    const body: Pick<Component, "mass" | "props"> = bodyInput();
    delete body.props[field];
    expect(energyRequirement(body, schedule, { food, meal })).toMatchObject({ absorbedKcal: null, foodKcal: null });
  });

  it.each([meal, { ...meal, flux: true }, { ...meal, gutFunction: 0.4 }, { ...meal, gutFunction: 0 }])(
    "foodKcal equals absorbedKcal / absorbedFraction (%j)", meal => {
      const result = energyRequirement(bodyInput(), schedule, { food, meal });
      expect(result.foodKcal).toBe(result.absorbedKcal! / absorbedFraction("energy", food, meal));
    });

  it("leaves foodKcal null without both food and meal", () => {
    for (const options of [{}, { food }, { meal }]) {
      const result = energyRequirement(bodyInput(), schedule, options);
      expect(result.absorbedKcal).toBeGreaterThan(0);
      expect(result.foodKcal).toBeNull();
    }
  });

  it("reports unstated (LIFE-17) because the library does not state the kcal basis", () => {
    const rows = libraryTable("nutrition", "foods"), columns = libraryColumns("nutrition", "foods");
    expect(JSON.stringify({ rows, columns })).not.toMatch(/Atwater|metabolisable|metabolizable|gross energy/i);
    expect(energyRequirement(bodyInput(), schedule, { food, meal }).basis).toBe("unstated (LIFE-17)");
    expect(energyRequirement(bodyInput(), schedule).basis).toBe("unstated (LIFE-17)");
  });

  it("reads an explicit row or kcal column basis when the library supplies it", () => {
    const columns = vi.spyOn(library, "libraryColumns");
    const rows = vi.spyOn(library, "libraryTable");
    try {
      columns.mockReturnValue(["id", "kcal", "Energy basis"]);
      rows.mockReturnValue([{ id: food.id, kcal: 380, "Energy basis": "Atwater metabolisable energy" }]);
      expect(energyRequirement(bodyInput(), schedule, { food }).basis).toBe("Atwater metabolisable energy");
      columns.mockReturnValue(["id", "kcal (gross energy)"]);
      expect(energyRequirement(bodyInput(), schedule).basis).toBe("kcal (gross energy)");
    } finally {
      columns.mockRestore(); rows.mockRestore();
    }
  });

  it("lists growth, thermoregulation, pregnancy and lactation as omitted (CG-14)", () => {
    expect(energyRequirement(bodyInput(), schedule).omitted).toEqual(["growth", "thermoregulation", "pregnancy", "lactation"]);
  });

  it("sums a household and reports null members separately for each quantity", () => {
    const first: EnergyRequirementResult = energyRequirement(bodyInput(), schedule, { food, meal });
    const second = energyRequirement({ mass: 55, props: { height_cm: 160, age_y: 28, male: 0 } }, schedule, { food, meal });
    const sum: HouseholdRequirementResult = householdRequirement([first, second]);
    expect(sum).toEqual({ absorbedKcal: first.absorbedKcal! + second.absorbedKcal!,
      foodKcal: first.foodKcal! + second.foodKcal!, nullMembers: { absorbedKcal: [], foodKcal: [] } });
    const missingBody = energyRequirement({ mass: 70, props: {} }, schedule, { food, meal });
    const missingFood = energyRequirement(bodyInput(), schedule);
    expect(householdRequirement([first, missingBody, missingFood])).toEqual({
      absorbedKcal: null, foodKcal: null, nullMembers: { absorbedKcal: [1], foodKcal: [1, 2] },
    });
    expect(householdRequirement([first, missingFood])).toEqual({ absorbedKcal: first.absorbedKcal! + missingFood.absorbedKcal!,
      foodKcal: null, nullMembers: { absorbedKcal: [], foodKcal: [1] } });
    expect(householdRequirement([])).toEqual({ absorbedKcal: 0, foodKcal: 0, nullMembers: { absorbedKcal: [], foodKcal: [] } });
  });

  it("is pure on repeat calls: no input, world, trace or result mutation", () => {
    const { w, body } = fixture();
    const before = structuredClone({ body, schedule, food, meal,
      records: w.trace.records, transfers: w.trace.transfers, t: w.t });
    const first = energyRequirement(body, schedule, { food, meal });
    const second = energyRequirement(body, schedule, { food, meal });
    expect(second).toEqual(first);
    const members = [first, second], saved = structuredClone(members);
    expect(householdRequirement(members)).toEqual(householdRequirement(members));
    expect(members).toEqual(saved);
    first.omitted.push("caller edit");
    expect(energyRequirement(body, schedule, { food, meal })).toEqual(second);
    expect({ body, schedule, food, meal, records: w.trace.records, transfers: w.trace.transfers, t: w.t }).toEqual(before);
  });
});
