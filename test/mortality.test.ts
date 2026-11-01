import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { defaultRegistry } from "../src/registry.ts";
import { allCrises, causeOfDeath, crisesOf, deathCategory, deathsOf, declareDeath, trackCrisis } from "../src/crisis.ts";
import { advanceDays, airConditions, createMedicine, diseaseCourse, expose, flushMedicineCrises,
  medicineProcess, resolveCrisis, treat } from "../src/medicine.ts";
import { createPopulation, startEpidemic, tick } from "../src/population.ts";
import { bodyMassDelta, nutritionProcess } from "../src/nutrition.ts";
import { bodyOutputs, hydrationCrisisRows } from "../src/physiology.ts";
import { bleedingClass, loseBlood } from "../src/circulation.ts";
import { anatomyProcess, assembleBody, assemblyCirculation } from "../src/anatomy.ts";
import { libraryRow, libraryTable } from "../src/library.ts";
import { runWoundVariant, WOUND_FIXTURE } from "../examples/human-wound.ts";
import validation from "../data/library/validation.json";

const DAY = 86400;
function body(w = new World(defaultRegistry()), id = "body") {
  const b = w.registry.addComponent({ id, kind: "body", material: "flesh", mass: 70, temperatureC: 37,
    contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
  return { w, b };
}

function assertLedger(w: World) {
  const deaths = deathsOf(w);
  expect(new Set(deaths.map(d => d.body)).size).toBe(deaths.length);
  for (const d of deaths) {
    const resolved = crisesOf(w, d.body).filter(c => c.death !== undefined);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ cause: d.cause, source: d.source, startedAt: d.crisisStartedAt,
      resolved: "died", resolvedAt: d.t, death: d });
    expect(causeOfDeath(w, d.body)).toBe(d);
    expect(w.registry.component(d.body).props.dead).toBe(1);
  }
}

