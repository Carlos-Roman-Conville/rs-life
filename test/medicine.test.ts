import { describe, expect, it } from "vitest";
import { defaultRegistry } from "../src/registry.ts";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { bodyOutputs } from "../src/physiology.ts";
import { initialiseCirculation } from "../src/circulation.ts";
import { libraryRow, libraryTable } from "../src/library.ts";
import validation from "../data/library/validation.json";
import { anatomyProcess, assembleBody } from "../src/anatomy.ts";
import { nutritionProcess, poolLevel, stockPools } from "../src/nutrition.ts";
import { advanceDays, airConditions, createMedicine, daysRange, diseaseCourse, expose, healingMultiplier, immunityRule, inflictWound,
  medicineOutputs, medicineProcess, painLevel, resolveCrisis, riskRange, treat, treatmentEfficacy, worldHealingFactors } from "../src/medicine.ts";

const N = 1000;
/** Four binomial standard errors around p at N runs: the sampling error of a seeded frequency. */
const within = (count: number, p: number) => Math.abs(count / N - p) <= 4 * Math.sqrt(p * (1 - p) / N);
const mid = (r: { lo: number; hi: number }) => (r.lo + r.hi) / 2;

describe("the disease rows as numbers", () => {
  it("reads ranges from the text and leaves the rest null", () => {
    expect(daysRange("1 to 7")).toEqual({ lo: 1, hi: 7 });
    expect(daysRange("2 to 4 weeks acute; chronic if untreated")).toEqual({ lo: 14, hi: 28 });
    expect(daysRange("fever every 2nd day for 2 to 4 weeks; relapses")).toEqual({ lo: 14, hi: 28 });
    expect(daysRange("0")).toEqual({ lo: 0, hi: 0 });
    expect(daysRange("months to years")).toBeNull();
    expect(daysRange("progressive until C is eaten")).toBeNull();
    expect(riskRange("5 to 15% bacillary without fluids; amoebic 1 to 5% (liver abscess)")).toEqual({ lo: 0.05, hi: 0.15 });
    expect(riskRange("20 to 50% of toxic-phase cases; 5 to 10% of all cases; far higher")).toEqual({ lo: 0.05, hi: 0.1 });
    expect(riskRange("low (under 2%) but repeated attacks")).toEqual({ lo: 0, hi: 0.02 });
    expect(riskRange("high over months")).toBeNull();
    expect(riskRange("near certain untreated")).toBeNull();
    const d = diseaseCourse("dysentery");
    expect([d.incubation, d.course, d.risk]).toEqual([{ lo: 1, hi: 7 }, { lo: 7, hi: 14 }, { lo: 0.05, hi: 0.15 }]);
    expect(diseaseCourse("consumption").riskWindowDays).toBe(5 * 365);
    expect(diseaseCourse("scurvy")).toMatchObject({ incubation: null, course: null, recoveryDays: null, risk: null, riskWindowDays: null });
  });
});

