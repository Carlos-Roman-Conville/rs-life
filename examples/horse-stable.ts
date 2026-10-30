/** Independence checkpoint: a horse in a 60 m3 stable for thirty days, from the library alone, no game code.
 * Species columns: `anatomy.species` "A horse (example)" (blood volume, cardiac output, set point, Kleiber RMR).
 * Host fixtures (not fitted constants): 500 kg, water share of the human fixture, ration = 1 x the species' RMR fed
 * hourly (the library has no hay or oats row and no horse ration), water drunk hourly to the deficit, door open
 * (gasdynamics 2 ACH), the human-week weather extrema. Work: two hours a day are scheduled, but the library gives
 * no horse MET, so they run at rest (workMet null; FLAGS). A stable-hand is not simulated (hazards off).
 */
import { World } from '../src/world.ts';
import { Scheduler } from '../src/scheduler.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { bodyOutputs, physiologyProcess, ingest } from '../src/physiology.ts';
import { airContents, breathingProcess, roomAirProcess, roomGasFraction, respiratoryState, respiratoryProfile } from '../src/atmosphere.ts';
import { anatomyProcess, assembleBody, speciesProfile, speciesRmr } from '../src/anatomy.ts';
import { fatKcalPerKg } from '../src/nutrition.ts';
import { P_SEA_LEVEL, airDensity, C_TO_K, KCAL_J } from '../src/physics.ts';
import { diurnalC } from '../src/environment.ts';
import { DOOR, FIXTURE as HUMAN } from './human-week.ts';

export const STABLE = { days: 30, stepS: 60, massKg: 500, volumeM3: 60, workHours: 2, workStartH: 8,
  minC: HUMAN.minC, maxC: HUMAN.maxC, minHour: HUMAN.minHour, maxHour: HUMAN.maxHour } as const;
const COLUMN = 'A horse (example)' as const;
const component = (id: string, kind: string, mass: number, temperatureC: number): Component => ({
  id, kind, mass, temperatureC, material: kind === 'body' ? 'flesh' : 'air_mass', contents: [], ports: [],
  condition: { capability: 1, control: 1, accuracy: 1 }, props: {},
});
/** The horse's rows as the profile gives them, for the test and the ledger. */
export function horseRows() {
  const profile = speciesProfile(COLUMN);
  return { profile, rmrKcalDay: speciesRmr(profile, STABLE.massKg)!, heartOutputLMin: profile.cardiacOutputLMinKg * STABLE.massKg,
    bloodMl: profile.bloodMlKg * STABLE.massKg };
}

