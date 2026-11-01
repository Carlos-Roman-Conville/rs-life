# CG-2: rain, vapour pressure deficit and root-zone soil water at a place

Research unit 3003 (2026-11-01). Research only: no code, no registry edit. Reads: CHAINS.md (row 1.2 and gap CG-2), `../registry/quantities.json` (by grep), PLATFORM.md section 7a (the transfer rule, as the task states it).

## Question

Life's plants read `place.rain` (mm/d, scope place), `place.vpd` (kPa, scope place) and `world.soil_water` (m^3/m^3, root-zone volumetric water, scope world). All three are registered as planned (LIFE-2, Life keeper 2026-10-31) with `writer: null`; Reality is to write them and register the writer with its design. CHAINS.md row 1.2 records "No writer" and the gap is CG-2, "missing (no equation)", priority 3. `realism.terrain.hydrology` (planned) writes `world.groundwater` (m3, "groundwater stored per area") and `world.drainage` (a record, unit null) only. Nothing in the registry gives a place an air-temperature, dew-point, wind, solar-radiation or latitude quantity: grep of the registry finds `air.rh` (fraction, written by `realism.gas.room_box`, a room-scale model), `air.room_t`, `air.pressure`, `air.pressure_field` (planned), `air.wind` (m/s) and `world.elevation` (m, planned), but no place-scope climate input. So three equations are missing (a daily rain generator, a vapour pressure deficit, a root-zone water balance), and so are the climate inputs they need.

## Equations

Notation: day index i; T in degC; pressures in kPa; depths in mm (1 mm over 1 m^2 is 1 kg of water, and 1 mm over A m^2 is A/1000 m3).

### E1. Saturation vapour pressure (Tetens form, as used by FAO-56 and ASCE)

e°(T) = 0.6108 · exp( 17.27 · T / (T + 237.3) )   [kPa; T in degC]