describe("an untreated course, 1,000 seeded runs", () => {
  it("runs the row's incubation and course days and opens the crisis at the row's risk", () => {
    const row = diseaseCourse("dysentery"), p = mid(row.risk!);
    let crises = 0;
    for (let seed = 1; seed <= N; seed++) {
      const s = createMedicine("body", { seed });
      const r = expose(s, "dysentery", 1);
      const x = r.sick!, inc = x.incubationDays, course = x.courseDays!;
      expect(inc).toBeGreaterThanOrEqual(row.incubation!.lo); expect(inc).toBeLessThanOrEqual(row.incubation!.hi);
      expect(course).toBeGreaterThanOrEqual(row.course!.lo); expect(course).toBeLessThanOrEqual(row.course!.hi);
      advanceDays(s, inc - 1); expect(x.stage).toBe("incubating");
      advanceDays(s, 1); expect(x.stage).toBe("ill");
      advanceDays(s, course - 1);
      if (!s.crises.length) expect(s.sick).toContain(x); // still ill on the day before the course ends
      advanceDays(s, 1);
      if (s.crises.length) {
        crises++;
        const c = s.crises[0];
        expect(c).toMatchObject({ kind: "crisis", cause: "disease:dysentery", body: "body", risk: p });
        expect(c.day).toBeGreaterThan(inc); expect(c.day).toBeLessThanOrEqual(inc + course);
        expect(s.sick).toContain(x); expect(x.crisis).toBe(true);
        continue;
      }
      expect(s.sick).toHaveLength(0);
      expect(s.lastingHarm.dysentery).toBe("weakness for weeks; amoebic liver abscess");
      expect(s.immunity.dysentery).toBeUndefined(); // the table: none after dysentery
    }
    expect(within(crises, p)).toBe(true);
  });
  it("is reproducible from the seed", () => {
    const run = (seed: number) => { const s = createMedicine("b", { seed }); expose(s, "typhus", 1); advanceDays(s, 40); return JSON.stringify([s.crises, s.sick, s.immunity]); };
    expect(run(7)).toBe(run(7));
  });
  it("places no death where the row gives no timing, and the engine kills no one", () => {
    let unplaced = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = createMedicine("body", { seed });
      const x = expose(s, "malaria_falciparum", 1).sick!;
      if (x.timingUnsupported) unplaced++;
      advanceDays(s, 400);
      expect(s.crises).toHaveLength(0);
    }
    expect(unplaced).toBeGreaterThan(0);
    const s = createMedicine("body", { seed: 1, riskAt: 1 });
    expect(expose(s, "consumption", 1).reason).toBe("unsupported incubation");
    expect(expose(s, "consumption", 1, { incubationDays: 90 }).infected).toBe(true);
  });
  it("a crisis is the host's to decide", () => {
    for (let seed = 1; seed < 500; seed++) {
      const s = createMedicine("body", { seed, riskAt: 1 });
      expose(s, "tetanus", 1);
      advanceDays(s, 60);
      const c = s.crises[0];
      if (!c) continue;
      expect(s.sick).toHaveLength(1);
      advanceDays(s, 100); expect(s.crises).toHaveLength(1);
      resolveCrisis(s, c, "survived"); advanceDays(s, 40);
      expect(s.sick).toHaveLength(0); expect(s.crises).toHaveLength(1);
      return;
    }
    throw new Error("no fatal tetanus case in 500 seeds");
  });
  it("heat stroke has no incubation and yellow fever uses the all-cases risk", () => {
    const s = createMedicine("body", { seed: 3 });
    expect(expose(s, "heat_stroke", 1).sick!.stage).toBe("ill");
    expect(diseaseCourse("yellow_fever").risk).toEqual({ lo: 0.05, hi: 0.1 });
  });
});

