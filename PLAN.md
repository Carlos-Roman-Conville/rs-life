# PLAN.md: Reality (`Toolchain/realism`, physical side; mechanics in `Toolchain/reality/` when it exists)

Draft by the Reality & Species keeper, 2026-11-02, to `HQ/handoffs/PLAN-SPEC.md`. Not approved. HQ is not a repo.
This file is meant to be the one authoritative plan for the physical engine. `realism/PHASES-6-PLUS.md`, `README.md`,
`SPLIT.md`, `PHASES-4-5.md` and `research/CG-*.md` stay as reference and are cited by section.

## Pass 1 (one page)

**Amended 2026-11-02 after the registry's map** (`HQ/handoffs/registry/INTEGRATION-PLAN.md`; controller rulings, Rex may
override):
- **M2-04b.** Reality owns task demand: force, power and the duration profile of a task. Life computes effort as demand
  divided by capacity. Recipes name task kinds (Economy), and Settlement's S2-a record says who did them.
- **NP-3.** Reality owns the weather-input contract: the port schema on place state. Catalogue supplies the sourced
  England 1270 series. The M1a world is England 1270 with cereals (REG-38).
- **§2a.** `world.position` is Reality's, and Reality owns the `move` and `gather` acts; Life supplies the body side.
- **REAL-42.** Mechanics lives in `realism/src/mechanics/` until SPLIT step 4.
- **U-1.** Soil pools are kg per whole cell, not kg ha⁻¹ (corrected below).

**Boundary.** Reality covers whatever would still hold in a world with nothing alive in it (SPLIT §1). Life (its own
keeper and its own PLAN) owns organisms: physiology, nutrition, muscle, neurology, medicine, ecology stocks, plants,
locomotion energy and speed, `body.capacity_functional` and fatigue. The code for both still sits in `realism/`, and I
am that repo's only committer until SPLIT §5 step 4 moves it.

**Mechanisms built (physical).** Every gram and joule in these is traced:
- Heat transfer, combustion, walls and the condenser: `src/process.ts`, README:47-74.
- Phase change: boiling, evaporation, condensation.
- Gases: ideal gas, the room box, and the transport grid (`src/atmosphere.ts`, Reality half).
- Reactions with Arrhenius rates and the element ledger: `src/reactions.ts`, `src/elements.ts`, `world.conserveElements`.
- Place conditions (WBGT, diurnal curve, sun hours): `src/environment.ts`.
- The soil N/P/K ledger through kernel `transfer()`: `src/soils.ts` (3001, 3021).
- Wear: `wearProcess`.
- The substrate: registry, graph, world, trace and scheduler.

**Missing.** None of the mechanics exists: no `src/mechanics.ts` and no `Toolchain/reality/`. That means no position or
displacement quantity (CHAINS 1.7 "no id"), no rigid bodies, contact, articulated body, ropes, beams or buoyancy, no
fluids, optics or material strength, and no physical weather (the pirate Markov chain still runs, REAL-13). The terrain
surface factor η is research only (CG-5). There is no whole-world energy ledger (README:73-74): energy is traced into
sinks that have no store (`metabolism`, `work`, `sweat-latent`, `breath-latent`, `food`; physiology.ts:404-407, 461-462).

**Quantities owned.**
- Today: substance contents (kg), component temperature and enthalpy (K, J), room gas fractions, place conditions, soil
  nutrient pools (kg per whole cell, the cell carrying `areaM2`; `soils.ts:24-27`) and element masses.
- Planned: `world.position` (m, per body or object), grade per move (computed, never stored), `world.terrain_factor` η,
  forces, torques and mechanical power as **demand**, external work, and contact events.

**External inputs.** The host supplies place weather and geometry. Life supplies body heat and gas flows. The host also
supplies `work_w`, external work in W (physiology.ts:9, :401); nothing produces it today.

**Outputs.** Air composition, place conditions, heat exchange and soil pools. Planned: mechanical demand,
`world.position`, ΔPE and work transfers, and `realism.contact.contact_event`.

**Contribution to M1a.** The substrate does it: a food item is a registry content, it moves once through a traced
transfer, and the conservation check catches a second debit. "Within reach" means the same place or a graph edge. No
geometry is needed for M1a. `world.position` is Reality's (registry INTEGRATION-PLAN §2a; closes REAL-40).

**Contribution to M1b (walking model first, no articulated mechanics).** Reality supplies:
- distance per move;
- signed grade, `(h_b − h_a)/d`, from `world.elevation`;
- η from the CG-5 class table, kept as a range where the sources disagree;
- position integration;
- external work `(m_body + m_load)·g·Δh`, written as one transfer.

Life then computes Pandolf metabolic power M, speed V and the fatigue that follows. **Effort has no producer today**
(confirmed: `muscular.ts:57-63` takes `effort` as an argument, and `physiology.ts:156` `metOf` takes its MET from the host
schedule). Planned: Life's capacity module produces effort as demand (from Reality) divided by capacity (Life's own).

**Defects and risks found.**
- **REAL-36, confirmed.** `ecology.ts:62-69`. With B = 1000, K = 1, r = 1 per year and a requested catch of 5:
  - growth comes out at −2737, so the available stock is −1737;
  - the returned catch is −1737;
  - the stock is traced as giving 2737 to the environment while it held 1000;
  - the balance check still passes.
  Fix at the source: the exact logistic step keeps B ≥ 0.
- **REAL-37, risk.** A negative `work_w` puts heat into the body that no transfer records, and positive work goes to a
  `work` sink that has no receiver.
- **REAL-35, open.** The range of alertness (defined in §1.4 below).
- **REAL-38 and REAL-39.** Wording proposals for PHASES-6-PLUS:68 and :115, for Rex.

**Assumptions flagged.**
- Level walking does no net external work; Pandolf's M becomes heat.
- On a descent, the potential energy lost is dissipated as heat in the body.
- Eta multiplies only Pandolf's speed term (CG-5 E1).
- The Santee downhill term and Minetti's walking polynomial are unread (CG-5 E2, E3), so a descent costs as level
  ground until they are read.

**Next task once dependencies are ready (after approval):** a Composer unit for the η class table (data, with ranges and
sources), then a Codex unit for the REAL-36 exact logistic step, which the Life keeper co-signs. Both are queued on the
`realism` lane.

---

## Pass 2: the full plan

Every claim below that rests on code cites `file:line` in `Toolchain/realism` as of HEAD 966121c. "Confirmed" means
reproduced or read in the code; "risk" means a reading the code allows but no run has shown.

## 1. Purpose and boundaries

### 1.1 What Reality determines

The state of the non-living world and the physical consequences of anything that acts on it:
- matter and its location;
- heat and temperature;
- gases and air;
- chemical change;
- place conditions;
- soil as a physical and chemical store;
- forces and the motion they cause;
- contact;
- (planned) fluids, light, material strength and weather.

It answers questions of the kind "what does this act demand and what does it physically change". The question "can this
body supply it" is Life's.

### 1.2 What it receives

| From | What | Today |
|---|---|---|
| Host or scenario | place weather (air temperature, humidity, wind, sun), geometry, component layout | host-supplied (README:196-206); weather physics is phase 13 |
| Life | body heat out, gas exchange, sweat and breath water, excreta, decomposition products | built for heat and gases (SPLIT §4 ports); excreta and decomposition planned |
| Life | the speed chosen within capacity, the posture or gait being executed, body mass | none (M1b, M2) |
| Cognition (through CG-16 resolution) | the intention: destination, path, object to move | none; `shared.action.resolution` agreed (Life DESIGN §CG-16) |
| Economy | the mass and identity of a carried or moved item (`takeMass`) | Economy side built; Reality reads only mass and geometry |

### 1.3 What Reality never calculates

| Not Reality's | Owner | Reality's side of the line |
|---|---|---|
| Metabolic cost (Pandolf, MET), substrate use, heat production in tissue | Life (physiology) | Reality supplies external work W_ext and the terrain, never M |
| Locomotion speed, gait choice within capacity, population movement | Life (CG-5, agreed 2026-11-01) | Reality integrates position from the speed Life gives |
| Muscle force capacity, effort, local and systemic fatigue | Life (muscular, `body.capacity_functional`, DUP-15) | Reality supplies demand: force, joint torque, mechanical power |
| Wounds, bleeding, tissue response | Life (medicine, anatomy, circulation) | Reality supplies the contact event and a penetration range |
| Ecology stocks, plants, food web, decomposition biology | Life (SPLIT §2 `ecology.ts`; Life DESIGN) | Reality owns the soil stock that Life's uptake and litter fluxes debit and credit (CG-3, CG-22) |
| Alertness, arousal, sleep pressure | Life (physiology, neurology; registry note on `realism.physiology.alertness`) | none; REAL-35 sits in my log because the code is in my repo |
| Whether an act succeeds | the resolver of the owning engine (CG-16) | Reality reports whether the physical precondition holds (path exists, load within the rope's breaking load) |
| Combat rules (who lands first, dodges) | the pirate plugin (PHASES-6-PLUS:86) | contact events only |
| Prices, ownership, inventory counts | Economy | mass and location only |

Until SPLIT §5 step 4 runs, Life's modules (physiology, nutrition, muscular, neurology, medicine, ecology, population,
crisis) sit in `realism/` and are committed by this keeper's lane. A Life-module unit is drafted from Life's plan and
co-signed by the Life keeper; I do not design inside Life's boundary.

### 1.4 REAL-35: what alertness means, its consumers, and the options for Rex

