import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { KCAL_J, metabolicHeat } from "../src/physics.ts";
import { libraryRow } from "../src/library.ts";
import { restingMetabolicRate, bodyOutputs, circadianRow, coreRow, hydrationRow, ingest, metOf, overnight, palRange, physiologyProcess, sleepDebtRow, splitSleepQuality, wbgtCeiling, wbgtClass, type PhysiologyOptions } from "../src/physiology.ts";

interface Setup { roomC?: number; wbgt?: number; body?: Record<string, number>; waterKg?: number; opts?: PhysiologyOptions }

function build(s: Setup = {}) {
  const reg = defaultRegistry(), w = new World(reg);
  const room: Component = { id: "room", kind: "room", material: "air_mass", mass: 50, temperatureC: s.roomC ?? 26, contents: [],
    ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: s.wbgt === undefined ? {} : { wbgt_c: s.wbgt } };
  const body: Component = { id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37, contents: s.waterKg ? [{ substance: "water", phase: "liquid", mass: s.waterKg }] : [],
    ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: 1.9, h: 10, ...s.body } };
  reg.addComponent(room); reg.addComponent(body);
  const sch = new Scheduler();
  sch.add(physiologyProcess("body", "room", { every: 1, ...s.opts }));
  return { w, sch, room, body, out: bodyOutputs(body) };
}

const MAN = { height_cm: 175, age_y: 30, male: 1 };
const DAY = 86400;
/** Run whole days plus one step, so the step that opens the next day (the day's close) has run. */
const days = (x: ReturnType<typeof build>, n: number, dt: number) => x.sch.run(x.w, n * DAY + dt, dt);

describe("library lookups", () => {
  it("reads the tables by band and class", () => {
    expect(metOf("sleeping")).toBe(0.95);
    expect(metOf("physiology.met.smithing")).toBe(6);
    expect(metOf(4)).toBe(4);
    expect(wbgtClass(2.9).row.id).toBe("physiology.wbgt_limits.light-under-3");
    expect(wbgtClass(3).row.id).toBe("physiology.wbgt_limits.moderate-3-to-6");
    expect(wbgtClass(6).row.id).toBe("physiology.wbgt_limits.moderate-3-to-6");
    expect(wbgtClass(6.5).row.id).toBe("physiology.wbgt_limits.heavy-over-6");
    expect(wbgtCeiling(6, 1)).toBe(28);
    expect(wbgtCeiling(6, 0)).toBe(26);
    expect(wbgtCeiling(6, 0.5)).toBe(27);
    expect(sleepDebtRow(0).multiplier).toBe(1);
    expect(sleepDebtRow(4).multiplier).toBe(0.92);
    expect(sleepDebtRow(56).multiplier).toBe(0.55);
    expect(circadianRow(12).factor).toBe(1);
    expect(circadianRow(23).factor).toBe(0.88);
    expect(circadianRow(3).factor).toBe(0.78);
    expect(circadianRow(15).factor).toBe(0.93);
    expect(coreRow(37).state).toBe("normal");
    expect(coreRow(38.2).workCapacity).toBe(0.85);
    expect(coreRow(39).workCapacity).toBe(0.6);
    expect(coreRow(39).sweatAtMax).toBe(true);
    expect(coreRow(40).state).toBe("heat stroke");
    expect(coreRow(31).state).toBe("severe hypothermia");
    expect(hydrationRow(3, false).endurance).toBe(0.85);
    expect(hydrationRow(3, true).endurance).toBe(0.75);
    expect(hydrationRow(0.5, false).endurance).toBe(1);
    expect(hydrationRow(8, false).endurance).toBeNull();
    expect(splitSleepQuality()).toBe(0.85);
  });
});

