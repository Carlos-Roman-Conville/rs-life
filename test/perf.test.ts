import { describe, it, expect } from "vitest";
import { defaultRegistry } from "../src/registry.ts";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { bodyOutputs } from "../src/physiology.ts";
import { saturation } from "../src/circulation.ts";
import { cohbAfter } from "../src/respiration.ts";
import { bleed, circulationProcess, initialiseCirculation } from "../src/circulation.ts";

/** A body bleeding for one simulated day at the engine's own one-second step, circulation every step. The host bleeds
 * each second, so the trace grows by three transfers a step and the process's conservation check reads all of them. */
function bleedingDay(seconds: number): { ms: number; msPerStep: number; w: World } {
  const w = new World(defaultRegistry());
  w.registry.addComponent({ id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37,
    contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
  const out = bodyOutputs(w.registry.component("body"));
  out.sao2 = saturation(95); out.cohb = cohbAfter(0, 0, 6, 1);
  initialiseCirculation(w, "body");
  const s = new Scheduler();
  s.add({ name: "wound", every: 1, step(world, dt) { bleed(world, "body", 1, dt, 0); } });
  s.add(circulationProcess("body"));
  const start = performance.now();
  s.run(w, seconds, 1);
  const ms = performance.now() - start;
  return { ms, msPerStep: ms / seconds, w };
}

describe("circulation cost", () => {
  it("a body bleeding for one simulated day at the 1 s step stays under the bound", () => {
    const { ms, msPerStep, w } = bleedingDay(86400);
    console.log(`circulation, one bleeding day at 1 s: ${ms.toFixed(0)} ms (${msPerStep.toFixed(4)} ms a step)`);
    expect(w.trace.failed().length).toBe(0);
    expect(ms).toBeLessThan(BOUND_MS);
  }, 600000);
});
/** Measured on this machine (2569): 585075 ms (6.77 ms a step, growing with the trace) before `Trace.into`/`outOf` kept running
 * sums; 848 ms (0.0098 ms a step) after. The library tables were already cached by `libraryTable`; the cost was the
 * conservation check re-summing every transfer in the trace on each call. The bound leaves ~6x headroom. */
const BOUND_MS = 5000;
