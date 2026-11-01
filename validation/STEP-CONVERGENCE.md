# Step convergence of the human week (2819)

Measured 2026-10-31 by `examples/step-convergence.ts` (`node --experimental-strip-types examples/step-convergence.ts`), which runs
`runHumanWeek` at outer steps of 60, 600 and 3600 s for the seven days, and at 1 s for day one only as the reference. The run at
60 s is the recorded checkpoint; `runHumanWeek` takes optional `stepS` and `days` arguments that default to it. This file measures
only: no model, constant or default step changed, and no acceptance band is set. Every difference below is the run's own value minus
the 60 s value (or minus the 1 s value for day one); the day-one tables are the first day of each run, so they compare like with like.

What each run adds to the week: a `muscular` process after neurology that steps the 3CC (`stepMuscleFatigue`) for every group and
side with a fatigue rate. The week's work activities are physiology MET rows, so the 3CC is driven by the activation row of the same
name: cooking-at-the-galley-fire, carpentry-caulking-coopering and smithing map to `muscular.activations.cooking-at-the-galley`,
`...carpentry-sawing-and-hammering` and `...smithing-the-hammer-at-the-anvil`. helm-in-a-seaway has no activation row, so it is local
rest (the rule `muscularFatigueProcess` uses). The 3CC is read at the end of each work block (12:00 and 17:00). Each process's `step`
is wrapped in `performance.now()`; the audit process, `world.afterStep` (the ledger checks) and setup are not wrapped and appear as
one "unwrapped" row. The 3CC adds no trace transfers here, so its cost is lower than `muscularFatigueProcess` with a trace.

## What the tables show

- **Water ledger.** It closes at every step: no failed check, residual at most 1e-14 kg. End-of-week body water is 39.647 kg at 60 s,
  39.656 kg at 600 s and 39.676 kg at 3600 s; the differences (8.7e-3 and 2.8e-2 kg) are real differences in the trajectory, not
  ledger leaks. They arise on day one (water out differs by 1.2e-2 and 3.1e-2 kg) and stay roughly constant afterwards.
- **Energy.** Intake is identical (it is prescribed). Expenditure is higher with the step: +1.55 kcal/day at 600 s (0.04%) and
  +6.9 kcal/day at 3600 s (0.19%) on day one; 60 s differs from the 1 s reference by 0.18 kcal.
- **Alertness is not monotone.** At the end of day 2, alertness is 0.7176 at 60 s and at 3600 s but 0.78 at 600 s (difference 0.062).
  The 600 s run alone is off; the cause was not investigated (this unit measures).
- **Room CO2 peak** (the highest value the audit sees, once per step) is higher at coarse steps: 2047 ppm at 3600 s against
  1377 ppm at 60 s (+6.7e+2 ppm), and up to 7.8e+1 ppm different at 600 s (day 6). Cause not investigated; the room-air process
  and the once-per-step sampling both depend on the step.
- **Muscular 3CC does not depend on the outer step.** As of (2833), constant-effort calls use the exact matrix
  exponential, and zero effort retains closed-form recovery. The tables agree to rounding. The group shown is at its
  steady state by the end of a block (fatigued 0.938); transient convergence and split-call agreement to 1e-12 are
  separately verified in `test/muscular.test.ts`.
- **Wall time, remeasured 2026-11-01 (2833).** Muscular cost now scales with outer calls rather than worked seconds.
  The same script, on this machine, before -> after: at 60 s, muscular 545.9 -> 129.2 ms/day and total 1256.4 -> 674.0;
  at 3600 s, muscular 328.9 -> 1.9 ms/day and total 339.9 -> 11.3. These are individual wall-clock runs, subject to
  machine load and JIT variation. The original 2819 record had muscular 391.2/296.1 and total 874.6/306.7 ms/day at
  60/3600 s. The wall table, 3CC tables and dominant-process summary below are the new run; other tables retain the
  original measurement. No rate or activation changed. At 3600 s muscular now accounts for 17% of the total,
  against 97% before; the unwrapped audit/ledger work dominates total time.

## Library finding: rounding at long rest

The original (2819) run found `stepMuscleFatigue` throwing when long rest left `resting` one unit in the last place
above 1. Its probe-only `REST_SNAP` workaround has since been removed by (2832), which repairs only roundoff within
1e-12 after checking conservation and bounds. The 2026-11-01 (2833) rerun uses that library guard directly, with no
probe snap. Exact constant-effort evolution preserves the same guard. This numerical verification does not extend
empirical validation; see `flags/muscular.md` (2634) and (2833), and `gears/muscular-3cc.md`.

