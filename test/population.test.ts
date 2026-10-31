import { describe, expect, it } from "vitest";
import { Trace } from "../src/trace.ts";
import { advanceDays, createMedicine, diseaseCourse, expose, rangePoint, resolveCrisis } from "../src/medicine.ts";
import validation from "../data/library/validation.json";
import { ageingRates, createPopulation, elderDeathFactor, famineRule, populationOutputs, settlersPerDay, startEpidemic, tick, total } from "../src/population.ts";

const rates = { birthRate: 0.2, deathRate: 0.03, childMaleShare: 0.5 };
const base = () => createPopulation({ children: 300, adultsM: 400, adultsF: 420, elders: 80, transient: 50, foodDays: 100 });

describe("the cohort tick", () => {
  it("reproduces the natural change of a host rate row", () => {
    const p = base();
    const r = tick(p, rates);
    const births = 420 * 0.2 / 365;
    const age = ageingRates();
    expect(age.toAdults).toBeCloseTo(1 / 5475, 15);
    expect(age.toElders).toBeCloseTo(1 / 12775, 15);
    expect(r.births).toBeCloseTo(births, 12);
    expect(p.children).toBeCloseTo(300 + births - 300 * 0.03 / 365 - 300 / 5475, 10);
    expect(p.elders).toBeCloseTo(80 + 820 / 12775 - 80 * 0.03 / 365 * 2, 10);
    expect(elderDeathFactor()).toBe(2);
    expect(p.adultsF).toBeCloseTo(420 + 150 / 5475 - 420 / 12775 - 420 * 0.03 / 365, 10);
    expect(p.foodDays).toBe(99);
  });

  it("health scales births and deaths: births x health, deaths x (2 - health)", () => {
    const sick = createPopulation({ children: 0, adultsM: 0, adultsF: 1000, elders: 0, health: 0.5, foodDays: 10 });
    const r = tick(sick, rates);
    expect(r.births).toBeCloseTo(1000 * 0.2 / 365 * 0.5, 12);
    expect(r.backgroundDeaths.adultsF).toBeCloseTo(1000 * 0.03 / 365 * 1.5, 12);
  });

  it("conserves people over a year: every leaving person is a death, a departure or an ageing move", () => {
    const p = base();
    const trace = new Trace();
    const start = total(p);
    for (let d = 0; d < 365; d++) tick(p, rates, { trace, arrivals: 2, transientLeaving: 1, leaversM: 0.1, leaversF: 0.05, prosperity: 0.8, reputation: 0.5 });
    expect(trace.failed()).toEqual([]);
    const deaths = Object.values(p.ledger.deaths).reduce((a, b) => a + b, 0);
    expect(total(p)).toBeCloseTo(start + p.ledger.births + p.ledger.arrivals - deaths - p.ledger.departures, 6);
    expect(settlersPerDay(0.8, 0.5)).toBeCloseTo(0.0004, 12);
    // Ageing is internal: the traced moves between cohorts net to zero in the total.
    const aged = trace.transfers.filter(x => x.note === "ageing").reduce((a, x) => a + x.amount, 0);
    expect(aged).toBeGreaterThan(0);
    const out = trace.transfers.filter(x => x.from === "adultsM" || x.from === "adultsF" || x.from === "children" || x.from === "elders").filter(x => x.note !== "ageing");
    expect(out.every(x => x.to.startsWith("deaths:") || x.to === "departures")).toBe(true);
  });

  it("applies the famine row once the stores are under zero", () => {
    const f = famineRule();
    expect(f).toEqual({ healthLoss: 0.02, birthsFactor: 0.5, deathsFactor: 1.5 });
    const p = createPopulation({ adultsF: 1000, foodDays: 0 });
    const r = tick(p, rates);
    expect(r.famine).toBe(true);
    expect(r.births).toBeCloseTo(1000 * 0.2 / 365 * 0.5, 12);
    expect(r.backgroundDeaths.adultsF).toBeCloseTo(1000 * 0.03 / 365 * 1.5, 12);
    expect(p.health).toBeCloseTo(0.98, 12);
  });
});

