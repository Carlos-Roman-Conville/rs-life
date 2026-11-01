import { EventBus, type EventReader } from "@rex/kernel";
import { describe, expect, it, vi } from "vitest";
import { composeLabour, intentionLabour, type IntentionLabourOptions } from "../src/labour-intentions.ts";
import { createPopulation, populationLabourSupply } from "../src/population.ts";

const options = (): IntentionLabourOptions => ({
  workAction: "work", refuseAction: "refuse_work",
  roleOf: i => i.target === "post.farm" ? "farmer" : i.target === "post.smith" ? "smith" : null,
  holds: person => person === "person.ada",
});
function emit(bus: EventBus, patch: Record<string, unknown> = {}, at: EventReader = { t: 0, phase: 1, position: 0 }) {
  return bus.emit({ ...at, source: "cognition.decision.select", type: "cognition.intention",
    payload: { id: "intent.work", mind: "person.ada", action: "work", target: "post.farm", t: 0,
      status: "active", terms: { hours: 8, wage_min: 3 }, ...patch } });
}

describe("labour from intentions (IF-27)", () => {
  it("offers work hours and the optional reservation wage", () => {
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBeNull();
    emit(bus);
    expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(3);
    emit(bus, { terms: { hours: 6 } });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(6);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBeNull();
    emit(bus, { terms: { hours: 0, wage_min: 0 } });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(0);
  });

  it("refuses and restores work in sequence without affecting another role", () => {
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    emit(bus, { t: 200 });
    emit(bus, { target: "post.smith", terms: { hours: 4, wage_min: 7 } });
    emit(bus, { id: "intent.refuse", action: "refuse_work", terms: undefined, t: 100 });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBeNull();
    expect(persons.hours("person.ada", "smith", 0)).toBe(4);
    expect(persons.reservationWage("person.ada", "smith", 0)).toBe(7);
    emit(bus, { id: "intent.return", t: 50, status: "completed", terms: { hours: 2, wage_min: 5 } });
    emit(bus, { mind: "person.ben", action: "refuse_work" });
    emit(bus, { action: "wait" });
    bus.emit({ t: 0, phase: 1, position: 0, source: "host", type: "unrelated", payload: null });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(2);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(5);
    expect(persons.hours("person.ada", "smith", 0)).toBe(4);
  });

  it("respects reader time, phase and position and sees advances without new events", () => {
    const bus = new EventBus();
    let reader: EventReader = { t: 10, phase: 1, position: 0 };
    const persons = intentionLabour(bus, { ...options(), reader: () => reader });
    emit(bus, {}, reader);
    emit(bus, { terms: { hours: 6, wage_min: 2 } }, { t: 10, phase: 1, position: 1 });
    emit(bus, { action: "refuse_work", terms: undefined }, { t: 10, phase: 2, position: 0 });
    emit(bus, { terms: { hours: 3, wage_min: 9 } }, { t: 11, phase: 0, position: 0 });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(3);
    reader = { t: 10, phase: 1, position: 1 };
    expect(persons.hours("person.ada", "farmer", 0)).toBe(6);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(2);
    reader = { t: 10, phase: 2, position: 0 };
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBeNull();
    reader = { t: 11, phase: 0, position: 0 };
    expect(persons.hours("person.ada", "farmer", 0)).toBe(3);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(9);
  });

  it("repeats pure queries without emissions or population changes", () => {
    const bus = new EventBus(), config = options(), persons = intentionLabour(bus, config);
    const configBefore = { ...config };
    emit(bus);
    const before = bus.state();
    const publish = vi.spyOn(bus, "emit");
    for (let repeat = 0; repeat < 3; repeat++) {
      expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
      expect(persons.reservationWage("person.ada", "farmer", 0)).toBe(3);
    }
    expect(bus.state()).toEqual(before);
    expect(publish).not.toHaveBeenCalled();
    expect(config).toEqual(configBefore);
  });

  it("reads restored bus contents even with the same counter", () => {
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    emit(bus);
    expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
    const replacement = new EventBus();
    emit(replacement, { action: "refuse_work", terms: undefined });
    bus.restore(replacement.state());
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    expect(persons.reservationWage("person.ada", "farmer", 0)).toBeNull();
  });

  it.each(["hours", "wage_min"] as const)("rejects negative or non-finite %s naming the intention", field => {
    for (const invalid of [-1, NaN, Infinity, -Infinity]) {
      const bus = new EventBus(), persons = intentionLabour(bus, options());
      emit(bus, { id: "intent.invalid", terms: { hours: 8, wage_min: 3, [field]: invalid } });
      expect(() => persons.hours("person.ada", "farmer", 0)).toThrow("intent.invalid");
      expect(() => persons.reservationWage("person.ada", "farmer", 0)).toThrow("intent.invalid");
      emit(bus);
      expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
    }
  });

  it("checks event fields at runtime and rejects missing work hours", () => {
    for (const patch of [{ terms: undefined }, { terms: { wage_min: 2 } }, { terms: { hours: "8" } },
      { terms: [] }, { target: 1 }, { id: "" }, { mind: null }, { action: null }, { t: NaN }, { status: "unknown" }]) {
      const bus = new EventBus(), persons = intentionLabour(bus, options());
      emit(bus, patch);
      expect(() => persons.hours("person.ada", "farmer", 0)).toThrow(/labour: intention/);
    }
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    bus.emit({ t: 0, phase: 1, position: 0, source: "cognition", type: "cognition.intention", payload: null });
    expect(() => persons.hours("person.ada", "farmer", 0)).toThrow("evt.000001");
  });

  it("uses host action names and only roles matched by roleOf", () => {
    const bus = new EventBus();
    const persons = intentionLabour(bus, { ...options(), workAction: "offer", refuseAction: "decline" });
    emit(bus);
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
    emit(bus, { action: "offer" });
    emit(bus, { action: "decline", target: undefined, terms: undefined });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(8);
    emit(bus, { action: "decline" });
    expect(persons.hours("person.ada", "farmer", 0)).toBe(0);
  });

  it("rejects cohort members in both named-person queries", () => {
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    emit(bus, { mind: "person.ben" });
    expect(() => persons.hours("person.ben", "farmer", 0)).toThrow("not held as an individual");
    expect(() => persons.reservationWage("person.ben", "farmer", 0)).toThrow("not held as an individual");
  });

  it("routes every composed method to its owner with all arguments", () => {
    const rows = [{ category: "adultsM", persons: 2, personHours: 16 }];
    const cohort = { supply: vi.fn(() => rows), hours: vi.fn(() => 12), draw: vi.fn(() => 5) };
    const persons = { holds: vi.fn(options().holds), hours: vi.fn(() => 8), reservationWage: vi.fn(() => 3) };
    const host = { available: vi.fn(() => true), productivity: vi.fn(() => 1.5) };
    const labour = composeLabour(cohort, persons, host), requires = { skill: 2 };
    expect(labour.supply(7)).toBe(rows);
    expect(cohort.supply).toHaveBeenCalledWith(7);
    expect(labour.hours("person.ada", "farmer", 7)).toBe(8);
    expect(persons.hours).toHaveBeenCalledWith("person.ada", "farmer", 7);
    expect(cohort.hours).not.toHaveBeenCalled();
    expect(labour.hours("pool.adults", "smith", 7)).toBe(12);
    expect(cohort.hours).toHaveBeenCalledWith("pool.adults", "smith", 7);
    expect(persons.hours).toHaveBeenCalledTimes(1);
    expect(labour.draw("pool.adults", "smith", requires, 5, 7)).toBe(5);
    expect(cohort.draw).toHaveBeenCalledWith("pool.adults", "smith", requires, 5, 7);
    expect(labour.available("person.ada", 7)).toBe(true);
    expect(host.available).toHaveBeenCalledWith("person.ada", 7);
    expect(labour.productivity("person.ada", "farmer")).toBe(1.5);
    expect(host.productivity).toHaveBeenCalledWith("person.ada", "farmer");
    expect(labour.reservationWage!("person.ada", "farmer", 7)).toBe(3);
    expect(persons.reservationWage).toHaveBeenCalledWith("person.ada", "farmer", 7);
  });

  it("never adds individual work to cohort supply or pool hours (CG-23, C-Q26)", () => {
    // Ada is already an individual; these two adults are other people. No promotion occurs here.
    const p = createPopulation({ adultsM: 2 }), before = structuredClone(p);
    const cohort = populationLabourSupply(p, { hoursPerDay: 8, pools: { adults: ["adultsM"] } });
    const bus = new EventBus(), persons = intentionLabour(bus, options());
    const labour = composeLabour(cohort, persons, { available: () => true, productivity: () => 1 });
    const supply = labour.supply(0);
    expect(labour.hours("adults", "farmer", 0)).toBe(16);
    emit(bus);
    expect(labour.hours("person.ada", "farmer", 0)).toBe(8);
    expect(labour.supply(0)).toEqual(supply);
    expect(labour.hours("adults", "farmer", 0)).toBe(16);
    expect(labour.draw("adults", "farmer", null, 6, 0)).toBe(6);
    expect(labour.hours("adults", "smith", 0)).toBe(10);
    expect(labour.hours("person.ada", "farmer", 0)).toBe(8);
    emit(bus, { action: "refuse_work", terms: undefined });
    expect(labour.hours("person.ada", "farmer", 0)).toBe(0);
    expect(labour.hours("adults", "farmer", 0)).toBe(10);
    expect(labour.draw("adults", "farmer", null, 100, 0)).toBe(10);
    expect(labour.hours("adults", "farmer", 0)).toBe(0);
    expect(labour.supply(0)).toEqual(supply);
    expect(p).toEqual(before);
  });
});
