# Checkpoints

## Checkpoint 1 — human week (2525, 2026-10-29)

Run `node --experimental-strip-types examples/human-week.ts`.
Run the gate: `npx vitest run && npx tsc --noEmit && node --experimental-strip-types examples/human-week.ts > /dev/null`
(PowerShell uses `$null` for the final redirect.)

The example declares its synthetic day, body, initial reserves, meal masses, drinks,
work schedule and door schedule. This is a prescribed experiment, not weather data,
a recommended diet, or a game adapter. Seven complete 05:00–05:00 days use 60 s
steps (the occupied-box library row). Normal sleep is 23:00–05:00; nights 3 and 5
replace 23:00–01:00 with watch. The remaining four hours are continuous sleep,
so the table's 4-on/4-off quality penalty is not applied. The fixed outdoor day
(18 C at 05:00, 24 C at 15:00) repeats via `environment.diurnalC`; humidity follows
the inherited outside water mixing ratio and the room's vapour balance.

Order: circumstances (food, drinking, door, outdoor curve), room ventilation,
environment (room temperature/humidity to WBGT), physiology, breathing,
nutrition, neurology, audit, then `World.afterStep`. METs and food composition
come from library ids; ACH 0.2/2 comes from the ventilation-events example.
The environment's zero-offset exposure row is a named WBGT baseline, not a claim
that the room is a ship's deck. No game imports, servers, downloads or agents.

The ledger prints daily kcal in/out and storage change, mass, water deficit,
sleep debt, alertness, core temperature, room CO2 peak, all pooled nutrient
levels/stages and circuits keyed by their library row ids. Outputs are retained
at full precision for tests; printed numbers are rounded only for readability.

### What passed

- All seven days close on the final interval, with no extra step or eighth-day
  meal. Physiology and nutrition previously closed at the start of the following
  step, including that step's expenditure in nutrition. Both now close after
  accumulating the final interval. Integer elapsed seconds are combined before
  converting to hours, avoiding a floating-point miss at midnight.
- Each day's food energy matches the food rows; intake minus expenditure equals
  storage change within 1% (actual floating-point residuals are much smaller).
  Pending energy is traced between the daily storage updates and checked each step.
- Water closes for the body and body-plus-room, including food, drinks, sweat
  and ventilation. All pooled nutrient masses and room O2/CO2/N2 close each step.
  Room elements close too. `World` now accepts the deliberately empty chemical
  formulas of mass-only nutrient/drug ledger substances; malformed nonempty
  formulas still go through the strict parser.
- Weekly mass change matches the library's fat/glycogen energy accounting.
  Sleep debt is 2, 4, 8, 10, 14, 16, 18 h. Alertness matches the corresponding
  debt row times the 02:00–06:00 circadian factor, including both watch nights.
- A controlled, isothermal replay of one sleeper in the same 40 m3 room at
  shut-door ACH matches the continuous box-model CO2 peak within 1%, including
  oxygen consumption in the mole-fraction denominator. This isolates the box
  equation from the week run's changing temperature, sweat and body mass; it
  does not pretend those changing conditions have a constant-source solution.
- Every numeric output is finite at every minute. All transfers are finite.
  The week takes roughly 1.5–2 seconds locally, below the 20 s acceptance bound.
- Gate: 140 tests in 11 files passed, including the unchanged still tests;
  TypeScript and the shell example passed. No existing tolerance was loosened.

### What it cannot prove — FLAGS touched

The following existing FLAGS remain limitations, not new fitted coefficients.
Unmentioned grid, fire, toxic-dose, drug-withdrawal, cold-water and disease paths
are not exercised. No unsupported calibration has been enabled for this checkpoint.