describe("exposure, hygiene, immunity and quarantine", () => {
  it("takes only a dose in [0, 1] times the host's hygiene multiplier", () => {
    const s = createMedicine("body", { seed: 1 });
    expect(expose(s, "dysentery", 0).reason).toBe("no dose");
    expect(() => expose(s, "dysentery", 2)).toThrow();
    let taken = 0;
    for (let seed = 1; seed <= N; seed++) if (expose(createMedicine("b", { seed }), "dysentery", 0.2, { hygiene: 2 }).infected) taken++;
    expect(within(taken, 0.4)).toBe(true);
  });
  it("reads each disease's immunity row", () => {
    expect(immunityRule("yellow_fever")).toMatchObject({ level: "lifelong", inoculation: false });
    expect(immunityRule("smallpox")).toMatchObject({ level: "lifelong", inoculation: true });
    expect(immunityRule("malaria_falciparum")).toMatchObject({ level: "partial", fadesAfterDays: 365 });
    expect(immunityRule("malaria_vivax").level).toBe("none");
    expect(immunityRule("dysentery").level).toBe("none");
    expect(immunityRule("typhoid").level).toBe("none");
    expect(immunityRule("scurvy").level).toBe("none");
  });
  it("survivors of yellow fever are immune for life; dysentery returns", () => {
    const s = createMedicine("body", { seed: 11 });
    s.immunity.yellow_fever = { disease: "yellow_fever", level: "lifelong", sinceDay: 0, fadesAfterDays: null, via: "survived" };
    advanceDays(s, 5000);
    expect(expose(s, "yellow_fever", 1).reason).toBe("immune");
    expect(expose(s, "dysentery", 1).infected).toBe(true);
  });
  it("a survived case is recorded, and partial malaria immunity fades after a year", () => {
    const s = createMedicine("body", { seed: 5, riskAt: 0 });
    expose(s, "smallpox", 1, { incubationDays: 0 });
    advanceDays(s, 40);
    // the draw may be fatal at riskAt 0 only if risk > 0; the low end of 20 to 30% is 20%
    if (s.crises.length) resolveCrisis(s, s.crises[0], "survived");
    advanceDays(s, 40);
    expect(s.immunity.smallpox).toMatchObject({ level: "lifelong", via: "survived" });
    expect(s.lastingHarm.smallpox).toBe("pitted scars; blindness in some");
    s.immunity.malaria_falciparum = { disease: "malaria_falciparum", level: "partial", sinceDay: s.day, fadesAfterDays: 365, via: "survived" };
    advanceDays(s, 365); expect(s.immunity.malaria_falciparum).toBeDefined();
    advanceDays(s, 1); expect(s.immunity.malaria_falciparum).toBeUndefined();
  });
  it("variolation: immune at the table's 2% risk of dying of it; refused where the row says none", () => {
    let dead = 0;
    for (let seed = 1; seed <= N; seed++) {
      const s = createMedicine("body", { seed });
      const r = treat(s, "inoculation-variolation", { disease: "smallpox" });
      expect(r.effect).toBe("immunise");
      if (s.crises.length) { dead++; expect(s.crises[0]).toMatchObject({ cause: "treatment:inoculation-variolation:smallpox", risk: 0.02 }); expect(s.immunity.smallpox).toBeUndefined(); }
      else { expect(s.immunity.smallpox).toMatchObject({ level: "lifelong", via: "inoculation" }); expect(expose(s, "smallpox", 1).reason).toBe("immune"); }
    }
    expect(within(dead, 0.02)).toBe(true);
    const s = createMedicine("body");
    expect(treat(s, "inoculation-variolation", { disease: "yellow_fever" }).efficacy).toBe("none");
    expect(s.immunity.yellow_fever).toBeUndefined();
  });
  it("quarantine stops lice and person-to-person disease and is useless against the mosquito", () => {
    const s = createMedicine("body", { seed: 2 });
    expect(expose(s, "typhus", 1, { quarantine: true }).reason).toBe("quarantined");
    expect(expose(s, "influenza", 1, { quarantine: true }).reason).toBe("quarantined");
    expect(expose(s, "yellow_fever", 1, { quarantine: true }).infected).toBe(true);
    expect(expose(s, "dysentery", 1, { quarantine: true }).infected).toBe(true);
  });
});

