/** Checkpoint 1: synthetic fixed day 2026-10-29, repeated seven times; no game climate.
 * Host fixtures (not fitted constants): 70 kg, 175 cm, 30 y male, 15 kg fat,
 * 40 kg initial water; 40 m3 room. Day 05:00–05:00. Sleep 23–05,
 * except nights 3 and 5: watch 23–01, sleep 01–05 (continuous, no split penalty).
 * Work 08–12 and 13–17 cycles through library MET 3, 3.3, 4.5, 6.
 * Door shut 23–05; ACH 0.2/2 from gasdynamics.box_model.ventilation-events.
 * Weather fixture: 18 C at 05, 24 C at 15, legacy outside water mixing ratio, calm, dry, 12 h daylight.
 * Meals and drinks are prescribed supplies, not appetite or water-need models. The supper carries the ship's salt beef
 * and dried pease so the sodium and magnesium pools have a ration to be fed from; an unsalted diet cannot cover the table's use.
 */
import { World } from '../src/world.ts';
import { Scheduler } from '../src/scheduler.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { bodyOutputs, physiologyProcess, ingest, type ScheduleEntry } from '../src/physiology.ts';
import { eatMeal, stockPools, pooledNutrients, type MealItem } from '../src/nutrition.ts';
import { nutritionProcess } from '../src/nutrition.ts';
import { airContents, breathingProcess, roomAirProcess, roomGasFraction } from '../src/atmosphere.ts';
import { diurnalC, environmentProcess, isDay } from '../src/environment.ts';
import { neuroCircuits, neurologyProcess } from '../src/neurology.ts';
import { libraryRow } from '../src/library.ts';
import { P_SEA_LEVEL, airDensity, C_TO_K, KCAL_J } from '../src/physics.ts';

export const FIXTURE = { date: '2026-10-29', days: 7, stepS: 60, massKg: 70, waterKg: 40,
  fatKg: 15, volumeM3: 40, minC: 18, maxC: 24, minHour: 5, maxHour: 15, daylightH: 12,
  watchDays: [3, 5], drinkKg: 0.5, drinkHours: [7, 10, 12, 15, 18, 21] } as const;