| Module / FLAGS topics touched | Scope and limitation |
| --- | --- |
| Physiology: sweat, skin area/h, thermoregulating tissue vs core | Superseded by `hydration-week` (2540, below): ISO 7730 heat balance, DuBois area. Until 2540 the fixture lost its full 40 kg of water by day 7. The comfort skin temperature, the lack of clothing and the dripping are FLAGS limits. Energy bookkeeping is still not validation of heat control. |
| Physiology: hydration threshold shift, core cooling, shade bonus, heat-day definition, cold drift | Urine, breath, skin diffusion and metabolic water now move water (2540). Cooling and cold paths remain absent. The daily sheltered core reset is the library rule; a constant final core does not prove thermal safety. No shade bonus is added; heat acclimatisation keeps its any-hot-step definition. |
| Physiology: sleep quality and debt cap | Continuous six/four-hour nights use no unsupported quality weights or debt cap. No split-night or sleep-quality calibration is claimed. |
| Nutrition: starting fat, lean catabolism, starvation clock, glycogen water/body mass | Initial fat and water are declared host inputs. Mass is fat + glycogen with bound water (3 g/g, unsourced: flags/nutrition.md) + the water ledger's change (checked as `mass:body`); it excludes food oxidation and lean tissue. No survival/death or starvation-stage inference is made. |
| Nutrition: deficiency stages, pools without reserves, recovery clocks | Only numeric pooled reserves and stage 1 are exercised. Sodium and magnesium stay full all week on the supper's salt beef and dried pease (2554); the old day-1 sodium depletion was the pool cap taken at eating time, before the day's use, plus an unsalted diet. The table's daily use is drawn from the absorbed amount, so magnesium needs about 1 g eaten a day. Unpooled nutrients have no invented reserve; stages 2/3 stay disabled. A seven-day run cannot validate long deficiency/recovery times. |
| Nutrition: absorption, food classes, missing vitamins, protein quality | Existing meal absorption and named fish classification are used; missing vitamin D/iodine, protein quality and unpooled chemistry remain unsupported. No flux, raw-fish, alcohol, cooking or grain modifiers are added. |
| Nutrition: fullness/hunger/appetite | Meals are prescribed. No automatic hunger or appetite signal is fabricated for neurology. |
| Atmosphere: breath water, gas source units, outside water/N2, gas layers | Breath water is absent. Sources remain litres at room conditions; outside humidity and argon folded into nitrogen retain existing assumptions. This is a well-mixed box, not stratification or a measured bedroom ventilation rate. |
| Atmosphere: body elemental ledger, A–a gradient and respiratory calculator, gas shifts/drive failure | Only the room has an elemental ledger; oxidised food chemistry cannot yet close across the body. Respiratory outputs retain the existing calculator and unmodelled pH/temperature/CO effects. No pathological drive or tissue-exchange validation. |
| Environment: diurnal extreme hours/interpolation, day length, WBGT error and wind/sun, vector exposure | Extreme values/hours and daylight are host fixture inputs. Existing interpolation and WBGT are reused, without an invented error bound, radiation model or climate table. Vector exposure and sunburn time remain null. |
| Neurology: sleep clearance, baseline driver sizes and decay times, deficiency/genetics, liver function | The example explicitly marks asleep; the existing immediate adenosine reset and exercise/heat drivers are exercised. No deficiency effect size, starvation/hunger driver or liver model is fabricated. Day-end circuit snapshots do not prove cognition or dehydration survival. |
| Neurology: EC50/tolerance/rebound, inverted-U circuits, sleep quality, outputs/ranges | No drugs or calibration overrides are supplied. EC50 occupancies stay null and tolerance build stays off. Inverted-U terms and sleep quality remain disabled; circuit row ids, existing baseline-centred reads and clamps are reported, not validated against measured performance. |

The dehydration/continued-activity warning that stood here is fixed by 2540 (below).
Survival and activity shutdown under real dehydration remain untested.

### hydration-week (2540, 2026-10-30): sweat and water out

Test `test/hydration-week.test.ts`; the week's ledger now prints a `water` line per day.
The legacy sweat constants are gone (FLAGS.md, physiology). The water ledger is:

- in: drink, food water, and metabolic water (RQ x O2 by stoichiometry, with the library's RQ)
- out: sweat, skin diffusion and breath (ISO 7730 terms), and urine (Guyton and Hall:
  0.5 L/day obligatory, any surplus up to 12 L/day)

Sweat is the evaporation the heat balance requires at the ISO 7730 comfort skin
temperature, less the skin diffusion, at most the hydration source's 2.5 L/h.
A sourced sweat fit by MET and WBGT could not be opened (web access denied); see FLAGS.md.

Day 7 of the unchanged fixture (3 kg drink a day, 18–24 C, MET 3–6) (2565 refresh):

| Water | kg |
| --- | --- |
| In | 4.394 (food and drink 3.895, metabolic 0.499) |
| Out | 4.394 |
| Out: sweat | 2.399 |
| Out: urine | 1.03 |
| Out: skin diffusion | 0.571 |
| Out: breath | 0.394 |
| Deficit | 0.352 (0.503%, row `physiology.hydration.0-to-1`) |

(2565 refresh) The 2540 figures were 4.311 in and out (food and drink 3.813, metabolic 0.498), sweat 2.395,
urine 0.953, skin 0.570, breath 0.393, deficit 0.359 (0.51%). 2554 (supper gained 0.1 kg salt beef and 0.25 kg
dried pease, so more food water) moved them; 2552 and the later tasks did not change a water row beyond that.
The example does not print the dripped share, so the old "about 0.87 dripped" is dropped, not re-measured.
Days 2–7 now stay between 4.389 and 4.399 kg out. Day 1 passes 1.283 kg of urine while the first surplus clears
(2540: 1.21 kg), 4.751 kg out in all, with 2.502 kg of sweat.

### Week ledger, energy and mass (2565 refresh)

(2565 refresh) Copied from `examples/human-week.ts`. 2552 (body mass now counts glycogen and its bound water) and
2554 (supper gained 0.1 kg salt beef and 0.25 kg dried pease) changed these rows; no later task is known to have moved them (the run shows no sign of 2557, 2561 or 2564 in these columns).

| Day | kcal in | kcal out | Stored | Mass kg | Deficit kg | Sleep debt h | Alertness | CO2 peak ppm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4061.5 | 3730.297 | 331.203 | 69.686 | 0.357 | 2 | 0.780 | 1406.432 |
| 2 | 4061.5 | 3723.192 | 338.308 | 69.735 | 0.352 | 4 | 0.718 | 1402.016 |
| 3 | 4061.5 | 3799.743 | 261.757 | 69.774 | 0.347 | 8 | 0.718 | 1519.093 |
| 4 | 4061.5 | 3725.184 | 336.316 | 69.812 | 0.352 | 10 | 0.718 | 1488.978 |
| 5 | 4061.5 | 3801.533 | 259.967 | 69.851 | 0.347 | 14 | 0.640 | 1520.345 |
| 6 | 4061.5 | 3726.934 | 334.566 | 69.889 | 0.352 | 16 | 0.640 | 1490.196 |
| 7 | 4061.5 | 3727.797 | 333.703 | 69.933 | 0.352 | 18 | 0.640 | 1404.973 |

Core temperature prints 37.000 every day. Mass rises 0.247 kg over the week (69.686 to 69.933), where the
fat-only proxy before 2552 gave 69.537 on day 7. Sodium and magnesium pools print full on every day.

Across the week the deficit stays between -0.90% and 1.59%. The peak is day 1 at 17:58,
after the 15:00–17:00 carpentry and smithing hours (2540 figures: the example prints only day-end
deficits, 0.496% to 0.51%, so the minute-level range is not re-measured here). Every minute is inside the table's
mild band (the rows under 2%, "1 to 2": thirst, Endurance pool x0.95).

The daily water out, about 4.4 kg (2565 refresh: 4.389 to 4.399 on days 2–7), is above the library's 3.7 L/day total need (PHY-HYD) for a
man doing eight hours of MET 3 to 6 work. Mass is 69.933 kg on day 7 (2565 refresh; the 2540 fat-only proxy gave 69.537, before
2552 added glycogen and its bound water).

A MET 6 worker in a 32 C, 50% room (BoM WBGT 31.4 C, core 37.85 C after an hour) loses
water in the first hour as follows:

| Hot fixture, first hour | L |
| --- | --- |
| Sweat | 0.728 |
| Breath | 0.042 |
| Urine (obligatory) | 0.021 |
| Skin diffusion | 0.013 |
| Metabolic water made | 0.055 |
| Net loss | 0.75 |

Both the sweat and the net loss are inside the hydration source's 0.5 to 2.5 L/h.

Water closes for the body and for body plus room every minute. Water leaving to the
`urine` and `drip` sinks and arriving from `oxidation` is traced. Sodium (2554): the pool is capped after the day's use, not at eating, and the fixture supper adds salt beef and dried pease; the sodium and magnesium pools stay full and the sodium ledger closes (food in = use + excreta + pool change).

## Checkpoint 2 — human wound (2531, 2026-10-30): partial, acceptance blocked

Run `node --experimental-strip-types examples/human-wound.ts`.
Gate: `npx vitest run && npx tsc --noEmit && node --experimental-strip-types examples/human-wound.ts > /dev/null`
(PowerShell uses `$null` for the redirect and separate commands with exit checks.)

The example runs three independent copies of checkpoint 1 with the same seed:
bound immediately, bound after one hour, and never bound. Output is interleaved
by day for comparison. A small optional extension hook in `runHumanWeek` adds
checkpoint processes before its existing audit; default checkpoint-1 behavior
and tests remain unchanged. Anatomy adds zero-mass organ/tissue views. Medicine
creates a class-II thrust at day 2 05:00. The left hand hauls for one minute at
08:00 on days 1 and 2 using the activation row and its MET in physiology, then
rests while the ordinary week duties continue. Medicine uses the day's work/rest,
nutrition and sleep factors. Organ snapshots run hourly after breathing and
medicine; muscle fractions and the existing mass proxy are checked every minute.

The daily ledger includes library-id blood volume, DO2 and medicine outputs,
organ functions below one and unknown organs, unknown thrust pain as null, sick
and wound lists, left-hand peak/end fatigue and crisis records. Right-hand
fatigue is null because it is not simulated. The three simulations are isolated,
not three people sharing one room. No wound-to-strength multiplier is invented.

**This checkpoint is not fully accepted.** The task's requested untreated
haemorrhage trajectory cannot be computed from the supplied library: there is
no thrust bleed rate or clotting value, no blood-volume-to-cardiac-output curve,
and no numeric downstream organ-cascade kinetics. Rates stay null; binding is
scheduled and recorded, but all three runs retain their blood and produce no
haemorrhage crisis. A separate test prescribes the circulation table's loss
amounts, verifies class III/IV perfusion and the anatomy crisis record, and
verifies that no dead flag is set. That is a response to supplied loss, not a
predicted untreated wound course or a quantified DO2 failure.

The clean wound row gives 14–30 days, beyond the seven-day integrated run.
`healingReference` separately advances a bound wound with neutral healing
factors through the row's maximum. Seed 1 heals on its drawn day (14); seed 2
draws infection and remains paused. Neither result forces infection or clears
it. The integrated wounds remain open at day 7; their actual daily progress is
tested against the medicine healing multipliers, including the day-2 work rule.

Conservation checks cover blood volume, haemoglobin in the prescribed-loss
probe, muscle fractions, and the inherited energy/water/nutrient/gas ledgers.
The body mass assertion checks nutrition's existing fat-only proxy and that
organ shells add no mass. Whole-body mass including shed blood is now a real test
(the second former TODO): shed blood leaves body mass at the library blood density
(`circulation.quantities.blood-density`, 1.06 kg/L), traced as `mass:blood`. The
timed untreated-crisis case remains an explicit TODO test. Checkpoint 1's continued-activity
and other limitations above still apply. See FLAGS.md's
checkpoint-2 section for missing inputs; no unsupported calibration is enabled.

Validation (2531): full gate passed on 2026-10-30: 216 tests passed in 18 files,
2 explicit checkpoint-2 TODOs; `npx tsc --noEmit` passed; the shell example
exited 0. Existing still and checkpoint-1 tests were unchanged and passed.
The TODOs mean a green executable gate does not imply full checkpoint acceptance.

### Re-run on the hydrated body (2551, 2026-10-30)

Fix 10 of the 2026-10-30 b review. The first run (2531) rode on the week that lost its
full 40 kg of water; the week is now hydrated (2540 sweat and water out, 2541 body mass
water and glycogen, 2547 circulation time constants and cardiac output, 2546 wound
bleed-rate slot, 2550 hygiene and treated death). `examples/human-wound.ts` was re-run
unchanged: 3 variants x 7 days, exit 0, 187,430 transfers and 276,485 checks per variant,
0 conservation failures. Filtered `test/checkpoint2.test.ts`: 4 passed, 1 todo (one
fewer todo than the 2531 validation, because shed-blood body mass is now a real test).

2560 sourcing pass: `examples/human-wound.ts` re-run with the sourced muscular F and R and the 20 L/min maximal output: 3 variants, 194,285 transfers and 276,492 checks per variant, 0 conservation failures.

(2565 refresh) Figures in this subsection re-run after 2552, 2554, 2557, 2560, 2561 and 2564. The direction of
cardiac output and DO2 flipped from the 2551 text: they now rise day by day (4.877977, 4.881352, 4.884099,
4.886783, 4.889515, 4.892183, 4.895214 L/min; DO2 947.613, 948.278, 948.614, 949.330, 949.664, 950.377, 950.965 mL/min)
instead of easing; each figure was traced by running `examples/human-wound.ts` at the commits in between (2565 cause).
Day-1 and day-7 cardiac output (L/min), day-1 DO2 (mL/min) and the left-hand fatigue peak: `100b0f1` (before 2552)
4.9 and 4.867535, DO2 951.892, peak 0.1096; `ba246eb` (2552 body mass) 4.823890 and 4.732858, DO2 937.106, peak 0.1096;
`62976fb` (2552 nutrition pool cap) 4.877977 and 4.895214, DO2 947.613, peak 0.1096. So the direction flip, from easing to
rising, came with `62976fb` (2565 cause). `e60e19c` (2557) and `e723c87` print the same figures as `62976fb` to the last digit
(2557 moved nothing), as does `e9cfdd4` (2561) against `37bfccf`. The fatigue peak jump from 0.1096 to 0.4250 (day 3 peak
4.1e-22) came with `37bfccf`, the 2560 sourced grip F and R rates (2565 cause). Only the transfer count moved there, 187,475 to
194,285; checks stayed 276,492. Whether a daily cardiac output rise while wounded and untreated matches the circulation rows:
it does not. The rows (`data/library/circulation.json`, `flags/circulation.md`, PHASES-4-5.md) lower output with volume loss
and give no row that raises it, and the thrust bleed rate is null, so the wound removes no blood in this week. The rise
comes from the nutrition and body-water ledger and is not a response to the wound: for Rex. The old 0.110 fatigue
peak and 6.0 progress days were the 2551 figures and are replaced. Verdicts did not flip: `organsUnderOne` is empty,
no organ is unknown, nobody is sick and no crisis is recorded in any variant on any day (2561's crisis paths stay closed
because the thrust bleed rate is still null). The run still reports 194,285 transfers and 276,492 checks per variant, 0 failures.

Rows that moved: the day ledgers now sit on the hydrated body, so no organ falls below
one (`organsUnderOne` empty), no organ is unknown, nobody is sick and no crisis is
recorded in any variant on any day; cardiac output now rises from 4.877977 L/min on day 1 to
4.895214 L/min on day 7 and DO2 from 947.613 to 950.965 mL/min (blood volume 4900 mL, Hb 15,
unchanged in all three variants). Left-hand fatigue peaks at 0.425 on days 1 and 2 and is
essentially recovered from day 3 (peak 4.1e-22, end 4.1e-46 on day 3, falling to 3.6e-118 and 3.6e-142 on day 7). The wound
(drawn at day 2) reaches 7.810 days of progress at day 7 with open=false and healed=false in all three variants (bound = true in the
two bound variants, false in the third); none heals inside the week (clean healing is 14 to 30 days;
the neutral-factor reference heals on day 14 for seed 1).

Rows that did not move, and why: the three variants still match to the last digit in blood
volume, DO2 and organs, because the thrust bleed rate and clotting remain **null**: no
cited source gives a mL/min or clotting value (flags/checkpoint-2.md, the 2546 search).
Thrust pain stays null for the same reason. So the example does **not** show bound-at-once
versus never-bound blood trajectories.

Todos that remain: the timed untreated-crisis acceptance case (one `it.todo`) needs a
cited bleed rate and a volume-to-flow curve with cascade kinetics, none of which exist
in the library. The row therefore stays "partial, acceptance blocked".

### Every death opens a crisis; water exhaustion (2561, 2026-10-30)

Asked by the pirate-ship lane's review of 2538 and 2539. The crisis record is now one type, `Crisis` in
`src/crisis.ts` (exported from `src/index.ts`), kept in `world.trace.crises`: `cause`, `source` (the row that
justifies it), `risk` (null where the row gives no number, and nothing is rolled for a null), `startedAt`,
`durationSeconds`, `resolvedAt`. The anatomy and medicine crisis shapes are gone; `MedicineCrisis` is `Crisis`.
Paths that open one: a disease or inoculation death draw and an air condition (medicine; they reach the trace at the
next medicine step), an organ under its floor (anatomy), a loss at the circulation row that says "dying" (class IV,
opened by `circulationProcess` itself, so a body with a wound and circulation but no anatomy still gets it), and a
water deficit in the hydration rows that say work stops or death. `declareDeath(w, body, cause)` is the only thing
that sets `props.dead`, and it throws for a body with no crisis in the trace; the engine never calls it.

Water exhaustion reads the `physiology.hydration` rows. "6 to 10" says "incapacitated" and "over 10" says "death risk
per hour", so each opens a crisis at its lower bound (source: the row id and its effect); the output
`work_capacity_hydration` is 1 for the "none" row, 0 for those two, and null for the rows that give no work figure
(the Endurance and Strength factors act on pools, not on work capacity). The "4 to 6" row's "collapse risk in heat"
has no number and no stop, so it opens nothing. The body also keeps `work_capacity_heat` (the core temperature's),
and combining the two is the host's.

Tests: `test/hydration-week.test.ts` runs a hard worker in a hot room with nothing to drink until the over-10 band: a
crisis exists exactly when the deficit is in or past the row's band, work capacity follows the row, no dead flag,
`declareDeath` refuses a body with no crisis and then works. `test/checkpoint2.test.ts` adds the never-bound and
bound-at-once bleeding runs. The library still has no thrust bleed rate (the todo stands), so those two runs impose a
host rate of 200 mL/min with clotting 0: they test the path from a bleeding wound to its class IV crisis before any
death, not a predicted course. Bound at once, no blood is lost and no crisis opens. The 2531 variants are unchanged
(rate null, no crisis).

## Independence (2532, 2026-10-30): the engine alone, a horse in a stable

Run `node --experimental-strip-types examples/horse-stable.ts`; test `test/independence.test.ts`.
Thirty days, a 500 kg horse (the `anatomy.species` "A horse (example)" column) in a 60 m3 stable with the
library's 2 ACH, the human-week weather extrema, no stable-hand hazards. Ration 1 x Kleiber RMR
(70 x kg^0.75 = 7,402 kcal/day) fed hourly, water drunk to the deficit. Per day the ledger prints kcal in and
out, stored kcal and mass proxy, water in and held, CO2 peak (about 810 ppm), ventilation (28.025?28.027 L/min), heart output
(0.07 L/min/kg x mass = 35 L/min), organ functions and MET-hours. The run closes: 30 days, 0 conservation
failures (water, O2/CO2/N2, elements), energy in = out, no NaN. Nothing under `src/` or `examples/` mentions
the game; `package.json` has no game dependency; no game import exists.

**What it cannot show (FLAGS.md, independence).** There is no hay or horse-oats row, so feed is kcal and water
only; no horse MET, so the two working hours run at rest (workMet null) and the energy balance is zero by
construction of the ration; no horse respiratory, haemoglobin, skin-area, sweat or muscle rows, so breathing
uses the human per-kg profile as a named stand-in, circulation is off, muscle fatigue is null and organ
functions stay 1 (no insult is applied). The test asserts the horse's own rows (RMR, cardiac output, blood
volume, set point) and that breathing equals the profile function of the stable's air. It shows the engine
takes a second species from library columns with no game code; it does not validate equine physiology.

(2621) Horse gas figures now use physiology's Kleiber-scaled metabolic power: a fresh thirty-day run gives day-1 CO2 peak 809.712 ppm and ventilation 28.025 L/min, with 0 conservation failures; published human checkpoint rows are retained unchanged as requested. The new human run has day-1 CO2 peak 1378.817 ppm versus the published 1406.432: the human fixture also has a non-reference RMR, so unchanged gas numbers conflict with the single energy owner. Treat the historical human gas column as superseded, not as a current-run assertion.
