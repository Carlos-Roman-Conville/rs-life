# LN-4 absorption, transit and residue: small intestine to absorbed pools, colon and faeces store

Research unit 5562 ({R-TRANSIT}, LN-4), 2026-11-03. Research only: no code, no registry edit. Fills
`plans/life/PLAN.md` §3.A6.2 and §3.A6.3 and the LN-4 row of §8.1, in the template of `plans/life/lanes/RESEARCH-CARD.md`.
Rows are `validation.gut_transit_absorption.*` in `research/LN-4-absorption.table.json`; sources are the `TR-*` keys in
`sources.json`, plus `EXC-*` rows carried from task 3016. Evidence levels follow 5561's convention (the keeper should
confirm against PLATFORM §4, outside this unit's read list): 3 a measured study read at abstract or table level, 4 a
review, consensus or relayed secondary text, 5 derived by me or unsourced.

> **Blocker recorded (same as 5561 and LN-3).** The table is held at `research/LN-4-absorption.table.json`, not in
> `data/library/validation/`, and is **not** listed in `index.json`: `scripts/check_library.py` requires every file in
> `validation/` to be listed, and `test/library-loader.test.ts` fails for a listed table that `src/library.ts` does not
> import, which this unit may not edit. Follow-up for the keeper: move it to
> `data/library/validation/gut_transit_absorption.json`, add it to `index.json`, add the import and map entry in
> `src/library.ts`, rebuild `dist`.

## 0. Question and scope

- **Quantity or mechanism needed:** how the contents the stomach discharges (LN-3) move through the small intestine and
  colon, how much of each constituent is absorbed and when, what is left as residue, how colonic water absorption closes
  the water balance, and what the model declares as a boundary (secretions).
- **Conditions the milestone must support:** the declared M1a person (a healthy adult) eating the bread preparation, a
  fed run of 30 days; absorbed energy and nutrients reach the body pools hours after the meal, residue reaches
  `faeces_store`; the four balances of PLAN A6 close.
- **Recorded as later extensions (not prerequisites):** fibre fermentation and short-chain fatty acids (CG-10, omitted
  and flagged in PLAN A6.3); bacterial mass and endogenous secretions in faeces; diarrhoea and constipation as transit
  changes; per-person transit; bread-specific digestibility; the colon as more than one compartment.

## 1. Relationship, source and conditions

### 1.A Candidates

| # | Model | Source (level) | Domain | Where it stops |
|---|---|---|---|---|
| A | **Rex's two-compartment form** (PLAN §8.4): intestine `dI = k_s S - k_i I`, absorbed `a k_i I`, residue `(1-a) k_i I` to `faeces_store`; colon empty | PLAN §8.4 candidate (labelled *adapted*) | any constituent with a fixed absorbed fraction `a` | one exponential residence time: Yu 1996 found the single-compartment model does **not** fit the human small-intestinal flow profile (level 3, abstract) |
| B | **Compartmental transit chain** (CAT type): `n` equal first-order compartments, transit `k_t = n / T_SI`, first-order uptake `kappa` in each | Yu, Crison, Amidon 1996 (pooled literature, mean small-intestinal transit 199 min, 95% CI 7 min; compartmental and dispersion models fit, single-compartment does not; level 3); the Huang, Lee and Yu 2009 review states the form (`Y_n`, `K_t`, `K_a`, minor stomach and colon absorption, linear transfer; the equation is an image and no `n` or time is on the page; level 4) | drugs and, by the same flow, a meal's contents; a healthy adult | the count 7 is **relayed** from a secondary page (level 4), not read in either source; no nutrient uptake constants were found |
| C | **Transit-time distribution with fixed absorbed fractions**: the delay is a distribution (Erlang of order `n` is B with `kappa` = 0), each constituent leaves with fraction `a_i` absorbed | same as B; digestibility data below | any constituent with a measured apparent digestibility | timing of uptake inside the intestine is not modelled |
| D | **Dispersion model** with constant input | Yu 1996 (fits the profile as well as B, more complex) | same | needs a spatial parameter no source gave |