**Definition (proposed).** Alertness is a **bounded relative multiplier in [0, 1]**:
- It is a body's capacity on attention-limited and vigilance-limited tasks, relative to the same body rested and at its
  circadian peak.
- 1 means rested and at the circadian peak.
- 0 means the body cannot sustain wakefulness.

Today's code computes it as `alertness = debtMultiplier × circadianFactor` (`src/physiology.ts:496`). The debt multiplier
runs 0.55 to 1 (registry `body.alertness_multiplier`) and the circadian factor is at most 1, so the product is a multiplier
of this kind.

Under this definition it is **not** neurology's arousal. Arousal (`neurology.circuits.arousal`, 0 to 2, 1 normal, over 1.5
agitation) is a level centred on normal. Arousal above 1 is over-activation, not extra capacity; the inverted-U shapes are
listed as null in `flags/neurology.md`.

**Every consumer today.** No Toolchain engine other than realism reads it: grep of cognition, settlement and economy
`src` finds nothing.

| Consumer | How it reads alertness | Range it assumes |
|---|---|---|
| `src/physiology.ts:496` | writer | 0-1 |
| `kernel.json:54, 75, 77` | process `realism.physiology.alertness` writes port `body.alertness` (and `body.alertness_multiplier`) | registry unit_text "0-1" |
| pirate `web/src/world/adapters/work.ts:136-146` (F-WK-2) | work rate × `min(alertnessCeiling, alertness)` | multiplier, capped |
| pirate `web/src/world/settlement.ts:37, 163` | records ranges, day report | any |
| pirate `settlement.sim.test.ts:85` | max ≤ max(debt) × max(circadian) | ≤ 1 |
| pirate `adapters/stats.test.ts:138`, `work.test.ts` | recorded values (0.82 old, 0.6995 under 2724) | 0-1 |
| kernel harness goldens `realism-human-week.json`, `realism-horse-stable.json`, three `realism-human-wound-*.json` | recorded outputs | 0-1 |
| realism `examples/human-week.ts`, `alertness-step.ts`, `step-convergence.ts`; tests `checkpoint1`, `physiology` | checkpoints | 0-1 |
| registry, documented-only pirate formulas (game `body.json`): `accident_chance` uses `(2 − alertness)`; `agility_today`, `endurance_pool`, `head_attrs_today`, `movement`, `poise_nerve_efficiency`, `reflexes_today`, `work_capacity` multiply by it | 1 = baseline; `(2 − alertness)` turns non-positive at 2 |
| planned `neurology.reaction_latency` (PHASES-6-PLUS:83) | latency raised as alertness falls | 0-1 |

**Decision (Rex, 2026-11-02): option (a), `alertness = min(arousal, 1) × circadian`, under the definition above.** It is
an explicit modelling assumption, not an established formula. The options not taken were (b), range 0 to 2, and (c),
arousal / 2. Rex's conditions, and how the plan meets each:

1. **Two assumptions, labelled.** Both are evidence level 4 (simplified approximation) and both need validation.
   Keeping consumers working is compatibility, not evidence.
   - **A-35a, saturation.** Arousal above normal adds no alertness.
   - **A-35b, multiplicative combination.** Arousal and circadian combine as a product.
   - Needed data: vigilance or PVT performance across sleep deprivation with known clock phase and prior sleep, held out
     from the Process S constants, plus a sourced over-arousal performance curve.
   - The run notes and the gear file state that this does **not** validate any arousal-performance relationship.
2. **Domain asserted, never clamped.**
   - `arousal ≥ 0` and finite, and `0 ≤ circadian ≤ 1`.
   - An out-of-range input throws with the value named.
   - Today's circadian rows lie inside [0, 1] (REAL-35's bound was max circadian = 1). The assertion keeps it that way
     if a row changes.
3. **Uncapped arousal stays its own state.** The circuit output `arousal` (0 to 2) is published unchanged; the cap
   exists only inside the alertness formula. Over-activation (over 1.5: tremor, sleep quality, per the arousal row's
   "Goes to") stays readable by any sourced attention, decision or performance model.
4. **Where sleep pressure and sleep debt enter.** Read from today's code and from 2724's saved patch
   (`.codex-runs/2724-b.patch`), before any re-queue:

| Input | Today (HEAD) | Under 2724-b + (a) | Applied |
|---|---|---|---|
| acute pressure (hours awake) | adenosine tone +0.05 per hour awake (`neurology.ts:165`), so arousal falls; **and** the debt multiplier, separately, in alertness (`physiology.ts:496`) | Process S: `S' = S + (1−S)(1−e^{−Δt/18.18 h})` awake, `S e^{−Δt/4.2 h}` asleep; adenosine tone = 1 + k·S with k = 1.3669 (estimate, calibrated to the old tone at 16 h); arousal reads adenosine at weight −0.3 (`neurology.circuits.arousal`) | once, through arousal |
| circadian phase | the factor in alertness only (`physiology.ts:496`); the arousal circuit reads no clock (its six systems: noradrenaline, orexin, acetylcholine, GABA, adenosine, opioid) | the factor in alertness only (`sampleAlertness`) | once |
| chronic debt (hours below need, 14-night restriction) | the debt multiplier, 1 to 0.55, in alertness. Its table cites Van Dongen 2003 but every row is `proposed`. Neurology's sleep-debt driver (`neurology.ts:174`) is **unsized**, so it moves nothing | **neither input.** The multiplier leaves alertness (the patch: "never of sleep debt"), and the neurology driver stays unsized | **missing connection (REAL-43)** |

   Process S does carry incomplete recovery across nights, but it saturates. My arithmetic on the patch's constants:
   - 8 h nights: end-of-wake S is 0.585, then 0.621 after 2 nights and 0.624 after 14.
   - 4 h nights: 0.667, 0.753 and 0.766.
   - So restriction reaches its steady state in about two nights. Van Dongen 2003, the debt table's own basis, found
     deficits that kept growing over 14 nights (14 nights at 4 h matched 3 nights without sleep).
   - Under (a) with 2724-b, chronic restriction is therefore under-represented. **2724 stays held until REAL-43 has a
     sourced connection.** One candidate is the sleep-debt driver row's sizes; another is a sourced slow homeostatic
     process. The Life keeper designs it and Rex decides if the sources are silent.
   - The debt multiplier is not to be added back beside S: its bands were set against total impairment, so combining
     them would count acute pressure twice.
5. **Double impairment, consumer by consumer** (the §1.4 table):

| Consumer | Finding under (a) |
|---|---|
| `physiology.ts` writer, kernel `body.alertness` | once each; no double |
| kernel port `body.alertness_multiplier` (writer `realism.physiology.sleep_debt`) | **risk:** after 2724 it is a record of the former bands. Any reader that multiplies it with `body.alertness` counts sleep loss twice. Retire the port, or restate it as a record that is not an impairment (REAL-44) |
| pirate `work.ts:146` | alertness × MET-hours fatigue × hydration × skill: distinct quantities. Sleep also gates the MET-hours reset (the recovery table), so sleep loss reaches work by two mechanisms, vigilance and unrecovered exertion. Not a double count of one quantity, but F-WK-2 is a fixture (REAL-9) and must not be calibrated to include sleep loss |
| pirate `settlement.ts`, tests, goldens, realism examples | records only; re-record, no impairment |
| documented pirate formulas (`files/pirate-ship/body/data/body.json`): `reflexes_today`, `agility_today`, `poise_nerve_efficiency` (Nerve); `accident_chance` | **confirmed by the text, double impairment:** where these multiply by alertness, `drinkFactor` is defined as "NEUROLOGY coordination and arousal outputs" (`body.json:109, 145, 163, 181`; Dexterity at :103 does not read alertness). Alertness now contains arousal, so alcohol's lowering of arousal would be applied twice. Restate drinkFactor as coordination only, or drop the arousal part, wherever it multiplies alertness (REAL-44; game wording, through the STATS coordinator) |
| the arousal row's "Goes to": `min(PHYSIOLOGY alertness, arousal)` (Rex-marked, 2026-10-29) | under (a) it is idempotent, since `min(min(a,1)·c, a) = min(a,1)·c` for c ≤ 1, so there is no double count but there are two paths. Proposal for Rex: the head attributes and Reflexes read `alertness` only (REAL-44) |
| planned `neurology.reaction_latency` ("raised by alertness, fatigue and drink", PHASES-6-PLUS:83) | same risk as drinkFactor: drink must enter once, through arousal inside alertness, or through coordination, not both |

The Life keeper owns the mechanism. It co-signed this decision and its conditions on 2026-11-02 (Life PLAN §3.E1) and took
REAL-43 as LIFE-28: a sourced slow process sizes the sleep-debt driver, validated on held-apart data. 2724 and the LIFE-13
fix wait on it. REAL-44 was decided by Rex on 2026-11-02 and revised the same day. No downstream drink multiplier remains, and none is
relabelled. The game's lines read Life's and neurology's functional outputs once, and the gaps are named (REAL-45; the
accident roll's coordination form is REAL-46). The arousal row drops min(alertness, arousal). Principle: one authoritative
calculation per effect.

## 2. State

Types used in the last column:
- **conserved**: has a balance equation over a declared boundary.
- **invariant**: has bounds and update rules.
- **derived**: recomputed, never stored as authority.

