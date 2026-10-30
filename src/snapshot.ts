/** P0 comparison only: replay rebuilds the initial world and reruns the same inputs and seed.
 * Kahan carry, RNG/process closures and recomputable trace fold caches are not captured; this cannot restore a run.
 */
import type { World } from "./world.ts";
import type { Scheduler } from "./scheduler.ts";

/** Capture detached plain data, preserving component, edge and trace insertion order.
 * A null stepCount means no scheduler was supplied, rather than an unstarted scheduler.
 */
export function snapshotWorld(world: World, scheduler?: Scheduler) {
  return structuredClone({
    components: [...world.registry.components.values()],
    graph: { edges: world.graph.edges },
    t: world.t,
    env: world.env,
    ...world.ledgerState(),
    trace: {
      transfers: world.trace.transfers,
      checks: world.trace.checks,
      notes: world.trace.notes,
      crises: world.trace.crises,
    },
    stepCount: scheduler?.stepCount ?? null,
  });
}