describe("an epidemic through the disease course", () => {
  it("raises deaths by the course's risk over the course days and seasons the survivors", () => {
    const d = diseaseCourse("smallpox");
    const risk = (d.risk!.lo + d.risk!.hi) / 2;
    const exposureDays = d.course!.hi;
    const make = () => createPopulation({ children: 200, adultsM: 400, adultsF: 400, elders: 0, foodDays: 1000 });
    const calm = make(), ill = make();
    startEpidemic(ill, "smallpox", 0.01);
    const trace = new Trace();
    // The last exposure still has its full incubation and the longest course to finish.
    let cases = 0;
    for (let day = 0; day < exposureDays + d.incubation!.hi + d.course!.hi; day++) {
      tick(calm, { ...rates, birthRate: 0 }); cases += tick(ill, { ...rates, birthRate: 0 }, { trace }).newCases;
    }
    expect(cases).toBeCloseTo(1000 * (1 - 0.99 ** exposureDays), 9);
    const extra = ill.ledger.deaths["epidemic:smallpox"];
    expect(extra).toBeCloseTo(cases * risk, 6);
    expect(calm.ledger.deaths["epidemic:smallpox"]).toBeUndefined();
    expect(ill.epidemic).toBeNull();
    expect(trace.failed()).toEqual([]);
    expect(ill.seasonedShare).toBeGreaterThan(0);
    expect(total(ill)).toBeLessThan(total(calm));
  });

  it("matches 1,000 individual medicine cases within three sample standard errors", () => {
    const disease = "yellow_fever", catchRate = 0.2, riskAt = 0.6, size = 1000;
    const d = diseaseCourse(disease);
    const exposureDays = d.course!.hi;
    const horizon = exposureDays + d.incubation!.hi + d.course!.hi;
    const p = createPopulation({ elders: size, foodDays: horizon });
    const trace = new Trace();
    startEpidemic(p, disease, catchRate);
    let cases = 0, illnessDays = 0;
    for (let day = 0; day < horizon; day++) {
      const r = tick(p, { ...rates, birthRate: 0, deathRate: 0 }, { riskAt, trace });
      cases += r.newCases;
      illnessDays += r.illnessDays;
    }
    const attacks: number[] = [], fatalities: number[] = [], durations: number[] = [];
    for (let seed = 1; seed <= size; seed++) {
      const s = createMedicine(`person-${seed}`, { seed, riskAt });
      let caught = false, died = false, duration = 0;
      for (let day = 0; day < horizon; day++) {
        if (day < exposureDays) caught = expose(s, disease, catchRate).infected || caught;
        // Illness ends at the crisis or recovery; incubation is not an illness day.
        if (s.sick.some(x => x.stage === "ill")) duration++;
        advanceDays(s, 1);
        if (s.crises.length) {
          resolveCrisis(s, s.crises[0], "died");
          died = true;
          break;
        }
      }
      attacks.push(Number(caught));
      if (caught) { fatalities.push(Number(died)); durations.push(duration); }
    }
    // Verification, not validation. For each observed sample, SE(mean) = sample SD / sqrt(n),
    // using Bessel's n-1 variance. Attack uses all 1,000 runs; fatality and illness duration
    // are conditional on infection, so n is the infected subset of those same 1,000 runs.
    const agrees = (expected: number, sample: number[]) => {
      const mean = sample.reduce((a, x) => a + x, 0) / sample.length;
      const variance = sample.reduce((a, x) => a + (x - mean) ** 2, 0) / (sample.length - 1);
      expect(Math.abs(expected - mean)).toBeLessThanOrEqual(3 * Math.sqrt(variance / sample.length));
    };
    agrees(cases / size, attacks);
    agrees(p.ledger.deaths[`epidemic:${disease}`] / cases, fatalities);
    agrees(illnessDays / cases, durations);
    expect(p.epidemic).toBeNull();
    expect(trace.failed()).toEqual([]);
  });

  it("uses the mixed crisis-day distribution, including incubation, and keeps each batch's risk", () => {
    const d = diseaseCourse("yellow_fever"), risk = rangePoint(d.risk!, 1);
    const p = createPopulation({ elders: 1000, foodDays: 100 });
    startEpidemic(p, "yellow_fever", 1);
    let illnessDays = 0;
    for (let day = 1; day <= d.incubation!.hi + d.course!.hi; day++) {
      // Only the first tick exposes anyone; later riskAt changes must not redraw that batch's fate.
      const r = tick(p, { ...rates, birthRate: 0, deathRate: 0 }, { riskAt: day === 1 ? 1 : 0 });
      let probability = 0;
      for (let inc = d.incubation!.lo; inc <= d.incubation!.hi; inc++) {
        for (let length = d.course!.lo; length <= d.course!.hi; length++) {
          if (day > inc && day <= inc + length) probability += risk / length;
        }
      }
      probability /= (d.incubation!.hi - d.incubation!.lo + 1) * (d.course!.hi - d.course!.lo + 1);
      expect(r.epidemicDeaths.elders).toBeCloseTo(1000 * probability, 10);
      expect(r.newCases).toBe(day === 1 ? 1000 : 0);
      illnessDays += r.illnessDays;
    }
    const meanCourse = (d.course!.lo + d.course!.hi) / 2;
    expect(illnessDays / 1000).toBeCloseTo((1 - risk) * meanCourse + risk * (meanCourse + 1) / 2, 12);
    expect(p.ledger.deaths["epidemic:yellow_fever"]).toBeCloseTo(1000 * risk, 10);
    expect(p.epidemic).toBeNull();
  });

  it.each(["smallpox", "dysentery"])("depletes only the never-caught, initially unseasoned pool: %s", disease => {
    const p = createPopulation({ adultsM: 1000, seasonedShare: 0.25, foodDays: 100 });
    const d = diseaseCourse(disease), catchRate = 0.2;
    const ep = startEpidemic(p, disease, catchRate);
    for (let day = 0; day < d.course!.hi; day++) {
      const r = tick(p, { ...rates, birthRate: 0, deathRate: 0 });
      expect(r.newCases).toBeCloseTo(750 * (1 - catchRate) ** day * catchRate, 10);
    }
    expect(ep.caught).toBeCloseTo(0.75 * (1 - (1 - catchRate) ** d.course!.hi), 12);
    expect(ep.susceptible).toBeCloseTo(750 * (1 - catchRate) ** d.course!.hi, 10);
  });

  it("keeps empty and fully seasoned outbreak cohorts finite when settlers arrive later", () => {
    for (const initial of [{ adultsM: 0, seasonedShare: 0 }, { adultsM: 100, seasonedShare: 1 }]) {
      const p = createPopulation({ ...initial, foodDays: 100 });
      const ep = startEpidemic(p, "yellow_fever", 0.2);
      for (let day = 0; day < diseaseCourse("yellow_fever").course!.hi; day++) {
        const r = tick(p, { ...rates, birthRate: 0, deathRate: 0 }, { prosperity: 1, reputation: 1 });
        expect(r.newCases).toBe(0);
        expect(ep.caught).toBe(0);
        expect(ep.susceptible).toBe(0);
      }
      expect(p.epidemic).toBeNull();
    }
  });

  it("excludes incubating, recovered and dead cases from labour's sick share", () => {
    const p = createPopulation({ adultsM: 1000, foodDays: 100 });
    const ep = startEpidemic(p, "yellow_fever", 1);
    const d = diseaseCourse("yellow_fever"), risk = rangePoint(d.risk!, 0.5);
    for (let day = 1; day <= d.incubation!.hi + d.course!.hi; day++) {
      tick(p, { ...rates, birthRate: 0, deathRate: 0 });
      let expectedSick = 0;
      // Enumerate the possible individual courses, independently of the aggregate's stored outcome array.
      for (let inc = d.incubation!.lo; inc <= d.incubation!.hi; inc++) {
        for (let length = d.course!.lo; length <= d.course!.hi; length++) {
          if (day >= inc && day < inc + length) expectedSick += 1 - risk * (day - inc) / length;
        }
      }
      expectedSick *= 1000 / ((d.incubation!.hi - d.incubation!.lo + 1) * (d.course!.hi - d.course!.lo + 1));
      expect(populationOutputs(p)["population.cohorts.labour"]).toBeCloseTo(p.adultsM * (1 - expectedSick / total(p)), 9);
    }
    expect(ep.susceptible).toBe(0);
  });

  it("validation (2626): Angola suspected-case fatality is inside the yellow-fever range; other endpoints remain unvalidated", () => {
    // https://en.wikipedia.org/wiki/2016_Angola_and_DR_Congo_yellow_fever_outbreak
    // Opened by 2645, transcribed in validation.json. No uncertainty band is supplied, so none is invented.
    // Suspected cases are not confirmed cases; this is only range compatibility, not full outbreak validation.
    const rows = validation.outbreak_records.rows;
    const cfr = Number(rows.find(r => r[0] === "validation.outbreak_records.yf-angola-2016-cfr-suspected")![2]) / 100;
    const d = diseaseCourse("yellow_fever");
    const riskAt = (cfr - d.risk!.lo) / (d.risk!.hi - d.risk!.lo);
    expect(riskAt).toBeGreaterThanOrEqual(0);
    expect(riskAt).toBeLessThanOrEqual(1);
    const p = createPopulation({ elders: 1000, foodDays: 100 });
    startEpidemic(p, "yellow_fever", 1);
    for (let day = 0; day < d.course!.hi + d.incubation!.hi; day++) tick(p, { ...rates, birthRate: 0, deathRate: 0 }, { riskAt });
    expect(p.ledger.deaths["epidemic:yellow_fever"] / 1000).toBeCloseTo(cfr, 12);
    expect(rows.find(r => r[0] === "validation.outbreak_records.yf-angola-2016-attack-rate")![2]).toBeNull();
  });

  it("refuses a disease without a course and sets no deaths where the risk is not a number", () => {
    const p = createPopulation({ adultsF: 100 });
    expect(() => startEpidemic(p, "scurvy", 0.01)).toThrow();
    expect(() => startEpidemic(p, "pellagra", 0.01)).toThrow();
    for (const invalid of [-0.01, 1.01, NaN, Infinity]) expect(() => startEpidemic(p, "yellow_fever", invalid)).toThrow();
    expect(() => tick(p, rates, { riskAt: 2 })).toThrow();
    startEpidemic(p, "gonorrhoea", 0.01);
    const d = diseaseCourse("gonorrhoea");
    for (let i = 0; i < 2 * d.course!.hi + d.incubation!.hi; i++) tick(p, rates);
    expect(p.ledger.deaths["epidemic:gonorrhoea"]).toBeUndefined();
    expect(p.epidemic).toBeNull();
  });

  it("outputs labour by library id", () => {
    const p = base();
    const o = populationOutputs(p);
    expect(o["population.cohorts.labour"]).toBeCloseTo(820);
    expect(o["population.cohorts.children"]).toBe(300);
  });
});