describe("treatments change outcomes only where the 'Really worked?' column says so", () => {
  const outcome = (seed: number, disease: string, apply?: (s: ReturnType<typeof createMedicine>) => void) => {
    const s = createMedicine("body", { seed, riskAt: 1 });
    expose(s, disease, 1, { incubationDays: 0 });
    apply?.(s);
    advanceDays(s, 60);
    return JSON.stringify([s.crises.map(c => c.cause + c.day), s.sick.map(x => [x.id, x.dayOfStage]), s.lastingHarm]);
  };
  it("reads the column: the rows that say no license nothing", () => {
    const t = treatmentEfficacy();
    for (const id of ["bleeding-venesection-cupping-leeches", "mercury-unction-pills-salivation", "rum-and-drinking-the-fever-away", "trepanning"]) expect(t[id].effect).toBeNull();
    expect(t["peruvian-bark-cinchona"]).toMatchObject({ text: "yes: quinine", effect: "cure" });
    expect(t["tourniquet-and-ligature"].effect).toBe("stop-bleeding");
    expect(t["washing-wounds-dry-lint-bandage-stitching"].effect).toBe("unquantified");
    expect(Object.keys(t)).toHaveLength(libraryTable("medicine", "treatments").length);
  });
  it("bark cancels the untreated risk of the malarias it is named for and nothing else", () => {
    let untreated = 0, treated = 0, other = 0, same = 0;
    for (let seed = 1; seed <= N; seed++) {
      const base = createMedicine("body", { seed, riskAt: 1 });
      expose(base, "malaria_vivax", 1, { incubationDays: 0 }); advanceDays(base, 40);
      untreated += base.crises.length;
      const s = createMedicine("body", { seed, riskAt: 1 });
      expose(s, "malaria_vivax", 1, { incubationDays: 0 });
      expect(treat(s, "peruvian-bark-cinchona", { disease: "malaria_vivax" }).efficacy).toBe("worked");
      advanceDays(s, 40); treated += s.crises.length;
      // the same bark on dysentery changes nothing: the dysentery row does not name it
      const a = outcome(seed, "dysentery"), b = outcome(seed, "dysentery", z => { expect(treat(z, "peruvian-bark-cinchona", { disease: "dysentery" }).efficacy).toBe("none"); });
      if (a === b) same++;
      other += a === b ? 0 : 1;
    }
    expect(untreated).toBeGreaterThan(0); expect(treated).toBe(0);
    expect(other).toBe(0); expect(same).toBe(N);
  });
  it("bleeding, purging a fever, mercury and rum leave every outcome as it was", () => {
    for (let seed = 1; seed <= 300; seed++) for (const disease of ["dysentery", "typhus", "typhoid", "malaria_vivax"]) {
      const base = outcome(seed, disease);
      for (const t of ["bleeding-venesection-cupping-leeches", "purging-and-emetics-jalap-senna-antimony-ipecacuanha", "mercury-unction-pills-salivation", "rum-and-drinking-the-fever-away", "opium-laudanum", "trepanning"])
        expect(outcome(seed, disease, s => expect(treat(s, t, { disease }).efficacy).not.toBe("worked"))).toBe(base);
    }
  });
  it("purging passes worms only; citrus needs nutrition intake rather than a medicine cure clock", () => {
    const s = createMedicine("body");
    expect(treat(s, "lemon-or-lime-juice-fresh-greens", { disease: "scurvy" }).efficacy).toBe("none");
    expose(s, "worms", 1, { incubationDays: 0 }); expose(s, "dysentery", 1, { incubationDays: 0 });
    const p = "purging-and-emetics-jalap-senna-antimony-ipecacuanha";
    expect(treat(s, p, { disease: "worms" }).efficacy).toBe("worked");
    expect(treat(s, p, { disease: "dysentery" }).efficacy).toBe("none");
    expect(treat(s, "lemon-or-lime-juice-fresh-greens", { disease: "dysentery" }).efficacy).toBe("none");
  });
  it("amputation is the cure for gangrene", () => {
    const s = createMedicine("body", { seed: 4 });
    expose(s, "gangrene", 1, { incubationDays: 0 });
    expect(painLevel(s).band).toBe("medicine.pain.9-to-10");
    expect(treat(s, "amputation", { disease: "gangrene" }).effect).toBe("cure-now");
    expect(s.sick).toHaveLength(0); expect(s.lastingHarm.gangrene).toBe("a limb lost");
    expect(painLevel(s).level).toBe(0);
  });
});

