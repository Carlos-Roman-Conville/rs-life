import { beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE, runHumanWeek } from '../examples/human-week.ts';
import { measure, STEPS, REFERENCE_STEP, type Measured } from '../examples/step-convergence.ts';

// This unit measures; it sets no tolerance between steps (validation/STEP-CONVERGENCE.md holds the differences).
describe('step convergence (2819)', () => {
  const runs: Measured[] = [];
  let reference: Measured;
  beforeAll(() => {
    for (const s of STEPS) runs.push(measure(s));
    reference = measure(REFERENCE_STEP, 1);
  }, 300_000);

  it.each(STEPS)('the water ledger closes over the week at %i s', step => {
    const r = runs.find(x => x.stepS === step)!;
    expect(r.days).toBe(FIXTURE.days);
    expect(r.daily).toHaveLength(FIXTURE.days);
    expect(r.failed).toBe(0);
    expect(Math.abs(r.ledgerResidualKg)).toBeLessThan(1e-9);
    expect(r.bodyWaterKg).toBeGreaterThan(0);
  });

  it('the water ledger closes over day one at the 1 s reference', () => {
    expect(reference.daily).toHaveLength(1);
    expect(reference.failed).toBe(0);
    expect(Math.abs(reference.ledgerResidualKg)).toBeLessThan(1e-9);
  });

  it('the 60 s run reproduces the checkpoint unchanged', () => {
    expect(FIXTURE.stepS).toBe(60);
    const checkpoint = runHumanWeek();
    expect(runs.find(x => x.stepS === 60)!.daily).toEqual(checkpoint.days);
    expect(runHumanWeek(undefined, FIXTURE.stepS, 1).days).toEqual(checkpoint.days.slice(0, 1));
  });

  it('times every process and the 3CC reads at both work-block ends each day', () => {
    for (const r of [...runs, reference]) {
      expect(Object.keys(r.wallMs.byProcess)).toEqual(['circumstances', 'room', 'environment', 'physiology', 'breathing', 'nutrition', 'neurology', 'muscular']);
      expect(r.blocks).toHaveLength(2 * r.days);
      expect(r.blocks.map(b => b.hour)).toEqual(Array.from({ length: r.days }, () => [12, 17]).flat());
      for (const b of r.blocks) for (const c of Object.values(b.groups)) expect(c.resting + c.active + c.fatigued).toBeCloseTo(1, 12);
    }
  });
});
