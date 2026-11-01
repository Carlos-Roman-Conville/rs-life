# CG-8: gaseous nitrogen losses (denitrification, nitrification by-products, ammonia volatilisation)

Research unit 3005, 2026-11-01. Research only: no code, no registry edit. Companion to CG-7 (nitrogen inputs, unit 3004) and CG-9 (per-cell soil pools, unit 3001).

## Question

Today nothing removes nitrogen from the soil as a gas. CHAINS.md lists "losses: denitrification, volatilisation" as
`missing (no equation): CG-8`. The soil nitrogen pool `world.soil_n` (kg per soil cell, planned, writer
`realism.terrain.soils`) changes only by transfer and sends losses to `loss:<pathway>` accounts. The only loss flux in
the registry is `world.nutrient_flux_n` (kg/d, runoff, leaching, erosion, deposition; writer
`realism.terrain.nutrient_transport`, planned), so gaseous N has no quantity, no equation and no account.
The inputs such an equation needs are partly registered and partly missing: `world.soil_ph` (unit `1`, writer
`realism.terrain.soils`), `world.soil_water` (m^3/m^3, root-zone volumetric water, writer null), the `world.soil`
record (porosity, bulk density, moisture, organic matter; no unit), `world.mineralisation_flux_n` (kg/d, writer
`realism.ecology.decomposition`, planned). In a grep of the `world.soil*`, `world.nutrient_flux*` and
`world.mineralisation*` ids I found no ammonium or nitrate quantity (the pool is total N), no soil temperature and no
heterotrophic respiration; the keeper should confirm those do not exist under other prefixes (for example `world.soil_temperature`). This
file gives the equations for three gaseous pathways (denitrification to N2 and N2O, N gas from nitrification, and NH3
volatilisation from urea, manure and fertiliser) and the IPCC Tier 1 fractions as a fallback, in a form a daily step
per cell can run.

## Equations

Conventions: all stocks and fluxes are kg N per cell (flux per day); a cell record carries `areaM2`, so a per-area
rate in kg N m^-2 d^-1 is multiplied by `areaM2`. T is soil temperature (°C unless marked K), WFPS is water-filled pore space
(dimensionless, 0 to 1).

**Conservation form (PLATFORM.md §7a: one transfer per physical flow, Δsource = −q, Δdestination = +q, losses separate).**
For one cell and one day, with mineral pools N_NH4 and N_NO3 (kg N):

- Enters: CG-7 inputs (deposition, fixation, manure and urine N, residue N) and `world.mineralisation_flux_n`.
- Leaves, each its own transfer from the soil pool to a `loss:` account: `loss:n2o`, `loss:n2`, `loss:nox`, `loss:nh3`
  (this unit), beside leaching and runoff (`world.nutrient_flux_n`) and plant uptake (CG-3).
- Accumulates: Δ(N_NH4 + N_NO3) = inputs − uptake − leach − (q_N2O + q_N2 + q_NOx + q_NH3).
- Each q is taken from a named pool (q_NH3 and the nitrification gases from N_NH4; q_N2O(den), q_N2 and q_NOx(den) from N_NO3) and is capped at
  what the pool holds after the earlier flows of the same step, so the pool never goes negative and the element
  ledger closes to the 1e-9 tolerance. The order of the caps is an open choice (see report).

**E1. Water-filled pore space.** WFPS = θv / φ, with porosity φ = 1 − BD / PD, bulk density BD (g cm^-3), particle
density PD = 2.65 g cm^-3 (a mineral-soil constant used in the DayCent study, source S5). θv = `world.soil_water`
(m^3/m^3). Valid for mineral soils; clamp to [0, 1].

**E2. Nitrification and its gaseous by-products (Xu-Ri and Prentice style, as implemented in LPJ-GUESS by Ma et al. 2025, S1).**
Equation forms were read from an HTML extraction of the paper that garbled several layouts; the forms marked ⚑ were
internally inconsistent in the extraction and must be re-checked against the paper before implementation.