| Quantity | Unit | Valid range | Meaning | Type | State |
|---|---|---|---|---|---|
| substance contents per component (`registry.addContent`) | kg | ≥ 0 | mass of each substance in a component | conserved (mass; `World.conserve`) | built |
| element mass per boundary | kg | ≥ 0 | atoms of each element | conserved (`conserveElements`) | built |
| component temperature | K (°C by name) | > 0 K | lumped temperature | derived from enthalpy and heat capacity | built |
| component thermal energy (`addHeat`) | J | real | sensible heat content relative to the reference | conserved per traced transfer; no whole-world check (README:73-74) | built, open ledger |
| room gas fractions, pressure, humidity | 1, Pa | fractions 0-1 | box-model air | conserved (mass per gas) | built |
| place conditions (`wbgt_c`, `felt_c`, `is_day`, ...) | °C, 1 | as the rows | the outdoors as bodies read it | derived (no transfer; README:204) | built |
| soil N, P, K pools per cell | kg per cell (`soils.ts:24`); per area via `poolPerArea`, kg m⁻² (`soils.ts:51`) | ≥ 0 | plant-available and total pools | conserved (`transfer()`, 3001) | built |
| `world.position` per body or object (REAL-40) | cell id + m (x, y, z) | in the world | where a thing is | invariant: changes only through a resolved move or a mechanics event | planned (R-1) |
| `world.terrain_factor` η per cell | 1 | ≥ 1.0, or null | Pandolf's surface factor relative to firm level ground | derived from cover and soil class (CG-5) | planned (R-2) |
| grade per move | 1 (rise over run) | about −0.45 to +0.45 where the data hold | the sign and steepness of a step | derived per move, never stored (CG-5 Interface) | planned |
| body or object velocity, angular velocity (inside an event) | m s⁻¹, rad s⁻¹ | finite | rigid-body state during a fall, throw or impact | conserved (momentum, energy plus dissipation) inside the event | planned (R-4) |
| mechanical potential energy account per body or object | J | real | m·g·h relative to the world datum | conserved: moves only by W_ext transfers | planned (R-9) |
| dissipated-energy account per place | J | ≥ 0 | friction, impact and footfall losses credited as heat to the place | conserved | planned (R-5, R-9) |
| demand records (force, joint torque, mechanical power, and the task's duration profile; M2-04b) | N, N m, W, s | ≥ 0 magnitudes | what an act requires, before capacity | derived per act | planned (R-3, R-6) |
| contact event | record (m, m s⁻¹, s, N s, J, depth interval m) | as fields | one physical contact | derived; the impulse is conserved between the two bodies | planned (R-10) |

## 3. Mechanisms

### 3.L Mechanism lanes (review adopted 2026-11-02)

The lanes are a work breakdown, not fourteen simultaneous builds. Each lane fills a **lane card** with the seven items
Life uses (Life PLAN §8.1):
1. the selected equation or relationship, its source and the conditions it applies to;
2. its state variables, units and the authoritative owner of each;
3. parameter values, where each came from, and its uncertainty;
4. the numerical update method, with its step-convergence or timing test and tolerance;
5. the functional tests (conservation, boundary, rollback, no double counting);
6. the independent observations used for validation, with the tolerance;
7. status (§6 columns).

A named equation does not make its parameters or its application validated. Where the evidence does not yet support a
selection, the lane starts with a narrowly specified research unit that returns the card or recorded nulls.
Implementers build only what a card states. Cards live in `lanes/` beside this file.

**Ownership.**
- **Reality:** position, geometry, physical forces, mechanical demand, material behaviour, environmental conditions.
- **Life:** bodily capacity, anatomy (REAL-48), metabolic expenditure, fatigue, tissue response.
- **Cognition:** intentions and decisions.
- **Economy:** inventory changes from resolved actions.
- **Kernel:** scheduling, transactions, records, reconciliation.

Reality can calculate the torque a lift requires without deciding how much torque a person can produce. Reality
supplies demand, Life supplies capacity, and the action resolver compares them under a stated contract (C-3).

| Lane | From | Build or refine | Equations or rules | Functional tests | Realism checks | Checkpoint |
|---|---|---|---|---|---|---|
| **RN-1 Placement and reach** | R-1 | authoritative positions; the restricted M1a reach relation | declared fixture adjacency (same cell, or a `reach` edge); geometric reach later | reachable, unreachable and unknown food; invalid locations; no position change outside declared mechanisms | fixture adjacency makes no anatomical-reach claim; later geometry needs measurements | CP-1 (card: `lanes/RN-1-placement-reach.md`) |
| **RN-2 Paths and movement timing** | R-1, R-2 | path segments, distances, elevation change, progress, interruption | `d_horizontal`, `d_path`, `G = Δh / d_horizontal`; `t = d/V` at constant segment speed; per-step progress | zero-length and vertical segments, slopes, blocked routes, interruption; no teleport or duplicated travel | geometry and travel against independent route observations; Life validates the speed and cost model | CP-2 (contract: `lanes/RN-2-movement-contract.md`) |
| **RN-3 Static support and load demand** | R-3 | support reactions, force and torque demands | ΣF = 0, Στ = 0 for the declared static case | supported load, asymmetric load, unsupported configurations; units | independent load and reaction measurements for the arrangements represented | CP-3 |
| **RN-4 Rigid-body motion** | R-4 | translation, rotation, applied forces | Newton–Euler with a stated coordinate convention; semi-implicit Euler | free fall, constant force, rotation, momentum and energy balances, step convergence | independent trajectories within the assumptions; drag-free tests validate nothing aerodynamic | CP-4 |
| **RN-5 Contact and friction** | R-5 | collision detection, impulses, resting contact, sliding | impulse–momentum; restitution; Coulomb static and sliding | interpenetration within tolerance; impulse directions; rebound, stick-slip, inclined block | measured contact-pair parameters for the surfaces and conditions (RN-14) | CP-3 (sliding), CP-4 (impacts) |
| **RN-6 Articulated task demand** | R-6 | prescribed posture and movement → joint demands → the resolver's comparison with Life's capacity | static joint moments first; fully specified inverse dynamics later | known lever examples; signed joint demands; load-position effects; an infeasible static load never becomes feasible by slowing | independent biomechanics examples within the model's dimensional and movement limits | CP-3 |
| **RN-7 Ropes, pulleys and structures** | R-7 | separate cards for rope tension, pulley transmission, capstan contact, beams | tension-only constraints; ideal mechanical advantage; `F_effort = F_load/(nη)` for a defined η; capstan and Euler–Bernoulli within their applicability | force and work consistency; slack rope; pulley displacement; beam deflection; declared failure boundaries | material and apparatus measurements matching geometry, loading and condition | CP-3 (rope, pulley), CP-4 (beams) |
| **RN-8 Fluids and buoyancy** | R-8 | hydrostatic pressure, displaced volume, equilibrium draft; flow and drag separately | `F_b = ρ g V_sub`, gauge `p = ρ g z`; solve displaced mass against supported mass | simple submerged shapes, floating draft, overload, changing fluid density | independent flotation and flow observations; basic buoyancy says nothing about wave stability or sailing | CP-4 |
| **RN-9 Heat and phase change** | §3.0 | audit the built heat transfer, evaporation, boiling, condensation | the existing correlations and energy balances, each with its own domain | hot to cold, equilibrium, latent-energy accounting, limiting cases, step convergence | independent temperature, evaporation and condensation measurements | review card from S0 (`lanes/RN-9-10-11-review-cards.md`) |
| **RN-10 Gases and chemical reactions** | §3.0 | audit gas transport, reaction amounts, rate models, boundary exchanges | the existing gas laws, stoichiometry, supported kinetics | limiting reactants; mass and element balances; gas exchange; no negative amounts; reaction order | independent pressure, composition and rate observations; complete-within-step cannot validate timing | review card from S0 |
| **RN-11 Environmental inputs and soil stores** | §3.0, CG-1, CG-2 | declared weather, light and water inputs; soil balances; plant-facing ports | explicit boundary inputs (NP-3); selected light and water models; nutrient transfers | unit and time alignment; non-negative pools; uptake and return recorded once; missing inputs explicit | independent environmental and soil observations for the scenario | review card from S0; build CP-5 |
| **RN-12 Cross-system energy accounting** | R-9 | mechanical, thermal and chemical accounting with no duplicate expenditure | declared balances with boundaries, signs and destinations | lifting, lowering, sliding and impacts reconcile; deliberately omitted or doubled transfers fail | component validation supports the physics; balance closure proves only consistency | alongside CP-2 to CP-5 |
| **RN-13 Contact to injury interface** | R-10 | contact outputs → material and tissue response → Life's injury representation | selected contact and deformation relationships; penetration only where the evidence supports the model | contact geometry and energy allocation stay consistent; unsupported cases are named | separate calibration and validation evidence for the contact mechanism (REAL-39) | CP-5 |
| **RN-14 Material data and constitutive models** | new (review 2026-11-02) | one property contract for every lane that reads a material or a contact pair | C-4 below | a property missing or outside its range is reported as such; no lane holds its own copy | each value traced to a source for its condition | rows land per consumer, never as a prerequisite for all (`lanes/RN-14-material-properties.md`) |

R-11 (the ecology stock) is not a Reality lane. It is Life's repair, applied by this lane as the designated writer.

**Contracts the lanes share.**

- **C-1. RN-1 reach result** (full text in the RN-1 card). The resolver reads a record: `{actor, target, result:
  reachable | unreachable | unknown, basis, limitation}`. At CP-1 the basis is `fixture-adjacency` and the limitation
  is "declared adjacency; no anatomical or obstacle claim". Missing placement data gives `unknown`, never
  `unreachable` and never an in-world outcome (a host error; Economy, 2026-11-02). Goods are located by Economy's
  inventory id through a declared inventory → cell table (a fixture at CP-1; later the location owner). A `distance_m` field is added only when a consumer needs it. A field alone does not make the interface
  future-proof, because later reach depends on posture and obstacles, not only distance.
- **C-2. Body geometry, Life and Reality** (REAL-48, proposed to Life). Life owns authoritative anatomical dimensions,
  segment masses and how they change with bodily state. Reality owns world pose, joint configuration and the
  mechanical quantities derived from them. To agree: who supplies or derives segment centres of mass, inertia, and
  external and muscle moment arms. Proposed: Life supplies segment mass, length, centre-of-mass fraction and radius of
  gyration, plus muscle moment arms (the capacity side). Reality derives world centre-of-mass positions, inertia about
  the joints and external load moment arms. Tests: segment masses sum to the represented body mass within a stated
  tolerance; a change in body state updates the geometry consistently. This belongs to CP-3, not M1a.
- **C-3. Demand, capacity and progress** (REAL-49, with Life and Kernel). Reality supplies demand: force, joint torque
  by joint and direction, power, and the profile in time. Life supplies capacity in the same units, joint and direction,
  at the same angle and angular velocity. The resolver compares them and returns the outcome. Each step of a multi-step
  act is its own transaction (kernel PLAN §3.3). A failed step rolls back only itself; committed progress and spent
  energy stay. The contract fixes units, sign and direction conventions, timing within the step, and partial-progress
  behaviour.
- **C-4. Material properties** (RN-14; full text in `lanes/RN-14-material-properties.md`). Every property or
  relationship records the material, the condition and range it applies to, units, source, uncertainty and version, the
  mechanisms that consume it, and what happens outside its range or when missing (null and reported, never extrapolated
  silently). Friction and restitution are keyed by **contact pair and condition**, never by one material. Stiffness,
  strength and density carry their conditions too. `data/materials.json` today holds cp and a failure temperature with
  no condition or uncertainty fields, so the contract adds fields; it does not replace the rows.

**Accepted (Rex, 2026-11-02 evening).** The lane structure and contracts are accepted as reported; next is agreement
and tests, not another review. Two tracks: CP-1 (reconcile RN-1's result with Economy and Life, then test the
accessible uncontested bread and the unknown-input case, with reach marked fixture-supplied in the trace) and the later
contracts C-2 and C-3 (REAL-48, REAL-49) with Life and Kernel. The later contracts do not block CP-1, which consumes
none of them.

**Corrections adopted from the review (2026-11-02).**
1. Path distance and grade: horizontal and path distance are kept apart (R-1).
2. A prolonged move is a movement state with per-step transactions (R-1, R-9, §4).
3. Static and dynamic feasibility are separate tests, with no `min(demand, capacity)` (R-6 step 3).
4. Negative-work cost: the sign inconsistency is named, and Life selects the relationship (R-6 step 5, REAL-47).
5. Pulley effort is `F_load/(nη)` for a defined overall η (R-7).
6. Available collision energy is not delivered injury energy (R-10).

### 3.S Simplification review (Rex, 2026-11-03)

**Rule** (as Life PLAN §8.3). Each mechanism uses the simplest adequately supported model that keeps the effects. Ownership and the contracts C-1 to C-4 stay as agreed.
- **Detailed models stay available** as explicit model choices. A choice is selected by the scenario's declared physical conditions, never by which game is running.
- **Each run saves its model choices.** The selection and every parameter-table version go into the run's record. Kernel owns time, scheduling and the run journal; Reality declares the choices, and Kernel stores them (interface K-M below).
- **Automatic switching (regime detection) is deferred.** A scenario that needs the detailed model declares it.

**Keep / simplify / defer**

| Item | Decision | Replaces |
|---|---|---|
| R-1 travel geometry, splitting at events, ΔPE ≠ walking cost | keep | nothing. The one change: "Δx, Δy from cell centres" becomes one **route source** (W-1), no longer the definition of distance. |
| R-2 η table, R-3 statics | keep | nothing |
| R-4 falls and simple throws | **simplify**: an analytic constant-acceleration path between contact events | R-4's "semi-implicit Euler at millisecond ticks" as the default. Newton–Euler becomes the `rigid-general` choice (tumbling, drag). RN-4 row. |
| R-5 friction | keep: Coulomb, with the static check separate | nothing |
| R-5 impacts | **simplify**: central 1-D impulse, `m_eff`, `J`, `E_diss` | R-5's general impulse contact as the default; it becomes `contact-general` (oblique, rotating). RN-5 row (impacts). |
| R-6 lifting and carrying | **simplify**: task-level demand for ordinary slow supported tasks | R-6's mandatory 8-segment chain. It becomes the `articulated` choice; steps 1, 3 and 4 apply to it unchanged. RN-6 row. C-2 is needed only by `articulated`. |
| R-7 ropes, pulleys, beams; R-8 buoyancy and hydrostatics | keep | nothing |
| Gases (§3.0) | **simplify**: well-mixed zones by default, with the exact constant-input update; the grid is for plumes, stratification and position-specific exposure | the explicit `frac = min(1, ACH·Δt/3600)` in the room box and the grid's enclosed-cell exchange (REAL-52). Unit 5590. |
| Heat (§3.0) | **simplify**: lumped UA·ΔT with exact updates where the inputs are constant; latent heat and boiling kept | the explicit `heatFlow·dt` in `lossesProcess` and `wallsProcess`. Unit 5591. |
| Reactions (Arrhenius plus stoichiometry), soils (per-nutrient stores), material coefficients by condition (C-4) | keep | nothing |
| World representation | **add** W-1, one capability-aware world interface with two adapters | "same cell = reachable" as a universal rule: the RN-1 cell becomes a declared **reach zone** (5541 and 5542 amended); RN-2's cell-centre distances |
| Regime detection; non-central or rotating impacts; drag; the combined source-and-ventilation exact form | **defer** | the exact form with S (below) lands with the zone-model unit, after 5590 |

**R-6 simplified: task-level demand** (CP-3).
- **Applies to** ordinary slow supported tasks: lift, hold, carry at walking pace, with feet supported and no twisting.
- **Reality supplies the demand:**
  - `F = m g`;
  - `τ_req = m g r⊥ + τ_posture`, about the task's declared reference joint (for example L5/S1 or the shoulder);
  - `W = m g Δh`;
  - `P = m g v_vert`.
- **Its inputs:**
  - `r⊥` is the horizontal moment arm of the load in the declared posture.
  - `τ_posture` is the moment of the body's own segments in that posture. Its body-mass terms come from Life (C-2's mass and centre-of-mass inputs only). Its values must be sourced or justified (unit 5595). A missing `τ_posture` makes the demand `unknown`, reported. It is never a silent 0.
