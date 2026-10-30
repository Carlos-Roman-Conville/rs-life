import { describe, expect, it } from 'vitest';
import { runHorseStable, horseRows, STABLE } from '../examples/horse-stable.ts';
import { respiratoryProfile, respiratoryStateFromVo2 } from '../src/atmosphere.ts';
import { bodyOutputs, oxygenLitresPerMin } from '../src/physiology.ts';
import { libraryRow } from '../src/library.ts';
import { KCAL_J } from '../src/physics.ts';
import { fatKcalPerKg } from '../src/nutrition.ts';

const species = (slug: string) => libraryRow('anatomy', 'species', `anatomy.species.${slug}`)['A horse (example)'];
// node's own fs, reached without @types/node (tsconfig has no node types)
interface Fs { readdirSync(p: string): string[]; statSync(p: string): { isDirectory(): boolean }; readFileSync(p: string, enc: string): string }
const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): Fs } }).process.getBuiltinModule('node:fs');
const path = (rel: string) => decodeURIComponent(new URL(rel, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap((f: string) => {
  const p = `${dir}/${f}`;
  return fs.statSync(p).isDirectory() ? (f === '__pycache__' ? [] : walk(p)) : /\.(ts|json)$/.test(f) ? [p] : [];
});

describe('independence: a horse in a stable, no game code', () => {
  const run = runHorseStable();
  it('runs thirty days with no NaN and every conservation check passing', () => {
    expect(run.days).toHaveLength(30);
    expect(run.w.trace.failed()).toEqual([]);
    for (const d of run.days) for (const v of Object.values(d)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
    for (const v of Object.values(run.body.props)) expect(Number.isNaN(v)).toBe(false);
  });
  it('closes energy and mass: kcal in equals out plus stored, mass follows the stored energy', () => {
    let stored = 0;
    for (const d of run.days) {
      expect(Math.abs(d.kcalIn - d.kcalOut - d.storedKcal)).toBeLessThan(1e-6);
      stored += d.storedKcal;
      expect(d.massKg).toBeCloseTo(STABLE.massKg + stored / fatKcalPerKg(), 9);
      expect(d.waterInKg).toBeGreaterThan(0);
    }
  });
  it("matches the horse's profile row: Kleiber RMR, cardiac output, blood volume, resting ventilation", () => {
    const rows = horseRows();
    expect(String(species('rmr-formula'))).toContain('70 x kg^0.75');
    expect(rows.rmrKcalDay).toBeCloseTo(70 * Math.pow(STABLE.massKg, 0.75), 9);
    // (2623) Hourly drinking and ongoing water loss now change mass immediately.
    // Reconstruct each starting mass from its trace, then independently integrate Kleiber.
    let mass = STABLE.massKg as number, lastRmr = rows.rmrKcalDay, firstDayKcal = 0;
    for (const transfer of run.w.trace.transfers) {
      if (transfer.quantity === 'mass:body') mass += (transfer.to === 'horse' ? 1 : -1) * transfer.amount;
      if (transfer.quantity === 'energy:chemical' && transfer.from === 'horse') {
        lastRmr = 70 * Math.pow(mass, 0.75);
        expect(transfer.amount / KCAL_J).toBeCloseTo(lastRmr * STABLE.stepS / 86400, 9);
        if (transfer.t < 86400) firstDayKcal += lastRmr * STABLE.stepS / 86400;
      }
    }
    expect(bodyOutputs(run.body).rmr_kcal).toBeCloseTo(lastRmr, 9);
    expect(run.days[0]!.kcalOut).toBeCloseTo(firstDayKcal, 3);
    expect(rows.heartOutputLMin).toBeCloseTo(Number(species('resting-cardiac-output-l-min-per-kg')) * STABLE.massKg, 9);
    for (const d of run.days) expect(d.heartOutputLMin).toBe(rows.heartOutputLMin);
    expect(rows.bloodMl).toBeCloseTo(Number(species('blood-volume-ml-kg')) * STABLE.massKg, 9);
    expect(run.assembly.profile.temperatureC).toBe(Number(species('body-temperature-set-point-c')));
    // The library has no horse respiratory row: the stand-in is the per-kg human profile, as FLAGS.md says.
    const d = run.days[0]!.outputs, air = { pressureMmHg: d.pressure_mmhg as number, o2Frac: d.o2_frac as number,
      co2Frac: (d.co2_ppm as number) / 1e6, coPpm: 0 };
    expect(run.days[0]!.ventilationLMin).toBeCloseTo(respiratoryStateFromVo2(air, oxygenLitresPerMin(d.metabolic_w as number) * 1000, respiratoryProfile()).ventilationLMin, 6);
    expect(run.restingVentilation).toBeGreaterThan(0);
  });
  it('logs a CO2 peak above outside air and below the library tolerance', () => {
    for (const d of run.days) { expect(d.co2PeakPpm).toBeGreaterThan(400); expect(d.co2PeakPpm).toBeLessThan(30000); }
  });
  it('is the engine alone: no file under src or examples mentions the game, and the package has no game dependency', () => {
    for (const dir of ['../src', '../examples']) for (const f of walk(path(dir)))
      expect(/pirate/i.test(fs.readFileSync(f, 'utf8')), f).toBe(false);
    const pkg = JSON.parse(fs.readFileSync(path('../package.json'), 'utf8'));
    for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'])
      expect(Object.keys(pkg[key] ?? {}).filter(k => /pirate|game/i.test(k))).toEqual([]);
  });
});