export const MEALS: Record<number, MealItem[]> = {
  7: [{ food: 'nutrition.foods.oatmeal-dry', kg: 0.15 }, { food: 'nutrition.foods.milk-goat', kg: 0.25 }],
  12: [{ food: 'nutrition.foods.bread-fresh', kg: 0.3 }, { food: 'nutrition.foods.cheese-suffolk-or-cheddar', kg: 0.1 }, { food: 'nutrition.foods.oranges', kg: 0.2 }],
  18: [{ food: 'nutrition.foods.rice-husked', kg: 0.2 }, { food: 'nutrition.foods.fresh-fish-60-dolphin-fish-bonito-snapper', kg: 0.2 }, { food: 'nutrition.foods.onions', kg: 0.1 },
    { food: 'nutrition.foods.salt-beef-as-issued', kg: 0.1 }, { food: 'nutrition.foods.pease-dried', kg: 0.25 }],
};
const ventilation = String(libraryRow('gasdynamics', 'box_model', 'gasdynamics.box_model.ventilation-events').Example);
const ach = /from ([\d.]+) to ([\d.]+) ACH/.exec(ventilation)!;
export const DOOR = { shut: Number(ach[1]), open: Number(ach[2]) };
const clockHour = (t: number) => (5 + t / 3600) % 24;
const component = (id: string, kind: string, mass: number, temperatureC: number): Component => ({
  id, kind, mass, temperatureC, material: kind === 'body' ? 'flesh' : 'air_mass', contents: [], ports: [],
  condition: { capability: 1, control: 1, accuracy: 1 }, props: {},
});
function schedule(watch: boolean): ScheduleEntry[] {
  const work = ['helm-in-a-seaway', 'cooking-at-the-galley-fire', 'carpentry-caulking-coopering', 'smithing'];
  return [
    ...(watch ? [{ fromH: 23, toH: 1, activity: 'standing-watch-still' }] : []),
    { fromH: watch ? 1 : 23, toH: 5, activity: 'sleeping', sleepQuality: 1 },
    ...[8, 9, 10, 11, 13, 14, 15, 16].map((h, i) => ({ fromH: h, toH: h + 1, activity: work[i % work.length]! })),
  ];
}
/** Optional checkpoint processes run after the week physiology and before its audit. */
export function runHumanWeek(extend?: (w: World, body: Component, room: Component, sch: Scheduler) => void) {
  const started = performance.now(), w = new World(defaultRegistry()), sch = new Scheduler();
  const body = component('body', 'body', FIXTURE.massKg, 37);
  body.props = { height_cm: 175, age_y: 30, male: 1, fat_kg: FIXTURE.fatKg };
  body.contents = [{ substance: 'water', phase: 'liquid', mass: FIXTURE.waterKg }];
  const room = component('room', 'room', airDensity(P_SEA_LEVEL, FIXTURE.minC + C_TO_K) * FIXTURE.volumeM3, FIXTURE.minC);
  room.props = { volume_m3: FIXTURE.volumeM3, pressurePa: P_SEA_LEVEL, ach: DOOR.open };
  room.contents = airContents(FIXTURE.volumeM3, P_SEA_LEVEL, FIXTURE.minC);
  w.registry.addComponent(body); w.registry.addComponent(room); stockPools(w, 'body');
  w.conserve('water', ['body'], 1e-9); w.conserve('water', ['body', 'room'], 1e-9);
  for (const id of pooledNutrients()) w.conserve(`nutrient:${id}`, ['body'], 1e-9);
  for (const gas of ['o2', 'co2', 'n2']) w.conserve(gas, ['room'], 1e-9);
  w.conserveElements(['room'], 1e-9); // body oxidation stoichiometry is explicitly unsupported (FLAGS).
  const opts = { every: 1, clockH0: 5, dayStartH: 5 };
  const normal = physiologyProcess('body', 'room', { ...opts, met: 1.5, schedule: schedule(false) });
  const watch = physiologyProcess('body', 'room', { ...opts, met: 1.5, schedule: schedule(true) });
  // Declared dependency order: supplies/door/weather -> room air -> environment -> physiology ->
  // breathing -> nutrition -> neurology -> audit. World.afterStep checks the material ledgers.
  sch.add({ name: 'circumstances', every: 1, step(world) {
    const h = clockHour(world.t), day = Math.floor(world.t / 86400) + 1;
    const watching = (FIXTURE.watchDays as readonly number[]).includes(day);
    body.props.asleep = (h < 5 || h >= 23) && !(watching && (h >= 23 || h < 1)) ? 1 : 0;
    room.props.ach = h < 5 || h >= 23 ? DOOR.shut : DOOR.open;
    world.env.outsideC = diurnalC(h, FIXTURE.maxC, FIXTURE.minC, FIXTURE.maxHour, FIXTURE.minHour);
    if (world.t % 3600 === 0) {
      if (MEALS[h]) eatMeal(world, 'body', MEALS[h]!);
      if ((FIXTURE.drinkHours as readonly number[]).includes(h)) ingest(world, 'body', { waterKg: FIXTURE.drinkKg });
    }
  } });
  sch.add(roomAirProcess('room'));
  sch.add(environmentProcess('room', 'open-deck-day', world => ({ airC: room.temperatureC,
    rhPct: room.props.rh * 100, windMS: 0, sun: isDay(clockHour(world.t), FIXTURE.daylightH), rain: false,
    daylightH: FIXTURE.daylightH, hour: clockHour(world.t) }), 1));
  sch.add({ name: 'physiology', every: 1, step(world, dt) {
    ((FIXTURE.watchDays as readonly number[]).includes(Math.floor(world.t / 86400) + 1) ? watch : normal).step(world, dt);
  } });
  sch.add(breathingProcess('body', 'room', { every: 1 }));
  sch.add(nutritionProcess('body', opts)); sch.add(neurologyProcess('body', opts));
  extend?.(w, body, room, sch);
  let peak = 0, cursor = 0, pendingKcal = 0;
  let energyIn = 0, energyOut = 0, stored = 0, waterIn = 0, waterOut = 0, metabolicWater = 0;
  const waterOutBy: Record<string, number> = {};
  const days: { day: number; kcalIn: number; kcalOut: number; storedKcal: number; massKg: number;
    waterInKg: number; metabolicWaterKg: number; waterOutKg: number; waterOutByKg: Record<string, number>; waterKg: number; waterDeficitKg: number;
    roomCo2PeakPpm: number; outputs: ReturnType<typeof bodyOutputs>; circuits: Record<string, number | string | null> }[] = [];
  sch.add({ name: 'audit', every: 1, step(world, dt) {
    const out = bodyOutputs(body);
    for (const x of world.trace.transfers.slice(cursor)) {
      if (x.quantity === 'energy:chemical') {
        if (x.to === 'body') { energyIn += x.amount / KCAL_J; pendingKcal += x.amount / KCAL_J; }
        if (x.from === 'body') { energyOut += x.amount / KCAL_J; pendingKcal -= x.amount / KCAL_J; }
      }
      if (x.quantity === 'energy:stored') {
        const d = (x.to === 'body' ? 1 : -1) * x.amount / KCAL_J; stored += d; pendingKcal -= d;
      }
      if (x.quantity === 'mass:water') {
        if (x.to === 'body') waterIn += x.amount;
        if (x.to === 'body' && x.from === 'oxidation') metabolicWater += x.amount;
        if (x.from === 'body') { waterOut += x.amount; waterOutBy[x.note ?? x.to] = (waterOutBy[x.note ?? x.to] ?? 0) + x.amount; }
      }
    }
    cursor = world.trace.transfers.length;
    world.trace.check(world.t, 'energy:daily-and-pending', body.props.intake_kcal - body.props.expenditure_kcal,
      (body.props.nut_stored_kcal ?? 0) + pendingKcal, 1e-6);
    world.trace.check(world.t, 'mass:body:week', FIXTURE.massKg + world.trace.into(body.id, 'mass:body')
      - world.trace.outOf(body.id, 'mass:body'), body.mass, 1e-6);
    for (const c of [body, room]) {
      if (!Number.isFinite(c.mass) || !Number.isFinite(c.temperatureC)) throw new Error('nonfinite component');
      for (const v of Object.values(bodyOutputs(c))) if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('nonfinite output');
    }
    peak = Math.max(peak, roomGasFraction(world, room, 'co2') * 1e6);
    if ((world.t + dt) % 86400 === 0) {
      days.push({ day: days.length + 1, kcalIn: energyIn, kcalOut: energyOut, storedKcal: stored, massKg: body.mass,
        waterInKg: waterIn, metabolicWaterKg: metabolicWater, waterOutKg: waterOut, waterOutByKg: { ...waterOutBy },
        waterKg: world.registry.contentMass(body, 'water'),
        waterDeficitKg: body.props.waterDeficitKg, roomCo2PeakPpm: peak, outputs: { ...out },
        circuits: Object.fromEntries(neuroCircuits().map(c => [c.rowId, out[c.id]!])) });
      energyIn = energyOut = stored = waterIn = waterOut = metabolicWater = peak = 0;
      for (const k of Object.keys(waterOutBy)) delete waterOutBy[k];
    }
  } });
  sch.run(w, FIXTURE.days * 86400, FIXTURE.stepS);
  if (w.trace.failed().length) throw new Error(w.trace.notes.filter(n => n.text.startsWith('CONSERVATION FAILED')).slice(0, 3).map(n => n.text).join('\n'));
  return { w, body, room, days, elapsedMs: performance.now() - started, order: sch.processes.map(p => p.name) };
}