- **Life supplies the capacity** for the same task, posture and reference joint. The resolver compares the two as in R-6 step 3 (static feasibility, then dynamic feasibility; no `min`).
- **A task capacity never silently stands in for a joint capacity.** The record names the basis: `task` or `joint`.
- **Holding a load** does no external work (`W = 0`), but it is not free: its metabolic cost is Life's (step 5).
- **Use `articulated` instead** when the task is fast, ballistic or twisting, or when a joint-specific limit decides the outcome.

**R-4 simplified: ballistic path between contacts** (CP-4).
- **The path:** `x += v Δt + ½ a Δt²` and `v += a Δt` under constant acceleration (`a = g`, with no drag). From rest, a fall of height h lasts `t = √(2h/g)` and lands at `v = √(2gh)`. The existing analytic check stands: 2 m gives 6.263 m s⁻¹.
- **Finding the contact:** solve for the first contact along the path against the declared surfaces, and split the step there (a contact event).
- **Use `rigid-general` instead** (Newton–Euler; semi-implicit Euler inside an event window) where tumbling or drag change the result.

**R-5 simplified: central 1-D impact** (CP-4).
- **The impulse:** `m_eff = (1/m1 + 1/m2)⁻¹`, `J = (1 + e) m_eff v_approach`, and `E_diss = ½ m_eff v_approach² (1 − e²)`.
- **e comes from C-4**, keyed by contact pair and condition; a null e blocks the event.
- **E_diss is the R-10 E_avail.** It is never converted directly to injury: the material and tissue response, and Life's injury representation, own that (RN-13).
- **Use `contact-general` instead** for oblique or rotating impacts.

**Gases** (REAL-52; unit 5590).
- **Well-mixed zone, ventilation term:** `k = ACH/3600`, and the remaining excess is `(C − C_out) e^(−k Δt)`. In the code, `frac = 1 − e^(−k Δt)`, computed as `-Math.expm1(−k Δt)`.
- **Ventilation only vs coupled (Rex, 2026-11-03).** 36.79% at 1 ACH is the ventilation-only result (constant airflow, volume and outside concentration). Sources and sinks (breathing, combustion, changing conditions) must be in the same update for the coupled step to be step-independent; replacing the fraction alone does not do that, and 5590/5592 claim only the ventilation-only result.
- **The combined constant-input form** is `C∞ = C_out + S/(kV)` and `C_next = C∞ + (C − C∞) e^(−k Δt)`. With no ventilation it is `C += S Δt / V`. It applies when one process holds both the constant source S and the exchange. Today the sources and breathing are separate processes (operator split), so 5590 makes only the exchange exact. The split's error is a named limit until the zone-model unit.
- **Consumption stays bounded.** A sink never takes more than the zone holds.
- **The grid** keeps its per-step shares for wind, diffusion, rise and settling. They are the host's numbers. 5590 makes its enclosed-cell ACH term exact in the same way.

