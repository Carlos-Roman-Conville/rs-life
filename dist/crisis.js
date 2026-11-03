/** The crisis view of the world's audit records, retaining the original record objects. */
export const allCrises = (w) => w.trace.records.filter((c) => c.kind === "crisis");
/** Add a crisis record without a note; recordCrisis supplies the once-only diagnostic note. */
export function addCrisis(w, c) {
    w.trace.records.push(c);
}
/** Carry every audit record by reference when a host renews its world's trace. */
export function carryRecords(next, previous) {
    next.trace.records.push(...previous.trace.records);
}
/** Put a crisis record in the world's trace (once) with a note. */
export function recordCrisis(w, c) {
    if (!allCrises(w).includes(c)) {
        addCrisis(w, c);
        w.trace.note(c.startedAt, `crisis: ${c.body}/${c.cause}; ${c.source}; outcome belongs to host`, { keep: true }); // (2715)
    }
    return c;
}
/** A condition that holds over time: opens a record when it becomes active, keeps its duration and values current while
 * it lasts, and stamps `resolvedAt` when it ends. One open record per body and cause. */
export function trackCrisis(w, body, cause, active, d) {
    const open = allCrises(w).find(c => c.body === body && c.cause === cause && c.resolvedAt === undefined && c.resolved === undefined);
    if (open) {
        open.durationSeconds = w.t - open.startedAt;
        if (d.function !== undefined)
            open.function = d.function;
        if (d.remainingCapacity !== undefined)
            open.remainingCapacity = d.remainingCapacity;
        if (!active)
            open.resolvedAt = w.t;
        return open;
    }
    if (!active)
        return undefined;
    const c = { kind: "crisis", body, cause, source: d.source, startedAt: w.t, durationSeconds: 0, risk: d.risk ?? null };
    for (const k of ["day", "organ", "function", "remainingCapacity"])
        if (d[k] !== undefined)
            Object.assign(c, { [k]: d[k] });
    return recordCrisis(w, c);
}
/** The crises in the trace that belong to a body. */
export const crisesOf = (w, body) => allCrises(w).filter(c => c.body === body);
/** Deaths remain in the trace's crises, including after trace compaction. */
export const deathsOf = (w) => allCrises(w).flatMap(c => c.death ? [c.death] : []);
export const causeOfDeath = (w, body) => allCrises(w).find(c => c.death?.body === body)?.death;
/** Supply population.epidemic?.disease for the outbreak being compared (retain its id
 * for a retrospective comparison). Without that context a disease is not an epidemic.
 * Organ causes already are the anatomy library's bare row ids. */
export function deathCategory(cause, epidemicDisease) {
    const disease = /^disease:(.+)$/.exec(cause)?.[1] ?? /^treatment:[^:]+:(.+)$/.exec(cause)?.[1];
    if (disease)
        return `${disease === epidemicDisease ? "epidemic" : "disease"}:${disease}`;
    if (cause.startsWith("exposure:"))
        return `medicine.exposure.${cause.slice("exposure:".length)}`;
    return cause;
}
/** The only way the engine marks a body dead (`props.dead`, for a host that has decided): it needs a crisis record for the
 * body already in the trace, so nobody dies silently. */
export function declareDeath(w, body, cause) {
    const b = w.registry.component(body);
    if (b.props.dead || causeOfDeath(w, body))
        throw new Error(`crisis: ${body} is already dead`);
    const c = crisesOf(w, body).find(x => x.cause === cause && x.resolved === undefined && x.resolvedAt === undefined);
    if (!c)
        throw new Error(`crisis: ${body} cannot die of ${cause} with no open crisis record for that cause in the trace`);
    const death = Object.freeze({ body, t: w.t, cause, crisisStartedAt: c.startedAt, source: c.source });
    c.resolved = "died";
    c.resolvedAt = w.t;
    c.durationSeconds = w.t - c.startedAt;
    c.death = death;
    b.props.dead = 1;
    w.trace.note(w.t, `death: ${body}; ${cause}; after crisis ${c.cause} (${c.source})`, { keep: true }); // (2715)
    return death;
}
