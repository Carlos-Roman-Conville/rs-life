import { describe, expect, it } from "vitest";
import { defaultRegistry } from "../src/registry.ts";
import { Scheduler } from "../src/scheduler.ts";
import { World } from "../src/world.ts";

function fixture() {
  const world = new World(defaultRegistry());
  const component = world.registry.addComponent({
    id: "tank", kind: "vessel", material: [...world.registry.materials.keys()][0],
    mass: 1, temperatureC: 20, contents: [{ substance: "water", phase: "liquid", mass: 100 }],
    ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: {},
  });
  world.conserve("water", [component.id]);
  const scheduler = new Scheduler();
  for (const [name, every] of [["slow", 2], ["fast", 1], ["third", 3]] as const) {
    scheduler.add({ name, every, step(w, dt) {
      w.registry.addContent(component, "water", "liquid", -dt);
      w.trace.record({ t: w.t, process: name, quantity: "mass:water", from: component.id, to: "outside", amount: dt });
    } });
  }
  return { world, scheduler };
}

describe("scheduler single steps", () => {
  it("run and single steps with either clock give equal times, component states and traces", () => {
    const direct = fixture(), summed = fixture(), clocked = fixture();
    direct.scheduler.run(direct.world, 10, 1);
    for (let k = 1; k <= 10; k++) {
      summed.scheduler.stepOnce(summed.world, 1);
      clocked.scheduler.stepOnce(clocked.world, 1, k);
    }
    for (const result of [direct, summed, clocked]) {
      expect(result.scheduler.stepCount).toBe(10);
      expect(result.world.t).toBe(10);
      expect(result.world.registry.components).toEqual(direct.world.registry.components);
      expect(result.world.trace).toEqual(direct.world.trace);
      expect(result.world.trace.failed()).toEqual([]);
    }
    expect(direct.world.trace.transfers.slice(0, 4).map(x => [x.process, x.t, x.amount]))
      .toEqual([["fast", 0, 1], ["slow", 1, 2], ["fast", 1, 1], ["fast", 2, 1]]);
    expect(direct.world.trace.checks.map(x => x.t)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(direct.world.registry.component("tank").contents[0].mass).toBe(71);
  });

  it("uses explicit end times including zero before conservation checks without float accumulation", () => {
    const { world, scheduler } = fixture();
    world.t = -0.1;
    scheduler.stepOnce(world, 0.1, 0);
    expect(world.t).toBe(0);
    expect(world.trace.transfers[0].t).toBe(-0.1);
    expect(world.trace.checks[0].t).toBe(0);
    for (let k = 1; k <= 10; k++) scheduler.stepOnce(world, 0.1, k / 10);
    expect(world.t).toBe(1);
    expect(world.trace.checks.map(x => x.t)).toEqual(Array.from({ length: 11 }, (_, k) => k / 10));
  });

  it("rounds run's step count and preserves cadence across run and stepOnce calls", () => {
    const { world, scheduler } = fixture();
    scheduler.run(world, 1.4, 1);
    scheduler.stepOnce(world, 1);
    scheduler.run(world, 1.6, 1);
    expect(scheduler.stepCount).toBe(4);
    expect(world.t).toBe(4);
    expect(world.trace.transfers.filter(x => x.process === "slow").map(x => x.t)).toEqual([1, 3]);
  });
});
