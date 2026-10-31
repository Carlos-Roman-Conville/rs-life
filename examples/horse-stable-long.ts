/** Thirty days at one-second steps, with hourly trace compaction and heap sampling (2678). */
import { runHorseStable } from './horse-stable.ts';

let peakHeap = 0;
const { w } = runHorseStable(30, { stepS: 1, compactEveryS: 3600, beforeCompact(world) {
  const heap = process.memoryUsage().heapUsed;
  peakHeap = Math.max(peakHeap, heap);
  if (world.t % 86400 === 0) console.log(`day ${world.t / 86400}: heap ${heap} bytes; kept checks ${world.trace.checks.length}; notes ${world.trace.notes.length}`);
} });
peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
const errors = new Map<string, number>();
for (const summary of w.trace.checkSummaries) errors.set(summary.quantity, summary.maxAbsError);
for (const check of w.trace.checks) {
  errors.set(check.quantity, Math.max(errors.get(check.quantity) ?? 0, Math.abs(check.expected - check.actual)));
}
console.log(`failed checks: ${w.trace.failed().length}`);
console.log(`peak heap: ${peakHeap} bytes (hourly samples and final)`);
console.log(`total checks: ${w.trace.checkCount}`);
for (const [quantity, error] of errors) console.log(`${quantity} max absolute error: ${error}`);
