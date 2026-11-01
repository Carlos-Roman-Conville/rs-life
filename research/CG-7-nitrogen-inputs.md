# CG-7: nitrogen inputs to the soil (deposition, fixation, manure, residue)

Research unit 3004, 2026-11-01. Research only: no code, no registry edit. Constants come from the sources in `## Sources`; a value no source gave is `null` with the reason.

## Question

`Toolchain/CHAINS.md` row CG-7 says the soil nitrogen account has no inputs: atmospheric deposition, biological fixation and manure are not mass fluxes anywhere ("inputs: deposition, fixation, manure as mass | none (manure is only an index step in `eco.soil_fertility`) | none | missing (no equation)"). The registry already holds the stock and the outflow side: `world.soil_n` (kg, per soil cell, changes only by transfer, writer `realism.terrain.soils`, planned), `world.plant_uptake_n` (kg per step, writer `realism.plant.physiology`, planned), `world.mineralisation_flux_n` (kg/d, writer `realism.ecology.decomposition`, planned) and `world.nutrient_flux_n` (kg/d, writer `realism.terrain.nutrient_transport`, planned). The retired kg/a quantities `world.mineralisation_flux` and `world.nutrient_flux` were replaced by the per-cell kg/d ones under CG-9. The rain it needs is `place.rain` (mm/d, writer null) and the wetness is `world.soil_water` (m^3/m^3). The fertility index `eco.soil_fertility` is, since unit 3001, only a derived view of `world.soil_n`, `soil_p` and `soil_k`. No registry quantity exists for deposition, fixation, manure N or crop-residue N. This note finds the standard equations and tropical constants so each can become one conserving transfer (PLATFORM 7a: Δsource = −q, Δdestination = +q; losses separate). One finding shapes the design: only deposition and fixation are **new** N entering the system. Manure and crop residue are **internal** transfers from an animal or plant pool to the soil; they must be wired from the pools CG-3 and CG-6 own, not created.

## Equations

Notation: a cell has area `A` [m^2] (`areaM2` on the cell record); `A_ha = A/10000`. Daily step `dt = 1 d`. Every flux below is a mass per cell per day [kg N/d] after multiplying a per-hectare rate by `A_ha`. The system boundary is the cell's soil, its plants and its animals; the atmosphere (N2 and deposited N) is an outside account.

**E0. Soil N balance (conservation form, per cell).**

```
d(soil_n)/dt = F_dep + F_free + F_manure + F_litter + F_min
               - F_uptake - F_loss
```

- Enters from outside: `F_dep` (E1), `F_free` (E3).
- Enters from inside (a transfer, no new N): `F_manure` (E5, from the animal excreta account), `F_litter` (E6, plant litter and crop residue from the plant pools), `F_min` (= `world.mineralisation_flux_n`, from detritus).
- Leaves: `F_uptake` (= `world.plant_uptake_n`, to the plant), `F_loss` (= `world.nutrient_flux_n` leaching and runoff, and CG-8 gaseous loss, to `loss:<pathway>` accounts).
- Units: kg N/d. Source: this is the mass balance the CG-9 and CG-3 registry rows already state; the five input terms are the ones IPCC lists for managed soil (synthetic fertiliser F_SN, organic F_ON, grazing excreta F_PRP, residue F_CR) plus deposition and fixation (IPCC 2006 Vol 4 Ch 11, Eq 11.1 context).
- Symbiotic fixation (E2) is **not** a soil term: it goes from the atmosphere to the legume. It reaches the soil only later, inside `F_litter`.

**E1. Atmospheric deposition, wet plus dry.**

```
F_dep,wet = 0.01 * c_N * P * A_ha          [kg N/d]
F_dep,dry = (D_dry,a / 365) * A_ha         [kg N/d]
F_dep     = F_dep,wet + F_dep,dry
```

