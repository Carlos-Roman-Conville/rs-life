# Phases 6 and on: "every facet of life except evolution" (scope by Rex, 2026-10-30)

Rex widened the Reality & Species engine on 2026-10-30 (his words plus a ChatGPT paste he agrees with; the table
is in `Toolchain/ENGINES.md`, "Scope added 2026-10-30"): mechanics, optics, fluid dynamics, materials, the full
lifecycle from digestion to decomposition, and genetics, cellular state and ageing. Two rules of his
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
                       └─ 12 genetics, cellular state and ageing│
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

**Interfaces read by combat (requested 2026-10-30, CMB-13; proposed).** Rex decided on 2026-10-30 that turns resolve
simultaneously and space is computed (COMBAT.md sections 1 and 2, pirate commit 5179b59). Mechanics publishes these per
body, as of the current moment, with wounds and fatigue already applied through the per-limb state, never as a combat
formula:

| Output (proposed id) | Unit | Comes from | Needs |
|---|---|---|---|
| `mechanics.reach` per arm, with the held item | m | segment lengths from the anthropometric table plus the item's length; joint range from the same table | phase 6 segments; phase 9 for the item |
| `mechanics.strike_time` per arm and strike | s | the swing of the arm-and-item chain: segment and item mass, inertia and lengths, driven by the limb's force available today (muscular) | phase 6 articulated chain; muscular force per limb |
| `mechanics.ground_speed` | m/s | gait from leg length and mass (a cited walk and run relation, Froude-number scaling where the source gives it), on the current footing's friction | phase 6 contact and locomotion; phase 9 surfaces |
| `neurology.reaction_latency` per limb | s | a cited human simple and choice reaction time, raised by alertness, fatigue and drink; neurology owns it, not mechanics | neurology; the mapping from the STATS Reflexes attribute to latency is the game's (Rex) |
| `mechanics.contact_event` per contact | the contact point on the weapon or limb (distance along it, m: tip, middle, base, knuckles), the body part and point reached, relative velocity (m/s), direction, duration (s), impulse (N s), energy transferred (J), penetration depth (m, a range), weapon-on-weapon contacts, and the outcome class (miss, graze, clothing, shallow skin, substantial, armour deflection) read from medicine's wound rows | phase 6b's continuous collision over the turn interval | phase 6b; materials report deformation and penetration, anatomy and medicine the wound |

Combat owns every rule that uses them: who lands first, the Intuition/Ti dodge, the steady-ground bonus and the
off-balance debuff, and the sub-cubes per turn; combat reads the contact event, never a damage number. A value whose source is not opened is `null` and flagged, as everywhere.

**Validation (PLATFORM.md 11a).** Independent data: standing ground-reaction force equals body weight on
force-plate records; walking and running speeds against measured gait norms (for example Bohannon 2011) and Froude
scaling across leg lengths (Alexander 1989), so the horse checks against the human with no new constant. Integration:
mechanics with muscular (force available today) and physiology (the energy of work).

## Phase 6b: contact and impact mechanics (needs 6; reads 9, anatomy, medicine) (Rex, 2026-10-30)

