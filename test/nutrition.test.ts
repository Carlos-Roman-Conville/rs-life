import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { Scheduler } from "../src/scheduler.ts";
import { defaultRegistry, type Component } from "../src/registry.ts";
import { KCAL_J } from "../src/physics.ts";
import { libraryRow, libraryTable } from "../src/library.ts";
import { bodyOutputs, metOf, physiologyProcess } from "../src/physiology.ts";
import {
  absorbedFraction, dailyNeed, deficiencySignals, eat, eatMeal, fatKcalPerKg, foodContent, foodRow, glycogenFactor, nutrientInfo,
  nutritionProcess, poolLevel, poolSpec, pooledNutrients, stockPools, type NutritionOptions,
} from "../src/nutrition.ts";

const DAY = 86400, HOUR = 3600;
const MAN = { height_cm: 175, age_y: 30, male: 1 };

interface Setup { body?: Record<string, number>; withPhysiology?: boolean; met?: number; nut?: NutritionOptions; waterKg?: number }

/** A body (and a room) with the daily nutrition process; physiology too when asked. clockH0 12 puts the first close one day in. */
function build(s: Setup = {}) {
  const reg = defaultRegistry(), w = new World(reg);
  const room: Component = { id: "room", kind: "room", material: "air_mass", mass: 1e6, temperatureC: 22, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: {} };
  const body: Component = { id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37, contents: s.waterKg ? [{ substance: "water", phase: "liquid", mass: s.waterKg }] : [],
    ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: 1.9, h: 10, ...s.body } };
  reg.addComponent(room); reg.addComponent(body);
  stockPools(w, "body");
  const sch = new Scheduler();
  if (s.withPhysiology) sch.add(physiologyProcess("body", "room", { every: 1, met: s.met ?? 1.5, clockH0: 12 }));
  sch.add(nutritionProcess("body", { every: 1, clockH0: 12, ...s.nut }));
  return { w, sch, body, out: bodyOutputs(body) };
}
type Built = ReturnType<typeof build>;
/** n whole days at one-hour steps, plus the step that opens the day after (which closes the last one). */
const days = (x: Built, n: number) => x.sch.run(x.w, n * DAY + HOUR, HOUR);

describe("the library rows", () => {
  it("reads needs, reserves and clocks from the nutrients table", () => {
    expect(dailyNeed("vit_c", true)).toBe(90);
    expect(dailyNeed("vit_c", false)).toBe(75);
    expect(dailyNeed("protein", true, 70)).toBeCloseTo(0.8 * 70, 9);
    expect(dailyNeed("energy", true)).toBeNull();
    expect(nutrientInfo("vit_c").daysToSignsLo).toBe(42);
    expect(nutrientInfo("vit_c").daysToSignsHi).toBe(84);
    expect(nutrientInfo("vit_b1").unit).toBe("mg");
  });

  it("parses every pool from the depletion table (and none for a reserve the table gives no number for)", () => {
    expect(pooledNutrients().sort()).toEqual(["iron", "magnesium", "sodium", "vit_a", "vit_b1", "vit_b12", "vit_b3", "vit_b9", "vit_c"]);
    const c = poolSpec("vit_c");
    expect(c.fullMan).toBeCloseTo(1500e-6, 12);
    expect(c.useFrac).toBe(0.03);
    expect(c.useMin).toBeCloseTo(10e-6, 12);
    expect(c.thresholdKg).toBeCloseTo(300e-6, 12);
    expect(poolSpec("iron").fullWoman).toBeCloseTo(300e-6, 12);
    expect(poolSpec("iron").bloodPerL).toBeCloseTo(250e-6, 12);
    expect(poolSpec("iron").menstrualDay).toBeCloseTo(1e-6, 12);
    expect(poolSpec("vit_b3").fullMan).toBeCloseTo(90 * 16e-6, 12);        // a buffer worth 90 days of 16 mg
    expect(poolSpec("vit_b3").thresholdKg).toBeCloseTo(20 * 16e-6, 12);    // 20 days left
    expect(poolSpec("sodium").fullMan).toBeCloseTo(3 * 1.5e-3, 12);        // a 3-day buffer
    expect(poolSpec("sodium").sweatPerL).toBeCloseTo(1e-3, 12);
    expect(poolSpec("vit_b1").recoveryDays).toBe(7);
    expect(poolSpec("vit_b3").recoveryDays).toBe(14);
    expect(poolSpec("vit_c").recoveryDays).toBeNull();                      // "days to feel better": no number
    expect(poolSpec("vit_b9").feverX).toBe(2);
    expect(poolSpec("magnesium").diarrhoea).toBeCloseTo(0.2e-3, 12);
  });

  it("reads the food rows per 100 g and joins the added nutrients by row", () => {
    const f = foodRow("ships-biscuit");
    expect(foodRow("nutrition.foods.ships-biscuit")).toBe(f);
    expect(f.kcalPerKg).toBe(3800);
    expect(foodContent(f, "protein", 0.5)).toBeCloseTo(50, 9);               // 10 g per 100 g, 500 g
    expect(foodContent(f, "calcium", 1)).toBe(200);                            // foods_more, 20 mg per 100 g
    expect(foodRow("lime-juice-fresh").per100.get("vit_c")!.value).toBe(libraryTable("nutrition", "foods").find(r => String(r.id).includes("lime-juice"))!["Vit C mg"]);
    expect(foodRow("salt-beef").haem).toBe(true);
    expect(foodRow("pease-dried").haem).toBe(false);
    expect(() => foodRow("moon-cheese")).toThrow();
  });

  it("takes the energy density of stored fat from the table", () => {
    expect(fatKcalPerKg()).toBe(7700);
    expect(glycogenFactor(400)).toBe(1);
    expect(glycogenFactor(0)).toBe(0.5);
  });
});