**Heat** (unit 5591).
- **Against a fixed environment:** `T_next = T_env + (T − T_env) e^(−UA Δt / C)`.
- **Between two finite bodies:** `Q = (T1 − T2)/(1/C1 + 1/C2) · [1 − e^(−UA (1/C1 + 1/C2) Δt)]`.
- **Where each applies:** `lossesProcess` (component to room) and the wall's inner film use the two-body form. The wall's outer conductance to the outside uses the fixed-environment form.
- **A three-node wall is exact per pair** but split between the two pairs, a named limit.
- **Unchanged:** latent heat, boiling and the condenser's effectiveness-NTU, which is already exact for its stated case.

**W-1. World interface** (units 5593 and 5594; Rex: the engine must work beyond cube worlds).
- **Three separate query groups:**
  - **geometry:** a place's position, elevation and zone volume;
  - **route:** the segments between two places, each with length and Δh;
  - **environment:** air temperature and composition in a zone.
- **Every value carries units and provenance:** `authored`, `measured` or `derived`, plus a source. An authored fictional volume is legitimate. A silent default is not.
- **Capabilities.** An adapter declares what it can supply. A query for a capability it lacks returns `{ unsupported: <capability> }`, never an invented dimension.
- **Two adapters ship:**
  - **grid:** the existing `GridSpec` cells. Route lengths are derived from cell centres, and elevations from `elevationM`.
  - **location-and-route:** named places with authored route segments. It may declare no positions at all.
- **Distance.** Cell centre to cell centre is one route source, not the definition of distance.
- **Reach zones.** "Same cell" is not universal reach: walls and closed containers separate objects. It stays valid for the labelled adjacent-bread M1a fixture and its test (Rex, 2026-11-03). A reach zone is a declared space with no wall or closed container between its contents, and a closed container is its own zone.
- **Body mass and size come from Life**, never from map resolution. Time and scheduling are Kernel's.
- **Acceptance:** the same physical scenario through both adapters gives matching results within declared tolerances, only for equivalent scenarios both support; `unsupported` for geometry an adapter lacks is an expected result, not a failed physics test (route length, Δh, R-1 travel time at a given V, zone volume, ventilation decay).

**Interfaces named, not built by Reality.**
- **Life:** task and joint capacity (R-6); body mass and centre-of-mass inputs to τ_posture (C-2); metabolic cost of holding and of negative work (REAL-47); tissue consequences of `E_diss` (RN-13).
- **K-M (Kernel):** the run journal stores Reality's model choices (`task | articulated`, `ballistic | rigid-general`, `central-1d | contact-general`, `zone | grid`) and the parameter-table versions. This is to be agreed with the Kernel keeper. It does not block 5590 to 5595.

### 3.0 Built physical mechanisms, carried forward

- **Heat transfer.** `src/process.ts`: losses, walls, combustion, effectiveness-NTU condenser, Churchill-Chu
  correlation (README:47-71). Applies to lumped bodies with one-second explicit steps. Its stated limits are README:67-71.
- **Phase change.** ASHRAE pool evaporation, Antoine boiling, latent heat (README:47-49, 18-26). The pool correlation is
  extrapolated toward boiling, and that is named as a limit.
- **Gases.** Ideal gas, room box with ACH, gas sources and sinks, host lattice grid (README:186-194). The grid's shares
  are the host's numbers.
- **Reactions.** Records with stoichiometry, threshold ignition, Arrhenius where sourced, otherwise complete-within-step
  (README:76-97). Irreversible and perfectly mixed.
- **Element ledger** (README:83-88). Covers contents; equipment shells are inert.
- **Environment.** BoM WBGT, diurnal half-cosine, exposure rows (README:196-206). It moves nothing, so there is no
  transfer.
- **Soils.** The N/P/K ledger through `transfer()` (3001, 3021). It is the soil stock's only writer (CG-22).

Built is not validated (review 2026-11-02). §6 records V as "not recorded" for every row above. Each mechanism gets a
**review card** in the seven-item format (lanes RN-9 to RN-11, `lanes/RN-9-10-11-review-cards.md`): selected
correlation and its domain, state and owner, parameters and sources, numerical method and step-convergence test,
functional tests, independent observations, status. A review card may find a defect; any change it leads to is its own
unit. Closing the open energy sinks (R-9, RN-12) is the only change this plan already schedules.

### R-1. Placement and displacement (M1a reach, M1b moves)

- **State.** `world.position = {cell, x, y, z}`.
- **M1a (RN-1, CP-1).** Food is within reach when it is in the same cell as the body or joined to it by a declared
  fixture edge of kind `reach`. No geometry is used, and the result claims nothing about anatomical reach. The result
  is a record, not a boolean (RN-1 card §2): actor, target, `reachable | unreachable | unknown`, basis
  `fixture-adjacency`, limitation. Missing placement data gives `unknown`, never `unreachable`, and never an in-world
  outcome: the load-time check requires a cell for every body and inventory (keyed by Economy's inventory id), and a
  run-time `unknown` is a host error (agreed with Economy 2026-11-02).
- **M1b (RN-2, CP-2).** A move is a path, a list of cells. Per segment a→b, with Δx, Δy from the route source (cell centres are one source, W-1) and Δh from
  `world.elevation` (corrected 2026-11-02; the earlier text divided the rise by a distance that was not horizontal):

      d_horizontal = √(Δx² + Δy²)        d_path = √(d_horizontal² + Δh²)        G = Δh / d_horizontal

  - the distance and grade passed to Life follow the convention Life's selected walking model requires (Pandolf's G
    is rise over horizontal run; whether its V is along the path or horizontal is Life's to state on the RN-2
    contract, REAL-49);
  - the time at constant segment speed is `t = d / V`, with d the distance that matches V's convention;
  - `d_horizontal = 0` with `Δh ≠ 0` is a vertical segment: unsupported by any walking model, so the path is refused
    at validation (`impossible`, reason named), never divided through;
  - `d_path = 0` (a repeated cell) is removed at validation; it is never a zero-time step.
- **Update (corrected 2026-11-02; kernel PLAN §3.3: a transaction never spans instants).** A move is a **movement
  state** Reality owns: `{path, segment index, progress_m along the current segment, status}`. Each step of the move is
  its own resolver transaction: Life's speed and capacity for the step, Reality's progress `Δs = V Δt` (clipped at the
  segment end), the position or progress change, and that step's energy transfers all commit or roll back together. An
  interruption therefore keeps every committed step, its progress and its spent energy, and rolls back only the
  failing step. `progress_m` is authoritative; the cell changes when a segment boundary is crossed.
- **Applies** to walking and carrying on land and to wading below 0.35 m s⁻¹ (CG-5 E5).
- **Stops applying** to deep water (no swimming model), to grades outside ±0.45 (no metabolic data), and to anything
  that needs balance or falling (R-4, R-6).

### R-2. Terrain surface factor η (CG-5)

- **Definition.** η per cell, taken from a class table of cover and soil class.
- **Values.** CG-5's table, each with its source key:
  - blacktop: 1.0;
  - dirt: 1.1, with 1.2 as the flagged alternative;
  - grass: 1.08;
  - light brush: 1.2;
  - heavy brush: 1.5;
  - bog: 1.8;
  - loose sand: 2.1, stored with the spread 1.34 to 2.7 as a range;
  - snow: by depth.
- **Null** where nothing was measured: wet packed sand, mud, coral rubble, cane. A null cell makes the move's energy
  unknown, so it is reported as unknown and never defaulted to 1.
- **Assumption.** η scales only Pandolf's speed-dependent term (CG-5 E1).

### R-3. Quasi-static support (standing, carrying, slow walking)

- **Statics.** For a body at rest or in steady walking at the resolution of R-1, the net external force is zero and the
  ground reaction equals weight: `F_GRF = (m_body + m_load)·g`, with g = 9.80665 m s⁻². For 70 kg that is 686.47 N.
- **Restated acceptance (REAL-38).** "Net force at the feet zero" is restated as: the net external force on the body is
  zero, and the vertical ground reaction equals body weight.
- **Limits.** It stops applying at gait-cycle resolution: peak ground reaction in walking is about 1.1 to 1.3 times
  weight (to open, a force-plate source). That needs R-6.

### R-4. Rigid bodies (falls, thrown and dropped objects, loads that slip)

> Simplified 2026-11-03 (§3.S): the default is the analytic ballistic path between contacts; the text below is the `rigid-general` choice.

- **Model.** Newton–Euler: `m dv/dt = ΣF` and `I dω/dt + ω × Iω = Στ`, with mass, centre of mass and inertia tensor from
  geometry and material density.
- **Integrator.** Semi-implicit (symplectic) Euler at kernel millisecond ticks, run **only inside an event window**
  (a fall, a throw, an impact), never for the whole world.
- **Events.** Start when support is lost or an impulse is applied. End when the body is at rest in contact, or after the
  window.
- **Energy check.** `ΔKE + ΔPE + E_dissipated = W_applied`, within 0.1 % (ROADMAP P2 test 1).
- **Analytic check.** A 1 kg drop from 2 m arrives at `v = √(2gh) = 6.263 m s⁻¹` with KE 19.61 J and momentum 6.263 N s.
- **Assumptions.** No air drag until phase 7 supplies `F_d = ½ρC_dAv²`, which a 2 m drop does not need (labelled).

### R-5. Contact and friction

> Simplified 2026-11-03 (§3.S): impacts default to the central 1-D impulse; friction is kept as below.

- **Method.** Impulse-based contact.
- **Normal.** The normal impulse removes the approach velocity times (1 + e). The restitution e comes from the material
  pair (to open; null blocks the event).
