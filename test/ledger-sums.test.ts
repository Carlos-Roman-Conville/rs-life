import { describe, expect, it, vi } from "vitest";
import { World } from "../src/world.ts";
import { Trace } from "../src/trace.ts";
import { defaultRegistry } from "../src/registry.ts";
import { runHorseStable } from "../examples/horse-stable.ts";

const count = 1_000_000, amount = 1e-6;
// Integer units of 1e-12 kg give an independent exact decimal reference before converting to kg.
const exact = (initial: number, transfers: number) => Number(BigInt(initial) * 1_000_000_000_000n
  + BigInt(transfers) * 1_000_000n) / 1e12;
const fixture = (initial: number, elements = false) => {
  const w = new World(defaultRegistry());
  // Arithmetic-only element fixture: exactly one mole of H per kg, avoiding molar-mass rounding.
  if (elements) w.registry.addSubstance({ ...w.registry.substance("water"), formula: "H", molarMass: 1 });
  const tank = w.registry.addComponent({ id: "tank", kind: "vessel", material: "flesh", mass: 1,
    temperatureC: 20, contents: [{ substance: "water", phase: "liquid" as const, mass: initial }], ports: [],
    condition: { capability: 1, control: 1, accuracy: 1 }, props: {} });
  w.conserve("water", [tank.id], 1e-9);
  if (elements) w.conserveElements([tank.id], 1e-9);
  const transfer = (kg: number) => {
    w.registry.addContent(tank, "water", "liquid", kg);
    w.trace.record({ t: w.t++, process: "fixture", quantity: "mass:water", amount: Math.abs(kg),
      from: kg >= 0 ? "outside" : tank.id, to: kg >= 0 ? tank.id : "outside" });
  };
  return { w, tank, transfer };
};

