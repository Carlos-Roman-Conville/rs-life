/**
 * The crisis record: the one shape every path that can end a body opens first (a fatal wound, a disease or inoculation
 * death draw, an air condition, water exhaustion, an organ under its floor). The engine never kills: the record carries
 * the row that justifies it in `source`, the host decides, and `declareDeath` refuses a body with no crisis in the trace.
 */
import type { World } from "./world.ts";
import type { TraceRecord } from "./trace.ts";
export interface DeathRecord {
    readonly body: string;
    readonly t: number;
    readonly cause: string;
    readonly crisisStartedAt: number;
    readonly source: string;
}
export interface Crisis extends TraceRecord {
    kind: "crisis";
    body: string;
    /** What opened it: a library row id, `disease:<id>`, `treatment:<id>:<disease>`, `exposure:<id>` or an organ id. */
    cause: string;
    /** The row (or doc section) that justifies it. */
    source: string;
    startedAt: number;
    durationSeconds: number;
    /** The row's death risk where it gives a number, else null (nothing is rolled for a null). */
    risk: number | null;
    /** Course day of a disease crisis. */
    day?: number;
    /** The organ, or the row id for a crisis that belongs to no single organ, when the anatomy names one. */
    organ?: string;
    function?: number | null;
    remainingCapacity?: number;
    resolvedAt?: number;
    resolved?: "survived" | "died";
    /** The death ledger lives on the resolving trace record, independent of host fate. */
    death?: DeathRecord;
}
export interface CrisisDetail {
    source: string;
    risk?: number | null;
    day?: number;
    organ?: string;
    function?: number | null;
    remainingCapacity?: number;
}
/** The crisis view of the world's audit records, retaining the original record objects. */
export declare const allCrises: (w: World) => Crisis[];
/** Add a crisis record without a note; recordCrisis supplies the once-only diagnostic note. */
export declare function addCrisis(w: World, c: Crisis): void;
/** Carry every audit record by reference when a host renews its world's trace. */
export declare function carryRecords(next: World, previous: World): void;
/** Put a crisis record in the world's trace (once) with a note. */
export declare function recordCrisis(w: World, c: Crisis): Crisis;
/** A condition that holds over time: opens a record when it becomes active, keeps its duration and values current while
 * it lasts, and stamps `resolvedAt` when it ends. One open record per body and cause. */
export declare function trackCrisis(w: World, body: string, cause: string, active: boolean, d: CrisisDetail): Crisis | undefined;
/** The crises in the trace that belong to a body. */
export declare const crisesOf: (w: World, body: string) => Crisis[];
/** Deaths remain in the trace's crises, including after trace compaction. */
export declare const deathsOf: (w: World) => DeathRecord[];
export declare const causeOfDeath: (w: World, body: string) => DeathRecord | undefined;
/** Supply population.epidemic?.disease for the outbreak being compared (retain its id
 * for a retrospective comparison). Without that context a disease is not an epidemic.
 * Organ causes already are the anatomy library's bare row ids. */
export declare function deathCategory(cause: string, epidemicDisease?: string): string;
/** The only way the engine marks a body dead (`props.dead`, for a host that has decided): it needs a crisis record for the
 * body already in the trace, so nobody dies silently. */
export declare function declareDeath(w: World, body: string, cause: string): DeathRecord;