# The tables

### Water ledger and body water

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s |
|---|---|---|---|---|---|
| ledger residual, end of run (kg) | 0.000000 | 0.000000 | 0.000000 | -7.11e-15 | 0.00e+0 |
| body water, end of week (kg) | 39.647359 | 39.656053 | 39.675711 | 8.69e-3 | 2.84e-2 |

### Energy balance per day (kcal)

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s |
|---|---|---|---|---|---|
| day 1 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 1 expenditure | 3723.733 | 3725.288 | 3730.643 | 1.55e+0 | 6.91e+0 |
| day 1 stored | 337.767 | 336.212 | 330.857 | -1.55e+0 | -6.91e+0 |
| day 2 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 2 expenditure | 3724.462 | 3725.761 | 3730.733 | 1.30e+0 | 6.27e+0 |
| day 2 stored | 337.038 | 335.739 | 330.767 | -1.30e+0 | -6.27e+0 |
| day 3 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 3 expenditure | 3801.040 | 3802.331 | 3807.287 | 1.29e+0 | 6.25e+0 |
| day 3 stored | 260.460 | 259.169 | 254.213 | -1.29e+0 | -6.25e+0 |
| day 4 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 4 expenditure | 3726.220 | 3727.505 | 3732.458 | 1.29e+0 | 6.24e+0 |
| day 4 stored | 335.280 | 333.995 | 329.042 | -1.29e+0 | -6.24e+0 |
| day 5 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 5 expenditure | 3802.820 | 3804.104 | 3809.032 | 1.28e+0 | 6.21e+0 |
| day 5 stored | 258.680 | 257.396 | 252.468 | -1.28e+0 | -6.21e+0 |
| day 6 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 6 expenditure | 3727.960 | 3729.238 | 3734.164 | 1.28e+0 | 6.20e+0 |
| day 6 stored | 333.540 | 332.262 | 327.336 | -1.28e+0 | -6.20e+0 |
| day 7 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 |
| day 7 expenditure | 3728.958 | 3730.229 | 3735.114 | 1.27e+0 | 6.16e+0 |
| day 7 stored | 332.542 | 331.271 | 326.386 | -1.27e+0 | -6.16e+0 |

### Energy balance, day 1, against the 1 s reference (kcal)

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s | 1 s (day 1) | 60 s − 1 s | 600 s − 1 s | 3600 s − 1 s |
|---|---|---|---|---|---|---|---|---|---|
| day 1 intake | 4061.500 | 4061.500 | 4061.500 | 0.00e+0 | 0.00e+0 | 4061.500 | 0.00e+0 | 0.00e+0 | 0.00e+0 |
| day 1 expenditure | 3723.733 | 3725.288 | 3730.643 | 1.55e+0 | 6.91e+0 | 3723.556 | 1.77e-1 | 1.73e+0 | 7.09e+0 |
| day 1 stored | 337.767 | 336.212 | 330.857 | -1.55e+0 | -6.91e+0 | 337.944 | -1.77e-1 | -1.73e+0 | -7.09e+0 |

