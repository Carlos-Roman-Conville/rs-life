import { describe, expect, it } from "vitest";
import { Trace } from "../src/trace.ts";
import { World } from "../src/world.ts";
import { defaultRegistry } from "../src/registry.ts";
import { snapshotWorld } from "../src/snapshot.ts";

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

  it("retains crises, crisis/death notes and exact old failures while folding passes and ordinary notes", () => {
    const trace = new Trace();
    trace.record({ t: 0, amount: 1, process: "fixture", quantity: "q", from: "a", to: "b" });
    trace.check(0, "q", 1, 1, 0);
    trace.check(0, "q", 1, 2, 0);
    trace.note(0, "anatomy: assembled a");
    trace.note(0, "anatomy: assembled b");
    trace.note(0, "deficiency vitamin stage 1");
    for (const text of ["crisis: a/fixture", "DEATH: a", "a died", "a is dead", "multiple crises"]) trace.note(0, text);
    trace.note(1, "anatomy: at horizon");
    trace.crises.push({ kind: "crisis", body: "a", cause: "fixture", source: "test", startedAt: 0, durationSeconds: 0, risk: null });
    const failed = structuredClone(trace.failed()), crises = structuredClone(trace.crises);
    const retainedNotes = trace.notes.filter(n => !/^(anatomy|deficiency)/.test(n.text) || n.t === 1);
    trace.compact(1);
    expect(trace.checks).toEqual(failed);
    expect(trace.failed()).toEqual(failed);
    expect(trace.crises).toEqual(crises);
    expect(trace.notes).toEqual(retainedNotes);
    expect(trace.checkSummaries).toEqual([{ quantity: "q", count: 1, maxAbsError: 0, maxErrorAt: 0 }]);
    expect(trace.noteSummaries).toEqual([{ kind: "anatomy", count: 2 }, { kind: "deficiency", count: 1 }]);
    expect(trace.checkCount).toBe(2);
    expect(trace.summary()).toContain("2 checks, 1 failed");
    trace.compact(1);
    expect(trace.failed()).toEqual(failed);
    expect(trace.checkCount).toBe(2);
    expect(trace.noteSummaries[0].count).toBe(2);
  });

  it("folds without transfers, respects the strict horizon and merges counts and maximum times", () => {
    const trace = new Trace();
    trace.check(0, "q", 4, 4, 0);
    trace.check(1, "q", 4, 3.5, 1);
    trace.check(2, "q", 4, 4.5, 1); // equal maximum retains its first time
    trace.check(3, "r", 1, 1, 0);
    trace.check(4, "q", 4, 3, 1);
    trace.check(5, "q", 4, 2, 1); // failure must not inflate passing maximum
    trace.note(0, "status: ready");
    expect(trace.compact(2)).toBe(0);
    expect(trace.checks.map(c => c.t)).toEqual([2, 3, 4, 5]);
    expect(trace.checkSummaries).toEqual([{ quantity: "q", count: 2, maxAbsError: 0.5, maxErrorAt: 1 }]);
    trace.compact(4);
    expect(trace.checkSummaries).toEqual([
      { quantity: "q", count: 3, maxAbsError: 0.5, maxErrorAt: 1 },
      { quantity: "r", count: 1, maxAbsError: 0, maxErrorAt: 3 },
    ]);
    trace.compact(Infinity);
    expect(trace.checkSummaries[0]).toEqual({ quantity: "q", count: 4, maxAbsError: 1, maxErrorAt: 4 });
    expect(trace.failed().map(c => c.t)).toEqual([5]);
    expect(trace.checkCount).toBe(6);
    expect(trace.noteSummaries).toEqual([{ kind: "status", count: 1 }]);
    expect(trace.notes).toHaveLength(1);
    expect(trace.notes[0].text).toMatch(/^CONSERVATION FAILED/);
  });

  it("does not fold checks or notes unless compact is called", () => {
    const trace = new Trace();
    trace.check(0, "q", 1, 1, 0);
    trace.note(0, "status: ready");
    expect(trace.failed()).toEqual([]);
    expect(trace.summary()).toContain("1 checks, 0 failed");
    expect(trace.checks).toHaveLength(1);
    expect(trace.notes).toHaveLength(1);
    expect(trace.checkSummaries).toEqual([]);
    expect(trace.noteSummaries).toEqual([]);
  });

  it("snapshots detached summaries alongside every retained failure", () => {
    const world = new World(defaultRegistry());
    world.trace.check(0, "q", 1, 1, 0);
    world.trace.check(0, "q", 1, 2, 0);
    world.trace.note(0, "status: ready");
    world.trace.compact(1);
    const snapshot = snapshotWorld(world);
    expect(snapshot.trace.checks).toEqual(world.trace.failed());
    expect(snapshot.trace.checkSummaries).toEqual([{ quantity: "q", count: 1, maxAbsError: 0, maxErrorAt: 0 }]);
    expect(snapshot.trace.noteSummaries).toEqual([{ kind: "status", count: 1 }]);
    world.trace.check(1, "q", 2, 1, 1);
    world.trace.note(1, "status: later");
    world.trace.compact(2);
    expect(snapshot.trace.checkSummaries![0].count).toBe(1);
    expect(snapshot.trace.noteSummaries![0].count).toBe(1);
    expect(snapshot.trace.checks).toEqual(world.trace.failed());
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
    w.trace.check(0, "fixture", 1, 1, 0);
    w.trace.note(0, "status: unread");
    const before = w.ledgerState();
    expect(() => w.trace.compact(1)).toThrow(/afterStep/);
    expect(w.ledgerState()).toEqual(before);
    expect(w.trace.transfers).toHaveLength(2);
    expect(w.trace.checkSummaries).toEqual([]);
    expect(w.trace.noteSummaries).toEqual([]);
    expect(w.trace.checks).toHaveLength(1);
    expect(w.trace.notes).toHaveLength(1);
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