- **Relation of B and C to A.** B with `n = 1` is A; C is B with uptake taken at the exit. For a fixed absorbed fraction
  `a_i`, B needs `kappa_i = k_t [ (1 - a_i)^(-1/n) - 1 ]` so that the total absorbed fraction is `1 - (k_t/(k_t+kappa_i))^n = a_i`
  (my algebra, level 5). The chain is linear, so it has an exact solution over any step, and a meal's contribution
  adds linearly to the next one's.
- **Colon.** Candidate: one first-order compartment with mean residence `T_colon` (exit rate `1/T_colon`), or three
  segments (right, left, rectosigmoid: 11.3, 11.4, 12.4 h, Metcalf 1987). Absorption of nutrients in the colon is minor
  in B's source (Huang); the colon here does water absorption and moves residue to `faeces_store`. Fermentation energy
  (CG-10) is omitted and flagged, as PLAN A6.3 says.
- **Water.** Net luminal fluid 8 to 10 L/day passes through the lumen, about 1.5 L reaches the colon and about 100 mL
  leaves in stool (Kiela and Ghishan 2016, level 4, review text; no split of ingested against secreted volumes is on the
  page). Candidates for the colonic step:
  - *(W1) fraction absorbed:* a fixed fraction of colonic water absorbed, `1 - 0.1/1.5 = 0.93` (derived, level 5, from
    the review's figures, which pool secreted and ingested fluid).
  - *(W2) target composition:* faecal water set by a faecal water share `w_f = 0.75` of the wet mass (Rose 2015 as
    carried from task 3016: wet 128 g/day, water 75%), so water to `faeces_store` = `dry residue * w_f / (1 - w_f)`,
    limited by the water available; any excess is absorbed to `body.water`, and the model never adds water to meet the
    target (it has no secretion term).
  - The Debongnie and Phillips 1978 colonic absorption capacity was not readable (no abstract): **null**.
- **Secretions are a declared boundary.** The sources give the luminal flow (8 to 10 L/day) but no secretion volume, and
  net transport is what the physiology review gives. The model has no secretion term, so the card makes the boundary
  explicit: *secretion into the gut (saliva, gastric, biliary, pancreatic and intestinal fluid) and its reabsorption,
  and the dry matter they bring to faeces (bacteria, desquamated cells, mucus), are outside the model; only net water
  and the food's own constituents are tracked.* The test names the boundary (section 5). Consequence for validation:
  the modelled dry residue is the food's unabsorbed part only, so it will be below the measured 29 to 32 g/day (Rose) by
  the unmodelled endogenous mass; that gap is expected and is reported, not tuned away.
- **Where the existing `absorbedFraction` rules fit or conflict** (`src/nutrition.ts:290`, from a grep and the
  lines it returned; the table values were **not read**, so no numeric comparison is claimed).
  - *Fit:* the per-nutrient multiplicative rules for context (haem and non-haem iron, vitamin C with iron, tea or whole
    grain with iron, zinc on grain and pease, B12, vitamin C and cooking, fat with the fat-soluble vitamins, folate,
    thiamin, magnesium, calcium) are the per-constituent fractions `a_i` that B and C need. PLAN A6.2 already says to
    apply them at the intestine with the meal context recorded at ingestion. The rules are not bread-specific, and no wheat or bread rule is among the names the grep returned.
  - *Conflict 1:* the function's `default` branch gives `f = 1`, so energy, carbohydrate, protein, fat, water and sodium
    are absorbed 100% unless `gutFunction` or a flux changes them. Measured apparent whole-diet digestibility is
    90.5% for energy, 94.0% carbohydrate, 91.0% protein and 97.8% fat on a control diet (Novotny 2012, level 3), and
    81.4 to 90.0% protein, 87.0 to 95.7% fat and 91.1 to 95.5% carbohydrate across three diets (Zou 2007, level 3). The
    current rules therefore give a healthy adult **no** faecal energy, against 132 kcal/day measured (Novotny; the same
    figure appears in Rose 2015, so independence is not established).
  - *Conflict 2:* they are applied at the moment of eating; the model needs hours.
  - *Conflict 3:* `gutFunction` multiplies every fraction, including water and energy. It is an absorption multiplier with no
    source read, not a transit parameter. A flux (diarrhoea) is a ×-factor on everything except sodium, potassium and water.
    In the transit model a flux is faster transit (loose stools go with fast colonic transit, Degen and Phillips 1996,
    level 3, abstract; no numbers), a shorter `T_colon`, not a multiplier. Neither is fitted here: **open**.
  - *Conflict 4 (energy convention, PLAN §8.4):* if LN-1's energy per kg is a metabolisable (Atwater) value, digestibility
    losses are already in it, and applying `a_energy` again reduces energy twice. A6's faecal energy `E_eaten - E_absorbed`
    needs a **gross** energy at the stomach. The card needs LN-1 to state the basis.
  - *Conflict 5 (water):* with `f = 1` for water, all food water is absorbed at once and none reaches the colon or
    faeces; with the proposal below, the water that leaves is set by faecal composition.
- **Proposed (a proposal; the Life keeper selects).** **B with `n = 7` and `T_SI = 199 min`** for the small intestine
  (`k_t = 7/199 = 0.0352 min⁻¹`, 28.4 min per compartment, my arithmetic), per-constituent fractions `a_i` from the
  measured apparent digestibilities where a source exists and from the existing rules for the micronutrients,
  `kappa_i` from the formula above, and the colon as **one** first-order compartment with water by **W2**, leaving
  secretions as the declared boundary. Why: it is the form with a source that tested the single-compartment alternative
  and found it wanting; it is linear and exactly solvable; with `n = 1` it is Rex's candidate, so choosing A later is a
  parameter change, not a rewrite. If the first build uses PLAN §8.4's two compartments, `n = 1`, the keeper loses only
  the transit-profile shape (the mean timing is the same) and the colon stays empty. Evidence level 3 for the small
  intestine and 4 for the rest.
- **Where it stops applying.** Healthy adults, a mixed or low-fibre diet; no resolved bread-specific `a_i` (McCance and
  Walsham 1948 gave no readable figure); not high-fibre diets (the Atwater error rises to 11% and, by difference, 12
  to 21%, Zou, Johnson and Southgate); not diarrhoea, constipation, ileostomy; secretion, fermentation, bacterial mass and
  endogenous losses are outside it.

## 2. State variables, units, compartments, owner

| Quantity | Unit | Owner | Note |
|---|---|---|---|
| `I_{c,j}`, `j = 1..n`, constituent `c` in small-intestine compartment `j` | LN-1's unit per constituent | `life.gut` intestine account (LN-2 §2); the `n` sub-states are internal to the account | chain; `n` is a parameter |
| `C_c` | same | `life.gut` colon account | one compartment; empty in the first build if the keeper takes PLAN §8.4 |
| `F_c`, dry residue, and faecal water | same, kg for water | `life.gut` `faeces_store` | disjoint from the colon (LN-2 §2); voiding is M4's |
| absorbed `A_c`, to the pools (`body.*`) and `body.energy_absorbed` | each constituent's pool unit; kcal | Life body pools | leaves the gut boundary; water to `body.water` |
| `n`, `T_SI`, `T_colon`, `a_i`, `w_f` | dimensionless, min, h, fraction, fraction | Life parameter rows | a missing value fails configuration (never zero) |
| `kappa_i = k_t[(1-a_i)^(-1/n) - 1]` | min⁻¹ | derived | per constituent |

## 3. Parameters, sources, uncertainty

| Source | Participants | Meal / conditions | Method | Outcome (as reported) | Normalised | Uncertainty | Used for |
|---|---|---|---|---|---|---|---|
| Yu, Crison, Amidon 1996 | pooled literature | small-intestinal transit data | statistical pooling | 199 min, 95% CI 7 min | `k_t = 7/199` (count relayed) | CI of the pooled mean | **calibration** (`T_SI`, `n`) |
| Novotny 2012 | controlled-feeding adults (n not on the text) | control diet, base diet with bread and rolls | faecal collection | energy 90.5, carbohydrate 94.0, protein 91.0, fat 97.8, fibre 80.8%; faecal energy 132.2 kcal/day | `a` = 0.940, 0.910, 0.978 | none stated | **calibration** (`a_i` for macronutrients) |
| Metcalf 1987 | 73 healthy | mixed diet; radiopaque markers | markers and film | total colon 35.0 +/- 2.1 h (SE); right 11.3, left 11.4, rectosigmoid 12.4 h | SD about 17.9 h (derived) | SE | **calibration** (`T_colon`) |
| Rose 2015 (carried) | review | | | wet faeces 128 g/day, dry 29 g (Table 10 32 g), water 75% | `w_f` = 0.75 | review's disagreement | **calibration** (`w_f`) for W2 |
| Kiela and Ghishan 2016 | review | | text | 8 to 10 L/day through the lumen, ~1.5 L to the colon, ~0.1 L in stool | W1 fraction 0.93 (derived) | none | context, W1 candidate |
| Larsen 2022 | 28 healthy controls | capsule over 5 days | electromagnetic capsule | small bowel 4.8 +/- 2.2 h, colon 28 +/- 26 h, whole gut 36 +/- 26 h | none | not labelled SD or SEM | **validation** |
| Nandhra 2023 | 1,885 healthy, 22 studies | capsule systems | systematic review | small bowel 3.3 to 7 h, colon 15.9 to 28.9 h, whole gut 23.0 to 37.4 h | none | range of studies | **validation** |
| Zou 2007 | three diets (n not on the page) | refined, fruit and vegetable, cereal | balance | protein 81.4 to 90.0, fat 87.0 to 95.7, carbohydrate 91.1 to 95.5% | none | range | **validation** |
| Slavin and Marlett 1980 (carried) | adults | 16 g/day cellulose | faecal energy | 4.6 to 8.0% of gross energy lost | derived by 3016 | none | **validation** |
| Cummings 1992 (carried) | 220 UK adults | free diets | faecal weight | median 106 g/day | none | median | **validation** |
| Hurrell and Egli 2010 | review | mixed and vegetarian diets, no iron stores | isotope studies | iron 14 to 18% (mixed), 5 to 12% (vegetarian) | none | ranges | **validation** (micronutrient `a_i`, unread existing values) |

- **Condition dependence (evidence-supported only).** Fibre lowers digestibility: high-fibre diets raise the Atwater
  error to 11% (Zou) and 12 to 21% by difference (Johnson and Southgate); almonds lowered energy digestibility from 90.5
  to 85.5% at 84 g/day (Novotny). Sex shortens colonic transit in men (Metcalf, p < 0.05; not applied). Stool form tracks
  colonic transit but not small-bowel transit (Degen and Phillips). Age and a small fibre dose did not change colonic
  transit (Metcalf). Iron status moves iron absorption more than diet does (Hurrell and Egli). None of these is applied
  as a modifier in the proposal.
- **Variation, kept apart.** Between people: colon transit SD about 17.9 h (derived) in Metcalf, 26 h in Larsen;
  small-bowel 2.2 h (Larsen). Within a person: not found. Measurement error: capsule and marker methods disagree
  (colon 35 h by markers against 28 h in Larsen and 15.9 to 28.9 h across capsule studies; the review attributes the
  spread to protocol). Model uncertainty: the bread-specific digestibility is unknown (McCance and Walsham, no figure
  read), and the unmodelled endogenous mass in faeces is of the order of the measured dry output.
- **Synthesis or meta-regression.** Not used. The pooled `T_SI` is Yu's own literature pooling, taken as given.
  The transit studies use different methods and cannot be pooled by this card.
- **Not found (searched).** Per-nutrient uptake rate constants for the chain; zinc fractional absorption and wheat true
  ileal protein digestibility in humans (two Europe PMC searches returned no abstracts with these numbers); bread starch
  malabsorption beyond a relayed 1.3 to 5.0% of ingested starch unabsorbed in six ileostomates; colonic absorption
  capacity (Debongnie, no abstract); ileal effluent water in healthy volunteers (not found; a clinical series of 36
  ileostomy patients, 760 +/- 322 g/day, was only in search text and is a patient group).

## 4. Numerical method and timing (step-convergence tolerance)

- **Method: exact linear update.** The chain `dI_1 = in - (k_t + kappa) I_1`, `dI_j = k_t I_{j-1} - (k_t + kappa) I_j`
  is a lower-bidiagonal linear system; over a step `h` with input held constant it is advanced by its exact solution
  (matrix exponential, or the closed Erlang form for a bolus: content of compartment `j` is
  `m (k_t t)^(j-1) exp(-k_t t) / (j-1)!` when `kappa` = 0). The colon is `exp(-h/T_colon)`. Absorbed and residue
  amounts are integrated exactly, not by differencing a stepped state. LN-3's outflow is a function of time, so the
  intestine's input over the step is applied as its integral (the intestine receives, per step, the amount LN-3
  moved).