### Checkpoint outputs, end of each day

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s |
|---|---|---|---|---|---|
| day 1 body mass (kg) | 69.6877 | 69.7000 | 69.7189 | 1.23e-2 | 3.12e-2 |
| day 1 water deficit (kg) | 0.3562 | 0.3437 | 0.3241 | -1.25e-2 | -3.21e-2 |
| day 1 body water (kg) | 39.6438 | 39.6563 | 39.6759 | 1.25e-2 | 3.21e-2 |
| day 1 water out (kg) | 4.7501 | 4.7378 | 4.7190 | -1.23e-2 | -3.11e-2 |
| day 1 sleep debt | 2.0000 | 2.0000 | 2.0000 | -1.78e-14 | -1.60e-14 |
| day 1 alertness | 0.7800 | 0.7800 | 0.7800 | 0.00e+0 | 0.00e+0 |
| day 1 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 1 room CO2 peak (ppm) | 1377.4156 | 1383.7084 | 2046.9347 | 6.29e+0 | 6.70e+2 |
| day 2 body mass (kg) | 69.7352 | 69.7435 | 69.7618 | 8.32e-3 | 2.66e-2 |
| day 2 water deficit (kg) | 0.3524 | 0.3437 | 0.3241 | -8.69e-3 | -2.83e-2 |
| day 2 body water (kg) | 39.6476 | 39.6563 | 39.6759 | 8.69e-3 | 2.83e-2 |
| day 2 water out (kg) | 4.3903 | 4.3943 | 4.3949 | 3.98e-3 | 4.56e-3 |
| day 2 sleep debt | 4.0000 | 4.0000 | 4.0000 | -3.55e-14 | -3.20e-14 |
| day 2 alertness | 0.7176 | 0.7800 | 0.7176 | 6.24e-2 | 0.00e+0 |
| day 2 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 2 room CO2 peak (ppm) | 1377.8242 | 1384.0951 | 2046.7455 | 6.27e+0 | 6.69e+2 |
| day 3 body mass (kg) | 69.7743 | 69.7824 | 69.7999 | 8.11e-3 | 2.56e-2 |
| day 3 water deficit (kg) | 0.3472 | 0.3385 | 0.3190 | -8.64e-3 | -2.81e-2 |
| day 3 body water (kg) | 39.6528 | 39.6615 | 39.6810 | 8.64e-3 | 2.81e-2 |
| day 3 water out (kg) | 4.3990 | 4.3992 | 4.4001 | 2.16e-4 | 1.03e-3 |
| day 3 sleep debt | 8.0000 | 8.0000 | 8.0000 | -4.26e-14 | -4.09e-14 |
| day 3 alertness | 0.7176 | 0.7176 | 0.7176 | 0.00e+0 | 0.00e+0 |
| day 3 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 3 room CO2 peak (ppm) | 1491.7177 | 1497.8982 | 2047.1473 | 6.18e+0 | 5.55e+2 |
| day 4 body mass (kg) | 69.8125 | 69.8205 | 69.8375 | 7.98e-3 | 2.50e-2 |
| day 4 water deficit (kg) | 0.3525 | 0.3438 | 0.3242 | -8.69e-3 | -2.83e-2 |
| day 4 body water (kg) | 39.6475 | 39.6562 | 39.6758 | 8.69e-3 | 2.83e-2 |
| day 4 water out (kg) | 4.3996 | 4.3997 | 4.4002 | 1.28e-4 | 6.37e-4 |
| day 4 sleep debt | 10.0000 | 10.0000 | 10.0000 | -6.04e-14 | -5.68e-14 |
| day 4 alertness | 0.7176 | 0.7176 | 0.7176 | 0.00e+0 | 0.00e+0 |
| day 4 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 4 room CO2 peak (ppm) | 1462.3263 | 1384.5541 | 2047.5099 | -7.78e+1 | 5.85e+2 |
| day 5 body mass (kg) | 69.8513 | 69.8591 | 69.8754 | 7.77e-3 | 2.40e-2 |
| day 5 water deficit (kg) | 0.3473 | 0.3386 | 0.3191 | -8.65e-3 | -2.81e-2 |
| day 5 body water (kg) | 39.6527 | 39.6614 | 39.6809 | 8.65e-3 | 2.81e-2 |
| day 5 water out (kg) | 4.3993 | 4.3995 | 4.4003 | 2.14e-4 | 1.02e-3 |
| day 5 sleep debt | 14.0000 | 14.0000 | 14.0000 | -6.75e-14 | -6.57e-14 |
| day 5 alertness | 0.6396 | 0.6396 | 0.6396 | 0.00e+0 | 0.00e+0 |
| day 5 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 5 room CO2 peak (ppm) | 1492.2305 | 1498.4118 | 2047.8956 | 6.18e+0 | 5.56e+2 |
| day 6 body mass (kg) | 69.8893 | 69.8970 | 69.9127 | 7.65e-3 | 2.34e-2 |
| day 6 water deficit (kg) | 0.3526 | 0.3439 | 0.3242 | -8.69e-3 | -2.83e-2 |
| day 6 body water (kg) | 39.6474 | 39.6561 | 39.6758 | 8.69e-3 | 2.83e-2 |
| day 6 water out (kg) | 4.3998 | 4.4000 | 4.4005 | 1.27e-4 | 6.32e-4 |
| day 6 sleep debt | 16.0000 | 16.0000 | 16.0000 | -8.53e-14 | -8.17e-14 |
| day 6 alertness | 0.6396 | 0.6396 | 0.6396 | 0.00e+0 | 0.00e+0 |
| day 6 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 6 room CO2 peak (ppm) | 1462.8253 | 1385.0138 | 2048.2554 | -7.78e+1 | 5.85e+2 |
| day 7 body mass (kg) | 69.9325 | 69.9400 | 69.9551 | 7.49e-3 | 2.26e-2 |
| day 7 water deficit (kg) | 0.3526 | 0.3439 | 0.3243 | -8.69e-3 | -2.84e-2 |
| day 7 body water (kg) | 39.6474 | 39.6561 | 39.6757 | 8.69e-3 | 2.84e-2 |
| day 7 water out (kg) | 4.3947 | 4.3948 | 4.3955 | 1.67e-4 | 8.12e-4 |
| day 7 sleep debt | 18.0000 | 18.0000 | 18.0000 | -1.07e-13 | -9.95e-14 |
| day 7 alertness | 0.6396 | 0.6396 | 0.6396 | 0.00e+0 | 0.00e+0 |
| day 7 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 |
| day 7 room CO2 peak (ppm) | 1379.0126 | 1385.2845 | 2048.6390 | 6.27e+0 | 6.70e+2 |

