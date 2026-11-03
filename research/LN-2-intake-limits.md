# LN-2 intake limits: gastric capacity, intake rate, eligibility, entry timing, eating MET

Research unit 5561 ({R-INTAKE}), 2026-11-03. Research only: no code, no registry edit. Fills the physical limits of
`plans/life/lanes/LN-2-ingestion-gut.md` §1 and §3 for PLAN §3.A2, A3 and A12, in the template of
`plans/life/lanes/RESEARCH-CARD.md`. Rows are `validation.intake_limits.*` in
`research/LN-2-intake-limits.table.json`; sources are the `IL-*` keys in `sources.json`.

> **Blocker recorded.** NOT YET IN THE LIBRARY: the table is held at research/LN-2-intake-limits.table.json (row ids already `validation.intake_limits.*`) because listing `intake_limits` in data/library/validation/index.json makes test/library-loader.test.ts fail until src/library.ts imports the table (that file lists each validation table by an explicit import and a map entry), and this unit may not touch src/. Follow-up for the keeper: move the file to data/library/validation/intake_limits.json, add the name to index.json, add the import and map entry in src/library.ts (and rebuild dist).
 Every figure below was
read on a page opened in this unit; where a publisher page refused (AJR, RSC, ScienceDirect, PubMed returned 403 or a
cookie wall) the figure is marked **relayed** or left null. Evidence levels follow the convention in `flags/`
(PLATFORM §4 was outside this unit's read list, so the keeper should confirm): 3 a measured study read at abstract or
table level, 4 a review, consensus or secondary relay, 5 derived by me or unsourced.

## 0. Question and scope

- **Quantity or mechanism needed:** (1) the largest meal a healthy adult's stomach takes in one sitting; (2) intake
  rate in g/min for bread-like solid food; (3) bodily conditions a source says prevent ingestion, limited to those the
  engine represents; (4) whether a meal enters the stomach at one instant or gastric-emptying models start from the end
  of the meal; (5) the MET of eating, with its compendium code.
- **Conditions the milestone must support:** the declared M1a person (healthy adult) eating the 1270 bread
  preparation; one meal at a time; no age, sex or body-composition modifiers.
- **Recorded as later extensions (not prerequisites):** body-composition effect on balloon capacity (obese against
  lean); within-person capacity change on a low-energy diet; the competitive eater's trained stomach; bread type
  (wholemeal against soft bun) as an eating-rate input; posture of the eater.

## 1. Relationship, source and conditions

### 1.A Gastric capacity (A2 "stomach full", A3 `q_gastric_room`)

**No source found gives a maximum mass of bread, or of any named solid food, eaten in one sitting by a healthy adult
population.** What exists is measured four different ways, and the four are not the same quantity:

| Candidate | What it measures | Value (population) | Source row |
|---|---|---|---|
| a. Energy eaten to maximum satiation, mixed solid meal | what people stop at, at a protocol-imposed rate | 783 kcal, SD 244 (10 healthy adults, age 22) | `savarese-solid-energy-at-maximum-satiation` |
| b. MRI total gastric volume at maximum satiation, same meal | volume of stomach contents (meal + secretion + air + unemptied preload) | 657 mL, SD 186 | `savarese-solid-total-gastric-volume-at-maximum-satiation` |
| c. Nutrient drink, slow (15 mL/min) | liquid taken to satiation score 5 | 731 mL mean, range 345 to 1500, stopped at 1500 (18 healthy men) | `iida-slow-nutrient-drink-maximum-satiety-volume` |
| d. Balloon, maximal tolerated distension | volume of water a balloon can distend the stomach to before intolerance | 1000 mL (11 normal-weight, +/-67); 1100 mL (lean, +/-185 SE) | `granstrom-normal-weight-balloon-maximum-tolerated-volume`, `geliebter-1988-lean-balloon-capacity` |
| e. Competitive eater | one trained person | quantities **not opened** (null row); abstract: stomach expanded into a very large flaccid sac | `levine-speed-eater-quantities` |

- **Existing established models.** No equation: capacity is a measured parameter, not a modelled one. Relationship
  between the candidates: a measured gastric volume is the meal plus secretion plus air, not the meal alone. Hoad 2015
  (400 mL liquid meal, MRI): content 402 mL (SD 58) at 15 min, meal-only 338 mL (SD 50) after correcting for secretion
  of 64 mL (SD 51) (`hoad-gastric-content-volume-after-400-ml-liquid-meal`, level 3). Fidler 2009 (20 healthy, MRI): the
  postprandial volume change exceeded the ingested volume by 106 mL (SEM 12), mainly air, 61 mL (SEM 5), the same for
  30 or 150 mL aliquots (`fidler-postprandial-excess-over-ingested-volume`, level 3). Both are liquid or nutrient meals.
- **Volume mapping (A3, LN-2 §1).** If the keeper selects a volume cap, the mass cap is
  `q_max = rho_prepared × (V_cap − V_secretion − V_air − V_water_resident)`, with `rho_prepared` from LN-1's record.
  This unit supplies no density. The sourced terms are secretion 64 mL (SD 51) at 15 min, and air about 61 mL (SEM 5)
  from liquid-meal studies; the water the stomach still holds at the moment of measurement is not reported for candidate
  b (the 300 mL preload left 271 mL, SD 59, in the stomach 10 min later, and its remainder at maximum satiation is not
  given), so **the subtraction cannot be completed from sources** and candidate b alone cannot become a bread mass.
- **Proposed (a proposal; the Life keeper selects).** Candidate **a**, expressed as energy: capacity
  `E_cap = 783 kcal` (SD 244 between people), and `q_gastric_room = (E_cap − E_in_stomach) / (kcal per kg of the prepared
  bread, LN-1)`. Why: it is the only candidate measured on a solid meal and in a quantity the engine can convert with LN-1
  alone (no density, air or water term). It keeps the Savarese meal's own caveat: the meal is mixed (46% carbohydrate,
  32% fat, 22% protein) and not bread, and satiation on it did **not** track gastric volume (the authors: solid-meal
  satiation did not depend on gastric volume or CCK), so whether bread stops at the same energy is **open**. Evidence
  level 3 (conference abstracts, n = 10). Candidate b is kept as the volume cross-check once the mapping terms exist.