- `c_N`: volume-weighted N concentration of rain [mg N/L] (nitrate N + ammonium N, optionally dissolved organic N). `P`: rain `place.rain` [mm/d]. The factor is a unit conversion: 1 mm over 1 ha is 10 m^3 = 10 000 L, so `c_N` mg/L × 10 000 L = `0.01 c_N` kg (derived here, no source needed).
- Alternative that needs no concentration: scale the annual wet total by the day's share of annual rain, `F_dep,wet = D_wet,a * (P_d / P_a) * A_ha`, with `D_wet,a` [kg N/ha/a] and `P_a` [mm/a]. Use this form when only a site-annual wet deposition is known (the Puerto Rico value is annual).
- `D_dry,a`: dry deposition [kg N/ha/a] (gas and particle uptake at the surface). The literature computes it as a deposition velocity times air concentration; Vet et al. 2014 warn dry deposition is model-based, uncertain, and measured only for some N species in a few regions. No tropical or Caribbean dry value was found in the sources read, so `D_dry,a = null` (see Parameters).
- Valid range: wet deposition tracks rain, so it is zero on dry days; dry deposition continues. Sub-daily steps scale the dry term by `dt/365 d` and wet by the step's rain.
- Sources: Vet et al. 2014 (global wet and dry assessment, WMO GAW); Dentener et al. 2006 (23-model deposition, uncertainty a factor of 2 outside polluted regions); Cusack et al. 2009 (Puerto Rico wet value); NADP map PDFs.

**E2. Symbiotic fixation by legumes (to the plant, demand-driven).**

```
F_sym = Ndfa * U_N                          [kg N/d, atmosphere -> plant]
F_soilN_uptake = (1 - Ndfa) * U_N           [kg N/d, soil -> plant]
```

- `U_N`: the plant's N demand for the step [kg N/d] (what `world.plant_uptake_n` would be for a non-fixer). `Ndfa`: fraction of plant N derived from air [-], 0 to 1.
- This splits one demand into two transfers. The soil only loses `(1−Ndfa) U_N`, so a legume with high `Ndfa` does not drain `world.soil_n`.
- Down-regulation: fertiliser N and high soil mineral N lower Ndfa (a Nebraska dissertation reported Ndfa of 50% unfertilised against 32 and 38% fertilised in a high-yield soybean trial, from a search snippet; the form is `Ndfa = Ndfa_max * g(soil mineral N)` with `g` falling from 1 to a floor). The shape of `g` and its constants were not found in a source read: `null`. Until they are, use constant `Ndfa` per species (Parameters) and treat suppression as an open choice.
- Alternative when no plant N demand is modelled (whole-plant yield form): `F_sym = k_fix * dM_shoot`, with `dM_shoot` the shoot dry-matter growth [t/d] and `k_fix` [kg N per t shoot dry matter] counting nodulated roots too (Peoples et al. 2009, abstract: 30–40 kg N per t).
- Valid range: nodulating legumes only (crop and forage legumes, tropical legume trees). Non-legume crops, `Ndfa = 0` (non-legume lands with associative fixation are in E3).
- Sources: Peoples et al. 2009; Peoples et al. 2021; Herridge et al. 2008.

**E3. Free-living (asymbiotic) fixation.**

```
F_free = (B_free,a / 365) * m(θ) * s(N_min) * A_ha     [kg N/d, atmosphere -> soil]
```

- `B_free,a`: background free-living fixation, soil + litter + moss + canopy [kg N/ha/a]. `m(θ)`: moisture factor, rising with soil or litter wetness. `s(N_min)`: suppression by soil mineral N, falling from 1.
- Cusack et al. 2009 measured it in two Puerto Rico forests by acetylene reduction: sums of 120 ± 29 and 95 ± 15 µg N/m^2/h, annualised by the authors to 12.3 ± 2.7 and 8.4 ± 1.4 kg N/ha/a. They report moisture content positively correlated with soil and forest-floor rates, and N addition significantly suppressing fixation in soil and forest floor. So the **directions** of `m` and `s` are sourced; their functional forms and constants are not (`null`). The simplest runnable form is `m = s = 1` (constant rate), which reproduces the measured annual input.
- Unit conversion for an hourly areal rate: `kg N/ha/a = µg N/m^2/h × 8760 h/a × 1e-9 kg/µg × 1e4 m^2/ha = µg N/m^2/h × 0.0876`. The summed 120 µg N/m^2/h gives 10.5, below the paper's annualised 12.3; the paper annualises each compartment separately (reason not checked), so use the paper's annual figure, not this conversion.
- Sources: Cusack et al. 2009; Reed et al. 2011 (review: free-living fixation is near-ubiquitous and often underrated, no rates on the page read).