- **Tolerance.** The result is exact for piecewise-constant input, so the proposed acceptance is: runs at 60, 600 and
  3600 s steps agree on cumulative absorbed, colon and faeces amounts at common times to **1e-9 relative**, and all four
  balances close to 1e-9 relative each step. With an explicit Euler alternative, contents stay non-negative only while `h * (k_t + kappa) < 1`
  per compartment (0.0352 + about 0.017 per min for `a` = 0.94 gives h under about 19 min), so a 3600 s step is unsafe
  (my arithmetic, level 5); that is the reason for the exact update.
- **Timing.** In the `fast` phase after LN-3's transfer in the same step.

## 5. Functional tests the build must pass

1. **Four balances, separately, to 1e-9 relative, every step** (PLAN A6): total mass, water, energy, each nutrient,
   across stomach, intestine, colon, `faeces_store` and the absorbed pools.
2. **Nothing absorbed twice:** `A_c + I_c + C_c + F_c` plus the stomach equals the meal's `c` always; `a_i` in [0, 1]
   (configuration rejects otherwise); `kappa_i >= 0`.
3. **Chain checks:** with `kappa` = 0 the mean residence of a bolus equals `T_SI` to 1e-9; with `n = 1` the model equals
   Rex's two-compartment form; total absorbed equals `a_i` times the amount that entered after the chain has emptied.