- **Friction.** Coulomb: `|F_t| ≤ μ_s N` to stick, `F_t = μ_k N` when sliding. μ comes from a materials-pair table
  (phase 9; to open).
- **Ledger.** The kinetic energy lost in an impact and the friction work `μ_k N d` of a dragged load are credited to the
  place's dissipated account as heat. That is one transfer, never also left as a loss of the mover.
- **Resting contact** gives the support of R-3.
- **Example, dragging a sledge.** The required pull is `μ_k (m g cos θ) + m g sin θ`. That pull is the demand handed to
  Life, and Reality supplies μ_k.

### R-6. Simplified articulated body (M2: lifting, carrying, posture)

> Simplified 2026-11-03 (§3.S): ordinary slow supported tasks use task-level demand; the chain below is the `articulated` choice.

- **Segments.** A planar, sagittal chain of rigid segments: foot, shank, thigh, trunk, upper arm, forearm and hand, and
  head. **Anatomy is Life's** (body-geometry contract, REAL-48, proposed 2026-11-02): segment masses, lengths,
  centre-of-mass fractions and radii of gyration are properties of the body and change with its state, so Life owns
  them (a candidate source is de Leva 1996, J Biomech 29:1223-1230; to open; PHASES-6-PLUS:67). Reality owns the world
  pose, the joint configuration and the mechanical quantities it derives from that anatomy (§3.L contract C-2).
- **Posture** is given: a set of joint angles from the act (lift, hold, carry) chosen by the resolver. Posture is not
  optimised, and no balance controller is built.
- **Calculation chain** (lifting, as PLAN-SPEC §2 asks):
  1. **Load and posture to force and torque (Reality).** Static joint torque:
     `τ_j = Σ_{i distal to j} (r_i − r_j) × m_i g + (r_L − r_j) × m_L g`, adding `m_i a_i` terms when the act prescribes
     an acceleration (inverse dynamics, recursive Newton–Euler). Example: 20 kg held 0.40 m in front of L5/S1 adds
     78.45 N m about that joint from the load alone.
  2. **Torque to capacity (Life).** Life's `body.capacity_functional` gives τ_max per joint and direction, from muscle
     cross-section, specific tension and moment arm, with today's fatigue applied.
  3. **Capacity to movement (resolver, CG-16; corrected 2026-11-02).** Reality supplies demand, Life supplies capacity,
     and the resolver compares them under the RN-2/RN-6 contract (REAL-49: units, joint and direction, timing, partial
     progress). Two separate tests, in order:
     - **(a) Static feasibility.** The static torque at the prescribed posture with the load, `τ_static,j`, against
       Life's isometric capacity at that joint angle. If any joint fails, the act is infeasible at that posture.
       Slowing it down cannot make it feasible, because the static term does not depend on speed.
     - **(b) Dynamic feasibility.** The full demand with the prescribed accelerations, `τ_j(t)`, against Life's
       capacity at the joint's angular velocity. If it fails, the act fails, unless the act declares an alternative
       slower profile; that profile is then checked again from (a). No `min(demand, capacity)` blend is used: it
       produced a movement no equation described. Life DESIGN §CG-16's text is Life's to revise (REAL-49).
     - No probability is used unless a source gives the spread.
  4. **Movement to work (Reality).** External work `W_ext = Δ(PE + KE)` of the load and body. Joint work
     `W_j = ∫ τ_j ω_j dt`, with the positive and negative parts kept separately.
  5. **Work to metabolic cost (Life).** Reality supplies the signed joint work and power, positive and negative parts
     kept apart, and nothing more. The form quoted here before, `|Ẇ_neg|/η⁻` with η⁻ given as about −1.2, was
     inconsistent: a negative denominator subtracts cost. Making the denominator a positive magnitude repairs the
     sign but is not by itself a validated model. Life selects the negative-work cost relationship and its sign
     convention (REAL-47). Reality never computes Ė.
  6. **Metabolic cost to fatigue (Life).** Effort per muscle group is `τ_j / τ_max,j`, mapped to groups by the
     moment-arm share (to open). That effort is the input `stepMuscleFatigue` takes (`muscular.ts:61`). Whole-body
     fatigue follows MET-hours as today.
  7. **Fatigue to changed capacity (Life).** The 3CC fatigued fraction lowers τ_max at the next act. That closes the loop.
- **Who produces effort.** Today nobody does: the host does (`muscular.ts:57-63`; `physiology.ts:156` via the schedule's
  MET). After R-6, **Life's capacity module produces effort** from Reality's demand, step 1, and its own capacity, step 2.
  For M1b, before R-6 exists, the whole-body intensity is Pandolf's M divided by the resting rate, as a MET for physiology
  (Life). Local effort in walking stays null until the walking activation shares are sourced. It is never a constant.
- **Stops applying** to fast or ballistic movement (it needs R-4 dynamics), balance and falls, and 3-D twisting lifts.

### R-7. Ropes, pulleys and beams

- **Rope.** A tension-only member: `T ≥ 0`, with no compression.
  - An ideal pulley block of n supporting falls gives `T = m g / n`, and the effort end moves n times the load's
    displacement, so ideal effort work equals the load's work.
  - Friction (corrected 2026-11-02; the earlier text multiplied T by an efficiency below 1, which lowers the effort).
    With an overall lifting efficiency η defined as load work over effort work for the stated arrangement and
    direction (hoisting, not lowering), `F_effort = F_load / (n η)`. The arrangement, the reeving and the definition
    of η are part of the record. Per-sheave factors are never multiplied together unless a source gives that model
    for that arrangement. η is to open; a null η leaves the effort unknown.
  - A rope round a post or capstan gives `T_load = T_hold e^{μθ}` (Euler–Eytelwein).
  - Failure: the rope fails when T exceeds its breaking load (phase 9 table, to open). At or below it the rope holds.
- **Beam.** Euler–Bernoulli for a slender, elastic beam:
  - simply supported with a central load: `δ = F L³ / (48 E I)`;
  - rectangular section: `I = b h³ / 12`;
  - bending stress: `σ = M c / I`, compared with the modulus of rupture (Wood Handbook; to open).
  - It stops applying past the proportional limit, for short deep beams (shear), and under long-duration load (creep;
    duration-of-load factors are Wood Handbook data).
- **Feeds** the Settlement construction asks (a wall fails at its tabulated load, ROADMAP P2 test 2) and lifting (R-6).

### R-8. Buoyancy and hydrostatics

- **Forces.** `F_b = ρ_f g V_sub` and `p = ρ_f g z`.
- **Floating draft.** Solve `ρ_f V_sub(d) = m` for d from the hull's section table.
- **Stability.** Initial stability is `GM = KB + BM − KG`, with `BM = I_wp / V_sub`.
- **Drag.** `F_d = ½ ρ C_d A v²`, filled by phase 7 (C_d by shape and Reynolds number, to open).
- **Wading.** Uses this only for the water depth. The cost stays Life's (CG-5 E5).
- **Exact by construction.** Archimedes, ROADMAP P2 test 3.

### R-9. Energy accounting (body boundary and world ledger)

**Body balance.**
- **Boundary.** The body, bounded by skin and the airway and gut epithelia. Gut contents are outside until absorbed.
- **Equation.** Over any interval:

      E_absorbed − E_chem,excreted  =  W_ext  +  Q_out  +  ΔU_chem,stores  +  ΔU_thermal

  This splits into two balances that are never mixed:
  1. **Chemical (Life, nutrition).** `dU_chem/dt = Ė_absorbed − Ė_chem,excreted − M`, where M is the rate of chemical
     energy conversion. U_chem covers glycogen, fat and protein.
  2. **First law for the body (Life, physiology).** `M = Ẇ_ext + Q̇_out + dU_thermal/dt`, where U_thermal = m c T_core.
- **Signs.**
  - W_ext > 0 when the body does work on its surroundings: raising itself or a load, pushing, pulling a sledge.
  - W_ext < 0 when the surroundings do work on the body: descending, lowering a load. Then `Q_out + ΔU_thermal = M − W_ext`
    exceeds M.
  - Q_out > 0 is heat leaving: convection, radiation, sweat and breath latent heat.

**No double counting.**
- Life computes M from Pandolf or MET.
- Reality computes W_ext, from R-1 for walking (`(m_b + m_L) g Δh`), and from R-5 and R-6.
- Physiology already sets heat = M − W (`physiology.ts:401-405`). With mechanics, W comes from Reality instead of the
  host's `work_w`.
- **One transfer per flow** (PLATFORM §7a), written by the move or act resolver in the transaction of the step that
  produced it (one per step, never one spanning the act):
  - uphill: debit Life's `metabolism`, credit Reality's potential-energy account for the body and load;
  - downhill: debit the potential-energy account, credit body heat.
  - Neither engine posts the other's side.

**Worked check (M1b).** 70 kg body, 20 kg load, 1.34 m s⁻¹, η = 1:
- Level: Pandolf M = 362.1 W and W_ext = 0, so heat is 362.1 W.
- At 5 %: M = 573.1 W and W_ext = 90·g·1.34·sin(atan 0.05) = 59.06 W, so heat is 514.1 W.
- Implied delta efficiency 59.06 / 211.05 = 0.28. A plausibility check against measured delta efficiency of uphill
  walking (to open), not a tuning target.

**World ledger (README:67-74 has none).** No second ledger is added (PLAN-SPEC §3). The check is a `World.conserve`-style
sum over enumerable energy stores within a declared boundary, from the existing trace and kernel `transfer()` records.
It needs the open sinks closed first:

| Sink today | Where | Becomes |
|---|---|---|
| `metabolism` | physiology.ts:404-407 | a pass-through that must net to zero each step (in: chemical; out: heat + W_ext). It nets today only when W ≥ 0 (REAL-37) |
| `work` | physiology.ts:407 | Reality's potential-energy or dissipated account (R-9 transfers) |
| `sweat-latent`, `breath-latent` | physiology.ts:461-462 | the latent enthalpy carried with the vapour into the room's air (to verify whether the room credits it; REAL-41 risk) |
| `food` | physiology.ts:351 | the container's chemical store (the host's or Economy's), one transfer |
| `fuel` (combustion) | process.ts:58 | the fuel content's chemical energy (formation enthalpy already in the reaction records) |

Until each sink is closed, energy checks stay **focused balance tests** per mechanism, as today, and any claim of
whole-world energy conservation is withheld.

### R-10. Contact to wound (phase 6b), reporting ranges

This is a later model-selection task (RN-13, CP-5). Nothing below is a validated wound predictor.
- **Reality publishes** the contact event (PHASES-6-PLUS:84) with:
  - the **available** relative-motion energy `E_avail = ½ m_eff v_rel²` along the contact normal, where v = ω × r along
    the limb or blade and m_eff is the effective mass at the contact point (corrected 2026-11-02: the earlier text
    called this "delivered");
  - the impulse;
  - the contact geometry (point, edge or blunt; area).
- **Energy allocation.** E_avail splits into rebound kinetic energy, deformation of each body, and the other named
  destinations (heat, sound, fracture). For a simple normal impact with restitution e, the energy not returned as
  relative motion is `(1 − e²) E_avail`. Only the share a selected contact model allocates to the tissue's deformation
  or penetration, `E_alloc`, drives the penetration interval. Every destination is recorded, so the shares sum to
  E_avail and none disappears (RN-12).
- **Materials (phase 9)** give each layer's resistance as a **range** `F_lo(x) ≤ F(x) ≤ F_hi(x)`, from opened studies:
  skin, fat, muscle, bone; cloth, leather, mail.
- **Penetration** is the interval [d_lo, d_hi], solving `∫₀^d F_hi = E_alloc` for d_lo and `∫₀^d F_lo = E_alloc` for
  d_hi, and only for contact mechanisms where the evidence supports a resistance-integral model. Elsewhere the interval
  is null, and the case is named as unsupported.
- **Life** maps both ends to wound rows and reports the wound as a range of classes. A single depth is never published
  until calibration.
- **Calibration.**
  - Calibration set: tissue-simulant data, ballistic gelatin and cutting tests.
  - Validation set: separate tissue studies, porcine or cadaver.
  - The same dataset is never both (REAL-39).

### R-11. REAL-36: ecology stock goes negative (confirmed; Life's module, fix planned at the source)

**Reproduction** (in memory, no files written):
- Input: `createStock("x", 1000, 1, 1)` (B = 1000, K = 1, r = 1 per year), then `stepStock(s, 5)`.
- Result: growth −2736.99, available −1736.99, returned catch −1736.99, unmet 1741.99, B after 0.
- The trace records the stock giving 2736.99 to `environment` while it held 1000, and records no catch.
- `trace.check(before + growth − taken, s.B)` passes, because the negative `taken` cancels.

**Cause.** `ecology.ts:66` integrates `dB/dt = rB(1 − B/K)` by one explicit Euler day. When B > K, that step can remove
more than B. `ecology.ts:40` accepts B > K, and K is a mutable host field, so a habitat loss that lowers K produces this.
B > K is a valid physical state (an overstocked ground); the invalid state is the negative stock the Euler step makes.

**Fix at the source.** Use the exact solution of the same ODE over the day:

    B(t + Δt) = K B / (B + (K − B) e^{−r_eff Δt}),   Δt = 1/365 year

- It is positive for every B > 0 and approaches K from either side without crossing it.
- For the reproduction, B goes 1000 → 267.86, so a catch of 5 is taken in full.
- At B = K/2 (B = 500, K = 1000, r = 1) one day gives 500.6849311 against the Euler row's 500.6849315: a difference of
  4.3e-7 in the stock's unit, 8.6e-10 of B.
- The growth reported is `B(t+Δt) − B(t)`. The catch is then taken from that value, which is never negative, so
  `taken ≥ 0` always holds.
- Add `taken ≥ 0` and `s.B ≥ 0` to the step's checks, so a later regression fails loudly.

**Not the fix.** Clamping only the catch would leave the stock having given the environment more mass than it held.

**Record and ownership.** This is a model-integration change to a library row whose text is the Euler form
(`depletion_rules`), so it is recorded under PLATFORM §11a and the row gains a `(unit) integration:` line.
- **Life owns** the ecology model, the equation and the acceptance tests (§7 R-11). It is an explicit Life-owned
  repair even though the code lives in the combined realism repository.
- **The designated writer** is the realism lane: this keeper queues the unit and is the sole realism committer
  (HANDOFF §1). The unit names Life as owner and this lane as writer. Ownership of the equation does not mean
  concurrent editing of the shared repository.

## 4. Inputs and outputs

| Quantity | Producer → consumer | Unit, range | Timing | Failure and rollback |
|---|---|---|---|---|
| `world.position` and movement state (`progress_m`) | Reality (resolver posts) → Life, Cognition (perception), Economy (where goods are) | cell + m | every step of a move, each its own transaction; a Reality **port output** with K1's writer-checked `PortTable.write` (Reality's decision for M1a-08 / KRN-53, 2026-11-02); declared by the fixture at load in M1a | a failed step rolls back only itself, port included; committed steps keep their progress and spent energy (RN-2); any other writer is refused |
| reach result (RN-1) | Reality → resolver, before any Economy transfer | record: actor, target, `reachable \| unreachable \| unknown`, basis, limitation | per intention, before the transaction | `unknown` is a host error, never an in-world `impossible` and never `unreachable`; the load-time check prevents it at CP-1 |
| `world.terrain_factor` η | Reality → Life (Pandolf) | ≥ 1, or null | static per cell; recomputed when cover changes | null: Life reports the move's energy unknown; the move may still be resolved if Life's plan allows |
| `world.elevation` (grade input) | Reality → whoever steps the move | m | static, or slow (phase 15) | missing elevation: grade unknown, same as null η |
| speed V per segment | Life → Reality | m s⁻¹, > 0 | per segment | V = 0 or capacity exhausted: the move stops at the last segment |
| W_ext per step | Reality → Life (heat = M − W) | J, signed | in the same transaction as the step | step aborts: no work and no progress posted for that step |
| demand (force, τ_j, power) | Reality → Life capacity | N, N m, W | per act | posture data null: act reported as unresolvable (impossible status), no default |
| `body.capacity_functional` τ_max | Life → resolver | N m | per act | Life's |
| body heat, gases, water | Life → Reality (room) | J, kg | per step | existing ports (SPLIT §4) |
| place conditions | Reality → Life | °C, 1 | hourly or per step | existing |
| soil pools, flux debits and credits | Life uptake and litter → Reality soils | kg per cell per day | daily | `transfer()` refuses a debit beyond the pool (3001) |
| `place.par`, rain, soil water (CG-1, CG-2) | Reality → Life plants | mol m⁻² d⁻¹, mm, m³ m⁻³ | daily | weather is a declared external input until phase 13 (M3) |
| contact event | Reality → Life (wound), combat plugin | record | per contact, inside an event window | an unopened material range gives a null depth interval, so the wound is "unknown", never defaulted |
| item mass and geometry | Economy → Reality | kg, m | per act | Economy's |
| weather input on place state (NP-3) | Catalogue series (England 1270) → Reality port → Life, Settlement | the port schema's units: °C, mm, MJ m⁻² d⁻¹, m s⁻¹ (to fix with Catalogue) | daily | a missing day stops the run with the gap named; no interpolated or default weather |

## 5. Evidence

Labels:
- **M**: measured (a value read from an opened page).
- **C**: calibrated estimate.
- **A**: assumption.
- **F**: fiction (none planned here).
- "To open" means the source is named but not read, so the value stays null.