describe("absorption", () => {
  const meal = (o: Partial<Parameters<typeof absorbedFraction>[2]> = {}) => ({ vitCMg: 0, fatG: 0, flux: false, chronicFlux: false, rum: false, ...o });
  it("applies the table's multipliers", () => {
    expect(absorbedFraction("iron", foodRow("salt-beef"), meal())).toBe(0.25);
    expect(absorbedFraction("iron", foodRow("pease-dried"), meal())).toBe(0.08);
    expect(absorbedFraction("iron", foodRow("pease-dried"), meal({ vitCMg: 50 }))).toBeCloseTo(0.16, 12);
    expect(absorbedFraction("iron", foodRow("pease-dried"), meal({ vitCMg: 49 }))).toBe(0.08);
    expect(absorbedFraction("iron", foodRow("pease-dried"), meal({ tea: true }))).toBeCloseTo(0.04, 12);
    expect(absorbedFraction("vit_b3", foodRow("maize-whole-grain"), meal())).toBe(0.3);
    expect(absorbedFraction("vit_b3", foodRow("maize-whole-grain"), meal({ nixtamalised: true }))).toBe(1);
    expect(absorbedFraction("vit_b1", foodRow("fresh-fish"), meal({ rawFish: true }))).toBe(0.5);
    expect(absorbedFraction("vit_b1", foodRow("fresh-fish"), meal({ rum: true }))).toBe(0.5);
    expect(absorbedFraction("vit_b9", foodRow("onions"), meal({ cooked: true }))).toBe(0.5);
    expect(absorbedFraction("vit_c", foodRow("limes"), meal())).toBe(0.8);
    expect(absorbedFraction("vit_c", foodRow("limes"), meal({ cooked: true }))).toBeCloseTo(0.4, 12);
    expect(absorbedFraction("vit_a", foodRow("butter"), meal({ fatG: 10 }))).toBe(1);
    expect(absorbedFraction("vit_a", foodRow("butter"), meal({ fatG: 9 }))).toBe(0.5);
    expect(absorbedFraction("vit_a", foodRow("butter"), meal({ fatG: 30, flux: true }))).toBe(0.3);
    expect(absorbedFraction("zinc", foodRow("pease-dried"), meal())).toBe(0.3);
    expect(absorbedFraction("zinc", foodRow("pease-dried"), meal({ grainAndPease: true }))).toBe(0.2);
    expect(absorbedFraction("vit_b12", foodRow("eggs"), meal())).toBe(0.5);
    expect(absorbedFraction("vit_b12", foodRow("eggs"), meal({ chronicFlux: true, flux: true }))).toBe(0);
    expect(absorbedFraction("protein", foodRow("eggs"), meal({ flux: true }))).toBe(0.5);
    expect(absorbedFraction("sodium", foodRow("salt-beef"), meal({ flux: true }))).toBe(1);
  });

  it("puts the vitamin C of the same meal to work on the iron, and traces what is kept and what is not", () => {
    const x = build();
    stockPools(x.w, "body", { iron: 0 });
    eatMeal(x.w, "body", [{ food: "pease-dried", kg: 1 }, { food: "lime-juice-fresh", kg: 1 }]);
    const pease = foodContent(foodRow("pease-dried"), "iron", 1), lime = foodContent(foodRow("lime-juice-fresh"), "iron", 1);
    const kept = x.w.trace.into("body", "mass:nutrient:iron");
    expect(kept).toBeCloseTo((pease + lime) * 0.16 * 1e-6, 12);
    const eaten = x.w.trace.transfers.filter(f => f.from === "food" && f.quantity === "mass:nutrient:iron").reduce((a, f) => a + f.amount, 0);
    expect(eaten).toBeCloseTo((pease + lime) * 1e-6, 12);
  });
});

