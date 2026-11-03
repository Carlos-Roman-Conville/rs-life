/** P0 comparison only: replay rebuilds the initial world and reruns the same inputs and seed.
 * Kahan carry, RNG/process closures and recomputable trace fold caches are not captured; this cannot restore a run.
 */
import type { World } from "./world.ts";
import type { Scheduler } from "./scheduler.ts";
/** Capture detached plain data, preserving component, edge and trace insertion order.
 * A null stepCount means no scheduler was supplied, rather than an unstarted scheduler.
 */
export declare function snapshotWorld(world: World, scheduler?: Scheduler): {
    trace: {
        noteSummaries?: import("@rex/kernel").NoteSummary[] | undefined;
        checkSummaries?: import("@rex/kernel").CheckSummary[] | undefined;
        transfers: import("@rex/kernel").Transfer[];
        checks: import("@rex/kernel").Check[];
        notes: {
            t: number;
            text: string;
            keep?: boolean;
        }[];
        records: import("@rex/kernel").TraceRecord[];
    };
    stepCount: number | null;
    conserved: {
        quantity: string;
        substance?: string;
        components: string[];
        initial: number;
        tolerance: number;
        entered: number;
        left: number;
    }[];
    conservedCarries: {
        entered: number;
        left: number;
    }[];
    cursor: number;
    elements: {
        element: string;
        components: string[];
        initial: number;
        tolerance: number;
        net: number;
        carry: number;
        cursor: number;
    }[];
    components: import("./registry.ts").Component[];
    graph: {
        edges: import("./graph.ts").Edge[];
    };
    t: number;
    env: Record<string, number>;
};