| Item | Source | Label | State |
|---|---|---|---|
| g = 9.80665 m s⁻² | standard gravity (CGPM 1901, defined) | M | known |
| Newton–Euler, impulse, Coulomb law, Euler–Bernoulli, Archimedes, Euler–Eytelwein, metacentric height | textbook mechanics | M (established, level 1 of PLATFORM §4) | known |
| Pandolf 1977 equation | J Appl Physiol 43:577 via CG-5 S1, S2, S5 (secondary) | M (secondary) | read secondary; primary to open |
| η table | Soule and Goldman 1972 lineage via CG-5 S1, S5, S11 | M (secondary), ranges kept | read secondary |
| Santee 2001 downhill | Aviat Space Environ Med 72:562; USARIEM T01-11 | to open (two printed forms disagree, CG-5 E2) | null |
| Minetti 2002 walking polynomial | J Appl Physiol 93:1039 | to open | null; anchors 1.64 and 17.33 J kg⁻¹ m⁻¹ only |
| Tobler speed | Tobler 1993 via Wikipedia | M (secondary) | read secondary |
| segment parameters (Life's, REAL-48) | de Leva 1996, or Winter 2009 | to open | null |
| material properties (RN-14) | `data/materials.json` has cp and a failure temperature only, with no condition, range or uncertainty fields | M where checked | the contract is not yet applied |
| muscle efficiencies (Life's) | Margaria 1968 | to open | Life's |
| level walking does no net external work | A, standard in Pandolf use | A | flagged |
| descent PE dissipated in the body | A | A | flagged; some goes to the ground |
| restitution, friction by material pair | phase 9 tables | to open | null |
| rope breaking loads, wood E and MOR | Wood Handbook, rope standards | to open | null |
| tissue and armour resistance ranges | gelatin and tissue studies | C (calibration set declared) | to open |
| exact logistic solution | the logistic ODE's closed form | M (mathematical identity) | known |

## 6. Status

Columns: designed (D) · implemented (I) · connected (Cn, through kernel ports to its readers) · numerically checked (N) ·
empirically validated (V).

| Mechanism | D | I | Cn | N | V |
|---|---|---|---|---|---|
| heat transfer, phase change, condenser | yes | yes | room and body ports | yes (focused balance tests) | not recorded against independent data |
| gases and room box | yes | yes | yes (SPLIT §4) | yes | not recorded |
| reactions and element ledger | yes | yes | n/a | yes (per-step element check) | no (complete-within-step fallback) |
| environment place conditions | yes | yes | yes | yes | no |
| soil N/P/K ledger | yes | yes | ports in kernel.json | yes | no |
| R-1 placement and moves | here | no | no | no | no |
| R-2 η | here, values secondary | no | no | no | no |
| R-3 statics | here | no | no | no | no |
| R-4 rigid bodies | here | no | no | no | no |
| R-5 contact and friction | here | no | no | no | no |
| R-6 articulated statics | here, data null | no | no | no | no |
| R-7 ropes and beams | here, data null | no | no | no | no |
| R-8 buoyancy | here | no | no | no | no |
| R-9 energy accounting | here | partial (heat = M − W, `physiology.ts:401-405`) | no | no | no |
| R-10 contact to wound | here | no | no | no | no |
| R-11 ecology fix (Life's module) | here | no (defect confirmed) | n/a | no | no |

## 7. Validation

The analytic checks verify the mathematics. The independent data validate it; calibration data are declared and never
reused for validation.

| Mechanism | Must reproduce | Tolerance |
|---|---|---|
| R-1 + Life | the CG-5 field data: S5 measured 981 ± 91 mL O₂ kg⁻¹ unloaded and 1,310 ± 153 loaded on a mixed course | inside the measured mean ± SD, and no worse than Pandolf/Santee's published error (+17 %, about +12 %) |
| R-1 | CP-1: reachable, unreachable and unknown fixtures; no position change outside a move. CP-2: travel time = Σ d/V exactly with d in V's convention; progress after an interruption equals the committed steps; zero-length and vertical segments refused | exact (invariants) |
| R-2 | woodchips about 1.27 and dirt, gravel and grass about 1.0 at 1.25 m s⁻¹ (S11, not a source of the table's values) | within S11's reported SE |
| R-3 | ground reaction = body weight in standing, against force-plate records (to open) | 1 % |
| R-4 | drop 1 kg from 2 m: v = 6.263 m s⁻¹, impulse 6.263 N s; one minute of standing and a fall conserve energy (ROADMAP P2-1) | 0.1 % |
| R-5 | block on an incline starts sliding at tan θ = μ_s; sliding distance against μ_k analytic | 0.5 % (numerical), μ from the table |
| R-6 | static L5/S1 moment for a standard lift against a published biomechanics example (to open) | the source's own spread |
| R-7 | timber beam deflection against Euler–Bernoulli (P2-2) and handbook test data; a rope holds below and fails above its breaking load | 5 %; exact at the threshold |
| R-8 | a box hull floats at its Archimedes draught (P2-3) | 0.1 % |
| R-9 | per step, each pass-through account nets to zero; the M1b worked check (heat 514.1 W at 5 %); over a day, energy in = W_ext + Q + ΔU per body (P3-1 shares the mass side) | 1e-9 relative per step; 1 % per day |
| R-10 | punch impulse against instrumented-target data; penetration intervals contain the gelatin and tissue study results | measured value inside the interval; interval width reported |
| R-11 | the REAL-36 triple gives B ≥ 0 and catch ≥ 0; the exact step equals the closed form at 1, 10 and 100 days; at B ≤ K the result matches the Euler row within 1e-6 relative per day | as stated |

The milestone runs (PLAN-SPEC §4) use fixed seeds and replay, in paired provisioned and deprived configurations. The
outcomes are recorded, never tuned.

## 8. Build order (keyed to the PLAN-SPEC milestones)

Each stage names its units, their `Model:` per PRODUCTION §2, and the smallest useful demonstration. Nothing here is
queued until Rex approves the plan and the registry's integration map is reconciled.

| Stage | Needs | Units (`Model:`) | Unlocks and demonstrates |
|---|---|---|---|
| S0 | Rex's approval; `INTEGRATION-PLAN.md` reconciled (REAL-40 and REAL-42 ruled 2026-11-02) | none | the map |
| S1 fixes | S0; Life co-sign | REAL-36 exact logistic (codex) + test (composer); REAL-37 signed W_ext transfer and `work` account (codex) | stocks stay valid; body energy nets for either sign of work |
| CP-1, adjacent action (M1a) | S0; kernel 3006 and Economy 2999 (the eat resolver) | RN-1: the `reach` fixture edge kind, the same-cell predicate and the result record (codex, small), and its tests (composer) | prepared, uncontested bread within reach: the resolver reads Reality's reach result before Economy transfers anything. Weather and gathering are not needed (review 2026-11-02) |
| CP-2, travel (M1b) | CP-1; Life's documented locomotion model and the RN-2 contract (REAL-49); Cognition's move intention | RN-2: path validation, horizontal and path distance, grade, the movement state with per-step progress (codex); the η class table with ranges and source keys (composer); the R-9 potential-energy transfer per step (codex); Santee and Minetti primaries read (sonnet, web) | paths, time, progress and Life's locomotion model form one chain; an interrupted walk keeps its committed progress and energy; paired provisioned and deprived runs |
| CP-3, loads and work (M2) | CP-2; Life's capacity module (DUP-15) and segment table (REAL-48); RN-14 rows for the surfaces used | RN-3 support (codex); RN-5 sliding friction for a dragged load (codex); RN-6 static chain with tests (a) and (b) (codex); RN-7 rope and pulley statics (codex); breaking-load and η rows (sonnet research); `gather`'s physical side: demand and the transfer of the gathered mass (codex) | support, dragging and a bounded lift produce demands, the resolver compares them with Life's capacity, and the energy reconciles (RN-12) |
| CP-4, broader physical processes | CP-3 for RN-4 and RN-5; RN-14 rows per consumer; RN-9 to RN-11 run in parallel from S0 | RN-4 rigid bodies, RN-5 impacts, RN-7 beams, RN-8 buoyancy (codex); the review cards for heat, phase change, gases and reactions (sonnet audit, then composer tests) | each lane earns its own verification and validation results; P2-1 to P2-3; Settlement's walls; the ship floats |
| CP-5, environmental and injury connections (M3, M4 support) | S0 for the soil side; Catalogue's England 1270 series (NP-3); CP-4 and Life's injury representation for RN-13 | RN-11: the weather-input port schema on place state (composer, data contract, NP-3), CG-1 `place.par` and the CG-2 soil-water bucket (codex), soil credits from litter and excreta (codex); RN-13 contact events, energy allocation and penetration ranges (codex), and tissue ranges (sonnet research) | plants read light, water and soil from Reality, and waste returns to soil; contact reaches Life's injury model only within its supported domain |
| later | as PHASES-6-PLUS | phases 7, 8, 9 and 13 to 16 | the rest of P2 |
| — | — | close the R-9 sinks one at a time, each with a focused test, alongside CP-2 to CP-5 (RN-12) | whole-world energy check |

M5 (social organisation) asks nothing new of Reality beyond positions and masses.

**Where mechanics code lives (REAL-42, controller ruling 2026-11-02).** Mechanics is built in `realism/src/mechanics/`,
under the Reality side of the SPLIT 2f lint test, until SPLIT §5 step 4 moves it to `Toolchain/reality/`.

## Carried forward, superseded and gaps

- **Superseded.** PHASES-6-PLUS "Proposed build order" (lines 412-429) is replaced by §8 here. README "Next (the belt)"
  (lines 314-318) is also superseded.
- **Carried forward as reference.** The PHASES-6-PLUS phase scopes and acceptance tests: 6 and 6b in R-1 to R-10, and 7
  to 9 and 13 to 16 in §8 "later". Phases 10 to 12 and 17 to 19 are Life's and go to Life's plan, except the soil sides of 11
  and 16, which are Reality's.
- **Wording approved by Rex 2026-11-02** (it lands in PHASES-6-PLUS with the PLAN copy unit, after approval):
  - **REAL-38**, PHASES-6-PLUS:68. Today: "net force at the feet zero within the solver's tolerance". Proposed: "the net
    external force on the body is zero within the solver's tolerance, and the vertical ground reaction at the feet
    equals body weight, m·g, within the same tolerance".
  - **REAL-39**, PHASES-6-PLUS:115-121. Today: "each a cited range, never a fitted constant". Proposed: "each compared
    with a cited measured range. A parameter may be calibrated against an independent dataset declared as the
    calibration set and is then validated on a different dataset; no parameter is tuned toward a wanted outcome, and no
    fit is validated on the data that produced it (PLAN-SPEC §2 row 7)".
- **Gaps that stay open.**
  - Swimming and wading against a current (CG-5 E5).
  - Gait-cycle forces.
  - Balance.
  - Every "to open" source in §5.