**E4. Excreta nitrogen (the manure input).**

Excretion per head, IPCC Tier 1, Eq 10.30:

```
Nex(T) = Nrate(T) * TAM(T) / 1000 * 365        [kg N/head/a]
Nex_d(T) = Nrate(T) * TAM(T) / 1000            [kg N/head/d]
```

- `Nrate`: kg N per 1000 kg animal mass per day (Table 10.19). `TAM`: typical animal mass [kg/head] (Tables 10A-4 to 10A-9).
- Tier 2, Eq 10.31: `Nex = N_intake * (1 − N_retention_frac) * 365`, `N_intake` [kg N/head/d], retention fraction dimensionless (default retention fractions in Table 10.20, not read here). This is the **conserving** form: excreted N = eaten N − N kept in the animal (growth, milk). It is the one to use when an animal N budget exists (CG-6).
- Grazing deposit, Eq 11.5: `F_PRP = Σ_T N(T) * Nex(T) * MS(T,PRP)`, `MS(T,PRP)` the fraction of excreted N dropped on pasture, range and paddock (dimensionless). Per cell and day: `F_manure = n_animals_in_cell * Nex_d * MS_PRP`.
- Conservation: the transfer is `animal excreta account → world.soil_n`, Δexcreta = −q, Δsoil_n = +q. Manure N is **not** new N; it is feed N routed through the animal. CG-6 owns the excreta quantity; this note supplies only the soil-side destination and the fallback excretion rate.
- Sources: IPCC 2006 Vol 4 Ch 10 (Eqs 10.30, 10.31) and Ch 11 (Eq 11.5).

**E5. Manure applied or collected (managed manure).**

Not a separate equation in the sources read beyond `F_AM = Σ N_MMS(T) * ...` (IPCC Ch 11, Eq 11.3, in the term F_ON). Without a managed-manure system in the game, treat all excreta as grazing deposit (E4). A managed-manure application is `null` (not read, and no system needs it yet).

**E6. Crop residue and litter N returned.**

IPCC Tier 1, Eq 11.6, simplified to one crop, one year, no burning:

```
AGDM = Crop/1000 * slope + intercept                    [Mg dm/ha]      (Table 11.2)
R_AG = AGDM * 1000 / Crop                               [kg dm/kg dm]
R_BG = R_BG-BIO * (AGDM*1000 + Crop) / Crop             [kg dm/kg dm]
F_CR = Crop * [ R_AG * N_AG * (1 - Frac_remove) + R_BG * N_BG ] * Frac_renew   [kg N/ha/yr]
```

- `Crop`: harvested dry-matter yield [kg dm/ha] (fresh yield × `DRY` if reported fresh, Eq 11.7). `N_AG`, `N_BG`: N content of above- and below-ground residue [kg N/kg dm]. `Frac_remove`: fraction of above-ground residue removed (feed, bedding, fuel), 0 if unknown. `Frac_renew`: 1 for annual crops, 1/X for pasture renewed every X years.
- The term includes the N of N-fixing crops, so it carries fixed N back to the soil. For a legume harvested for grain, much of the fixed N leaves with the protein-rich seed (Peoples et al. 2009), so the residue return is the part of crop N not harvested.
- Conservation: the transfer is `plant → world.soil_n` (litter), Δplant = −q, Δsoil_n = +q. Because the plant model (CG-3) already returns litter ("litter returns the same way", `world.plant_uptake_n` description), use E6 only for crops where the plant model lacks explicit stem, root and harvest pools; otherwise its litter flux is the input.
- Worked check (derived from the sourced table, not a second source): maize at `Crop` = 3000 kg dm/ha: `AGDM` = 3.0×1.03 + 0.61 = 3.70 Mg/ha; above-ground N = 3700×0.006 = 22.2 kg N/ha; below-ground dm = 0.22×(3700+3000) = 1474 kg/ha, ×0.007 = 10.3 kg N/ha; `F_CR` = 32.5 kg N/ha (no removal, annual).

