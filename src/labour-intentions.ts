import type { EventBus, EventReader, KernelEvent } from "@rex/kernel";
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

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function intention(event: KernelEvent): LabourIntention {
  const p = event.payload;
  const label = record(p) && id(p.id) ? p.id : event.id;
  const fail = (field: string): never => { throw new Error(`labour: intention ${label}: invalid ${field}`); };
  if (!record(p)) return fail("payload");
  for (const field of ["id", "mind", "action"] as const) if (!id(p[field])) fail(field);
  if (p.target !== undefined && !id(p.target)) fail("target");
  if (typeof p.t !== "number" || !Number.isSafeInteger(p.t) || p.t < 0) fail("t");
  if (!["active", "completed", "failed", "impossible"].includes(p.status as string)) fail("status");
  if (p.terms !== undefined && (!record(p.terms) || Object.values(p.terms).some(v => typeof v !== "number"))) fail("terms");
  return p as unknown as LabourIntention;
}

function term(i: LabourIntention, name: "hours" | "wage_min"): number {
  const value = i.terms?.[name];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`labour: intention ${i.id}: terms.${name} must be finite and >= 0`);
  }
  return value;
}

/** Reads the one kernel stream on every query, retaining neither events nor a cursor/cache.
 * Latest means emission sequence, not payload time or status. Day does not expire an offer;
 * visibility is the reader's position. Host callbacks must be pure at that position.
 * Settlement staffing already subtracts namedUsed before each post grant: do not subtract twice.
 */
export function intentionLabour(bus: EventBus, o: IntentionLabourOptions): PersonLabour {
  if (!id(o.workAction) || !id(o.refuseAction) || o.workAction === o.refuseAction) {
    throw new Error("labour: workAction and refuseAction must be distinct nonempty names");
  }
  const latest = (person: string, role: string): LabourIntention | null => {
    if (!o.holds(person)) throw new Error(`labour: ${person} is not held as an individual`);
    let found: LabourIntention | null = null;
    for (const event of bus.since(0, o.reader?.())) {
      if (event.type !== "cognition.intention") continue;
      const p = event.payload;
      if (!record(p) || p.mind !== person || (p.action !== o.workAction && p.action !== o.refuseAction)) continue;
      const i = intention(event);
      if (o.roleOf(i) === role) found = i;
    }
    if (found?.action !== o.workAction) return null;
    term(found, "hours");
    if (found.terms?.wage_min !== undefined) term(found, "wage_min");
    return found;
  };
  return {
    holds: person => o.holds(person),
    hours(person, role, _day) { return latest(person, role)?.terms?.hours ?? 0; },
    reservationWage(person, role, _day) { return latest(person, role)?.terms?.wage_min ?? null; },
  };
}

/** Composition never adds individual offers to cohort capacity. Promotion/demotion and
 * count conservation belong to a host transaction using the kernel ResolutionService.
 */
export function composeLabour(
  cohort: Pick<LabourSupply, "supply" | "hours" | "draw">,
  persons: PersonLabour,
  host: Pick<LabourSupply, "available" | "productivity">,
): LabourSupply {
  return {
    supply: day => cohort.supply(day),
    draw: (pool, role, requires, wantedHours, day) => cohort.draw(pool, role, requires, wantedHours, day),
    hours: (source, role, day) => persons.holds(source) ? persons.hours(source, role, day) : cohort.hours(source, role, day),
    available: (person, day) => host.available(person, day),
    productivity: (holder, role) => host.productivity(holder, role),
    reservationWage: (person, role, day) => persons.reservationWage(person, role, day),
  };
}
