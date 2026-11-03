# LN-3 gastric emptying: stomach to small intestine over time

Research unit 5562 ({R-TRANSIT}, LN-3), 2026-11-03. Research only: no code, no registry edit. Fills the emptying step of
`plans/life/PLAN.md` §3.A6.1 and the LN-3 row of §8.1, in the template of `plans/life/lanes/RESEARCH-CARD.md`. Rows are
`validation.gastric_emptying.*` in `research/LN-3-gastric-emptying.table.json`; sources are the `TR-*` keys in
`sources.json` (and `IL-ABELL-2008`). Evidence levels follow the convention in `flags/` as used by 5561 (PLATFORM §4 was
outside this unit's read list, so the keeper should confirm): 3 a measured study read at abstract or table level, 4 a
review, consensus or relayed secondary text, 5 derived by me or unsourced.

> **Blocker recorded (same as 5561).** The table is held at `research/LN-3-gastric-emptying.table.json`, not in
> `data/library/validation/`, and is **not** listed in `index.json`. `scripts/check_library.py` requires every file in
> `validation/` to be listed in `index.json`, and `test/library-loader.test.ts` fails for a listed table that
> `src/library.ts` does not import (that file imports each validation table by name). This unit may not touch `src/`, so
> the Gate's two requirements cannot both hold. Follow-up for the keeper: move the file to
> `data/library/validation/gastric_emptying.json`, add `gastric_emptying` to `index.json`, add the import and map entry in
> `src/library.ts`, rebuild `dist`.

## 0. Question and scope

- **Quantity or mechanism needed:** the fraction of a meal still in the stomach as a function of time, and what leaves
  with it (mass, water, energy, each nutrient), from the end of eating (5561's time zero) to the small intestine.
- **Conditions the milestone must support:** the declared M1a person (a healthy adult) eating a bread preparation
  (the 1270 loaf); one meal at a time and meals some hours apart; no age, sex, illness or body-composition modifiers.
- **Recorded as later extensions (not prerequisites):** meals eaten before the last has emptied; fat-rich or very
  large meals; liquids drunk with the meal; fibre-rich bread; sex, smoking, menstrual phase; illness (delayed or rapid
  emptying); energy-limited feedback for nutrient liquids.

## 1. Relationship, source and conditions

### 1.A Candidates

| # | Form | Source (level) | Meal / population it covers | Where it stops |
|---|---|---|---|---|
| A | **First-order retention** `y(t) = exp(-k t)`, `T1/2 = ln 2 / k` | Special case beta = 1 of B (Siegel 1988, quoted in a search summary; level 4). Rex's candidate in PLAN §8.4 | none of the opened solid-meal sources reports a mono-exponential | has no lag, so it empties 15% in the first 15 min of a meal whose lag is 49 min (my arithmetic, level 5) |
| B | **Lag, then power exponential** `y(t) = 1 - (1 - exp(-k t))^beta` (`y` = fraction retained, `k` min⁻¹, `beta` >= 1 dimensionless). `T1/2 = -ln(1 - 0.5^(1/beta)) / k`. Lag as a derived quantity, two definitions: `ln(beta)/k` (Siegel; Revheim) or Couturier `ln(beta)/k - (beta-1)/(k beta)` (Vasavid) | Elashoff, Reedy, Meyer 1982 (abstract: recommends trying the power exponential, fit by nonlinear least squares; level 3); Siegel 1988 (24 volunteers, egg and chicken-liver solids and a liquid; level 3); Revheim 2024 (22 adults, wheat and oat bread, ultrasound; level 3); Vasavid 2014 (189 adults, rice and egg, scintigraphy; level 3) | solids and liquids; bread (Revheim); healthy adults; meal sizes 141 to 267 kcal | fat-rich meals, illness and meals eaten on top of one another are not covered by any opened page; the lag differs with solid density, bread fibre and meal energy |
| C | **Energy-limited emptying**: a constant energy delivery rate (kcal/min) after a lag | Brener, Hendrix, McHugh 1983 (abstract: glucose left at a slow steady caloric rate; level 3); Hunt and Stubbs 1975 (abstract: denser meals deliver less volume but more energy per minute; 4 g fat, 9 g carbohydrate or protein slow emptying equally; level 3); Calbet and MacLean 1997 (half-time rose with caloric density, r = 0.96; level 3) | nutrient **liquids** (50 to 1250 mL, 600 mL) in healthy adults | solids and bread: no opened page measures a kcal/min rate for a solid; **no kcal/min number was on any opened page** (row `energy-limited-delivery-rate` is null) |
| D | **Two-stage chain** (proximal then distal stomach, both first-order) | anatomical support only: Collins 1991, relayed from search text, page not opened (level 4). No opened page fits it to retention data | none | my fit (below) shows it still empties 4% in 15 min and fits worse than B |
| E | **Constant rate (zero-order) after the lag** | Siegel 1988: the curve is biphasic, a lag and then a phase of constant rate (level 3) | solids | not a stand-alone form: the full curve has a finite tail, which B reproduces |

- **Do constituents leave in proportion?** Only after the lag, and only as the sources say. Siegel 1988 (dual-label,
  opened abstract): after the lag, solids empty at rates similar to liquids. Collins 1991 (relayed, level 4): during the
  solid lag the liquid leaves first and solids wait in the proximal stomach. So **proportional leaving is a supported
  approximation after the lag and a simplification during it**. The meal's water is the constituent most at risk. For
  a bread meal no source gives a constituent-by-constituent emptying measurement.
- **Form check (my arithmetic, level 5; not a parameter source).** Fitting three forms to the median retention of two
  independent scintigraphy sets, by least squares on the reported percentages:

  | Form | Tougas 2000 medians 69, 24, 1.2% at 60, 120, 240 min (relayed) | Vasavid 2014 medians 61.8, 16.3, 3.4, 1.1% at 1 to 4 h |
  |---|---|---|
  | B power exponential | k = 0.0224, beta = 3.9 gives 69.2, 24.0, 1.8% | k = 0.0268, beta = 4.3 gives 61.8, 16.1, 3.4, 0.7% |
  | A first-order | T1/2 71 min gives 55.6, 30.9, 9.5% | gives 48.1, 23.1, 11.1, 5.3% |
  | D two-stage chain | gives 64.1, 28.3, 3.9% | gives 56.8, 20.8, 6.6, 1.9% |

  The sum of squared errors is about 4e-5 for B against about 5e-3 for D, and A is worse at both ends (it leaves too
  little at 1 h and too much at 4 h). This says B has the shape; it does not say B's parameters, which are below.
- **Existing machinery.** The scintigraphic standard (Abell 2008 consensus) reads percent retention at 0, 1, 2 and 4 h
  and compares them with reference ranges, and Zinsmeister 2012 (155 subjects) shows T1/2 from those hourly points
  agrees with the full series (median difference -0.2 min, 5th to 95th percentiles -7.5 to 4.6). Elashoff 1982 is the
  origin of the practice of fitting the power exponential. No opened page reports a prediction made before the data
  from B (the form is descriptive).
- **Proposed (a proposal; the Life keeper selects).** **B, with every constituent of one meal leaving in the same
  fraction** (`amount_out(a,b) = m_c0 [ y(a - t0) - y(b - t0) ]`), `t0` = end of eating (5561). Why: (1) it is the form
  fitted to a bread meal in a healthy adult population (Revheim) and to the other solid meals; (2) it reproduces the
  lag that A and D lack (above); (3) it has a closed form, so any step is exact (section 4); (4) one retention fraction
  per meal keeps the four balances of PLAN A6 closed by construction. Its cost: it is **not a function of the stomach's
  current state alone**, so the stomach account needs one record per meal (amounts and `t0`), which LN-2 §2 does not yet
  hold. Rex's first-order candidate (A) is the cheaper alternative if the keeper accepts a retention error of up to
  about 19 percentage points in the first hour against the bread-calibrated B (0.715 against 0.906 at 30 min), 13 points
  at 1 h against the Tougas median, and a factor of 8 at 4 h; the card does not recommend that unless the lag never
  matters to a test.
- **Where it stops applying.** Adults, a 140 to 270 kcal solid meal of low fat, eaten once; not a liquid-only meal
  (liquids have a half-time of 10 to 30 min with no lag in Calbet), not a fat-rich or very large meal, not a second
  meal on top of the first, not illness. Overlap of meals is **open**: B is a per-meal curve and no opened page says
  how the cohorts interact; the proposal treats cohorts as independent (no source) and the card records that.

### 1.B Time zero

Abell 2008: time 0 is the first image set immediately after eating. Revheim 2024: time zero is the start of eating.
5561 proposed `t0 = t_start + q/r` (end of eating). The two conventions differ by the eating time (6 min for 60 g at
10 g/min, about 10% of a T1/2 of 62 min); the proposal keeps 5561's. Note for the keeper: Revheim's published times
include that interval.

## 2. State variables, units, compartments, owner

| Quantity | Unit | Owner | Note |
|---|---|---|---|
| `m_c0(i)`, constituent amount of meal `i` at `t0` | LN-1's unit per constituent (kg for mass and water, kcal, g or mg for nutrients) | `life.gut` stomach account (LN-2 §2) | one record per meal; new relative to LN-2 §2 |
| `t0(i)` | s (kernel time) | the resolver / Life | = end of eating |
| `k`, `beta`, optional `T_lag` | min⁻¹, dimensionless, min | Life parameter row | missing means configuration fails (never zero, PLAN §8.4) |
| `S_c = sum_i m_c0(i) y(t - t0(i))` | as above | derived read of the stomach account | the account's content is the sum over meals |
| outflow `m_c0 [y(a - t0) - y(b - t0)]` | as above | LN-3 writer of an internal transfer stomach to intestine | conserving; the intestine's inflow is LN-4's |

Boundary: ingestion is LN-2's; the intestine is LN-4's. LN-3 owns only the stomach to intestine transfer.

## 3. Parameters, sources, uncertainty

| Source | Participants | Meal / conditions | Method | Outcome (as reported) | Normalised | Uncertainty | Used for |
|---|---|---|---|---|---|---|---|
| Revheim 2024 | 22 healthy adults, 24.6 +/- 3.1 y, BMI 23.1 | 60.1 g whole-wheat bread, 141 kcal, 25.6 g moisture; time zero at the start of eating | ultrasound antral area, 15 to 120 min, power-exponential fit per person (R2 0.93) | T1/2 61.9 min (53.5 to 71.8), lag 49.1 +/- 19.6 min, k 0.05 min⁻¹ (0.04 to 0.08); oat bread T1/2 78.9, lag 63.3 | k = 0.0337, beta = 5.24 solved from lag and T1/2 (derived) | CI of the geometric mean; SD of lag | **calibration** (`k`, `beta`) |
| Siegel 1988 | 24 normal volunteers | egg and chicken-liver solids, dual-label | scintigraphy, power exponential | lag 31 +/- 8 and 62 +/- 16 min; T1/2 77.6 +/- 11.2 and 94.1 +/- 14.2 min | none | spread not labelled | form and condition dependence (solid density) |
| Elashoff 1982 | several studies | various meals | statistics | recommends power exponential, nonlinear least squares | none | none | form |
| Tougas 2000 (relayed) | 123 healthy, 19 to 73 y, 11 centres | low-fat egg-substitute meal (with bread and jam, per the Vasavid page) | scintigraphy | median retention 69, 24, 1.2% at 60, 120, 240 min; 95th percentiles 90, 60, 10% | none | percentiles | **validation** |
| Abell 2008 | consensus on the Tougas group | 255 kcal: egg white, two slices white bread, 30 g jam | scintigraphy | normal ranges 37 to 90, 30 to 60, 0 to 10% at 1, 2, 4 h | none | ranges | **validation** |
| Vasavid 2014 | 189 healthy Thai adults | 267 kcal rice and egg | scintigraphy, Couturier lag | lag 18.6 min (0.5 to 39.1), T1/2 68.7 (45.1 to 107.8), retention 61.8, 16.3, 3.4, 1.1% at 1 to 4 h | none | 5th to 95th percentiles | **validation** (not bread) |
| Hellmig 2006 | 90 healthy adults | solid test meal (composition not on the abstract), 13C breath test | breath test | solid T1/2 median 127 min (112.0 to 168.3); fluid 80.5 +/- 22.1 | none | quartiles | **validation** (a different quantity) |
| Calbet 1997, Hunt 1975, Brener 1983 | 6 healthy; 33 studies; abstract | liquids | aspiration; volumes delivered | half-time 9.4 to 26.4 min rising with caloric density (r = 0.96) | none | SD | condition dependence (energy density), liquids only |
| Zinsmeister 2012 | 155 | standard solid meal | scintigraphy | T1/2 from hourly scans differs from the full series by -0.2 min (-7.5 to 4.6) | none | percentiles | method |

- **The (k, beta) set is a calibration to one bread meal and is fragile.** Revheim prints k to one significant figure
  (0.05), so beta cannot be recovered from k: beta is 15 for k = 0.05, 11 for 0.045 and 20 for 0.055 (my arithmetic).
  Solving the lag (49.1) and T1/2 (61.9) instead gives beta 5.24 and k 0.0337 (derived, level 5, and it mixes a mean lag
  with a geometric-mean T1/2). Moving the lag by 1 SD (29.5 to 68.7 min) moves the solved beta from 1.7 to above 200,
  so **the reported spread of the lag cannot be carried into a spread of the parameters**. The proposal is the central
  values only; the keeper should not turn the lag SD into random per-person traits.
- **Condition dependence (evidence-supported only).** Meal energy and composition: increasing solid caloric content
  lengthened the lag and slowed the rate in healthy men (JNMT vol 18, abstract only, no numbers); in liquids half-time
  rose with caloric density (Calbet r = 0.96, Hunt and Stubbs). Solid density: lag 31 against 62 min (Siegel). Bread
  fibre: the oat bread (5.5 g fibre, 3.6 g beta-glucan) was 17 min slower to T1/2 and 14 min longer in lag than wheat
  bread (Revheim). Sex: women slower in Vasavid (74 against 63 min) but no effect of age, sex or BMI in Hellmig and
  similar sexes at 4 h in Tougas (relayed): the evidence conflicts, so **no sex, age or BMI modifier**. Smoking and
  menstrual phase (Vasavid) are not applied. The declared 1270 bread's own lag is not measured by any source: **open**.
- **Variation, kept apart.** Between people: the lag SD is 40% of its mean (19.6 of 49.1 min) and the 5th to 95th
  percentile of T1/2 in the rice meal spans 45 to 108 min. Within a person: no repeat-meal figure for emptying was found
  (Zinsmeister is a method comparison, not repeatability). Measurement error: ultrasound area readings had CVs of 6% and
  8% for the two researchers (Revheim); hourly against full scintigraphy series agree to a few minutes. Model uncertainty:
  the two lag definitions give different numbers for one curve (for the Tougas fit, 60.8 min by `ln(beta)/k` and 27.6 min
  by Couturier, my arithmetic), so lags from different papers cannot be compared; and the energy dependence across
  meals is confounded with method (ultrasound at 141 kcal against scintigraphy at 255 kcal).
- **Synthesis or meta-regression.** Not used: methods (ultrasound, scintigraphy, breath test), lag definitions and
  meals differ, so the studies cannot be pooled. They sit side by side.
- **Energy-limited emptying as a check on B.** Mean delivery over the whole emptying, from the same arithmetic, is
  about 1.1 kcal/min for both the 141 kcal bread (twice T1/2) and the 255 kcal meal (over 4 h); these are averages, not
  a limit, and **no opened source gives a kcal/min limit**. T1/2 rose by a factor 1.3 (62 to about 81 min by the Tougas
  fit) while meal energy rose 1.8 times, which is less than proportional; with different methods this cannot decide
  between B and C and is recorded, not used.

## 4. Numerical method and timing (step-convergence tolerance)

- **Method: an analytical update over the step.** For each meal cohort, the amount that leaves in `[a, b]` is
  `m_c0 [y(a - t0) - y(b - t0)]`, evaluated from the closed form. There is no time-stepping error; the cumulative amount
  emptied is identical for any step size that has the same end time, because the differences telescope.
  Step size therefore matters only for how often the transfer is written, not for its value.
- **Negative control (my arithmetic, level 5).** Explicit Euler on the derivative of B with `k = 0.05`, `beta = 15` and
  a 3600 s step drives the retained fraction to -0.21 at 240 min (exact: 0.0001); at 600 s and 60 s it is 0.0001.
  A fixed-step integration of this form is therefore unsafe at the step lengths of the LIFE-11 harness, which is the
  reason for the analytical form.
- **Tolerance.** Required accuracy follows from the validation (section 6): retention fractions are compared to
  percentage points, so the numerical error need only be far below 1 percentage point. The proposed acceptance is
  stricter than that and costs nothing: cumulative emptied at 60, 600 and 3600 s steps agree to **1e-9 relative**, and
  every balance closes to 1e-9 relative (PLAN §7). No invented band.
- **Timing.** Evaluated in the `fast` phase at each step from kernel time. First-order (A) would also be exact by
  `exp(-k h)`; the choice between them is about shape, not numerics.

## 5. Functional tests the build must pass

1. `y(t0) = 1`, `y` is non-increasing, `0 <= y <= 1`, and the outflow over any interval is >= 0 and never exceeds the
   cohort's remaining amount.
2. **Four balances** (mass, water, energy, each nutrient, separately, to 1e-9 relative) hold for stomach plus intestine
   across every step; a gram that leaves the stomach arrives in the intestine in the same transfer.
3. **Proportional leaving (declared simplification):** every constituent of a cohort leaves in the same fraction; a
   test asserts the intestine's inflow has the meal's composition. The test names it as a simplification during the lag.
4. **Step invariance:** a run with 60, 600 and 3600 s steps gives the same cumulative emptied amounts at common times
   to 1e-9 relative. A negative control with explicit Euler is not built.
5. **Lag:** with the bread parameters, at least 99% of the meal is retained at 15 min (the set gives 99.2%, derived).
6. **Time zero:** nothing leaves before `t0`; a transfer stamped at the start of eating fails the test.
7. **Two meals:** the stomach content is the sum of cohorts and a second meal does not change the first cohort's
   curve (declared independence, no source); the test labels it as an assumption.
8. **Configuration:** `k <= 0`, `beta < 1` or a missing parameter fails configuration before the run; a null is never read
   as zero or as instant emptying.
9. **Empty stomach, zero-quantity meal, rollback and one outcome per cause** are LN-2 §5's, unchanged.
10. The stomach's `gastric_fill_kg` read (PLAN A7) equals the sum over cohorts of retained mass.

## 6. Validation

- **Independent observations (not used for any parameter) and acceptance tolerance.** Held apart from the Revheim
  calibration: Tougas 2000 (relayed) and the Abell consensus ranges (bread-containing 255 kcal meal), Vasavid 2014
  (rice and egg), Hellmig 2006 (breath test), Siegel 1988 (egg and liver). Proposed tolerance (my choice, the keeper may
  change it): predicted retention at 1, 2 and 4 h falls inside the reported 5th to 95th percentile or normal range of the
  nearest meal, and the predicted T1/2 inside the reported 95% band of that meal.
- **What the proposed set does against them (my arithmetic, level 5).** The set `k = 0.0337, beta = 5.24` gives 52.4,
  8.8 and 0.2% at 60, 120 and 240 min. Against the consensus ranges: 52% is inside 37 to 90%; **8.8% at 2 h is below the
  30 to 60% range** and below Tougas' median of 24%; 0.2% is inside 0 to 10%. Against the rice meal's 5th to 95th
  percentile: 52% is inside 33 to 86%, 8.8% inside 2.7 to 49.8%, 0.2% inside 0.2 to 8.8%. So the calibrated bread
  empties faster than the 255 kcal consensus meal, which is in the direction the energy-dependence evidence points
  (141 against 255 kcal) but is confounded with method. **A 2 h failure against the consensus range is expected for a
  141 kcal bread and is not evidence that B is wrong; it means the parameters are specific to a small bread meal.** No
  validation is claimed; this is the first comparison to be run.
- **If none is available, say so.** No bread meal measured by scintigraphy with a fitted (k, beta) was found, and the
  Tougas numbers are relayed from a search summary, so the one independent bread-containing set is itself level 4.
  Breath-test T1/2 (127 min) is a different quantity from scintigraphic T1/2 and is context only. No independent data
  were found for: emptying during the minutes of eating, meal-on-meal overlap, constituent-by-constituent emptying of a
  solid meal, and a kcal/min limit for solids.

## 7. Status (PLAN §6 columns) and recommendation

- **Status:** designed.
- **Recommendation (a proposal).** Power exponential (B) per meal with `t0` = end of eating, `k = 0.0337 min⁻¹`,
  `beta = 5.24` (derived from Revheim's bread meal), constituents leaving in proportion, evaluated analytically. One
  coherent set, one meal, no modifiers.
- **Unresolved choices for the keeper or Rex.** (1) B with a per-meal record in the stomach account, or Rex's
  first-order A with its lack of lag (up to about 19 points in the first hour); (2) the parameter set: the Revheim bread
  (small, fast) or a scintigraphy-fitted set for the 255 kcal standard meal (`k = 0.0224, beta = 3.9`, which is a fit to
  the validation data and so cannot also validate); (3) whether the Revheim time-zero offset (6 min) matters; (4)
  whether energy should scale the lag (supported in direction by four sources, in size by none).
- **Limitations.** Parameters rest on one 22-person ultrasound study of one 60 g wheat bread, with `beta` solved
  from two summary statistics; the only independent bread set is relayed; the 1270 bread's lag is unknown; cohorts are
  assumed independent.
- **Optional extensions (never prerequisites).** A kcal/min feedback term once a source gives the limit for solids;
  fibre, sex and illness modifiers; meal-on-meal interaction; a liquid phase that leaves ahead of the solid in the lag
  (Collins).
