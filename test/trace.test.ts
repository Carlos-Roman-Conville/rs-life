import { describe, expect, it, vi } from "vitest";
import { Trace } from "../src/trace.ts";
import { World } from "../src/world.ts";
import { defaultRegistry } from "../src/registry.ts";
import { runHorseStable } from "../examples/horse-stable.ts";

describe("trace compaction", () => {
  it("keeps exact all-time sums across partial folds, retained tails and repeated compaction", () => {
    const full = new Trace(), compacted = new Trace();
    const record = (t: number, amount: number) => {
      for (const trace of [full, compacted]) trace.record({ t, amount, process: "fixture", quantity: "q", from: "a", to: "b" });
    };
    record(0, 1e16);
    expect(compacted.into("b", "q")).toBe(1e16);
    record(1, -1e16); record(2, 1);
    expect(compacted.compact(2)).toBe(2);
    expect(compacted.transfers.map(x => x.t)).toEqual([2]);
    record(3, 2);
    expect(compacted.into("b", "q")).toBe(full.into("b", "q"));
    expect(compacted.compact(4)).toBe(2);
    expect(compacted.compact(4)).toBe(0);
    record(4, 0.25);
    expect(compacted.outOf("a", "q")).toBe(full.outOf("a", "q"));
    expect(compacted.into("b", "q")).toBe(3.25);
    expect(compacted.into("missing", "q")).toBe(0);
  });

  it("retains crises, all checks, notes and exact failed checks", () => {
    const trace = new Trace();
    trace.record({ t: 0, amount: 1, process: "fixture", quantity: "q", from: "a", to: "b" });
    trace.check(0, "q", 1, 1, 0);
    trace.check(0, "q", 1, 2, 0);
    trace.note(0, "keep");
    trace.crises.push({ kind: "crisis", body: "a", cause: "fixture", source: "test", startedAt: 0, durationSeconds: 0, risk: null });
    const before = structuredClone({ checks: trace.checks, notes: trace.notes, crises: trace.crises, failed: trace.failed() });
    trace.compact(1);
    expect({ checks: trace.checks, notes: trace.notes, crises: trace.crises, failed: trace.failed() }).toEqual(before);
  });

  it("rejects unread transfers without moving cursors and preserves both ledgers after a partial drop", () => {
    const w = new World(defaultRegistry());
    const tank = w.registry.addComponent({ id: "tank", kind: "vessel", material: "flesh", mass: 1,
      temperatureC: 20, contents: [{ substance: "water", phase: "liquid", mass: 10 }], ports: [],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: {} });
    w.conserve("water", [tank.id]); w.conserveElements([tank.id]);
    const drain = (t: number) => {
      w.registry.addContent(tank, "water", "liquid", -1);
      w.trace.record({ t, amount: 1, process: "drain", quantity: "mass:water", from: "tank", to: "outside" });
    };
    drain(0); drain(1);
    const before = w.ledgerState();
    expect(() => w.trace.compact(1)).toThrow(/afterStep/);
    expect(w.ledgerState()).toEqual(before);
    expect(w.trace.transfers).toHaveLength(2);
    w.afterStep();
    expect(w.trace.compact(1)).toBe(1);
    expect(w.ledgerState().cursor).toBe(1);
    expect(w.ledgerState().elements.every(c => c.cursor === 1)).toBe(true);
    drain(2); w.afterStep();
    w.trace.compact(3);
    drain(3); w.afterStep();
    expect(w.trace.failed()).toEqual([]);
    expect(w.ledgerState().conserved[0].left).toBe(4);
    expect(w.trace.outOf("tank", "mass:water")).toBe(4);
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
    } finally { spy.mockRestore(); }
  }, 120000);
});
