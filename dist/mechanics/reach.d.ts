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
    edges: {
        from: string;
        to: string;
        kind: "reach";
        symmetric?: boolean;
    }[];
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
export declare class PlacementConfigurationError extends Error {
    readonly missing: string[];
    constructor(missing: string[]);
}
/**
 * Validate all declared placement and required names at load time, without mutation.
 * See lanes/RN-1-placement-reach.md; failures are host configuration errors.
 */
export declare function checkPlacement(placement: Placement, names: {
    actors: string[];
    inventories: string[];
}): void;
/**
 * Read committed fixture adjacency once per intention, before the transaction.
 * No movement, time step or trace writes. See lanes/RN-1-placement-reach.md.
 */
export declare function reach(placement: Placement, actor: string, inventoryId: string): ReachResult;