- **What "full" means (a choice for the keeper, not settled by any source).** Candidates a to c are where people
  chose to stop (satiation); d is where the stomach could not be distended further; e shows both can be exceeded. The
  card does not decide whether A2's "stomach full" is satiation or tolerance. Proposal: satiation (a), because Cognition
  already owns a satiety signal (A8) and the hard cap then sits at what healthy people actually do stop at; the balloon
  figures (1000 to 1100 mL of water) are recorded as an upper-side bracket that a different choice would use.
- **Where it stops applying.** Young healthy adults only (age 22 ± 3, BMI 23 ± 1; Iida: men 25 to 44, fasted over 6 h; whether the Savarese subjects fasted is not on the pages read); eating
  paced at 100 kcal per 5 min; a mixed meal after a 300 mL water preload; not bread; not trained eaters; not obese.

### 1.B Intake rate (duration of ingestion, A12)

- **Existing models.** None; measured rates only. Candidates:
  - plain bread slices **9 g/min (2 to 13)**, 89 healthy adults aged 18 to 30, eating time only, sessions capped at
    2 min (`van-den-boer-plain-bread-slice-eating-rate`, level 3);
  - the reference whole-wheat bread, one 35 g slice, **10 g/min, SD 4.2** at session 1 and 4.3 at session 3 (same
    study; `van-den-boer-reference-bread-eating-rate`, level 3);
  - an ad libitum breakfast of slices with toppings **21.4 g/min, SD 7.5**, 37 adults (**relayed** from search text of
    a page that returned 403; includes the toppings' mass; `bolhuis-sliced-bread-breakfast-eating-rate`, level 4);
  - bread type: the wholemeal slice is eaten **40% slower** than the soft white bun, from smaller bites and more
    chews, 36 adults (`heuven-slowest-versus-fastest-bread-eating-rate`, level 3; per-bread g/min **not obtained**).
- **Proposed.** One constant `r = 10 g/min` (reference bread, SD 4.2 between people), `duration = q / r`, with the
  plain-slice 9 (2 to 13) as its consistency check. Why: the only bread measurement of rate with a population, a
  stated method and a spread; the simplest model is one number per person. Level 3. The keeper should know the 2.1×
  gap to the 21.4 g/min figure: the definitions differ (eating time against whole-meal time; bread alone against bread
  with toppings), and the 21.4 is relayed.
- **Where it stops applying.** Young normal-weight adults, a lab, bread slices of a modern type; bread of the 1270
  preparation (crust, density, moisture) is not what was measured, and Heuven shows rate moves 40% with bread type
  alone. Rate is not total meal time: the sessions were capped at 2 min and breaks between bites were excluded. A free
  meal with talking and pauses is longer; no source quantifies that for bread.

### 1.C Eligibility (A2)

- **Represented by the engine:** a death record (PLAN A2). Eating is physically impossible for a dead body; no source
  was needed or searched for that.
- **Unconsciousness.** Two sources say reduced consciousness prevents safe oral feeding: ACCP guideline (Chest 2006,
  Grade B): such patients "should not be fed orally until the level of consciousness has improved"
  (`smith-hammond-reduced-consciousness-oral-feeding`, level 4, a recommendation about aspiration risk, no measured
  rate); Metheny (JPEN 2003): decreased consciousness is "a major risk factor for aspiration"
  (`metheny-decreased-consciousness-aspiration-risk`, level 4). **Is it represented?** A grep of `src/` finds
  "unconscious" only as a severity step inside `medicine.ts:552-553` (hypoxia course text) and as text in
  `respiration.ts:150`; I found no body-state field for consciousness that the preconditions could read. The keeper
  should confirm. Proposed: **not added** as a precondition now (no represented state to read, and both sources are
  risk statements rather than a measured inability to swallow); record it as the first eligibility candidate when a
  consciousness state exists.
- **Out of scope (no source read, or not represented):** swallowing impairment, dysphagia, vomiting, nausea,
  posture or position (the Metheny review names a sustained supine position as an aspiration risk, which is a risk
  statement, not an ingestion rule, and PLAN A2 forbids posture rules without a source), illness, age.
  `gutFunction` stays an absorption multiplier (LN-2 §1).

### 1.D Entry over time (LN-2 §4)

- **Candidates.** (i) The meal enters the stomach at one instant at the resolution instant (LN-2 §4's declared
  simplification); (ii) emptying models start from the end of the meal. **No source read supports (i).** The standard
  clinical protocol follows (ii): the meal is eaten "within 10 min", the first image set is taken "immediately after
  meal ingestion", and the later images are at 1, 2 and 4 h after ingestion; percent remaining is read against the first
  image (Abell et al. 2008, consensus of the American Neurogastroenterology and Motility Society and the Society of
  Nuclear Medicine; the meal includes two slices of white bread; row `abell-emptying-time-zero`, level 4). The
  protocol's curves do not model the minutes of eating, they start after them.
- **Proposed.** Time zero of any LN-3 emptying model = **the end of eating**, `t_end = t_start + q / r`. The kernel
  transfer may still be one instant (accounting), but it should be stamped at `t_end` (or LN-3 should be told that
  `t_zero = t_end`), not at the start of eating. For 100 g at 10 g/min that is 10 min (my arithmetic, level 5), the same
  scale as the protocol's 10 min limit and small against emptying measured in hours (the 120 min distal retention of
  63%, SD 13, in the solid-meal Savarese study).
