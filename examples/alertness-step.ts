/** Alertness against step (2834): why day-2 alertness of the human week is 0.7176 at 60 s and 3600 s but 0.78 at 600 s.
 * Measures only; no model changes. `node --experimental-strip-types examples/alertness-step.ts` prints the tables in
 * validation/ALERTNESS-STEP.md. For each step the run records, around the end of day 2, what physiology wrote last before
 * the audit sampled `outputs`: its start time, the clock hour `circadianRow` was given, the circadian row and factor, the
 * sleep-debt row and multiplier, and the unrounded debt. */
import { runHumanWeek } from './human-week.ts';
import { bodyOutputs, circadianRow, sleepDebtRow } from '../src/physiology.ts';

export const STEPS = [60, 300, 600, 1200, 3600] as const;
const DAY_END_S = 2 * 86400;

export interface Probe {
  stepS: number; physStartS: number; physStartClockH: number; sampled: number; sampledT: number;
  circadianRow: string; circadianFactor: number; debtRow: string; debtMultiplier: number; debt: number;
  physRuns: number; reconstructed: number;
}

export function probe(stepS: number): Probe {
  let last = { t: 0, clock: 0, debt: 0 }, runs = 0;
  const run = runHumanWeek((_w, body, _room, sch) => {
    const phys = sch.processes.find(p => p.name === 'physiology')!, step = phys.step.bind(phys);
    phys.step = (world, dt) => {
      step(world, dt); runs++;
      last = { t: world.t, clock: (5 + world.t / 3600) % 24, debt: Number(body.props.sleep_debt) };
    };
  }, stepS, 2);
  const out = run.days[1]!.outputs;
  // the same two lookups, repeated here from the recorded hour and debt, must give the sampled alertness
  const circ = circadianRow(last.clock), debt = sleepDebtRow(last.debt);
  return { stepS, physStartS: last.t, physStartClockH: last.clock, sampled: Number(out.alertness), sampledT: DAY_END_S,
    circadianRow: String(out.circadian_row), circadianFactor: Number(out.circadian), debtRow: String(out.sleep_debt_row),
    debtMultiplier: debt.multiplier, debt: last.debt, physRuns: runs, reconstructed: debt.multiplier * circ.factor };
}

export function report(rows: Probe[]) {
  const f = (v: number, d = 4) => v.toFixed(d);
  return ['| step (s) | physiology last started at (s) | clock hour given to circadianRow | circadian row | circadian factor | sleep debt (h, 17 digits) | debt row | debt multiplier | sampled alertness | recomputed |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.stepS} | ${r.physStartS} | ${f(r.physStartClockH, 5)} | ${r.circadianRow} | ${r.circadianFactor} | ${r.debt.toPrecision(17)} | ${r.debtRow} | ${r.debtMultiplier} | ${f(r.sampled)} | ${f(r.reconstructed)} |`)].join('\n');
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const rows = STEPS.map(probe);
  console.log(report(rows));
  // the day's last step starts one step before the close, at clock 05:00 minus one step
  for (const r of rows) console.log(r.stepS, 'physiology runs', r.physRuns, 'end-of-day start clock', r.physStartClockH);
  // the debt as the nightly sums of dtH accumulate it: 6 h of sleep (quality 1) in steps of dt, twice, against the need of 8 h
  for (const s of STEPS) {
    let slept = 0; for (let i = 0; i < 6 * 3600 / s; i++) slept += s / 3600;
    let d = 0; for (let k = 0; k < 2; k++) d = Math.max(0, d + Math.max(0, 8 - slept) - Math.max(0, slept - 8));
    console.log('step', s, 'one night slept', slept.toPrecision(17), 'debt after two nights', d.toPrecision(17));
  }
  // the circadian band each last-step hour falls in, and the debt row at the 4.0 edge
  for (const h of [3.5, 3.99, 4, 4.5, 4.667, 4.833, 4.9167, 4.9833, 5, 5.5]) { const c = circadianRow(h); console.log('hour', h, c.row.id, c.factor); }
  for (const d of [3.9, 3.999999, 4, 4.000001, 4.1]) { const s = sleepDebtRow(d); console.log('debt', d, s.row.id, s.multiplier); }
}