- R_nit [kg N d^-1 per area] = k_nit · N_NH4,aerobic · f_T,nit · f_W,nit · f_pH,nit, with k_nit = 0.1 d^-1 (S1, after Khalil et al. 2004).
- f_T,nit = ((70 − T)/(70 − 38))^12 · exp(12 · (T − 38)/(70 − 38)); peak at 38 °C (S1).
- f_W,nit = 0.239 · exp(2.38 · WFPS) for WFPS ≤ 0.6 (this branch reaches 0.997 at WFPS = 0.6, so it is self-consistent); then falls to 0 at WFPS = 0.8 (S1, after Gleeson et al. 2010).
  ⚑ The falling branch printed as 1 − 10.2·(WFPS − 0.6) reaches 0 near WFPS = 0.70, not 0.80. A straight line from 1 at 0.6 to 0 at 0.8 would have slope −5. The coefficient is null until checked.
- f_pH,nit = 0.56 + arctan(0.45 · π · (pH − 5)) / π (the DayCent pH function after Parton et al. 2001, as quoted in S1).
- Gaseous share: R_gas,nit = F_gas · R_nit with F_gas = 0.25 (S1, after the MICN model), split into NOx and N2O by
  P_NOx = 1 − 0.5 / (1 + exp(−20 · (WFPS − 0.375))); N2O share = 1 − P_NOx.
- The simpler DayCent alternative: a fraction of nitrified N is lost as N2O, between 0.020 (at wilting point) and 0.025 (at field capacity) (S5, default tunable parameters N2Oadjust_wp, N2Oadjust_fc). Given as a pair of defaults, not as the full DayCent equation.