**E7. Mass-flux summary for the new-N side (annual, per hectare).**

```
New N to ecosystem  = F_dep + F_free + F_sym          [kg N/ha/a]
Recycled N to soil  = F_manure + F_litter + F_min     [kg N/ha/a]
```

Only the first line can raise total (soil + plant + animal) N. A conservation test should check that total system N grows by exactly `F_dep + F_free + F_sym` minus `F_loss` per step.

## Parameters

| Constant | Symbol | Value | Unit | Source | Range across sources | Depends on |
|---|---|---|---|---|---|---|
| Wet N deposition, Luquillo Puerto Rico (2007 NADP) | `D_wet,a` | 3.6 | kg N/ha/a | Cusack et al. 2009, citing NADP/NTN | 2.2 (2019 NADP map, PR site) to 3.6 | climate, local sources; "more than doubled in the last decade" |
| Wet N deposition, NADP Puerto Rico site | `D_wet,a` | 2.4 (2018), 2.2 (2019) | kg N/ha/a | NADP maps (PDF text garbled, read from a search snippet) | 2.2–3.6 | year |
| Bulk inorganic N deposition, Rio de Janeiro State, Brazil (tropical comparison, not Caribbean) | `D_bulk,a` | 4.3–17 | kg N/ha/a | Embrapa PDF (search snippet only, paper not opened) | 4.3–17 | site, wet share dominant |
| Dry N deposition, tropical or Caribbean | `D_dry,a` | null | kg N/ha/a | no value found in sources read; Vet et al. 2014 say dry estimates are model-based and sparse | | |
| Dry-to-wet ratio | | null | - | not found | | |
| Rain N concentration | `c_N` | null | mg N/L | not read; could be derived from `D_wet,a / (0.01 P_a)` once an annual rain is given (Luquillo `P_a` not read) | | |
| Global deposition uncertainty | | factor 2 outside polluted regions, ±30% in them | - | Dentener et al. 2006 | | region |
| Critical-load reference for natural vegetation | | 1000 mg N/m^2/a = 10 kg N/ha/a | - | Dentener et al. 2006 | | |
| Free-living fixation, lower-elevation Puerto Rico forest (soil, forest floor, moss, epiphyll, lichen) | `B_free,a` | 12.3 ± 2.7 | kg N/ha/a | Cusack et al. 2009 | 8.4–12.3 | moisture, N status |
| Free-living fixation, upper-elevation Puerto Rico forest | `B_free,a` | 8.4 ± 1.4 | kg N/ha/a | Cusack et al. 2009 | | |
| Same, as areal rate | | 120 ± 29 and 95 ± 15 | µg N/m^2/h | Cusack et al. 2009 | | |
| Above-ground (canopy) fixation, tropical | | <1 (epiphylls) to 8 (lichens on branches and boles) | kg N/ha/a | Cusack et al. 2009 reviewing earlier work | <1–8 | substrate |
| Total BNF, tropical forest (12 field studies, mostly nodulated) | | 15–36 | kg N/ha/a | Cleveland et al. 1999, as quoted in Cusack et al. 2009 | 15–36 | symbiotic share large |
| Total BNF, temperate forest | | 7–27 | kg N/ha/a | Cleveland et al. 1999, as quoted | 7–27 | |
| Natural-ecosystem global total | | 195 (100–290) | Tg N/a | Cleveland et al. 1999 | 100–290 | |
| Savanna, grassland, shrubland per-biome rates | | null | kg N/ha/a | Cleveland et al. 1999 table not read | | |
| Moisture factor shape `m(θ)` | | null | - | only the direction is sourced (Cusack et al. 2009) | | |
| N suppression shape `s(N_min)` | | null | - | only the direction is sourced | | |
| Ndfa, top group of 14 grain legumes (pigeonpea, faba bean, lupin) | `Ndfa` | 0.74 ± 0.118 | fraction | Peoples et al. 2021, via search summary | three statistically separate groups; other two group means not read | species, soil N, drought |
| Ndfa, soybean | `Ndfa` | 0.50 (unfertilised, one trial); 0.32–0.38 (fertilised) | fraction | Nebraska dissertation via search snippet | | fertiliser, yield level |
| Ndfa, other legumes, tropical pasture legumes, legume trees | `Ndfa` | null | fraction | per-species table not read | | |
| Ndfa rises with aridity index and rainfall | | direction only | - | Tang et al. 2024 meta-analysis (via search snippet): Ndfa positively correlated with aridity index and mean annual precipitation | | |
| Whole-plant N fixed per t shoot dry matter | `k_fix` | 30–40 | kg N/t dm | Peoples et al. 2009 | 30–40 | |
| Global BNF, pulses | | 2.95 | Tg N/a | Herridge et al. 2008 | | |
| Global BNF, oilseed legumes (soybean 16.4) | | 18.5 | Tg N/a | Herridge et al. 2008 | | |
| Global BNF, pasture and fodder legumes | | 12–25 | Tg N/a | Herridge et al. 2008 | 12–25, most uncertain | |
| Global BNF, rice / sugarcane / non-legume lands / grazed tropical savanna | | ~5 / ~0.5 / <4 / <14 | Tg N/a | Herridge et al. 2008 | | |
| Global BNF in agriculture, total | | 50–70 | Tg N/a | Herridge et al. 2008 | 50–70 | |
| Excretion rate, dairy cattle, Latin America | `Nrate` | 0.48 | kg N/(1000 kg·d) | IPCC 2006 Table 10.19 | 0.35 (E. Europe) to 0.70 (Middle East) | region, diet |
| Excretion rate, other cattle, Latin America | `Nrate` | 0.36 | kg N/(1000 kg·d) | IPCC 2006 Table 10.19 | 0.31–0.79 | region |
| Typical animal mass, dairy cattle, Latin America | `TAM` | 400 (mature females), 450 (mature males) | kg | IPCC 2006 Table 10A-4 | other regions 275–600 | |
| Typical animal mass, other cattle, Latin America | `TAM` | null | kg | table not read | | |
| Derived Nex, Latin America dairy cow | `Nex` | 0.48×400/1000×365 = 70.1 | kg N/head/a | derived from the two sourced values | | |
| Derived Nex, other cattle at 400 kg | `Nex` | 0.36×400/1000×365 = 52.6 | kg N/head/a | derived; TAM 400 is an assumption for other cattle | | |
| N retention fraction of intake | | null | - | IPCC Table 10.20 not read | | |
| Manure share dropped on pasture, Latin America | `MS(T,PRP)` | null | - | IPCC Annex tables not read (Ch 10 says almost all livestock manure in Latin America is managed on pasture or range, a qualitative statement only) | | |
| Excreta N on tropical pasture, Brazil | | 50–90 (urine), 37–59 (dung) | kg N/ha | Boddey et al., 2 to 4 animals/ha (search snippet, paper not opened) | | stocking rate; period not stated |
| Residue factors, `DRY`, `slope`, `intercept`, `N_AG`, `R_BG-BIO`, `N_BG` | | see rows below | | IPCC 2006 Table 11.2 | | |
| Grains: DRY, slope, intercept, N_AG, R_BG-BIO, N_BG | | 0.88, 1.09, 0.88, 0.006, 0.22, 0.009 | -, -, Mg/ha, kg N/kg dm, -, kg N/kg dm | IPCC Table 11.2 | slope ±2%, intercept ±6% (2 s.d.) | |
| Maize | | 0.87, 1.03, 0.61, 0.006, 0.22, 0.007 | same | IPCC Table 11.2 | | |
| Rice | | 0.89, 0.95, 2.46, 0.007, 0.16, NA | same | IPCC Table 11.2 | N_BG NA | |
| Soybean | | 0.91, 0.93, 1.35, 0.008, 0.19, 0.008 | same | IPCC Table 11.2 | slope ±31% | |
| Beans and pulses | | 0.91, 1.13, 0.85, 0.008, 0.19, 0.008 | same | IPCC Table 11.2 | slope ±19% | |
| Tubers (potato) | | 0.22, 0.10, 1.06, 0.019, 0.20, 0.014 | same | IPCC Table 11.2 | | |
| Root crops, other (peanut-modelled) | | 0.94, 1.07, 1.54, 0.016, 0.20, 0.014 | same | IPCC Table 11.2 | | |
| N-fixing forages | | 0.90, 0.3, 0, 0.027, 0.40, 0.022 | same; slope 0.3 is a ±50% default | IPCC Table 11.2 | | |
| Perennial grasses | | 0.90, 0.3, 0, 0.015, 0.80, 0.012 | same | IPCC Table 11.2 | | |
| Cassava, sugarcane, banana residues | | null | | not in the table rows read | | |

