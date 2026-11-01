/** Diagnosis only; no golden writes. Run one fresh Vitest worker per revision:
 * $env:GOLDEN_DRIFT_SHA = '15dc9d2' (then each first-parent revision in order)
 * npx --no-install vitest run --config scripts/golden-drift.ts --configLoader runner
 * Scratch state/evidence in .bisect must be removed after writing the report.
 * A baseline invocation starts new evidence only if no previous state exists.
 * Optional parallel capture: after baseline, set GOLDEN_DRIFT_CAPTURE_ONLY=1;
 * every revision gets a separate capture file. Then unset it and set
 * GOLDEN_DRIFT_ANALYZE=1 and GOLDEN_DRIFT_HEAD=<last revision> to compare in order.
 * Capture files are a resumable cache: use fresh scratch state for a fresh audit.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export default {
  cacheDir: '.bisect/vite-cache',
  test: {
    include: ['scripts/golden-drift.ts'], testTimeout: 0, maxWorkers: 1,
    cache: false, fsModuleCache: false, server: { deps: { inline: ['@rex/kernel'] } },
  },
};

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
type Json = any;

// Same sorted traversal as the harness, extended to retain EVERY changed key.
function differences(a: Json, b: Json, path = ''): { path: string; before: Json; after: Json }[] {
  if (Object.is(a, b)) return [];
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    return [{ path: path || '(root)', before: a, after: b }];
  }
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(key =>
    differences(a[key], b[key], `${path}${Array.isArray(a) ? `[${key}]` : `.${key}`}`));
}

function assertNoLinks(path: string) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing link/junction: ${path}`);
  if (lstatSync(path).isDirectory()) for (const name of readdirSync(path)) {
    if (name === 'node_modules') throw new Error(`Unexpected node_modules: ${path}`);
    try { assertNoLinks(join(path, name)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}

async function diagnose() {
  const root = realpathSync('.');
  const scratch = join(root, '.bisect');
  mkdirSync(scratch, { recursive: true });
  const captureOnly = process.env.GOLDEN_DRIFT_CAPTURE_ONLY === '1';
  assertNoLinks(scratch);
  const sha = git('rev-parse', '--verify', `${process.env.GOLDEN_DRIFT_SHA ?? 'HEAD'}^{commit}`);
  const baseline = git('rev-parse', '15dc9d2');
  const target = join(scratch, sha);
  const archive = join(scratch, `${sha}.tar`);
  const stateFile = join(scratch, captureOnly ? 'baseline-state.json' : 'state.json');
  const evidenceFile = join(scratch, 'evidence.json');
  const captureFile = join(scratch, 'captures', `${sha}.json`);
  if (captureOnly && existsSync(captureFile)) return;
  if (sha === baseline && existsSync(stateFile)) throw new Error('Baseline requires fresh scratch state');
  if (sha !== baseline && !existsSync(stateFile)) throw new Error('Run and verify baseline first');
  const state: Json = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
  const evidence: Json = !captureOnly && existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) : { baseline, commits: [] };
  const entry: Json = { sha, message: git('show', '-s', '--format=%B', sha), runs: {} };
  if (/^120000 /m.test(git('ls-tree', '-r', sha, '--', 'src', 'examples', 'data'))) throw new Error('Archive contains links');
  for (let attempt = 0; ; attempt++) {
    if (captureOnly && existsSync(captureFile)) return;
    try { mkdirSync(target); break; }
    catch (error) {
      if (!captureOnly || (error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt >= 600) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  try {
    // --output avoids PowerShell's text-pipeline corruption of binary git archives.
    execFileSync('git', ['archive', `--output=${archive}`, sha, 'src', 'examples', 'data']);
    execFileSync('tar', ['-xf', `.bisect/${sha}.tar`, '-C', `.bisect/${sha}`]);
    assertNoLinks(target);
    const { canonical, fnv1a64 } = await import('@rex/kernel');

    // Copied from kernel/harness/golden/golden.test.ts (only World's static type omitted).
    function checkRecord(w: Json) {
      const by = new Map<string, { t: number; quantity: string; expected: number; actual: number; ok: boolean }[]>();
      for (const c of w.trace.checks) {
        const row = { t: c.t, quantity: c.quantity, expected: c.expected, actual: c.actual, ok: c.ok };
        const rows = by.get(c.quantity);
        if (rows) rows.push(row);
        else by.set(c.quantity, [row]);
      }
      return {
        count: w.trace.checks.length,
        failed: w.trace.failed().length,
        byQuantity: Object.fromEntries([...by].map(([quantity, rows]) => [quantity,
          { count: rows.length, failed: rows.filter((r) => !r.ok).length, first: rows[0], last: rows[rows.length - 1], hash: fnv1a64(canonical(plain(rows))) }])),
      };
    }
    function worldRecord(w: Json) {
      return {
        t: w.t,
        components: [...w.registry.components.values()].map((c: Json) => ({ id: c.id, kind: c.kind, mass: c.mass, temperatureC: c.temperatureC, contents: c.contents, props: c.props })),
        checks: checkRecord(w),
        transferCount: w.trace.transfers.length,
        transferHash: fnv1a64(canonical(plain(w.trace.transfers))),
      };
    }
    const names = ['realism-human-week', 'realism-human-wound-bound-at-once', 'realism-human-wound-bound-after-hour', 'realism-human-wound-never-bound', 'realism-horse-stable'];
    for (const name of names) {
      const started = Date.now();
      try {
        let record: Json;
        const modulePath = (file: string) => `${target.replaceAll('\\', '/')}/examples/${file}.ts`;
        if (name === 'realism-human-week') {
          const { runHumanWeek } = await import(/* @vite-ignore */ modulePath('human-week'));
          const run = runHumanWeek();
          record = { days: run.days, order: run.order, world: worldRecord(run.w) };
        } else if (name === 'realism-horse-stable') {
          const { runHorseStable } = await import(/* @vite-ignore */ modulePath('horse-stable'));
          const run = runHorseStable();
          record = { days: run.days, restingVentilation: run.restingVentilation, world: worldRecord(run.w) };
        } else {
          const { runWoundVariant, VARIANTS } = await import(/* @vite-ignore */ modulePath('human-wound'));
          const variant = name.replace('realism-human-wound-', '');
          if (!VARIANTS.includes(variant)) throw new Error(`Missing variant: ${variant}`);
          const run = runWoundVariant(variant);
          record = { days: run.days, medicine: run.medicine, week: { days: run.week.days, world: worldRecord(run.week.w) } };
        }
        const text = canonical(plain(record));
        const golden = readFileSync(join(root, '../kernel/harness/golden', `${name}.json`));
        const matchesGolden = golden.equals(Buffer.from(text));
        if (sha === baseline && !matchesGolden) throw new Error(`BASELINE MISMATCH: ${differences(JSON.parse(golden.toString()), JSON.parse(text))[0]?.path}`);
        const previous = state[name];
        const changed = previous && previous.text !== text;
        const changes = changed ? differences(JSON.parse(previous.text), JSON.parse(text)) : [];
        entry.runs[name] = { previous: previous?.sha, matchesGolden, hash: fnv1a64(text), bytes: Buffer.byteLength(text), changes };
        state[name] = { sha, text };
        console.log(`${sha.slice(0, 7)} ${name}: ${sha === baseline ? 'baseline MATCH' : changed ? `${changes.length} changed keys; first ${changes[0]?.path}` : 'unchanged'} (${Date.now() - started} ms)`);
      } catch (error) {
        if (sha === baseline) throw error; // Wrong method: stop before any history attribution.
        entry.runs[name] = { error: String(error), previous: state[name]?.sha };
        console.log(`${sha.slice(0, 7)} ${name}: CANNOT RUN: ${error}`);
      }
    }
    evidence.commits.push(entry);
    if (captureOnly) {
      const captures = join(scratch, 'captures');
      mkdirSync(captures, { recursive: true });
      writeFileSync(join(captures, `${sha}.json`), JSON.stringify({ entry, state }));
    } else {
      writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
      writeFileSync(stateFile, JSON.stringify(state));
      if (sha === baseline) writeFileSync(join(scratch, 'baseline-state.json'), JSON.stringify(state));
    }
  } finally {
    // Ignore only entries concurrently removed by another capture's cleanup.
    const find = process.platform === 'win32' ? resolve(git('--exec-path'), '../../../usr/bin/find.exe') : 'find';
    for (let attempt = 0; ; attempt++) {
      const scan = spawnSync(find, ['.bisect', '-ignore_readdir_race', '-type', 'l'], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
      if (scan.stdout?.trim()) throw new Error(`Refusing cleanup with links in .bisect: ${scan.stdout}`);
      if (!scan.error && scan.status === 0) break;
      // Git for Windows find can still report a disappearing sibling despite
      // -ignore_readdir_race. Retry a complete scan; never ignore links/errors.
      const vanished = scan.stderr?.trim().split('\n').every(line => line.includes('No such file or directory'));
      if (scan.error || scan.status !== 1 || !vanished || attempt >= 5) throw new Error(`Link scan failed: ${scan.error ?? scan.stderr}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Also reject Windows junctions and accidental dependency directories.
    assertNoLinks(scratch);
    const inside = relative(realpathSync(scratch), realpathSync(target));
    if (inside !== sha || resolve(target) !== resolve(scratch, sha) || inside.startsWith(`..${sep}`)) throw new Error('Unsafe cleanup target');
    rmSync(target, { recursive: true });
    if (existsSync(archive)) rmSync(archive);
  }
}

async function compareCaptures() {
  const scratch = resolve('.bisect');
  const evidenceFile = join(scratch, 'evidence.json');
  const stateFile = join(scratch, 'state.json');
  const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8'));
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  const head = process.env.GOLDEN_DRIFT_HEAD ?? 'HEAD';
  const revisions = [evidence.baseline, ...git('rev-list', '--first-parent', '--reverse', `${evidence.baseline}..${head}`).split('\n')];
  for (let index = 0; index < evidence.commits.length; index++) {
    if (evidence.commits[index].sha !== revisions[index]) throw new Error('Existing evidence is not a first-parent prefix');
  }
  for (const sha of revisions.slice(evidence.commits.length)) {
    const { entry, state: captured } = JSON.parse(readFileSync(join(scratch, 'captures', `${sha}.json`), 'utf8'));
    if (entry.sha !== sha) throw new Error(`Capture identity mismatch: ${sha}`);
    for (const [name, result] of Object.entries(entry.runs) as [string, Json][]) {
      result.previous = state[name].sha;
      if (result.error) continue;
      result.changes = differences(JSON.parse(state[name].text), JSON.parse(captured[name].text));
      if ((state[name].text !== captured[name].text) !== (result.changes.length > 0)) throw new Error(`Text/key comparison disagreement: ${sha} ${name}`);
      state[name] = captured[name];
    }
    evidence.commits.push(entry);
  }
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  writeFileSync(stateFile, JSON.stringify(state));
  console.log(`Compared ${revisions.length} revisions in first-parent order`);
}

if (process.env.VITEST_WORKER_ID !== undefined) {
  const { it } = await import('vitest');
  it('captures archived revisions and compares every golden key', process.env.GOLDEN_DRIFT_ANALYZE === '1' ? compareCaptures : diagnose);
}
