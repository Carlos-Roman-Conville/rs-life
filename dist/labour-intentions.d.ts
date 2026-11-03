import type { EventBus, EventReader } from "@rex/kernel";
import type { LabourSupply } from "./population.ts";
/** The event fields this boundary reads; no Cognition state or beliefs are imported. */
export interface LabourIntention {
    readonly id: string;
    readonly mind: string;
    readonly action: string;
    readonly target?: string;
    readonly terms?: Readonly<Record<string, number>>;
    readonly t: number;
    readonly status: "active" | "completed" | "failed" | "impossible";
}
export interface IntentionLabourOptions {
    workAction: string;
    refuseAction: string;
    /** Pure host mapping; null matches no queried role, including for a refusal. */
    roleOf(intention: LabourIntention): string | null;
    /** Pure membership query. The host must exclude these records from cohort counts. */
    holds(person: string): boolean;
    /** Processes supply their current scheduler position. Omit only for host/audit reads. */
    reader?(): EventReader;
}
export type PersonLabour = Pick<LabourSupply, "hours"> & Required<Pick<LabourSupply, "reservationWage">> & {
    holds(person: string): boolean;
};
/** Reads the one kernel stream on every query, retaining neither events nor a cursor/cache.
 * Latest means emission sequence, not payload time or status. Day does not expire an offer;
 * visibility is the reader's position. Host callbacks must be pure at that position.
 * Settlement staffing already subtracts namedUsed before each post grant: do not subtract twice.
 */
export declare function intentionLabour(bus: EventBus, o: IntentionLabourOptions): PersonLabour;
/** Composition never adds individual offers to cohort capacity. Promotion/demotion and
 * count conservation belong to a host transaction using the kernel ResolutionService.
 */
export declare function composeLabour(cohort: Pick<LabourSupply, "supply" | "hours" | "draw">, persons: PersonLabour, host: Pick<LabourSupply, "available" | "productivity">): LabourSupply;