**Scope.** A reusable subsystem that answers how much of a moving body or held object reaches another, for a sword's
tip or middle, a punch's knuckles or a graze, a fall, a construction accident, an animal's bite or a machine. Never a
weapon damage formula. (1) Rigid-body geometry and articulated limbs from phase 6: segment lengths and joints,
weapon length, stance and trajectory. (2) Continuous collision detection over the simultaneous-turn interval, so a
fast strike never tunnels through a target and a dodging defender gives a continuous result: miss, graze, shallow
contact, full contact or deflection. (3) Per-point velocity along a rotating limb or blade, v = omega x r, the
effective mass at the contact point, and edge alignment. (4) Impact impulse and energy, E = 1/2 m_eff v_rel^2.
(5) A simplified penetration model: the energy dissipated against a resistance profile F_resist(x) up to a depth d,
with materials (phase 9) owning deformation and the tissues owning their response.
**Input from the host (CMB-14).** Each strike enters as an intended target point and trajectory plus a precision term:
the spread of the actual trajectory around the intended one (m at the target, or rad), from which the contact point
follows. How attacker skill sets that spread (Swordsmanship finding weak points, Spatial Reasoning as aim) is combat's
rule and Rex's to decide; the engine takes the spread as an input and adds no skill formula.
**Layers.** Physics reports a contact event (position, relative velocity, direction, duration, impulse); materials
report deformation and a penetration estimate; anatomy and medicine turn that into tissue damage, wound geometry,
bleeding and loss of function. Combat reads the contact event and the wound, never a damage number.
**Exists.** Nothing mechanical (phase 6 is unbuilt); medicine's wounds and circulation's bleeding take a wound as input.
**Missing.** `src/contact.ts`; resistance profiles of skin, muscle, bone, cloth and leather from opened sources (null
and flagged where none opens); the wound-from-contact mapping in medicine.
**Acceptance (validation scenarios, Rex).** A sword contacting at different blade positions gives tip and middle
contacts with the energies v = omega x r predicts; a punch at different angles gives the impulse its effective mass and
angle predict; a moving defender produces a graze, not a full hit, for the same swing; wound depth is reported as a
range with its uncertainty, since tissue models need empirical calibration.
**Validation (PLATFORM.md 11a).** Impact force and impulse against measured strike data (punch force by instrumented
targets, cutting tests on tissue simulants), penetration against ballistic gelatin and tissue studies; each a cited
range, never a fitted constant. Integration: contact with mechanics (the swing), materials (the blade and the armour),
anatomy and medicine (the wound), circulation (the bleeding).

## Phase 7: fluid dynamics (needs 6)

**Scope.** Hydrostatics, buoyancy, drag, flow through openings and pipes, open-channel and tidal flow at the
level a game needs (a cask, a bilge, a river, a hull); wind load as drag.
**Exists.** `gasdynamics.json` box model and `roomAirProcess`; `evaporationProcess`, `boilingProcess`,
`condensationProcess`; `airDensity`, `waterVapourPressure`.
**Missing.** Liquid flow, buoyancy and drag coefficients (opened tables by shape and Reynolds number), free
surfaces, water as a place quantity with level and quality slots for Phase 11.
**Acceptance.** A cask drains through a tap at the Torricelli rate with a cited discharge coefficient; a floating
body displaces its own weight; a body in a current feels the cited drag; mass and energy ledgers close.

**Validation (PLATFORM.md 11a).** Drag on a sphere and a flat plate against the standard drag curve; a hull's
resistance against towing-tank data or the Holtrop-Mennen regression; buoyancy against Archimedes exactly. Integration:
fluids with mechanics (forces) and atmosphere (ventilation of a room).

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