describe("energy", () => {
  it("a 70 kg man at rest burns the resting rate the rule gives", () => {
    const x = build({ body: MAN, opts: { met: 1 } });
    const rmr = restingMetabolicRate(x.body)!;
    expect(rmr).toBe(1648.75);
    x.sch.run(x.w, DAY, 60);
    expect(x.out.rmr_kcal).toBe(rmr);
    expect(x.out.rmr_label).toBe("researched");
    expect(x.body.props.expenditure_kcal).toBeCloseTo(rmr, 6);
  });

  it("costs an activity at its MET times the resting rate", () => {
    const x = build({ body: MAN, opts: { met: metOf("sleeping") } });
    x.sch.run(x.w, DAY, 60);
    expect(x.body.props.expenditure_kcal).toBeCloseTo(0.95 * 1648.75, 6);
  });

  it("falls back to the compendium's 1 kcal per kg per hour with no height, age or sex", () => {
    const x = build({ opts: { met: 3.3 } });
    x.sch.run(x.w, 3600, 10);
    expect(x.out.rmr_kcal).toBeNull();
    expect(x.out.pal).toBeNull();
    expect(x.body.props.expenditure_kcal).toBeCloseTo(metabolicHeat(3.3, 70) * 3600 / KCAL_J, 9);
  });

  it("makes the day's PAL the MET-hours over 24, inside the library's band", () => {
    const x = build({ body: MAN, opts: { clockH0: 0, dayStartH: 0, schedule: [
      { fromH: 22, toH: 6, activity: "sleeping", sleepQuality: 1 },
      { fromH: 6, toH: 14, activity: "walking-the-deck-light-chores" },
      { fromH: 14, toH: 22, activity: "cooking-at-the-galley-fire" }] } });
    days(x, 1, 60);
    const expected = (8 * 0.95 + 8 * 2.5 + 8 * 3.3) / 24;
    expect(x.out.pal).toBeCloseTo(expected, 9);
    expect(x.out.pal as number).toBeGreaterThan(palRange().min);
    expect(x.out.pal as number).toBeLessThan(palRange().max);
  });

  it("conserves energy: intake minus heat and work equals what is stored", () => {
    const x = build({ body: { ...MAN, work_w: 50 }, roomC: 30, opts: { met: metOf("smithing") } });
    ingest(x.w, "body", { kcal: 2000 });
    x.sch.run(x.w, 6 * 3600, 30);
    const t = x.w.trace;
    const heat = t.transfers.filter(f => f.from === "metabolism" && f.to === "body").reduce((a, f) => a + f.amount, 0);
    const work = t.transfers.filter(f => f.from === "metabolism" && f.to === "work").reduce((a, f) => a + f.amount, 0);
    const intake = t.into("body", "energy:chemical"), spent = t.outOf("body", "energy:chemical");
    expect(intake).toBe(2000 * KCAL_J);
    expect(spent).toBeCloseTo(heat + work, 3);
    expect(work).toBeCloseTo(50 * 6 * 3600, 3);
    expect((x.out.energy_balance_kcal as number) * KCAL_J).toBeCloseTo(intake - heat - work, 3);
    expect(x.out.energy_balance_kcal).toBeCloseTo(2000 - restingMetabolicRate(x.body)! * 6 * 6 / 24, 6);
  });

  it("conserves heat in the body: stored equals heat in minus the air and the sweat taken", () => {
    const x = build({ body: MAN, roomC: 33, wbgt: 30, opts: { met: 4.5 } });
    const cap = x.w.registry.heatCapacity(x.body), t0 = x.body.temperatureC;
    x.sch.run(x.w, 3 * 3600, 10);
    const sum = (to: string, from: string) => x.w.trace.transfers.filter(f => f.quantity === "energy" && f.to === to && f.from === from).reduce((a, f) => a + f.amount, 0);
    const net = sum("body", "metabolism") - sum("room", "body") - sum("sweat-latent", "body") - sum("breath-latent", "body");
    expect(cap * (x.body.temperatureC - t0)).toBeCloseTo(net, 3);
  });
});

describe("sleep", () => {
  const night4 = { clockH0: 12, dayStartH: 12, schedule: [
    { fromH: 0, toH: 4, activity: "sleeping", sleepQuality: 1 },
    { fromH: 4, toH: 24, activity: "standing-watch-still" }] } satisfies PhysiologyOptions;

  it("14 nights at 4 h reach the table's alertness", () => {
    const x = build({ body: MAN, opts: night4 });
    days(x, 1, 60);
    expect(x.out.sleep_debt).toBeCloseTo(4, 9);
    expect(x.out.sleep_debt_row).toBe("physiology.sleep_debt.4-to-12");
    days(x, 13, 60);
    const top = libraryRow("physiology", "sleep_debt", "physiology.sleep_debt.over-40");
    expect(x.out.sleep_debt).toBeGreaterThan(40);
    expect(x.out.sleep_debt_row).toBe(top.id);
    expect(x.out.circadian).toBe(1);
    expect(x.out.alertness).toBe(top["Alertness multiplier"] as number);
  });

  it("weighs split (watch) sleep by the recovery table and repays debt hour for hour", () => {
    const x = build({ body: MAN, opts: { ...night4, schedule: [{ fromH: 0, toH: 4, activity: "sleeping", sleepQuality: splitSleepQuality() }, { fromH: 4, toH: 24, activity: 1.5 }] } });
    days(x, 1, 60);
    expect(x.out.sleep_debt).toBeCloseTo(8 - 4 * 0.85, 9);
    expect(overnight(56, 100, 10)).toEqual({ debtH: 54, fatigueMetH: 0 });
    expect(overnight(1, 100, 4).fatigueMetH).toBeCloseTo(50, 9);
    expect(overnight(1, 100, 4).debtH).toBe(5);
    expect(overnight(1, 0, 12).debtH).toBe(0);
  });

  it("scales alertness by the time of day", () => {
    const x = build({ body: MAN, opts: { ...night4 } });
    x.sch.run(x.w, 3 * 3600 - 60, 60); // 12:00 to 14:59
    expect(x.out.circadian).toBe(0.93);
    expect(x.out.alertness).toBe(0.93);
  });
});