describe("compensated ledger sums", () => {
  it("adds a million microkilograms to 285 kg against exact integer arithmetic", () => {
    const { w, tank, transfer } = fixture(285);
    let naive = 285, naiveEntered = 0;
    for (let i = 0; i < count; i++) {
      transfer(amount); naive += amount; naiveEntered += amount;
      if ((i + 1) % 1000 === 0) { w.afterStep(); w.trace.compact(w.t); }
    }
    const reference = exact(285, count), check = w.trace.checks.at(-1)!;
    // Naively adding onto 285 kg errs by 2.5247572921216488e-9 kg. The old ledger's
    // zero-based entered sum alone errs by only 7.918110611626616e-12 kg; the next
    // tests seed that ledger with a large transfer so its own defect exceeds 1e-9.
    expect(Math.abs(naive - reference)).toBeGreaterThan(1e-9);
    expect(Math.abs(naiveEntered - exact(0, count))).toBeGreaterThan(1e-12);
    expect(Math.abs(check.expected - reference)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(tank.contents[0].mass - reference)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(w.trace.into("tank", "mass:water") - exact(0, count))).toBeLessThanOrEqual(1e-12);
    expect(w.trace.failed()).toEqual([]);
    console.info(`million transfers: naive mass error=${Math.abs(naive - reference)}, naive entered error=${Math.abs(naiveEntered - exact(0, count))}, compensated mass error=${Math.abs(check.expected - reference)}`);
  }, 30000);

  it.each([1, -1])("compensates seeded entered/left and signed element net, direction %i", direction => {
    const { w, transfer } = fixture(direction > 0 ? 285 : 600, true);
    transfer(direction * 285);
    let naive = 285;
    for (let i = 0; i < count; i++) {
      transfer(direction * amount); naive += amount;
      if ((i + 1) % 1000 === 0) { w.afterStep(); w.trace.compact(w.t); }
    }
    const ledger = w.ledgerState(), field = direction > 0 ? "entered" : "left";
    const total = ledger.conserved[0][field] + ledger.conservedCarries[0][field];
    const reference = exact(285, count);
    expect(Math.abs(naive - reference)).toBeGreaterThan(1e-9);
    expect(Math.abs(total - reference)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(ledger.elements[0].net + ledger.elements[0].carry - direction * reference)).toBeLessThanOrEqual(1e-12);
    const traced = direction > 0 ? w.trace.into("tank", "mass:water") : w.trace.outOf("tank", "mass:water");
    expect(Math.abs(traced - reference)).toBeLessThanOrEqual(1e-12);
    expect(w.trace.failed()).toEqual([]);
    const before = w.ledgerState();
    expect(ledger.conservedCarries[0][field]).not.toBe(0);
    expect(ledger.elements[0].carry).not.toBe(0);
    ledger.conservedCarries[0][field] = 999;
    ledger.elements[0].carry = 999;
    expect(w.ledgerState()).toEqual(before);
    console.info(`seeded direction ${direction}: naive error=${Math.abs(naive - reference)}, compensated ledger error=${Math.abs(total - reference)}, trace error=${Math.abs(traced - reference)}`);
  }, 30000);

  it("retains signed element net through cancellation and ignores internal and chemical transfers", () => {
    const { w, tank } = fixture(0, true);
    for (const [from, to, kg] of [["outside", "tank", 1], ["outside", "tank", 1e16], ["tank", "outside", 1e16]] as const) {
      w.trace.record({ t: w.t++, process: "fixture", quantity: "mass:water", from, to, amount: kg });
    }
    w.trace.record({ t: w.t++, process: "fixture", quantity: "mass:water", from: "tank", to: "tank", amount: 50 });
    w.trace.record({ t: w.t++, process: "fixture", quantity: "mass:water", from: "reaction", to: "tank", amount: 50, chemicalChange: true });
    // Only the element ledger excludes chemical conversion; inspect its result independently.
    tank.contents[0].mass = 1;
    w.afterStep();
    expect(w.trace.checks.find(c => c.quantity === "element:H")).toMatchObject({ expected: 1, actual: 1, ok: true });
    expect(w.ledgerState().elements[0].carry).toBe(1);
  });

  it("hourly compaction at dt 1 s for three horse-stable days preserves daily ledgers with bounded transfers", () => {
    const full = runHorseStable(3, { stepS: 1 });
    const compact = Trace.prototype.compact;
    let peak = 0, calls = 0;
    const spy = vi.spyOn(Trace.prototype, "compact").mockImplementation(function (this: Trace, horizon: number) {
      peak = Math.max(peak, this.transfers.length); calls++;
      return compact.call(this, horizon);
    });
    try {
      const reduced = runHorseStable(3, { stepS: 1, compactEveryS: 3600 });
      expect(calls).toBe(72);
      expect(peak).toBeLessThan(full.w.trace.transfers.length / 24);
      expect(reduced.w.trace.transfers).toHaveLength(0);
      expect(reduced.days).toEqual(full.days);
      expect(reduced.w.trace.failed()).toEqual([]);
      expect(full.w.trace.failed()).toEqual([]);
      expect(reduced.w.trace.checks.length).toBe(full.w.trace.checks.length);
      expect(reduced.w.trace.checks.every((c, i) => {
        const other = full.w.trace.checks[i];
        return c.t === other.t && c.quantity === other.quantity && c.expected === other.expected
          && c.actual === other.actual && c.tolerance === other.tolerance && c.ok === other.ok;
      })).toBe(true);
      expect(reduced.w.ledgerState().conserved).toEqual(full.w.ledgerState().conserved);
      expect(reduced.w.ledgerState().conservedCarries).toEqual(full.w.ledgerState().conservedCarries);
      expect(reduced.w.ledgerState().elements.map(({ cursor, ...c }) => c))
        .toEqual(full.w.ledgerState().elements.map(({ cursor, ...c }) => c));
      const keys = new Set<string>();
      for (const x of full.w.trace.transfers) {
        keys.add(`${x.from}\0${x.quantity}`); keys.add(`${x.to}\0${x.quantity}`);
      }
      for (const key of keys) {
        const [component, quantity] = key.split("\0");
        expect(reduced.w.trace.into(component, quantity)).toBe(full.w.trace.into(component, quantity));
        expect(reduced.w.trace.outOf(component, quantity)).toBe(full.w.trace.outOf(component, quantity));
      }
      const errors = new Map<string, number>();
      for (const c of full.w.trace.checks) errors.set(c.quantity, Math.max(errors.get(c.quantity) ?? 0, Math.abs(c.expected - c.actual)));
      console.info("three-day full/compacted identical; max errors:", Object.fromEntries(errors));
    } finally { spy.mockRestore(); }
  }, 180000);
});