describe("eating", () => {
  it("brings energy and water in through physiology and the nutrients into the pools", () => {
    const x = build({ waterKg: 40, withPhysiology: true, body: MAN });
    stockPools(x.w, "body", { vit_c: 0.5 });
    const before = poolLevel(x.w, "body", "vit_c");
    eat(x.w, "body", "limes", 0.2);
    const limes = foodRow("limes");
    expect(x.body.props.intake_kcal).toBeCloseTo(limes.kcalPerKg * 0.2, 9);
    expect(x.w.trace.into("body", "energy:chemical")).toBeCloseTo(limes.kcalPerKg * 0.2 * KCAL_J, 3);
    expect(x.w.trace.into("body", "mass:water")).toBeCloseTo(foodContent(limes, "water", 0.2) * 1e-3, 9);
    expect(poolLevel(x.w, "body", "vit_c") - before).toBeCloseTo(foodContent(limes, "vit_c", 0.2) * 0.8, 9);
  });

  it("sends what the full pool cannot hold to excreta", () => {
    const x = build();
    eat(x.w, "body", "lime-juice-fresh", 5);
    days(x, 1); // the cap comes at the day's close, after the day's use
    expect(poolLevel(x.w, "body", "vit_c")).toBeCloseTo(1500, 9);
    const over = x.w.trace.transfers.find(f => f.to === "excreta" && f.quantity === "mass:nutrient:vit_c")!;
    expect(over.amount).toBeGreaterThan(0);
  });
});

describe("energy enters absorbed (CG-13)", () => {
  it("passes kept kcal to intake and traces unabsorbed energy to waste", () => {
    const x = build();
    x.body.props.flux = 1;                                               // flux cuts every nutrient including energy below 1
    const items = [{ food: "salt-beef", kg: 0.3 }, { food: "ships-biscuit", kg: 0.4 }];
    const list = items.map(i => ({ food: foodRow(i.food), kg: i.kg }));
    const sum = (n: string) => list.reduce((a, i) => a + foodContent(i.food, n, i.kg), 0);
    const meal = { vitCMg: sum("vit_c"), fatG: sum("fat"), flux: true, chronicFlux: false, rum: false };
    let eatenKcal = 0, keptKcal = 0;
    for (const { food, kg } of list) {
      const e = food.kcalPerKg * kg;
      eatenKcal += e;
      keptKcal += e * absorbedFraction("energy", food, meal);
    }
    expect(absorbedFraction("energy", list[0]!.food, meal)).toBeLessThan(1);
    expect(absorbedFraction("energy", list[1]!.food, meal)).toBeLessThan(1);
    const intake0 = x.body.props.intake_kcal ?? 0;
    eatMeal(x.w, "body", items);
    expect(x.body.props.intake_kcal! - intake0).toBeCloseTo(keptKcal, 9);
    const wasteJ = x.w.trace.transfers.filter(f => f.from === "food" && f.to === "waste" && f.quantity === "energy:chemical" && f.note === "unabsorbed")
      .reduce((a, f) => a + f.amount, 0);
    expect(wasteJ).toBeCloseTo((eatenKcal - keptKcal) * KCAL_J, 9);
    expect(keptKcal + wasteJ / KCAL_J).toBeCloseTo(eatenKcal, 9);
    expect(x.w.trace.into("body", "energy:chemical")).toBeCloseTo(keptKcal * KCAL_J, 9);
  });
});

