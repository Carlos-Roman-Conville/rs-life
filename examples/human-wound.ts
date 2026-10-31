/** Checkpoint 2, supported subset. Missing bleed rate/flow kinetics stay null.
 * The three counterfactuals share a seed and checkpoint-1 circumstances.
 * Wound: day 2 at 05:00, left hand; hauling: 08:00–08:01 on days 1/2,
 * followed by rest of the wounded part. These are host circumstances, not rates.
 */
import { runHumanWeek, FIXTURE } from './human-week.ts';
import { assembleBody, assemblyCirculation, anatomyProcess, type BodyAssembly } from '../src/anatomy.ts';
import { bodyOutputs, physiologyProcess } from '../src/physiology.ts';
import { advanceDays, createMedicine, inflictWound, medicineProcess, treat, worldHealingFactors,
  type Wound } from '../src/medicine.ts';
import { muscularActivation, stepMuscleFatigue, type Compartments } from '../src/muscular.ts';
import { libraryRow } from '../src/library.ts';

export const WOUND_ID = 'medicine.wounds.thrust-penetrating';
export const HAUL_ID = 'muscular.activations.hauling-a-line-hand-over-hand';
export const VARIANTS = ['bound-at-once', 'bound-after-hour', 'never-bound'] as const;
export type Variant = typeof VARIANTS[number];
export const WOUND_FIXTURE = { seed: 1, woundAtS: 86400, delayS: 3600,
  rateMlMin: null, clotting: null, pain: null, woundedSide: 'L' } as const;
export const BLOCKED = [
  'No library thrust rate or clotting value: bleeding and the untreated time course are disabled.',
  'No volume-to-flow curve or cascade kinetics: no predicted haemorrhage DO2 or timed organ failure.',
  'No thrust pain band: it remains null.',
];
const haul = muscularActivation(HAUL_ID);
const fresh = (): Compartments => ({ resting: 1, active: 0, fatigued: 0 });
const hauling = (t: number) => t < 2 * 86400 && t % 86400 === 3 * 3600;

export function runWoundVariant(variant: Variant, seed: number = WOUND_FIXTURE.seed) {
  const medicine = createMedicine('body', { seed });
  let assembly: BodyAssembly, wound: Wound | undefined, hand = fresh(), peak = 0;
  const days: { day: number; variant: Variant; outputs: Record<string, number | string | null>;
    organsUnderOne: Record<string, number>; organsUnknown: string[]; sick: string[];
    wounds: Wound[]; fatigue: { hand: { L: number; R: null }; peakL: number };
    crises: BodyAssembly['crises']; healingFactors: ReturnType<typeof worldHealingFactors> }[] = [];
  const week = runHumanWeek((w, body, room, sch) => {
    assembly = assembleBody(w, body.id);
    const circulation = assemblyCirculation(assembly), anatomy = anatomyProcess(assembly);
    const med = medicineProcess(medicine);
    // Replace just the specified minute's duty, so physiology owns its MET cost.
    const duty = sch.processes.find(p => p.name === 'physiology')!;
    const ordinary = duty.step.bind(duty);
    const haulDuty = physiologyProcess(body.id, room.id, { every: 1, clockH0: 5, dayStartH: 5, met: haul.met });
    duty.step = (world, dt) => (hauling(world.t) ? haulDuty.step(world, dt) : ordinary(world, dt));
    let lastOrganUpdate = 0;
    sch.add({ name: 'wound-and-muscle', every: 1, step(world, dt) {
      if (world.t === WOUND_FIXTURE.woundAtS) {
        wound = inflictWound(medicine, WOUND_ID, { severity: 0 }); // II, lower end of II–IV
        world.trace.note(world.t, `${WOUND_ID}: left hand; rate/clotting/pain unsupported`);
      }
      const bindAt = WOUND_FIXTURE.woundAtS + (variant === 'bound-after-hour' ? WOUND_FIXTURE.delayS : 0);
      if (wound && variant !== 'never-bound' && world.t === bindAt) {
        treat(medicine, 'tourniquet-and-ligature', { wound: wound.n });
        world.trace.note(world.t, `medicine.treatments.tourniquet-and-ligature: ${variant}`);
      }
      // Day 2 uses the part, including its row's daily reopening draw. Thereafter rest.
      if (wound) { wound.workingPart = world.t < 2 * 86400; wound.resting = !wound.workingPart; }
      med.step(world, dt);
      hand = stepMuscleFatigue(hand, 'hand', hauling(world.t) ? haul.groups.hand! : 0,
        dt, 1, world.trace, world.t)!;
      peak = Math.max(peak, hand.fatigued);
      // Hourly organ snapshots, after breathing and medicine. No unmodelled
      // damage accumulates between snapshots; anatomy receives the elapsed time.
      if ((world.t + dt) % 3600 === 0) {
        circulation.step(world, world.t + dt - lastOrganUpdate);
        anatomy.step(world, world.t + dt - lastOrganUpdate);
        lastOrganUpdate = world.t + dt;
      }
      // Assembly shells and dimensionless fibres cannot add body mass. The
      // nutrition's mass change is fat + dry glycogen + total body-water change; binding/release is internal.
      world.trace.check(world.t, 'mass:body-composition-proxy',
        FIXTURE.massKg + body.props.fat_kg - FIXTURE.fatKg + ((body.props.glycogen_g ?? 400) - 400) / 1000
          - (body.props.waterDeficitKg ?? 0), body.mass, 1e-9);
      world.trace.check(world.t, 'volume:blood:checkpoint', body.props.circulation_initial_ml +
        world.trace.into(body.id, "volume:blood") - world.trace.outOf(body.id, "volume:blood"), body.props.blood_volume_ml, 1e-6);
      if ((world.t + dt) % 86400 === 0) {
        const out = bodyOutputs(body);
        days.push({ day: days.length + 1, variant, outputs: { ...out,
          [WOUND_ID + '.rate_ml_min']: null,
          // medicine's zero for an unclassified cause is not evidence of no pain.
          'medicine.pain': wound && !wound.healed ? null : 0 },
          organsUnderOne: Object.fromEntries(Object.entries(assembly.organs)
            .filter(([, s]) => s.function !== null && s.function < 1).map(([id, s]) => [id, s.function!])),
          organsUnknown: Object.entries(assembly.organs).filter(([, s]) => s.function === null).map(([id]) => id),
          sick: medicine.sick.map(s => s.id), wounds: medicine.wounds.map(x => ({ ...x })),
          fatigue: { hand: { L: hand.fatigued, R: null }, peakL: peak },
          crises: assembly.crises.map(c => ({ ...c })), healingFactors: worldHealingFactors(world, body.id) });
        peak = 0;
      }
    } });
  });
  return { variant, seed, week, medicine, assembly: assembly!, days };
}

