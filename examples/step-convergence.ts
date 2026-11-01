/** Step convergence (2819): the human week at larger outer steps. Measures only; no model changes.
 * `node --experimental-strip-types examples/step-convergence.ts` prints the tables written to validation/STEP-CONVERGENCE.md.
 * The week's work activities are physiology MET rows, so the muscular 3CC is driven here by the activation row of the same
 * name (helm-in-a-seaway has none: local rest, as muscularFatigueProcess treats an activity without a row). */
import { runHumanWeek, FIXTURE } from './human-week.ts';
import { createMuscularState, muscularActivation, stepMuscleFatigue, type Compartments } from '../src/muscular.ts';
import { bodyOutputs } from '../src/physiology.ts';

const os = (globalThis as unknown as { process: { getBuiltinModule(id: string): { cpus(): unknown[] } } }).process.getBuiltinModule('node:os');

export const STEPS = [60, 600, 3600] as const;
export const REFERENCE_STEP = 1;
export const WORK_ACTIVATION: Record<string, string> = {
  'physiology.met.cooking-at-the-galley-fire': 'muscular.activations.cooking-at-the-galley',
  'physiology.met.carpentry-caulking-coopering': 'muscular.activations.carpentry-sawing-and-hammering',
  'physiology.met.smithing': 'muscular.activations.smithing-the-hammer-at-the-anvil',
};
/** Work blocks 08-12 and 13-17; the 3CC is read at the end of each. */
export const BLOCK_END_H = [12, 17] as const;
/** A muscle this close to fully rested (with no active fibres) is set to exactly rested before the next step. */
export const REST_SNAP = 1e-9;
const clockHour = (t: number) => (5 + t / 3600) % 24;

export interface BlockEnd { day: number; hour: number; groups: Record<string, Compartments> }
export interface Measured {
  stepS: number; days: number; cores: number;
  ledgerResidualKg: number; bodyWaterKg: number; failed: number;
  daily: ReturnType<typeof runHumanWeek>['days'];
  blocks: BlockEnd[];
  wallMs: { total: number; byProcess: Record<string, number> };
}

export function measure(stepS: number, days: number = FIXTURE.days): Measured {
  const blocks: BlockEnd[] = [], byProcess: Record<string, number> = {};
  const run = runHumanWeek((_w, body, _room, sch) => {
    const state = createMuscularState({ contractile: 50, oxidative: 50, min: 0, max: 100, recruitment: 50 });
    sch.add({ name: 'muscular', every: 1, step(world, dt) {
      const activity = bodyOutputs(body).activity;
      const row = typeof activity === 'string' && WORK_ACTIVATION[activity] ? muscularActivation(WORK_ACTIVATION[activity]) : null;
      for (const [group, sides] of Object.entries(state.groups))
        for (const muscle of Object.values(sides))
          if (muscle.compartments !== null) {
            const effort = row?.groups[group] ?? 0, c = muscle.compartments;
            // Rounding guard (see the report): stepMuscleFatigue throws when a long rest leaves resting one ulp over 1.
            if (effort === 0 && c.active === 0 && c.fatigued < REST_SNAP) muscle.compartments = { resting: 1, active: 0, fatigued: 0 };
            else muscle.compartments = stepMuscleFatigue(c, group, effort, dt, 1);
          }
      const end = world.t + dt, h = clockHour(end);
      if (end % 3600 === 0 && (BLOCK_END_H as readonly number[]).includes(h))
        blocks.push({ day: Math.floor((end - 1) / 86400) + 1, hour: h, groups: Object.fromEntries(Object.entries(state.groups)
          .flatMap(([g, sides]) => Object.entries(sides).filter(([, m]) => m.compartments !== null)
            .map(([side, m]) => [`${g}.${side}`, { ...m.compartments! }]))) });
    } });
    for (const p of sch.processes) {
      const step = p.step.bind(p); byProcess[p.name] = 0;
      p.step = (world, dt) => { const t0 = performance.now(); step(world, dt); byProcess[p.name] += performance.now() - t0; };
    }
  }, stepS, days);
  const body = run.w.registry.component('body');
  const ledgerResidualKg = 40 + run.w.trace.into('body', 'mass:water') - run.w.trace.outOf('body', 'mass:water')
    - run.w.registry.contentMass(body, 'water');
  return { stepS, days, cores: os.cpus().length, ledgerResidualKg, bodyWaterKg: run.w.registry.contentMass(body, 'water'),
    failed: run.w.trace.failed().length, daily: run.days, blocks,
    wallMs: { total: run.elapsedMs, byProcess } };
}

