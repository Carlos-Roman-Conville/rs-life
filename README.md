# @rex/realism: the realism engine (first operational build, 2026-10-29)

The shared simulation engine the games build on: a **registry** of substances, materials and components; a typed
**connection graph**; a **conservation and process engine** that moves mass and energy by real formulas and records
every transfer; a **scheduler** with fast and slow steps; and a **trace** that checks conservation every step so an
experiment can be read back. Design: `Games/RPG's/pirate-ship/files/pirate-ship/science/ENGINE.md` (Rex's rules:
build it; real formulas with real numbers; no made-up rules to make things work).

## Run

    npm install --offline      # vitest and typescript from the cache
    npm test                   # the still-in-a-room scenario and the physics checks
    npm run lab -- 0 60        # altitude 0 m, skill 60: prints the result and the trace summary
    npm run lab -- 2256 100    # the Blue Mountain peak: boils at 92.5 C

## What the first build proves

A character, a charcoal heater, a copper vessel of water, a worm condenser in a tub, pipes and a collector, in a
room with brick walls and a box of air. From the formulas in `src/physics.ts` (Antoine, latent heat, specific heats, heats of
combustion, stoichiometry, convection, the ideal gas, the box model) and nothing else: boiling at the pressure's
boiling point (100 C at sea level, 92.5 at 2,256 m), distillate at the net heat over the latent heat, the room's
oxygen falling and CO2 rising from the fire (CO when starved), the distiller sweating by PHYSIOLOGY.md's rate, a
drifted thermometer misreporting while the physics runs on the true temperature, a novice wasting fuel, wear on the
vessel, and water and charcoal conserved every step with the trace saying where every gram and joule went.

## Shape

    src/physics.ts     the formulas and constants, each with its source key (ENG-*)
    src/registry.ts    substances (properties only), materials, components with ports, the default set
    src/graph.ts       typed edges
    src/process.ts     combustion, losses, boiling, condensation, the room box, the body, the thermometer, wear, control
    src/library.ts     the typed loader for data/library: libraryTable(file, table) rows keyed by column, cached
    src/physiology.ts  the human body process: energy (RMR, MET, PAL), heat (WBGT, core drift), sleep, water, acclimatisation
    src/nutrition.ts   nutrient pools, absorption, deficiency stages, glycogen and fat, from the nutrition tables
    src/atmosphere.ts  altitude, the room box, gas sources and sinks, units, the transport grid, and the respiratory side (air to blood)
    src/reactions.ts   data-driven vessel reactions, limiting reagents, reaction heat and gas release
    src/elements.ts    chemical formula parser and atomic masses for the element ledger
    data/reactions.json four sourced reaction records with stoichiometry, conditions and rate models
    src/scheduler.ts   fast and slow steps in a declared order
    src/world.ts       the world, the conserved ledger and the per-step check
    src/trace.ts       transfers, checks, notes, summary
    src/lab/still.ts   the scenario
    test/              vitest

The vessel now evaporates below boiling from its free surface: ASHRAE's still-air pool form
`m_dot = (0.089 * 0.5 / L) A (p_sat - p_partial)`. The trace records water entering the room,
latent cooling and carried sensible enthalpy. Its free surface is inferred from the unchanged exterior
area by assuming a cylinder whose height equals its diameter (exterior bottom + sides = five free surfaces).

Four brick walls surround an assumed cubic room of the unchanged volume. They store heat at
1920 kg/m3 and 790 J/(kg K), with 228 mm thickness and a tabulated assembly U of 2.11 W/(m2 K).
Air exchanges heat with them through h A dT. The outside branch removes the indoor film resistance
from the table's U to avoid counting that film twice. Both directions and wall storage appear in the trace.
The two-hour temperature regression uses an analytical upper envelope from heat input, wall capacity,
and indoor conductance (below 36 C for the default case); this is a derived bound, not a measured-room claim.

