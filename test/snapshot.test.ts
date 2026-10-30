import { describe, expect, it } from "vitest";
import { canonical } from "@rex/kernel";
import { defaultRegistry } from "../src/registry.ts";
import { Scheduler } from "../src/scheduler.ts";
import { snapshotWorld } from "../src/snapshot.ts";
import { World } from "../src/world.ts";
import { runHorseStable, STABLE } from "../examples/horse-stable.ts";
import { runWoundVariant, WOUND_FIXTURE, WOUND_ID } from "../examples/human-wound.ts";

describe("comparison snapshots", () => {
  it("captures detached component, graph, environment, ledger, trace and scheduler state", () => {
    const world = new World(defaultRegistry()), scheduler = new Scheduler();
    const tank = world.registry.addComponent({
      id: "tank", kind: "vessel", material: "flesh", mass: 1, temperatureC: 20,
      contents: [{ substance: "water", phase: "liquid", mass: 10 }],
      ports: [{ id: "out", kind: "fluid", direction: "out" }],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: { volume_m3: 1 },
    });
    world.graph.connect({ id: "drain", kind: "fluid", from: "tank", fromPort: "out",
      to: "outside", toPort: "in", props: { capacity: 1 } });
    world.env.outsideC = 15;
    world.conserve("water", [tank.id]);
    world.conserveElements([tank.id]);
    scheduler.add({ name: "drain", every: 1, step(w, dt) {
      w.registry.addContent(tank, "water", "liquid", -dt);
      w.trace.record({ t: w.t, process: "drain", quantity: "mass:water", from: tank.id, to: "outside", amount: dt });
      w.trace.note(w.t, "drained");
    } });
    world.trace.crises.push({ kind: "crisis", body: tank.id, cause: "fixture", source: "test",
      startedAt: 0, durationSeconds: 0, risk: null });
    scheduler.stepOnce(world, 1);

    const snapshot = snapshotWorld(world, scheduler), saved = canonical(snapshot);
    expect(snapshot.components).toEqual([tank]);
    expect(snapshot.graph.edges).toEqual(world.graph.edges);
    expect(snapshot.env).toEqual({ outsideC: 15 });
    expect(snapshot.t).toBe(1);
    expect(snapshot.stepCount).toBe(1);
    expect(snapshot.conserved[0]).toMatchObject({ initial: 10, entered: 0, left: 1 });
    expect(snapshot.cursor).toBe(1);
    expect(snapshot.elements.length).toBeGreaterThan(0);
    expect(snapshot.elements.every(c => c.cursor === 1)).toBe(true);
    expect(snapshot.elements.find(c => c.element === "H")!.net).toBeLessThan(0);
    expect(snapshot.trace).toEqual({ transfers: world.trace.transfers, checks: world.trace.checks,
      notes: world.trace.notes, crises: world.trace.crises });
    expect(world.trace.failed()).toEqual([]);
    expect(canonical(JSON.parse(JSON.stringify(snapshot)))).toBe(saved);

    scheduler.stepOnce(world, 1);
    tank.temperatureC = 30;
    tank.props.volume_m3 = 2;
    tank.ports[0].id = "changed";
    tank.condition.capability = 0.5;
    world.graph.edges[0].props.capacity = 2;
    world.env.outsideC = 25;
    world.trace.crises[0].durationSeconds = 1;
    expect(canonical(snapshot)).toBe(saved);
    expect(canonical(snapshotWorld(world, scheduler))).not.toBe(saved);

    const ledger = world.ledgerState(), expectedLedger = world.ledgerState();
    ledger.conserved[0].left = 999;
    ledger.conserved[0].components.push("outside");
    ledger.elements[0].net = 999;
    ledger.elements[0].cursor = 999;
    ledger.elements[0].components.push("outside");
    ledger.cursor = 999;
    expect(world.ledgerState()).toEqual(expectedLedger);
  });

  it("distinguishes an omitted scheduler from a scheduler at step zero", () => {
    const world = new World(defaultRegistry());
    expect(snapshotWorld(world).stepCount).toBeNull();
    expect(snapshotWorld(world, new Scheduler()).stepCount).toBe(0);
  });

  it("replaying two horse-stable days from the initial state gives canonical-equal snapshots", () => {
    const run = () => {
      const { w, sch, days } = runHorseStable(2);
      expect(days).toHaveLength(2);
      expect(sch.stepCount).toBe(2 * 86400 / STABLE.stepS);
      expect(w.trace.failed()).toEqual([]);
      return canonical(snapshotWorld(w, sch));
    };
    expect(run()).toBe(run());
  }, 30000);

  it("replaying human-wound from the initial state with the same seed gives canonical-equal snapshots", () => {
    const run = () => {
      const { week, medicine } = runWoundVariant("bound-after-hour", WOUND_FIXTURE.seed);
      expect(medicine.wounds).toHaveLength(1);
      expect(week.w.trace.notes.some(n => n.t === WOUND_FIXTURE.woundAtS && n.text.includes(WOUND_ID))).toBe(true);
      expect(week.w.trace.failed()).toEqual([]);
      return canonical(snapshotWorld(week.w));
    };
    expect(run()).toBe(run());
  }, 30000);
});