### Checkpoint outputs, day 1, against the 1 s reference

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s | 1 s (day 1) | 60 s − 1 s | 600 s − 1 s | 3600 s − 1 s |
|---|---|---|---|---|---|---|---|---|---|
| day 1 body mass (kg) | 69.6877 | 69.7000 | 69.7189 | 1.23e-2 | 3.12e-2 | 69.6866 | 1.13e-3 | 1.34e-2 | 3.23e-2 |
| day 1 water deficit (kg) | 0.3562 | 0.3437 | 0.3241 | -1.25e-2 | -3.21e-2 | 0.3573 | -1.15e-3 | -1.36e-2 | -3.32e-2 |
| day 1 body water (kg) | 39.6438 | 39.6563 | 39.6759 | 1.25e-2 | 3.21e-2 | 39.6427 | 1.15e-3 | 1.36e-2 | 3.32e-2 |
| day 1 water out (kg) | 4.7501 | 4.7378 | 4.7190 | -1.23e-2 | -3.11e-2 | 4.7512 | -1.13e-3 | -1.34e-2 | -3.23e-2 |
| day 1 sleep debt | 2.0000 | 2.0000 | 2.0000 | -1.78e-14 | -1.60e-14 | 2.0000 | 8.60e-13 | 8.42e-13 | 8.44e-13 |
| day 1 alertness | 0.7800 | 0.7800 | 0.7800 | 0.00e+0 | 0.00e+0 | 0.7800 | 0.00e+0 | 0.00e+0 | 0.00e+0 |
| day 1 core temperature (C) | 37.0000 | 37.0000 | 37.0000 | 0.00e+0 | 0.00e+0 | 37.0000 | 0.00e+0 | 0.00e+0 | 0.00e+0 |
| day 1 room CO2 peak (ppm) | 1377.4156 | 1383.7084 | 2046.9347 | 6.29e+0 | 6.70e+2 | 1376.7402 | 6.75e-1 | 6.97e+0 | 6.70e+2 |

### Neurology circuit outputs, end of week

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s |
|---|---|---|---|---|---|
| neurology.circuits.arousal | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.motor-control | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.reward-and-habit | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.attention | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.pain-gating | 0.0000 | 0.0000 | 0.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.memory-and-learning | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.breathing-drive | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.mood-regulation | 0.0000 | 0.0000 | 0.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.fear-and-stress | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.appetite | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |
| neurology.circuits.sleep | 1.0000 | 1.0000 | 1.0000 | 0.00e+0 | 0.00e+0 |

Muscular 3CC group shown: `forearm_flex.L` (largest fatigued fraction at 60 s, day 1, 12:00). All groups and sides are in the run data.

### Muscular 3CC compartments at the end of each work block, all seven days

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s |
|---|---|---|---|---|---|
| day 1 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 1 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 1 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 1 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 1 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 1 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 2 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 2 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 2 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 2 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 2 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 2 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 3 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 3 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 3 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 3 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 3 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 3 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 4 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 4 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 4 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 4 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 4 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 4 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 5 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 5 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 5 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 5 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 5 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 5 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 6 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 6 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 6 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 6 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 6 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 6 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 7 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 7 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 7 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |
| day 7 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 |
| day 7 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 |
| day 7 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 |

### Muscular 3CC compartments, day 1, against the 1 s reference

