import { describe, expect, it } from 'vitest';
import { runWoundVariant, healingReference, VARIANTS, WOUND_ID, HAUL_ID, WOUND_FIXTURE } from '../examples/human-wound.ts';
import { FIXTURE } from '../examples/human-week.ts';
import { libraryRow } from '../src/library.ts';
import { bleedingClass, loseBlood } from '../src/circulation.ts';
import { assembleBody, assemblyCirculation, anatomyProcess } from '../src/anatomy.ts';
import { World } from '../src/world.ts';
import { defaultRegistry } from '../src/registry.ts';
import { bodyOutputs } from '../src/physiology.ts';
import { createMedicine, healingMultiplier, inflictWound, medicineProcess, treat } from '../src/medicine.ts';
import { crisesOf, declareDeath } from '../src/crisis.ts';
import { Scheduler } from '../src/scheduler.ts';
import { rng } from '../src/process.ts';

describe('checkpoint 2: supported wound integration; missing kinetics explicitly blocked', () => {
  it('runs the three treatment schedules with row-derived classes, seeded infection, fatigue and conservation', () => {
    const source = libraryRow('medicine', 'wounds', WOUND_ID);
    expect(source['Bleeding class (see bleeding table)']).toBe('II to IV');
    const infection = String(source['Infection chance untreated']).match(/\d+/g)!.map(Number);
    const random = rng(WOUND_FIXTURE.seed); random(); random();
    const infected = random() < (infection[0] + infection[1]) / 200;
    for (const variant of VARIANTS) {
      const run = runWoundVariant(variant), { w, body } = run.week;
      expect(run.days).toHaveLength(FIXTURE.days);
      expect(run.days[0].wounds).toEqual([]);
      expect(run.days[1].wounds[0]).toMatchObject({ kind: WOUND_ID, bleedingClass: 'II',
        rateMlMin: null, infected, bound: variant !== 'never-bound' });
      const binding = w.trace.notes.find(n => n.text.startsWith('medicine.treatments.tourniquet-and-ligature:'));
      if (variant === 'never-bound') expect(binding).toBeUndefined();
      else expect(binding!.t).toBe(WOUND_FIXTURE.woundAtS + (variant === 'bound-after-hour' ? 3600 : 0));
      expect(run.days[1].fatigue.peakL).toBeGreaterThan(0);
      expect(run.days[1].fatigue.hand.L).toBeLessThan(run.days[1].fatigue.peakL);
      expect(run.days[2].fatigue.peakL).toBeLessThan(run.days[1].fatigue.peakL);
      const haulCost = w.trace.transfers.filter(t => t.t === 3 * 3600 && t.quantity === 'energy:chemical' && t.from === 'body');
      expect(haulCost.length).toBeGreaterThan(0);
      expect(libraryRow('muscular', 'activations', HAUL_ID)['Intensity (MET)']).toBe(7);
      expect(w.trace.failed()).toEqual([]);
      expect(w.trace.checks.filter(c => c.quantity === 'mass:body-composition-proxy')).toHaveLength(FIXTURE.days * 86400 / FIXTURE.stepS);
      // (2623) Immediate water mass includes bound water; no delayed daily mark.
      expect(body.mass).toBeCloseTo(FIXTURE.massKg + body.props.fat_kg - FIXTURE.fatKg + (body.props.glycogen_g - 400) / 1000 - body.props.waterDeficitKg, 9);
      expect(body.props.blood_volume_ml + w.trace.outOf('body', 'volume:blood') - w.trace.into('body', 'volume:blood'))
        .toBeCloseTo(body.props.circulation_initial_ml, 6);
      expect([...w.registry.components.values()].filter(c => c.id.startsWith('body:')).every(c => c.mass === 0)).toBe(true);
      // No invented rate: all treatment variants correctly retain the same blood volume.
      expect(body.props.blood_lost_ml).toBe(0);
      expect(run.assembly.crises).toEqual([]);
      expect(body.props).not.toHaveProperty('dead');
      expect(bodyOutputs(body)).not.toHaveProperty('dead');
      for (const d of run.days.slice(1)) {
        expect(d.outputs['medicine.pain']).toBeNull();
        expect(d.wounds[0].healDays).toBeGreaterThanOrEqual(14);
        expect(d.wounds[0].healDays).toBeLessThanOrEqual(30);
      }
      // Actual week healing uses its sleep/nutrition factors, plus duty then rest.
      for (let i = 2; i < run.days.length; i++) {
        const d = run.days[i], before = run.days[i - 1].wounds[0];
        expect(d.wounds[0].progressDays - before.progressDays)
          .toBeCloseTo(infected ? 0 : 1 / healingMultiplier({ ...d.healingFactors, rest: true }), 12);
      }
    }
  }, 120_000);

  it('draws clean healing days from the thrust row, and leaves infected seeds paused', () => {
    const row = libraryRow('medicine', 'wounds', WOUND_ID);
    const [lo, hi] = String(row['Heals in (days, clean)']).match(/\d+/g)!.map(Number);
    const clean = healingReference();
    expect(clean.wound.infected).toBe(false);
    expect(clean.wound.healDays).toBeGreaterThanOrEqual(lo);
    expect(clean.wound.healDays).toBeLessThanOrEqual(hi);
    expect(clean.days.find(d => d.healed)!.day).toBe(clean.wound.healDays);
    expect(clean.days[clean.wound.healDays - 2].healed).toBe(false);
    const infected = healingReference(2);
    expect(infected.wound.infected).toBe(true);
    expect(infected.days.every(d => !d.healed && d.progress === 0)).toBe(true);
  });

  it('a separate prescribed-loss probe reaches the table perfusion and class-IV crisis without a dead flag', () => {
    const w = new World(defaultRegistry());
    const body = w.registry.addComponent({ id: 'body', kind: 'body', material: 'flesh', mass: FIXTURE.massKg,
      temperatureC: 37, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
    const assembly = assembleBody(w, 'body'), circulation = assemblyCirculation(assembly), anatomy = anatomyProcess(assembly);
    const baseline = body.props.blood_volume_ml;
    const ii = libraryRow('circulation', 'bleeding', 'circulation.bleeding.ii');
    const iii = libraryRow('circulation', 'bleeding', 'circulation.bleeding.iii');
    const iv = libraryRow('circulation', 'bleeding', 'circulation.bleeding.iv');
    const threshold = Number(/\d+/.exec(String(ii['Loss (% of blood volume)']))![0]) / 100;
    expect(bleedingClass(baseline * threshold, baseline).id).toBe(ii.id);
    // Tabulated 70 kg example endpoints are imposed observations, not a wound rate.
    // 2,000 mL exceeds 40% of this species profile's 4,900 mL baseline.
    const losses = String(iii['Loss for a 70 kg man (mL)']).match(/\d+/g)!.map(Number);
    loseBlood(w, 'body', losses[0]); circulation.step(w, 0); anatomy.step(w, 0);
    expect(bodyOutputs(body)[String(iii.id)]).toBe(1);
    expect(assembly.organs.kidneys.function).toBe(Number(/kidneys ([\d.]+)/.exec(String(iii['Pressure and perfusion (model)']))![1]));
    loseBlood(w, 'body', losses[1] - losses[0]); circulation.step(w, 0); anatomy.step(w, 0);
    expect(bodyOutputs(body)[String(iv.id)]).toBe(1);
    expect(assembly.organs.brain.function).toBe(Number(/brain ([\d.]+)/.exec(String(iv['Pressure and perfusion (model)']))![1]));
    expect(assembly.cascades.brain.kineticsSeconds).toBeNull();
    expect(assembly.crises.some(c => c.organ === iv.id && c.kind === 'crisis')).toBe(true);
    expect(bodyOutputs(body)['circulation.quantities.oxygen-delivery-do2']).toBeNull();
    expect(body.props.blood_volume_ml + w.trace.outOf('body', 'volume:blood')).toBeCloseTo(baseline, 6);
    expect(w.trace.failed()).toEqual([]);
    for (const component of w.registry.components.values()) {
      expect(component.props).not.toHaveProperty('dead');
      expect(bodyOutputs(component)).not.toHaveProperty('dead');
    }
  });

  // The library has no thrust bleed rate (the todo below), so these two runs impose a host rate and clotting: they test the path
  // from a bleeding wound to its crisis record, not a predicted course.
  it.each(['never-bound', 'bound-at-once'] as const)('a bleeding wound, %s, ends in a crisis record before any death', variant => {
    const w = new World(defaultRegistry()), sch = new Scheduler();
    const body = w.registry.addComponent({ id: 'body', kind: 'body', material: 'flesh', mass: FIXTURE.massKg,
      temperatureC: 37, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
    const assembly = assembleBody(w, 'body'), medicine = createMedicine('body', { seed: WOUND_FIXTURE.seed });
    const wound = inflictWound(medicine, WOUND_ID, { severity: 0, rateMlMin: 200, clotting: 0, infected: false });
    if (variant === 'bound-at-once') treat(medicine, 'tourniquet-and-ligature', { wound: wound.n });
    sch.add(assemblyCirculation(assembly)); sch.add(medicineProcess(medicine)); sch.add(anatomyProcess(assembly));
    const iv = libraryRow('circulation', 'bleeding', 'circulation.bleeding.iv');
    expect(String(iv['Organ consequences (ANATOMY)'])).toContain('dying');
    for (let minute = 0; minute < 30; minute++) {
      const before = crisesOf(w, 'body').length;
      sch.run(w, 60, 60);
      // the engine never sets a dead flag; a host asking for a death before any crisis record exists is refused
      expect(body.props).not.toHaveProperty('dead');
      if (before === 0 && crisesOf(w, 'body').length === 0) expect(() => declareDeath(w, 'body', 'blood loss')).toThrow();
    }
    const crises = crisesOf(w, 'body');
    if (variant === 'bound-at-once') { expect(crises).toEqual([]); expect(body.props.blood_lost_ml).toBe(0); return; }
    expect(crises.map(c => c.cause)).toEqual([iv.id]);
    expect(crises[0]).toMatchObject({ kind: 'crisis', body: 'body', organ: iv.id });
    expect(crises[0].source).toContain(String(iv.id));
    expect(w.trace.crises).toEqual(crises);
    expect(assembly.crises).toContain(crises[0]); // the assembly lists the same record
    declareDeath(w, 'body', 'blood loss'); // only now can a host mark the body dead
    expect(body.props.dead).toBe(1);
    expect(crises[0].resolved).toBe('died');
    expect(w.trace.failed()).toEqual([]);
    // (2715) compaction keeps every crisis and death note the run wrote
    const marked = w.trace.notes.filter(n => /^(crisis|death):/.test(n.text));
    expect(marked.some(n => n.text.startsWith('crisis:'))).toBe(true);
    expect(marked.some(n => n.text.startsWith('death:'))).toBe(true);
    w.trace.compact(w.t + 1);
    for (const n of marked) expect(w.trace.notes).toContainEqual(n);
  });

  it('body mass is conserved including shed blood at the library blood density', () => {
    const w = new World(defaultRegistry());
    const body = w.registry.addComponent({ id: 'body', kind: 'body', material: 'flesh', mass: FIXTURE.massKg,
      temperatureC: 37, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
    const density = Number(libraryRow('circulation', 'quantities', 'circulation.quantities.blood-density')['Normal (70 kg man)']);
    expect(density).toBeCloseTo(1.06, 2);
    const shed = loseBlood(w, 'body', 1500) + loseBlood(w, 'body', 500);
    expect(shed).toBe(2000);
    const shedKg = w.trace.outOf('body', 'mass:blood');
    expect(shedKg).toBeCloseTo(2000 * density / 1000, 9);
    expect(body.mass + shedKg).toBeCloseTo(FIXTURE.massKg, 9);
    expect(body.mass).toBeLessThan(FIXTURE.massKg);
    expect(w.trace.failed()).toEqual([]);
  });

  it.todo('BLOCKED: library thrust bleed rate and clotting drive the never-bound timed delivery failure/crisis');
});