Climate- or soil-dependent: the deposition rows (rain, local sources), all fixation rates (moisture, soil N, P and Mo availability), `Ndfa` (soil mineral N, fertiliser), excretion (diet, region). The only Caribbean values found are Puerto Rico's: wet deposition 2.2–3.6 and free-living fixation 8.4–12.3 kg N/ha/a, both from the Luquillo forest. No Caribbean legume, crop-residue or pasture-excreta values were found.

## Inputs and owners

| Equation | Reads | Written today by |
|---|---|---|
| E1 deposition | `place.rain` (mm/d, writer null: CG-2 researched rain, not yet implemented), `A` (cell `areaM2`), `D_wet,a`, `D_dry,a` (constants per climate zone) | nothing writes a deposition quantity |
| E2 symbiotic fixation | plant N demand `U_N` (inside `realism.plant.physiology`, planned; `world.plant_uptake_n`), species `Ndfa`, `world.soil_n` for suppression | nothing writes it; `world.plant_uptake_n` is planned |
| E3 free-living fixation | `world.soil_water` (m^3/m^3, `realism.terrain.soils` planned), `world.soil_n`, `B_free,a` | nothing writes it |
| E4 excreta N | animal count in cell, animal mass `TAM`, intake and retention (CG-6, no excreta quantity yet; DUP-45 undecided), `Nrate` fallback | nothing writes excreta mass; manure is only an index step in `eco.soil_fertility` |
| E6 residue and litter N | harvested yield and residue pools, `N_AG`, `N_BG` | `world.plant_uptake_n` description says litter returns as a transfer; the litter writer is not built |
| E0 balance target | `world.soil_n` | `realism.terrain.soils` (planned) |

