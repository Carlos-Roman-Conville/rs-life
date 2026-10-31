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