// Node's direct-entry flag avoids running the week when imported by the test.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const run = runHumanWeek();
  console.log('Checkpoint 1: synthetic day', FIXTURE.date, JSON.stringify(FIXTURE));
  console.log('Order:', run.order.join(' -> '));
  console.log('day kcal_in kcal_out stored_delta mass_kg water_deficit_kg sleep_debt alertness core_C room_CO2_peak_ppm');
  for (const d of run.days) {
    console.log([d.day, d.kcalIn, d.kcalOut, d.storedKcal, d.massKg, d.waterDeficitKg,
      d.outputs.sleep_debt, d.outputs.alertness, d.outputs.core_c, d.roomCo2PeakPpm].map(v => typeof v === 'number' ? v.toFixed(3) : v).join(' '));
    console.log('water', JSON.stringify({ in_kg: +d.waterInKg.toFixed(3), metabolic_kg: +d.metabolicWaterKg.toFixed(3), out_kg: +d.waterOutKg.toFixed(3),
      ...Object.fromEntries(Object.entries(d.waterOutByKg).map(([k, v]) => [`${k.replace(' ', '_')}_kg`, +v.toFixed(3)])), deficit_pct: +(d.waterDeficitKg / FIXTURE.massKg * 100).toFixed(3), hydration_row: d.outputs.hydration_row }));
    console.log('nutrients', JSON.stringify(Object.fromEntries(Object.entries(d.outputs).filter(([k]) => k.startsWith('deficiency_') || k.startsWith('pool_')))));
    console.log('circuits', JSON.stringify(d.circuits));
  }
  console.log(`${run.w.trace.transfers.length} transfers; ${run.w.trace.checks.length} checks; 0 failures; ${run.elapsedMs.toFixed(0)} ms`);
}