Source: FAO-56 Eq. 11 and the UC Davis ASCE-EWRI write-up Eqs. 8-9, 11, 19. It is Murray's 1967 water-surface fit, rescaled to kPa. Valid range: above 0 degC; the form is within about 1 Pa of exact values to 35 degC (Monteith and Unsworth, as quoted on Wikipedia). Murray's own abstract says it is close to Goff-Gratch except at low temperatures. Over ice (below 0 degC) a different pair of constants applies (Murray's ice fit, a = 21.8745584, b = 7.66 with T in kelvin and e in hPa); a place that freezes needs a keeper choice (see Registry).

### E2. Actual vapour pressure (pick by what the climate normals give)

- from dew point: ea = e°(Tdew)   (FAO-56 Eq. 14)
- from RHmax and RHmin: ea = [ e°(Tmin)·RHmax/100 + e°(Tmax)·RHmin/100 ] / 2   (Eq. 17)
- from RHmax only: ea = e°(Tmin)·RHmax/100   (Eq. 18)
- from mean RH: ea = es · RHmean/100   (Eq. 19; FAO-56 calls it the least desirable)

es (mean saturation vapour pressure) = [ e°(Tmax) + e°(Tmin) ] / 2   (Eq. 12)

### E3. Vapour pressure deficit

VPD = es − ea   [kPa]   (FAO-56 chapter 3; no separate equation number)

This is the daily-mean form that the Penman-Monteith term uses. A plant's daytime deficit is larger than this because it is weighted to the warm hours; a form such as e°(Tmax) − ea would be a design choice that no source fetched here confirms. The simplest daily form is E3 as written. Valid for ea ≤ es; clip at 0.

### E4. Rainfall occurrence: first-order two-state Markov chain (Richardson and Wright, WGEN)

P(W/W) = probability of a wet day after a wet day; P(W/D) = probability of a wet day after a dry day; P(D/W) = 1 − P(W/W); P(D/D) = 1 − P(W/D). Two numbers fix the chain (ARS-8, p. 6). Each is constant within a month and varies from month to month.

Two consequences follow by algebra (derived here, not quoted): the stationary wet fraction is π = P(W/D) / (1 − P(W/W) + P(W/D)), and with persistence r = P(W/W) − P(W/D) the chain is P(W/D) = π(1 − r), P(W/W) = P(W/D) + r. So a monthly wet-day count n_wet in d_m days gives π = n_wet/d_m, and r is the one free parameter left (see Parameters).

A wet day in WGEN is a day of 0.01 inch or more (0.254 mm). The threshold that defines a wet day in the normals must match the one the generator uses.

### E5. Rainfall amount on a wet day: two-parameter gamma

f(p) = p^(α−1) · exp(−p/β) / ( β^α · Γ(α) ),  p, α, β > 0   (ARS-8 Eq. 2). Mean of a wet-day amount μ = α·β; for 0 < α < 1 the density falls with p (many small, few large). Parameters are constant within a month.

From normals: μ = R_month / n_wet (mm per wet day; this is identity, since the month total is the wet-day count times the mean wet-day amount). With α given, β = μ/α. If a station record is available, α can be fitted by the Thom (1958) approximation to maximum likelihood (McSweeney's thesis uses it; the explicit formula did not extract, so it is not reproduced here). Geng et al. (1986) are cited (via the GMD discussion) for regressing P(W/D), P(W/W) on the monthly wet fraction and for a near-constant gamma shape with scale tied to the mean wet-day amount; the regression coefficients were not obtained (null).

Daily rain: place.rain(i) = 0 if the chain says dry; otherwise one draw from Gamma(α, β) (Haan 1977 is WGEN's cited generator).

### E6. Reference evapotranspiration: two forms

Hargreaves-Samani (temperature only, 1985):
ET0 = 0.408 · 0.0023 · (Tmean + 17.8) · (Tmax − Tmin)^0.5 · Ra   [mm/d; Ra in MJ m^-2 d^-1]  (UC Davis Eq. 23; 0.408 = 1/λ)

FAO-56 / ASCE Penman-Monteith, short grass (UC Davis Eqs. 24-26):
ET0 = Rn_term + A_term
Rn_term = 0.408 · Δ · (Rn − G) / ( Δ + γ·(1 + 0.34·u2) )
A_term = γ · (900/(Tmean + 273)) · u2 · (es − ea) / ( Δ + γ·(1 + 0.34·u2) )   [mm/d]
Δ = 4099 · e°(Tmean) / (Tmean + 237.3)^2   [kPa/degC] (Eq. 20)
γ = 0.00163 · P / λ with λ = 2.45 MJ/kg, i.e. 0.665e-3 · P   [kPa/degC] (FAO-56 Eq. 8)
P = 101.3 · ((293 − 0.0065 z)/293)^5.26   [kPa; z in m] (FAO-56 Eq. 7)
G ≈ 0 for a daily step.
Inputs: Tmax, Tmin, ea, Rn, u2, z. The FAO-56 minimum is Tmax, Tmin, ea, Rn, u2. Wind at height z_w is brought to 2 m by u2 = uz · 4.87/ln(67.8 z_w − 5.42), with u2 floored at 0.5 m/s.

Recommendation for the simplest daily step: Hargreaves-Samani, because it needs only Tmax, Tmin and latitude (for Ra). It is the only form here that the climate inputs already planned can drive. Penman-Monteith needs wind, humidity and net radiation as well. Hargreaves-Samani was recommended for general use in a 1994 ASCE review and tracks Penman-Monteith under many conditions (UC Davis, search summaries); no tropical-island accuracy figure was found.

### E7. Extraterrestrial and net radiation (needed by both ET0 forms; shared with CG-1, `place.par`)

dr = 1 + 0.033·cos(2π i/365);  δ = 0.409·sin(2π i/365 − 1.39);  ωs = arccos(−tan φ · tan δ)
Ra = (24·60/π) · Gsc · dr · [ ωs·sin φ·sin δ + cos φ·cos δ·sin ωs ]   [MJ m^-2 d^-1], Gsc = 0.082 MJ m^-2 min^-1   (UC Davis Eqs. 1-4; FAO-56 Eqs. 21-25)
Hargreaves radiation estimate: Rs = 0.16 · (Tmax − Tmin)^0.5 · Ra   (FAO-56 Eq. 50)
Rso = (0.75 + 2e-5·z) · Ra;  Rns = (1 − α)·Rs with albedo α = 0.23 (Rns = 0.77 Rs, FAO-56 Eq. 38);
Rnl = σ · [ (Tmax,K^4 + Tmin,K^4)/2 ] · (0.34 − 0.14·√ea) · (1.35·Rs/Rso − 0.35),  σ = 4.90e-9 MJ m^-2 d^-1 K^-4;  Rn = Rns − Rnl   (UC Davis Eqs. 5-14; FAO-56 Eqs. 37-40)
The latitude φ appears in Ra. No registry quantity carries latitude, so a place's latitude is an input that nobody supplies yet.

### E8. Root-zone bucket (FAO-56 chapter 8, depletion form)

Capacity: TAW = 1000 · (θFC − θWP) · Zr   [mm; θ in m^3/m^3; Zr in m]  (Eq. 82)
Readily available: RAW = p · TAW   (Eq. 83); p adjusted for evaporative demand p = p_table + 0.04·(5 − ETc), ETc in mm/d, limited to 0.1-0.8.
Daily balance on the depletion Dr (mm below field capacity):
Dr,i = Dr,i−1 − (P_i − RO_i) − I_i − CR_i + ETc,i + DP_i   (Eq. 85), with 0 ≤ Dr ≤ TAW (Eq. 86)
Deep percolation after wetting: DP_i = (P_i − RO_i) + I_i − ETc,i − Dr,i−1, taken only when ≥ 0 (Eq. 88). So all water above field capacity drains in the same day; the bucket never holds more than field capacity.
Stress: Ks = 1 for Dr ≤ RAW; Ks = (TAW − Dr)/((1 − p)·TAW) = (TAW − Dr)/(TAW − RAW) for Dr > RAW, 0 at Dr = TAW. The text of Eq. 84 is an image the fetch tool could not read; the algebraic form is confirmed by Rallo et al. (2014), who apply FAO-56. Adjusted crop ET: ETc,adj = Ks · Kc · ET0 (Eq. 81) or (Ks·Kcb + Ke)·ET0 (Eq. 80).
Water content seen by Life: θ = θFC − Dr/(1000·Zr)  (inverse of Eq. 87); this is `world.soil_water`.

Conservation form (PLATFORM section 7a: one transfer per flow, Δsource = −q, Δdestination = +q, losses separate). For a soil cell of area A (m^2) with stock S_soil (kg water), rain on the cell R = P·A kg:
- infiltration q_inf = (P − RO)·A (atmosphere or rain account → soil)
- runoff q_ro = RO·A (rain → surface-water or `world.drainage` network; never enters the soil)
- evapotranspiration q_et = ETc,adj·A (soil → atmosphere; a loss, not a transfer to another store in the model)
- deep percolation q_dp = DP·A (soil → `world.groundwater`)
- upward flux CR·A (groundwater → soil) when modelled (FAO-56's CR; optional)
ΔS_soil = q_inf + q_cr − q_et − q_dp. Nothing is created or destroyed: P·A = q_inf + q_ro. Each of the four flows is one transfer with its own source and destination; the sums of each pair cancel. `world.soil_water` is the derived view S_soil/(ρw·A·Zr) in m^3/m^3.

### E9. Runoff

Runoff RO is a term of Eq. 85 and FAO-56 leaves its estimation to the user. The standard daily choice is the NRCS curve-number method: Q = (P − Ia)^2/(P − Ia + S) for P > Ia, else 0, with Ia = 0.2·S (so Q = (P − 0.2S)^2/(P + 0.8S)), S = 25400/CN − 254 [mm] (CN = 1000/(10+S) in inches; metric form is the unit conversion). NRCS drafts proposed Ia = 0.05·S in 2017; whether adopted was not confirmed. A simpler fallback is RO = 0 (all rain infiltrates and the excess leaves as deep percolation). CN values by soil group and cover come from NEH 630 chapter 10 tables, which were not retrieved (null).

### E10. Pedotransfer for θFC and θWP from texture and organic matter (Saxton and Rawls 2006, as coded in the USDA WEPP routine)

S = sand fraction, C = clay fraction (0-1), OM = organic matter (percent; the code does not state units, the paper's convention is assumed).
θ1500t = −0.024 S + 0.487 C + 0.006 OM + 0.005 S·OM − 0.013 C·OM + 0.068 S·C + 0.031;  θWP = θ1500t + 0.14·θ1500t − 0.02
θ33t = −0.251 S + 0.195 C + 0.011 OM + 0.006 S·OM − 0.027 C·OM + 0.452 S·C + 0.299;  θFC = θ33t + 1.283·θ33t^2 − 0.374·θ33t − 0.015
Field capacity is the 33 kPa content; wilting point the 1500 kPa content. The same routine gives saturation θS and saturated conductivity, which a single-bucket model does not need. A Zambian evaluation found this method better for field capacity than for wilting point.

## Parameters

| Constant | Value | Unit | Source | Range / note |
|---|---|---|---|---|
| Tetens a, b, c | 0.6108, 17.27, 237.3 | kPa, -, degC | FAO-56 Eq. 11; Murray 1967 (17.2693882, 35.86 K) | within 1 Pa to 35 degC; over ice a different pair |
| λ (latent heat) | 2.45 | MJ/kg | FAO-56 | fixed |
| γ coefficient | 0.665e-3 · P | kPa/degC | FAO-56 Eq. 8 | cp = 1.013e-3 MJ kg^-1 degC^-1, ε = 0.622 |
| Pressure from elevation | 101.3·((293−0.0065 z)/293)^5.26 | kPa | FAO-56 Eq. 7 | z in m |
| Hargreaves-Samani | 0.0023, 17.8, exponent 0.5 | - | Hargreaves and Samani 1985 via UC Davis | 0.408 converts MJ to mm |
| Hargreaves Rs coefficient | 0.16 | - | FAO-56 Eq. 50 (worked example) | the coastal value (0.19) was not confirmed from a fetched page: null |
| Gsc | 0.082 | MJ m^-2 min^-1 | FAO-56, UC Davis | fixed |
| σ | 4.90e-9 | MJ m^-2 d^-1 K^-4 | UC Davis | fixed |
| Albedo (grass) | 0.23 | - | FAO-56 Eq. 38 (Rns = 0.77 Rs) | reference surface |
| Rso | (0.75 + 2e-5 z)·Ra | MJ m^-2 d^-1 | FAO-56 Eq. 37 | clear sky |
| Penman-Monteith resistances | rs = 70, ra = 208/u2 | s/m | FAO-56 Box 6 | reference grass |
| Wind floor | u2 ≥ 0.5 | m/s | FAO-56 | |
| Wind height factor | 4.87/ln(67.8 zw − 5.42) | - | FAO-56 Eq. 47 | about 0.75 at 10 m |
| Wet-day threshold | 0.01 in = 0.254 mm | mm | ARS-8 | must match the normals |
| P(W/W), P(W/D) per month | Miami, FL: P(W/W) 0.328 0.364 0.286 0.345 0.597 0.631 0.624 0.599 0.697 0.650 0.359 0.360; P(W/D) 0.182 0.173 0.174 0.160 0.196 0.413 0.382 0.422 0.401 0.319 0.196 0.142 (Jan-Dec) | - | ARS-8 table A1 | climate dependent; the only subtropical-humid station read. Tampa also given there. Caribbean values: null (no source with Caribbean transition probabilities was found) |
| Persistence r = P(W/W) − P(W/D) | Miami 0.112 (Mar) to 0.401 (May); wet season Jun-Oct 0.177-0.331 | - | derived here from ARS-8 Miami row | climate dependent; Tampa Jul-Aug 0.109-0.166 |
| Gamma shape α | Miami 0.549-0.707 (Jan-Dec: 0.622 0.634 0.662 0.611 0.601 0.679 0.707 0.635 0.631 0.549 0.549 0.562) | - | ARS-8 table A1 | below 1 everywhere; Tampa 0.578-0.719 |
| Gamma scale β | Miami 0.513-1.091 (Jan-Dec: 0.553 0.577 0.513 0.735 1.091 0.914 0.559 0.657 0.799 1.027 0.680 0.533) | inch (inferred) | ARS-8 table A1 | the extracted text does not state units; inches fit the 0.01 in threshold and give a plausible mean wet-day amount of about 9 mm for Miami in January (α·β·25.4) |
| Curve number CN | null | - | NEH 630 ch. 10 tables not retrieved | depends on soil group, cover, moisture |
| Initial abstraction ratio | 0.2 (standard); 0.05 (2017 draft) | - | NEH 630 ch. 10; Freese summary | |
| θFC, θWP (examples) | loamy sand 0.15 / 0.06; silt 0.32 / 0.15; silty clay 0.35 / 0.23; other examples 0.32 / 0.12 and 0.23 / 0.10 | m^3/m^3 | FAO-56 chapter 8, examples 36-38 | soil dependent; Table 19 values were not on the fetched page |
| Tropical soil available water | top 30 cm: Bayamon 3.6 cm, Humatas 5.0, Torres 5.5, Catalina 6.0 | cm | Puerto Rico J. Agric. Univ. (search summary; the page returned 403 and was not opened, so which soils are Oxisols or Ultisols and the tensions used are unconfirmed) | equals 0.12-0.20 m^3/m^3 of available water if read over 0.3 m (derived here) |
| Catalina clay (Oxisol) vs Cialitos clay (Ultisol) | available water about 13.6-13.7 % | % (basis not confirmed) | second Puerto Rico paper (search summary) | |
| Depletion fraction p (ET about 5 mm/d) | banana 0.35; cacao 0.30; coffee 0.40; sugar cane 0.65; rubber 0.40; pineapple 0.50; palm trees 0.65; cassava 0.35-0.40; sweet potato 0.65; maize 0.55; rice 0.20 (of saturation); grazing pasture 0.60; citrus 0.50; avocado 0.70 | - | FAO-56 Table 22 | crop and demand dependent |
| Max effective root depth Zr | banana 0.5-0.9; cacao 0.7-1.0; coffee 0.9-1.5; sugar cane 1.2-2.0; rubber 1.0-1.5; pineapple 0.3-0.6; maize 1.0-1.7; grazing pasture 0.5-1.5 | m | FAO-56 Table 22 | larger value for soils without restricting layers; modelling or rainfed uses the larger |
| p adjustment | p + 0.04·(5 − ETc), clamp 0.1-0.8 | - | FAO-56 chapter 8 | 10-25 % lower in hot dry weather |
| Kc (single/dual) for a cover | null | - | FAO-56 chapters 6-7 tables not retrieved here (Kc ini spans about 0.1-1.15 with wetting frequency) | owned by Life per crop |
| Daily T, wet-day temperature offsets, Fourier coefficients for WGEN | null | - | ARS-8 Tables 1-5 not read | |

## Inputs and owners

| Equation | Reads | Written today by |
|---|---|---|
| E4-E5 rain | monthly rain total, wet-day count, persistence, shape α (per place) | nothing: no place climate-normal quantity exists. Per-place normals are data a place carries; the registry has none |
| E1-E3 VPD | Tmax, Tmin (or Tmean), RH or Tdew, per place per day | nothing at place scope. `air.rh` (fraction) and `air.room_t` are written by `realism.gas.room_box` for a room, not a place |
| E6-E7 ET0 | Tmax, Tmin, ea, latitude, day of year, elevation; for Penman-Monteith also wind and net radiation | `world.elevation` (planned, `realism.terrain.geomorphology`); `air.wind` (m/s, air scope); `air.pressure` (Pa, `realism.atmos.barometric_pressure`). Latitude, Tmax/Tmin, Rs: nothing |
| E8 bucket | P, RO, ET0, θFC, θWP, Zr, p, Kc | θFC, θWP, texture, organic matter: `world.soil` record (planned, `realism.terrain.soils`). Zr, p, Kc: Life (per plant). Rain: E4-E5 (proposed) |
| E9 runoff | P, CN, slope | CN from soil group and cover: nothing. Slope: terrain (planned) |
| Transfers out | DP to `world.groundwater` (m3); RO to `world.drainage` | `realism.terrain.hydrology` (planned) writes both |

Hand-off to hydrology: the soil bucket does not write `world.groundwater` or `world.drainage` itself. Each day it posts two transfers per cell: DP·A/1000 m3 from the soil store to groundwater, and RO·A/1000 m3 from the rain account to the drainage network, each as one transfer with Δsource = −q and Δdestination = +q. Hydrology owns the groundwater and drainage stocks and applies the transfers; units convert at the boundary (mm over A m^2 to m3, as `world.groundwater` is in m3). ET leaves as a loss and the soil store is the source. Transpiration is drawn by Life's plants as uptake from the same bucket (CHAINS: "Life writes uptake"), so Life's uptake and the bucket's ET are the same flow, posted once; this is the CG-20-style duplicate risk to avoid.

## Registry

Proposals for the registry keeper (no edit made here).

| id | unit | scope | proposed writer | note |
|---|---|---|---|---|
| `place.rain` | mm/d | place | `realism.atmos.rain_generator` (new) | existing id, writer null; set the writer |
| `place.vpd` | kPa | place | `realism.atmos.vapour_pressure` (new) | existing id; the writer needs place air temperature and humidity |
| `world.soil_water` | m^3/m^3 | world (per soil cell) | `realism.terrain.soils` (stock owner) or a new `realism.terrain.soil_water_balance` | existing id; derived view of the cell's water kg; the keeper decides which engine owns the stock |
| `place.air_t_max`, `place.air_t_min` | degC | place | `realism.atmos.climate_normals` (new) | new; daily max and min air temperature |
| `place.dewpoint` (or `place.rh_mean`) | degC (or 1) | place | same | new; `air.rh` is room scale and cannot be reused |
| `place.srad` | MJ m^-2 d^-1 | place | same, shared with CG-1 (`place.par`) | new; Rs, from the Hargreaves form or a measured normal |
| `place.latitude` | deg | place | `realism.terrain.provinces` or place data | new; Ra needs it |
| `place.et0` | mm/d | place | `realism.atmos.reference_et` (new) | new; reference ET |
| `world.soil_field_capacity`, `world.soil_wilting_point` | m^3/m^3 | world (per soil cell) | `realism.terrain.soils` | new, or fields in the `world.soil` record (it already lists moisture and porosity) |
| `world.root_zone_depth` | m | world or plant | Life (per plant) | new if the bucket is Reality's; Zr belongs to the plant |
| flow quantities | mm/d or kg per step | world | the bucket engine | infiltration, runoff, evapotranspiration, deep percolation as transfers or loss accounts (`loss:evaporation` style, section 7a) |

Units to confirm: `world.groundwater` says "groundwater stored per area" but is m3; the description and unit disagree (per area would be m, or m3/m2). `world.drainage` is a record with unit null, so a runoff transfer into it needs a defined quantity.

## Validation

- WGEN generated-versus-observed tables for Miami and Tampa, FL (ARS-8 Tables 9 and 11 list generated and observed monthly means for a subtropical-humid station); the same report holds the 139-station parameter table A1.
- FAO-56 worked examples: Ra = 41.09 MJ m^-2 d^-1 at 50.80 degN, day 187; dr = 1.0001 and δ = −0.0753 for the 1 October example at 16.22 degN; Hargreaves example ETo = 5.0 mm/d (inputs not retrieved); TAW and RAW table for loamy sand, silt and silty clay (maize 1.2 m, p 0.55: 108/59, 204/112, 144/79 mm).
- International Soil Moisture Network (Dorigo et al. 2021): in situ soil moisture, 71 networks and 2842 stations, CC BY, free portal. Compare the bucket's θ to station θ after scaling to the same depth; stations in humid tropics were not checked.
- CHIRPS daily rainfall (0.05 degree, 1981 to present) and NASA POWER daily meteorology (from 1984, free): independent rain and temperature series for monthly totals, wet-day counts and the Markov statistics.
- A Markov-gamma generator was already tested at San Juan, Puerto Rico (a published test of the same model class), and a single-site generator has been applied from Belize to Barbados (Caribbean Weather Generator, Newcastle/UEA): papers to compare against, parameters not retrieved.
- HESS 2022 (Benoit et al.) on stochastic rain on tropical islands with orography: a benchmark for the limits of a single-site Markov-gamma model.

## Sources

- https://www.fao.org/4/X0490E/x0490e07.htm  FAO-56 chapter 3: Eqs. 7, 8, 11, 12, 14, 17-19, 47; VPD = es − ea.
- https://www.fao.org/4/X0490E/x0490e06.htm  FAO-56 chapter 2: variable list and units of the Penman-Monteith equation, ra = 208/u2, rs = 70.
- https://www.fao.org/4/X0490E/x0490e08.htm  FAO-56 chapter 3 radiation: Ra, Rso, Rns, Rnl, Rs = 0.16 sqrt(Tmax − Tmin) Ra, worked examples.
- http://www.fao.org/4/x0490e/x0490e0e.htm  FAO-56 chapter 8: TAW, RAW, p, Eqs. 80-88, Table 22, examples 36-38.
- https://support.goldsim.com/hc/en-us/article_attachments/115026531468  Richardson and Wright 1984, WGEN (ARS-8): Markov chain-gamma model, gamma density, wet-day threshold, parameter table A1 (Miami, Tampa).
- https://biomet.ucdavis.edu/doc/PMdayDoc.pdf  Snyder and Eching, UC Davis, ASCE-EWRI daily equations: Ra, Rn, Tetens, slope Δ, γ, Hargreaves-Samani, Penman-Monteith in code order.
- https://infosys.ars.usda.gov/svn/code/weps1/branches/weps.src.wepp/src/lib_wepp/saxpar.for  Saxton and Rawls 2006 coefficients for θ1500, θ33.
- https://en.wikipedia.org/wiki/Tetens_equation  Tetens form accuracy to 35 degC (Monteith and Unsworth).
- https://www.rand.org/pubs/papers/P3423.html  Murray 1967, Tetens versus Goff-Gratch.
- https://iris.unipa.it/retrieve/e3ad8916-c841-da0e-e053-3705fe0a2b96/Rallo%202014%20JIDE-FAO56%20SWD%20Olive.pdf  Ks = (TAW − Dr)/(TAW − RAW) under FAO-56.
- https://mail.irrigationtoolbox.com/NEH/Part630_Hydrology/H_210_630_10.pdf  NRCS NEH Part 630 chapter 10, curve-number runoff.
- https://eesc3600.commons.gc.cuny.edu/wp-content/blogs.dir/28471/files/2023/07/nrcs_cn_method.pdf  Q = (P − 0.2S)^2/(P + 0.8S) and CN = 1000/(10 + S).
- https://www.freese.com/blog/upcoming-changes-to-the-nrcs-curve-number-method/  the proposed Ia/S = 0.05.
- https://gmd.copernicus.org/preprints/gmd-2017-42/gmd-2017-42-AR1.pdf  Geng et al. 1986 relations (transition probabilities to wet fraction, gamma scale to mean wet-day amount).
- https://crudata.uea.ac.uk/cru/pubs/thesis/2007-mcsweeney/4.Gamma.pdf  Thom approximation for the gamma shape of daily rain.
- https://sites.bsyse.wsu.edu/ClimGen/documentation/description.htm  ClimGen: a generator that computes monthly Markov parameters per site.
- https://revistas.upr.edu/index.php/jaupr/article/view/7090  Markov-gamma test at San Juan, Puerto Rico (abstract).
- https://revistas.upr.edu/index.php/jaupr/article/download/10531/8858/10117  and https://revistas.upr.edu/index.php/jaupr/article/download/11166/9435/10744  Puerto Rico Oxisol and Ultisol available water (search summary; which URL carries which figure is unconfirmed, the first returned 403).
- https://ueaeprints.uea.ac.uk/id/eprint/57768/1/cariwig_wg_2015_revised_untracked.pdf  Caribbean single-site weather generator, Belize to Barbados.
- https://hess.copernicus.org/articles/26/2113/2022/hess-26-2113-2022.html  stochastic daily rain on tropical islands.
- https://hess.copernicus.org/preprints/hess-2021-2/hess-2021-2.pdf  Dorigo et al. 2021, International Soil Moisture Network (https://ismn.earth/en/).
- https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHC_CHIRPS_V3_DAILY_SAT  CHIRPS daily rainfall.
- https://dagshub.com/datasets/nasa-prediction-of-worldwide-energy-resources-power/  NASA POWER daily data description.

- (3003) report: confidence medium-high on the equations (FAO-56, ASCE and WGEN are standard and were read from text or code, with two caveats: FAO-56 Eq. 84 and Eq. 13 are images, taken from Rallo 2014 and UC Davis Eq. 20), low on tropical parameters (no Caribbean transition probabilities, gamma shapes, curve numbers or Kc found; Puerto Rico soil values come from a search summary of a page that returned 403). Open choices for the keeper: (1) Hargreaves-Samani or Penman-Monteith for ET0 (recommend Hargreaves-Samani for the first implementation); (2) who owns the soil water stock (`realism.terrain.soils` or a new engine) and whether Life's uptake and bucket ET are one posted flow; (3) whether runoff uses curve number or zero; (4) daily-mean or daytime VPD; (5) where place climate normals, latitude and Tmax/Tmin live, since the registry has none; (6) the `world.groundwater` unit mismatch and the `world.drainage` record. The implementation unit will need: a per-place monthly normals table (rain total, wet-day count, Tmax, Tmin, dew point or RH, wind if Penman-Monteith), a persistence r and gamma shape α per climate (or fetch ARS-8 Tables 1-5 and Geng 1986), soil θFC and θWP from the `world.soil` record or E10, a seeded random stream per place, the PLATFORM 7a transfer verbs for the four flows, and a check that P·A = q_inf + q_ro and ΔS equals the flows each step.
