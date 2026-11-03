# LN-5 expenditure, stores and body mass: energy densities, the allocation model, the expenditure path

Research unit 5563 ({R-STORES}, LN-5), 2026-11-03. Research only: no code, no registry edit. Fills `plans/life/PLAN.md`
§3.A9 and the LN-5 row of §8.1, in the template of `plans/life/lanes/RESEARCH-CARD.md`. Rows are
`validation.energy_stores.*` (42) and `validation.body_composition_trajectories.*` (22); sources are the `ST-*` keys in
`sources.json`. Evidence levels follow the 5561 and 5562 convention (the keeper should confirm against PLATFORM §4,
outside this unit's read list): 3 a measured study read at abstract or table level, 4 a model paper, review, or relayed
text, 5 derived by me from figures on a page. "Relayed" means the figure came from search-result text and the page itself
was not read.

> **Blocker recorded (same as 5561 to 5562, and it blocks this unit's Gate as written).** The two tables are held at
> `research/LN-5-energy_stores.table.json` and `research/LN-5-body_composition_trajectories.table.json`, not in
> `data/library/validation/`. The Gate asks for `data/library/validation/energy_stores.json` and
> `body_composition_trajectories.json`, which `scripts/check_library.py` then requires to be listed in `index.json`, and
> `test/library-loader.test.ts` then fails for a listed table that `src/library.ts` does not import. I tried it: with
> both files copied in and listed, `check_library.py` passes and the loader test fails
> (`.toHaveProperty() expects to receive a valid object, but got undefined`, `test/library-loader.test.ts:15`). The two
> Gate lines cannot both hold without a `src/library.ts` edit, which the task forbids and the Gate's diff list excludes.
> Follow-up for the keeper: move the two files to `data/library/validation/`, list them in `index.json`, add the
> imports and map entries in `src/library.ts`, rebuild `dist`. Row ids and `source` keys already match.

## 0. Question and scope

- **Quantity or mechanism needed:** (a) the energy density of each represented store and the water bound with it, so the
  `body.mass` categories do not overlap (A9); (b) the allocation model, separate from the balance identity; (c) whether
  the built expenditure path (MET scaled to resting rate) agrees with doubly-labelled-water and chamber measurements;
  (d) whether a daily store update gives wrong within-day feedback; (e) held-apart trajectories for validation.
- **Conditions the milestone must support:** one healthy adult; a fed run of 30 days and a deprived run of up to 120
  days; stores are glycogen, fat and body protein (lean); `body.mass` is written only by Life.
- **Recorded as later extensions:** separate liver and muscle glycogen pools; adaptive thermogenesis; thermic effect of
  feeding; sodium-linked extracellular water; exercise training effects on body composition; the terminal thresholds
  (LN-9: fat floor, 60 % of start mass), which nothing here sources.

## 1. Relationship, source and conditions

### 1a. Energy densities and bound water, per the same mass unit (item 1 of the Task)

| Store | MJ/kg | kcal/g | Water bound (g per g) | Source, level |
|---|---|---|---|---|
| body fat (anhydrous) | 39.5 | 9.44 | 0 | Hall 2011 and Chow and Hall 2008, "fat is not associated with any water" (3, 4) |
| glycogen, dry | 17.6 | 4.21 | 2.7 | Hall 2011 appendix, Chow and Hall h_G (4); Kreitzman 1992: 3 to 4 (3) |
| glycogen with its water | 4.76 | 1.14 | - | derived 17.6/3.7 (5) |
| body protein, dry | 19.7 | 4.71 | 1.6 | Chow and Hall rho_P and h_P (4) |
| lean tissue (protein plus its water) | 7.6 | 1.82 | - | Hall 2011, Hall 2008; derived check 19.7/2.6 = 7.58 (4, 5) |

- The identity of A9 is then `rho_F dm_f + rho_G dm_g + rho_P dm_p = E_absorbed - E_expended` with the three constants
  above (kJ per g: 39.5, 17.6, 19.7). With lean tissue as the unit the same identity reads `rho_L dL` with 7.6 MJ/kg, and
  the two must not be mixed in one run (a lean kg already holds 1.6 g water per g protein).
- **Conflicts found, not resolved.** (i) The library row `nutrition.body_composition` says protein 4 kcal/g and fat 9; the
  model papers give 4.71 and 9.44 (4.21 for glycogen); the Atwater general factors are food values, not store values, and
  the page that obtained 19.7 is not on the text read. (ii) Water per glycogen: 2.7 (Hall), 3 (library row, King 2017),
  3 to 4 (Kreitzman). Fernandez-Elias 2015 prints a water-to-glycogen ratio of "1:3" and "1:17" for two recovery regimens
  but I could not check its definition (row recorded without a Value). (iii) A Japanese study quoted 1,020 kcal/kg for
  fat-free mass, against 1,820 here (search summary only, not opened); not used.
- **Non-overlapping categories (A9), proposed.** Hold three tissue terms, each with its own bound water, and let
  `body.water` be only the water outside them:
  `tissue = m_f + (1 + 1.6) m_p + (1 + 2.7) m_g + m_other`, where `m_other` is bone, minerals and any other non-water
  lean component (no source for its size in this unit: Hall computes initial lean mass as a difference); and
  `body.water` = extracellular water plus any intracellular water not bound to protein or glycogen. The hydration
  constant 0.73 of whole fat-free mass (Wang 1999, level 4) includes extracellular water and must not be applied to the
  lean term as well. With 500 g glycogen (Hall's input) the glycogen term is 500 g x 3.7 = 1.85 kg (derived, level 5).

### 1b. The allocation model: candidates the sources give

All candidates close the balance exactly; they differ in what they say about *which store* changes.

| # | Candidate | Form, as the page gives it | Applies to | Source, level |
|---|---|---|---|---|
| A | Hall 2006/2010 mechanistic fuel-selection model | fat, glycogen and protein masses with fluxes (de novo lipogenesis, gluconeogenesis, oxidation); a few parameters fitted to the Minnesota experiment | semistarvation, refeeding, overfeeding; weeks to years | Hall 2006 abstract (3); the full text and the 2010 paper were blocked, so the equations are **not read** |
| B | Hall 2011 simplified model | `rho_F dF/dt = (1-p)(EI - EE - rho_G dG/dt)`, `rho_L dL/dt = p(...)`, `p = C/(C+F)`, `C = 10.4 kg x rho_L/rho_F = 2.0 kg`; glycogen dynamics quadratic in carbohydrate intake, `k_G = CI_b/G_init^2` with about 3 x intake needed for 1.8 x glycogen | adults, weeks to years | Hall appendix (4) |
| C | Chow and Hall 2008 macronutrient partition | `rho_F dF/dt = I_F - f_F E`, `rho_G dG/dt = I_C - f_C E`, `rho_P dP/dt = I_P - f_P E`, fractions `f` state-dependent and summing to 1; glycogen in quasi-equilibrium beyond a day | adults; slow component, days to years | arXiv 0802.3234 (4) |
| D | Forbes relation | `FFM = 10.4 ln(FM) + 14.2` (women), `13.8 ln(FM) + 16.9` (men); cross-sectional origin, valid for small changes; **not valid at low fat mass**; underestimates FFM loss for very large losses (relayed) | partition of the non-glycogen balance | PMC2879256 (4); Hall 2007 (relayed) |
| E | NHANES FFM-FM polynomials | four fourth-order polynomials in FM, age, height by sex and group; n = 11,186, R2 above 0.86 | adults; comparable to Forbes except gastric bypass | PMC2879256 (4); equations transcribed by the page reader, **check against the PDF before use** |
| F | Carbohydrate-balance rule from calorimetry | carbohydrate oxidation follows carbohydrate intake (autoregulation); fat balance takes the residual; glycogen holds the carbohydrate difference | days; lean men in a chamber | Jebb 1996 (3, relayed abstract) |
| G | Glycogen capacity with spill to fat | fill to a capacity of about 15 g/kg (about 500 g gain), then net lipid synthesis | massive carbohydrate overfeeding after depletion | Acheson 1988 (3, relayed) |
| H | Fasting fuel mix by time | share of glucose production from gluconeogenesis 64 % (0 to 22 h), 82 % (next 14 h), 96 % (next 18 h); then fat and a small protein share (about 7 % of energy, 1.53 g/kg/d fat, 0.27 g/kg/d protein late in a 21-day fast, obese subjects) | fasting, 68 h and 21 days | Rothman 1991 (3), Owen 1998 (3) |

- **What no candidate gives.** A rule for how a *meal's* absorbed carbohydrate splits between glycogen and oxidation by
  hour, a rule for the draw by exercise intensity per hour, and a protein-sparing rule below the fat floor. A, B and C
  are weeks-to-years models; none of the pages read states an hourly rule. Acheson 1984 (500 g carbohydrate, 24 h) and
  Taylor 1996 (liver, hours) give measurements, not an equation.

### 1c. Do the built rules have a source? (item 2 of the Task)

| Built rule (class assumption) | Support found | Verdict |
|---|---|---|
| absorbed carbohydrate fills glycogen up to a cap | a capacity exists (about 15 g/kg, Acheson 1988; 500 g baseline, Hall input); spill to fat after saturation (Acheson 1988). The 400 g cap in the library row matches neither exactly; Cahill gives muscle 120 g (relayed) or 400 g (Swiss table), liver 70 g | **partly supported**; the cap value is open and the 15 g/kg x 70 kg = 1,050 g vs "about 500 g gain" is unreconciled on the abstract |
| carbohydrate x 0.8 to glycogen at absorption | none. Acheson 1984: of a 500 g load, 170 to 278 g (34 % to 56 %, derived) was stored as glycogen in 24 h, depending on prior diet; Taylor 1996: liver took about 19 % of a mixed meal's carbohydrate at its peak. Hall's calibration is "3 x intake gives 1.8 x glycogen", not a fixed fraction | **no source; outside the measured range** |
| "60 g per MET-hour" above 4 MET | none. No page read gives whole-body glycogen grams per MET-hour. van Loon 2001 and Romijn 1993 abstracts have no carbohydrate rates; Fernandez-Elias 2015 gives muscle concentrations (117 to 185 mmol/kg dry in 40 min at 75 % VO2max), not grams. **Internal check, level 5:** with 4.21 kcal/g, 60 g x (MET - 4) per hour exceeds the whole expenditure above about 5.2 MET (70 kg, 0.84 kcal/kg/h resting, Byrne) or 5.5 MET (1 kcal/kg/h): the glycogen draw alone is then larger than the energy spent | **no source; energetically inconsistent above about 5 MET** |
| the deficit draws glycogen, then fat down to the floor, then lean | the ordering is the textbook sequence (Cahill, relayed) and Rothman 1991 shows glycogenolysis supplying about 36 % of glucose production early, then 18 %, then 4 % (derived, 5); but Owen 1998 shows fat, glucose and amino acids oxidised **together** late in a fast, and Forbes/Hall put lean loss in from the start in proportion `p = C/(C+F)` | **not supported as a strict order**; candidates B and D give lean loss at once |

- How the built code combines them (grep of `src/nutrition.ts:455-467`, not run): the glycogen change `g` is set first
  from `carbEaten x 0.8 - MET-hours x 60`, clamped to 0..cap; the energy that `g` does not cover goes to fat as
  `rest = balance - g x kcal/g`. Because `g` is chosen without reference to the balance, a draw larger than the energy
  spent makes `rest` positive: the model would **add** fat while the body exercises. That follows from the arithmetic
  above and the grep, level 5; I did not execute it.

### 1d. Proposed: the simplest adequate model for the milestone (a proposal; the Life keeper selects)

1. **Balance:** the A9 identity with the constants of 1a (candidate C's notation), in J.
2. **Glycogen:** one pool, `dm_g/dt = (CI - k_G m_g^2)/rho_G` with `CI` the absorbed carbohydrate energy flux and
   `k_G = CI_b/m_g,init^2` (reconstructed from the appendix's description; the printed equation is an image), so that
   oxidation follows intake as in Jebb 1996, with the quadratic sink as the only *sourced* functional form (calibrated
   to "3 x intake gives 1.8 x glycogen", consistent with sqrt(3) = 1.73, derived). **Stated limit:** B is a weeks-scale approximation; within the day its sink
   is unvalidated, and exercise draw (the "per MET-hour" term) has no source, so it should enter only through the
   expenditure fraction `f_C` of candidate C, not as a separate coefficient. Capacity stays an open parameter
   (500 g baseline; 15 g/kg; 120 to 400 g muscle), with `spill` to fat above it per Acheson 1988.
3. **Fat and lean:** the non-glycogen balance divided by the Forbes p-ratio, `p = C/(C+F)`, `C = 2.0 kg` (energy basis).
   This reproduces the Minnesota energy split (lean share 23 %, derived; model p runs 0.17 to 0.38, derived) but
   Minnesota was used in Hall 2006's fit, so it is not an independent test.
4. **Why this and not A:** the A equations are unread (full text blocked); B and C are the two model papers whose
   equations I could read in full. If the keeper wants A, the PMC2377067 and PMC2838532 full texts must be fetched in a
   session whose browser check passes.

### 1e. Review of the built expenditure path (item 3 of the Task)

`physiology.ts:27-34` (`metabolicHeat`) gives `MET x 3.5 ml/kg/min x 20.1 kJ/L x mass`; `:271-277`
(`metabolicRateW`) multiplies it by `scale = RMR x 4184/86400 / metabolicHeat(1, mass)`, so energy is
**MET x the body's resting rate** and 1 MET equals RMR exactly. `:420-430` integrates it each step and `:388` closes
`pal_last = day_expenditure_kcal / rmr` (grep and short reads, not run).

| Check | Measurement | What it says about the built path |
|---|---|---|
| 1 MET as 3.5 ml/kg/min | Byrne 2005, 769 adults: resting VO2 2.6 +/- 0.4 ml/kg/min, 0.84 +/- 0.16 kcal/kg/h; the convention overestimates 35 % and 20 % (3) | scaling to the body's own RMR is the right direction; the raw Compendium constant would overstate rest |
| METs relative to measured RMR vs standard METs | Kozey 2010, 252 subjects, 2,555 activities: standard METs 0.51 METs (95 % CI 0.42 to 0.59) lower than METs relative to measured RMR, mean 6.1; corrected METs -0.02 METs from measured (3) | supports "activity = MET x individual RMR" **if the MET values are activity VO2 divided by the measured resting VO2**. The library's `physiology.met` values are Compendium numbers (activity VO2/3.5), so applying them as RMR multiples **understates** activity cost by about 0.5 MET at 6 METs (8 % in Kozey's sample), and by up to 26 % (1 - 2.6/3.5, derived) for a person at Byrne's mean resting VO2; the size depends on the sample's resting VO2 (level 5) |
| activity cost proportional to what? | Hall appendix assumes proportional to **body weight** (30 kJ/kg/d sedentary, PAL 1.5), not to RMR (4); Byrne's walking subsample cost is not on the abstract | two candidates; this unit cannot decide between them (open) |
| whole-day total | Westerterp 1988: DLW minus respirometry +1.4 +/- 3.9 % (low activity, 5 people, 6 days) and -1.0 +/- 7.0 % (high activity, 4 people, 3.5 days); daily rates 1.40 and 2.61 x sleeping rate (3). Black 1996, 574 DLW measurements: PAL 1.2 to 4.5 (3) | gives an acceptance band for `pal_last` (see 6); DLW itself carries a few percent to 7 % scatter against chamber respirometry, so the built path cannot be validated tighter |
| omitted components | thermic effect of a carbohydrate load 5.2 to 8.6 % of the load (Acheson 1984, 3); Hall fixes 10 % (4); adaptive thermogenesis `beta_AT = 0.14`, `tau = 14 d` (4); Leibel 1995: total expenditure -6 +/- 3 (never obese) and -8 +/- 5 kcal/kg FFM/d at 10 % below usual weight (3); RMR depends on fat and lean mass separately (Hall: 13 and 92 kJ/kg/d; Byrne: composition explains 62 % of variance) | the built path has none of these; over a 120-day deprived run the missing adaptation is the largest, and the library's RMR formula (Mifflin, power law) tracks mass only |
| O2 to energy | built fixed 20.1 kJ/L; Livesey and Elia 1988: fuel-use estimates 12 x more sensitive to the nonprotein RQ than to the heat equivalent (3) | the fixed factor is a second-order choice; no kJ/L-by-fuel figure was on a page read (open) |

**Verdict on the built path:** adequate in structure (MET x RMR, one charge per step), with three stated gaps: the
Compendium-versus-measured-RMR pairing (about 8 % at 6 METs), no feeding or adaptive term, and an unresolved choice of
what activity cost scales with.

### 1f. Does a delayed (daily) store update give wrong within-day feedback? (item 4 of the Task)

Yes for the quantities that read the store, no for the long-run mass.

- Time-courses in the sources: liver glycogen peaks about **318 min** after a liquid mixed meal and then falls 0.26
  mmol/L/min, 15.6 mmol/L/h derived (Taylor 1996, 3); hepatic glucose output is suppressed within **30 min** of eating
  (same); muscle glycogen resynthesis after exercise has a fast phase of 30 to 60 min and a slower one for hours, at
  5.2 to 5.8 umol/g wet/h in the first 2 h and 4.0 to 4.5 in the next 2 h (Ivy 1988, Jentjens and Jeukendrup 2003, 3);
  after a 500 g carbohydrate load 170 to 278 g are in glycogen at 24 h (Acheson 1984, 3). Carbohydrate balance follows
  intake within days and energy balance is near zero by day 5 of a 12-day change (Jebb 1996, 3, relayed). In the
  fast, glycogenolysis falls from about 36 % of glucose production to about 4 % across 54 h (derived from Rothman 1991).
- Hall's own papers treat glycogen as quasi-constant beyond "a few days" (Chow and Hall 2008, 4) and state the 2006
  model "does not attempt to simulate" within-day fluctuations (relayed); the daily close is therefore consistent with
  the weeks-scale models and **not** with the hours-scale data above.
- What goes wrong at a daily close (derived, level 5): `glycogenFactor` and the hunger signal read a glycogen value that
  is up to a day old, so a meal of, say, 100 g carbohydrate does not lift the factor until the close, and an exertion
  does not lower it until the close. The tissue and `body.water` categories lag too: a 100 g glycogen change carries
  270 g of bound water (2.7 g/g, derived), so the split of `body.mass` between the two terms is wrong until the
  close. Whether the total moves by that water is not a store question: it needs water to enter or leave the body, which
  is LN-7's flow (Kreitzman 1992's point is that real weight loss of this kind is water excreted with glycogen).
- **Update interval the sources imply:** shorter than the fastest represented process, i.e. no longer than the fast
  muscle phase and the liver 30-min suppression: an interval of **minutes to an hour** (the engine step) is consistent;
  a daily one is not. No source states an interval; this is an inference from the time constants above (level 5). The
  decision test is the one in A9 (the per-step store integrated over a day equals the daily close to LIFE-11's
  tolerance, and the within-day feedback test).

## 2. State variables, units, compartments, owner

| Variable | Unit | Compartment | Owner | Note |
|---|---|---|---|---|
| `m_g` glycogen (dry) | g | one pool for M1a (liver and muscle later) | Life (`body.stores`) | bound water `h_g m_g` is inside the tissue term |
| `m_f` body fat (anhydrous) | kg | adipose | Life | floor is LN-9's, not set here |
| `m_p` body protein (dry) | kg | lean | Life | lean tissue = `(1 + h_p) m_p` |
| `h_g = 2.7`, `h_p = 1.6` | g water per g | - | library parameter | sourced in 1a |
| `m_other` bone, minerals, non-water remainder | kg | - | Life | no source in this unit |
| `body.water` | kg | water outside the tissue terms | hydration (LN-7) | must not contain tissue-bound water |
| `E_exp` expenditure | J (display kcal at 4184 J) | - | physiology | charged once per step |
| `body.mass` | kg | sum of the five A9 categories | Life only | no-double-counting tests in 5 |

Allocation parameters (`C`, capacity, `k_G`, `f_C`) are library rows in the same owner file; none touches the host.

## 3. Parameters, sources, uncertainty

| Source | Participants | Conditions | Method | Outcome | Normalised | Uncertainty | Used for |
|---|---|---|---|---|---|---|---|
| Hall 2011 + appendix (3880593) | adult model | weeks to years | differential-equation model | rho_F 39.5, rho_L 7.6, rho_G 17.6 MJ/kg; 2.7 g water per g glycogen; glycogen 500 g | kcal/g in 1a | none given (constants) | calibration |
| Chow and Hall 2008 | adult model | same | model | rho_P 19.7 MJ/kg; h_P 1.6; h_G 2.7 | kcal/g in 1a | none | calibration |
| Kreitzman 1992 | 11 subjects | 4 days VLCD | potassium / weight | 3 to 4 g water per g glycogen | - | range | cross-check |
| Wang 1999 | mammals | review | water dilution etc. | FFM water 0.73 | - | - | the non-overlap rule |
| Acheson 1988 | healthy men, 7 days | 86 % carbohydrate overfeeding | calorimetry | capacity about 15 g/kg; 150 g lipid/day from 475 g CHO | - | not on abstract | calibration (capacity) |
| Acheson 1984 | healthy volunteers | 500 g CHO, 24 h | calorimetry | glycogen 170 to 278 g, lipid 0.8 to 9 g, TEF 5.2 to 8.6 % | 34 to 56 % to glycogen | +/- as printed | validation of the CHO split |
| Taylor 1996 | healthy adults | liquid mixed meal | 13C NMR | liver 207 -> 316 mmol/L, peak 318 min, 28.3 g | about 19 % of the meal's CHO | +/- 3.7 g | validation (timing) |
| Rothman 1991 | healthy volunteers | 68 h fast | 13C NMR + tracer | gluconeogenesis 64, 82, 96 % | - | +/- 5, 5, 1 | validation (fasting mix) |
| Ivy 1988; Jentjens 2003 | 8 subjects; review | post-exercise | biopsies | 5.2 to 5.8 umol/g/h; 1.0 to 1.85 g/kg/h | - | +/- 0.7 to 0.9 | timing |
| Cahill and Owen 1968 | 70 kg reference | fuel reserves | table (relayed) | fat 15 kg, protein 6 kg, liver glycogen 70 g, muscle 120 g | - | the Swiss table differs | calibration of sizes |
| Byrne 2005; Kozey 2010 | 769; 252 | rest; 11 activities | hood calorimetry | 2.6 ml/kg/min; METs 0.51 lower | - | SD printed | expenditure review |
| Westerterp 1988; Black 1996 | 9; 574 | DLW vs chamber | DLW | +1.4 +/- 3.9 %, -1.0 +/- 7.0 %; PAL 1.2 to 4.5 | - | SD printed | validation band |
| Leibel 1995; Hall appendix | 41 subjects; model | weight change | calorimetry | -6 to -8 kcal/kg FFM/d; beta_AT 0.14, tau 14 d | - | +/- printed | later extension |

- **Condition dependence (evidence-supported only):** glycogen stored from a carbohydrate load depends on the previous
  diet (Acheson 1984: 278 g after high-fat, 170 g after high-carbohydrate); the p-ratio depends on fat mass (Forbes,
  Hall 2008: the more initial fat, the less lean in the loss); resting rate depends on fat and lean mass (Byrne 2005).
- **Variation, kept apart:** between people (Bouchard 1990: 4.3 to 13.3 kg from the same 84,000 kcal; Levine 1999: 10-fold
  in fat storage); within a person (not found for day-to-day weight: Orsama 2014 gives the weekly pattern, Sunday and
  Monday highest, but no amplitude); measurement error (DLW against chamber +/- 4 to 7 %, Westerterp 1988; calorimetry
  fuel estimates 12 x as sensitive to RQ as to the heat equivalent, Livesey and Elia 1988); model uncertainty (the
  three-way split of glycogen capacity: 120 to 400 g muscle, 15 g/kg, 500 g).
- **Synthesis or meta-regression:** not used; the studies differ in design and the abstracts give no study-level spreads.

## 4. Numerical method and timing (step-convergence tolerance)

- The stores are three integrals of piecewise-constant fluxes, linear except for two clamps (glycogen capacity and
  zero, and the lean/fat partition through `p(F)`). Per step: add the absorbed energy, subtract the expenditure charged
  that step, compute the glycogen change from its rule, divide the remainder by `p`, `1-p`, then update masses and the
  five `body.mass` categories from the same numbers. Explicit Euler per step is exact for the linear parts; `p(F)` has
  a derivative of order `p/(C+F)` per kg, so error is second order in the fat change in one step, small for hourly steps.
  Clamps must be applied by splitting the step at the crossing (no source; engineering).
- **Interval:** the engine step (minutes to an hour), not the daily close (1f). The daily close remains as a check
  (`energy:stored`, A9). This card states no tolerance; PLAN A9 gives it to LIFE-11's step-convergence test. The
  measurable quantity for that test is the difference in `m_g` (g) and in fat mass (kg) between a 60 s and a 3,600 s
  step over a day, against the store range.

## 5. Functional tests the build must pass

1. Energy units: every store change in J; kcal appears only at display (4184 J/kcal).
2. Balance identity per step: `rho_F dm_f + rho_G dm_g + rho_P dm_p + other = E_absorbed - E_expended` to floating
   point; no unplaced energy except where a clamp is hit and reported.
3. No invalid stores: `m_g` within 0..cap, `m_f` and `m_p` non-negative, whatever the input (including the case in 1c
   where the draw exceeds the expenditure, which must not raise fat).
4. Expenditure charged once: sum of per-step charges equals `day_expenditure_kcal` and the kcal drawn from stores.
5. `body.mass` categories (A9): ingestion raises mass by q only; absorption leaves it unchanged; an `m_g` change of
   `dm` raises the tissue term by `dm (1 + 2.7)` and lowers `body.water` by `2.7 dm`, so the total moves by `dm` only
   (water enters or leaves the body only through LN-7 flows); no gram in two categories, checked by a sum over the
   records.
6. Within-day feedback: after a 100 g carbohydrate meal, `m_g` and the hunger/glycogen inputs change within the
   hour(s) the sources give (liver peak at about 5 h, suppression of glucose output within 30 min), not at the daily
   close; after an exertion, glycogen falls in the same hour.
7. Rollback: a rolled-back step restores `m_g`, `m_f`, `m_p`, mass and the trace.
8. Conservation of the held-out trajectory: an overfeeding run of 53,424 kcal (Bray 2012's energy) must put 50 % to over
   90 % of the stored excess in fat (the paper's range).

## 6. Validation

Independent observations (not used for any parameter), with a tolerance:

| Observation | Population and conditions | Acceptance tolerance |
|---|---|---|
| Bray 2012 (3) | 25 adults, 8 weeks, +954 kcal/d: weight +3.16 (low protein), +6.05 (normal), +6.51 kg (high); lean +2.87 kg (normal); fat share of stored excess 50 % to over 90 % | simulated gain within the 95 % CI of the arm (4.84 to 7.26 kg for normal); lean share inside 0.47 +/- 0.10 of the gain, a band I propose (47 % derived) |
| Bouchard 1990 (3) | 12 pairs, 84,000 kcal in 84 days | simulated gain inside 4.3 to 13.3 kg; cumulative energy 43.6 MJ per kg gained (derived) is a target the model's expenditure terms must explain |
| Jebb 1996 (3, relayed) | 6 men, 12 days in a calorimeter | weight +2.90 / -3.18 kg; expenditure +6.2 % / -10.5 %; carbohydrate oxidation following intake |
| Hall 2015 (3) | 19 adults, chamber, 6 days restricted | fat loss rate 53 +/- 6 and 89 +/- 6 g/d (carbohydrate, fat restriction) |
| Minnesota (Keys 1950 via UNU, relayed; Kalm and Semba 2005; Dulloo) | 36 men, 24 weeks | weight 70 -> 53.2 kg, fat 9.9 -> 3.3 kg, FFM 60.1 -> 49.9 kg. **Not independent for Hall's parameters** (Hall 2006 fitted to it) but independent for the built `kcal/kg` and the p-ratio from other papers |
| Taylor 1996; Ivy 1988; Acheson 1984 (3) | liver and muscle glycogen, 24 h CHO load | peak at about 318 min; glycogen at 24 h inside 170 to 278 g for a 500 g load; liver net synthesis 28.3 +/- 3.7 g |
| Rothman 1991; Owen 1998 (3) | fasts of 68 h and 21 days | glycogenolysis share of glucose production about 36 -> 18 -> 4 % (derived); late fat oxidation 1.53 +/- 0.21 g/kg/d, protein 0.27 +/- 0.08 g/kg/d (obese) |
| Westerterp 1988; Black 1996 (3) | PAL, DLW against chamber | `pal_last` inside 1.2 to 4.5; a sedentary day near 1.4 to 1.5 and a heavy day near 2.6 times the *sleeping* rate, +/- the DLW scatter of 4 to 7 % |

- **No independent observation found:** day-to-day (within a person) body-weight scatter (Orsama 2014 pattern only);
  a tabulated fasting trajectory (Hall 2011's 30-day fast panels, Stewart and Fleming 1973's 382 days, Cahill 1968
  were not readable); hour-resolution whole-body glycogen after a meal; whole-body glycogen use per MET-hour.
- The terminal thresholds are not tested (LN-9).

## 7. Status (PLAN §6 columns) and recommendation

- **Status:** designed.
- **Recommendation for the keeper:** (1) adopt the densities and bound-water constants of 1a with the stated conflicts
  open; (2) replace the "carbohydrate x 0.8" and "60 g per MET-hour" assumptions, which have no source and the second of
  which is energetically inconsistent above about 5 METs, with candidates B/C wired to the expenditure fraction; (3) move
  the stores to the engine step (1f); (4) move the two tables into `data/library/validation/` with the `src/library.ts`
  import.
- **Limitations and unresolved choices (for the keeper or Rex):** Hall 2006 and 2010 full texts were not read (browser
  check, HTTP 500), so candidate A is unspecified; the glycogen equation of candidate B is an image that did not survive
  text extraction, so its form is reconstructed from the described parameters (a risk to flag); whether activity scales
  with RMR or body weight; the glycogen capacity (120 to 1,050 g across sources); the split between liver and muscle
  pools; whether to carry a thermic effect and adaptive thermogenesis in M1a; the unit "lean tissue kg" vs "protein kg"
  in the library; the Compendium-versus-RMR pairing in the MET table.
- **Optional future extensions:** two glycogen pools; adaptive thermogenesis (`tau` 14 d); sodium-linked extracellular
  water; energy cost per fuel by RQ.