describe("deficiency", () => {
  it("vitamin C: zero intake from the full pool reaches stage 1 on the docs' scurvy day", () => {
    const x = build();
    const c = poolSpec("vit_c"), unit = 1e-6;
    // the table's rule by hand: use = max(3% of pool, 10 mg) each day, signs under 300 mg
    let pool = c.fullMan / unit, day = 0;
    while (pool >= c.thresholdKg! / unit) { pool -= Math.max(c.useFrac * pool, c.useMin / unit); day++; }
    expect(day).toBe(53);
    expect(day).toBeGreaterThanOrEqual(nutrientInfo("vit_c").daysToSignsLo!);
    expect(day).toBeLessThanOrEqual(nutrientInfo("vit_c").daysToSignsHi!);
    let first = 0;
    for (let d = 1; d <= 60; d++) {
      x.sch.run(x.w, d === 1 ? DAY + HOUR : DAY, HOUR);
      if (first === 0 && (x.out.deficiency_vit_c as number) >= 1) first = d;
    }
    expect(first).toBe(day);
    expect(x.body.props.nut_days).toBe(60);
    expect(deficiencySignals(x.body).vit_c).toBe(1);
    expect(x.out.deficiency_vit_c_row).toBe("nutrition.depletion.vitamin-c");
    expect(x.w.trace.notes.some(n => /deficiency vit_c stage 0 -> 1 .* day 53/.test(n.text))).toBe(true);
  });

  it("vitamin C: the day before, nothing is signalled and the pool follows 1500 x 0.97^n", () => {
    const x = build();
    days(x, 36);
    expect(x.out.deficiency_vit_c).toBe(0);
    expect(deficiencySignals(x.body).vit_c).toBeUndefined();
    expect(x.out.pool_vit_c as number).toBeCloseTo(1500 * 0.97 ** 36, 9);
    expect(x.out.pool_frac_vit_c as number).toBeCloseTo(0.97 ** 36, 12);
  });

  it("thiamin: the signs come on the day the table's fixed use implies, and recover on the table's week", () => {
    const x = build({ nut: { stages: { vit_b1: { stage2: 4 } } } });
    const t = poolSpec("vit_b1"), unit = 1e-6;
    const first = Math.floor((t.fullMan - t.thresholdKg!) / t.useFixed) + 1;     // 30 - 1.2 n < 8
    expect(first).toBe(19);
    days(x, first - 1);
    expect(x.out.deficiency_vit_b1).toBe(0);
    x.sch.run(x.w, DAY, HOUR);
    expect(x.out.deficiency_vit_b1).toBe(1);
    // the caller's stage 2 level: the pool under 4 mg
    days(x, 4);
    expect(poolLevel(x.w, "body", "vit_b1")).toBeLessThan(4);
    expect(x.out.deficiency_vit_b1).toBe(2);
    // full intake: the pool is over the threshold at once, the stage holds for the recovery week
    stockPools(x.w, "body");
    for (let d = 1; d <= 6; d++) { x.sch.run(x.w, DAY, HOUR); expect(x.out.deficiency_vit_b1).toBeGreaterThan(0); }
    x.sch.run(x.w, DAY, HOUR);
    expect(x.out.deficiency_vit_b1).toBe(0);
    expect(poolLevel(x.w, "body", "vit_b1")).toBeGreaterThan(t.thresholdKg! / unit);
  });

  it("vitamin C: eating limes refills the pool and the stage falls the day it is over the threshold (the table gives no recovery number)", () => {
    const x = build();
    stockPools(x.w, "body", { vit_c: 0.15 });
    days(x, 1);
    expect(x.out.deficiency_vit_c).toBe(1);
    eat(x.w, "body", "lime-juice-fresh", 2.5);
    x.sch.run(x.w, DAY, HOUR);
    expect(x.out.deficiency_vit_c).toBe(0);
  });

  it("sodium: sweat adds to the day's use; iron: blood lost and menstrual days add theirs", () => {
    const sweaty = build({ withPhysiology: true, body: MAN, met: metOf("smithing") }); // a 22 C rest needs no sweat (ISO 7730 heat balance)
    sweaty.sch.run(sweaty.w, 600, 600);
    sweaty.sch.run(sweaty.w, 5 * HOUR, 600);
    // (2623) Sweat now also traces mass:body; select the water transfer to count it once.
    const traced = sweaty.w.trace.transfers.filter(f => f.quantity === "mass:water" && f.note === "sweat").reduce((a, f) => a + f.amount, 0);
    expect(traced).toBeGreaterThan(0.1);
    expect(sweaty.body.props.sweat_kg).toBeCloseTo(traced, 12);          // physiology's running total is the traced sweat
    const dry = build();
    dry.sch.run(dry.w, 600, 600);
    dry.body.props.sweat_kg = 1;                                          // a litre of sweat in the day
    days(dry, 1);
    const sodium = poolSpec("sodium");
    expect(poolLevel(dry.w, "body", "sodium")).toBeCloseTo((sodium.fullMan - sodium.useFixed - sodium.sweatPerL * 1) * 1e3, 9);
    const bleeder = build({ body: { male: 0, menstrual: 1 } });
    days(bleeder, 1);
    bleeder.body.props.blood_lost_l = 1;
    bleeder.sch.run(bleeder.w, DAY, HOUR);
    const iron = poolSpec("iron");
    expect(poolLevel(bleeder.w, "body", "iron")).toBeCloseTo((iron.fullWoman - 2 * (iron.useFixed + iron.menstrualDay) - iron.bloodPerL) * 1e6, 6);
  });
});