- **Open.** What the stomach does in the minutes during eating is not measured by any source read: no row gives
  emptying during ingestion. Tougas 2000 (abstract) does not say when imaging starts; the `gastempt` page does not
  define t = 0; Siegel 1988 and Elashoff 1982, where the curve forms come from, were **not opened**.

### 1.E Eating MET (A12)

- **Candidates (2024 Adult Compendium, ages 19 to 59):** code **13030 "Eating, sitting", 1.5 MET**; code **13035
  "Talking and eating or eating only, standing", 2.0 MET** (`compendium-13030-eating-sitting`,
  `compendium-13035-eating-standing`, level 4). Of the compendium's 1,114 activities, 202 are estimated; the page marks
  estimates in red and the colour was lost in the text copy, so whether either row is measured is **not known**.
- **Proposed.** 13030 at 1.5 MET for the ingestion duration, because the row is eating alone; the posture (sitting or
  standing) is a declared input to the activity, never an eligibility rule. 13035 is a candidate only if the scenario
  declares a standing, talking eater. The 2011 compendium supplement was fetched but is an unreadable binary, so a
  second compendium edition is **not confirmed**.

## 2. State variables, units, compartments, owner

| Quantity | Unit | Owner | Note |
|---|---|---|---|
| `E_cap` (proposed) or `V_cap` | kcal (mL if the keeper selects volume) | Life parameter, library row | read-only; per run, declared; the fixture capacity (RC-11) is replaced by this |
| `rho_prepared`, kcal per kg | g/mL, kcal/kg | LN-1 composition record | not supplied here |
| `r` intake rate | g/min | Life parameter | one number per run; null until the keeper selects |
| `E_in_stomach` | kcal | `life.gut` stomach account (LN-2 §2) | derived from the account's constituents and LN-1 energy values |
| `t_start`, `t_end = t_start + q/r` | s (kernel time) | the resolver / Life | `t_end` is LN-3's t = 0 |
| eating MET | MET (dimensionless), 1 MET = 3.5 mL O2/kg/min | physiology activity row | charged for `q/r` (A12) |

