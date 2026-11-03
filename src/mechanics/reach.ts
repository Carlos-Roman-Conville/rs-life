/** Fixture placement contract from lanes/RN-1-placement-reach.md. */
export interface Placement {
  /**
   * A cell is a declared reach zone (a space with no wall or closed container
   * between its contents), not a map cell. A closed container is its own zone,
   * reached only through a declared edge. Same-zone reach holds for the declared
   * fixture; it is not a universal reach rule.
   */
  cells: string[];
  bodies: Record<string, string>;
  /** Keyed by Economy's inventory id, not a place id. */
  inventories: Record<string, string>;
  edges: { from: string; to: string; kind: "reach"; symmetric?: boolean }[];
}

/** Fixture result contract from lanes/RN-1-placement-reach.md. */
export interface ReachResult {
  actor: string;
  target: string;
  result: "reachable" | "unreachable" | "unknown";
  basis: "fixture-adjacency";
  source: "fixture";
  limitation: "declared adjacency; no anatomical or obstacle claim";
  missing?: string[];
}

/** Invalid fixture configuration, with every detected input problem named. */
export class PlacementConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Invalid placement: ${missing.join("; ")}`);
    this.name = "PlacementConfigurationError";
    this.missing = missing;
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function placementProblems(
  placement: Placement,
  names: { actors: string[]; inventories: string[] },
): string[] {
  const problems: string[] = [];
  const p: Record<string, unknown> = record(placement) ? placement : {};
  const cells = new Set<string>();
  if (!Array.isArray(p.cells)) problems.push("cells: missing or invalid cell table");
  else p.cells.forEach((cell, index) => {
    if (!id(cell)) problems.push(`cells[${index}]: invalid cell id`);
    else cells.add(cell);
  });

  for (const [field, required] of [
    ["bodies", names.actors], ["inventories", names.inventories],
  ] as const) {
    const table = p[field];
    if (!record(table)) problems.push(`${field}: missing or invalid placement table`);
    const rows = record(table) ? table : {};
    for (const name of new Set([...required, ...Object.keys(rows)])) {
      const cell = Object.hasOwn(rows, name) ? rows[name] : undefined;
      if (!id(cell)) problems.push(`${field}.${name}: missing or invalid cell`);
      else if (!cells.has(cell)) problems.push(`${field}.${name}: unknown cell ${cell}`);
    }
  }

  if (!Array.isArray(p.edges)) problems.push("edges: missing or invalid edge table");
  else p.edges.forEach((edge, index) => {
    const label = `edges[${index}]`;
    if (!record(edge)) {
      problems.push(`${label}: invalid edge`);
      return;
    }
    for (const field of ["from", "to"] as const) {
      if (!id(edge[field]) || !cells.has(edge[field])) {
        problems.push(`${label}.${field}: missing or unknown cell ${String(edge[field])}`);
      }
    }
    if (edge.kind !== "reach") problems.push(`${label}.kind: expected reach`);
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
export function checkPlacement(
  placement: Placement,
  names: { actors: string[]; inventories: string[] },
): void {
  const missing = placementProblems(placement, names);
  if (missing.length) throw new PlacementConfigurationError(missing);
}

/**
 * Read committed fixture adjacency once per intention, before the transaction.
 * No movement, time step or trace writes. See lanes/RN-1-placement-reach.md.
 */
export function reach(placement: Placement, actor: string, inventoryId: string): ReachResult {
  const missing = placementProblems(placement, { actors: [actor], inventories: [inventoryId] });
  const provenance = {
    actor,
    target: inventoryId,
    basis: "fixture-adjacency",
    source: "fixture",
    limitation: "declared adjacency; no anatomical or obstacle claim",
  } as const;
  if (missing.length) return { ...provenance, result: "unknown", missing };

  const from = placement.bodies[actor];
  const to = placement.inventories[inventoryId];
  const reachable = from === to || placement.edges.some(edge =>
    edge.kind === "reach" && (
      (edge.from === from && edge.to === to) ||
      (edge.symmetric === true && edge.from === to && edge.to === from)
    ));
  return { ...provenance, result: reachable ? "reachable" : "unreachable" };
}