describe("one cause per individual death (2633)", () => {
  it("resolves the named open crisis, rejects absent/closed causes and a second death atomically", () => {
    const { w, b } = body();
    const first = trackCrisis(w, b.id, "brain", true, { source: "first" })!;
    const second = trackCrisis(w, b.id, "heart", true, { source: "second" })!;
    expect(causeOfDeath(w, b.id)).toBeUndefined();
    expect(() => declareDeath(w, b.id, "unopened")).toThrow(/no open crisis/);
    first.resolved = "survived";
    expect(() => declareDeath(w, b.id, "brain")).toThrow(/no open crisis/);
    trackCrisis(w, b.id, "lungs", true, { source: "closed" });
    trackCrisis(w, b.id, "lungs", false, { source: "closed" });
    expect(() => declareDeath(w, b.id, "lungs")).toThrow(/no open crisis/);
    expect(deathsOf(w)).toEqual([]);
    expect(b.props.dead).toBeUndefined();
    w.t = 12;
    const death = declareDeath(w, b.id, "heart");
    expect(death).toEqual({ body: b.id, t: 12, cause: "heart", crisisStartedAt: 0, source: "second" });
    expect(second.durationSeconds).toBe(12);
    expect(first.resolved).toBe("survived");
    expect(() => declareDeath(w, b.id, "heart")).toThrow(/already dead/);
    expect(() => declareDeath(w, b.id, "brain")).toThrow(/already dead/);
    // The trace, not the redundant body flag, keeps repeat declarations impossible.
    delete b.props.dead;
    expect(() => declareDeath(w, b.id, "heart")).toThrow(/already dead/);
    b.props.dead = 1;
    w.trace.compact(20);
    expect(deathsOf(w)).toEqual([death]);
    assertLedger(w);
  });

  it("also refuses an already-dead body whose flag was supplied by the host", () => {
    const { w, b } = body();
    trackCrisis(w, b.id, "heart", true, { source: "fixture" });
    b.props.dead = 1;
    expect(() => declareDeath(w, b.id, "heart")).toThrow(/already dead/);
    expect(deathsOf(w)).toEqual([]);
  });

  it("does not manufacture an untreated wound death from missing bleed kinetics", () => {
    const { week } = runWoundVariant("never-bound");
    expect(WOUND_FIXTURE.rateMlMin).toBeNull();
    expect(WOUND_FIXTURE.clotting).toBeNull();
    expect(week.body.props.dead).toBeUndefined();
    expect(deathsOf(week.w)).toEqual([]);
    assertLedger(week.w);
    expect(week.w.trace.failed()).toEqual([]);
  }, 60_000);

  it("records a nonvacuous wound death using measured blood loss as a host circumstance", () => {
    const { w, b } = body(), a = assembleBody(w, b.id);
    const iv = libraryRow("circulation", "bleeding", "circulation.bleeding.iv");
    // A loss in the class-IV band is an input, not a fabricated wound flow or death rate.
    loseBlood(w, b.id, b.props.circulation_initial_ml / 2);
    assemblyCirculation(a).step(w, 0);
    const c = crisesOf(w, b.id).find(c => c.cause === iv.id)!;
    expect(c).toBeDefined();
    declareDeath(w, b.id, c.cause);
    expect(deathsOf(w)).toHaveLength(1);
    assertLedger(w);
    expect(w.trace.failed()).toEqual([]);
  });

  it("compares 1,000 seeded individuals with the aggregate over one year within three standard errors", () => {
    const w = new World(defaultRegistry()), size = 1000, disease = "yellow_fever", catchRate = 0.2, riskAt = 0.6;
    const p = createPopulation({ elders: size, foodDays: 365 });
    const epidemic = startEpidemic(p, disease, catchRate);
    const states = Array.from({ length: size }, (_, i) => {
      const { b } = body(w, `person-${i + 1}`);
      const s = createMedicine(b.id, { seed: i + 1, riskAt });
      flushMedicineCrises(w, s);
      return { s, caught: false };
    });
    const exposureDays = diseaseCourse(disease).course!.hi;
    for (let day = 0; day < 365; day++) {
      tick(p, { birthRate: 0, deathRate: 0, childMaleShare: 0.5 }, { riskAt, trace: w.trace });
      w.t = (day + 1) * DAY;
      for (const state of states) {
        const { s } = state;
        if (causeOfDeath(w, s.body)) continue;
        if (!state.caught && day < exposureDays) state.caught = expose(s, disease, catchRate).infected;
        advanceDays(s, 1);
        flushMedicineCrises(w, s);
        const crisis = s.crises.find(c => c.resolved === undefined);
        if (crisis) {
          declareDeath(w, s.body, crisis.cause);
          resolveCrisis(s, crisis, "died");
        }
      }
    }
    const deaths = deathsOf(w), observed = deaths.length / size;
    const expected = p.ledger.deaths[`epidemic:${disease}`] / size;
    const standardError = Math.sqrt(observed * (1 - observed) / (size - 1));
    expect(Math.abs(observed - expected)).toBeLessThanOrEqual(3 * standardError);
    expect(deaths.length).toBeGreaterThan(0);
    for (const d of deaths) {
      expect(d.cause).toBe(`disease:${disease}`);
      expect(deathCategory(d.cause, epidemic.disease)).toBe(`epidemic:${disease}`);
      expect(d.crisisStartedAt).toBeGreaterThan(0);
      expect(d.t).toBe(d.crisisStartedAt);
    }
    expect(p.ledger.deaths.background).toBe(0); // background is aggregate-only, excluded from this comparison
    expect(p.epidemic).toBeNull();
    assertLedger(w);
    expect(w.trace.failed()).toEqual([]);
  });
});