**Replacing the `inputs:fallow` placeholder (unit 3001, not read; its meaning is taken from the task text: a placeholder input account for N).** The fallow account should be retired in favour of the physical sources, in this order of what a first implementation can run today with only rain and soil water: (1) `F_dep` wet + dry as an annual-rate-scaled flux (E1), (2) `F_free` as a constant rate per biome (E3). Symbiotic fixation (E2) and manure (E4) cannot be inputs to the soil directly: E2 needs the plant's N demand from CG-3, E4 needs CG-6's excreta quantity. Crop residue (E6) should come from the plant's litter flux, not an extra input. So `inputs:fallow` becomes two outside accounts, `source:deposition` and `source:free_fixation`; the other three arrive through existing transfers once their owners are built.

## Registry

Proposals for the registry keeper; none are edited here. Per-cell scope, kg/d, matching the CG-9 quantities (`areaM2` on the cell record).

| id | unit | scope | proposed writer | note |
|---|---|---|---|---|
| `world.n_deposition_wet` | kg/d | world (per soil cell) | `realism.terrain.nutrient_deposition` (new row) or `realism.terrain.soils` | wet N input from rain, E1 |
| `world.n_deposition_dry` | kg/d | world (per soil cell) | same | dry N input, E1; constant until a source for `D_dry,a` is found |
| `world.n_fixation_free` | kg/d | world (per soil cell) | `realism.ecology.fixation` (new row) or `realism.terrain.soils` | free-living N fixation, E3 |
| `world.n_fixation_symbiotic` | kg | world (per plant record per step), cell-scoped | `realism.plant.physiology` | atmosphere → plant, E2; sibling of `world.plant_uptake_n`, same transaction |
| `plant.ndfa` | dimensionless | species trait | species data file (Life keeper) | fraction of N derived from air, per species |
| `world.n_excreta` | kg/d | world (per soil cell or per animal record) | CG-6 owner (Life) | excreta N from the animal N budget; soil receives by transfer |
| `world.n_residue_return` | kg/d | world (per soil cell) | `realism.plant.physiology` (litter) | plant → soil; likely the same as the litter flux already described under `world.plant_uptake_n`, so register one name only |
| `config.n_dep_wet_annual` | kg/ha/a | place or climate zone | scenario or place data | per-place constant from E1 |
| `config.n_dep_dry_annual` | kg/ha/a | place or climate zone | scenario or place data | null until sourced |
| `config.n_fix_free_annual` | kg/ha/a | biome | scenario or biome data | `B_free,a` |
| `eco.soil_fertility` | 0–1 | existing | existing | **no change**: stays the derived view of `world.soil_n`, `soil_p`, `soil_k`; remove manure as an index step once E4 lands |
| accounts `source:deposition`, `source:free_fixation`, `source:biological_fixation_symbiotic` | - | ledger accounts | ledger | outside accounts that make Δsource = −q hold |

