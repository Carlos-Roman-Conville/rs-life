# Phases 6 and on: "every facet of life except evolution" (scope by Rex, 2026-10-30)

Rex widened the Reality & Species engine on 2026-10-30 (his words plus a ChatGPT paste he agrees with; the table
is in `Toolchain/ENGINES.md`, "Scope added 2026-10-30"): mechanics, optics, fluid dynamics, materials, the full
lifecycle from digestion to decomposition, and genes and ageing acting through organ capacity. Two rules of his
apply to every phase below, on top of the eight in `PHASES-4-5.md`:

- **Real-world data first (Rex, 2026-10-30).** Every value is filled from historical or measured data and
  labelled `researched`, `estimate` or `fiction`. **(proposed)** mapping onto the library: a row's `source` is an
  opened page → `researched`; a value with no opened page but a stated basis (a bound, a scaling from a cited
  neighbour, a period account) → `estimate`, with the basis in the row and a flag line; a game-only mechanism →
  `fiction`. The old rule stands where no basis exists: `null` and a `searched:` flag line. **(open)** for Rex:
  whether an `estimate` may drive a process by default or only when a host opts in.
- **Nothing is a fixed property that a mechanism could produce (Rex, 2026-10-30).** Strength comes from muscle
  cross-section and activation, not a strength number; darkness is the absence of light at the observer; an old
  body is one whose organ capacities have declined, not one with an age penalty. Each phase's acceptance test
  greps `src/` for the forbidden shortcut it replaces.

**Nothing below is built until Rex picks the order.** This file records what exists, what is missing and how
each phase is accepted.