4. **Linearity:** two meals run together equal the sum of the two meals run alone (the system is linear).
5. **Step invariance:** 60, 600 and 3600 s steps agree to 1e-9 relative (section 4).
6. **Water:** colonic water absorption is never negative; the model never adds water (no secretion), and when W2's
   target cannot be met the shortfall is reported as faecal water below `w_f`, not created.
7. **Declared boundary:** a test names *secretions and their reabsorption, bacterial mass, desquamated cells and mucus* as
   outside the balances, and asserts no unnamed term exists in any balance.
8. **Energy:** faecal energy equals `E_eaten - E_absorbed` (A6) with `E_eaten` gross; configuration fails if the
   food's energy basis is not declared (LN-1), so digestibility is never applied twice.
9. **Colon and store are disjoint:** a gram moves from colon to `faeces_store` by one internal transfer and is never in
   both; voiding (M4) removes from the store only.
10. **Configuration:** a missing `a_i`, `n`, `T_SI` or `T_colon` fails before the run; a missing coefficient is never zero,
    and `a_i` is never defaulted to 1 for a constituent that has none (the current default must not carry over silently).
11. **`gutFunction`:** applied as the existing multiplier it leaves `gutFunction = 1` identical; any other semantic
    (transit shortening) is not tested because no source fixes it.