Units are kg or kg/d to match the existing CG-9 split; the annual constants stay in kg/ha/a because that is how every source states them.

## Validation

- **NADP National Trends Network, Puerto Rico site (PR20):** annual wet inorganic N deposition (nitrate + ammonium) maps and site records, a time series since the 2000s. Compare simulated annual `F_dep,wet` per hectare with the site value (2.2–3.6 kg N/ha/a in the sources read). Wet-only; it cannot test the dry term.
- **Luquillo watershed N budgets (Chestnut et al. 1999; McDowell and Asbury 1994, as cited in Cusack et al. 2009):** stream N outputs plus accretion exceed measured inputs by 8–19 kg N/ha/a (lower forest) and 15–17 kg N/ha/a (upper forest). A closed budget run should find deposition + free-living fixation roughly equal to the unmeasured gap: 3.6 + 12.3 = 15.9 and 3.6 + 8.4 = 12.0 kg N/ha/a, against gaps of 8–19 and 15–17.
- **Vet et al. 2014 data set (WMO GAW, World Data Centre for Precipitation Chemistry):** quality-assured wet-deposition values and dry-deposition model results, tropical coverage sparse; tests the shape of deposition across climates.
- **Dentener et al. 2006 multimodel fields:** gridded total N deposition for 2000 and 2030; global and regional sums for aggregate checks.
- **Cleveland et al. 1999 global total (195, 100–290 Tg N/a) and Herridge et al. 2008 agricultural totals (50–70 Tg N/a):** aggregate sanity checks: area-weighted sums of E2 and E3 over a global-scale run should land within these ranges.
- **IPCC Table 11.2 worked values:** residue N per hectare from tabulated yields (maize 3000 kg dm/ha → 32.5 kg N/ha above) as a unit test for E6.
- **Candidate datasets not reached in this unit (leads, not sources):** FAOSTAT crop yields for E6 inputs; Boddey and co-workers' Brazilian pasture excreta data and Florida grass-legume pasture studies for tropical excreta N return (snippet-level only).

## Sources

