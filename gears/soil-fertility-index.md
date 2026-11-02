# Derived soil fertility index (3001)

Formula: `f = clamp01(f0 * min(N/N0, P/P0, K/K0))`. The host supplies a cell
and initial `f0` in [0, 1]; creation records immutable reference pools N0, P0,
K0 in kg. Current pools change only through the nutrient ledger. `f` is a getter,
never an independently drained stock. The clamp limits only the display/yield
index, never mass; adding manure beyond f = 1 retains every kg.

Why: a Liebig minimum expresses limitation by the least remaining relative
nutrient pool. It replaces the duplicate per-harvest index drain. The exact
mapping from bulk elemental stocks to crop fertility is an **evidence level 4
estimate**, not a calibrated availability model. Initial pools must be strictly
positive to define each ratio. f0 = 0 is allowed and yields a permanently zero
index; slow f-rate-to-kg conversion refuses it because it divides by f0.

The existing yield rule remains `maxYield * (0.3 + 0.7*f) * rain * labour`;
harvest reads f before its transfers. Harvest removal figures are kg per tonne
from `ecology.nutrient_removal`, with the yield on that row's basis. The 0.3
yield floor still permits demand from depleted soil; harvest reports the
shortfall explicitly and credits only the nutrients actually available. This
rule does not claim to predict a physically attainable harvest under starvation.

Scope and limitations: relative pool size alone does not resolve bioavailability,
chemical forms, rooting depth, pH, water constraints, fixation or microbial access.
The host's f0/pool0 determine sensitivity; comparing f across different initial
baselines is not an absolute fertility measurement. A legume's harvested N is
not all soil-derived N; no unsupported fixation credit is applied. Source
selection and the provisional fallow/erosion rules are in `soil-integration.md`.

Numeric homes: `data/library/ecology.json` for yields, removal, manure and slow
rates; host stocks for f0 and pool0. The former `fertility-drain-per-harvest` row
and `cropDemand()` inspection API retain their historical values, marked
superseded, and are not used by harvest.

Provenance: Reality keeper's unit 3001, Rex-approved CG-20 (2026-11-01), applying
the Liebig minimum as the specified index mapping. No additional empirical
source or calibration is asserted for this formula.

Validation: unvalidated. Tests verify the getter, limiting element, clamp-only
display behavior and ledger coupling. Independent long-term fertility-trial
N/P/K budgets and yield responses under controlled limiting nutrients, with
observed uncertainty, are required to validate the mapping and its coupling.