describe("medicine and starvation reach the trace (2633)", () => {
  it("flushes a multi-day batch at the actual day boundaries, once, with a nonzero world origin", () => {
    const { w } = body(), s = createMedicine("body");
    w.t = 50 * DAY;
    flushMedicineCrises(w, s);
    s.rand = () => 0; // deterministic fatal case; no probability parameter changed
    expose(s, "yellow_fever", 1, { incubationDays: 0 });
    advanceDays(s, 3);
    w.t += 3 * DAY;
    flushMedicineCrises(w, s);
    const c = s.crises[0];
    expect(c.startedAt).toBe(51 * DAY);
    expect(c.day).toBe(1);
    expect(allCrises(w)).toEqual([c]);
    expect(allCrises(w)[0]).toBe(c);
    w.t += DAY;
    flushMedicineCrises(w, s);
    expect(c.startedAt).toBe(51 * DAY);
    expect(allCrises(w)).toHaveLength(1);
    resolveCrisis(s, c, "survived");
    expect(allCrises(w)[0].resolved).toBe("survived");
    airConditions(s, { sao2: 0.5 });
    flushMedicineCrises(w, s);
    expect(allCrises(w)).toHaveLength(2);
  });

  it("can first flush after independent advanceDays when world and medicine clocks correspond", () => {
    const { w } = body(), s = createMedicine("body");
    s.rand = () => 0;
    expose(s, "yellow_fever", 1, { incubationDays: 0 });
    advanceDays(s, 5);
    w.t = 25 * DAY;
    flushMedicineCrises(w, s);
    expect(s.crises[0].startedAt).toBe(21 * DAY);
  });

  it("medicineProcess handles partial steps and multiple days without doubling its clock", () => {
    const { w } = body(), s = createMedicine("body"), process = medicineProcess(s);
    w.t = 20 * DAY;
    s.rand = () => 0;
    expose(s, "yellow_fever", 1, { incubationDays: 0 });
    process.step(w, DAY / 2);
    w.t += DAY / 2;
    expect(s.day).toBe(0);
    process.step(w, 3 * DAY);
    w.t += 3 * DAY;
    expect(s.day).toBe(3);
    expect(s.elapsedSeconds).toBe(3.5 * DAY);
    expect(s.crises[0].startedAt).toBe(21 * DAY);
    expect(allCrises(w)).toHaveLength(1);
    process.step(w, DAY / 2);
    expect(s.day).toBe(4);
    expect(s.elapsedSeconds).toBe(4 * DAY);
  });

  it("flushes treatment and both fatal air causes through the same bridge", () => {
    const { w } = body(), s = createMedicine("body");
    s.rand = () => 0;
    treat(s, "inoculation-variolation", { disease: "smallpox" });
    airConditions(s, { sao2: 0.5, driveFailing: true });
    flushMedicineCrises(w, s);
    flushMedicineCrises(w, s);
    expect(allCrises(w).map(c => c.cause)).toEqual([
      "treatment:inoculation-variolation:smallpox",
      "exposure:hypoxia-and-asphyxia-suffocation-the-foul-air", "exposure:respiratory-failure-the-end-state",
    ]);
    expect(allCrises(w).every(c => c.source.startsWith("medicine."))).toBe(true);
  });

  it.each(["fat floor", "mass share"])("opens, persists and resolves starvation from %s", trigger => {
    const { w, b } = body(), process = nutritionProcess(b.id, { clockH0: 12 });
    process.step(w, 0);
    const floor = Number(/floor ([\d.]+) kg/.exec(String(libraryRow("nutrition", "body_composition", "nutrition.body_composition.fat-mass").Rule))![1]);
    b.props.fat_kg = floor;
    b.props.glycogen_g = 0;
    if (trigger === "fat floor") b.props.expenditure_kcal = 100; // host energy expenditure
    else bodyMassDelta(w, b.id, -b.mass / 2, "fixture", "host mass loss");
    const cause = "nutrition.body_composition.starvation-stages";
    process.step(w, DAY);
    w.t += DAY;
    const c = crisesOf(w, b.id)[0];
    expect(c).toMatchObject({ cause, risk: null });
    expect(c.source).toContain(cause);
    expect(bodyOutputs(b).starvation_limit).toBe(1);
    if (trigger === "fat floor") b.props.expenditure_kcal += 100;
    process.step(w, DAY);
    w.t += DAY;
    expect(crisesOf(w, b.id)).toHaveLength(1);
    if (trigger === "mass share") bodyMassDelta(w, b.id, 35, "fixture", "host restoration");
    process.step(w, DAY);
    expect(c.resolvedAt).toBe(w.t);
    expect(bodyOutputs(b).starvation_limit).toBe(0);
    expect(b.props.dead).toBeUndefined();
    expect(w.trace.failed()).toEqual([]);
  });
});