**Where this sits in the platform roadmap (Rex approved the organisation 2026-10-30; `Toolchain/ROADMAP.md`,
`ENGINES.md` "The approved organisation").** Before any phase here: **P0 Kernel** (a new keeper builds shared
time, ids, replay, seeded RNG and units; infrastructure only, never a formula; it asks this keeper what
`realism`'s scheduler, registry and RNG do today, answered from the code, see the last section) and **P1 overlap
closure** (the registry keeper sends DUP groups where realism is the proposed owner or a losing home: fatigue,
metabolism, mortality, body water, sleep, ageing among them; per group this keeper agrees or counters the owner
and the acceptance test, builds nothing, and nothing moves until it agrees). Then phases 6 to 9 and 13 are
**P2 Physical foundations** and 10 to 12 are **P3 Life completion**; the roadmap's own tests for P2 and P3 are
quoted under each phase. Reality stays one package until the mechanics work makes the split into Physical
Reality and Life & Species necessary (Rex). Refinement (A): a phase starts when what it reads from is ready, not
when the previous phase finishes. Every phase is accepted on the human first and then on a second species by configuration
(the horse of `examples/horse-stable.ts`), with no game word in `src/`.

## Dependency graph

```
6 mechanics ──┬─ 7 fluids ──────────────┐
              └─ 9 materials            │
10 metabolism as flux ─┬─ 11 waste, sanitation, decomposition ─┤  (11 also reads 7 for water, 9 for decay)
                       └─ 12 genes and ageing                   │
8 optics (independent; reads 9 for albedo when 9 exists) ───────┘
13 weather and climate (reads 7 for evaporation and flow, 8 for solar geometry; replaces the pirate Markov chain)
```

Roadmap tests this plan must meet (`ROADMAP.md` P2 and P3, Rex 2026-10-30): P2 (1) a human standing one minute
and a falling body conserve energy within 0.1 %; (2) a timber beam's deflection matches Euler–Bernoulli within
5 % and a wall fails at its tabulated load; (3) a hull floats at its Archimedes draught; (4) the weather
generator reproduces a station's monthly normals (mean, variance, rain days) within 10 % over 30 simulated years;
(5) visibility falls with illuminance as the source curve. P3 (1) food in = tissue + heat + CO₂ + water + faeces
+ urine, mass balanced within 1 % over a week; (2) 1,000 simulated lives from birth reproduce a source life table
(survival at 1, 5, 20, 50, 70 within 15 %); (3) a crop's yield responds to rain and soil as in the source trials;
(4) no ageing effect exists outside organ capacity. P2 also lists structural mechanics per wall and roof type,
solar geometry and seasons, oceans and currents, hydrology, soils, geography and routes, a world energy ledger
and acoustics; P3 adds reproduction, pregnancy, growth, homeostasis loops, fever, hunger and appetite, one sleep
pressure (DUP-12), crops as plants and pathogen transmission. Those land in the phases below as sub-steps when
Rex picks the order; they are not planned in detail here.

## Phase 6: mechanics

**Scope.** Gravity, force, momentum, rigid bodies with mass, centre of mass and inertia; ground contact with
Coulomb friction; collisions (impulse, restitution); fluid forces as an interface that Phase 7 fills (buoyancy,
drag). Articulated bodies (joints, locomotion, balance) come after the rigid foundation stands.
**Exists.** `src/physics.ts` constants and gas laws; `World.conserve` for mass, water and heat; `anatomy.json`
organs and `species`; `muscular.json` `limb_strength` and `groups`; `physiology.json` `met`.
**Missing.** Everything mechanical: `src/mechanics.ts`, segment masses and inertia from an opened anthropometric
table (de Leva 1996 or Winter 2009; null where not opened), momentum and energy conservation checks, contact.
**Acceptance.** `examples/standing.ts`: a human stands one simulated minute on level ground, net force at the feet
zero within the solver's tolerance, momentum and energy ledgers closing; a dropped 1 kg mass from 2 m hits the
ground with the cited velocity and its impulse appears in the ledger; the horse stands by configuration.
`grep` finds no `strength` scalar in `src/`.

## Phase 7: fluid dynamics (needs 6)

**Scope.** Hydrostatics, buoyancy, drag, flow through openings and pipes, open-channel and tidal flow at the
level a game needs (a cask, a bilge, a river, a hull); wind load as drag.
**Exists.** `gasdynamics.json` box model and `roomAirProcess`; `evaporationProcess`, `boilingProcess`,
`condensationProcess`; `airDensity`, `waterVapourPressure`.
**Missing.** Liquid flow, buoyancy and drag coefficients (opened tables by shape and Reynolds number), free
surfaces, water as a place quantity with level and quality slots for Phase 11.
**Acceptance.** A cask drains through a tap at the Torricelli rate with a cited discharge coefficient; a floating
body displaces its own weight; a body in a current feels the cited drag; mass and energy ledgers close.

## Phase 8: optics (independent)

**Scope.** Light sources with cited intensity (sun by altitude and cloud, moon by phase, a candle, a lantern),
inverse-square propagation, reflection and absorption by material albedo, attenuation in air and water,
visibility as a threshold at the observer from a cited contrast table. Darkness is the absence of light reaching
the observer; supernatural darkness is a `fiction` mechanism with its own row, never a modifier on real light.
**Exists.** `physiology.json` `circadian`; `environment.json` exposure by terrain and season.
**Missing.** `src/optics.ts`, a light-source table, albedo on materials, an observer threshold table.
**Acceptance.** A candle in a room: illuminance at 1 m and 4 m matches inverse square from the cited candela; a
moonless overcast night versus full moon gives the cited lux; an observer sees or does not see a target at a
cited contrast and distance; the sun's path by date and latitude matches an almanac row.

## Phase 9: materials (needs 6)

**Scope.** Deformation (elastic and plastic), fracture under load, corrosion, rot and decay of organic
materials; wear generalised from `wearProcess`.
**Exists.** `data/materials.json` properties (cp, density, strength slots where present), `equipment.json`
`wear`, `wearProcess`, `BRICK_WALL`, `substances.json` with CIAAW weights.
**Missing.** Stress-strain and breaking loads by material (opened tables), corrosion rates by environment
(sea air, immersion), timber decay classes, a mass-conserving rust reaction in `chemistry.json`.
**Acceptance.** A rope fails at its cited breaking load and not below; a wrought-iron fitting in sea air loses
mass at the cited rate per year with the oxygen and water accounted; a beam deflects by the cited formula; the
ledger closes through rust and rot.

## Phase 10: metabolism as flux (reads nutrition, physiology, circulation, muscular)

**Scope.** Digestion kinetics (gastric emptying, transit), absorption by nutrient, substrate oxidation as a rate
limited by delivery (circulation) and organ capacity (anatomy), cellular energy as a flux: ATP availability is a
rate, never a stored pool; demand above supply shows as fatigue through `muscular` and as hypoglycaemia through
`circulation`; heat already follows from `metabolicHeat`.
**Exists.** `nutrition.json` `absorption`, `depletion`, body composition pools (glycogen and fat are stores and
stay so); `physiology.json` `met`, `pal`; `muscular.json` `fatigue_rates` (three-compartment); `circulation`
delivery failures; `metabolicHeat`, `restingMetabolicRate`.
**Missing.** A gut with transit time, substrate oxidation rates by intensity (opened crossover-concept tables),
a capacity cap per organ, the removal of any direct "energy available" stock; the human-week checkpoint re-run.
**Acceptance.** A meal appears as absorbed substrate over the cited transit curve; energy in equals heat plus
work plus change in stores every day; a sprint whose ATP demand exceeds supply ends in fatigue by the muscular
rates with no fatigue constant added; `grep` finds no `atp` quantity stored on a body.

## Phase 11: waste, sanitation, decomposition (needs 10; reads 7 and 9)

**Scope.** Faeces, urine, CO₂ and sweat as traced outputs with mass and composition; where they go (a latrine,
the street, the sea); sanitation as a place state; water quality from contamination; disease exposure from
water quality and from exposure rows; decomposition of bodies and organic matter with mass conserved to gas,
water and soil; soil nutrients as the ecology module's input.
**Exists.** Body CO₂ to the room (`bodyProcess`); sweat (2540); the urine load search (2556, null); `ecology.json`
`soil` and `depletion_rules`; `medicine.json` `exposure` and `environment.json` exposure by terrain; `crisis.ts`.
**Missing.** Faeces mass and composition rows, excretion routed to a place, a sanitation state, a water-quality
quantity and its link to the dysentery and typhoid exposure rows, decomposition stages with cited rates, the
soil nutrient return. Settlement and Economy consume these (cemeteries, waste management) through interfaces.
**Acceptance.** Twelve settlers' thirty days of excreta match cited per-person masses and land in the declared
place; a fouled well raises the waterborne exposure rows by the cited relation and a case opens a crisis; a
buried body loses mass over cited stages with the ledger closing to soil, water and gas; sweat, urine and faeces
appear in the body's water and nutrient ledgers.

## Phase 12: genes and ageing through organ capacity (needs 10; reads anatomy, neurology)

**Scope.** A genotype as a set of cited variants acting on named parameters: enzyme activity (alcohol
dehydrogenase and aldehyde dehydrogenase variants in the neurology `pk`, lactase persistence in absorption),
organ capacity (VO₂max ceiling through circulation and muscular), regulation set points. Ageing as cited
time-dependent decline of those same capacities. Never a global modifier: no "age penalty" and no "talent"
scalar in `src/`. Inheritance between parents is configuration; evolution is out of scope (Rex).
**Exists.** `physiology.json` `ageing`; `anatomy.json` organs with capacity slots; `neurology.json` `pk`;
`population.json` cohorts.
**Missing.** A variants table (opened sources), parameter hooks on each module, ageing curves per capacity,
the organism framework's species file carrying them so a horse's are configuration.
**Acceptance.** Two humans differing only in a cited enzyme variant clear alcohol at the cited rates through the
existing pk model; a 70-year-old and a 25-year-old differ in work capacity only through the cited VO₂max and
muscle-mass declines; `grep` finds no age or talent scalar applied outside a capacity.

## Phase 13: weather and climate (needs 7 and 8's solar geometry; a major P2 subsystem, Rex 2026-10-30)

**Scope.** Weather generated from physics, never drawn from a table: solar heating by latitude, date and hour,
and the planet's rotation; pressure gradients and wind; humidity and condensation; instability and convection;
ocean evaporation; terrain and orographic rain; circulation; surface water and soil moisture. Climate is the
statistics of the generated weather. It replaces the pirate game's daily Markov chain
(`web/src/world/adapters/places.ts` `weatherState`, `world/ENVIRONMENT.md` §2; DUP-34, with the monthly climate
table DUP-35), which becomes a read of this phase's outputs by place.
**Exists.** `atmosphere.json` baseline, altitude and modifiers; `gasdynamics.json` box model; `physics.ts`
`waterVapourPressure`, `airDensity`, `surfaceEvaporationKgPerS`, latent heat; `environment.json` exposure by
season; `environmentProcess` (REGISTRY `realism.env.place_process`); `physiology.json` `wbgt_limits`.
**Missing.** `src/weather.ts`: a solar-geometry function (declination, hour angle, irradiance at the top of the
atmosphere from cited constants), a surface energy balance per place, a column or cell model for pressure,
wind and moisture, precipitation from condensation, a station-normals table opened for the acceptance station
(a Caribbean station for the pirate window, a second station for independence), terrain inputs.
**Acceptance.** ROADMAP P2 test 4: thirty simulated years at one station reproduce its monthly normals (mean
temperature, variance, rain days) within 10 %; the diurnal curve follows the solar input; the water and energy
ledgers close (evaporation out equals precipitation plus storage change over the run); a second station by
configuration; `grep` finds no transition matrix or state table in `src/`.

## Proposed build order (for Rex to pick; mechanics first as he set)

1. **6 mechanics**: the foundation Rex named first; everything physical hangs on it.
2. **10 metabolism as flux**: the largest correction to modules that already run, and 11 and 12 depend on it;
   doing it early keeps the checkpoints from drifting twice.
3. **11 waste, sanitation, decomposition**: Settlement and Economy have asks waiting on it (cemeteries, waste
   management, water); it closes the body's ledgers to the place.
4. **7 fluids** and **9 materials**: both need 6 only; 11's water and decay read them, so they come before 11 if
   Rex prefers completeness over the Settlement asks.
5. **12 genes and ageing**: needs 10 and the organism framework; the bestiary keeper's species content lands here.
6. **8 optics**: independent and self-contained, unless combat's visibility rules need it sooner.
7. **13 weather and climate**: after 7 (evaporation, flow) and 8's solar geometry; the pirate plugin's Markov
   chain keeps running until this phase's acceptance test passes, then becomes a read.

All of it after P0 Kernel and P1 overlap closure, which are not this keeper's to schedule.

## For the Kernel keeper (P0): what realism's time, ids and randomness do today, from the code

- **Time and scheduling:** `src/scheduler.ts` holds `Process { step(world, dt) }` and `Scheduler.run(world,
  seconds, dt)`: a fixed step, every process stepped in the order it was added, `dt` the seconds since that
  process last ran. No priorities, no event queue, no declared cross-process order beyond insertion (DUP-33).
  `World` (`src/world.ts`) holds the registry, the graph, the trace, the clock and the conservation ledger the
  trace checks each step. Hosts choose the step (the settlement runs the body at 60 s).
- **Ids:** strings. Components are named by the host (`"settler-4"`), library rows by their `id` column
  (`data/library/*.json`), substances by `id` in `data/substances.json`; outputs are keyed by library id
  (`outputs["sleep_debt"]`). No id generator, no namespace rule beyond the file a row lives in.
- **Randomness:** `rng(seed)` in `src/process.ts`, mulberry32, one stream per caller that asks for one (control
  noise, thermometer noise, medicine seeds); no per-mechanism stream registry (DUP-32). No `Math.random` in
  `src/`.
- **Units:** SI in code (kg, J, Pa, K or °C by name); the library's columns carry units in their headers; no
  dimensional validation.
- **Replay and snapshots:** the trace records every transfer (`src/trace.ts`, running sums since 2569) and the
  settlement renews it daily (REAL-10: it grows without bound); there is no snapshot or reducer. A seeded run
  is reproducible by re-running.

Costs follow `PHASES-4-5.md`'s pattern: each phase is a belt chain of small Sonnet tasks with a checkpoint, about
the size of Phase 4's (26 tasks, about 46 dollars) for 6, 10 and 11, smaller for the rest.