describe("conservation", () => {
  it("keeps each nutrient's mass: pools + what left = full + what entered, every step, with food, use and excreta", () => {
    const x = build({ withPhysiology: true, body: MAN, waterKg: 40 });
    for (const id of pooledNutrients()) x.w.conserve(`nutrient:${id}`, ["body"], 1e-12);
    x.w.conserve("water", ["body", "room"], 1e-9);
    const menu = [{ food: "salt-beef", kg: 0.4 }, { food: "ships-biscuit", kg: 0.5 }, { food: "lime-juice-fresh", kg: 0.1 }];
    for (let d = 0; d < 6; d++) { eatMeal(x.w, "body", menu, { cooked: d % 2 === 0 }); x.sch.run(x.w, DAY, 600); }
    eat(x.w, "body", "oranges", 20);                       // over the full pool: the excess is traced out
    x.sch.run(x.w, DAY, 600);
    expect(x.w.trace.checks.length).toBeGreaterThan(1000);
    expect(x.w.trace.failed()).toEqual([]);
    for (const id of pooledNutrients()) {
      const q = `mass:nutrient:${id}`, t = x.w.trace.transfers.filter(f => f.quantity === q);
      const into = t.filter(f => f.to === "body").reduce((a, f) => a + f.amount, 0), out = t.filter(f => f.from === "body").reduce((a, f) => a + f.amount, 0);
      expect(poolLevel(x.w, "body", id) * 1e-6 * (poolSpec(id).unit === "g" ? 1e3 : poolSpec(id).unit === "mcg" ? 1e-3 : 1))
        .toBeCloseTo((poolSpec(id).fullMan + into - out), 12);
    }
    const eatenC = x.w.trace.transfers.filter(f => f.quantity === "mass:nutrient:vit_c" && f.from === "food").reduce((a, f) => a + f.amount, 0);
    expect(eatenC).toBeGreaterThan(0.1e-3);
  });
});