describe("cause categories and evidence (2633)", () => {
  it("enumerates the crisis producers from source call sites and maps all their row-derived causes", () => {
    // Keep this inventory coupled to the actual producer files, including medicine's emit -> recordCrisis bridge.
    interface Fs { readdirSync(p: URL): string[]; readFileSync(p: URL, enc: string): string }
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): Fs } }).process.getBuiltinModule("node:fs");
    const dir = new URL("../src/", import.meta.url);
    const producers = fs.readdirSync(dir).filter(f => f.endsWith(".ts") && f !== "crisis.ts")
      .filter(f => /\b(?:trackCrisis|recordCrisis)\(/.test(fs.readFileSync(new URL(f, dir), "utf8"))).sort();
    expect(producers).toEqual(["anatomy.ts", "circulation.ts", "medicine.ts", "nutrition.ts", "physiology.ts"]);
    const medicine = fs.readFileSync(new URL("medicine.ts", dir), "utf8");
    const emissions = [...medicine.matchAll(/emit\(s, `([^`]+)`/g)].map(m => m[1]);
    expect(emissions).toEqual(["treatment:${id}:${disease}", "disease:${x.id}", "exposure:${id}"]);
    for (const r of libraryTable("medicine", "diseases")) {
      const disease = String(r.id);
      for (const cause of [`disease:${disease}`, `treatment:inoculation-variolation:${disease}`]) {
        expect(deathCategory(cause)).toBe(`disease:${disease}`);
        expect(deathCategory(cause, disease)).toBe(`epidemic:${disease}`);
        expect(deathCategory(cause, "unrelated-outbreak")).toBe(`disease:${disease}`);
      }
    }
    const rows = [
      ...libraryTable("circulation", "bleeding").filter(r => /\bdying\b/.test(String(r["Organ consequences (ANATOMY)"]))).map(r => String(r.id)),
      ...hydrationCrisisRows().map(r => String(r.row.id)),
      ...libraryTable("anatomy", "crisis_floors").map(r => String(r.Organ)),
      "nutrition.body_composition.starvation-stages",
    ];
    for (const row of rows) expect(deathCategory(row)).toBe(row);
    const { w } = body(), s = createMedicine("body");
    airConditions(s, { sao2: 0, driveFailing: true });
    flushMedicineCrises(w, s);
    for (const c of s.crises) expect(deathCategory(c.cause)).toBe(c.source);
  });

  it("reads every level-5 organ floor from the library and opens its named crisis", () => {
    const { w, b } = body(), a = assembleBody(w, b.id), process = anatomyProcess(a);
    // Tissue floors (2787) are exercised through nutrition in medicine.test.ts.
    const organFloors = libraryTable("anatomy", "crisis_floors").filter(row => a.organs[String(row.Organ)]);
    for (const row of organFloors) {
      expect(row.Level).toBe(5);
      a.organs[String(row.Organ)].damage = 1; // below any listed floor, no invented damage rate
    }
    process.step(w, 0);
    expect(crisesOf(w, b.id).map(c => c.cause).sort()).toEqual(organFloors.map(r => String(r.Organ)).sort());
    for (const c of crisesOf(w, b.id)) expect(c.source).toContain(`anatomy.crisis_floors.${c.cause}`);
  });

  it("validation (2633): class IV and hydration severity boundaries match independent reference rows, not mortality probabilities", () => {
    // https://www.tomwademd.net/?p=940 (ATLS secondary transcription, adult trauma)
    // https://www.aafp.org/afp/2005/0301/p1010 (Steiner summary, children, not adult mortality)
    const rows = validation.crisis_thresholds.rows;
    const low = (slug: string) => Number(rows.find(r => r[0] === `validation.crisis_thresholds.${slug}`)![3]);
    const threshold = low("atls-class-4");
    expect(bleedingClass(threshold, 100).id).toBe("circulation.bleeding.iii");
    expect(bleedingClass(threshold + 0.001, 100).id).toBe("circulation.bleeding.iv");
    expect(hydrationCrisisRows().map(b => b.lo)).toEqual([low("dehydration-moderate"), low("dehydration-severe")]);
    expect(rows.find(r => r[0] === "validation.crisis_thresholds.organ-function-floors")!.slice(2, 5)).toEqual([null, null, null]);
  });
});
