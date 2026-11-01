# Organ crisis floors (2633)

Formula: open an organ crisis when known `function <= Floor`; resolve the condition
when function rises above the floor. Unknown function supplies no threshold result.
This observes biological failure; only the host's `declareDeath` resolves a crisis
as a death. Neither the gear nor the ledger reads or writes fate.

The numeric home is `data/library/anatomy.json`, table `crisis_floors`: the brain,
heart and lungs use 0.2; the liver and kidneys use 0.1. `src/anatomy.ts` reads that
table through `libraryTable`; these prose values describe it and are not another
runtime configuration. Crisis causes remain the organ row ids for compatibility.

Source: the game's ANATOMY.md section 3a, 2026-10-29. Evidence level **5
(hypothesis)**, not clinical thresholds. No game file is imported at runtime.

Validation: `validation.crisis_thresholds.organ-function-floors` has null Value,
Low and High. No independent threshold was found in the supplied reference data.
Proposed experiment: define measurable organ-specific function endpoints, then
compare failure and recovery in independent longitudinal clinical observations
across those endpoints. Estimate thresholds and uncertainty separately for each
organ before replacing these hypotheses. A common dimensionless function scale
has not been clinically calibrated.

Collagen tissue (2787): open a crisis when known integrity reaches its Floor 0;
resolve the condition when integrity rises above the floor. The numeric home is
`anatomy.crisis_floors.connective-tissue-collagen` in the same table. Its cause is
`anatomy.tissues.connective-tissue-collagen`, its source is the floor row, and its
risk is null: no death is rolled, and the host decides through `declareDeath`.

Source: `validation.scurvy_consequences.death-cause-modern` (Pimentel 2003;
Francescone and Levitt) states that untreated scurvy is fatal. Evidence level
**5 (hypothesis)** for the floor: zero is the bottom of the integrity scale,
chosen because no source gives a lower level, not a measured fatality threshold.
Validation candidate: compare the current depletion law's day-102 crisis against
independently staged clinical progression and treatment response, and historical
voyage accounts with known food withdrawal. Anson mortality is second-hand and
not all attributed to scurvy; this comparison is not a fit. See the (2787) report
in `flags/medicine.md` for timing and reference limitations.