**Validation (PLATFORM.md 11a).** Solar irradiance and illuminance against a clear-sky model and station
measurements (NREL's solar position and irradiance data); visual detection against measured acuity by luminance.
Integration: optics with environment (daylight, heat load) and neurology (vision).

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

**Validation (PLATFORM.md 11a).** Stiffness, strength and fatigue of oak, pine, hemp rope, wrought iron and
bronze against handbook values (the Wood Handbook, ASM); failure of a loaded member against the handbook's design
curves. Integration: materials with mechanics (load paths) and decomposition (rot weakening timber).

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

**Validation (PLATFORM.md 11a).** Total energy expenditure against doubly labelled water studies; substrate
use and respiratory quotient against indirect calorimetry at rest and in work; the ATP flux at rest against the
resting rate the library cites. Integration: metabolism with nutrition, physiology, circulation and muscular together.

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

**Validation (PLATFORM.md 11a).** Decomposition stages against accumulated degree-day data (for example
Megyesi 2005); faecal bacteria die-off in water against measured T90 values; latrine and well contamination against
sanitation studies. Integration: waste with medicine (exposure) and water quality.

## Phase 12: genetics, cellular state and ageing (needs 10; reads anatomy, muscular, neurology, medicine)

**Resolution (Rex, 2026-10-30; `Toolchain/ENGINES.md`, "Resolution of the biology").** Cells and DNA are compact
mathematical representations that keep their causal effects, never their real form. Each organism has three separate
records, and a character sheet (`STATS.md`) is a view of them, never a second source of numbers:
1. **Genetic profile** (stable): chromosome segments carrying trait-associated variants, with linkage, polygenic
   effects, dominance and interactions. Never trait sliders and never an average of the parents. Inheritance is
   recombination of segments (configuration of the cross); evolution stays out of scope.
2. **Cellular and developmental state**, per representative tissue population (muscle, bone, liver, vessel wall,
   neurons, skin, blood-forming tissue): repair capacity, accumulated damage `D(t+1) = D(t) + damage - repair`,
   regeneration and adaptation. Damage comes from the existing modules' insults (anatomy's organ insults, wounds,
   alcohol through neurology's pk, heat, starvation, infection); repair capacity is set by the genetic profile and
   by the state itself.
3. **Organism state**: what realism already models (anatomy, organs, muscles, nutrient pools, immunity, capacities).
   Organ and muscle capacity are read from the tissue states, so ageing emerges from accumulated damage and falling
   repair, never from a birthday subtraction or an age scalar.

**Growth as a mechanism, not a stat.** A trait like muscular growth is `dM = f(G, T, N, H, R)`: genetics, training
stimulus (muscular's tension and aerobic signals), nutrition (protein and energy gates), hormones and development,
and recovery (sleep, the conversion window). Nobody inherits a Strength score.

**Resolution by distance.** Named characters carry tissue-level state; distant populations carry aggregate genetic
and health distributions (population cohorts), with the aggregation interface documented and tested as in P1
refinement B (the aggregate refines, never contradicts).

**Phenotype record (Rex, 2026-10-30; `Toolchain/ENGINES.md`, "Attraction and partner selection").** Every perceptible
feature of a body, as observable characteristics that emerge from the genetic profile, development, nutrition, age,
health and environment, never set by hand and never a score. Reality never computes an attractiveness: Cognition
evaluates perceived features per observer. The body stores only characteristics meaningful in their own right, ones that
already serve development, health, performance, recognition or resemblance; it never manufactures a feature solely
because the attraction model wants it (Rex, 2026-10-30), which keeps the one-mechanism rule. The same record serves recognition, medical assessment, clothing and
equipment fit, performance and inherited resemblance. Its parts, with what exists today:

| Part | Features | Exists today | Sources to open (null and flagged until opened) |
|---|---|---|---|
| Facial geometry | eye spacing and shape, jaw shape, facial proportions, symmetry | nothing | facial anthropometry (Farkas 1994); heritability of face shape from twin and genome studies |
| Body structure | height, skeletal frame, limb proportions | `height_cm` and mass as body props; segment lengths come with phase 6's anthropometric table | de Leva 1996 or Winter 2009 segments; CAESAR or NHANES anthropometric surveys; height heritability (Polderman 2015 twin meta-analysis) |
| Body composition | muscle per group, fat and its distribution | `muscular.json` 31 groups (contractile index, not mass), `fat_kg`; fat distribution nothing | DXA reference data by age and sex; muscle mass by group from imaging studies |
| Surface | skin colour and texture, hair colour, form and loss, eye colour | nothing | skin reflectance spectrophotometry (melanin index); pigmentation genetics (for example HIrisPlex-S) |
| Movement | posture, gait, coordination | nothing (phase 6 gait, neurology coordination outputs) | gait norms (Bohannon 2011); postural sway data |
| Voice | pitch, resonance, roughness | nothing | fundamental frequency norms by sex and age; vocal-tract length from height |
| Scent | body odour profile | nothing | human odour chemistry studies; MHC and odour studies, a labelled hypothesis where contested |
| Expression | the face's range and resting set | nothing (neurology mood is a state, not a face) | facial action coding (FACS) as the vocabulary |

Each feature is a function of the three records above (genotype, tissue state, organism state) and of time: a feature
changes as the tissue ages, scars or is fed, never as a separate counter. Features are stated with their own units
(cm, a colour coordinate, Hz) and uncertainty; a named character carries the full record, a distant population its
distributions. Validation: the emergent distributions of a simulated population fall inside the opened survey ranges by
age and sex, and siblings resemble each other by the cited heritabilities, not by averaging.

**Exists.** `physiology.json` `ageing` (a birthday-indexed curve, to become a check against the emergent decline, not a
driver); `anatomy.json` organs with damage, repair and capacity slots; `muscular.ts` adaptation with an age gate;
`neurology.json` `pk`; `population.json` cohorts.
**Missing.** The three records as data and code (`src/genetics.ts`, `src/tissue.ts`); a variants table from opened
sources (for example alcohol and aldehyde dehydrogenase variants, lactase persistence, ACTN3); per-tissue damage and
repair rates from opened sources, `null` and flagged where none is opened (the ageing rates are a named hypothesis
where the science is thin, tested by its consequences); the muscular growth function reading the five inputs; the
species file carrying a horse's tissues by configuration.
**Acceptance (Rex's executable demonstration: an organism ageing under different conditions).** One human genome
lived three ways from age 20 to 70 (sedentary, hard labour, heavy drinking) gives three different trajectories of
tissue damage, organ capacity and work capacity, each emerging from the tissue states. The emergent declines fall
inside the cited population ranges of the `ageing` table, and the drinker's liver capacity falls fastest. Two humans
differing only in one cited enzyme variant clear alcohol at the cited rates through the existing pk. Two siblings from
one cross differ by recombination, not by averaging. `grep` finds no age or talent scalar in `src/` acting outside a
tissue state.

**Validation (PLATFORM.md 11a).** VO2max and muscle-mass decline against longitudinal studies (for example
Fleg 2005); alcohol clearance by ALDH2 genotype against pharmacokinetic studies; tissue damage and repair rates against
cited cell-biology data where they exist, and labelled hypotheses tested by their consequences where they do not.
Integration: genetics and tissue state with anatomy, muscular, neurology and medicine.

**Where it meets P1 (DUP-17, batch 2).** DUP-17 is age effects in four unlinked places (the physiology ageing table
no code reads, medicine's healing by age, muscular's age gate, neurology's dopamine decline) plus the game's ageing.
Its planned owner is this phase. Closing it in P1 names one interim owner that the four effects read, without adding a
birthday-driven curve as a new authority: the interim reads stay labelled interim and are replaced, read for read, by
the tissue states when this phase lands. The P1 closure test is therefore "one owner, four reads, no fifth age
effect"; this phase's test is the demonstration above.

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

**Validation (PLATFORM.md 11a).** Against independent station records (for example GHCN daily), never one
universal tolerance: monthly normals, rainfall frequency, dry-spell duration, temperature variability, wind
distributions, seasonal patterns and extreme-event frequency, each with its own tolerance (Rex, 2026-10-30).
Integration: weather with environment, ecology (yield) and the ship (wind).

**Every phase, every mechanism (PLATFORM.md 11a).** Each mechanism carries its sources and model; inputs,
outputs, units, assumptions and applicability; verification tests; validation against independent data with
tolerances; stability, conservation and boundary tests; integration tests with what it reads and feeds; and a report of
accuracy, uncertainty and open questions. The registry records it as implemented, integrated and validated, three
states never conflated. The owner's own tests are not independence: reference data the code was not built from, a
check unit that did not write the code, and the registry keeper's re-audit stand apart. A change to a scientific model
or an architectural assumption is recorded and reviewed before it becomes authoritative.

## Proposed build order (for Rex to pick; mechanics first as he set)

1. **6 mechanics**: the foundation Rex named first; everything physical hangs on it, then 6b contact and impact (it needs 6's bodies and joints, and reads 9's materials when they exist).
2. **10 metabolism as flux**: the largest correction to modules that already run, and 11 and 12 depend on it;
   doing it early keeps the checkpoints from drifting twice.
3. **11 waste, sanitation, decomposition**: Settlement and Economy have asks waiting on it (cemeteries, waste
   management, water); it closes the body's ledgers to the place.
4. **7 fluids** and **9 materials**: both need 6 only; 11's water and decay read them, so they come before 11 if
   Rex prefers completeness over the Settlement asks.
5. **12 genetics, cellular state and ageing**: needs 10 and the organism framework; the bestiary keeper's species content lands here.
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