| quantity | 60 s | 600 s | 3600 s | 600 s − 60 s | 3600 s − 60 s | 1 s (day 1) | 60 s − 1 s | 600 s − 1 s | 3600 s − 1 s |
|---|---|---|---|---|---|---|---|---|---|
| day 1 12:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 | 0.000750 | 0.00e+0 | -1.11e-16 | -1.11e-16 |
| day 1 12:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 | 0.061257 | -5.07e-15 | -5.13e-15 | -5.13e-15 |
| day 1 12:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 | 0.937993 | 5.11e-15 | 5.22e-15 | 5.22e-15 |
| day 1 17:00 resting | 0.000750 | 0.000750 | 0.000750 | -1.11e-16 | -1.11e-16 | 0.000750 | 0.00e+0 | -1.11e-16 | -1.11e-16 |
| day 1 17:00 active | 0.061257 | 0.061257 | 0.061257 | -6.25e-17 | -6.25e-17 | 0.061257 | -5.07e-15 | -5.13e-15 | -5.13e-15 |
| day 1 17:00 fatigued | 0.937993 | 0.937993 | 0.937993 | 1.11e-16 | 1.11e-16 | 0.937993 | 5.11e-15 | 5.22e-15 | 5.22e-15 |

Largest absolute difference over every group, side and compartment at the day-1 block ends: 60 s against 1 s 7.99e-15; 600 s against 1 s 8.10e-15; 3600 s against 1 s 8.10e-15.

### Largest difference from 60 s, per quantity

| quantity | 600 s: largest | at | 3600 s: largest | at |
|---|---|---|---|---|
| Water ledger and body water | 8.69e-3 | body water, end of week (kg) | 2.84e-2 | body water, end of week (kg) |
| intake | 0.00e+0 | day 1 intake | 0.00e+0 | day 1 intake |
| expenditure | 1.55e+0 | day 1 expenditure | 6.91e+0 | day 1 expenditure |
| stored | 1.55e+0 | day 1 stored | 6.91e+0 | day 1 stored |
| body mass (kg) | 1.23e-2 | day 1 body mass (kg) | 3.12e-2 | day 1 body mass (kg) |
| water deficit (kg) | 1.25e-2 | day 1 water deficit (kg) | 3.21e-2 | day 1 water deficit (kg) |
| body water (kg) | 1.25e-2 | day 1 body water (kg) | 3.21e-2 | day 1 body water (kg) |
| water out (kg) | 1.23e-2 | day 1 water out (kg) | 3.11e-2 | day 1 water out (kg) |
| sleep debt | 1.07e-13 | day 7 sleep debt | 9.95e-14 | day 7 sleep debt |
| alertness | 6.24e-2 | day 2 alertness | 0.00e+0 | day 1 alertness |
| core temperature (C) | 0.00e+0 | day 1 core temperature (C) | 0.00e+0 | day 1 core temperature (C) |
| room CO2 peak (ppm) | 7.78e+1 | day 6 room CO2 peak (ppm) | 6.70e+2 | day 7 room CO2 peak (ppm) |
| Neurology circuit outputs, end of week | 0.00e+0 | neurology.circuits.arousal | 0.00e+0 | neurology.circuits.arousal |
| Muscular 3CC compartments at the end of each work block, all seven days | 1.11e-16 | day 1 12:00 resting | 1.11e-16 | day 1 12:00 resting |

### Wall time per simulated day (ms)

Machine: 16 cores (`os.cpus().length`). The 1 s run covers day 1 only.

| process | 60 s | 600 s | 3600 s | 1 s |
|---|---|---|---|---|
| circumstances | 4.0 | 0.6 | 0.3 | 86.7 |
| room | 13.2 | 1.5 | 0.4 | 541.1 |
| environment | 12.7 | 1.2 | 0.2 | 492.2 |
| physiology | 42.1 | 5.0 | 0.6 | 1755.0 |
| breathing | 11.4 | 0.9 | 0.1 | 479.7 |
| nutrition | 1.5 | 0.2 | 0.1 | 56.4 |
| neurology | 91.3 | 8.9 | 1.3 | 4218.0 |
| muscular | 129.2 | 11.3 | 1.9 | 5787.0 |
| setup, audit, ledger checks (unwrapped) | 368.6 | 35.4 | 6.3 | 17121.4 |
| total | 674.0 | 65.0 | 11.3 | 30537.6 |

### Dominant process by step

- 60 s: muscular is the largest process (19% of total wall time); the unwrapped harness (setup, audit, ledger checks) is 55%
- 600 s: muscular is the largest process (17% of total wall time); the unwrapped harness (setup, audit, ledger checks) is 54%
- 3600 s: muscular is the largest process (17% of total wall time); the unwrapped harness (setup, audit, ledger checks) is 56%
- 1 s: muscular is the largest process (19% of total wall time); the unwrapped harness (setup, audit, ledger checks) is 56%
