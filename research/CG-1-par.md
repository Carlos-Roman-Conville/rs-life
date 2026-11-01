# CG-1: photosynthetically active radiation at the place

Research unit 3002, 2026-11-01. Research only; no code, data or registry change. Every constant below carries its source or is `null` with the reason.
"Read" in the source list means the page was opened and the figure taken from it; "search summary" means the figure came only from a search-result summary and the page itself was not opened (access denied, a PDF dump, or not fetched). Values from the second group should be re-checked by the keeper before they become parameters.

## Question

`place.par` (photosynthetically active radiation at the place, **mol/m^2/d**, scope `place`) is registered as planned (LIFE-2, Life keeper 2026-10-31) with **writer `null`**. Life's plants read it; Reality is to write it (phases 8, 13, 16) and register the writer with its design. Nothing computes it today. Related registered quantities, read from `../registry/quantities.json`:

| id | unit | scope | writer | note |
|---|---|---|---|---|
| `place.par` | mol/m^2/d | place | none | the gap |
| `place.is_day` | 1 (bool) | place | `realism.env.daylight` | built; the host's month row gives only day or night |
| `place.sun_exposure` | 1 (0-1) | place | `realism.env.exposure_by_terrain` | seed; description is just "sun_exposure" |
| `place.sunburn_fraction` | 1 | place | `realism.env.daylight` | seed |
| `place.rain` | mm/d | place | none (planned) | sibling LIFE-2 input |
| `world.elevation`, `world.base_elevation` | m | world | `realism.terrain.geomorphology`, `realism.terrain.provinces` | usable as station height z |
| `plugin.sun_hours`, `plugin.season` | unknown | plugin | none stated | units "the owner must state it" |

My greps found no registered quantity for latitude, day of year, cloud cover, sunshine duration, slope or aspect at place or world scope (only `world.slope_failure`, a record). The chain row (CHAINS.md 1.1) says the same: `realism.optics.light_visibility` (planned) has the sun path but no PAR, and `realism.env.daylight` gives only `is_day`. The question is how to compute **daily PAR at a place** from latitude, day of year, cloudiness or sunshine hours, elevation and terrain shading, using a chain simple enough to run once per place per day: extraterrestrial radiation, a transmission model, the PAR share of shortwave, and the conversion from energy to moles of photons.

## Equations

Daily chain: `Ra` (top of atmosphere) → `Rs` (shortwave at the ground) → `Qp` (PAR energy) → `place.par` (moles). Symbols: φ latitude (rad), J day of year (1-365/366), δ declination (rad), ωs sunset hour angle (rad), N possible sunshine hours (h), n actual sunshine hours (h).

**E1. Sun geometry** (FAO-56 ch. 3, eq. 23, 24, 25, 34; Allen et al. 1998)
- dr = 1 + 0.033 cos(2πJ/365) (dimensionless; Earth-Sun distance factor)
- δ = 0.409 sin(2πJ/365 − 1.39) (rad)
- ωs = arccos(−tan φ · tan δ) (rad); N = (24/π) ωs (h)
- Valid: the FAO page limits the Ra equations for winter months poleward of 55°. For polar day or night the arccos argument leaves [−1, 1]; FAO's alternative form sets X = 1 − tan²φ tan²δ to 0.00001 if X ≤ 0. Not an issue at Caribbean latitudes.
- Note: the FAO page rendered these as images; the extraction reconstructed them from the worked examples, so the keeper should verify against the PDF.

**E2. Extraterrestrial radiation, daily** (FAO-56 eq. 21)
Ra = (24·60/π) · Gsc · dr · [ωs sin φ sin δ + cos φ cos δ sin ωs], Ra in MJ/m^2/d, Gsc = 0.0820 MJ/m^2/min. FAO Table 2.6 lists Ra for the 15th of each month and latitude, usable as a test table.

**E3. Shortwave at the ground from sunshine duration, Ångström-Prescott** (FAO-56 eq. 35)
Rs = (as + bs · n/N) · Ra, Rs in MJ/m^2/d. n/N is the relative sunshine duration (0-1). `as` is the fraction of Ra reaching the ground on a fully overcast day; `as + bs` on a clear day. FAO defaults as = 0.25, bs = 0.50 where there is no calibration. This is the simplest form that needs one input (sunshine fraction) per place per day.

