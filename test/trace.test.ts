import { describe, expect, it } from "vitest";
import { Trace } from "../src/trace.ts";
import { World } from "../src/world.ts";
import { defaultRegistry } from "../src/registry.ts";

describe("trace compaction", () => {
  it("preserves low bits through cancellation, retained tails, queries and compaction", () => {
    for (const compact of [false, true]) {
      const trace = new Trace();
      for (const [t, amount] of [1, 1e16, -1e16, 0.25].entries()) {
        trace.record({ t, amount, process: "fixture", quantity: "q", from: "a", to: "b" });
        if (t === 1) expect(trace.into("b", "q")).toBe(1e16);
        if (compact) trace.compact(t); // retain this transfer, already folded once
      }
      expect(trace.into("b", "q")).toBe(1.25);
      expect(trace.outOf("a", "q")).toBe(1.25);
      expect(trace.into("a", "q")).toBe(0);
      expect(trace.outOf("b", "q")).toBe(0);
    }
  });

  it("clears carries with the sums when a shortened transfer array resets the cache", () => {
    const trace = new Trace();
    for (const amount of [1e16, 1]) trace.record({ t: 0, amount, process: "fixture", quantity: "q", from: "a", to: "b" });
    expect(trace.into("b", "q")).toBe(1e16);
    trace.transfers.length = 0;
    trace.record({ t: 1, amount: 2, process: "fixture", quantity: "q", from: "a", to: "b" });
    expect(trace.into("b", "q")).toBe(2);
    expect(trace.outOf("a", "q")).toBe(2);
  });

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

});
