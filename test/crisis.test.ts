import { describe, expect, it } from "vitest";
import { addCrisis, allCrises, carryRecords, causeOfDeath, crisesOf, deathsOf, recordCrisis, trackCrisis, type Crisis } from "../src/crisis.ts";
import { defaultRegistry } from "../src/registry.ts";
import { World } from "../src/world.ts";

describe("crisis views over generic records (2777)", () => {
  it("ignores other record kinds even when they have crisis fields", () => {
    const w = new World(defaultRegistry());
    const other = { kind: "inspection", body: "body", cause: "fixture", death: { body: "body" } };
    w.trace.records.push(other);
    expect(allCrises(w)).toEqual([]);
    expect(crisesOf(w, "body")).toEqual([]);
    expect(deathsOf(w)).toEqual([]);
    expect(causeOfDeath(w, "body")).toBeUndefined();
    const c = trackCrisis(w, "body", "fixture", true, { source: "test" })!;
    recordCrisis(w, c);
    expect(allCrises(w)).toEqual([c]);
    expect(allCrises(w)[0]).toBe(c);
    expect(w.trace.records).toEqual([other, c]);
    expect(w.trace.notes).toHaveLength(1);
    w.t = 10;
    expect(trackCrisis(w, "body", "fixture", false, { source: "test" })).toBe(c);
    expect(c).toMatchObject({ durationSeconds: 10, resolvedAt: 10 });
    expect(other).not.toHaveProperty("resolvedAt");
  });

  it("carries every record into a renewed world in order with shared record identity", () => {
    const previous = new World(defaultRegistry()), next = new World(previous.registry);
    const c: Crisis = { kind: "crisis", body: "body", cause: "fixture", source: "test", startedAt: 0, durationSeconds: 0, risk: null };
    const other = { kind: "inspection", details: { accepted: true } };
    addCrisis(previous, c);
    previous.trace.records.push(other);
    const existing = { kind: "renewed" };
    next.trace.records.push(existing);
    carryRecords(next, previous);
    expect(next.trace.records).toEqual([existing, c, other]);
    expect(next.trace.records).not.toBe(previous.trace.records);
    expect(next.trace.records[1]).toBe(c);
    expect(next.trace.records[2]).toBe(other);
    expect(allCrises(next)[0]).toBe(c);
    expect(previous.trace.records).toEqual([c, other]);
  });
});
