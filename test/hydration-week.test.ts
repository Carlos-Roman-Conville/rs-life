import { describe, expect, it } from 'vitest';
import { runHumanWeek, FIXTURE } from '../examples/human-week.ts';
import { libraryMeta, libraryRow, libraryTable } from '../src/library.ts';
import { World } from '../src/world.ts';
import { Scheduler } from '../src/scheduler.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { bodyArea, bodyOutputs, metOf, physiologyProcess } from '../src/physiology.ts';
import { wbgtBom } from '../src/environment.ts';
import type { Transfer } from '../src/trace.ts';
import { allCrises, crisesOf, declareDeath } from '../src/crisis.ts';

const MAN = { height_cm: 175, age_y: 30, male: 1 };
const water = (ts: readonly Transfer[], pred: (t: Transfer) => boolean) =>
  ts.filter(t => t.quantity === 'mass:water' && pred(t)).reduce((a, t) => a + t.amount, 0);
// the hydration table's source (PHY-HYD): "sweat rates 0.5 to over 2.5 L/h in heat"
const [sweatLo, sweatHi] = /sweat rates ([\d.]+) to over ([\d.]+) L\/h/.exec(libraryMeta('physiology', 'hydration').source)!.slice(1).map(Number) as [number, number];

describe('hydration across the checkpoint-1 week (ISO 7730 sweat, breath and skin water; Guyton urine)', () => {
  it('keeps the 3 kg/day drinker inside the hydration table\'s mild band at every step, water conserved each step', () => {
    // mild: the table's rows up to "1 to 2" (thirst; Endurance pool x0.95), under the upper bound of that row
    const mild = libraryRow('physiology', 'hydration', 'physiology.hydration.1-to-2');
    const mildTopPct = Number(/to ([\d.]+)$/.exec(String(mild['Deficit (% body mass)']))![1]);
    const mildRows = libraryTable('physiology', 'hydration').filter(r => Number(/^([\d.]+)/.exec(String(r['Deficit (% body mass)']))?.[1]) < mildTopPct).map(r => r.id);
    let steps = 0, worstPct = -Infinity;
    const rows = new Set<unknown>();
    const run = runHumanWeek((_w, body, _room, sch) => sch.add({ name: 'hydration-watch', every: 1, step() {
      const out = bodyOutputs(body); steps++;
      worstPct = Math.max(worstPct, out.water_deficit_pct as number); rows.add(out.hydration_row);
    } }));
    expect(steps).toBe(FIXTURE.days * 86400 / FIXTURE.stepS);
    expect(worstPct).toBeLessThan(mildTopPct);
    expect([...rows].every(r => mildRows.includes(r as string))).toBe(true);
    // body and body-plus-room water are enrolled by the week (World.conserve, 1e-9) and checked after every step
    const waterChecks = run.w.trace.checks.filter(c => c.quantity === 'mass:water');
    expect(waterChecks.length).toBeGreaterThanOrEqual(2 * steps);
    expect(run.w.trace.failed()).toEqual([]);
    // every day has each outflow, and urine is at least the obligatory 600 mOsm / 1,200 mOsm/L = 0.5 L
    for (let d = 0; d < FIXTURE.days; d++) {
      const day = run.w.trace.transfers.filter(t => t.t >= d * 86400 && t.t < (d + 1) * 86400);
      for (const note of ['sweat', 'skin diffusion', 'breath']) expect(water(day, t => t.from === 'body' && t.note === note)).toBeGreaterThan(0);
      expect(water(day, t => t.note === 'urine')).toBeGreaterThanOrEqual(600 / 1200 - 1e-9);
      const lost = water(day, t => t.from === 'body'), drunk = water(day, t => t.to === 'body');
      expect(run.days[d]!.waterOutKg).toBeCloseTo(lost, 9);
      expect(run.days[d]!.waterInKg).toBeCloseTo(drunk, 9);
    }
    expect(run.days.at(-1)!.waterKg).toBeCloseTo(FIXTURE.waterKg - run.days.at(-1)!.waterDeficitKg, 8);
  }, 20_000);

  it('dehydrates a hard worker in a hot room at a sweat rate inside the hydration table\'s band', () => {
    const reg = defaultRegistry(), w = new World(reg), sch = new Scheduler();
    // a large room holds 32 C and 50% (the workshop's air); its WBGT is the environment module's BoM form
    const room: Component = { id: 'room', kind: 'room', material: 'air_mass', mass: 1e6, temperatureC: 32, contents: [], ports: [],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: { rh: 0.5, wbgt_c: wbgtBom(32, 50) } };
    const body: Component = { id: 'body', kind: 'body', material: 'flesh', mass: 70, temperatureC: 37, ports: [],
      contents: [{ substance: 'water', phase: 'liquid', mass: 40 }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { ...MAN } };
    reg.addComponent(room); reg.addComponent(body);
    w.conserve('water', ['body', 'room'], 1e-9);
    sch.add(physiologyProcess('body', 'room', { every: 1, met: metOf('smithing') }));
    sch.run(w, 3600, 10);
    const out = bodyOutputs(body);
    expect(out.core_state).toBe('normal'); // under 38.5 C: the rate is the heat balance's, not the core row's maximum
    const sweatLph = water(w.trace.transfers, t => t.note === 'sweat');
    const lossLph = water(w.trace.transfers, t => t.from === 'body');
    expect(sweatLph).toBeGreaterThanOrEqual(sweatLo);
    expect(sweatLph).toBeLessThanOrEqual(sweatHi);
    const madeKg = water(w.trace.transfers, t => t.note === 'metabolic water');
    expect(madeKg).toBeGreaterThan(0);
    expect(lossLph - madeKg).toBeGreaterThanOrEqual(sweatLo); // the net dehydration rate, one hour with nothing drunk
    expect(lossLph - madeKg).toBeLessThanOrEqual(sweatHi);
    expect(out.water_deficit_pct).toBeCloseTo((lossLph - madeKg) / 70 * 100, 9);
    expect(w.trace.failed()).toEqual([]);
  });

  it('a body given no water reaches the incapacitated and death-risk bands, each with a crisis, and never dies silently', () => {
    const reg = defaultRegistry(), w = new World(reg), sch = new Scheduler();
    const room: Component = { id: 'room', kind: 'room', material: 'air_mass', mass: 1e6, temperatureC: 32, contents: [], ports: [],
      condition: { capability: 1, control: 1, accuracy: 1 }, props: { rh: 0.5, wbgt_c: wbgtBom(32, 50) } };
    const body: Component = { id: 'body', kind: 'body', material: 'flesh', mass: 70, temperatureC: 37, ports: [],
      contents: [{ substance: 'water', phase: 'liquid', mass: 40 }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { ...MAN } };
    reg.addComponent(room); reg.addComponent(body);
    w.conserve('water', ['body', 'room'], 1e-9);
    sch.add(physiologyProcess('body', 'room', { every: 1, met: metOf('smithing') }));
    // the rows that say work stops or death, read from the table: "incapacitated" (6 to 10) and "death risk per hour" (over 10)
    const stops = libraryTable('physiology', 'hydration').filter(r => /incapacitated|death/.test(String(r['Effect in the model'])));
    expect(stops.map(r => r.id)).toEqual(['physiology.hydration.6-to-10', 'physiology.hydration.over-10']);
    const loOf = (id: unknown) => Number(/^(?:over )?([\d.]+)/.exec(String(libraryRow('physiology', 'hydration', String(id))['Deficit (% body mass)']))![1]);
    const reached = new Map<string, number>(); // row id -> the hour its crisis was first seen
    let hours = 0;
    while (hours < 24 && !reached.has('physiology.hydration.over-10')) {
      sch.run(w, 600, 10); hours += 1 / 6;
      const out = bodyOutputs(body), pct = out.water_deficit_pct as number;
      for (const r of stops) {
        const open = crisesOf(w, 'body').find(c => c.cause === r.id);
        // a crisis exists exactly when the deficit is in or past the row's band; its source names the row
        expect(open !== undefined).toBe(pct >= loOf(r.id));
        if (open) { reached.set(String(r.id), reached.get(String(r.id)) ?? hours); expect(open.kind).toBe('crisis'); expect(open.source).toContain(String(r.id)); }
      }
      // work capacity follows the row: 1 where the row says none, 0 where it says incapacitated or death, null where it gives no work figure
      const effect = String(libraryRow('physiology', 'hydration', String(out.hydration_row))['Effect in the model']);
      expect(out.work_capacity_hydration).toBe(effect === 'none' ? 1 : /incapacitated|death/.test(effect) ? 0 : null);
      expect(body.props).not.toHaveProperty('dead'); // the engine kills no one
    }
    expect([...reached.keys()]).toEqual(stops.map(r => r.id)); // the 6 to 10 crisis opened first, then the over-10
    expect(bodyOutputs(body).work_capacity_hydration).toBe(0);
    expect(allCrises(w)).toHaveLength(2);
    // a host that decides the body died must find the crisis in the trace; without one the engine refuses
    expect(() => declareDeath(new World(defaultRegistry()), 'body', 'x')).toThrow();
    declareDeath(w, 'body', 'physiology.hydration.over-10');
    expect(body.props.dead).toBe(1);
    expect(w.trace.failed()).toEqual([]);
  }, 60_000);

  it('takes the skin area from DuBois when the host gives height, and refuses a body with neither area nor height', () => {
    const body = { mass: 70, props: { height_cm: 175 } } as unknown as Component;
    expect(bodyArea(body)).toBeCloseTo(1.85, 2); // DuBois and DuBois 1916 for 70 kg, 175 cm
    expect(bodyArea({ mass: 70, props: {} } as unknown as Component)).toBeNull();
  });
});