describe("wounds", () => {
  it("a clean cut heals in the row's days", () => {
    const row = libraryRow("medicine", "wounds", "medicine.wounds.cut-incised");
    expect(row["Heals in (days, clean)"]).toBe("7 to 14");
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = createMedicine("body", { seed });
      const w = inflictWound(s, "cut-incised", { infected: false });
      expect(w.healDays).toBeGreaterThanOrEqual(7); expect(w.healDays).toBeLessThanOrEqual(14);
      seen.add(w.healDays);
      advanceDays(s, w.healDays - 1); expect(w.healed).toBe(false);
      advanceDays(s, 1); expect(w.healed).toBe(true);
      expect(medicineOutputs(s)["medicine.wounds.cut-incised"]).toBe(0);
    }
    expect(seen.size).toBe(8);
  });
  it("one infection roll at the row's chance; an infected wound's clock is paused", () => {
    let cut = 0, thrustOpen = 0, head = 0;
    for (let seed = 1; seed <= N; seed++) {
      if (inflictWound(createMedicine("b", { seed }), "cut-incised").infected) cut++;
      if (inflictWound(createMedicine("b", { seed }), "thrust-penetrating").infected) thrustOpen++;
      if (inflictWound(createMedicine("b", { seed }), "head-blow-concussion", { open: true }).infected) head++;
    }
    expect(within(cut, 0.15)).toBe(true);
    expect(within(thrustOpen, 0.375)).toBe(true);
    expect(within(head, 0.2)).toBe(true);
    const s = createMedicine("body"); const w = inflictWound(s, "cut-incised", { infected: true });
    advanceDays(s, 100); expect(w.healed).toBe(false); expect(w.progressDays).toBe(0);
    expect(medicineOutputs(s)["medicine.wounds.cut-incised.infected"]).toBe(1);
    const closed = inflictWound(createMedicine("b", { seed: 1 }), "blunt-bruise-fracture", { open: true });
    expect(closed.painCause).toBe("bruise");
  });
  it("reads the class, variant and burn rules from the row", () => {
    const s = createMedicine("body", { seed: 9 });
    expect(inflictWound(s, "cut-incised", { severity: 0 }).bleedingClass).toBe("I");
    expect(inflictWound(s, "cut-incised", { severity: 1 }).bleedingClass).toBe("II");
    expect(inflictWound(s, "thrust-penetrating", { severity: 1 }).bleedingClass).toBe("IV");
    expect(inflictWound(s, "crush-a-gun-a-cask-a-falling-yard").internal).toBe(true);
    const burn = inflictWound(s, "burn-and-scald", { burnedPct: 45 });
    expect([burn.bleedingClass, burn.burnFluidClassIIUnits]).toEqual([null, 3]);
    expect(inflictWound(s, "blunt-bruise-fracture", { variant: "simple fracture", infected: false }).healDays).toBe(42);
    expect(inflictWound(s, "blunt-bruise-fracture", { infected: false }).healDays).toBe(7);
    expect(inflictWound(s, "head-blow-concussion", { variant: "skull", infected: false }).healDays).toBe(60);
    const amp = inflictWound(s, "amputation-the-surgeons-wound", { severity: 0 });
    expect(amp.bleedingClass).toBe("III");
    expect(() => inflictWound(s, "cut-incised", { rateMlMin: 10 })).toThrow();
    expect(() => inflictWound(s, "nonesuch")).toThrow();
  });
  it("the healing table multiplies the clock", () => {
    expect(healingMultiplier({})).toBe(1);
    expect(healingMultiplier({ collagenIntegrity: 0.98 })).toBe(3);
    expect(healingMultiplier({ collagenIntegrity: 1 })).toBe(1);
    expect(healingMultiplier({ proteinGKgDay: 0.7, energyBalanceKcalDay: -600 })).toBeCloseTo(1.5 * 1.3, 12);
    expect(healingMultiplier({ ageYears: 51 })).toBe(1.3);
    expect(healingMultiplier({ ageYears: 66 })).toBe(1.6);
    expect(healingMultiplier({ rest: true, dressedDaily: true })).toBeCloseTo(0.7 * 0.8, 12);
    expect(healingMultiplier({ sleepDebtH: 30, workingPart: true })).toBeCloseTo(1.2 * 1.5, 12);
    const s = createMedicine("body", { seed: 1 }), w = inflictWound(s, "cut-incised", { infected: false });
    advanceDays(s, 3, { collagenIntegrity: 0.98 });
    expect(w.progressDays).toBeCloseTo(1, 12);
  });
  it("working the part reopens at the row's chance a day", () => {
    let reopened = 0;
    for (let seed = 1; seed <= N; seed++) {
      const s = createMedicine("body", { seed }), w = inflictWound(s, "cut-incised", { infected: false });
      w.workingPart = true; advanceDays(s, 1); reopened += w.reopened;
    }
    expect(within(reopened, 0.1)).toBe(true);
  });
});

