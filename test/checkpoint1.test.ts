import { describe, expect, it } from 'vitest';
import { runHumanWeek, FIXTURE, MEALS, DOOR } from '../examples/human-week.ts';
import { libraryRow, libraryTable } from '../src/library.ts';
import { World } from '../src/world.ts';
import { Scheduler } from '../src/scheduler.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { airContents, breathingProcess, roomAirProcess, roomGasFraction, litresToMoles } from '../src/atmosphere.ts';
import { metOf } from '../src/physiology.ts';
import { P_SEA_LEVEL } from '../src/physics.ts';
import { GLYCOGEN_BOUND_WATER, nutritionProcess, poolSpec, poolLevel } from '../src/nutrition.ts';

const row = (file: string, table: string, slug: string) => libraryRow(file, table, `${file}.${table}.${slug}`);
const numberIn = (text: unknown, rx: RegExp, index = 1) => Number(rx.exec(String(text))![index]!.replaceAll(',', ''));

describe('checkpoint 1: an integrated human week', () => {
  it('closes seven complete days from food rows, water transfers, composition and sleep tables within 20 s', () => {
    const run = runHumanWeek();
    expect(run.elapsedMs).toBeLessThan(20_000);
    expect(run.w.t).toBe(7 * 86400);
    expect(run.days).toHaveLength(7);
    expect(run.body.props.days_closed).toBe(7);
    expect(run.body.props.nut_days).toBe(7);
    expect(run.w.trace.failed()).toEqual([]);
    expect(run.w.trace.checks.some(c => c.quantity === 'element:C')).toBe(true);
    const kcal = Object.values(MEALS).flat().reduce((s, item) => s + Number(libraryRow('nutrition', 'foods', item.food).kcal) * item.kg * 10, 0);
    const foodWater = Object.values(MEALS).flat().reduce((s, item) => s + Number(libraryRow('nutrition', 'foods', item.food)['Water g']) * item.kg / 100, 0);
    const fatDensity = numberIn(row('nutrition', 'body_composition', 'fat-mass').Rule, /balance \/ ([\d,]+)/);
    const reserve = String(libraryRow('nutrition', 'nutrients', 'energy')['Body reserve (full)']);
    const initialGlycogen = numberIn(reserve, /glycogen about ([\d,]+) g/);
    const glyEnergy = numberIn(reserve, /glycogen about [\d,]+ g = ([\d,]+) kcal/) / initialGlycogen;
    const need = numberIn(row('physiology', 'recovery', 'sleep-debt')['Overnight rule'], /debt \+= max\(0, ([\d.]+)/);
    const circadian = Number(row('physiology', 'circadian', '02-00-to-06-00').Factor);
    let water = FIXTURE.waterKg as number, balance = 0, debt = 0;
    for (const d of run.days) {
      expect(d.kcalIn).toBeCloseTo(kcal, 9);
      expect(Math.abs(d.kcalIn - d.kcalOut - d.storedKcal)).toBeLessThan(d.kcalOut * 0.01);
      expect(d.outputs.energy_unplaced_kcal).toBeCloseTo(0, 6);
      expect(d.waterInKg - d.metabolicWaterKg).toBeCloseTo(foodWater + 6 * FIXTURE.drinkKg, 9); // metabolic water: physiology (2540)
      water += d.waterInKg - d.waterOutKg;
      expect(d.waterKg).toBeCloseTo(water, 8);
      expect(d.waterDeficitKg).toBeCloseTo(FIXTURE.waterKg - water, 8);
      balance += d.kcalIn - d.kcalOut;
      // Mass change = fat + dry glycogen + the water ledger's change.
      const glycogenKg = (Number(d.outputs.glycogen_g) - initialGlycogen) / 1000, fatKg = (balance - (Number(d.outputs.glycogen_g) - initialGlycogen) * glyEnergy) / fatDensity;
      // (2623) Bound water is included in the single water ledger, so count it once.
      expect(d.massKg - FIXTURE.massKg).toBeCloseTo(fatKg + glycogenKg - d.waterDeficitKg, 8);
      expect(d.outputs.water_change_kg).toBeTypeOf('number');
      debt += need - ((FIXTURE.watchDays as readonly number[]).includes(d.day) ? 4 : 6);
      expect(d.outputs.sleep_debt).toBeCloseTo(debt, 9);
      const band = libraryTable('physiology', 'sleep_debt').find(r => {
        const label = String(r['Cumulative debt (hours below 8 h)']);
        const bounds = label.match(/[\d.]+/g)!.map(Number);
        return debt >= bounds[0]! && (bounds.length === 1 || debt < bounds[1]!);
      })!;
      expect(d.outputs.sleep_debt_row).toBe(band.id);
      expect(d.outputs.alertness).toBeCloseTo(Number(band['Alertness multiplier']) * circadian, 12);
      expect(d.circuits['neurology.circuits.attention']).toBeTypeOf('number');
      for (const v of Object.values(d.outputs)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
    expect(run.body.mass).toBeLessThan(FIXTURE.massKg);
    expect(run.w.trace.transfers.every(t => Number.isFinite(t.amount))).toBe(true);
  }, 20_000);

  it('keeps the sodium and magnesium pools above their stage-1 threshold all week, and the sodium ledger closes', () => {
    const run = runHumanWeek();
    for (const id of ['sodium', 'magnesium']) {
      const spec = poolSpec(id), unitKg = spec.fullMan / (Number(run.days[0]!.outputs[`pool_${id}`]) / Number(run.days[0]!.outputs[`pool_frac_${id}`]));
      expect(spec.thresholdKg).not.toBeNull();
      for (const d of run.days) {
        expect(Number(d.outputs[`pool_${id}`]) * unitKg).toBeGreaterThanOrEqual(spec.thresholdKg!);
        expect(d.outputs[`deficiency_${id}`]).toBe(0);
      }
    }
    // sodium: food in = daily use (1.5 g + 1 g per litre of sweat, metabolism) + excreta over the full pool + the pool's change
    const spec = poolSpec('sodium'), q = 'mass:nutrient:sodium', t = run.w.trace.transfers.filter(x => x.quantity === q);
    const sum = (f: (x: (typeof t)[number]) => boolean) => t.filter(f).reduce((a, x) => a + x.amount, 0);
    const fed = sum(x => x.from === 'food' && x.to === 'body'), spent = sum(x => x.to === 'metabolism'), excreted = sum(x => x.to === 'excreta');
    const finalKg = poolLevel(run.w, 'body', 'sodium') * (spec.fullMan / (Number(run.days[6]!.outputs.pool_sodium) / Number(run.days[6]!.outputs.pool_frac_sodium)));
    expect(fed).toBeGreaterThan(0);
    expect(fed).toBeCloseTo(spent + excreted + (finalKg - spec.fullMan), 12);
    expect(spent).toBeCloseTo(7 * spec.useFixed + spec.sweatPerL * Number(run.body.props.sweat_kg), 12);
  }, 20_000);

  it('a fast shows the early glycogen and bound water drop of the library rows', () => {
    const w = new World(defaultRegistry()), sch = new Scheduler();
    const cap = numberIn(row('nutrition', 'body_composition', 'glycogen').Rule, /up to ([\d.]+) g/);
    const body: Component = { id: 'body', kind: 'body', material: 'flesh', mass: 70, temperatureC: 37, contents: [], ports: [],
      props: { fat_kg: 15, intake_kcal: 0, expenditure_kcal: 0 }, condition: { capability: 1, control: 1, accuracy: 1 } };
    w.registry.addComponent(body);
    sch.add({ name: 'fast', every: 1, step(_world, dt) { body.props.expenditure_kcal! += 2000 * dt / 86400; } });
    sch.add(nutritionProcess('body', { every: 1, dayStartH: 0 }));
    sch.run(w, 86400, 3600);
    expect(body.props.glycogen_g).toBeLessThan(cap); // the store is drawn first
    const lostG = cap - body.props.glycogen_g!;
    expect(lostG).toBeGreaterThan(0);
    // bound water leaves with the glycogen: the day's mass loss is fat + glycogen + its bound water
    const fatLost = 15 - body.props.fat_kg!;
    expect(70 - body.mass).toBeCloseTo(fatLost + lostG / 1000 * (1 + (GLYCOGEN_BOUND_WATER ?? 0)), 9);
    expect(w.trace.failed()).toEqual([]);
  });

  it('matches the shut-door box-model peak for one sleeper in the same 40 m3 room', () => {
    // Controlled isothermal replay isolates the analytic box solution from changing heat and sweat.
    const w = new World(defaultRegistry()), sch = new Scheduler(), temperatureC = FIXTURE.minC;
    const comp = (id: string, kind: string): Component => ({ id, kind, material: kind === 'body' ? 'flesh' : 'air_mass',
      mass: FIXTURE.massKg, temperatureC, contents: [], ports: [], props: {}, condition: { capability: 1, control: 1, accuracy: 1 } });
    const room = comp('room', 'room'), body = comp('body', 'body');
    room.props = { volume_m3: FIXTURE.volumeM3, ach: DOOR.shut, pressurePa: P_SEA_LEVEL };
    room.contents = airContents(FIXTURE.volumeM3, P_SEA_LEVEL, temperatureC);
    w.registry.addComponent(room); w.registry.addComponent(body);
    for (const gas of ['water', 'o2', 'co2', 'n2']) w.conserve(gas, ['room'], 1e-9);
    const n0 = room.contents.reduce((s, x) => s + x.mass / w.registry.substance(x.substance).molarMass, 0);
    const c0 = w.registry.contentMass(room, 'co2') / w.registry.substance('co2').molarMass;
    const vo2Factor = numberIn(row('physiology', 'ventilation', 'oxygen-demand')['Formula or value'], /VO2 = ([\d.]+)/);
    const rq = numberIn(row('gasdynamics', 'box_model', 'oxygen-and-carbon-dioxide-move-together').Formula, /produced \/ ([\d.]+)/);
    const consumption = litresToMoles(vo2Factor * metOf('sleeping') * FIXTURE.massKg / 1000, P_SEA_LEVEL, temperatureC);
    const production = consumption * rq, minutes = 6 * 60, k = DOOR.shut / 60;
    const integral = (1 - Math.exp(-k * minutes)) / k;
    const expectedPpm = (c0 + production * integral) / (n0 + (production - consumption) * integral) * 1e6;
    sch.add(roomAirProcess('room')); sch.add(breathingProcess('body', 'room', { met: metOf('sleeping'), every: 1 }));
    let peak = 0;
    sch.add({ name: 'peak', every: 1, step() { peak = Math.max(peak, roomGasFraction(w, room, 'co2') * 1e6); } });
    sch.run(w, minutes * 60, FIXTURE.stepS);
    expect(Math.abs(peak - expectedPpm) / expectedPpm).toBeLessThan(0.01); // minute Euler integration vs continuous solution
    expect(w.trace.failed()).toEqual([]);
  });
});