## 3. Parameters, sources, uncertainty

| Source | Participants | Meal / conditions | Measurement method | Outcome (as reported) | Normalised | Uncertainty | Used for |
|---|---|---|---|---|---|---|---|
| Savarese 2009 (Gastroenterology abstract) | 10 healthy, 4 women, age 22 ± 3, BMI 23 ± 1 | mixed solid meal 46/32/22% C/F/P at 100 kcal per 5 min, 300 mL water preload | 1.5 T MRI; satiety rating 0 to 5 | 783 ± 244 kcal; 44 ± 14 min; total gastric volume 657 ± 186 mL | none | SD between people | **calibration** (capacity, `E_cap`) |
| Savarese 2009 (Dig Liver Dis abstract) | same | same | same | after preload 271 ± 59 mL; at satiation 554 ± 203 mL as change from baseline | none | SD | context (different reference than 657) |
| van den Boer 2017 | 89 healthy adults 18 to 30 | bread slices in booths, 2 min cap | button-press time, g per min of eating | plain slices 9 (2 to 13); reference bread 10 ± 4.2 | none | SD 4.2 (people) | **calibration** (rate `r`) |
| Abell 2008 | consensus | egg-white sandwich meal 255 kcal in 10 min | scintigraphy | first image immediately after meal | none | none | **calibration** (time zero) |
| 2024 Adult Compendium | adults 19 to 59 | self-care codes | indirect calorimetry (measured rows) or estimate | 1.5 and 2.0 MET | none | measured or estimated unknown | **calibration** (MET) |
| Granstrom 1985 | 11 normal-weight, 16 extremely obese | balloon, water | maximal tolerated volume | 1000 ± 67 and 1763 ± 70 mL | none | SD or SE unlabelled | validation (capacity bracket) |
| Geliebter 1988 | lean and obese | balloon 100 mL/min | discomfort rating 10 | 1100 ± 185 and 1925 ± 175 mL (SE) | none | SE | validation |
| Iida 2012 | 18 healthy men 25 to 44 | Ensure-H 15 mL/min | satiety score 5 or 1500 mL | 731 mL mean, 345 to 1500 | none | range | validation |
| Hoad 2015, Fidler 2009 | 10 and 20 healthy | 400 mL liquid meal; nutrient meal | MRI | secretion 64 ± 51 mL; air 61 ± 5 mL; excess 106 ± 12 mL | none | SD, SEM | definition of what a volume contains |
| Bolhuis 2024 (relayed) | 37 adults | bread + toppings ad lib | video, g over time | 21.4 ± 7.5 g/min | none | SD | validation (rate) |
| Heuven 2024 | 36 adults | nine breads | video coding | wholemeal 40% slower than soft white bun | relative | P < 0.001 | validation, condition dependence |
| Forde 2013 | 15 adults | 50 g of 35 foods | video | oral exposure time 27 to 350 s | 111 to 8.6 g/min (my arithmetic) | none | validation (span only; not bread) |
| McCrickerd 2017 | 146 adults | same meal on four days | video | ICC above 0.76 | none | none | variation (within person) |
| Cahyono 2015 | 20 healthy, 20 FD | UltraMilk | nutrient drink | cut-off 950 mL; controls' median not on page | none | none | null row |

- **Condition dependence (evidence-supported only).** Body composition changes balloon capacity (obese 1763 and 1925
  mL against 1000 and 1100 mL, two studies), and a 4-week 600 kcal/day diet cut it by 27% (Geliebter 1996, 14 obese
  adults); both are balloon measures in an obese population and neither is applied to the declared healthy adult.
  Bread type changes rate by up to 40% (Heuven). Satiation on a solid meal did not track gastric volume (Savarese).
  Nothing about age, sex or posture was read on an opened page, so none is a modifier.
- **Variation, kept apart.** Between people: SD 244 kcal (31% of the mean) and 186 mL (28%) for capacity at n = 10;
  SD 4.2 g/min (42%) for rate at n = 89. Within a person: eating rate is consistent across meals, ICC above 0.76
  (McCrickerd); no within-person capacity figure for a healthy adult was found. Measurement error: MRI volume
  inter-observer variability about 3% above 200 mL (Hoad). Model uncertainty: what "capacity" means (candidates a to d
  differ by about 1.7× between 657 and 1100 mL: 657, 731, 1000, 1100), unresolved, never turned into random NPC traits.