**E3. Denitrification, product form (generic daily form; the shape used by NEMIS, NOE/ECOSSE and the models Heinen 2006 reviews, S6).**
q_den = D_pot · f_NO3 · f_W · f_T, where D_pot is a potential rate and each f in [0,1]. Heinen's review (S6) reports the
consensus form (potential rate reduced by nitrate, water content as an oxygen proxy, temperature, sometimes pH), that
the water function differs most between models and drives the model's sensitivity, and that reduction functions are
soil-specific. Example water shapes named there: continuous exponential starting at WFPS 0.62 (NOE, ECOSSE); arctangent levelling off above WFPS about 0.7 to 0.9 (DayCent). D_pot, the exponent and the temperature response are null here: no accessible source gave them (the NEMIS paper and Heinen's paper were not readable in full).

**E4. Denitrification, Michaelis-Menten form (LPJ-GUESS/Xu-Ri, S1), the simplest fully specified form I found.**

- Anaerobic share of each pool X (NO3, labile C): X_anaero = f_an · X with f_an a logistic in WFPS between about 0.05 and 0.95, centred on WFPS = 0.5 (S1, after Li et al. 2000; ⚑ steepness 7.5 as extracted, layout ambiguous).
- R_NO2 = k_den · N_NO3,anaero · f_T,den · f_C · f_N, with k_den = 0.5 (S1).
  f_C = Rh,anaero / (K_C · θv + Rh,anaero), K_C = 0.017 kg C m^-3; f_N = N_NO3,anaero / (K_N · θv + N_NO3,anaero), K_N = 0.083 kg N m^-3 (printed as cm^-3, a unit typo by the extractor's reading) (S1, after Li et al. 1992, DNDC);
  f_T,den = exp(−((T − 37)/25)²) (⚑ squared form inferred in the extraction; the paper calls it a sigmoid).
- Gas from NO2: R_gas,den = k_den · R_NO2 · f_T · f_C · f_NO2 · f_pH,den · f_W,den. ⚑ f_NO2 is undefined in the extraction and f_W,den
  = (0.624 + 0.8 · arctan(0.45 · π · (10 · WFPS − 8))) / 2.85 went negative at WFPS 0.5 and 0.7 as printed; both must be re-read from the paper.
  f_pH,den = 0.001 for pH ≤ 4, (pH − 4)/3 for 4 < pH < 7, 1 for pH ≥ 7 (S1).
- Product split by WFPS (S1): below 0.7 the gas is NOx and N2O with N2O share max(0, (3.2·WFPS − 0.92)/(3.2·WFPS − 0.08)); at 0.7 and above the gas is N2O and N2 with
  N2O share = f_T · f_W · f_pH, where f_T = 1/(1 + exp((T − 5)/10)), f_W = 0.85 − 0.75/(1 + exp(−23·(WFPS − 0.75))), f_pH = min(1, 7.23 · exp(−0.497 · pH)). Direction check against independent data: a global synthesis found the N2O share of denitrified N falls as WFPS rises (S7, seen in a search summary only), which matches f_W.

**E5. DayCent structure (Parton et al. 1996 and 2001, Del Grosso et al. 2000; not read in full).** The primary papers and their PDFs were
not retrievable as text. Secondary descriptions (S2, S5, S8) agree on the structure: N2O from nitrification depends on
NH4, WFPS, temperature, pH and texture; total denitrification (N2 + N2O) is limited by the smaller of a nitrate term and a
soil-respiration (labile carbon) term, scaled by a WFPS function; N2:N2O is a nitrate-to-respiration factor times a WFPS factor,
rising with WFPS and CO2, falling with nitrate. Exact coefficients: null (not retrieved). The tunable defaults that
were retrievable are in Parameters.

**E6. NH3 volatilisation, physical-chemical core.** Only the un-ionised share of total ammoniacal N (TAN = NH4+ + NH3) can leave:
f_NH3 = 1 / (1 + 10^(pKa − pH)), pKa = 0.09018 + c / T_K, T_K in kelvin, valid 0 to 50 °C (Emerson et al. 1975, as reproduced in S9).
The constant c is printed as 2727.92 in the R documentation S9; 2729.92 is the value I remember, but that is not a source.
c is therefore listed as 2727.92 with the conflict flagged; at 298 K the two give pKa 9.154 and 9.161 (S9). The flux is then
q_NH3 = k_g · f_NH3 · TAN_solution, with a gas-phase transfer coefficient k_g that rises with wind speed and saturates
(Sommer et al. 1991, S10: loss rate rose with wind up to about 2.5 m/s, no consistent rise from 2.5 to 4 m/s; loss
rate rose exponentially with temperature over 6 h, r² 0.841; loss after 24 h rose with initial slurry pH; vapour
pressure deficit mattered mainly through temperature). k_g(wind) and the temperature exponent as numbers: null.

**E7. NH3 volatilisation, simplified soil form used in LPJ-GUESS/CLM5 (S1).**
q_NH3 = N_NH4,solution · f_T,NH3 · f_pH,NH3, N_NH4,solution = N_NH4 · W_rel (relative soil wetness).
f_T,NH3 = min(1, exp(308.56 · (1/71.02 − 1/(T + 46.02)))) (⚑ printed ambiguously; "best reading"); f_pH,NH3 = 0.6 for pH < 5, 1.0 for pH ≥ 8, rising in between
(⚑ slope extracted as 0.43 per pH unit, which overshoots 1 at pH 8; only the end points 0.6 and 1.0 are trusted). Release to air is
further scaled by a diffusion factor (1 − WFPS) · f_T,dif (S1). Written as a fraction of the pool per day, it is a first-order loss.

**E8. NH3 volatilisation from applied slurry, dynamic model (ALFAM2, S11).** A two-pool (fast and slow) TAN model driven by hours since application, TAN
application rate, slurry dry matter (1 to 15 %), slurry pH (5.5 to 9.0), air temperature (0 to 30 °C), wind speed at 2 m (0 to 10 m/s), rainfall
(0 to 2.5 mm/h), application and incorporation method. The coefficients are in the R package parameter set `alfam2pars03` and in Hafner et al. 2025; I could not read them: null.

**E9. IPCC Tier 1 fallback (2019 Refinement, Volume 4 Chapter 11; values via the tabulation S3 and the EF1 paper S4, not from the official PDF, which I could not read as text).**

- Volatilised N: N_vol = N_synthetic · Frac_GASF + N_organic_and_excreta · Frac_GASM (kg (NH3-N + NOx-N)).
- Direct N2O: N2O-N = EF1 · N_input (synthetic, manure, residue), EF3_PRP · N_urine_dung_on_pasture; indirect N2O from the volatilised N: EF4 · N_vol (all kg N2O-N).
- Tier 1 gives no N2 factor. The N2 loss at Tier 1 is null (no source).

## Parameters

Values are as written in the sources; "range" is across the sources I read. ★ = depends on climate or soil.

| Constant | Value | Unit | Source | Range / note |
|---|---|---|---|---|
| EF1 aggregated, all N inputs | 0.01 | kg N2O-N per kg N | S3 (IPCC 2019 Table 11.1) | 2006 and 2019 same |
| EF1 ★ dry climate, all inputs | 0.005 | same | S3, S4 | 95% CI 0.000 to 0.011 (S4) |
| EF1 ★ wet climate, synthetic and mixed | 0.016 | same | S3, S4 | CI 0.013 to 0.019 (S4) |
| EF1 ★ wet climate, organic | 0.006 | same | S3, S4 | CI 0.001 to 0.011 (S4) |
| EF1 flooded rice, aggregated | 0.004 | same | S3 | continuous flooding 0.003, drainage 0.005 |
| EF3 PRP cattle, poultry, pigs (aggregated) | 0.004 | kg N2O-N per kg N deposited | S3 | dry 0.002, wet 0.006 ★ |
| EF3 PRP sheep and other | 0.003 | same | S3 | |
| EF4 volatilisation re-deposition | 0.01 | kg N2O-N per kg (NH3-N + NOx-N) | S3 | dry 0.005, wet 0.014 ★ |
| EF5 leaching and runoff | 0.011 | kg N2O-N per kg N | S3 | for CG-9, not this gap |
| Frac_GASF synthetic, aggregated | 0.11 | kg N per kg N applied | S3 | ammonium 0.08, ammonium nitrate 0.05, nitrate 0.01, urea 0.15 |
| Frac_GASM organic N, urine and dung | 0.21 | same | S3 | uncertainty range not retrieved |
| Median NH3 loss, synthetic fertiliser | 14 % (10 to 19 %) | % of N applied | S12 (Bouwman 2002) | developing countries 18 % ★, industrialised 7 % |
| Median NH3 loss, animal manure | 23 % (19 to 29 %) | same | S12 | developing 26 % ★, industrialised 21 % |
| Urea NH3 loss, lab, 35 °C | above 60 % sandy loam, below 30 % sandy clay loam | % of applied (as reported) | S13 | ★ lab incubation, pH 8.0 to 8.6; conversion basis not stated; use as a texture contrast, not a constant |
| Q10 of NH3 loss from urea (lab) | 1.75 to 10.85 | 1 | S13 | ★ highest in sandy loam at higher dose |
| N2O from nitrification, hole-in-the-pipe | 0.1 to 4 % of nitrified N, rising exponentially with WFPS | % | S14 (via Friedl et al. 2021 summary) | ★ the Davidson 2000 original figure was not confirmed |
| DayCent N2Oadjust_fc / _wp | 0.025 / 0.020 | fraction of nitrified N | S5 | calibrated 0.000 to 0.004 at one site |
| DayCent Ncoeff | 0.030 | 1 | S5 | calibrated 0.027 |
| DayCent MaxNitAmt | 1.5 | not stated | S5 | calibrated 3.69 |
| DayCent wfpsdnitadj, N2N2Oadj | 1.0, 1.0 | 1 | S5 | calibrated 1.0 to 1.4, 1.0 to 1.159 |
| DayCent WFPS threshold for denitrification dominance | about 0.60 | WFPS | S5 | ★ site field capacity was 0.789 and wilting point 0.393 (one site) |
| Nitrification maximum rate k_nit | 0.1 | d^-1 | S1 | |
| Nitrification gas fraction F_gas | 0.25 | 1 | S1 | |
| Denitrification k_den | 0.5 | 1 | S1 | midpoint of 0 to 1 |
| K_C, K_N | 0.017, 0.083 | kg C m^-3, kg N m^-3 | S1 | unit of K_N read as m^-3 |
| Nitrification optimum temperature | 38 | °C | S1 | |
| Denitrification temperature centre, width | 37, 25 | °C | S1 | ⚑ |
| Denitrification WFPS start (NOE/ECOSSE) | 0.62 | WFPS | S6 | via a secondary summary |
| pKa constant c | 2727.92 | K | S9 | conflict with a remembered 2729.92 |
| Denitrification potential D_pot | null | | | no accessible source gave a value |
| k_g(wind) for NH3, temperature exponent of NH3 loss | null | | | not retrieved (S10 abstract gives only the shape) |
| N2 loss factor at Tier 1 | null | | | IPCC gives N2O only |
| NH3 loss per pH unit | null | | | one 2011 slurry study (S15) cites about 1 % per °C and 1.6 % per 0.1 pH unit; slurry-specific, not transferable |

Tropical and Caribbean: I found no Caribbean-specific values. Tropical sugarcane data: N2O emission factors of 0.7 to 2.4 % of
applied N in Queensland (S16), against the Australian national default of 2 %; Fiji reports a mean far above the 1 %
default (S16 summary, not verified at the source). The IPCC wet-climate values (EF1 0.016 synthetic, EF4 0.014) are the nearest official tropical figures. Lab urea data
from the Brazilian Cerrado (S13) show how steeply NH3 loss rises with temperature in warm soils.

## Inputs and owners

| Input | Read by | Writer today |
|---|---|---|
| soil N pool, by form (NH4, NO3) | E1 to E9 | `world.soil_n` (kg, total N) is planned (CG-9, `realism.terrain.soils`, unit 3001). No ammonium/nitrate split exists. |
| `world.soil_water` (m^3/m^3) | WFPS (E1) | writer null (planned, Reality) |
| porosity, bulk density | WFPS | field of the `world.soil` record, `realism.terrain.soils` (planned) |
| `world.soil_ph` | E2, E4, E6, E7, E8 | `realism.terrain.soils` (planned) |
| soil temperature | E2 to E8 | not found in my grep of soil ids; owner unknown |
| air temperature, wind speed at 2 m, rain rate | E6, E8 | not checked; the weather engines belong to Reality; the keeper should confirm names |
| heterotrophic respiration or labile C (Rh) | E4 | `realism.ecology.decomposition` (planned) produces `world.mineralisation_flux_n`; no respiration quantity found |
| manure, urine, fertiliser N applied | E6, E8, E9 | CG-6 and CG-7 (planned, 3004 research); excreta mass quantity does not exist yet |
| mineralised N | pools | `world.mineralisation_flux_n` (kg/d, planned) |

Nothing writes the gaseous losses today. Loss pathways (accounts under unit 3001's ledger): `loss:n2o`, `loss:n2`,
`loss:nox`, `loss:nh3`. Whether `loss:nh3` and `loss:nox` should feed back as deposition elsewhere (CG-7) is an open choice, because
N2 and N2O leave the modelled world, while NH3 and NOx return to land within days to weeks.

## Registry

Proposals for the registry keeper; I have not edited the registry.

| id | unit | scope | proposed writer | note |
|---|---|---|---|---|
| `world.soil_nh4_n` | kg | world (per cell) | `realism.terrain.soils` | split of `world.soil_n`; or keep one pool and a fixed NH4 fraction (open choice) |
| `world.soil_no3_n` | kg | world (per cell) | `realism.terrain.soils` | same |
| `world.denitrification_flux_n` | kg/d | world (per cell) | new `realism.ecology.n_gas_loss` | total N leaving as N2 + N2O + NOx from denitrification |
| `world.n2o_flux_n` | kg/d | world (per cell) | same | nitrification plus denitrification N2O, for the greenhouse budget |
| `world.nh3_volatilisation_flux_n` | kg/d | world (per cell) | same | |
| `world.nitrification_flux_n` | kg/d | world (per cell) | same | NH4 to NO3, needed by E2 |
| `world.soil_temperature` | °C | world (per cell) | Reality (soils or climate) | only if it does not exist under another id |
| `world.wind_speed_2m` | m/s | world (per place) | Reality (weather) | only if it does not exist |
| `world.soil_heterotrophic_respiration_c` | kg/d | world (per cell) | `realism.ecology.decomposition` | labile-C proxy for E4 |
| `world.water_filled_pore_space` | 1 | world (per cell) | derived view of `world.soil_water` and the `world.soil` record | not a new store |
| ledger accounts `loss:n2o`, `loss:n2`, `loss:nox`, `loss:nh3` | kg | ledger | unit 3001 | pathway names |

Change: `world.soil_n` description should say gaseous losses are transfers to these four accounts.

## Validation

Independent data and benchmarks, apart from the constants' sources:

- Ma et al. 2025 (S1) evaluated their N2O scheme against 49 natural-vegetation sites (tropical forest 13, temperate forest 21, boreal 5, grassland 8, savanna 2) and 55 cropland sites, and against the global N2O budget (Tian et al. 2024), NMIP (Tian et al. 2019) and atmospheric inversions; their model overestimated emissions by 65 % for natural vegetation and 11 % for cropland. Useful as the target accuracy for an implementation of this kind.
- The IPCC EF1 dataset behind the 2019 values (S4) gives wet/dry emission factors with confidence intervals to test annual per-input N2O.
- Bouwman et al. 2002 (S12): 1667 NH3 measurements in 148 papers, median losses by fertiliser and manure, a benchmark for annual NH3 loss fractions.
- ALFAM2 field database (S11) for dynamic NH3 loss from slurry against time, temperature, wind and pH.
- Cardenas et al. 2017 (S17): a grassland soil-saturation experiment measuring denitrification and N2O against WFPS, for the WFPS response.
- Takeda et al. 2022 (S16): tropical sugarcane N2O (Burdekin, Queensland) for a tropical case.
- Heinen (S6) warns that calibrated denitrification functions predicted cumulative totals for sand and loam but not individual rates, so test cumulative seasonal totals, not daily peaks.

## Sources

- S1. https://gmd.copernicus.org/articles/18/3131/2025/gmd-18-3131-2025.html : Ma et al. 2025, nitrification and denitrification schemes in LPJ-GUESS (after Xu-Ri and Prentice 2008): equations E2, E4, E7, constants, validation sites. Read via an HTML text extraction with garbled equations; ⚑ items flagged.
- S2. https://earthref.org/ERR/5408/ : Parton et al. 1996 record: the control variables of the N2 and N2O model (structure only).
- S3. https://greencalculus.com/data/afolu-agricultural-soils-factors/ : third-party tabulation of IPCC 2006 and 2019 Refinement Tables 11.1 and 11.3 (EF1, EF3, EF4, EF5, Frac_GASF, Frac_GASM). Secondary; the official PDF https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch11_Soils_N2O_CO2.pdf could not be read as text, so verify the values against it.
- S4. https://pmc.ncbi.nlm.nih.gov/articles/PMC9293294/ : the paper on refining EF1 (improved accuracy and reduced uncertainty); disaggregated EF1 with confidence intervals.
- S5. https://pmc.ncbi.nlm.nih.gov/articles/PMC13190764/ : DayCent N2O production study; default tunable parameters, WFPS formula, WFPS 60 % threshold. Describes the equations only qualitatively.
- S6. https://research.wur.nl/en/publications/simplified-denitrification-models-overview-and-properties/ : Heinen 2006 review of simplified denitrification models; product structure, water-function sensitivity, site specificity (via search summary).
- S7. https://smartfertiliserhub.org.au/publications/articles/a-global-synthesis-of-soil-denitrification-driving-factors-and-mitigation-strategies/ : global synthesis; N2O share falls as WFPS rises (seen in search summary only).
- S8. https://www.mdpi.com/2073-4395/11/4/770 : review of N2O controls and DayCent partitioning (search summary only; page returned 403).
- S9. https://cran.r-project.org/web/packages/AmmoniaConcentration/refman/AmmoniaConcentration.html : Emerson 1975 pKa equation and un-ionised fraction as implemented; valid 0 to 50 °C; constant printed 2727.92.
- S10. https://www.cambridge.org/core/journals/journal-of-agricultural-science/article/effects-of-temperature-wind-speed-and-air-humidity-on-ammonia-volatilization-from-surface-applied-cattle-slurry/A53BD8F9628E796C4CAC4C7C72764AEA : Sommer, Olesen and Christensen 1991 abstract: temperature, wind, humidity, pH effects on NH3 from cattle slurry.
- S11. https://cran.r-project.org/web/packages/ALFAM2/refman/ALFAM2.html : ALFAM2 inputs, valid ranges, parameter sets (coefficients not shown).
- S12. https://research.wur.nl/en/publications/estimation-of-global-nh3-emissions-from-synthetic-fertilizers-and : Bouwman et al. 2002 abstract: median NH3 loss fractions for fertiliser and manure, 1667 measurements.
- S13. https://www.frontiersin.org/articles/10.3389/fenvs.2025.1498282/full : Cerrado lab urea NH3 loss by texture and temperature, Q10 1.75 to 10.85.
- S14. https://academic.oup.com/bioscience/article/50/8/667/243260 : Davidson et al. 2000, hole-in-the-pipe model (search summary; the 0.1 to 4 % figure comes from the Friedl et al. 2021 summary that the search returned).
- S15. https://link.springer.com/article/10.1007/s11270-011-0835-4 : 2011 mechanistic model of NH3 from slurry; sensitivity to temperature and pH (search summary only).
- S16. https://link.springer.com/article/10.1007/s11104-022-05458-6 : Takeda et al. 2022, tropical sugarcane N2O emission factors in Queensland (search summary).
- S17. https://bg.copernicus.org/articles/14/4691/2017/ : Cardenas et al. 2017, effect of soil saturation on denitrification in a grassland soil (abstract page only).

## Report

- (3005) report: Confidence medium for structure and the IPCC Tier 1 fallback values (EF1 CIs confirmed in S4, the rest from a third-party tabulation S3), low for the denitrification and NH3 coefficients: the primary papers (Parton 1996 and 2001, Del Grosso 2000, NEMIS, Emerson, Hafner 2025) and the official IPCC PDF could not be read as text, so D_pot, k_g(wind), the NEMIS and DayCent coefficients are null, and the LPJ-GUESS equations (S1) carry ⚑ flags where the HTML extraction was garbled. Open choices for the keeper: (1) split `world.soil_n` into NH4 and NO3 or keep one pool with a fixed fraction; (2) whether NH3 and NOx losses return as deposition (CG-7) or leave for good; (3) order of the pool caps within a step; (4) Tier 1 fractions only (applied at the event, no N2 term) or the E2/E4/E7 daily forms; (5) whether soil temperature, wind and Rh already exist under other ids. The implementation unit will need: the original equations re-read from Ma et al. 2025's PDF (or Xu-Ri and Prentice 2008) to clear the ⚑ items, the official IPCC Table 11.3 uncertainty ranges, a source for D_pot and k_g(wind) (NEMIS, ALFAM2 `alfam2pars03`), `world.soil_water`, pH and soil temperature writers, and unit 3001's `loss:` accounts.