**E4. Clear-sky cap and clearness index** (FAO-56 eq. 36, 37)
Rso = (0.75 + 2×10⁻⁵ z) · Ra, with z the station elevation in m (or Rso = (as + bs) Ra near sea level or with calibrated as, bs). Limit Rs ≤ Rso. Clearness index Kt = Rs/Ra (used for the diffuse split in E9).

**E5. Alternative input: air-temperature range, Hargreaves type** (FAO-56 eq. 50)
Rs = kRs · √(Tmax − Tmin) · Ra, kRs in °C^-0.5. FAO states this is **not appropriate for island locations** (land 20 km wide or less) and that daily estimates are unreliable (sum or average over a week or longer). That caveat matters for a Caribbean setting, so E3 (sunshine) or E6 (cloud) should be the primary route and E5 only a fallback where the host has temperature but no sunshine.

**E6. Alternative input: cloud cover instead of sunshine hours** (form only)
Kasten and Czeplak (1980) give global radiation under cloud as clear-sky radiation times a factor falling with cloud cover in octas N_c (the search summary showed a coefficient 0.75 and a term N_c/8, but the exponent was not legible). **Coefficients not entered (null): neither the 0.75 nor the exponent was confirmed from a source this session.** No source was found that converts cloud cover to n/N directly, so using n/N ≈ 1 − cloud fraction would be an unsourced rule. Open choice for the keeper (see report).

**E7. PAR share of shortwave** (empirical; Brasília/Petrolina, review, Cyprus)
Qp = fPAR · Rs, both in MJ/m^2/d, Qp being the energy of the 400-700 nm band. fPAR is about 0.44 to 0.50 at the two Brazilian tropical stations and 0.41-0.52 across 400-700 nm studies. fPAR is *higher under cloud*: Brasília daily values are 0.47 for Kt < 0.35, 0.45 for 0.35 ≤ Kt ≤ 0.65 and 0.43 for Kt > 0.65 (Petrolina 0.52, 0.50, 0.49). A constant fPAR is the simplest form; a step table on Kt (E4) is the next. Valid: daily scale, all-sky.

**E8. Energy to photons, and the daily total**
place.par [mol/m^2/d] = cq · Qp [MJ/m^2/d], where cq = 4.57 µmol per J of PAR, numerically 4.57 mol per MJ. McCree (1972) gives 4.57 for sunlight; Dye (2004) finds the daily global-PAR ratio fairly insensitive to scattering and suggests 4.56 for a wide range of conditions. Combined with E7:

place.par = cq · fPAR · Rs = k · Rs, where k = cq·fPAR is about 2.0 to 2.3 mol per MJ of shortwave.

Worked sizes (arithmetic from the parameters, not a source): Rs = 20 MJ/m^2/d with fPAR 0.45 and cq 4.57 gives place.par ≈ 41 mol/m^2/d; the Petrolina fit (2.31 µmol/s per W/m^2) and Brasília (2.05) bracket this.

Mean photon flux density over the daylight hours, if a plant model wants an instantaneous rate: PPFD_mean [µmol/m^2/s] = place.par·10⁶ / (N·3600). The PnET page uses the same rule (daily MJ times 2.0513 µmol/MJ, divided by seconds of daylight).