describe("energy and body composition", () => {
  const advance = (x: Built, n: number, kcalPerDay: number) => {
    for (let d = 0; d < n; d++) { x.body.props.intake_kcal = (x.body.props.intake_kcal ?? 0) + kcalPerDay; x.sch.run(x.w, DAY, 600); }
  };
  it("closes energy: intake minus expenditure is the change of glycogen and fat", () => {
    const x = build({ withPhysiology: true, body: { ...MAN, fat_kg: 15 }, met: 1.5 });
    advance(x, 8, 3000);
    x.sch.run(x.w, 600, 600);
    expect(x.w.trace.failed()).toEqual([]);
    expect(x.w.trace.checks.filter(c => c.quantity === "energy:stored").length).toBeGreaterThanOrEqual(7);
    const p = x.body.props;
    const stored = (p.fat_kg! - 15) * 7700 + (p.glycogen_g! - 400) * 4;
    expect(stored + p.nut_unplaced_kcal!).toBeCloseTo(p.nut_balance_kcal!, 6);
    expect(p.nut_unplaced_kcal).toBeCloseTo(0, 6);
    // (2623) Bound water is already in the live water deficit; no daily water mark.
    expect(x.body.mass).toBeCloseTo(70 + (p.fat_kg! - 15) + (p.glycogen_g! - 400) / 1000 - p.waterDeficitKg!, 9);
  });

  it("a surplus is stored as fat by balance / 7700 once glycogen is full", () => {
    const x = build({ withPhysiology: true, body: { ...MAN, fat_kg: 15 }, met: 1.5 });
    advance(x, 3, 6000);
    x.body.props.intake_kcal! += 6000;                                 // the third day's food, so its close is a surplus too
    x.sch.run(x.w, 600, 600);
    const p = x.body.props;
    expect(p.glycogen_g).toBe(400);
    expect(p.fat_kg! - 15).toBeCloseTo(p.nut_balance_kcal! / 7700, 9);
    expect(x.out.glycogen_factor).toBe(1);
  });

  it("a deficit draws the glycogen first, then the fat, and stops at the floor", () => {
    const x = build({ withPhysiology: true, body: { ...MAN, fat_kg: 3.5 }, met: 1.5 });
    advance(x, 1, 0);
    x.sch.run(x.w, 600, 600);
    const p = x.body.props;
    expect(p.glycogen_g).toBe(0);                                      // 1,600 kcal of glycogen are gone in the first day
    expect(p.fat_kg).toBeCloseTo(3.5 + (p.nut_balance_kcal! + 400 * 4) / 7700, 9);
    expect(x.out.glycogen_factor).toBe(0.5);
    advance(x, 10, 0);
    x.sch.run(x.w, 600, 600);
    expect(p.fat_kg).toBe(3);
    expect(p.nut_unplaced_kcal!).toBeLessThan(0);
    expect(x.out.starvation_limit).toBe(1);
    expect(x.w.trace.failed()).toEqual([]);                            // energy still closes: the shortfall is reported, not hidden
  });

  it("without a fat store the balance is reported as unplaced, never invented", () => {
    const x = build({ withPhysiology: true, body: MAN, met: 1.5 });
    advance(x, 2, 3000);
    x.sch.run(x.w, 600, 600);
    expect(x.out.fat_kg).toBeNull();
    expect(x.out.energy_unplaced_kcal).not.toBe(0);
    expect(x.w.trace.failed()).toEqual([]);
  });

  it("fills glycogen from the carbohydrate eaten and spends it on work over 4 MET", () => {
    const x = build({ withPhysiology: true, body: { ...MAN, fat_kg: 15, glycogen_g: 100 }, met: metOf("smithing") });
    eat(x.w, "body", "ships-biscuit", 0.5);                            // 380 g carbohydrate
    advance(x, 1, 0);
    x.sch.run(x.w, 600, 600);
    const g = libraryRow("nutrition", "body_composition", "nutrition.body_composition.glycogen").Rule as string;
    expect(g).toContain("carb intake x 0.8");
    expect(x.out.glycogen_g as number).toBeLessThanOrEqual(400);
    expect(x.out.intake_carb).toBeCloseTo(foodContent(foodRow("ships-biscuit"), "carb", 0.5), 9);
  });
});
