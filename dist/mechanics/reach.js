/** Invalid fixture configuration, with every detected input problem named. */
export class PlacementConfigurationError extends Error {
    missing;
    constructor(missing) {
        super(`Invalid placement: ${missing.join("; ")}`);
        this.name = "PlacementConfigurationError";
        this.missing = missing;
    }
}
const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value) => typeof value === "string" && value.trim().length > 0;
function placementProblems(placement, names) {
    const problems = [];
    const p = record(placement) ? placement : {};
    const cells = new Set();
    if (!Array.isArray(p.cells))
        problems.push("cells: missing or invalid cell table");
    else
        p.cells.forEach((cell, index) => {
            if (!id(cell))
                problems.push(`cells[${index}]: invalid cell id`);
            else
                cells.add(cell);
        });
    for (const [field, required] of [
        ["bodies", names.actors], ["inventories", names.inventories],
    ]) {
        const table = p[field];
        if (!record(table))
            problems.push(`${field}: missing or invalid placement table`);
        const rows = record(table) ? table : {};
        for (const name of new Set([...required, ...Object.keys(rows)])) {
            const cell = Object.hasOwn(rows, name) ? rows[name] : undefined;
            if (!id(cell))
                problems.push(`${field}.${name}: missing or invalid cell`);
            else if (!cells.has(cell))
                problems.push(`${field}.${name}: unknown cell ${cell}`);
        }
    }
    if (!Array.isArray(p.edges))
        problems.push("edges: missing or invalid edge table");
    else
        p.edges.forEach((edge, index) => {
            const label = `edges[${index}]`;
            if (!record(edge)) {
                problems.push(`${label}: invalid edge`);
                return;
            }
            for (const field of ["from", "to"]) {
                if (!id(edge[field]) || !cells.has(edge[field])) {
                    problems.push(`${label}.${field}: missing or unknown cell ${String(edge[field])}`);
                }
            }
            if (edge.kind !== "reach")
                problems.push(`${label}.kind: expected reach`);
            if (edge.symmetric !== undefined && typeof edge.symmetric !== "boolean") {
                problems.push(`${label}.symmetric: expected boolean`);
            }
        });
    return problems;
}
/**
 * Validate all declared placement and required names at load time, without mutation.
 * See lanes/RN-1-placement-reach.md; failures are host configuration errors.
 */
export function checkPlacement(placement, names) {
    const missing = placementProblems(placement, names);
    if (missing.length)
        throw new PlacementConfigurationError(missing);
}
/**
 * Read committed fixture adjacency once per intention, before the transaction.
 * No movement, time step or trace writes. See lanes/RN-1-placement-reach.md.
 */
export function reach(placement, actor, inventoryId) {
    const missing = placementProblems(placement, { actors: [actor], inventories: [inventoryId] });
    const provenance = {
        actor,
        target: inventoryId,
        basis: "fixture-adjacency",
        source: "fixture",
        limitation: "declared adjacency; no anatomical or obstacle claim",
    };
    if (missing.length)
        return { ...provenance, result: "unknown", missing };
    const from = placement.bodies[actor];
    const to = placement.inventories[inventoryId];
    const reachable = from === to || placement.edges.some(edge => edge.kind === "reach" && ((edge.from === from && edge.to === to) ||
        (edge.symmetric === true && edge.from === to && edge.to === from)));
    return { ...provenance, result: reachable ? "reachable" : "unreachable" };
}