describe("vitamin C follows collagen", () => {
  const DAY = 86400, collagenId = "anatomy.tissues.connective-tissue-collagen";
  function fixture() {
    const w = new World(defaultRegistry());
    const b = w.registry.addComponent({ id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37,
      contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
    stockPools(w, b.id);
    const a = assembleBody(w, b.id), anatomy = anatomyProcess(a), s = createMedicine(b.id);
    return { w, b, a, anatomy, s, medicine: medicineProcess(s), nutrition: nutritionProcess(b.id, { dayStartH: 0 }) };
  }

  it("one pathway (2723): fixed collagen fixes healing, depletion acts through collagen, and scurvy has no course clock", () => {
    const x = fixture(), collagen = x.a.tissues[collagenId];
    const wound = inflictWound(x.s, "cut-incised", { infected: false });
    const normal = worldHealingFactors(x.w, x.b.id);
    stockPools(x.w, x.b.id, { vit_c: 299 / poolLevel(x.w, x.b.id, "vit_c") });
    x.anatomy.step(x.w, 0); // No daily collagen loss yet.
    expect(collagen.integrity).toBe(1);
    expect(healingMultiplier(worldHealingFactors(x.w, x.b.id))).toBe(healingMultiplier(normal));
    x.medicine.step(x.w, DAY);
    expect(wound.progressDays).toBe(1);
    expect(medicineOutputs(x.s)["medicine.diseases.scurvy"]).toBe(0);

    x.anatomy.step(x.w, DAY);
    expect(collagen.integrity).toBe(0.98);
    x.medicine.step(x.w, 0); // Diagnosis follows anatomy immediately, without a disease tick.
    expect(medicineOutputs(x.s)["medicine.diseases.scurvy"]).toBe(2);
    expect(medicineOutputs(x.s)["medicine.sick_count"]).toBe(1);
    x.medicine.step(x.w, DAY);
    expect(wound.progressDays).toBeCloseTo(1 + 1 / 3, 12);
    stockPools(x.w, x.b.id); // Restoring the pool cannot bypass collagen.
    expect(healingMultiplier(worldHealingFactors(x.w, x.b.id))).toBe(3);
    expect(treat(x.s, "lemon-or-lime-juice-fresh-greens", { disease: "scurvy" }).efficacy).toBe("none");
    expect(expose(x.s, "scurvy", 1, { incubationDays: 0 })).toEqual({ infected: false, reason: "state-defined diagnosis" });
    x.medicine.step(x.w, 100 * DAY);
    expect(x.s.sick).toEqual([]);
    expect(x.s.crises).toEqual([]);
    expect(x.s.immunity.scurvy).toBeUndefined();
    expect(x.s.lastingHarm.scurvy).toBeUndefined();
    expect(medicineOutputs(x.s)["medicine.diseases.scurvy"]).toBe(2);
    collagen.integrity = 1; // Host-supplied recovery; no unsupported repair kinetics.
    x.anatomy.step(x.w, 0); x.medicine.step(x.w, 0);
    expect(medicineOutputs(x.s)["medicine.diseases.scurvy"]).toBe(0);
    expect(medicineOutputs(x.s)["medicine.sick_count"]).toBe(0);
    expect(healingMultiplier(worldHealingFactors(x.w, x.b.id))).toBe(1);

    // Even a legacy host-created case cannot advance, cause harm or trigger a crisis.
    const legacy = createMedicine("body");
    const oldCase = expose(legacy, "influenza", 1).sick!;
    oldCase.id = "scurvy";
    const before = { ...oldCase };
    advanceDays(legacy, 100);
    expect(oldCase).toEqual(before);
    expect(medicineOutputs(legacy)["medicine.diseases.scurvy"]).toBe(0);
    expect(legacy.crises).toEqual([]);
  });

  it("validation (2723): the pool at first signs is below the supplied upper bound", () => {
    // https://en.wikipedia.org/wiki/Scurvy -- supplied validation rows report Iowa
    // signs at about four weeks and a pool below 300 mg. No time tolerance is supplied.
    // Onset disagrees with the reference; recorded in flags/nutrition.md (REAL-30).
    // This checks pool-bound agreement only, not the depletion time or healing rate.
    const table = validation.vitamin_c_depletion;
    const pool = table.rows.find(row => row[0] === "validation.vitamin_c_depletion.body-pool-at-signs")!;
    const upperBound = pool[table.columns.indexOf("High")];
    const x = fixture();
    let firstDay: number | null = null, firstPool: number | null = null;
    for (let day = 1; day <= 365; day++) {
      x.nutrition.step(x.w, DAY); x.anatomy.step(x.w, DAY); x.medicine.step(x.w, DAY);
      x.w.t += DAY;
      if (medicineOutputs(x.s)["medicine.diseases.scurvy"] === 2) {
        firstDay = day; firstPool = poolLevel(x.w, x.b.id, "vit_c"); break;
      }
    }
    expect(firstDay).not.toBeNull(); expect(firstPool).not.toBeNull();
    expect(typeof upperBound).toBe("number");
    expect(firstPool).toBeLessThan(Number(upperBound));
  });
});

describe("bleeding goes through circulation", () => {
  function fixture() {
    const w = new World(defaultRegistry());
    w.registry.addComponent({ id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37, contents: [], ports: [],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
    initialiseCirculation(w, "body");
    return w;
  }
  it("a bound class II bleed stops the rate; the volume ledger closes", () => {
    const w = fixture(), s = createMedicine("body", { seed: 2 });
    const wound = inflictWound(s, "cut-incised", { severity: 1, infected: false, rateMlMin: 100, clotting: 0.5 });
    expect(wound.bleedingClass).toBe("II");
    const p = medicineProcess(s);
    p.step(w, 60);
    expect(w.registry.component("body").props.blood_lost_ml).toBe(150);
    p.step(w, 60);
    expect(w.registry.component("body").props.blood_lost_ml).toBe(300);
    expect(treat(s, "tourniquet-and-ligature", { wound: wound.n }).effect).toBe("stop-bleeding");
    p.step(w, 60);
    expect(w.registry.component("body").props.blood_lost_ml).toBe(300);
    expect(w.trace.outOf("body", "volume:blood")).toBe(300);
    expect(w.trace.failed()).toEqual([]);
  });
  it("cautery stops it too; bleeding, washing and rum do not", () => {
    const s = createMedicine("body", { seed: 2 });
    const mk = () => inflictWound(s, "gunshot-musket-ball-splinter", { rateMlMin: 50, clotting: 0 });
    for (const t of ["bleeding-venesection-cupping-leeches", "washing-wounds-dry-lint-bandage-stitching", "rum-and-drinking-the-fever-away"]) {
      const w = mk(); treat(s, t, { wound: w.n }); expect(w.bound).toBe(false);
    }
    const w = mk(); treat(s, "sweating-blistering-cautery", { wound: w.n }); expect(w.bound).toBe(true);
  });
  it("amputation with a tourniquet is class II", () => {
    const s = createMedicine("body"), w = inflictWound(s, "amputation-the-surgeons-wound", { severity: 0 });
    expect(w.bleedingClass).toBe("III");
    treat(s, "tourniquet-and-ligature", { wound: w.n });
    expect(w.bleedingClass).toBe("II");
  });
  it("runs as a scheduler process, a day at a time, and publishes outputs by id", () => {
    const w = fixture(), s = createMedicine("body", { seed: 3 }), sch = new Scheduler();
    const wound = inflictWound(s, "gunshot-musket-ball-splinter", { rateMlMin: 5, clotting: 0.5, infected: false });
    treat(s, "tourniquet-and-ligature", { wound: wound.n });
    expose(s, "influenza", 1, { incubationDays: 0 });
    sch.add(medicineProcess(s, {}, 1));
    sch.run(w, 3 * 86400, 3600);
    const out = bodyOutputs(w.registry.component("body"));
    expect(s.day).toBe(3);
    expect(out["medicine.diseases.influenza"]).toBe(2);
    expect(out["medicine.diseases.dysentery"]).toBe(0);
    expect(out["medicine.wounds.gunshot-musket-ball-splinter"]).toBe(1);
    expect(out["medicine.pain.6-to-8"]).toBe(1);
    expect(out["medicine.pain"]).toBe(7);
    expect(w.registry.component("body").props.blood_lost_ml).toBe(0);
    expect(w.trace.failed()).toEqual([]);
  });
});

describe("pain", () => {
  it("is the worst open wound's band from the table's cause examples, zero when none", () => {
    const s = createMedicine("body", { seed: 1 });
    expect(painLevel(s)).toEqual({ band: null, min: 0, max: 0, level: 0 });
    inflictWound(s, "blunt-bruise-fracture", { infected: false });
    expect(painLevel(s).band).toBe("medicine.pain.0-to-2");
    const cut = inflictWound(s, "cut-incised", { severity: 1, infected: false });
    expect(painLevel(s).band).toBe("medicine.pain.3-to-5");
    inflictWound(s, "gunshot-musket-ball-splinter", { infected: false });
    expect(painLevel(s)).toMatchObject({ band: "medicine.pain.6-to-8", min: 6, max: 8, level: 7 });
    inflictWound(s, "amputation-the-surgeons-wound", { infected: false });
    expect(painLevel(s)).toMatchObject({ band: "medicine.pain.9-to-10", level: 9.5 });
    expect(cut.painCause).toBe("deep cut");
    expect(inflictWound(s, "thrust-penetrating").painCause).toBeNull(); // no cause example in the table
    expect(medicineOutputs(s)["medicine.pain.9-to-10"]).toBe(1);
  });
});

describe("lasting harm and the outputs", () => {
  it("flags the harm the row names, and none where it says none", () => {
    const s = createMedicine("body", { seed: 8, riskAt: 0 });
    expose(s, "influenza", 1, { incubationDays: 0 }); expose(s, "typhus", 1, { incubationDays: 0 });
    for (const c of s.crises) resolveCrisis(s, c, "survived");
    advanceDays(s, 30);
    for (const c of s.crises) resolveCrisis(s, c, "survived");
    advanceDays(s, 30);
    const o = medicineOutputs(s);
    expect(o["medicine.lasting_harm.influenza"]).toBe(0);
    expect(o["medicine.lasting_harm.typhus"]).toBe(1);
    expect(o["medicine.immunity.typhus"]).toBe(1);
    expect(Object.keys(o).filter(k => k.startsWith("medicine.diseases."))).toHaveLength(libraryTable("medicine", "diseases").length);
  });
});

describe("the air conditions of the exposure table", () => {
  it("are patterns of the body's states, with the table's thresholds", () => {
    const s = createMedicine("body");
    const k = (id: string) => `medicine.exposure.${id}`;
    const hyp = k("hypoxia-and-asphyxia-suffocation-the-foul-air");
    expect(airConditions(s, { sao2: 0.95 })[hyp]).toBe(0);
    expect(airConditions(s, { sao2: 0.89 })[hyp]).toBe(1);
    expect(airConditions(s, { sao2: 0.8 })[hyp]).toBe(2);
    expect(airConditions(s, { sao2: 0.7 })[hyp]).toBe(3);
    expect(s.crises).toHaveLength(0);
    expect(airConditions(s, { sao2: 0.55 })[hyp]).toBe(4);
    expect(s.crises).toHaveLength(1);
    airConditions(s, { sao2: 0.5 }); expect(s.crises).toHaveLength(1); // once while it lasts
    airConditions(s, { sao2: 0.95 }); airConditions(s, { sao2: 0.5 }); expect(s.crises).toHaveLength(2);
    const hc = k("hypercapnia-the-close-air");
    expect([airConditions(s, { airCo2Pct: 3 })[hc], airConditions(s, { airCo2Pct: 3.5 })[hc], airConditions(s, { airCo2Pct: 5 })[hc], airConditions(s, { airCo2Pct: 9 })[hc]]).toEqual([0, 1, 2, 3]);
    expect(airConditions(s, { paco2Mmhg: 51 })[hc]).toBe(1);
    expect(airConditions(s, { cohb: 0.1 })[k("carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier")]).toBe(0);
    expect(airConditions(s, { cohb: 0.11 })[k("carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier")]).toBe(1);
    expect(airConditions(s, { smokeMgM3: 150 })[k("smoke-inhalation-injury")]).toBe(1);
    expect(airConditions(s, { so2Ppm: 21 })[k("irritant-injury-the-brimstone")]).toBe(1);
    const h2s = k("hydrogen-sulphide-poisoning-the-damp-the-sewer-gas");
    expect([airConditions(s, { h2sPpm: 50 })[h2s], airConditions(s, { h2sPpm: 200 })[h2s], airConditions(s, { h2sPpm: 500 })[h2s]]).toEqual([0, 1, 2]);
    expect(airConditions(s, { sao2: 0.85, lowPressureDays: true })[k("altitude-illness-the-mountain-sickness")]).toBe(1);
    const before = s.crises.length;
    expect(airConditions(s, { sao2: 0.75, driveFailing: true })[k("respiratory-failure-the-end-state")]).toBe(1);
    expect(s.crises.length).toBe(before + 1);
    expect(s.crises.at(-1)!.cause).toBe("exposure:respiratory-failure-the-end-state");
    expect(Object.keys(airConditions(s, {}))).toHaveLength(libraryTable("medicine", "exposure").length);
  });
});
