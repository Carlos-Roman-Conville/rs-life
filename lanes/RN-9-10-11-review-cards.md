# RN-9 to RN-11: review cards for the built physical mechanisms (Reality keeper, 2026-11-02; draft)

Plan: `../PLAN.md` §3.0, §3.L. Built is not validated. These cards record what each mechanism is today against the
seven items, and what a review must establish. Items marked **to check** are not yet read in the code. Nothing is
changed or queued here. A defect a review finds becomes its own issue and unit.

Each review runs as a sonnet audit unit (read only), then composer test units for the gaps it lists. They can run in
parallel with CP-1 from S0.

## RN-9 Heat transfer and phase change

1. **Relationships and domains.** Wall conduction with a tabulated assembly U (2.11 W m⁻² K⁻¹, 228 mm brick); film
   coefficients h A ΔT; effectiveness–NTU condenser with `Cr = 0`, `ε = 1 − exp(−UA/C_cold)`; Churchill–Chu natural
   convection on the water side; ASHRAE still-air pool evaporation `ṁ = (0.089 × 0.5 / L) A (p_sat − p_partial)`;
   Antoine boiling; latent heat (README:47-71). The domain of each (temperature, geometry, flow regime) is **to check**
   against its source; the pool form is already named as extrapolated toward boiling.
2. **State.** Lumped component temperatures and enthalpies (Reality); room air temperature and humidity (Reality).
3. **Parameters.** Brick 1920 kg m⁻³ and 790 J kg⁻¹ K⁻¹ (LBNL); cp rows in `data/materials.json`; the 90 mm tube and
   1 kg min⁻¹ coolant are stated assumptions. Uncertainty fields are absent (RN-14).
4. **Numerics.** Explicit one-second steps. **To check:** a step-convergence test (1 s against 0.1 s), and the
   stability limit for the smallest heat capacity in use.
5. **Functional tests.** Focused balance tests exist (README:73-74). **To check:** hot-to-cold direction always;
   equilibrium reached with no overshoot; latent energy counted once between the pool, the vapour and the room;
   limiting cases (ΔT = 0, zero area).
6. **Independent observations.** None recorded. The two-hour room regression uses a derived upper bound, not a
   measurement (README). Candidates: measured pool evaporation rates and condenser performance data, **to open**.
7. **Status.** D yes, I yes, Cn room and body ports, N focused balances, V not recorded.

## RN-10 Gases and chemical reactions

1. **Relationships.** Ideal gas; room box model with air changes per hour; gas sources and sinks; the host lattice
   grid (README:186-194). Reactions: stoichiometric records, threshold ignition, first-order Arrhenius where sourced
   (`k = k0 exp(−Ea/RT)`, consuming `1 − exp(−k Δt)` of the limiting reagent), otherwise complete within the step
   (README:76-97). All four seed reactions use complete-within-step.
2. **State.** Contents per component (kg), element mass per boundary, room gas fractions and pressure (Reality).
3. **Parameters.** CIAAW atomic weights; formation enthalpies at 25 °C (calcination 178 kJ mol⁻¹, slaking
   65 kJ mol⁻¹). No kinetic parameters in the seed set.
4. **Numerics.** Per-step element ledger (`conserveElements`). Gas transport is instantaneous. **To check:** whether
   reaction order within a step changes the result, and convergence of the Arrhenius form as Δt shrinks.
5. **Functional tests.** **To check:** limiting reactant chosen correctly; no negative amounts under competing
   reactions; element and mass balances across a boundary with a gas edge; endothermic stop and restart.
6. **Independent observations.** None recorded. Complete-within-step cannot validate reaction timing, so any timing
   claim is withheld until a sourced rate model exists for that reaction.
7. **Status.** D yes, I yes, Cn n/a, N per-step element check, V no.

## RN-11 Environmental inputs and soil stores

1. **Relationships.** BoM WBGT; diurnal half-cosine temperature; exposure rows (README:196-206); the soil N, P, K
   ledger through `transfer()` (3001, 3021). Weather is a declared boundary input (NP-3; England 1270 series from the
   Catalogue). CG-1 light and CG-2 soil water are designed in research notes, not built.
2. **State.** Place conditions (derived, no transfer); soil pools in kg per cell (`soils.ts:24`), per area through
   `poolPerArea` (Reality).
3. **Parameters.** WBGT constants from BoM; crop removal rows (5457). **To check:** the half-cosine's amplitude and
   phase source.
4. **Numerics.** Hourly or per-step conditions; daily soil flux. **To check:** time alignment between daily soil and
   faster body steps.
5. **Functional tests.** `transfer()` refuses a debit beyond the pool (3001). **To check:** uptake and return recorded
   once; units per cell against per area at every port; a missing weather day stops the run with the gap named.
6. **Independent observations.** None recorded. Candidates: measured WBGT against station data, and soil balance
   studies for the crops represented, **to open**.
7. **Status.** D yes, I yes (conditions, soil ledger), Cn ports in kernel.json, N yes, V no.