**E9. Terrain: slope, aspect, shading** (geometry sourced; the daily partition is open)
- Incidence on a plane with tilt s and azimuth γ: cos θ = cos z · cos s + sin z · sin s · cos(γs − γ), z the solar zenith (pvlib `aoi_projection`, standard trigonometric form). Negative values mean the sun is behind the surface; set to zero.
- Isotropic-sky tilted-plane daily form (Klein 1977, via a Wisconsin report, equation OCR partly garbled): Ht/H = (1 − Hd/H) Rb + (Hd/H)(1 + cos s)/2 + ρ (1 − cos s)/2, with Rb the ratio of beam on the tilted plane to that on the horizontal, Hd/H the diffuse fraction, ρ the ground reflectance. Klein approximates Rb by the extraterrestrial ratio for the day.
- Horizon (terrain) shadowing of the beam: GRASS r.sun computes it from the elevation model or precomputed horizon rasters; fully shadowed cells give zero beam. This is the established method for cell-based terrain.
- Diffuse fraction Hd/H from Kt: the Erbs, Klein and Duffie (1982) correlation is the standard; **its coefficients were not verified from a source this session (null)**.
- Reflected-term ground reflectance ρ for PAR: **null**, no source was read for PAR albedo.
- Simplest option for a first implementation: compute `place.par` on the horizontal (E1-E8) and apply the existing `place.sun_exposure` (0-1) from terrain as a multiplier, only if the keeper confirms what that quantity means. Otherwise a separate beam/diffuse split is needed.
- Canopy shading (Beer-Lambert extinction) is the plant's own business in Life and is outside this gap.

**Conservation form (PLATFORM.md section 7a: one transfer per flow, Δsource = −q, Δdestination = +q, losses separate).**
Light is a flux, not a stock: nothing accumulates in the atmosphere or in the place at a daily step, so the accumulation term is zero. The budget for the day, per m^2, is a set of transfers out of the top-of-atmosphere flow Ra:
- q_toa_loss = Ra − Rs, leaves as reflected to space and absorbed or scattered in the atmosphere (E3 gives Rs, so the loss is the remainder; a loss, kept separate from the delivery);
- q_nonpar = (1 − fPAR) · Rs, shortwave at the ground outside 400-700 nm, a separate flow not delivered to `place.par`;
- q_par = Qp = fPAR · Rs, delivered to the place; place.par is this flow expressed in moles (E8).
Check: Ra = q_toa_loss + q_nonpar + q_par each day. Downstream, Life's plants take their intercepted share out of q_par as a transfer of their own; many plants at one place must not intercept more than `place.par` in total. That sum is Life's to enforce; this gap only has to deliver an honest total.

## Parameters

| name | value | unit | source | range across sources / dependence |
|---|---|---|---|---|
| Gsc, solar constant | 0.0820 | MJ/m^2/min (=1366.7 W/m^2, arithmetic) | FAO-56 | other values: null (no second source read) |
| dr amplitude | 0.033 | 1 | FAO-56 | fixed |
| declination amplitude, phase | 0.409, 1.39 | rad | FAO-56 | fixed |
| as (overcast fraction) | 0.25 default | 1 | FAO-56 | **climate-dependent**. Trinidad 5-year and dry-season fits 0.21; wet season 0.27; monthly 0.19-0.37 (search summary of De Souza and Andrews). Parnaíba, Brazil 0.3207 (search summary). |
| bs | 0.50 default | 1 | FAO-56 | **climate-dependent**. Trinidad 5-year and dry 0.38; wet 0.28; monthly 0.14-0.42. Parnaíba 0.4598. |
| as + bs (clear fraction) | 0.75 default | 1 | FAO-56 | Trinidad 5-year 0.59, wet 0.55 (arithmetic from the above) |
| Rso elevation term | 0.75 + 2×10⁻⁵ z | 1, z in m | FAO-56 | fixed by FAO |
| kRs (Hargreaves) | 0.16 interior, 0.19 coastal | °C^-0.5 | FAO-56 | not for islands ≤ 20 km wide |
| Kasten-Czeplak coefficient and exponent | null | none | form seen, values not legible in search results | confirm from Solar Energy 24:177-190 |
| fPAR (PAR/Rs, energy) | 0.44 Brasília (15.6°S, 1023 m); 0.50 Petrolina (9.1°S, 387 m) | 1 | scielo RBEAA study | review range 0.44-0.55; 400-700 nm studies 0.41-0.52; **depends on sky**: Brasília 0.47/0.45/0.43 and Petrolina 0.52/0.50/0.49 for Kt <0.35 / mid / >0.65 |
| fPAR, Botucatu (Brazil, search summary) | 0.407 (Feb) to 0.448 (Jul) | 1 | Escobedo et al. | rises toward cloudy skies |
| cq (photons per J of PAR) | 4.57 | µmol/J = mol/MJ | McCree 1972, cited by the Brasília study | 4.24 to 4.57 for instantaneous values depending on cloud (Kalogirou review, search summary) |
| cq daily | 4.56 | µmol/J | Dye 2004 (search summary) | "wide range of conditions" |
| k = mol PAR per MJ shortwave | 2.05 Brasília (instantaneous), 2.31 Petrolina | mol/MJ | scielo RBEAA | 2.0513 (PnET page); 2.3 (R bigleaf default, no reference given); Cyprus monthly 2.02-2.19, season mean 2.16, another Cyprus annual 2.03; Zambia mean 2.097, range 1.778-2.414 (all search summaries except PnET and bigleaf); lower in clear, dry or smoky skies |
| ground reflectance ρ for PAR | null | 1 | no source read | |
| Erbs diffuse-fraction coefficients | null | 1 | not verified | see E9 |