describe("heat", () => {
  it("a worker at MET 6 in a 32 C WBGT room drifts up at the table's rate", () => {
    const row = libraryRow("physiology", "wbgt_limits", "physiology.wbgt_limits.moderate-3-to-6");
    const rate = row["Model: core drift above ceiling (C per hour per C over)"] as number;
    const acc = build({ roomC: 26, wbgt: 32, body: { acclimatisation: 1 }, opts: { met: 6 } });
    acc.sch.run(acc.w, 3600, 10);
    expect((acc.out.core_c as number) - 37).toBeCloseTo((32 - (row["WBGT ceiling, acclimatised (C)"] as number)) * rate, 9);
    const un = build({ roomC: 26, wbgt: 32, body: { acclimatisation: 0 }, opts: { met: 6 } });
    un.sch.run(un.w, 3600, 10);
    expect((un.out.core_c as number) - 37).toBeCloseTo((32 - (row["Unacclimatised (C)"] as number)) * rate, 9);
  });

  it("holds the core below the ceiling and reports the band above it", () => {
    const cool = build({ wbgt: 27, opts: { met: 6 } });
    cool.sch.run(cool.w, 3600, 10);
    expect(cool.out.core_c).toBe(37);
    expect(cool.out.core_state).toBe("normal");
    const hot = build({ wbgt: 32, body: { acclimatisation: 0 }, opts: { met: 6 } });
    hot.sch.run(hot.w, 4000, 10);
    expect(hot.out.core_state).toBe("heat exhaustion");
    expect(hot.out.work_capacity_heat).toBe(0.6);
    expect(hot.out.sweat_l_per_h).toBe(2.5);
  });

  it("returns the core to rest at the overnight tick when sheltered, not otherwise", () => {
    const a = build({ wbgt: 20, body: { core_c: 38.4 }, opts: { met: 1, clockH0: 11, dayStartH: 12 } });
    a.sch.run(a.w, 2 * 3600, 600);
    expect(a.out.core_c).toBe(37);
    const b = build({ wbgt: 20, body: { core_c: 38.4, sheltered: 0 }, opts: { met: 1, clockH0: 11, dayStartH: 12 } });
    b.sch.run(b.w, 2 * 3600, 600);
    expect(b.out.core_c).toBe(38.4);
  });

  it("gains acclimatisation over the table's days of work in heat and loses it over the days away", () => {
    const clocks = libraryRow("physiology", "acclimatisation", "physiology.acclimatisation.heat-acclimatisation");
    expect(clocks["Time to gain"]).toBe("10 to 14 days of work in heat");
    expect(clocks["Time to lose"]).toBe("about 25 days away from it");
    const x = build({ roomC: 26, wbgt: 32, body: { acclimatisation: 0 }, opts: { met: 3.3, clockH0: 12, dayStartH: 12 } });
    days(x, 7, 600);
    expect(x.out.acclimatisation).toBeCloseTo(7 / 14, 9);
    x.sch.run(x.w, 7 * DAY, 600);
    expect(x.out.acclimatisation).toBeCloseTo(1, 9);
    x.room.props.wbgt_c = 20; // the day already open was hot at its first step, so it still counts as a heat day
    x.sch.run(x.w, 6 * DAY, 600);
    expect(x.out.acclimatisation).toBeCloseTo(1 - 5 / 25, 9);
    x.sch.run(x.w, 30 * DAY, 600);
    expect(x.out.acclimatisation).toBe(0);
  });
});