- https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_11_Ch11_N2O&CO2.pdf (IPCC 2006 Vol 4 Ch 11): Eqs 11.1, 11.5, 11.6, 11.7, 11.7A; Table 11.2 residue defaults used in E6 and Parameters. Read in full text.
- https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_10_Ch10_Livestock.pdf (IPCC 2006 Vol 4 Ch 10): Eqs 10.30, 10.31; Table 10.19 (Nrate); Table 10A-4 (TAM, Latin America dairy). Read in full text.
- https://escholarship.org/content/qt46k201ms/qt46k201ms.pdf (Cusack, Silver, McDowell 2009, Ecosystems 12:1299–1315, DOI 10.1007/s10021-009-9290-0): Puerto Rico free-living fixation, wet deposition 3.6 kg N/ha/a, Cleveland 1999 tropical and temperate ranges as quoted, budget gaps of Luquillo watersheds, moisture and N effects. Read.
- https://ecommons.cornell.edu/bitstream/1813/60812/1/Cleveland_et_al-1999-Global_Biogeochemical_Cycles.pdf (Cleveland et al. 1999, Global Biogeochem. Cycles 13:623–645): global natural-ecosystem fixation 195 (100–290) Tg N/a; not read beyond the abstract-level search result. Per-biome table is a gap.
- https://rune.une.edu.au/web/handle/1959.11/16181 (Herridge, Peoples, Boddey 2008, Plant and Soil 311:1–18, DOI 10.1007/s11104-008-9668-3): global agricultural BNF totals by crop group. Record page read.
- https://rune.une.edu.au/web/handle/1959.11/8099 (Peoples et al. 2009, Symbiosis 48:1–17, DOI 10.1007/BF03179980): 30–40 kg N per t shoot dry matter; residual N caveat. Record page read.
- https://www.pbl.nl/en/publications/nitrogen-and-sulfur-deposition-on-regional-and-global-scales-a-multimodel-evaluation (Dentener et al. 2006, Global Biogeochem. Cycles 20:GB4003, DOI 10.1029/2005GB002672): model uncertainty, ocean share, critical-load share. Abstract read.
- https://wdcpc.org/global-assessment-data (Vet et al. 2014, Atmos. Environ. 93:3–100, DOI 10.1016/j.atmosenv.2013.10.060): global wet and dry assessment and data set; dry deposition uncertain and tropics sparsely sampled. Known from search results; data not downloaded.
- https://nadp.slh.wisc.edu/filelib/maps/NTN/pdfs/2019/N_dep_2019.pdf (NADP NTN maps, 2018 and 2019 versions at the same site): Puerto Rico wet inorganic N values read from a garbled PDF in a search snippet; treat 2.2–2.4 as approximate.
- https://www.usgs.gov/publications/functional-ecology-free-living-nitrogen-fixation-contemporary-perspective (Reed, Cleveland, Townsend 2011, Annu. Rev. Ecol. Evol. Syst. 42:489–512): free-living fixation is near-ubiquitous and may be the dominant new-N pathway; no rates on the page read.
- Peoples et al. 2021 (Plant and Soil, update of grain-legume %Ndfa): the Springer page fetch returned 404, so the group mean 74 ± 11.8 is known from a search summary only; no URL cited.
- Tang et al. 2024 (Plants, 13:3244; https://www.mdpi.com/2223-7747/13/22/3244): Ndfa correlates with aridity index and mean annual precipitation; direction only, from a search summary.
- https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1080592/1/2017049.pdf (Embrapa, Rio de Janeiro State bulk deposition 4.3–17 kg N/ha/a): attribution from a search listing, paper not opened.

- (3004) report: confidence medium for the structure of the equations and for IPCC residue and excretion numbers (read from source tables), medium-low for deposition and fixation constants (one Caribbean site each; Cleveland's per-biome table, Peoples 2021 per-species Ndfa, Vet 2014 dry deposition and the IPCC pasture-share and retention tables were not reachable). Open choices for the keeper: (1) whether symbiotic fixation is modelled as a plant-side split of N demand (E2, recommended: conserves mass, needs CG-3 demand) or as a yield-proportional soil input (k_fix form); (2) whether to retire `inputs:fallow` for two outside accounts `source:deposition` and `source:free_fixation` or keep it with the physical flux names; (3) a placeholder dry:wet deposition ratio is unsourced and must come from Vet 2014 or CASTNET before use (constant `D_dry,a` stays null); (4) whether moisture and N-suppression factors on free-living fixation are in the first version (directions sourced, forms not); (5) residue and manure are transfers, not inputs, so register them only if CG-3 and CG-6 do not already. The implementation unit will need: `place.rain` implemented (CG-2), `world.soil_n` and `world.soil_water` written by `realism.terrain.soils`, per-place constants `D_wet,a` and `B_free,a` in scenario data (Puerto Rico: 3.6 and 8.4–12.3 kg N/ha/a), the plant N demand quantity from CG-3 for E2, the excreta quantity from CG-6 for E4, a ledger source account that allows an atmosphere-to-cell transfer, and a follow-up research unit for Cleveland 1999 per-biome rates, per-species Ndfa and tropical dry deposition.
(5237) rechecked: Peoples 2021 Ndfa 0.74: still summary only; searched: Springer article URL (404), doi.org redirect to Springer (login redirect), web search (abstract summary repeats 74 +/- 11.8, page not opened)
