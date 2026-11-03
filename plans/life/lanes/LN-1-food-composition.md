# LN-1 Food composition: lane card (Life keeper, 2026-11-02; draft for review, not committed)

Checkpoint CP-1. Plan: `../PLAN.md` §3.A5, §8.1. Research unit: `../drafts/life-22-research-foods-1270.md` ({FOODS-1270}).
Nothing here is a value. Every number comes from the research unit's opened sources or stays null.

## 1. Relationship and conditions

**What the lane provides:** one composition record for the M1a food, so that a portion of `q` kg carries
`q × c_k` of each constituent k (A5, `foodContent`, `src/nutrition.ts:127`). That is the whole relationship: linear in
mass, per 100 g of edible portion as eaten. It applies only to the record's stated preparation and condition; staling,
drying and spoilage after that condition are out of scope (spoilage of stored goods is Economy's).

**Identity (exact):**
- The record is keyed by the Catalogue's `catalogue/product.<bread>` (CAT-13; Catalogue PLAN §3 ruling (j)). The
  Catalogue owns identity and source references; Life owns the composition values (CAT-Q1).
- **The grain is open.** Catalogue sheet B1(b) (`native/h1-england/SHEET-M1A.md`, not yet written) names which bread
  sources attest as household bread in England around 1270 (wheaten, maslin or barley), with its ingredients,
  preparation and condition. If B1 does not settle it, the choice comes to Rex (LIFE-Q13), not to this lane.
- **Condition:** the record names one condition, for example "the day of baking". The scenario must match it.
- **The ref (agreed with Economy, EN-1, 2026-11-02):** every Life composition row carries
  `ref: catalogue/product.<slug>`, and Economy's `foodOf(good)` is the Life row with the good's ref. Life checks at load
  that **at most one** composition row has a given ref, and throws on a duplicate. A different preparation or
  condition is a different Catalogue product with its own ref, never a second row under the same ref.
- **Load-time resolution (agreed with Economy, 2026-11-02):** missing data is not inedibility. Every food the scenario
  declares must resolve to exactly one applicable composition row: one row for its ref, whose stated condition matches
  the scenario's declared condition. A missing, duplicated or condition-mismatched composition **fails configuration
  before the run**; it is never an in-world `impossible` that Cognition could learn. Likewise a good outside the scenario's supported ingestion pathway, and invalid input, are host or configuration errors, recorded in the trace and never an in-world outcome; no physiological conclusion is invented for them (agreed with Economy, 2026-11-02).
- **Run-pinned composition:** at load Life records, for each resolved food, its food id and a content hash of its
  rows (`foods`, `foods_more`, `food_basis`, `food_refs`) in the run record. Replay loads the same content or fails
  explicitly on a hash mismatch.
- The Life food id is a new row; the ship-period `nutrition.foods.bread-fresh` (`nutrition.json:51`) is not reused and
  not edited. Its marks (`proposed`, source `open`, conf `high` with no source) are LIFE-31.

## 2. State, units, owner

| Constituent | Unit per 100 g edible | Basis that must be declared | Owner |
|---|---|---|---|
| water | g | moisture method (oven drying, conditions) | Life |
| protein | g | N × the conversion factor the source used (say which) | Life |
| fat | g | total lipid, method | Life |
| carbohydrate | g | **available** (monosaccharide equivalents or weight) **or by difference**; never both | Life |
| fibre | g | method (for example AOAC total dietary fibre, Englyst NSP); stated as inside or outside the carbohydrate figure | Life |
| ash (or "other") | g | measured ash, or the declared residual | Life |
| alcohol | g | 0 if the source says so; null otherwise | Life |
| energy | kcal | **metabolisable**, with the factors used (Atwater general, or specific) | Life |
| minerals and vitamins (the existing `foods` and `foods_more` columns) | mg or mcg as the column heading | analytical, or "calculated from ingredients" | Life |
| density or specific volume | kg m⁻³ or m³ kg⁻¹ | only if LN-2's capacity model is a volume; crumb or whole loaf, stated | Life |

**Non-overlap (the mass partition).** The mass categories water + protein + fat + carbohydrate + fibre (if outside
carbohydrate) + ash + alcohol must partition the 100 g: no constituent counted twice (sugars inside carbohydrate, fibre
inside carbohydrate-by-difference), and the sum equal to 100 g within the residual the source states. Sub-components
(sugars, starch, individual fatty acids) are recorded, if at all, as **parts of** a category, never as additional mass.

## 3. Parameters, sources, uncertainty

Every value carries: source, table and food code; whether it was measured on this food, on a modern equivalent
(McCance and Widdowson, USDA FoodData Central), or reconstructed from ingredients; and a low and high.
- **Two uncertainties, kept apart:** analytical spread (the table's own range or sample count) and **reconstruction**
  uncertainty (how far a modern equivalent may differ from the 1270 preparation: flour extraction rate, bran content,
  grain mix, salt, loaf moisture). The second is stated in words with whatever source bounds it; where nothing bounds it
  the row says "unbounded" rather than inventing a range.
- The water value is checked against the share the Catalogue cites; a mismatch is reported and resolved by Life with
  its reason.

## 4. Numerical method and timing

None: composition is static data, read at ingestion (A5). The only arithmetic is `q × c_k` and unit scaling.

## 5. Functional tests (CP-1)

- **Identity:** the record resolves by the Catalogue ref and by the Life food id; an unknown id throws (`foodRow`).
- **One row per ref:** a library with two rows sharing a ref fails to load. A scenario that declares a food whose ref
  has no row, or whose row's condition differs from the scenario's, fails configuration before the run.
- **Pinning:** the run record holds each resolved food's id and content hash; a replay against changed rows fails
  with the mismatch named.
- **Units:** each constituent's unit is the one its column heading declares; kcal per kg = 10 × kcal per 100 g; mg and
  mcg scale correctly; a test asserts the round trip for every column.
- **Portion:** a portion of q kg carries exactly `q × 10 × c_k` of each constituent; q = 0 and q < 0 are rejected
  before any transfer (LN-2).
- **Partition:** the mass categories sum to 100 g within the stated residual; no constituent is in two categories.
- **Energy consistency:** the stated metabolisable energy and the energy recomputed from the declared factors agree
  within the tolerance the source or factor system states; a disagreement is reported, not silently resolved.
- **No reuse:** the ship-period row is unchanged.

## 6. Independent comparison

The composition is compared with measured food data **other than the row's own source** (for example McCance and
Widdowson against FoodData Central, or a published analysis of a historical-style loaf). The tolerance is the
analytical spread of the comparison source. A reconstruction outside it is reported, not tuned.

## 7. Status

D: this card. I, C, N, V: none. Blocked on Catalogue B1(b) for the grain (or LIFE-Q13).

## Code gaps the build must close (not this research)

- `foods` has no fibre, ash or alcohol column, and no basis per value (`FOOD_COLUMNS`, `src/nutrition.ts:73-78`). The
  research unit records them in a separate table `nutrition.food_basis`; the {GUT} build wires them.
- The ref lives in a table `nutrition.food_refs` (Life food id → Catalogue ref), written by the research unit; the
  {GUT} build adds the load-time uniqueness check and the ref lookup.
- `foods` and `foods_more` must keep the same rows (`src/nutrition.ts:103`), so the new food is one row in each.
- Energy is stored as given (`kcalPerKg = kcal × 10`), not derived; §5's consistency test is the guard.