Tropical or Caribbean entries: the Trinidad as and bs (a Caribbean island), and the two Brazilian tropical stations for fPAR and k. No Puerto Rico, Jamaica or Cuba Ångström coefficients were found; the one Colombian Caribbean study found reported only correlations, not coefficients. The Caribbean value of fPAR itself is **null**: nothing measured on a Caribbean island turned up, so Brasília/Petrolina stand in, with the error range 0.44-0.50 carried as the uncertainty.

## Inputs and owners

| input | needed by | who writes it today | what it would give |
|---|---|---|---|
| latitude φ of the place | E1, E2 | nothing registered (host world row or terrain, to be proposed) | required, one number per place |
| day of year J | E1, E2 | the host calendar; `plugin.season` exists but its unit is unstated | `realism.env.daylight` reads the host's month row, so it has the date but publishes only `is_day`; J could come from the same row |
| sunshine fraction n/N or cloud cover | E3 or E6 | nothing (`plugin.sun_hours` has no stated unit) | the one weather input that scales the result; null+flag if absent |
| elevation z | E4 | `world.elevation`, `world.base_elevation` (terrain engines) | clear-sky cap only |
| Tmax, Tmin | E5 | no registered place-scope temperature row found in my greps | fallback route only |
| slope, aspect, horizon | E9 | nothing registered; `realism.terrain.*` owns elevation from which they derive; `realism.env.exposure_by_terrain` writes `place.sun_exposure` | shading and slope scaling |
| sun position through the day | hourly variants, E9 beam shadowing | `realism.optics.light_visibility` (planned, has the sun path) | would give hour-by-hour zenith and azimuth for a later hourly PAR and for beam shadowing; not needed for the daily step |
| is_day | not needed | `realism.env.daylight` | the daily sum has no use for a boolean; it only checks consistency (N > 0) |

Contribution summary: `daylight` today supplies the date but nothing continuous; `light_visibility` (once built) would supply the geometry, and its sun path could replace E1/E2 so there is one solar geometry in the toolchain (the keeper should avoid two copies). Neither supplies sunshine fraction, which is the missing input.

## Registry

Proposals for the registry keeper; the registry was not edited.