export function runHorseStable(durationDays: number = STABLE.days) {
  const started = performance.now(), w = new World(defaultRegistry()), sch = new Scheduler();
  const { profile, rmrKcalDay, heartOutputLMin } = horseRows();
  const body = component('horse', 'body', STABLE.massKg, profile.temperatureC);
  // No horse skin-area row (FLAGS, independence): the former human stand-in, 1.9 m2 and h 10, is declared here, not in physiology.
  body.props = { area_m2: 1.9, h: 10 };
  body.contents = [{ substance: 'water', phase: 'liquid', mass: STABLE.massKg * HUMAN.waterKg / HUMAN.massKg }];
  const room = component('stable', 'room', airDensity(P_SEA_LEVEL, STABLE.minC + C_TO_K) * STABLE.volumeM3, STABLE.minC);
  room.props = { volume_m3: STABLE.volumeM3, pressurePa: P_SEA_LEVEL, ach: DOOR.open };
  room.contents = airContents(STABLE.volumeM3, P_SEA_LEVEL, STABLE.minC);
  w.registry.addComponent(body); w.registry.addComponent(room);
  const assembly = assembleBody(w, 'horse', profile);
  w.conserve('water', ['horse'], 1e-9); w.conserve('water', ['horse', 'stable'], 1e-9);
  for (const gas of ['o2', 'co2', 'n2']) w.conserve(gas, ['stable'], 1e-9);
  w.conserveElements(['stable'], 1e-9);
  const clockHour = (t: number) => (5 + t / 3600) % 24;
  const standIn = respiratoryProfile(); // the library has only the human respiratory row: per-kg stand-in (FLAGS)
  sch.add({ name: 'circumstances', every: 1, step(world) {
    world.env.outsideC = diurnalC(clockHour(world.t), STABLE.maxC, STABLE.minC, STABLE.maxHour, STABLE.minHour);
    if (world.t % 3600 === 0) {
      ingest(world, 'horse', { kcal: rmrKcalDay / 24 }, 'feed');
      const deficit = body.props.waterDeficitKg ?? 0;
      if (deficit > 0) ingest(world, 'horse', { waterKg: deficit }, 'drink');
    }
  } });
  sch.add(roomAirProcess('stable'));
  sch.add(physiologyProcess('horse', 'stable', { every: 1, clockH0: 5, dayStartH: 5, met: 1,
    rmrFormula: String(profile.fields['anatomy.species.rmr-formula']) }));
  sch.add(breathingProcess('horse', 'stable', { every: 1, profile: standIn }));
  const organs = anatomyProcess(assembly);
  sch.add({ name: 'organs-hourly', every: 1, step(world, dt) { if ((world.t + dt) % 3600 === 0) organs.step(world, 3600); } });

  let cursor = 0, energyIn = 0, energyOut = 0, waterIn = 0, waterOut = 0, peak = 0, metHours = 0, balance = 0;
  const days: { day: number; kcalIn: number; kcalOut: number; storedKcal: number; massKg: number; waterInKg: number;
    waterOutKg: number; waterKg: number; co2PeakPpm: number; ventilationLMin: unknown; heartOutputLMin: number;
    organsUnderOne: Record<string, number>; organsUnknown: string[]; fatigueMetHours: number; workMet: null;
    muscleFatigue: null; outputs: Record<string, number | string | null> }[] = [];
  sch.add({ name: 'audit', every: 1, step(world, dt) {
    for (const x of world.trace.transfers.slice(cursor)) {
      if (x.quantity === 'energy:chemical') {
        if (x.to === 'horse') energyIn += x.amount / KCAL_J;
        if (x.from === 'horse') energyOut += x.amount / KCAL_J;
      }
      if (x.quantity === 'mass:water') {
        if (x.to === 'horse') waterIn += x.amount;
        if (x.from === 'horse') waterOut += x.amount;
      }
    }
    cursor = world.trace.transfers.length;
    const out = bodyOutputs(body);
    for (const c of [body, room]) if (!Number.isFinite(c.mass) || !Number.isFinite(c.temperatureC)) throw new Error('nonfinite component');
    for (const v of Object.values(out)) if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('nonfinite output');
    metHours += (out.met as number) * dt / 3600;
    peak = Math.max(peak, roomGasFraction(world, room, 'co2') * 1e6);
    if ((world.t + dt) % 86400 === 0) {
      const stored = energyIn - energyOut;
      balance += stored;
      const under: Record<string, number> = {}, unknown: string[] = [];
      for (const [id, s] of Object.entries(assembly.organs)) {
        if (s.function === null) unknown.push(id); else if (s.function < 1) under[id] = s.function;
      }
      days.push({ day: days.length + 1, kcalIn: energyIn, kcalOut: energyOut, storedKcal: stored,
        massKg: STABLE.massKg + balance / fatKcalPerKg(), waterInKg: waterIn, waterOutKg: waterOut,
        waterKg: world.registry.contentMass(body, 'water'), co2PeakPpm: peak, ventilationLMin: out.ventilation_l_min,
        heartOutputLMin, organsUnderOne: under, organsUnknown: unknown, fatigueMetHours: metHours, workMet: null,
        muscleFatigue: null, outputs: { ...out } });
      energyIn = energyOut = waterIn = waterOut = peak = metHours = 0;
    }
  } });
  sch.run(w, durationDays * 86400, STABLE.stepS);
  if (w.trace.failed().length) throw new Error(w.trace.notes.filter(n => n.text.startsWith('CONSERVATION FAILED')).slice(0, 3).map(n => n.text).join('\n'));
  const restingVentilation = respiratoryState({ pressureMmHg: P_SEA_LEVEL * 0.00750062, o2Frac: 0.2095, co2Frac: 0.0004, coPpm: 0 }, 1, STABLE.massKg, standIn).ventilationLMin;
  return { w, sch, body, room, assembly, days, restingVentilation, elapsedMs: performance.now() - started };
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const run = runHorseStable();
  console.log('Independence: horse,', JSON.stringify(STABLE), JSON.stringify(horseRows().profile.fields['anatomy.species.rmr-formula']));
  console.log('FLAGS: no hay/oats food rows (fed by kcal+water); no horse MET (work at rest, workMet null); no horse respiratory/Hb/area/muscle rows (human per-kg stand-in; circulation and muscle fatigue off).');
  console.log('day kcal_in kcal_out stored mass_kg water_in_kg water_kg co2_peak_ppm vent_l_min heart_l_min fatigue_met_h organs<1 unknown');
  for (const d of run.days) console.log([d.day, d.kcalIn, d.kcalOut, d.storedKcal, d.massKg, d.waterInKg, d.waterKg, d.co2PeakPpm,
    d.ventilationLMin, d.heartOutputLMin, d.fatigueMetHours, JSON.stringify(d.organsUnderOne), d.organsUnknown.length]
    .map(v => typeof v === 'number' ? v.toFixed(3) : v).join(' '));
  console.log(`${run.w.trace.transfers.length} transfers; ${run.w.trace.checks.length} checks; 0 failures; ${run.elapsedMs.toFixed(0)} ms`);
}