/** Isolated clean-healing reference through the row's maximum, not a continuation
 * of the depleted week body. Neutral factors, no work/reopening or forced infection.
 * The same seed draws infection and healing duration; infected seeds stay paused.
 */
export function healingReference(seed: number = WOUND_FIXTURE.seed) {
  const medicine = createMedicine('reference', { seed });
  const wound = inflictWound(medicine, WOUND_ID, { severity: 0 });
  treat(medicine, 'tourniquet-and-ligature', { wound: wound.n });
  const max = Number(/to (\d+)/.exec(String(libraryRow('medicine', 'wounds', WOUND_ID)['Heals in (days, clean)']))![1]);
  const days = [];
  for (let day = 1; day <= max; day++) {
    advanceDays(medicine, 1);
    days.push({ day, progress: wound.progressDays, healed: wound.healed, infected: wound.infected });
  }
  return { wound, days };
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  console.log('Checkpoint 2 — PARTIAL: unsupported paths disabled', JSON.stringify(WOUND_FIXTURE));
  for (const reason of BLOCKED) console.log('UNSUPPORTED:', reason);
  const runs = VARIANTS.map(variant => runWoundVariant(variant));
  for (let day = 0; day < FIXTURE.days; day++) for (const run of runs) {
    const d = run.days[day];
    console.log(JSON.stringify({ day: d.day, variant: d.variant,
      outputs: Object.fromEntries(Object.entries(d.outputs).filter(([id]) =>
        id.startsWith('circulation.') || id.startsWith('medicine.'))),
      organsUnderOne: d.organsUnderOne, organsUnknown: d.organsUnknown,
      sick: d.sick, wounds: d.wounds, fatigue: d.fatigue, crises: d.crises }));
  }
  console.log('Isolated clean-healing reference (neutral factors):', JSON.stringify(healingReference()));
  for (const r of runs) console.log(r.variant, r.week.w.trace.transfers.length, 'transfers;',
    r.week.w.trace.checks.length, 'checks;', r.week.w.trace.failed().length, 'failures');
}