| id | unit | scope | proposed writer | note |
|---|---|---|---|---|
| `place.par` (exists) | mol/m^2/d | place | new `realism.env.solar_radiation` (or extend `realism.env.daylight`; keeper's call) | daily, after E1-E8 |
| `place.shortwave_down` | MJ/m^2/d | place | same | Rs; useful beside PAR for other users (evaporation, heat) and for validation against pyranometers |
| `place.extraterrestrial_radiation` | MJ/m^2/d | place | same | Ra; optional, an intermediate that tests can check against FAO Table 2.6 |
| `place.sunshine_fraction` | 1 | place | host weather plugin or a new weather engine | n/N, 0-1; reuses or replaces `plugin.sun_hours` |
| `place.latitude` or `world.latitude` | deg | place or world | host / terrain provinces | input |
| `place.slope`, `place.aspect` | deg | place | terrain | needed only if E9 beam geometry is adopted |
| `place.sun_exposure` (exists) | 1 | place | `realism.env.exposure_by_terrain` | confirm meaning; if it is a terrain shading factor, `place.par` can read it |
| `plugin.sun_hours` (exists, unit unknown) | needs a unit | plugin | owner | state h/d or replace with `place.sunshine_fraction` |

## Validation

Independent data that could test an implementation, apart from the sources of the constants:
- **FAO-56 Table 2.6**, Ra for the 15th of each month by latitude: exact check on E1-E2 (the page text says it exists; the table values were not extracted).
- **BSRN** radiation archive at PANGAEA, stations Petrolina (9.1°S) and Brasília: measured global shortwave downward; test E3 after fitting as and bs, and E7-E8 against measured PAR where the station reports it (the Brazilian SONDA stations measure PAR).
- **NASA POWER** `ALLSKY_SFC_PAR_TOT` (and clear-sky) from CERES SYN1deg: gridded satellite-derived PAR on a horizontal plane, listed in W/m^2 in the climatology metadata; usable at any Caribbean coordinate for a seasonal-cycle comparison. Methods and validation are described in Su et al. 2007 (not retrieved). The FAQ warns that units can differ between the API and direct Zarr access.
- **Trinidad daily radiation** (De Souza and Andrews 2015, the data behind their Ångström-Prescott fits), a Caribbean island test of E3 with as, bs fitted on one half and checked on the other.
- **Eddy-covariance towers with incoming PPFD**, if their files carry it: AmeriFlux PR-xGU (Guánica, Puerto Rico, 2018-2023), FLUXNET2015 PA-SPs and PA-SPn (Sardinilla, Panama). Whether the `PPFD_IN` column is present at these sites is not confirmed.
- Sanity bounds without data: daily PAR at tropical sea level should stay below E8 applied to Rso, and the clear-day Brasília-like value k·Rso should exceed the overcast value k·as·Ra.

## Sources

Read (opened this session):
- https://www.fao.org/4/x0490e/x0490e07.htm : FAO-56 chapter 3, equations 21, 23-25, 34-37, 50, Gsc, as and bs defaults, the island and winter-latitude caveats. Equation images did not render; reconstructed by the fetch tool from the page text and worked examples.
- https://www.scielo.br/j/rbeaa/a/ntL4pXrVcNMPWRZCjpFX8Bv/?lang=en : Brasília and Petrolina PAR/Rs, by Kt class, instantaneous slopes 2.05 and 2.31, McCree 4.57 used.
- https://www.redalyc.org/journal/565/56572301008/html/ : PAR modelling review; ratio range 0.44-0.55 and 1.69-1.96 mol/MJ; dependence on Kt.
- https://www.pnet.sr.unh.edu/subpages/radconvert.html : 2.0513 µmol per MJ of global radiation, divide by seconds of daylight.
- https://search.r-project.org/CRAN/refmans/bigleaf/html/Rg.to.PPFD.html : frac_PAR 0.5 times 4.6 = 2.3, no references given.
- https://grass.osgeo.org/grass-stable/manuals/r.sun.html : slope, aspect, horizon shadowing, Linke turbidity, daily Wh/m^2 output, references.
- https://pvlib-python.readthedocs.io/en/latest/reference/generated/pvlib.irradiance.aoi_projection.html : dot-product definition of cos θ.
- https://pvlib-python.readthedocs.io/en/latest/reference/generated/pvlib.irradiance.erbs.html : Erbs diffuse-fraction model and citation; no coefficients on the page.

Search summary only (page not opened, or opened and blocked):
- https://halshs.archives-ouvertes.fr/halshs-02062304 : De Souza and Andrews, Trinidad Ångström-Prescott fits (as/bs values above); the page itself was blocked.
- https://www.sta.uwi.edu/eng/wije/vol2201_jul1999/documents/abstract-SolarRadiationEstimation.pdf : Stone 1999, Trinidad sunshine models, Piarco.
- https://ktisis.cut.ac.cy/bitstream/20.500.14279/18099/1/smjbb-v2-1009.pdf : Cyprus PAR conversion ratios 2.02-2.19 mol/MJ, cloud dependence of cq (PDF came back unreadable).
- https://arg.ifa.md/paper/aculinin_photosynthetically.pdf and https://ibn.idsi.md/vizualizare_articol/3789 : Zambia (mean 2.097, range 1.778-2.414) and Moldova seasonal PAR ratios, as quoted by the search tool.
- https://www.mdpi.com/2072-4292/11/8/932 : cites Dye 2004 (JGR 109, doi 10.1029/2003JD004251) for 4.56 µmol/J on a daily scale.
- https://repositorio.unesp.br/items/aa4cb936-f3b7-40c4-a8ca-88b7adb7a4ba : Botucatu PAR, UV and NIR ratios to global radiation.
- https://jsw.um.ac.ir/article_38641_en.html : PAR/global ratio 0.430 clear to 0.489 overcast (Iran).
- https://proceedings.ises.org/conference/swc2025/papers/swc2025-0252-Goncalves.pdf : fixed PAR fractions of 42-52% and tropical cloud uncertainty.
- https://www.canr.msu.edu/floriculture/uploads/files/MakingSenseofLightSensors.pdf : PAR-only conversion ≈ 1.96 µmol/m^2/s per W/m^2 (about 43% of solar energy is PAR) and 1 µmol/m^2/s ≈ 0.22 W/m^2.
- https://link.springer.com/article/10.1007%2FBF00878616 and https://library.csbe-scgab.ca/docs/meetings/2017/CSBE17057.pdf : Kasten and Czeplak cloud-cover form; exponent illegible.
- https://modis.gsfc.nasa.gov/sci_team/pubs/abstract.php?id=04211 : Janjai and Wattan 2011, satellite PAR model for tropical Thailand, RMSE 9.8%, MBE 0.6%.
- https://bibsonomy.org/bibtex/1101503bf31521ca370a3614c1a2fa67f and https://www.sciencedirect.com/science/article/abs/pii/0038092X82903024 : Klein 1977 tilted-plane method and Erbs et al. 1982.
- https://power.larc.nasa.gov/docs/methodology/energy-fluxes/derived-parameters/ : NASA POWER total PAR definition (diffuse plus direct horizontal, CERES SYN1deg Ed 4.2, Su et al. 2007). A direct fetch of this URL failed once with HTTP 404; the definition is from the search summary of the same page.
- https://ameriflux.lbl.gov/sites/siteinfo/PR-xGU : Guánica Forest, Puerto Rico; BASE data 2018-2023.
- https://www.osti.gov/biblio/1440179 : FLUXNET2015 record for Sardinilla pasture, Panama.
- https://doi.pangaea.de/10.1594/PANGAEA.885831 : BSRN station-to-archive datasets for Petrolina.

## Open items not found
- Erbs daily diffuse-fraction coefficients and the Kasten-Czeplak exponent: not confirmed from a source, left null.
- A Caribbean island measurement of the PAR/shortwave ratio.
- Ångström-Prescott coefficients for Puerto Rico, Jamaica or Cuba.
- PAR ground reflectance and a sky-view-factor form for horizon-obstructed diffuse light.

- (3002) report: Confidence is high for E1-E4 and E7-E8 (FAO-56, one measured pair of tropical stations, and the McCree/Dye photon factor agree within about 10%), medium for the Caribbean values of as, bs (one island, Trinidad, from a search summary) and for fPAR (no Caribbean measurement), and low for E6 and E9 beyond plain geometry. Open choices for the keeper: (1) the sunshine input, since n/N has no registered carrier and no sourced conversion from cloud cover exists; (2) one constant fPAR ≈ 0.45 (or 0.44-0.50) against a step table on Kt, the data favour the step table but the effect is under about 10%; (3) whether `place.sun_exposure` is the terrain multiplier or whether a slope/aspect/horizon pair is registered; (4) one solar geometry shared with `light_visibility`; (5) where the daily-to-hourly line falls if plants later need rates. The implementation unit will need: latitude, date and a sunshine fraction per place; the registry rows above; the verified Erbs and Kasten-Czeplak coefficients only if E6 or E9 beam splitting is wanted; test values from FAO Table 2.6 and from the Brazilian or Trinidad data; and the as, bs fitted for the Caribbean setting.