The counterflow condenser uses effectiveness-NTU with the correct isothermal-condensation limit,
`Cr = 0`, `epsilon = 1 - exp(-UA/Ccold)`, `Ccold = m_dot_coolant cp`. Its U comes from the
Churchill-Chu water-side natural-convection correlation, varying with temperature difference.
New explicit condenser assumptions are a 90 mm tube diameter (F-Chart example) and 1 kg/min
coolant recirculation (~1 L/min, Euro 30 operating range). The same tub supplies and receives that
water, so it still warms; this assumes circulation, not an external supply of cold water.
Condensate leaves saturated and mixes thermally with the collector; there is no subcooling section.

Remaining named simplifications: lumped temperatures (including wall mass and body), explicit one-second
steps, instantaneous vapour transport, cubic room geometry without roof/floor heat exchange, walls: four sides only, no roof or floor, negligible
plaster thermal mass, pool-correlation extrapolation toward boiling, fixed water transport properties
at 40 C, negligible copper/condensate-film thermal resistance and forced-convection enhancement,
and the existing h, combustion oxygen threshold, body, wear and control approximations.
These are models, not game rules. The five services remain unchanged in shape. Plain TypeScript,
no DOM, so it runs in Node and in a browser alike. Per-step conservation checks remain for water and
charcoal; energy is verified by focused balance tests, not a new whole-world energy ledger.

`reactionProcess(vessel, reactions = defaultReactions)` runs the reaction records in order. Reagents and an
optional catalyst must be in the vessel; gas products follow its first outgoing gas edge (connect that edge to
the room for an open vessel), or remain inside if there is no edge. Reaction enthalpy and gas sensible enthalpy
are separate traced transfers. Calcination absorbs 178 kJ/mol and slaking releases 65 kJ/mol, rounded from the
formation enthalpies recorded in the data. Endothermic conversion stops when available sensible heat reaches
the record's minimum temperature and can resume after reheating.

Call `world.conserveElements()` after assembling the world and before running the scheduler to check element
mass every step. An optional component list tracks a smaller boundary, provided it includes every participant
in any reaction crossing that boundary. Chemical conversion traces do not count as external element supplies;
actual gas transport and other boundary transfers do. The ledger uses formula atom counts (including parentheses),
registered molar masses and CIAAW atomic weights. It covers contents; equipment shells remain inert. New hydrogen
and lime molar masses follow the existing rounded H/C/O masses, keeping total mass additive in the seeded reactions.

Reaction simplifications: irreversible, perfectly mixed reactions; constant heat capacities and standard reaction
enthalpies referenced to 25 C; threshold ignition; no pressure-dependent equilibrium, dissolution, or automatic
phase-change coupling; instantaneous gas transport. All four seed records explicitly use the requested **[model]
complete-within-step** fallback because their cited thermochemical sources do not provide applicable bulk kinetic
parameters. Records with sourced first-order Arrhenius parameters use `k = k0 exp(-Ea/RT)` and consume the fraction
`1-exp(-k dt)` of the limiting reagent at the step's initial temperature. No measured kinetic parameters are invented.
The existing still heater retains its oxygen-starvation and charcoal heating-value model; the new carbon record
represents complete combustion of standard-state carbon and therefore uses its standard formation enthalpy.

## Sources

The original formulas retain their ENG-* source keys from the pirate engine design. Sources added here:

- [ASHRAE HVAC Applications, chapter 6](https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch06/a23_ch06_si.aspx): equation 2, still-air coefficient 0.089 and table 1 unoccupied factor 0.5; latent evaporation load.
- [LBNL Buildings material library](https://simulationresearch.lbl.gov/modelica/releases/v1.1_build0_rc2/help/Buildings_HeatTransfer_Data_Solids.html): brick density and specific heat.
- [CIBSE Domestic Heating Design Guide, table 6.1 via MCS](https://mcscertified.com/wp-content/uploads/2020/04/Guidance-on-U-Values-from-Domestic-Heating-Design-Guide.pdf): 228 mm solid brick with dense plaster, U=2.11.
- [F-Chart effectiveness-NTU](https://fchartsoftware.com/ees/heat_transfer_library/heat_exchangers/hs1000.htm): counterflow capacity rates, NTU and phase-change limit.
- [F-Chart Churchill-Chu correlation](https://www.fchartsoftware.com/ees/heat_transfer_library/free_convection/hs3045.htm) and [NREL SAM technical manual](https://nrel.gov/docs/fy11osti/51825.pdf): horizontal-cylinder Nusselt correlation.
- [F-Chart water-cylinder example](https://fchart.com/ees/heat_transfer_library/free_convection/hs3040.htm): 90 mm diameter and gravitational acceleration.
- [University of Washington water properties](https://staff.washington.edu/calebktw/water_properties.html): liquid transport properties used at 40 C.
- [Spirits Unlimited Euro 30 instructions](https://www.spiritsunlimited.co.nz/upload/euro30_instructions.pdf): 0.5-1 L/min cooling-water operating range; here recirculated from the tub.
- [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/): molar mass, c_p, melting and boiling points per substance row in `data/substances.json` (each row links its own entry).
- [Engineering ToolBox specific heat](https://www.engineeringtoolbox.com/specific-heat-metals-d_152.html) (also [solids](https://www.engineeringtoolbox.com/specific-heat-solids-d_154.html), [air](https://www.engineeringtoolbox.com/air-specific-heat-capacity-d_705.html)) and the [IT'IS tissue database](https://itis.swiss/virtual-population/tissue-properties/database/heat-capacity/): material c_p in `data/materials.json`.
- [IUPAC CIAAW atomic weights](https://ciaaw.org/atomic-weights.htm): the formula check in `test/registry.test.ts`.
- [IUPAC Arrhenius equation](https://goldbook.iupac.org/terms/view/A00446): rate coefficient; integration assumes first-order limiting-reagent decay at fixed step temperature.
- [NBS thermodynamic tables, Wagman et al. (1982)](https://srd.nist.gov/JPCRD/jpcrdS2Vol11.pdf): calcite formation enthalpy and heat capacity, standard-state reference and Hess's law data. [NIST CaO](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1305788&Mask=2), [Ca(OH)2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1305620&Mask=2), [CO2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=1), [liquid water](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2), [steam](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=1), and [hydrogen](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1): formation enthalpies and heat capacities used in the reaction records and added substances.
- [NOAA calcium carbonate](https://cameochemicals.noaa.gov/report?key=CH25005): 825 C decomposition threshold. [National Research Council laboratory chemical safety summaries](https://www.ncbi.nlm.nih.gov/sites/books/NBK55861/bin/10-LaboratoryChemicalSafetySummaries.pdf): hydrogen autoignition range, whose lower end supplies the modeled 500 C threshold. Carbon's modeled 400 C threshold retains the pirate reaction table's condition.

Substances and materials live in `data/substances.json` and `data/materials.json` (loaded by `defaultRegistry()`); a null
field means no standard value was found. The pirate table's `smoke` row (soot and tars, not one substance) and its
tagged-substance template are not carried over.

## The library

`data/library/` is the scientific data library: the universal columns of the pirate game's `body/data/*.json`
tables, split by `scripts/split_data.py` (MIGRATION.md sections 3 and 5, phase 2). One file per domain
(`physiology`, `nutrition`, `anatomy`, `circulation`, `medicine`, `muscular`, `neurology`, `atmosphere`,
`gasdynamics`, `chemistry`, `equipment`, `science`, `environment`, `ecology`, `population`) plus `sources.json`.
A file is `{"_about": text, "<table>": {title, kind, conf, source, columns: [...], rows: [[...]]}}`, the game's own
schema. Only tables marked E or L in the map are here; the split lists the game columns each table keeps (faces,
STATS and COMBAT links, period treatments, availability, places).

- **`id`** is the first column of every table and is stable. A table with its own `Id` column keeps it
  (`o2`, `mortar`; prefixed `<domain>.<table>.` only where the same id appears in two tables, as `tagged` does).
  Any other row gets `<domain>.<table>.<slug of its first column>` (`physiology.met.hauling-lines-...`,
  `nutrition.foods.ships-biscuit`; a trailing GOODS row number is dropped from the slug). The catalogue's world
  history (date, credited to, predecessor, `conf_history`) is the table `catalogue_history`, one row per catalogue
  entry, id `equipment.catalogue_history.<catalogue id>`.
- **`source`** is the last column: `open`, or source keys from `sources.json` separated by `; `. Keys come from the
  row's own cells and from the game's docs (the doc table line that starts with the row's first cell, or a prose
  line that contains a long first cell). `open` means no library source is cited for that row yet; the table's
  `source` text still names its sources. Citations of `history`-kind sources stay with the game.
- **`sources.json`** holds the game's source rows whose Kind is `science` or `reference` (Key, What, Gives, URL,
  Kind, Opened). `python scripts/check_library.py` exits 0 when every file parses, every table has `id` and
  `source`, no id repeats, and every source is `open` or a key in `sources.json`.
- **A number has one home.** A column that moves is removed from where it came from. Where `data/substances.json`
  or `data/reactions.json` already holds a row by the same id, the library table has `null` in the columns the
  engine file holds (chemistry `Formula`, `Molar mass`; reaction `Reactants`, `Products`, `Conditions`, `Rate`,
  `Heat`). The game keeps only `id` and its own columns in an adapter row, and reads the rest by id. A quantity
  that two docs both state belongs in one library row, cited by the other.
- `Mark` (rex / proposed / open) is a review state, not a number: the library's is for its columns, the adapter's
  for the game's.

Run `python scripts/split_data.py` to rewrite the library from the game's files (idempotent; it prints, per table, the
rows read and written and the columns moved and left). `--write-game [--game-out DIR]` also writes the adapter
versions (`*.adapter.json`, id plus game columns) beside the originals or into DIR, for the game side of phase 2 to
apply; it never changes the originals.

### Physiology (`src/physiology.ts`)

`physiologyProcess(body, room, {met | schedule, clockH0, dayStartH})` runs on a component of kind `body` and reads the
`physiology` tables through `libraryTable`. Resting rate is Mifflin-St Jeor (PHY-MSJ) from `height_cm`, `age_y`, `male` on
the body's props; an activity costs `metabolicHeat(MET)` corrected to that rate, so a day at 1 MET is the rate itself and the
day's PAL is its MET-hours over 24. Heat: WBGT (the room's `wbgt_c`, else its dry temperature) against the work class's
ceiling, between the unacclimatised and acclimatised columns by `acclimatisation`; the core drifts above it at the table's
rate; sweat and its evaporative cooling are the old `bodyProcess`, which now delegates here. Sleep: quality-weighted hours
close at `dayStartH` with the recovery table's debt, fatigue and core rules; alertness is the debt row times the circadian
row. Outputs are by id on `body.props.outputs` (`bodyOutputs(body)`): `alertness`, `sleep_debt`, `core_c`,
`water_deficit_pct`, `energy_balance_kcal`, `pal`, ... `ingest(world, body, {kcal, waterKg})` brings food energy and water
in, traced (`energy:chemical`, `mass:water`). [`flags/physiology.md`](flags/physiology.md) lists what the docs ask for that the library cannot support.

### Nutrition (`src/nutrition.ts`)

`stockPools(world, body)` fills a body's pools (every nutrient the depletion table gives a reserve and a daily use for: vitamins
C, A, B1, B3, B9, B12, iron, magnesium, sodium) as contents `nutrient:<id>`; `eat(world, body, foodId, kg, {cooked, ...})` and
`eatMeal` take a food row per kilogram, bring its energy and water in through physiology's `ingest`, absorb its nutrients by the
`absorption` table's multipliers, cap each pool at full (the excess goes to `excreta`) and trace every transfer
(`mass:nutrient:<id>`). `nutritionProcess(body)` runs after physiology and closes each day: the table's daily use is debited, the
stage is set (1 under the table's "signs below" level; 2 and 3 where the caller gives their levels), and the energy balance
(intake minus physiology's expenditure) changes glycogen and fat by the `body_composition` rules, with the energy density the
table gives (7,700 kcal/kg). Outputs by id on `bodyOutputs`: `pool_<id>`, `deficiency_<id>`, `fat_kg`, `glycogen_g`,
`glycogen_factor`, `energy_unplaced_kcal`. `deficiencySignals(body)` lists the stages above 0. `World.conserve("nutrient:vit_c", ["body"])`
holds each pool's mass. [`flags/nutrition.md`](flags/nutrition.md) lists what the library cannot support.

### Atmosphere (`src/atmosphere.ts`)

`altitudeAir(h)` gives the pressure and inspired PO2 (the altitude table's columns to under 1 mmHg); `roomAirProcess(room)` is the
room box that `roomProcess` in `process.ts` now calls (ACH exchange, humidity, `co2ppm`/`o2frac`/`coppm`). `sourcesProcess(room, sources)`
adds the `sources_sinks` rows (`lampFlows`, `fireFlows`, `rotFlows`, `sulphurFlows`; a body's gases are `bodyGasFlows`, VO2 by MET and
mass with the respiratory quotient), every transfer traced as `mass:<gas>`. `breathingProcess(body, room)` takes a body's O2 and gives its
CO2, then writes by id on `bodyOutputs(body)`: `o2_frac`, `co2_ppm`, `co_ppm`, `sao2`, `cohb`, `ventilation_l_min` (alveolar gas equation,
Severinghaus, the COHb approach, the CO2 and hypoxic drives; `respiratoryProfile({...})` changes the species). `accumulateExposure` sums
ppm-minutes and the peak per gas (physiology calls it). `Grid` is a host-supplied lattice with elevation, enclosure and levels: wind,
diffusion, rise and settle shares per step (the host's numbers; the library has none), a ledger per species and `uniform()` to hand the
cloud to the box. [`flags/atmosphere.md`](flags/atmosphere.md) lists what the docs ask for that the library cannot support.

### Environment (`src/environment.ts`)

The outdoors as one module: conditions a host supplies per place and hour (air temperature, humidity, wind, sun) become what
bodies and rooms read. `wbgtBom(airC, rh)` is the Bureau of Meteorology's simplified WBGT (the ACSM 1987 form, from the vapour
pressure `vapourPressureHpa`); `exposure(terrain)` and `placeOutputs(terrain, conditions)` read the library's `environment.exposure`
rows (the "WBGT vs open deck" column, shade, wind); `windChillC` is the North American index; `diurnalC` interpolates the day's
extremes on a half-cosine; `isDay`/`sunHours` and `coldWater(waterC)` (the `physiology.cold_water` band) complete it.
`environmentProcess(place, terrain, conditions)` writes outputs by id (`wbgt_c`, `felt_c`, `is_day`, `sunburn_min`, ...) and
`props.wbgt_c` on the place, which physiology reads. It moves no mass or energy, so there is nothing to trace.
Unreachable figures (the WBGT form's stated error, the diurnal form's citation) stay `null` or flagged in
[`flags/environment.md`](flags/environment.md).

### Neurology (`src/neurology.ts`)

Signalling systems, baseline drivers, one-compartment kinetics, four receptor clocks, eleven circuits and interaction rules on a
`body` component, all read from `data/library/neurology.json` through `libraryTable`. A system's tone is 1 at rest;
`dose(w, body, key, amount)` puts a substance in the gut (traced `drug:<key>`), `neurologyProcess` absorbs, eliminates (half-life,
or zero order for alcohol, scaled by `liver_function`) and reads the systems; `pkStep`, `toleranceStep`, `recoveryStep`,
`dependence` and `rebound` are the clocks. A circuit reads the tones (`circuitRead`). Outputs by id on `bodyOutputs`: one per
circuit (arousal, attention, pain-gating, mood-regulation, sleep, ...), `tone_<system>`, `conc_<key>`, `occupancy_<key>`,
`withdrawal_<system>`. Parameters the library lacks (every EC50, most rebound peaks, the inverted-U shapes) switch their path off;
they are listed in [`flags/neurology.md`](flags/neurology.md).

### Circulation (`src/circulation.ts`)

The blood as a volume ledger inside the body's mass, read from the `circulation` tables. `initialiseCirculation(w, body, profile?)`
sets blood volume (`normalBloodVolume`, mL/kg by sex) and haemoglobin; `loseBlood` and `bleed(w, body, rateMlMin, seconds, clotting)`
take blood out at the library's density, traced. `oxygenDelivery(CO, Hb, SaO2, COHb)` is bound oxygen only (CIR-DO2);
`bleedingClass`/`bleedingEffects` give the class by fraction of baseline volume with its pressure, perfusion per organ and the table's
placeholder death rate per hour; `regulationLoops()` and `hazard(event, state)` read the homeostasis and event rows. `circulationProcess(body, options)`
runs after `breathingProcess` and writes by id on `bodyOutputs`: the `circulation.quantities.*` rows (blood volume, haemoglobin,
cardiac output, DO2, mean arterial pressure, perfusion per organ), the `circulation.blood_gas.*` rows, one flag per bleeding class and
`aerobic_today`. The host supplies resistance, wounds, supplies and crises; a kinetic figure the library lacks stays `null`. See
[`flags/circulation.md`](flags/circulation.md) for what is flagged or UNSUPPORTED.

### Anatomy (`src/anatomy.ts`)

Organ assemblies on the same registry and graph: `assembleBody(w, body, profile)` adds a zero-mass shell component per organ and tissue
(views into the body's mass, not extra thermal tissue) from the `anatomy` tables (`organs`, `tissues`, `damage_function`, `timescales`,
`species`). `speciesProfile("Human default" | "A horse (example)")` and `speciesRmr` read the species columns (blood volume, cardiac
output, set point, resting rate). `connectOrganInput` wires an organ to another component's output; graph signals are adequacies, not
transfers of invented blood or nutrient mass, which stay with circulation, atmosphere and nutrition. `anatomyProcess(assembly)` steps
organ function and damage from the host's insult and resistance and records a `Crisis` (organ, remaining capacity, source) when function
falls; the engine does not kill. `assemblyCirculation`, `assemblyBreathing` and `feedAssembly` run those modules on the assembly.
Unknown organ masses and cascade timescales stay `null`. See [`flags/anatomy.md`](flags/anatomy.md).

### Muscular (`src/muscular.ts`)

Library-driven muscle indices from the `muscular` tables (MUSCULAR.md sections 4 and 5a); no tissue mass or energy is created, since
physiology owns metabolic work and nutrition owns mass. `muscularRates(group)` and `muscularActivation(actionId)` read the group and
activation rows; `stepMuscleFatigue` moves a group's resting, active and fatigued compartments for an effort and a duration, and
`muscularEnduranceReference` is the table's reference curve. `createMuscularState`, `muscularStimuli`, `adaptMuscleDay` and
`muscularBanisterDay` keep per-side contractile and recruitment indices and a daily fitness-fatigue pair. `muscularOutputs(state)` gives
fatigue per group and side and pattern skill per side; limb strength, oxidative, tendon and neural adaptation and muscle mass are
`null` until the library carries them. See [`flags/muscular.md`](flags/muscular.md).

### Fatigue: local and systemic

Reality's proposed aggregation interface (2634) is **one record of the work**, physiology's schedule. An entry's
`activity` may name a `muscular.activations.*` row: physiology charges its `Intensity (MET)` and publishes the row id
as `outputs.activity` beside `outputs.met`. `fatigue_met_hours` sums MET x hours and follows the overnight recovery
table. A physiology MET row publishes its canonical id; a numeric MET (including the default) publishes null.

Add `muscularFatigueProcess(bodyId, state, options)` after physiology with the **same `every` cadence** (both default
to 10), using steps aligned to schedule boundaries. It reads that activity's activation share as each group's 3CC
effort; other activities and numeric METs mean local rest. Missing rate sets remain null. The optional
`recoveryMultiplier` defaults to 1. The scalar outputs `muscular.fatigue_3cc.<group>.<side>` publish
`muscularOutputs(state).fatigue`, for example `outputs["muscular.fatigue_3cc.hand.L"]`.

Local fatigued fractions (minutes to hours) and systemic MET-hours are distinct peripheral and whole-body states;
neither is calculated from the other. Banister's daily training-response fatigue (`muscularBanisterDay`) remains a
third state. Nutrition can run after physiology on the same cadence and reads the same MET for glycogen use above
its library threshold. MET comparisons and two independent maximal-hold force endpoints are tested; this does not
validate the proposed activation shares or a general local-to-systemic force relationship. See
[`flags/muscular.md`](flags/muscular.md) for the evidence and limits.

### Medicine (`src/medicine.ts`)

Diseases as courses (`diseaseCourse`), immunity (`immunityRule`), wounds and their healing clock, pain, treatments and the air
conditions of the `exposure` table, in days, with every random draw seeded. `createMedicine(body)` holds the state; `expose(state,
disease, dose, options)` infects or reports why not (no dose, immune, quarantined, already sick); `inflictWound`, `treat` (only
treatments the "Really worked?" column credits take effect, the rest return `unquantified`), `healingMultiplier`, `advanceDays`,
`painLevel` and `airConditions` advance it. A death risk that comes due is a `MedicineCrisis` with its cause; `resolveCrisis` records the
host's decision, and the engine never kills. A wound bleeds through circulation's `bleed`, so the volume ledger stays traced.
`medicineProcess(state, factors)` runs after circulation and `medicineOutputs` writes `medicine.diseases.*`, `medicine.immunity.*`,
`medicine.lasting_harm.*`, wound counts, pain bands, `medicine.pain`, `medicine.sick_count` and `medicine.crises`. See
[`flags/medicine.md`](flags/medicine.md).

### Ecology (`src/ecology.ts`)

A logistic stock with the `depletion_rules` and a soil fertility index (`soil`), in days. The host supplies each stock and field (r, K, q
and demand are its own). `createStock(id, B, K, r)`, `stepStock(stock, catch, trace)` (growth enters from `environment`, the catch leaves
to `catch`, both traced, and the step checks stock = before + growth - catch), `dailyCatch`, `msyPerYear`, `isFishedOut` (below the
table's fraction of K), `recoveryYears`, `collapseYears` and `takeNestingFemales` cover stocks. `createField`, `clearForest`, `harvest`,
`manure`, `fallow`, `erode` and `dryYearFactor` cover soil, and `cropDemand()` reads the crop rows. `stockOutputs` and `soilOutputs` give
the fished-out flag, fill fraction, yield and fertility by id. Figures the tables do not give (rain and labour factors, any ground's r
and K) are not invented. See [`flags/ecology-and-population.md`](flags/ecology-and-population.md).

### Population (`src/population.ts`)

The cohort record (`children`, `adultsM`, `adultsF`, `elders`, plus a transient count, seasoned share, health and food days) and its
daily `tick(population, rates, options)`: births, background deaths (elders at the row's multiple), ageing between cohorts, famine
(`famineRule`), migration (`settlersPerDay`) and an epidemic run through medicine's `diseaseCourse` and `immunityRule`
(`startEpidemic`). The host supplies the rates. Counts are expected people, real numbers; every tick checks the total against
births, arrivals, deaths by cause and departures, traced. `populationOutputs` writes the `population.cohorts.*` rows (cohort counts,
health, food days, the epidemic and `labour`). See [`flags/ecology-and-population.md`](flags/ecology-and-population.md).

### Independence checkpoint (`examples/horse-stable.ts`)

A horse in a 60 m3 stable for thirty days, run from the library alone with no host-game code: `runHorseStable()` builds the body, room and
`assembleBody` assembly with the `anatomy.species` column "A horse (example)" (blood volume, cardiac output, set point, Kleiber resting
rate), feeds kcal and water hourly through `ingest`, and runs room air, physiology and breathing, with a ledger of mass, energy and
gases. It borrows the human-week weather and door from `examples/human-week.ts`. Where the library has no horse figure it says so: no
feed row, work MET, haemoglobin, respiratory profile, skin area or muscle layout, so the work hours run at rest, the horse breathes the
human per-kg profile as a named stand-in, and muscle fatigue is `null`. See [`flags/independence.md`](flags/independence.md).

Null slots: the code already reads these library slots, but they are `null` because no source is cited: the circulation homeostasis `tau (s)` column (`flags/circulation.md`; 2560 filled `maximal-cardiac-output`: 20 L/min, Magder 2022); the anatomy organ masses, the organs table's `Cascade kinetics (s)` column, the horse `haemoglobin-g-dl` and the horse `maximal-ventilation-l-min` (`flags/anatomy.md`). Each flags file records what was searched. Entering a cited number in a slot switches its code path on with no code change; until then volume recovery, organ cascades and the horse's blood and breathing ledgers stay off.

## Next (the belt)

Wire the equipment catalogue and further substance records (`body/data/*.json`) into the registry; expand reaction
coverage and measured kinetics; the body as organ components on the graph; the dashboard's
Simulation Laboratory driving this package; the pirate game importing it.
