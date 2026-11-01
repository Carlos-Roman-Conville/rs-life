/**
 * The crisis record: the one shape every path that can end a body opens first (a fatal wound, a disease or inoculation
 * death draw, an air condition, water exhaustion, an organ under its floor). The engine never kills: the record carries
 * the row that justifies it in `source`, the host decides, and `declareDeath` refuses a body with no crisis in the trace.
 */
import type { World } from "./world.ts";
import { Trace, type TraceRecord } from "./trace.ts";

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

export interface CrisisDetail { source: string; risk?: number | null; day?: number; organ?: string; function?: number | null; remainingCapacity?: number }

declare module "./trace.ts" {
  interface Trace {
    /** @deprecated use allCrises / carryRecords (2777) */
    readonly crises: Crisis[];
  }
}

/** @deprecated use allCrises / carryRecords (2777) */
Object.defineProperty(Trace.prototype, "crises", { get() { return this.records }, configurable: true });

/** The crisis view of the world's audit records, retaining the original record objects. */
export const allCrises = (w: World): Crisis[] => w.trace.records.filter((c): c is Crisis => c.kind === "crisis");

/** Add a crisis record without a note; recordCrisis supplies the once-only diagnostic note. */
export function addCrisis(w: World, c: Crisis): void {
  w.trace.records.push(c);
}

/** Carry every audit record by reference when a host renews its world's trace. */
export function carryRecords(next: World, previous: World): void {
  next.trace.records.push(...previous.trace.records);
}

/** Put a crisis record in the world's trace (once) with a note. */
export function recordCrisis(w: World, c: Crisis): Crisis {
  if (!allCrises(w).includes(c)) {
    addCrisis(w, c);
    w.trace.note(c.startedAt, `crisis: ${c.body}/${c.cause}; ${c.source}; outcome belongs to host`, { keep: true }); // (2715)
  }
  return c;
}

/** A condition that holds over time: opens a record when it becomes active, keeps its duration and values current while
 * it lasts, and stamps `resolvedAt` when it ends. One open record per body and cause. */
export function trackCrisis(w: World, body: string, cause: string, active: boolean, d: CrisisDetail): Crisis | undefined {
  const open = allCrises(w).find(c => c.body === body && c.cause === cause && c.resolvedAt === undefined && c.resolved === undefined);
  if (open) {
    open.durationSeconds = w.t - open.startedAt;
    if (d.function !== undefined) open.function = d.function;
    if (d.remainingCapacity !== undefined) open.remainingCapacity = d.remainingCapacity;
    if (!active) open.resolvedAt = w.t;
    return open;
  }
  if (!active) return undefined;
  const c: Crisis = { kind: "crisis", body, cause, source: d.source, startedAt: w.t, durationSeconds: 0, risk: d.risk ?? null };
  for (const k of ["day", "organ", "function", "remainingCapacity"] as const) if (d[k] !== undefined) Object.assign(c, { [k]: d[k] });
  return recordCrisis(w, c);
}

/** The crises in the trace that belong to a body. */
export const crisesOf = (w: World, body: string) => allCrises(w).filter(c => c.body === body);

/** Deaths remain in the trace's crises, including after trace compaction. */
export const deathsOf = (w: World): DeathRecord[] => allCrises(w).flatMap(c => c.death ? [c.death] : []);
export const causeOfDeath = (w: World, body: string): DeathRecord | undefined =>
  allCrises(w).find(c => c.death?.body === body)?.death;

/** Supply population.epidemic?.disease for the outbreak being compared (retain its id
 * for a retrospective comparison). Without that context a disease is not an epidemic.
 * Organ causes already are the anatomy library's bare row ids. */
export function deathCategory(cause: string, epidemicDisease?: string): string {
  const disease = /^disease:(.+)$/.exec(cause)?.[1] ?? /^treatment:[^:]+:(.+)$/.exec(cause)?.[1];
  if (disease) return `${disease === epidemicDisease ? "epidemic" : "disease"}:${disease}`;
  if (cause.startsWith("exposure:")) return `medicine.exposure.${cause.slice("exposure:".length)}`;
  return cause;
}

/** The only way the engine marks a body dead (`props.dead`, for a host that has decided): it needs a crisis record for the
 * body already in the trace, so nobody dies silently. */
export function declareDeath(w: World, body: string, cause: string) {
  const b = w.registry.component(body);
  if (b.props.dead || causeOfDeath(w, body)) throw new Error(`crisis: ${body} is already dead`);
  const c = crisesOf(w, body).find(x => x.cause === cause && x.resolved === undefined && x.resolvedAt === undefined);
  if (!c) throw new Error(`crisis: ${body} cannot die of ${cause} with no open crisis record for that cause in the trace`);
  const death: DeathRecord = Object.freeze({ body, t: w.t, cause, crisisStartedAt: c.startedAt, source: c.source });
  c.resolved = "died";
  c.resolvedAt = w.t;
  c.durationSeconds = w.t - c.startedAt;
  c.death = death;
  b.props.dead = 1;
  w.trace.note(w.t, `death: ${body}; ${cause}; after crisis ${c.cause} (${c.source})`, { keep: true }); // (2715)
  return death;
}
