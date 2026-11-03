/** Capture detached plain data, preserving component, edge and trace insertion order.
 * A null stepCount means no scheduler was supplied, rather than an unstarted scheduler.
 */
export function snapshotWorld(world, scheduler) {
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
            records: world.trace.records,
            // Preserve the original checkpoint shape when nothing has been folded.
            ...(world.trace.checkSummaries.length ? { checkSummaries: world.trace.checkSummaries } : {}),
            ...(world.trace.noteSummaries.length ? { noteSummaries: world.trace.noteSummaries } : {}),
        },
        stepCount: scheduler?.stepCount ?? null,
    });
}
