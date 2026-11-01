# Alertness against step (2834)

Unit 2819 (`STEP-CONVERGENCE.md`) found day-2 alertness at the end of the human week of 0.7176 at 60 s and 3600 s but 0.78 at
600 s, with sleep debt "the same (4.0)" at every step. This note finds why. Measured only: no file in `src/` changed.
Probe: `examples/alertness-step.ts` (`node --experimental-strip-types examples/alertness-step.ts`); it wraps the physiology
process of `runHumanWeek` (2 days) and records what it wrote last before the audit sampled day 2.

## Result

Alertness is `sleepDebtRow(debt).multiplier × circadianRow(hour).factor` (`src/physiology.ts:496`). The circadian factor is
the same at every step. The difference is the sleep-debt multiplier: debt is 4 hours to within 1e-14, and the band table has an
edge at exactly 4.0 (`0-to-4` multiplier 1, `4-to-12` multiplier 0.92). Which side of the edge the sum lands on depends on
the step.

| step (s) | physiology last started at (s) | clock hour given to circadianRow | circadian row | circadian factor | sleep debt (h, 17 digits) | debt row | debt multiplier | sampled alertness |
|---|---|---|---|---|---|---|---|---|
| 60 | 172740 | 4.98333 | 02-00-to-06-00 | 0.78 | 4.0000000000000320 | 4-to-12 | 0.92 | 0.7176 |
| 300 | 172500 | 4.91667 | 02-00-to-06-00 | 0.78 | 4.0000000000000089 | 4-to-12 | 0.92 | 0.7176 |
| 600 | 172200 | 4.83333 | 02-00-to-06-00 | 0.78 | 3.9999999999999964 | 0-to-4 | 1 | 0.7800 |
| 1200 | 171600 | 4.66667 | 02-00-to-06-00 | 0.78 | 4.0000000000000036 | 4-to-12 | 0.92 | 0.7176 |
| 3600 | 169200 | 4.00000 | 02-00-to-06-00 | 0.78 | 4.0000000000000000 | 4-to-12 | 0.92 | 0.7176 |

(Row ids are shortened: the library ids are `physiology.circadian.…` and `physiology.sleep_debt.…`. The probe also
recomputes alertness from the recorded hour and debt; it matches the sampled value in every row.)

## Cause

Each night adds `dt/3600 × quality` hours to `slept_effective_h` once per step (`src/physiology.ts:411`). Six hours of sleep
(23:00 to 05:00, quality 1) are the sum of `6 × 3600 / dt` terms of `dt/3600`, and for a step such as 600 s (a sixth of an
hour, not representable) that sum is not exactly 6. The day closes at 05:00 (`closeDay`, line 361, `overnight`, lines
214 to 219): `debt += max(0, 8 − slept) − max(0, slept − 8)`. Two normal nights (day 1 and day 2) leave debt at 4 plus
the rounding error of two sums. A replay of just those sums in the probe reproduces the run's debt to the last digit:

| step (s) | one night slept (h) | debt after two nights (h) |
|---|---|---|
| 60 | 5.9999999999999840 | 4.0000000000000320 |
| 300 | 5.9999999999999956 | 4.0000000000000089 |
| 600 | 6.0000000000000018 | 3.9999999999999964 |
| 1200 | 5.9999999999999982 | 4.0000000000000036 |
| 3600 | 6.0000000000000000 | 4.0000000000000000 |

Only the 600 s sum rounds up (6 + 1.8e-15), so its debt is 4 − 3.6e-15, the band lookup (`sleepDebtRow`, line 180, `bandAt`)
puts it in `0-to-4`, and the multiplier is 1 instead of 0.92. Alertness then jumps by 8.7% for a 4e-15 h difference in debt.
It is non-monotone in the step only because the rounding error has no order: 60, 300 and 1200 s round down, 600 s up, 3600 s
exactly. A different step (or a different night length) would put a different step on the wrong side.

## Which cause

The hypotheses from the task, tested in order:

- **(a) Output staleness from `every` × step: ruled out for the human week.** `runHumanWeek` runs physiology with
  `every: 1` both in the scheduler and in the physiology options, so the process ran every step (2880 runs at 60 s, 576, 288,
  144, 48 at the larger steps) and the last run before the sample started one step before the day's end, at 04:59 (60 s) to
  04:00 (3600 s). All of those clock hours are inside the same circadian band, `02:00 to 06:00`, factor 0.78.
- **A circadian band boundary crossed at a step-dependent time: ruled out.** Every hour in the table is one band.
- **Day counter or day-close: ruled out as a timing error.** `closeDay` runs on the last step of the day for every step
  (`endDayIndex` is computed from the end of the interval, line 478) and before the outputs are written, so the sampled
  `sleep_debt` is the closed value at every step.
- **(c) The example's sampling: ruled out.** The audit samples when `(t + dt) % 86400 === 0`, the same instant at every step.
- **(b) A defect in physiology's own arithmetic, found: floating-point accumulation of sleep hours, then an exact-equality
  band edge.** It is not a day-boundary logic error, nor staleness. The fault is that a quantity that is an exact number of
  hours by construction is summed from per-step fractions of an hour and then compared with a table edge at that exact
  number. Location: the accumulation at `src/physiology.ts:411`, the closing sum at lines 214 to 219, and the edge lookup at line 180.

## Is the same staleness elsewhere?

- **Staleness proper (outputs refreshed only every `every` steps) is not in play in the human week**, but it is a property
  of the scheduler (`src/scheduler.ts:20`): a process with `every: N` runs when `stepCount % N === 0` with `dt × N`, and
  every output it writes, not just alertness, holds the value of that one run until the next. With physiology's default
  `every` of 10 (line 386) at a 60 s step, alertness, sleep debt, core temperature and hydration are up to 9 steps (9 min)
  old when read, and the hour given to `circadianRow` is the start of the N-step block (line 390), so the circadian factor lags
  by up to a block; at a 600 s step that is up to 90 minutes. The same holds for any other process with `every` above 1
  (nutrition and muscular both take `every` from their options; the example gives them 1, and their sources were not read for
  this note). Nothing in this note measured those cases.
- **A smaller version of the same lag exists even at `every: 1`:** `circadianRow` is given the hour at the start of the
  interval (line 390) while the day closes at its end (line 478), so in the closing step the circadian factor and the closed
  debt are one step apart. It does nothing here because 04:00 to 05:00 is inside one band; at a band edge it would show as a
  one-step lag.
- **Other outputs are affected by the float edge only where they are looked up in a band with an edge at a round number.**
  Sleep debt itself is not wrong (it differs from 4 by 3e-14 h); the discontinuity is in the table lookup. Core temperature and
  hydration deficit are continuous physical sums that rarely land on an edge, but they are looked up in banded tables too
  (`coreRow`, `hydrationRow`), so the same effect is possible there, at a lower likelihood.

## Does the fix depend on sleep pressure (REAL-33)?

No for the cause found. Whatever model replaces the nightly `slept_effective_h` tally, a banded lookup with exact edges fed by
a summed quantity will show the same step dependence. If REAL-33 turns sleep debt into a continuous pressure, the specific
0.92/1 cliff at 4 h goes away for debt, but the rounding fix is still needed for any table edge. The staleness (a) fix is also
independent of REAL-33.

## Proposed fix (not built)

Accumulate sleep as exact integer seconds, or snap the closing sum, and give band lookups an edge tolerance:
(1) keep `slept_effective_h` as quality-weighted seconds (or round the nightly total to 1e-9 h before `overnight`, as the
probe for 2819 snapped `resting` at 1e-9); (2) in `bandAt`, treat a value within 1e-9 of a band's `lo` as inside it. Either
alone removes this case; both cover edges reached by other sums. Separately, give `circadianRow` the middle of the interval
(or the end, to match the close) and, where `every` is above 1, publish outputs with the block's end hour. This needs a
change to `src/physiology.ts`, which is held for unit 2724.
