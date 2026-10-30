/** Thirty days at one-second steps, with hourly transfer compaction (2656). */
import { runHorseStable } from './horse-stable.ts';

const { w } = runHorseStable(30, { stepS: 1, compactEveryS: 3600 });
const errors = new Map<string, number>();
let failed = 0;
for (const check of w.trace.checks) {
  if (!check.ok) failed++;
  errors.set(check.quantity, Math.max(errors.get(check.quantity) ?? 0, Math.abs(check.expected - check.actual)));
}
console.log(`failed checks: ${failed}`);
for (const [quantity, error] of errors) console.log(`${quantity} max absolute error: ${error}`);
