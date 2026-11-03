// @ts-expect-error The repo omits Node typings; provided by the test runtime.
import { execFileSync } from 'node:child_process';
// @ts-expect-error The repo omits Node typings; provided by the test runtime.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// @ts-expect-error The repo omits Node typings; provided by the test runtime.
import { tmpdir } from 'node:os';
// @ts-expect-error The repo omits Node typings; provided by the test runtime.
import { join } from 'node:path';
// @ts-expect-error The repo omits Node typings; provided by the test runtime.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import * as dist from '../dist/index.js';
import * as src from '../src/index.ts';

describe('compiled JS (5423)', () => {
  it('exports exactly the same runtime names as src', () => {
    expect(Object.keys(dist).sort()).toEqual(Object.keys(src).sort());
  });

  it('runs a world in plain Node under node_modules, including library data', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'realism-dist-'));
    try {
      const installed = join(tmp, 'node_modules', '@rex', 'realism');
      mkdirSync(installed, { recursive: true });
      for (const name of ['package.json', 'dist', 'data']) {
        cpSync(new URL(`../${name}`, import.meta.url), join(installed, name), {
          recursive: true, dereference: true,
        });
      }
      cpSync(new URL('../node_modules/@rex/kernel', import.meta.url),
        join(tmp, 'node_modules', '@rex', 'kernel'), { recursive: true, dereference: true });
      writeFileSync(join(tmp, 'probe.mjs'), `
import { World, Scheduler, defaultRegistry, airContents, roomAirProcess, libraryFiles, validation } from '@rex/realism';
const world = new World(defaultRegistry());
const scheduler = new Scheduler();
const room = {
  id: 'room', kind: 'room', material: 'air_mass', mass: 48, temperatureC: 18,
  contents: airContents(40, 101325, 18), ports: [],
  condition: { capability: 1, control: 1, accuracy: 1 },
  props: { volume_m3: 40, pressurePa: 101325, ach: 2 },
};
world.registry.addComponent(room);
scheduler.add(roomAirProcess('room'));
scheduler.stepOnce(world, 60);
console.log(JSON.stringify({
  names: [World.name, Scheduler.name, defaultRegistry.name],
  time: world.t, steps: scheduler.stepCount,
  finiteMass: Number.isFinite(room.mass), failures: world.trace.failed().length,
  library: libraryFiles().includes('physiology'),
  validation: validation.oxygen_energy.rows.length > 0,
}));
`);
      const output = execFileSync(execPath, ['probe.mjs'], { cwd: tmp, encoding: 'utf8' });
      expect(JSON.parse(output)).toEqual({
        names: ['World', 'Scheduler', 'defaultRegistry'], time: 60, steps: 1,
        finiteMass: true, failures: 0, library: true, validation: true,
      });
    } finally {
      // Only remove our fresh mkdtemp directory; dereferenced copies contain no links.
      rmSync(tmp, { recursive: true });
    }
  });
});