- **Synthesis or meta-regression.** Not used: the studies differ in method, meal and population, so they cannot be
  pooled; the card keeps them side by side.

## 4. Numerical method and timing (step-convergence tolerance)

Algebraic, no integration: `q = min(q_requested, q_available, (E_cap − E_in_stomach)/e_prepared)`;
`t_end = t_start + q/r`. Double-precision arithmetic; the tolerance is exact equality of kg and an absolute 1e-9 s on
`t_end`. No step-convergence test applies. The capacity is read once at resolution from committed state; the transfer is
one kernel instant (LN-2 §4) stamped at `t_end` as proposed in 1.D, and LN-3's emptying model takes `t_zero = t_end`.

## 5. Functional tests the build must pass

1. A meal below capacity is accepted whole; above it, `completed` with `q` = room; at or beyond room ≤ 0,
   `impossible: stomach full` with the capacity's basis named (`sourced` once the keeper selects, `fixture` before).
2. Unit test of the energy conversion: room kg × `e_prepared` equals the remaining kcal within 1e-9.
3. If the keeper selects a volume cap, a missing density, water or air term leaves the cap unapplied and says so (A3);
   it never defaults.
4. `duration = q / r`; null `r` gives no duration and A12 charges nothing for it, recorded in the run.
5. A12 charges `MET × duration` once for `completed`, nothing for `impossible`, and incurred prior effort under its
   own activity for `failed`.
6. `t_end` is `t_start + q/r`; the emptying clock starts at `t_end`, not before.
7. Eligibility: only the death record, 0 kg at the source and the full stomach produce `impossible`; consciousness,
   posture and `gutFunction` are not read by the preconditions.
8. Rollback and one-outcome-per-cause are LN-2 §5's, unchanged.

## 6. Validation

- **Independent observations (not used for any parameter) and tolerance.** *Capacity:* balloon 1000 mL (Granstrom),
  1100 mL (Geliebter), slow nutrient drink 731 mL (Iida). They measure different things from candidate a, so they can
  only bracket it, not validate an energy value. Proposed tolerance, my choice and the keeper may change it: the volume
  cross-check (candidate b, 657 mL) lies within 0.5 to 2× of each independent central value (it does: 0.66, 0.60, 0.90 of
  1000, 1100, 731 mL, my arithmetic). *Rate:* the proposed 10 g/min against the relayed 21.4 g/min (ratio 0.47), the
  bread-type spread of 40% (Heuven) and Forde's 8.6 to 111 g/min across foods; proposed tolerance a factor of 2.5 of the
  independent meal rate, because Forde's spread (13×) supports nothing tighter. *Entry timing and MET:* **no
  independent observation was found.**
- **If none is available, say so.** No independent measurement of a maximum solid-meal mass or energy for healthy adults
  was found, so candidate a has **no independent validation**; the Levine speed-eater quantities were not retrievable
  (the abstract has none and the full text returned 403). Calibration (Savarese, van den Boer, Abell, compendium) and
  validation (Granstrom, Geliebter, Iida, Bolhuis, Heuven, Forde, McCrickerd) sources are disjoint.

## 7. Status (PLAN §6 columns) and recommendation

- **Status:** designed.
- **Recommendation (a proposal).** Capacity `E_cap = 783 kcal` (SD 244) of the prepared bread's energy, rate
  `r = 10 g/min`, eating MET 1.5 (code 13030), emptying time zero at the end of eating, no new eligibility condition.
  One coherent set, one meal, no modifiers.
- **Unresolved choices for the keeper or Rex.** (1) Is A2's "full" satiation (proposed) or tolerated distension; (2)
  is an energy cap acceptable in A3's mass-based `q_gastric_room`, or must the cap be a volume (then LN-1's density, air
  and resident water terms are needed and not yet sourced); (3) the bread's 1270 type against the measured breads; (4)
  whether the fixture capacity is replaced now by a value from a mixed solid meal, not bread.
- **Limitations.** Capacity rests on one conference-abstract study of 10 young adults; the rate on lab sessions
  capped at 2 min; both on modern foods. The compendium row's measured-or-estimated flag is unknown.
- **Optional extensions (never prerequisites).** Body-composition and diet effects on capacity; trained eaters; bread
  type as a rate input; a consciousness state with its own eligibility; the Savarese full paper or a bread-specific
  satiation study to replace the mixed meal.