12. Rollback, once-only and one outcome per cause are LN-2 §5's, unchanged.

## 6. Validation

- **Independent observations (not used for any parameter) and acceptance tolerance (proposed; the keeper may
  change it).**
  - *Small-intestinal transit:* modelled mean residence 3.3 h (199 min) against Larsen controls 4.8 +/- 2.2 h and the
    capsule range 3.3 to 7 h (Nandhra): inside both (at the lower edge of the range).
  - *Colonic transit:* calibrated `T_colon` = 35 h (Metcalf, markers) against Larsen 28 +/- 26 h (inside one SD) and the
    capsule range 15.9 to 28.9 h (**outside**, 6 h above): method difference recorded, not tuned.
  - *Whole gut:* gastric half-time (about 1 h) + 3.3 h + 35 h is about 39 h (my sum, level 5) against Larsen 36 +/- 26 h and
    the capsule range 23.0 to 37.4 h: inside the first, slightly above the second.
  - *Digestibility:* a mixed-diet run should give apparent digestibilities inside the Zou 2007 ranges (protein 81.4 to
    90.0, fat 87.0 to 95.7, carbohydrate 91.1 to 95.5%); the calibration values (Novotny: protein 91.0, fat 97.8, carbohydrate 94.0) are inside
    the carbohydrate range and above the protein range by 1.0 point and the fat range by 2.1 points (my comparison,
    level 5), so on this check the calibrated fractions sit at or above the top of Zou's diets for protein and fat.
  - *Faecal output:* wet faeces by W2 for the modelled dry residue, against the wet mass 128 g/day (Rose) and median 106
    g/day (Cummings); the **modelled dry residue is expected to be below** the measured 29 to 32 g because bacteria,
    mucus and cells are outside the model, so the proposed pass is only that the gap is reported and that the modelled
    residue is not above the measured total. Faecal energy loss as a fraction of intake against 4.6 to 8.0% (Slavin) and
    9.5% (Novotny energy digestibility 90.5%).
  - *Micronutrients:* iron absorption of a mixed meal against 14 to 18% (Hurrell and Egli); the existing rule's values were
    not read, so this comparison is the keeper's.
