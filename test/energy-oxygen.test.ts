import { expect, it } from 'vitest';
import references from '../data/library/validation.json' with { type: 'json' };
import { World } from '../src/world.ts';
import { Scheduler } from '../src/scheduler.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { airContents, litresToKg } from '../src/atmosphere.ts';
import { bodyGasFlows, breathingProcess, respiratoryStateFromVo2 } from '../src/respiration.ts';
import { bodyOutputs, metabolicRateW, oxygenLitresPerMin, physiologyProcess } from '../src/physiology.ts';
import { KCAL_J, O2_ENERGY_J_PER_L, P_SEA_LEVEL, MMHG_PER_PA } from '../src/physics.ts';
import { horseRows, runHorseStable, STABLE } from '../examples/horse-stable.ts';

const component = (id: string, kind: string): Component => ({ id, kind, material: kind === 'body' ? 'flesh' : 'air_mass',
  mass: 55, temperatureC: 20, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: {} });

it('validation (2621): Weir oxygen energy agrees within 1% at the model RQ', () => {
  // Opened reference transcribed by 2645: https://pmc.ncbi.nlm.nih.gov/articles/PMC6358081/
  const rows = references.oxygen_energy.rows;
  const coefficient = (id: string) => Number(rows.find(r => r[0] === `validation.oxygen_energy.${id}`)![2]);
  const flows = bodyGasFlows(100), rq = flows.co2! / -flows.o2!;
  const weir = (coefficient('o2-coefficient') + coefficient('co2-coefficient') * rq) * KCAL_J;
  expect(Math.abs(O2_ENERGY_J_PER_L / weir - 1)).toBeLessThan(0.01);
});

// Known validation failure, not a fitted constant or a widened tolerance. Standing is not basal rest.
it.fails('validation (2621): Kleiber horse lies within the published standing VO2 band (known discrepancy)', () => {
  // https://actavet.vfu.cz/media/pdf/avb_2001070020133.pdf
  // 2645: 4.0 +/- 0.7; caption SEM versus text SD; this is not a measured min/max range.
  const row = references.equine_resting_vo2.rows[0]!;
  const vo2 = oxygenLitresPerMin(metabolicRateW(1, { mass: 500, props: {} }, horseRows().rmrKcalDay)) * 1000 / 500;
  expect(vo2).toBeGreaterThanOrEqual(Number(row[3]));
  expect(vo2).toBeLessThanOrEqual(Number(row[4]));
});

it('retains the 70 kg reference oxygen rate within 2%', () => {
  const litres = -bodyGasFlows(metabolicRateW(1, { mass: 70, props: {} })).o2!;
  expect(Math.abs(litres - 0.25)).toBeLessThanOrEqual(0.25 * 0.02 + Number.EPSILON);
});

it('closes a non-reference human hour of energy, oxygen, CO2 and room elements', () => {
  const w = new World(defaultRegistry()), body = component('body', 'body'), room = component('room', 'room');
  body.props = { height_cm: 160, age_y: 50, male: 0 };
  room.props = { volume_m3: 60, pressurePa: P_SEA_LEVEL };
  room.contents = airContents(60, P_SEA_LEVEL, 20);
  w.registry.addComponent(body); w.registry.addComponent(room);
  for (const gas of ['o2', 'co2']) w.conserve(gas, ['room'], 1e-9);
  w.conserveElements(['room'], 1e-9);
  const sch = new Scheduler();
  sch.add(physiologyProcess('body', 'room', { met: 1, every: 1 }));
  sch.add(breathingProcess('body', 'room', { met: 9, every: 1 })); // outputs must win over fallback
  sch.run(w, 3600, 60);
  const o2L = w.trace.outOf('room', 'mass:o2') / litresToKg(w.registry, 'o2', 1, P_SEA_LEVEL, 20);
  const co2L = w.trace.into('room', 'mass:co2') / litresToKg(w.registry, 'co2', 1, P_SEA_LEVEL, 20);
  const energy = w.trace.outOf('body', 'energy:chemical');
  expect(Math.abs(o2L * O2_ENERGY_J_PER_L / energy - 1)).toBeLessThan(0.01);
  expect(co2L / o2L).toBeCloseTo(bodyGasFlows(100).co2! / -bodyGasFlows(100).o2!, 10);
  expect(energy).toBeCloseTo(body.props.expenditure_kcal * KCAL_J, 7);
  expect(w.trace.failed()).toEqual([]);
  const out = bodyOutputs(body);
  const expected = respiratoryStateFromVo2({ pressureMmHg: P_SEA_LEVEL * MMHG_PER_PA,
    o2Frac: out.o2_frac as number, co2Frac: (out.co2_ppm as number) / 1e6, coPpm: 0 }, o2L / 60 * 1000);
  expect(out.ventilation_l_min).toBeCloseTo(expected.ventilationLMin, 10);
  const before = w.trace.outOf('room', 'mass:o2');
  delete out.metabolic_w;
  breathingProcess('body', 'room', { met: 1 }).step(w, 60);
  expect(w.trace.outOf('room', 'mass:o2') - before).toBeCloseTo(litresToKg(w.registry, 'o2', oxygenLitresPerMin(metabolicRateW(1, body)), room.props.pressurePa, room.temperatureC), 12);
});

it('closes the stable horse hour of energy and gas/element ledgers', () => {
  const { w } = runHorseStable(1 / 24);
  // Temperature varies: recover each transfer's litres using a parallel one-step audit below.
  expect(w.trace.failed()).toEqual([]);
  const energy = w.trace.outOf('horse', 'energy:chemical');
  // (2623) Water now changes mass within the hour; integrate Kleiber at each starting mass.
  let mass = STABLE.massKg as number, expectedEnergy = 0;
  for (const transfer of w.trace.transfers) {
    if (transfer.quantity === 'mass:body') mass += (transfer.to === 'horse' ? 1 : -1) * transfer.amount;
    if (transfer.quantity === 'energy:chemical' && transfer.from === 'horse') expectedEnergy += 70 * mass ** 0.75 * KCAL_J * STABLE.stepS / 86400;
  }
  expect(energy).toBeCloseTo(expectedEnergy, 6);
  const run = runHorseStable(0), { body, room, sch } = run;
  let litres = 0, co2 = 0;
  sch.add({ name: 'oxygen-audit', every: 1, step(world) {
    for (const t of world.trace.transfers.filter(t => t.t === world.t && t.process === 'breathing')) {
      if (t.quantity === 'mass:o2') litres += t.amount / litresToKg(world.registry, 'o2', 1, room.props.pressurePa, room.temperatureC);
      if (t.quantity === 'mass:co2') co2 += t.amount / litresToKg(world.registry, 'co2', 1, room.props.pressurePa, room.temperatureC);
    }
  } });
  sch.run(run.w, 3600, 60);
  expect(Math.abs(litres * O2_ENERGY_J_PER_L / run.w.trace.outOf(body.id, 'energy:chemical') - 1)).toBeLessThan(0.01);
  expect(co2 / litres).toBeCloseTo(bodyGasFlows(100).co2! / -bodyGasFlows(100).o2!, 10);
  expect(run.w.trace.failed()).toEqual([]);
});