type Num = (m: Measured) => number;
/** Every table's rows, kept so the summary can name the largest difference per quantity. */
const groups: { title: string; rows: { label: string; pick: Num }[] }[] = [];
const f = (v: number, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
const sci = (v: number) => v.toExponential(2);

/** Step against value and difference from 60 s (and from 1 s over day one). */
function table(title: string, rows: { label: string; pick: Num }[], runs: Measured[], ref: Measured | undefined, digits = 4) {
  const base = runs.find(r => r.stepS === 60)!;
  if (!ref) groups.push({ title, rows });
  const out = [`### ${title}`, '', '| quantity | ' + runs.map(r => `${r.stepS} s`).join(' | ') + ' | ' + runs.filter(r => r !== base).map(r => `${r.stepS} s − 60 s`).join(' | ')
    + (ref ? ' | 1 s (day 1) | 60 s − 1 s | ' + runs.filter(r => r !== base).map(r => `${r.stepS} s − 1 s`).join(' | ') : '') + ' |',
    '|---|' + '---|'.repeat(runs.length * 2 - 1 + (ref ? 2 + runs.length - 1 : 0))];
  for (const { label, pick } of rows) {
    const cells = [label, ...runs.map(r => f(pick(r), digits)), ...runs.filter(r => r !== base).map(r => sci(pick(r) - pick(base)))];
    if (ref) cells.push(f(pick(ref), digits), sci(pick(base) - pick(ref)), ...runs.filter(r => r !== base).map(r => sci(pick(r) - pick(ref))));
    out.push('| ' + cells.join(' | ') + ' |');
  }
  return out.join('\n');
}

export function report(runs: Measured[], ref: Measured, dayOne: Measured[]) {
  const day = (r: Measured, d: number) => r.daily[d - 1]!;
  const out = (r: Measured, d: number, key: string) => Number(day(r, d).outputs[key]);
  // day-one comparison uses the first day of every run, so the reference is compared like for like
  const withRef = (rows: { label: string; pick: Num }[], digits?: number, title?: string) => ({ rows, digits, title });
  void withRef;
  const sections: string[] = [];
  sections.push(table('Water ledger and body water', [
    { label: 'ledger residual, end of run (kg)', pick: r => r.ledgerResidualKg },
    { label: 'body water, end of week (kg)', pick: r => r.bodyWaterKg },
  ], runs, undefined, 6));
  sections.push(table('Energy balance per day (kcal)', [1, 2, 3, 4, 5, 6, 7].flatMap(d => [
    { label: `day ${d} intake`, pick: (r: Measured) => day(r, d).kcalIn },
    { label: `day ${d} expenditure`, pick: (r: Measured) => day(r, d).kcalOut },
    { label: `day ${d} stored`, pick: (r: Measured) => day(r, d).storedKcal },
  ]), runs, undefined, 3));
  sections.push(table('Energy balance, day 1, against the 1 s reference (kcal)', [
    { label: 'day 1 intake', pick: r => day(r, 1).kcalIn }, { label: 'day 1 expenditure', pick: r => day(r, 1).kcalOut },
    { label: 'day 1 stored', pick: r => day(r, 1).storedKcal },
  ], dayOne, ref, 3));
  const checkpoint = (d: number): { label: string; pick: Num }[] => [
    { label: `day ${d} body mass (kg)`, pick: r => day(r, d).massKg }, { label: `day ${d} water deficit (kg)`, pick: r => day(r, d).waterDeficitKg },
    { label: `day ${d} body water (kg)`, pick: r => day(r, d).waterKg }, { label: `day ${d} water out (kg)`, pick: r => day(r, d).waterOutKg },
    { label: `day ${d} sleep debt`, pick: r => out(r, d, 'sleep_debt') }, { label: `day ${d} alertness`, pick: r => out(r, d, 'alertness') },
    { label: `day ${d} core temperature (C)`, pick: r => out(r, d, 'core_c') }, { label: `day ${d} room CO2 peak (ppm)`, pick: r => day(r, d).roomCo2PeakPpm },
  ];
  sections.push(table('Checkpoint outputs, end of each day', [1, 2, 3, 4, 5, 6, 7].flatMap(checkpoint), runs, undefined, 4));
  sections.push(table('Checkpoint outputs, day 1, against the 1 s reference', checkpoint(1), dayOne, ref, 4));
  const circuits = Object.keys(day(runs[0]!, 1).circuits);
  sections.push(table('Neurology circuit outputs, end of week', circuits.map(c => ({ label: c, pick: (r: Measured) => Number(day(r, 7).circuits[c]) })), runs, undefined, 4));
  // muscular 3CC at the end of each work block: the group with the largest fatigued fraction at 60 s on day 1, 12:00
  const base = runs.find(r => r.stepS === 60)!;
  const first = base.blocks.find(b => b.day === 1 && b.hour === 12)!;
  const key = (b: BlockEnd) => Object.entries(b.groups).sort((a, b2) => b2[1].fatigued - a[1].fatigued)[0]![0];
  const hot = key(first);
  const blockPick = (day: number, hour: number, g: string, c: keyof Compartments): Num => r => r.blocks.find(b => b.day === day && b.hour === hour)!.groups[g]![c];
  const blockRows = (days: number[]) => days.flatMap(d => BLOCK_END_H.flatMap(h => (['resting', 'active', 'fatigued'] as const).map(c =>
    ({ label: `day ${d} ${h}:00 ${c}`, pick: blockPick(d, h, hot, c) }))));
  sections.push(`Muscular 3CC group shown: \`${hot}\` (largest fatigued fraction at 60 s, day 1, 12:00). All groups and sides are in the run data.\n\n`
    + table('Muscular 3CC compartments at the end of each work block, all seven days', blockRows([1, 2, 3, 4, 5, 6, 7]), runs, undefined, 6));
  sections.push(table('Muscular 3CC compartments, day 1, against the 1 s reference', blockRows([1]), dayOne, ref, 6));
  const maxOver = (a: Measured, b: Measured) => Math.max(...a.blocks.filter(x => x.day === 1).flatMap(x => {
    const y = b.blocks.find(z => z.day === x.day && z.hour === x.hour)!;
    return Object.entries(x.groups).flatMap(([g, c]) => (['resting', 'active', 'fatigued'] as const).map(k => Math.abs(c[k] - y.groups[g]![k])));
  }));
  sections.push('Largest absolute difference over every group, side and compartment at the day-1 block ends: '
    + dayOne.map(r => `${r.stepS} s against 1 s ${sci(maxOver(r, ref))}`).join('; ') + '.');
  // one line per quantity: day-numbered rows of the same quantity are pooled, other tables stay whole
  const pooled = new Map<string, { label: string; pick: Num }[]>();
  for (const g of groups) for (const row of g.rows) {
    const key = /^(Energy|Checkpoint)/.test(g.title) ? row.label.replace(/^day \d+ /, '') : g.title;
    pooled.set(key, [...(pooled.get(key) ?? []), row]);
  }
  const largest = (rows: { label: string; pick: Num }[], step: number) => {
    const r = runs.find(x => x.stepS === step)!;
    return rows.map(row => ({ label: row.label, d: Math.abs(row.pick(r) - row.pick(base)) })).sort((x, y) => y.d - x.d)[0]!;
  };
  sections.push(['### Largest difference from 60 s, per quantity', '',
    '| quantity | 600 s: largest | at | 3600 s: largest | at |', '|---|---|---|---|---|',
    ...[...pooled].map(([key, rows]) => { const a = largest(rows, 600), b = largest(rows, 3600);
      return `| ${key} | ${sci(a.d)} | ${a.label} | ${sci(b.d)} | ${b.label} |`; })].join('\n'));
  // wall time per simulated day, in total and per process
  const names = Object.keys(base.wallMs.byProcess);
  const perDay = (r: Measured, ms: number) => ms / r.days;
  const timed = [...runs, ref];
  const wallRows = (rs: Measured[]) => [...names.map(n => ({ n, pick: (r: Measured) => perDay(r, r.wallMs.byProcess[n]!) })),
    { n: 'setup, audit, ledger checks (unwrapped)', pick: (r: Measured) => perDay(r, r.wallMs.total - Object.values(r.wallMs.byProcess).reduce((a, b) => a + b, 0)) },
    { n: 'total', pick: (r: Measured) => perDay(r, r.wallMs.total) }].map(({ n, pick }) =>
    `| ${n} | ${rs.map(r => pick(r).toFixed(1)).join(' | ')} |`);
  sections.push(['### Wall time per simulated day (ms)', '',
    `Machine: ${base.cores} cores (\`os.cpus().length\`). The 1 s run covers day 1 only.`, '',
    '| process | ' + timed.map(r => `${r.stepS} s`).join(' | ') + ' |', '|---|' + '---|'.repeat(timed.length), ...wallRows(timed)].join('\n'));
  const dominant = timed.map(r => {
    const e = Object.entries(r.wallMs.byProcess).sort((a, b) => b[1] - a[1])[0]!;
    const named = Object.values(r.wallMs.byProcess).reduce((a, b) => a + b, 0);
    return `- ${r.stepS} s: ${e[0]} is the largest process (${(100 * e[1] / r.wallMs.total).toFixed(0)}% of total wall time); `
      + `the unwrapped harness (setup, audit, ledger checks) is ${(100 * (r.wallMs.total - named) / r.wallMs.total).toFixed(0)}%`;
  });
  sections.push(['### Dominant process by step', '', ...dominant].join('\n'));
  return sections.join('\n\n');
}

export function muscularShare(r: Measured) { return r.wallMs.byProcess.muscular! / r.wallMs.total; }

export function collect() {
  const runs = STEPS.map(s => measure(s));
  const ref = measure(REFERENCE_STEP, 1);
  const dayOne = STEPS.map(s => measure(s, 1));
  return { runs, ref, dayOne };
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const { runs, ref, dayOne } = collect();
  console.log(report(runs, ref, dayOne));
  console.log('\nmuscular share:', [...runs, ref].map(r => `${r.stepS} s ${(100 * muscularShare(r)).toFixed(1)}%`).join(', '));
}