describe("water", () => {
  it("conserves water each step across the body and the room, with drinking", () => {
    const x = build({ roomC: 34, wbgt: 31, waterKg: 40, opts: { met: 6 } });
    x.w.conserve("water", ["body", "room"], 1e-9);
    x.sch.run(x.w, 2 * 3600, 10);
    ingest(x.w, "body", { waterKg: 0.5 });
    x.sch.run(x.w, 2 * 3600, 10);
    expect(x.w.trace.checks.length).toBeGreaterThan(1000);
    expect(x.w.trace.failed()).toEqual([]);
    // sweat, skin diffusion, breath and urine all leave the body; what evaporates reaches the room, drips and urine leave both
    const water = (pred: (f: (typeof x.w.trace.transfers)[number]) => boolean) => x.w.trace.transfers.filter(f => f.quantity === "mass:water" && pred(f)).reduce((a, f) => a + f.amount, 0);
    const sweat = water(f => f.note === "sweat"), lost = water(f => f.from === "body"), toRoom = water(f => f.from === "body" && f.to === "room");
    const made = water(f => f.note === "metabolic water");
    expect(sweat).toBeGreaterThan(1);
    expect(water(f => f.note === "urine")).toBeGreaterThan(0);
    expect(water(f => f.note === "breath")).toBeGreaterThan(0);
    expect(made).toBeGreaterThan(0);
    expect(x.w.registry.contentMass(x.body, "water")).toBeCloseTo(40 - lost + made + 0.5, 9);
    expect(x.w.registry.contentMass(x.room, "water")).toBeCloseTo(toRoom, 9);
    expect(x.out.water_deficit_pct).toBeCloseTo((lost - made - 0.5) / 70 * 100, 9);
  });

  it("reports the deficit's row and its effect", () => {
    const x = build({ roomC: 34, wbgt: 31, opts: { met: 6 } });
    x.sch.run(x.w, 4 * 3600, 10);
    const pct = x.out.water_deficit_pct as number;
    expect(pct).toBeGreaterThan(1);
    expect(x.out.hydration_row).toBe(hydrationRow(pct, true).row.id);
    expect(x.out.endurance_hydration).toBe(hydrationRow(pct, true).endurance);
  });

  it("cannot sweat more water than the body holds", () => {
    const x = build({ roomC: 34, wbgt: 31, waterKg: 0.01, opts: { met: 6 } });
    x.w.conserve("water", ["body", "room"], 1e-9);
    x.sch.run(x.w, 3600, 10);
    expect(x.w.registry.contentMass(x.body, "water")).toBeCloseTo(0, 12);
    expect(x.w.trace.failed()).toEqual([]);
  });
});


describe("RMR ownership and overrides", () => {
  it.each([undefined, "researched", "unknown"])("rejects override label %s", label => {
    const x = build({ body: MAN, opts: { met: 1, rmrOverride: { kcalDay: 1800, label: label as "estimate" } } });
    expect(() => x.sch.run(x.w, 1, 1)).toThrow("rmr_override_label");
  });

  it.each(["estimate", "fiction"])("publishes a labelled %s override", label => {
    const x = build({ body: {}, opts: { met: 1, rmrOverride: { kcalDay: 1800, label: label as "estimate" } } });
    x.sch.run(x.w, 3600, 60);
    expect(x.out.rmr_kcal).toBe(1800);
    expect(x.out.rmr_label).toBe(label);
    expect(x.body.props.expenditure_kcal).toBeCloseTo(1800 / 24, 9);
  });

  it("rejects unknown formula text and preserves missing-measurement nulls", () => {
    const x = build();
    expect(() => restingMetabolicRate(x.body, "unknown")).toThrow("unsupported RMR formula");
    expect(() => restingMetabolicRate(x.body, "70 x kg^0.75 garbage")).toThrow("unsupported RMR formula");
    expect(restingMetabolicRate(x.body)).toBeNull();
  });

  it("keeps the Mifflin coefficients and power-law parser only in physiology throughout src", () => {
    interface Fs { readdirSync(p: string): string[]; statSync(p: string): { isDirectory(): boolean }; readFileSync(p: string, enc: string): string }
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): Fs } }).process.getBuiltinModule("node:fs");
    const root = decodeURIComponent(new URL("../src", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
    const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(f => {
      const path = `${dir}/${f}`;
      return fs.statSync(path).isDirectory() ? walk(path) : [path];
    });
    const files = walk(root).map(path => ({ path, text: fs.readFileSync(path, "utf8") }));
    for (const marker of ["6.25", "-161", "kg\\^"])
      expect(files.filter(f => f.text.includes(marker)).map(f => f.path)).toEqual([`${root}/physiology.ts`]);
  });
});