- **Independence.** Calibration sources (Yu, Novotny, Metcalf, Rose's `w_f`) and validation sources (Larsen, Nandhra,
  Zou, Slavin, Cummings, Hurrell) are disjoint, with two cautions: Rose 2015 and Novotny 2012 give the same faecal
  energy figure (132 kcal/day), so the faecal-energy comparison may not be independent, and Larsen/Nandhra measure with
  capsules while Metcalf used markers.
- **If none is available, say so.** There is **no independent measurement of the timing of nutrient appearance after
  a bread meal** (absorption kinetics) in any opened source, no bread-specific digestibility figure (the McCance and
  Walsham page had no readable figures), no ileal water output in healthy volunteers, and no secretion volumes. The
  small-intestinal uptake timing is therefore unvalidated.

## 7. Status (PLAN §6 columns) and recommendation

- **Status:** designed.
- **Recommendation (a proposal).** Transit chain `n = 7`, `T_SI = 199 min`; macronutrient `a_i` from the Novotny control
  diet (carbohydrate 0.940, protein 0.910, fat 0.978; energy from the constituents, with a **gross** energy basis); the
  existing rules for micronutrients, moved to the intestine; one colon compartment with `T_colon = 35 h` (an
  optional third stage; PLAN §8.4's colon-empty first build is acceptable); water by W2; secretions a declared
  boundary. One coherent set, one meal type, no modifiers.
- **Unresolved choices for the keeper or Rex.** (1) `n = 7` or Rex's `n = 1` (the single compartment is contradicted by Yu
  1996 for profile shape, not for mean timing); (2) `T_colon`: 35 h (markers) against 15.9 to 28.9 h (capsule studies);
  (3) W1 (fraction, 0.93 from the review) or W2 (target composition, 0.75); (4) whether `gutFunction` and the flux rules
  stay as multipliers or become transit changes; (5) the energy basis in LN-1 (gross or metabolisable); (6) whether `a_i = 1`
  stays as the default for any constituent with no rule.
- **Limitations.** The macronutrient fractions are apparent whole-diet values from one controlled diet, not bread; `n = 7`
  is relayed; colonic water uses a review's pooled figures; no secretion, fermentation, bacterial or endogenous mass;
  validation of absorption timing is absent.
- **Optional extensions (never prerequisites).** A three-segment colon; fermentation energy and short-chain fatty acids
  (CG-10); transit as a function of fibre and diarrhoea; bread-specific digestibility and starch malabsorption; per-nutrient
  uptake constants; a secretion term once a source gives volumes.
