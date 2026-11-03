# Life: PLAN.md (Life keeper, 2026-11-02; draft in HQ, not committed)

Written to `HQ/handoffs/PLAN-SPEC.md`. It is the one authoritative plan for Life and consolidates
`Toolchain/life/DESIGN.md` (approved by Rex 2026-10-31; cited as **D§n**) with the organism code that still lives in
`Toolchain/realism` (cited `file:line`, realism HEAD 966121c). Ids: open items `LIFE-n` (ISSUES.md), questions `LIFE-Q`.
Evidence classes: **measured / calibrated estimate / assumption / fiction**; PLATFORM §4 levels in brackets.

## Pass 1 (one page)

**Present (implemented in realism, not connected to Cognition):**
- Eating: `eatMeal` turns food kg into kept energy, water and nutrient pools at once (`src/nutrition.ts:315-344`), with
  absorption rules (`:290-310`). The unabsorbed part goes to trace sinks only (`:325`, `:332`, `:339`).
- Energy in and out: `ingest` adds to a `intake_kcal` counter (`src/physiology.ts:347-357`). Expenditure is MET × RMR per
  step, with heat = M − W (`:392-402`).
- Stores: glycogen and fat change **once a day** from the day's balance (`src/nutrition.ts:455-485`). Nutrient pools are
  drawn daily and staged by thresholds (`:419-452`).
- Starvation: one crisis when fat reaches its floor or mass falls under a fraction of start (`:491-493`). Hydration
  crises come from bands (`src/physiology.ts:505-506`). The engine never kills; the host calls `declareDeath`
  (`src/crisis.ts:3-4`).
- Water balance: metabolic water, sweat, breath, skin diffusion and urine (`src/physiology.ts:419-449`).
- Plants: data only. `plants.json` has the schema, four species, pollinators, fixture sites and 27 sourced forms
  (2808 done, 2aeb07e). No `src/plant.ts` yet: 2815 {GROW} is queued and **unblocked**, and 3015 {CG21} follows it.
- Soil uptake account: `transferNutrient` to `plant:<id>` (Reality's `src/soils.ts:110`).
- The old field model: `harvest` from max yield × rain × labour (`src/ecology.ts:201`). This is DUP-53; it is superseded
  by plant growth and kept only as a read.

**Missing (M1a breaks here):**
1. **No single transfer from inventory to body (LIFE-19).** Economy `takeMass` debits stock with `adjust`
   (`economy/src/commands.ts:229`), and `eatMeal` credits the body separately (`nutrition.ts:340`). They agree only
   because the host passes `takenKg` along (`economy/test/food-to-body.test.ts:64-67`). It is not one kernel `transfer()`.
2. **No digestion (LIFE-20).** Absorption is instant. There is no gut content, gastric emptying or transit, although
   `realism.metab.flux_digestion_atp` is registered as planned.
3. **No hunger or satiety writer (LIFE-21).** `body.hunger_signal` and `body.satiety_signal` are registered, and
   Cognition reads them (`cognition/src/needs.ts`, signal source), but nothing writes them. Neurology reads a host
   `p.hunger` (`src/neurology.ts:172`). The library's `fullness` and `hunger` rules (mass/600 g, 0.15/h, +0.05/h) carry
   no source.
4. **Stores change only daily (LIFE-22).** A meal cannot change the next decision within the day except through gut
   state, and there is none.
5. **No waste store (LIFE-23).** Faeces, urine and pool overflow go to trace names (`waste`, `unabsorbed`, `excreta`,
   `urine`) with no ledger account. M4 needs them as mass that can reach soil.
6. **Starvation limits are unsourced (LIFE-25):** the 3 kg fat floor and 60 % of start mass are `proposed/open` rows.

**Quantities Life owns (pass 2 §2):** body mass; fat; glycogen; nutrient pools; body water; gut contents (new);
`body.hunger_signal` and `body.satiety_signal` (new writers); `body.energy_requirement` (5425); `body.capacity_functional`
(DUP-15); plant_state organ pools; seed bank; detritus (new); excreta (new); the crisis and death ledger.

**External inputs:** a consume intention (Cognition, `cognition.intention`, via the host); food mass taken (Economy
inventory, or Life's own `plant_state` for wild food); air, temperature, wind and humidity (Reality); soil pools,
water and light (Reality; a fixture until built); the activity schedule (MET, from the host now and from Cognition's
acts later).

**Outputs:** `shared.action.outcome` for eat (status, stimuli of gastric fill and taste); hunger and satiety signals;
capacities; crises and deaths; transfers of nutrients and water to and from soil, CO₂, O₂, heat and water vapour to air,
excreta to a place, and harvested biomass to Economy.

**What Life gives M1a:** the eat resolver's body side, digestion, the stores, and the signals that change the next
decision. The paired scenarios are fed (stable within the validation band) and food-deprived (glycogen gone → ketosis
→ wasting → the starvation crisis → host-declared death).

**Flagged assumptions:** absorption factors are `proposed` library rules; the daily store update is level 4; the
hunger and fullness numbers are unsourced and must not drive M1a; REAL-12 (whether an `estimate` may drive a process)
is still open.

**Next dependency-ready tasks (when the belt restarts):** the LN-1 and LN-2 specifications ({FOODS-1270} and
{R-INTAKE}), with {R-TRANSIT} (LN-3 and LN-4 model selection) researched in parallel (sonnet, web; §8.1). They need
nothing. The earlier single {GASTRIC} research unit is withdrawn and split by lane (review, 2026-11-02).
The eat-transfer contract with Economy and the kernel (LIFE-19) is in-session work
with the Economy keeper, done before any code unit.

---

## Pass 2: the full plan

### What this pass consolidates

| Source | Carried into | State |
|---|---|---|
| D§0 (purpose, fence, three records) | §1 | carried, with boundaries sharpened |
| D§1.1–1.7 (species record, plant records, carbon gain, damage, reproduction, pollinators, resolution) | §2, §3.C | carried unchanged (Rex approved) |
| D§1.8 (litter and detritus) | §3.D | **extended**: decomposition and excreta are designed here for M4 |
| D§1.9 (maturation), D§1.10 (tissue populations) | §3.E | carried; not on the M1a path |
| D§2.1–2.3 (kernel processes, ports) | §4 | carried, with the eat, harvest and waste ports added |
| D§2.4 (CG-13, 21, 3, 4, 12, 23, CG-16 position, C-Q26, IF-27) | §3.A, §3.C, §4 | carried. The CG-16 position is **refined**: the body side stays the same, and the transfer becomes one kernel `transfer()` (LIFE-19) |
| D§3 (four-species demonstration) | §8 stage M3-0 | carried |
| D§4 (validation plan) | §7 | carried, plus the M1a and M4 validations |
| D§5 (LIFE-Q1 to Q5) | §5 | carried as Rex's decisions |
| realism `nutrition.ts`, `physiology.ts`, `crisis.ts`, `ecology.ts`, library rows | §2, §3.A, §3.B | inventoried below. `ecology.harvest` (yield table) is **superseded** by §3.C as a read (DUP-53) |

Nothing in DESIGN.md is dropped. Where this plan and DESIGN.md differ, this plan wins once Rex approves it. DESIGN.md
then stays as the rationale record.

### Controller rulings received (2026-11-02, via the registry; recorded in INTEGRATION-PLAN.md; Rex may override)

- **M2-04b:** Reality owns task demand. Life computes effort = demand ÷ capacity, then MET, energy and fatigue (§3.A11, A12).
- **NP-11:** with no game host, the harness declares death exactly when Life's terminal criterion is met, and adds no
  rule of its own. Life owns the criterion and its source (LIFE-25). While it is unsourced, the deprived arm records
  "terminal state reached" (§3.A10).
- **DC-3:** `ecology.harvest()` stays a labelled interim with no new consumers until M3. After that, Government's demo
  reads Life's yield (§3.C3).
- **DC-13:** one outcome per intention, emitted by the host. The eat entry is one `transfer()` in kg, keyed by Life's food
  id (§3.A4, A7).
- **DC-14:** Settlement composes productivity in `labour_cap`, reading Life's capacity and effort (§4 E6).
- **REG-38 / CAT-13 (Rex):** the M1a world is England 1270, with cereals as the food. Life's M1a composition rows are
  one bread loaf (`catalogue/product.<bread>`), with no composition row yet ({FOODS-1270}).

### 0. Inventory (PLAN-SPEC §3 rule 1)

**What the code calculates today (realism HEAD 966121c):**

| Calculation | Evidence | Class |
|---|---|---|
| Food kg → kept kcal, water and nutrient mass, by absorption rules, in one call | `src/nutrition.ts:315-344`, rules `:290-310` | rules `proposed` in `nutrition.json` absorption; energy basis Atwater metabolisable (LIFE-17, 5256) |
| Energy intake counter; expenditure = MET × RMR-corrected W × dt; heat = M − W | `src/physiology.ts:347-357`, `:392-402` | MET rows researched; RMR formula researched |
| Water balance: metabolic, sweat (ISO 7730/7933), breath, skin diffusion, urine | `src/physiology.ts:411-449` | researched forms |
| Glycogen and fat from the day's balance, once a day; glycogen-bound water | `src/nutrition.ts:455-485`; `:381-389` | rules `proposed/open` (7700 kcal/kg, 400 g cap, carb × 0.8, 60 g per MET-h over 4) |
| Nutrient pools: daily use, overflow to `excreta`, stages, recovery days | `src/nutrition.ts:419-452` | per-pool rows, mixed |
| Starvation crisis (fat at floor and deficit, or mass < 60 % of start) | `src/nutrition.ts:491-493` | `proposed/open`, no source (LIFE-25) |
| Hydration crises by deficit band | `src/physiology.ts:505-506` | researched bands |
| Crisis and death ledger; `declareDeath` refuses a body with no crisis | `src/crisis.ts:1-114` | rule |
| Subsistence energy requirement (queued) | realism 5425 | — |
| Soil N/P/K cells; the only writers `transferNutrient` and `addNutrient` (Reality's) | `src/soils.ts:89-117` | Reality |
| Field yield = max × rain × labour, fertility f drained by crop (DUP-53, DUP-51) | `src/ecology.ts:201-265` | superseded, kept as a read |

**Exists only in documents:** plant growth (D§1.3; code in queued 2815); one biomass store and uptake (3015);
decomposition (registry `realism.ecology.decomposition`, planned); digestion and transit
(`realism.metab.flux_digestion_atp`, planned); hunger and fullness (`realism.nutrition.hunger_fullness`,
documented-only, library rows `nutrition.body_composition.fullness` and `.hunger` without sources); excreta and
sanitation (`realism.waste.sanitation_decomposition`, planned); `body.capacity_functional` (DUP-15, no writer).

**Comes from a fixture, constant or the host today:** the activity schedule (MET by hour; `physiologyProcess` option);
`p.hunger` (read by neurology `src/neurology.ts:172`, written by nobody); gut function (`MealOptions.gutFunction`, a
caller argument); meal flags (cooked, raw fish, tea); the room's air; the plants' environment (fixture sites,
`plants.json` `fixture_sites`); `takenKg` handed from Economy to `eatMeal` by the host.

**Should eventually come from another engine's mechanism (the integration list):**
- the activity schedule from Cognition's acts and their MET (M1a, M2);
- gut function from anatomy's organ function (Life internal);
- meal flags from the food's processing history (Economy production: cooked, nixtamalised);
- air from Reality atmosphere;
- plant environment from Reality's ports (D§2.3, LIFE-2);
- `takenKg` from one kernel transfer (LIFE-19);
- `p.hunger` from Life's own hunger writer (LIFE-21).

## 1. Purpose and boundaries

**Life determines what a body is and can do**: the state of every organism (three records, D§0), the conversion of
food into body stores and of stores into capacity, the plant's conversion of light, water and nutrients into biomass,
death, and the decomposition of dead organic matter and excreta into mineral nutrients.

**Life receives:** intentions to eat or harvest (Cognition, through the host resolver); food mass (Economy inventory,
or a Life plant for wild food); air and place state (Reality); soil available pools and water (Reality); light, rain
and VPD (Reality, a fixture until built); time, ids, RNG, transactions and `transfer()` (Kernel).

**Life must never calculate (owned elsewhere):**

| Not Life's | Owner | The seam |
|---|---|---|
| Whether to eat, what, how much; appetite, preference, palatability as value | Cognition (DUP-49) | Life writes `body.hunger_signal`, `body.satiety_signal`, `body.taste_percept`; Cognition reads them. Life never selects an act |
| Inventory stock counts, prices, ownership of food, spoilage of stored goods | Economy | Food leaves an inventory only through one `transfer()` whose source endpoint is Economy's ledger (§4 E1) |
| Soil stocks and soil processes (mineralisation of soil organic matter, leaching, erosion, weathering, sorption) | Reality (`realism.terrain.soils`) | Life writes only uptake transfers out of the available pool and litter or excreta transfers into `detritus`. Decomposition's mineral output enters soil through Reality's `addNutrient` (§3.D) |
| Mechanics of an act: force, distance, slope, walking cost | Reality (mechanics; CG-5) | Reality supplies the demand; Life compares it to `body.capacity_functional` |
| Weather, light, air composition, water column | Reality | ports (D§2.3) |
| Harvested wood, fibre and sugar as materials; processing (milling, cooking) | Reality (materials), Economy (production) | Harvest is one transfer out of `plant_state` (§3.C) |
| Households, labour norms, migration choices | Society | demography stays in Life until Society takes it (DUP-41) |

**Boundary with Reality, stated once.** Reality owns everything abiotic: the soil's mineral and organic stocks, water,
air and energy in the environment, and the mechanics of acts. Life owns everything living and every flux across a living
boundary: uptake, transpiration, respiration, ingestion, absorption and excretion. Life also owns **dead organic matter
until it is mineralised** (`world.detritus`: litter, dead organisms, excreta). The hand-off point is the mineral flux.
Decomposition moves N, P, K and C from `detritus` into the soil's available pool (or to air as CO₂) in one transfer.
After that the nutrient is Reality's. **Open boundary item LIFE-26:** Reality's soil state lists "organic matter". If
Reality models soil organic matter as its own stock, then the humified part of detritus becomes a transfer from
`detritus` into it, Reality's mineralisation of it is the other decomposition, and the two must not both mineralise the
same carbon. This is agreed with the Reality keeper before M4 is built.

**Boundary with Economy, stated once.** Economy owns goods in inventories (counts × `good.weight` kg) and every change
of their holder. Life owns food from the moment it crosses into a body (the gut account) and plant biomass while it is
standing. The two meet at exactly two transfers, **consume** (inventory → gut) and **harvest** (plant organ → inventory).
Each is one kernel `transfer()` with Economy's ledger at one end and Life's at the other, in kg (§4 E1, E4). Economy never
computes energy or nutrients; Life never decrements a stock. The `takeMass` + `eatMeal` pair becomes one transfer.

## 2. State

**Class key:** **B** = balance quantity (mass, element or energy; has a balance equation with a declared boundary,
§3); **I** = invariant and update rule.

### 2.1 Body (human first; other animals by species record)

| Quantity | Unit | Range | Meaning | Class | Today |
|---|---|---|---|---|---|
| `body.mass` | kg | > 0 | total body mass; sole writer `bodyMassDelta` | B (mass) | built `nutrition.ts:392` |
| `body.gut[c][food]` (c = stomach, small intestine, colon) | kg (wet) per food id; plus kcal, nutrient mass carried | ≥ 0 | food in transit, not yet body tissue | B (mass, energy, each nutrient) | **new** (LIFE-20) |
| `body.faeces_store` | kg (wet), with N, P, K, C, water | ≥ 0 | colon content ready to void | B | **new** (LIFE-23) |
| `body.urine_store` (bladder) | kg, N (urea), K, Na | ≥ 0 | urine produced and not voided | B | `p.urine_kg` counter only (`physiology.ts:442`) |
| `body.glycogen` | g | 0 to the record's cap | carbohydrate store | B (energy) | built, daily |
| `body.fat` | kg | ≥ floor | lipid store | B (energy) | built, daily |
| `body.lean` | kg | > 0 | lean tissue (muscular development sum × size constant) | B (mass) | rule only (`body_composition.lean-mass`) |
| `body.nutrient_pool[n]` | the pool row's unit (mg, g) | 0 to full | micronutrient and protein pools | B (mass of element or compound) | built |
| `body.water` | kg | ≥ 0 | one content ledger, with a derived deficit % | B (mass) | built |
| `body.energy_absorbed` / `body.energy_spent` | kcal (cumulative) | ≥ 0 | flux integrals; their difference closes against stores | B (energy) | built as `intake_kcal`, `expenditure_kcal` |
| `body.hunger_signal` | 1 | 0 to 1 | interoceptive hunger; Cognition's deficit input | I | **writer new** (LIFE-21) |
| `body.satiety_signal` | 1 | 0 to 1 | interoceptive fullness | I | **writer new** |
| `body.gastric_fill` | kg (and L) | ≥ 0 | a read of `body.gut[stomach]`; the outcome stimulus | I (derived) | **new** |
| `body.taste_percept` | 1 per taste category | 0 to 1 or absent | the sensory half of palatability | I | planned, absent until researched |
| `body.starvation_stage` | category | none, post-absorptive, glycogen-depleted, ketotic, wasting, terminal | a derived read of stores (§3.B4) | I (derived) | `starvation_limit` 0/1 only |
| `body.capacity_functional` | per named capacity, physical units (W, N, h endurance) with a 0–1 view | ≥ 0 | what the body can deliver now | I (derived from state) | **no writer** (DUP-15) |
| crisis and death records | records | — | one cause per death | I (append-only; one death per body) | built `crisis.ts` |

### 2.2 Plant (D§1.2; code in 2815 and 3015)

| Quantity | Unit | Range | Meaning | Class |
|---|---|---|---|---|
| organ tissue populations (leaf, stem or wood, root, rhizome, reproductive) | kg dry mass, C fraction | ≥ 0 | the only store of biomass (CG-21) | B (mass, C) |
| tissue N, P, K | kg | ≥ 0 | nutrient content of the organs | B (element) |
| plant water | kg | ≥ 0 | tissue water (relative water content) | B (mass) |
| non-structural carbohydrate | kg | ≥ 0 | reserve | B (C) |
| leaf area, height, diameter | m², m, m | ≥ 0 | derived by allometry | I (derived) |
| maturity stage | category | — | from size and age, per record | I |
| alive or dead, life-cycle ledger entry | flag, record | — | one death per plant | I |
| seed bank | count and kg per species and cell | ≥ 0 | propagules | B (mass) |
| `world.vegetation_stock` | kg | ≥ 0 | derived sum (CG-21) | I (derived; never integrated) |

### 2.3 Dead matter and waste (M4; new)

| Quantity | Unit | Range | Meaning | Class |
|---|---|---|---|---|
| `world.detritus[cell][kind]` (kind = leaf litter, wood, root, carcass, faeces, urine) | kg dry mass, with C, N, P, K | ≥ 0 | dead organic matter on or in a cell, not yet mineralised | B (mass, C, each element) |
| `world.mineralisation_flux_{n,p,k}` | kg d⁻¹ | ≥ 0 | a read of the transfers detritus → soil | I (derived from transfers) |
| decomposer biomass | — | — | **not represented** (first-order decay; §3.D). It is added only if validation fails for want of it | — |

### 2.4 Population (until Society)

Counts by cohort, plus individuals. **C-Q26:** Σ individuals + Σ cohort counts is invariant under promotion and
demotion. **Not built** (corrected 2026-11-02, LIFE-32): `population.ts` has no promotion or demotion function;
`labour-intentions.ts:86` leaves the move to a host transaction. The move is Life's transaction: a promoted person's
share of the cohort's state, including that day's cohort intake, goes into the new individual's body state, and a
demoted individual's state joins the cohort's. How a cohort intake share becomes an individual's gut and store state
is open (it needs Life's cohort model, phase 19). Economy moves no material for a membership change (EN-5).
**Boundary-aligned for M1a (agreed with Economy, 2026-11-02):** a promotion or demotion requested mid-day takes
effect at the next declared boundary, the end of Economy's daily consumption step. Until then the person stays
represented once, on the path they started the day on. At the boundary Life's transaction settles the interval and
moves stores and intake history. Test, once the cohort model exists: a midday promotion and a midday demotion, with no
extra debit, no omitted intake and no duplicated stores. Immediate transitions come later. M1a itself has one
individual body and no cohort, so this test belongs to the cohort lane, not to CP-1 to CP-3.

## 3. Mechanisms

Every mechanism is written as a chain: **from** (input and producer) → **computes** → **changes** (output and the
next consumer).

### 3.A The eat resolver, end to end (M1a)

Order inside one kernel instant, phases `fast` → `cognition` → `host` (kernel default order, unit 2660).

**A1. Intention (Cognition, not Life).** `cognition.decision.select` emits `cognition.intention { id, actor, act:
'consume', target, terms: { kg } }`. It reads `body.hunger_signal` and `body.satiety_signal` (A8) through
`cognition.needs.drive`. The host maps `consume` and the target to a source. **Who supplies kg:** the repertoire entry
(host data) or Cognition's evaluation. Life never chooses the amount. It only caps it physically (A3).

**A2. Preconditions (Life, pure read; `life.eat.preconditions`, part of `realism.nutrition.eat_meal`).** The act is
**impossible** (no transfer, no effort) only from represented bodily or physical constraints:
- the body has a death record;
- the source holds 0 kg;
- the stomach is full against the declared capacity: sourced, or until then a declared, labelled fixture (LN-2, RC-11).

Not in-world outcomes: a declared food with a missing or ambiguous composition fails configuration before the run
(LN-1 §1); a good outside the scenario's supported ingestion pathway, and invalid input, are host or configuration errors, recorded in the trace and never an in-world outcome; no physiological conclusion is invented for them (agreed with Economy, 2026-11-02). `gutFunction` is an absorption multiplier, not an ability to swallow, and is not a
precondition (LN-2). Inability to ingest (Life) and inaccessible food (Reality's reach) need their own sourced outcomes
later.

**Beside Reality's reach (RN-1, proposed to Reality 2026-11-02).** The resolver composes two pure reads before it opens
the transaction, both from committed state at that instant: Reality's reach record (`reachable | unreachable |
unknown`, basis `fixture-adjacency` at CP-1) and Life's preconditions above. Life never reads reach, and Reality never
reads the body. Every condition is evaluated in a fixed order (death record, reach, source 0 kg, stomach full), and the
one outcome lists every failing reason. `unreachable` is an in-world `impossible` with reason "unreachable" and the
trace's fixture basis. Reach `unknown` is missing data, so it is a host error recorded in the trace, with the missing
inputs named, and no in-world outcome (the rule above), not `impossible`.

The act is **failed** (no transfer) when the source's owner refuses: Economy's `refused`, for example an inventory the
actor may not take from (C-Q25). What it costs is A12's rule: only the activity actually performed, for its actual
duration. The fence test: the preconditions never read `mind.*`.

Which bodily conditions make ingestion impossible beyond the four above is LN-2's to source. None is added because a
reviewer listed it (for example posture). The scenario's access arrangement is checked separately by the resolver, and
legal and customary permission keep their existing owners.

**A3. Amount.** `q = min(q_requested, q_available, q_gastric_room)`, **valid only when all three are in one unit**.
The resolver works in kg of the food as prepared.
- `q_requested` is `terms.kg`; `q_available` is Economy's read for an inventory (`stock × weight`), or the plant
  organ's edible fresh mass for wild food.
- `q_gastric_room = capacity − gut[stomach]`, in kg. If the capacity model LN-2 selects is a **volume**, LN-2 must also
  state how the preparation maps to occupied volume (its sourced density or specific volume in LN-1's composition
  record, and whether swallowed air or added water count). Without that mapping the volume cap cannot be compared with
  kg and is not applied.
- Until LN-2 lands the capacity is **null, and no cap is applied**, with a flag line. Cognition's `terms.kg` is then
  the only limit. This supports the accounting test (CP-1) only; it **cannot** establish realistic intake limits or meal
  sizes.
- The duration of ingestion (intake rate) is LN-2's too; null until sourced, and A12 then has no duration to charge.
- A smaller q than requested is `completed` with q (Cognition DESIGN §2.4; Economy 3010).

**A4. The one transfer (LIFE-19; Kernel `transfer()`).** One `TransferRequest`:
- `quantity`: the nutrition food id (Economy maps it from `Good.food`; DC-13);
- `unit`: `kg`;
- `amount`: q;
- `from`: `{ ledger: economy.goods (kg view), account: <inventory>/<good> }` (the view throws before anything moves unless `foodOf(good)` equals the quantity);
- `to`: `{ ledger: life.gut, account: <body>/stomach }`;
- `process`: `shared.action.consume`.

**DC-13 (agreed text, registry INTEGRATION-PLAN M1a-17, M1a-20, M1a-25, 2026-11-02).** Economy writes the entry, from its kg goods view to Life's `life.gut` ledger, which the host passes beside the command (the CONTRACTS §20 pattern). The command carries `resolvedBy: 'host'`, so it tags its records with the cause and emits no outcome. `eatMeal` never writes the mass again. A failed resolution leaves zero journal entries. **The entry is keyed by Life's food id** (Life keeper, 2026-11-02, accepting Economy's proposal): Economy maps the good through `Good.food`, and `life.gut` then needs no knowledge of goods. Both ledgers declare `kg` for that quantity, because
`transfer()` does no conversion (`kernel/src/transfer.ts:76-106`). This needs two contract changes:
- **Economy:** its goods ledger answers `unit(inv, good) = 'kg'` through a mass view, and `apply` converts by
  `good.weight`. Today `goodsLedger` answers `count` (`economy/src/goods-ledger.ts:12-17`), and `takeMass` uses
  `adjust`, not `transfer()` (`commands.ts:229`).
- **Life:** `life.gut` is a `TransferLedger` (snapshot and restore over the body components). Its entries are keyed by the nutrition food id, which Economy maps from the good's `food` field (CG-19; DC-13). Life never imports
  Economy.

For wild food the source is Life's own plant ledger (`plant:<id>/<organ>`, §3.C3), and the same request shape applies.

**A5. The body receives once.** `life.gut.apply(+q)` adds q kg of that food to `gut[stomach]`. It carries the food's
kcal, water and nutrient content per kg from the nutrition table (`foodContent`), so energy is attached to mass by the
one owner of that conversion (CG-23, CG-19). **No energy or nutrient enters a pool at this point.** This is the change
from today's `eatMeal`, which absorbs at the moment of eating. `eatMeal` becomes the composition of A5 to A6 run to
completion, kept for tests and for hosts with no time step.

**A6. Digestion (row `realism.metab.flux_digestion_atp`, renamed `life.digestion.transit`; new code).** Every `fast`
step:
1. **Gastric emptying.** Mass and energy move from the stomach to the small intestine at a rate set by the stomach
   content's energy and composition. The candidate form is energy-limited emptying (an approximately constant kcal per
   minute after a lag, for mixed meals), with the alternative a power-exponential volume curve. **Both forms and their
   constants are null until {R-TRANSIT} selects one (LN-3).** The form chosen is the one whose source reports meals like the
   scenario's. Each emptying is an internal transfer `stomach → intestine` (Life ledger; conserving).
2. **Absorption.** From the small intestine, each nutrient moves to its pool, and energy to `body.energy_absorbed`, at
   the absorbed fraction the existing rules give (`absorbedFraction`, `nutrition.ts:290`, now applied here, with the meal
   context recorded at ingestion). The unabsorbed part moves on to the colon. The absorption rate is limited by intestinal
   transit: the candidate is a transit-time distribution, with its constant null until {R-TRANSIT} (LN-4).
3. **Colon.** Water is reabsorbed to `body.water`, and the residue moves to `faeces_store`. The fibre fermentation
   energy is a CG-10 term, **omitted and flagged** until that research lands. Faecal energy is
   `E_eaten − E_absorbed` (CG-13's waste term, now a store rather than a trace sink).

**Balances per step: one per tracked quantity, each in its own unit and with its own boundary** (the earlier single
equation mixed water mass into the energy and nutrient balances and is withdrawn). The compartments are stomach →
small intestine → colon → `faeces_store`, with `absorbed` leaving the gut boundary into the body pools:
- **Total mass (kg):** `Δm_stomach + Δm_intestine + Δm_colon + Δm_faeces_store + m_absorbed_dry + m_water_absorbed = 0`,
  where `m_water_absorbed` is water taken up anywhere in the gut (small intestine and colon), entering `body.water`.
- **Water (kg):** `Δw_stomach + Δw_intestine + Δw_colon + Δw_faeces_store + m_water_absorbed = 0`. Secretions into the
  gut (saliva, gastric and intestinal fluid) are a represented inflow only if LN-4 or LN-7 selects a model that has
  them; otherwise they are a **declared boundary**, named in the test, never a silent term.
- **Energy (kcal):** `ΔE_stomach + ΔE_intestine + ΔE_colon + ΔE_faeces_store + E_absorbed = 0`. Water carries no energy
  term. Colonic fermentation energy (CG-10) is omitted and flagged.
- **Each nutrient i (its own unit, g or mg):** `Δn_i,stomach + Δn_i,intestine + Δn_i,colon + Δn_i,faeces_store +
  n_i,absorbed = 0`.

Overlapping categories in the composition (for example sugars inside carbohydrate, or fibre inside carbohydrate by
some methods) are tracked once, at the level LN-1's record declares; a test asserts no constituent is counted in two
balances.

**Temporary approximation until LN-3 and LN-4 land (allowed by PLAN-SPEC §3 rule 2):**
- a single compartment, with the meal absorbed over one `fast` step (today's behaviour);
- **what cannot be claimed:** any timing of satiety or hunger after a meal, or the meal-to-meal interval.

M1a's once-only accounting can still be demonstrated under it.

**A7. Outcome (to Cognition; DC-13, agreed with the registry 2026-11-02).** The host resolution (specified by History, built by Kernel in the harness, REG-39) is the **only emitter**. After A4 commits or rolls back it emits
`shared.action.outcome { cause: <intention id>, status, stimuli, payload: <transfer entry> }`. The stimuli are:
- the scene change, observable by anyone present: the source reduced by q kg, or emptied;
- to the actor only: `gastric_fill_kg` (the new `gut[stomach]`), and `taste_percept` by category, absent until its
  writer exists (never a default).

Satiety and hunger are **not** in the outcome. They change over the following steps through A8, and Cognition's
attribution handles the delay (Cognition DESIGN §2.4).

**Exactly one outcome per intention (LIFE-27, risk).** Economy's `reduce` emits its own outcome when a command carries
`cause` (`economy/src/reduce.ts:26-55`). DC-13: engine commands inside a host resolution tag their records with `cause`
but emit no outcome, and Life's leg returns its stimuli in its result. `impossible` is decided before any transaction
opens, and the host still emits its one outcome. A test asserts one outcome per cause.

**Rollback (Rex, 2026-11-02).** If the food transfer fails, the participating food and gut state, the transfer journal
and the transactional events are restored; no successful-transfer event survives. After the rollback the resolver
emits **exactly one** `failed` outcome for the intention, so the failure is still perceived and learned from. "No
committed food transfer" never means "no feedback to Cognition". Activity expenditure already committed before the
failure (A12) is unchanged by the rollback.

**A8. Signals (row `realism.nutrition.hunger_fullness`; Life writer; new code; LN-6).** Three distinct quantities,
never derived from one another by default:
- **gut fill** (`gastric_fill_kg`, and the volume if LN-2 has one): a physical state of the stomach, read directly
  from the gut ledger. It is a measured quantity, not a signal.
- **`body.satiety_signal`** (fullness and satiety): its inputs are whatever LN-6's selected model supports. Gastric
  distension is one candidate input; intestinal nutrient sensing and hormonal signals are others, included only where
  the selected source models them.
- **`body.hunger_signal`**: its inputs likewise come from the selected model. Candidates are time post-absorptive,
  glycogen fraction and the fat store trend.

**Overlap declared (C-Q33, for Cognition):** LN-6's card states whether `body.hunger_signal` already carries any satiety influence (gastric fill, intestinal nutrient sensing). Cognition reads satiety as an observation and does not subtract it from hunger, provisionally (Rex), so if the selected hunger model includes such an input, the card says so and the contract is revisited before {SIGNALS} is built. The inputs are not selected yet.

**Hunger is not computed as the inverse of stomach contents**, and satiety is not gut fill rescaled. A test asserts
that each signal's inputs are exactly those LN-6 declares. Learned expectation and central processing are Cognition's
interpretation of these signals (Cognition DESIGN §2.4); Life does not model them, and Cognition does not invent the
signals.

**Status of the mapping:** physiology gives candidate inputs (fill, absorptive state, stores, all measured
quantities). The mapping to a 0–1 signal is an **assumption (level 4)**. It is validated against published visual-analogue hunger and
fullness ratings after test meals, which {R-SIGNALS} (LN-6) opens and keeps apart from the data the mapping is calibrated on.

The library rows `body_composition.fullness` (mass/600 g, −0.15 h⁻¹) and `.hunger` (+0.05 h⁻¹, …) have no source. They
may serve only as the labelled temporary approximation (class: assumption, origin: game rules). They are replaced as
soon as LN-6 lands. Under them M1a may claim that "satiety changes the next decision", but not when or by how much.

**A9. Stores (row `realism.nutrition.energy_store`; built, to be made per-step: LIFE-22; LN-5).**

*The balance (an accounting identity, every store converted to energy):*
`e_g·Δm_g + e_f·Δm_f + e_p·Δm_p + (other represented store changes) = E_absorbed − E_expended`,
with `m_g` glycogen, `m_f` fat and `m_p` body protein in grams or kg, and each `e` that store's energy density in
kcal per the same mass unit, sourced. (The earlier form `Δglycogen + Δfat·e_fat` left glycogen in grams on an energy
equation and is withdrawn.) This identity constrains the implementation; **it does not decide how the change divides
between stores.**

*The allocation (a separate model, LN-5 must select and source it):* which substrate is stored or used, as a function
of nutritional state, time since the meal and activity. The built rules are a candidate only, class **assumption**
until re-sourced ("60 g per MET-hour", carb × 0.8 at absorption):
1. absorbed carbohydrate fills glycogen up to the cap;
2. the deficit draws glycogen first, then fat down to the floor;
3. below the floor, lean tissue (A10).

A model can close the balance exactly and still produce unrealistic starvation or weight-change trajectories, so LN-5
is validated on the trajectory of each store (or of body composition), not on the balance.

*Timing.* Expenditure accumulates over each activity's duration even where a store is updated later. LN-5 tests
whether a delayed store update produces **wrong within-day feedback** (for example the hunger signal or glycogen factor
lagging a meal or exertion it should already reflect); that test, not the update interval itself, decides whether the
daily close must become per-step.

*Body mass (`body.mass`, kg; Life is its only writer, §2.1).* What it includes is defined here and tested:
`body.mass = tissue (lean, fat, glycogen and any water bound with it, as LN-5's model represents it) + body.water +
gut contents (stomach, intestine, colon) + faeces_store + urine_store`. Reality uses this whole-body mass for movement
and load. The no-double-counting tests:
- ingestion raises `body.mass` by q (the gut gains q, nothing else changes);
- absorption leaves `body.mass` unchanged (mass moves inside the boundary);
- respiratory and skin water loss, CO₂ loss and voiding lower it by exactly the amount that crosses out;
- the five terms are **non-overlapping accounting categories** (Rex, 2026-11-02). If LN-5's tissue masses already
  include their water (for example a fat-free mass that contains water), that water is not added again in
  `body.water`, and `body.water` then means only the water not inside a tissue term; the same for glycogen-bound water.
  Gut-content water is only in the gut term. Colon contents (material still in the absorbing compartment) and
  `faeces_store` (material past it, awaiting voiding) are disjoint: a gram moves from one to the other by an internal
  transfer and is never in both. A test sums the categories from their own records and asserts each gram of tracked
  material is held by exactly one.

The test: the per-step store integrated over a day equals today's daily close to a tolerance the step-convergence test
(LIFE-11) states. The existing check `energy:stored` (`nutrition.ts:485`) stays.

**A10. Starvation path (rows `realism.nutrition.starvation_limit`, muscular energy gate).** Intermediate states as a
derived read (`body.starvation_stage`), never a clock:

| State | Defined by (state, not days) | What changes |
|---|---|---|
| post-absorptive | gut empty of absorbable energy | the hunger signal rises (A8) |
| glycogen-depleted | glycogen ≤ a sourced residual | the endurance factor `glycogenFactor` falls (built `nutrition.ts:403`) |
| ketotic | glycogen depleted and the deficit met from fat | capacity factor per a sourced row (today ×0.8, `proposed/open`) |
| wasting | the fat share is falling and lean loss has begun (muscular gate) | capacity falls with lean mass; immune row |
| terminal | fat at floor with an unmet deficit, or mass below the sourced limit | starvation crisis opens (`trackCrisis`, built) |

Death is the host's call on an open crisis (`declareDeath`, `crisis.ts:4`). The M1a deprived harness declares death when
the crisis row's death condition is met, and records which condition. The thresholds (the 3 kg fat floor, 60 % of
start mass, ×0.8 and ×0.5) are `proposed/open`, with no source (LIFE-25). {R-DEPRIV} (LN-9) also opens the independent fasting
data (§7). The thresholds then become researched or stay null. **If they stay null, the deprived run ends at "terminal
state reached" without a declared death, and that is reported as the result.**

**A11. Capacity (`body.capacity_functional`, DUP-15; LN-8).** A record of named capacities, **each a physical
quantity with a declared unit**: `capacity = baseline × Π(state relationships)`, where the baseline carries the unit
(for example W for sustainable power, N for force) and comes from a sourced relationship for that body (anthropometry,
sex, age, training), and each state relationship is a sourced function of one owner's state. A product of
dimensionless factors on its own is another dimensionless factor, not a capacity, and is withdrawn as a definition.
- Candidate state relationships already present: the glycogen factor (`nutrition.ts:403`), hydration, heat work
  capacity, the starvation stage. Each is used once; a test asserts no impairment enters a capacity twice.
- **Scope for M1a:** only the capacities the M1a acts actually require. LN-8 first establishes whether eating has any
  capacity demand a source supports. If none does, M1a has no capacity check on eating, and the deprived scenario's
  "capacity falling" is reported through the state relationships alone. Full lifting and work capacity wait for the
  movement and work lane (§3.F); they are not invented to complete the eating test.

Incapacity is when a capacity falls below an act's demand **in the same unit**. It is then reported as
`failed: capacity`, and the act is never silently skipped.

**A12. Effort of eating.** Charge **the activity actually performed, for its actual duration**, once, through the
existing expenditure path (`physiology.ts:392-402`):
- **completed:** the eating activity's MET (a physiology MET row, researched) for the ingestion duration (LN-2);
- **impossible:** no execution cost for the unperformed act;
- **failed:** no execution cost for the unperformed act. Time and expenditure already incurred before the failure
  (approaching, handling or evaluating the source) are still charged, under the activity that was actually performed,
  not under eating.

### 3.B Water

Drinking is the same resolver with water as the good: `gut[stomach]` gets water, and gastric emptying of water uses its
own sourced rate (it empties faster than food; null until {R-TRANSIT}, LN-3; the water lane is LN-7). The water balance is built (`physiology.ts:411-449`),
and urine now accumulates in `urine_store` instead of a counter. Voiding (B1) is a transfer `urine_store → detritus[cell]
(urine)`, or into a sanitation place the host names, at the host's or Cognition's act. The body does not decide when to
void.

### 3.C Plant growth through harvest (M3)

**C1. Growth.** D§1.3 is carried unchanged (Rex approved): Beer–Lambert interception, RUE, cardinal-temperature,
FAO-56, Maas–Hoffman and pH factors multiplied, Liebig among nutrients, Q10 maintenance respiration, allocation and
allometry. Built in 2815 {GROW} (`src/plant.ts`, `src/tissue.ts`), with constants from `plants.forms` (2808, 27 rows)
and the four species tables.
- **From:** Reality ports (a fixture now).
- **Computes:** daily gross and net carbon, water and nutrient demand.
- **Changes:** the organ tissue populations.

**C2. Uptake.** 3015 {CG21}: one transfer per element, soil available pool → `plant:<id>`, through Reality's
`transferNutrient` (CG-3, CG-22). Water uptake is a transfer from `world.soil_water` (a fixture now) to plant water;
transpiration is a transfer from plant water to the air's vapour.

**C3. Harvest (IF-42).** A `harvest` intention (Cognition, through the host) resolves like A2 to A7:
- **Preconditions:** the plant is alive, or its dead standing biomass is present; the organ is mature per the record;
  the actor's capacity is at least the act's demand (Reality supplies the demand; M2).
- **The transfer:** one `transfer()` from `life.plant/<plant>/<organ>` to an Economy inventory, in kg **fresh** mass:
  `q_fresh = q_dry / (1 − moisture)`, with moisture from the species record (null means the harvest is refused with
  the reason "moisture unsourced" — never a default).
- **What goes with it:** tissue water and N, P and K leave with the biomass. Nothing is drained from the soil (closes
  Life's half of CG-20).
- **Residues** (leaves and tops left in the field) are a transfer to `detritus[cell]`.

**C4. The M3 crop.** The four researched species are mahogany, sugarcane, red mangrove and turtle grass. Of these only
sugarcane enters a food chain, and that needs Economy's milling to reach the existing `muscovado-sugar` food row.
**Rex, 2026-11-02 (CAT-13, via the Catalogue keeper):** the M1a food is **England 1270 cereals**, and cassava or
plantain (LIFE-Q11) is deferred to the Caribbean world. So:
- **M1a** eats **one bread loaf** of 1270 England, catalogued as `catalogue/product.<bread>` (a new kind). This
  corrects the earlier `substance.*` form (Rex's review, 2026-11-02; Catalogue PLAN §3 ruling (j)). `nutrition.json` has
  only the ship-period `bread-fresh`. {FOODS-1270} writes one composition row for the 1270 loaf in a stated condition
  (for example the day of baking). Its water value is checked against any sourced share the Catalogue cites, and any
  mismatch is Life's to resolve. The values are Life's (CAT-Q1). Staling and drying after baking are not modelled
  (spoilage of stored goods is Economy's); the row states its condition so the scenario can match it.
- **M3** closes growth → harvest → eat on a cereal species (research unit LIFE-R7). Which cereal goes first is open
  (**LIFE-Q12**, for Rex). Economy 5457 already holds small-grain nutrient-removal rows for wheat, barley, oats and rye,
  and they serve as a cross-check against M3's harvest N, P and K, never as a source for plant parameters.

**C5. Plant death.** Carbon starvation, removal to zero, or a sourced lethal condition (D§1.4). The dead biomass is a
transfer to `detritus` (§3.D).

### 3.D Waste and decomposition back to soil (M4)

**D1. Excreta.** Faeces (from `faeces_store`) and urine (from `urine_store`) leave the body by a void act, one transfer
each into `detritus[cell][faeces | urine]` (or a sanitation place's account). Composition is carried, not recomputed:
- faecal N, P, K and C are the unabsorbed food content plus the endogenous loss rows;
- urinary N is the protein nitrogen oxidised. Today protein's nitrogen is not separated (`physiology.ts:420-422`
  comment), so the urinary-N term is **null until CG-6** (excreta mass and N per person-day, research unit drafted
  `drafts/life-16-…`).

Pool overflow (`nutrition.ts:434`, "excreta") becomes a transfer into `urine_store` or `faeces_store` by the route each
nutrient row names, where a source names one. Otherwise it stays a trace sink with a flag.

**D2. Decomposition (row `realism.ecology.decomposition`; Life).** For each detritus pool i in a cell, a first-order
decay with environmental modifiers, the established litter-decomposition form (Olson 1963 exponential decay; level 2):
- `dM_i/dt = −k_i · f_T(T_soil) · f_W(θ) · f_pH · M_i`;
- `k_i` per litter kind from opened litter-bag or manure data, and the modifiers by their sourced curves (a Q10 or
  Lloyd–Taylor form for temperature; level 2).
- Decayed carbon goes to the air as CO₂ (a transfer to the air port) and, where Reality models soil organic matter, a
  humified fraction goes to it (LIFE-26).
- Nutrients are released in proportion to mass loss, adjusted by the C:N ratio of the litter (immobilisation while
  C:N is above the critical value). The forms are from the litter-decomposition literature, and the constants are null
  until {DECOMP} opens them.

The released N, P and K go into soil available pools through Reality's `addNutrient(cell, el, q, 'detritus', …)`: one
transfer, `Δdetritus = −q`, `Δsoil_avail = +q`. Urine N is mostly urea and enters faster. Its volatilisation loss (NH₃
to air) is CG-8's term, Reality's (gaseous N losses research, `research/CG-8-gaseous-n-losses.md`), written as a separate
loss transfer from the same pool, never both.

**D3. Closing M4.** A field's later yield changes because §3.C1's `f_nutrients` reads the soil pool that D2 refilled.
There is no fertility index and no yield bonus (DUP-51 closed as a read).

**D4. Carcasses.** A dead body's mass is a transfer into `detritus[cell][carcass]` when the host disposes of it. Burial
is the host's or Settlement's act, which places it in the cell's subsoil account (Economy `economy.burial_waste` is a
goods view, never a second mass).

### 3.E Carried mechanisms not on the M1a to M4 path

These are carried from D§1.5 to 1.10 and from built realism (circulation, neurology, medicine, muscular, crisis,
population), unchanged:
- pollinators (mahogany seed, after LIFE-R5);
- reproduction;
- resolution by distance;
- tissue populations (the liver demonstration is design only);
- maturation;
- scurvy (LIFE-6 to 10);
- LabourSupply (IF-27, built);
- the subsistence requirement (5425).

They are listed in §6 with their states, and no change is planned here.

**E1. Alertness and chronic sleep debt (REAL-35 option (a), Rex 2026-11-02, co-signed by Life; REAL-43 taken by Life
as LIFE-28).**

The formula: `alertness = min(arousal, 1) × circadian`. It is a bounded [0, 1] multiplier, read relative to the same
body rested at its circadian peak. Rex's conditions:
- Two assumptions, each labelled level 4 and unvalidated: A-35a, arousal above normal adds no alertness; A-35b, arousal
  and circadian multiply.
- The inputs are asserted, never clamped: arousal finite and ≥ 0, circadian in [0, 1].
- Uncapped arousal (0 to 2) stays its own output. The cap exists only inside this formula.
- Nothing may claim this validates the arousal–performance relationship.

Each input enters once:
- **acute pressure** through Process S → adenosine tone → arousal;
- **circadian** through its factor;
- **chronic debt** through neither, today.

The gap (LIFE-28): Process S saturates within about two short nights, while Van Dongen 2003 reports deficits still
growing over 14 nights. Re-adding the debt multiplier beside S would count acute pressure twice.

Design: one sourced slow process beside S, a candidate being the allostatic extension of the two-process model
(McCauley and colleagues). It enters arousal as the existing, unsized sleep-debt driver (`neurology.ts:174`), with its
weight from the same source.
- **Not to be used:** a free weight, or Van Dongen 2003 as both the fit and the test.
- **Validation:** a held-apart chronic-restriction study, for example Belenky 2003.
- **Gating:** 2724 stays held until this lands, and the LIFE-13 fix rides with it (`physiology.ts`).

**E2. Alcohol's functional outputs (REAL-44 as revised by Rex 2026-11-02; the gaps are REAL-45, taken as LIFE-29).**
Game lines read Life's and neurology's outputs once and keep no drink multiplier. Life owes four outputs, none on the M1a
path, each researched before any code, with no invented weight:
- **balance**, from muscular `forceAvailable` for glute_med and deep_core, which is null today;
- **reaction latency**, `neurology.reaction_latency` (planned);
- **the GABA inverted-U in motor control**, unsized today;
- **the over-1.5 arousal effects** (tremor, motor control, sleep quality), with the threshold provisional, unvalidated
  and not implemented.

Until each lands, the output is absent, and a consumer names the gap rather than substituting a factor. The form of the
game's coordination term (REAL-46) is the game's.

REAL-44 (alcohol counted twice through `drinkFactor` in the game's `body.json`) is the game's and Reality's fix. Life's
rule: alertness reads arousal once and never multiplies a drink factor.

### 3.F The rest of Life: separate lanes, not part of M1a

Each gets its own lane and lane card (§8.1 format) when its milestone comes, rather than being folded into the eating
lanes:
- **Movement and work:** muscular force, fatigue, recovery, effort to expenditure (M2; with Reality's walking model).
- **Sleep and neurology:** sleep pressure, arousal, alertness and their consumers (§3.E1, LIFE-28, LIFE-29).
- **Disease and injury:** exposure, tissue damage, physiological consequences, recovery.
- **Plants:** growth, uptake and harvest (§3.C, M3).
- **Waste and decomposition:** outputs returning to environmental stores (§3.D, M4).
- **Reproduction, development and ageing.**

## 4. Inputs and outputs

| # | Quantity | Producer → consumer | Unit, range | Timing | Failure and rollback |
|---|---|---|---|---|---|
| E1 | consume transfer | Economy inventory → Life gut | kg > 0 | host phase, one kernel instant | `transfer()` is atomic across the economy, life and journal ledgers. A throw restores all three and the transactional events; the resolver then emits exactly one `failed` outcome; committed expenditure stays (A7) |
| E2 | `cognition.intention` (consume, harvest, void, drink) | Cognition → host resolver | record | cognition phase | an unknown act is ignored and logged (Cognition rule) |
| E3 | `shared.action.outcome` | host resolver (Life part) → Cognition | record; status ∈ impossible/failed/completed | same transaction as E1 or E4 | one per cause (LIFE-27) |
| E4 | harvest transfer | Life plant organ → Economy inventory | kg fresh > 0 | host phase | atomic; refused if moisture or maturity is null |
| E5 | `body.hunger_signal`, `body.satiety_signal` | Life → Cognition | 1, [0, 1] | every fast step, before the cognition phase | absent (not 0) when the body is dead; Cognition throws on a missing required signal (`needs.ts`) |
| E6 | `body.capacity_functional`, effort | Life → Cognition (generation), host resolvers, Settlement `labour_cap` (DC-14) | physical units | fast step | absent capacity means the act is impossible, never assumed able |
| E7 | act demand (force, power, MET) | Reality → Life resolver | W, N, MET | per act | missing demand means the act is impossible with that reason |
| E8 | uptake N/P/K | Reality soil → Life plant | kg per step | daily plant step | `transferNutrient` throws on overdraw, and demand is capped first (3015) |
| E9 | litter, residue, excreta, carcass | Life → `detritus` (Life) | kg dry and elements | at the act or the step | transfer, atomic |
| E10 | mineral release | Life `detritus` → Reality soil available pool | kg per step | daily decomposition step | Reality's `addNutrient`; one transfer |
| E11 | CO₂, O₂, water vapour, heat | Life ↔ Reality air | kg, J | fast step (body), daily (plant) | substrate ledger |
| E12 | place, air and soil environment | Reality → Life | ports D§2.3 | before Life's step | a missing port stops the step with a named error |
| E13 | `body.energy_requirement` | Life → Government, Society | kcal d⁻¹ | on request | from 5425 |
| E15 | `body.crisis`, `body.death` events | Life (through its process ctx) → bus | record | when they open | the harness resolver never emits them; the registry adds both to events.json when the stop lifts (DC-13) |
| E14 | LabourSupply hours | Life → Settlement | h | per day | built (IF-27) |

**Kernel processes** (`kernel.json`): `life.body.step` (fast: physiology, digestion, signals), `life.nutrition.close`
(daily: the pool use that stays daily), `life.plant.step` (daily, after Reality's weather and soil), `life.decomposition.step`
(daily), and the existing ones.

## 5. Evidence

| Mechanism | Form | Class / level | Source state |
|---|---|---|---|
| Absorption fractions | multiplicative rules per nutrient | calibrated estimate (rows `proposed`) / 2–4 | library rows with sources per row; review in {R-TRANSIT} (LN-4) |
| Food energy | Atwater metabolisable (USDA FDC) | measured / 2 | LIFE-17 closed (5256); CG-13b open (Miles 1988; Slavin 1980) |
| Expenditure | MET × RMR | measured (Compendium MET; RMR formula) / 2 | built |
| Water balance | ISO 7730/7933, metabolic water by RQ | measured / 1–2 | built |
| Glycogen and fat rules | linear store rules | assumption (rows `proposed/open`) / 4 | energy densities and the allocation model to be sourced in {R-STORES} (LN-5); 7700 kcal/kg has standard textbook support, the others need opening |
| Gastric emptying, transit | energy-limited or power-exponential emptying | **null** / — | {R-TRANSIT} (LN-3, LN-4) |
| Hunger and satiety mapping | function of fill and stores | assumption / 4; interim rows **no source** | {R-SIGNALS} (LN-6); validation against held-out VAS data |
| Starvation thresholds and capacity factors | state thresholds | assumption / 4, **unsourced** (LIFE-25) | {R-DEPRIV} (LN-9) opens fasting and hunger-strike records and the BMI survival limit |
| Plant growth | D§1.3 forms | measured forms / 1–2; species parameters mixed | 2808 (27 rows), 2809–2814 |
| Liebig among nutrients, the other limits multiplied | rule | (Rex, 2026-10-31); Sprengel and Liebig, to cite opened | D§5 LIFE-Q1 |
| Decomposition | first-order decay with modifiers (Olson 1963) | measured form / 2; constants **null** | {DECOMP} |
| Excreta mass and N | per person-day | **null** | CG-6 research (`drafts/life-16-…`) |
| Fibre fermentation | SCFA energy recovery | **null**, omitted | CG-10 research (`drafts/life-17-…`) |
| Gastric capacity, intake rate, volume mapping | species record; LN-1 density | **null** | {R-INTAKE} (LN-2) |
| Store allocation and energy densities | substrate allocation by state | assumption (built rules) / 4 | {R-STORES} (LN-5) |
| Functional capacity baselines | baseline × state relationships | **null** | {R-CAPACITY} (LN-8) |

Every null stays null with a `searched:` flag line until an opened source fills it. REAL-12 (whether an `estimate`
drives by default) still governs every `estimate` row.

## 6. Status

D = designed · I = implemented · C = connected (through ports or transfers to its neighbours) · N = numerically
checked (conservation, convergence) · V = empirically validated.

| Mechanism | D | I | C | N | V |
|---|---|---|---|---|---|
| eatMeal absorption (instant) | ✓ | ✓ | partial: host-coupled to Economy in a test only (`economy/test/food-to-body.test.ts`) | ✓ (three-term sum, CG-13) | — |
| consume as one `transfer()` (A4) | ✓ (this plan) | — | — | — | — |
| digestion and transit (A6) | ✓ form; constants null | — | — | — | — |
| hunger and satiety writer (A8) | ✓ | — | — | — | — |
| per-step stores (A9) | ✓ | daily only | — | `energy:stored` check | — |
| starvation states (A10) | ✓ | limit only | crisis ✓ | — | — |
| `body.mass` definition and no-double-counting (A9) | ✓ | — | — | — | — |
| store allocation model (A9, LN-5) | candidate rules only | daily | — | — | — |
| capacity_functional (A11) | ✓ (minimal) | — | Cognition stub reads it | — | — |
| expenditure and heat | ✓ | ✓ | air ✓ | ✓ | partial (validation.json rows) |
| water balance | ✓ | ✓ | air ✓ | ✓ (water-ledger, hydration-week) | partial |
| plant growth (C1) | ✓ | queued 2815 | fixture | — | — |
| one biomass store and uptake (C2) | ✓ | queued 3015 | soils ✓ (3001) | — | — |
| harvest transfer (C3) | ✓ | — | — | — | — |
| excreta stores and voiding (D1) | ✓ | — | — | — | — |
| decomposition (D2) | ✓ form | — | — | — | — |
| crisis and death ledger | ✓ | ✓ | ✓ | ✓ | — |
| LabourSupply (IF-27) | ✓ | ✓ | ✓ | ✓ | — |
| subsistence requirement | ✓ | queued 5425 | — | — | — |

## 7. Validation

Verification (the maths as stated) is a unit-gate test. Validation uses independent data, never the data a
parameter came from, and records failure as `(NNNN) validation failed:`. Nothing is tuned toward survival.

**M1a mechanism tests (verification):**
**Three acceptance checkpoints (across the lanes of §8.1; not a second numbering of the milestones).** Each reports
implemented, connected, numerically checked and empirically validated separately (§6 columns). Passing one is never
reported as passing a later one.

| Checkpoint | Demonstrates | Lanes | Validation it can claim |
|---|---|---|---|
| **CP-1 Ingestion accounting** | composition, inventory debit, gut credit, rollback, conservation, `body.mass` change | LN-1, LN-2 (a declared, labelled fixture capacity until {R-INTAKE} (RC-11)) | LN-1's composition against measured food data; nothing physiological |
| **CP-2 Physiological processing** | emptying, absorption and residue, water balance, expenditure, store and body-mass trajectories | LN-3, LN-4, LN-5, LN-7 | each lane's own held-apart observations |
| **CP-3 Behavioural survival loop** | hunger and satiety influence decisions; eating changes body state; deprivation produces supported consequences | LN-6, LN-8, LN-9, then the {CONSUME} loop | held-out hunger and fullness ratings; independent deprivation trajectories |

M1a is CP-3 passed. The bread-loaf demonstration at CP-1 shows that eating moves matter once, **not** that the body
responds realistically to it. **CP-3 establishes M1a's functional integration only** (Rex, 2026-11-02): a working loop
never marks any physiological model validated. Each lane's empirical validation is reported separately, in its own V
column, and M1a's report lists which lanes are validated, which failed validation and which are unvalidated.

**Every dynamic mechanism declares its numerical update method** (fixed steps on the kernel scheduler, internal
sub-steps, or an analytical update over the step) and carries a timing test: the result at 60 s, 600 s and 3600 s steps
(LIFE-11 harness), with the acceptance tolerance the lane card states from its required accuracy. The method follows
the selected equation. Kernel work is asked for only if a selected model shows a requirement the existing scheduler
cannot meet.

- **Once-only:** for a consume of q, the economy inventory's change is −q kg, the gut's is +q kg, `body.mass` rises by
  q, and the transfer journal has exactly one entry. Then total mass, water, energy and each nutrient balance
  separately (A6) across the compartments and the absorbed pools, to 1e-9 relative, every step.
- **Body mass:** the A9 no-double-counting tests.
- **Rollback:** an injected throw in `life.gut.apply` leaves the economy, life and journal snapshots and the
  transactional event log byte-identical to before the transfer (`canonical`); no successful-transfer event survives;
  exactly one `failed` outcome with the intention's cause is emitted afterwards; expenditure committed before the throw
  is unchanged.
- **One outcome per cause;** impossible means no transfer and no execution cost; failed means no transfer, and only
  the activity actually performed is charged (A12).
- **The fence:** the resolver never reads `mind.*` (static check).
- **Signal inputs:** each of gut fill, satiety and hunger reads exactly the inputs LN-6 declares; no host writes
  either signal; a controlled change in one declared input moves the signal as the selected model says (its direction
  comes from the source, not from this plan).
- **Step convergence** of digestion and the per-step stores at 60 s, 600 s and 3600 s (LIFE-11 harness): the result
  difference is reported; no invented band.

**M1a paired scenarios (fixed seeds, replay byte-identical):**

| | Fed (adequately provisioned) | Deprived |
|---|---|---|
| Setup | one adult body, sourced anthropometry; an inventory holding more than the run's subsistence requirement (5425) of 1270 bread loaves ({FOODS-1270}, one composition row) from `nutrition.json`; water ad libitum; a sedentary MET schedule; the Cognition baseline mind with the consume repertoire | the same body and mind; the inventory empty (or emptied on day 1); **water ad libitum** (food-only deprivation, so dehydration does not mask the starvation path) |
| Run | 30 days | until terminal state or 120 days |
| Must show | repeated eat intentions; each meal is one transfer; hunger falls after meals and rises between them; stores stable | eat intentions → `impossible: source empty`; the stages in A10's order, each entered by state; capacity falling; terminal crisis; death declared by the harness's recorded rule, or "terminal, death threshold null" |
| Independent comparison | body-mass change against within-person day-to-day weight variability data (opened by {R-STORES}); energy balance closes | the time course of mass loss and the survival time against total-fasting records: clinical therapeutic-fast series and hunger-strike case records (for example the Leiter and Marliss 1982 review; the 1981 hunger-strike records), and the BMI limit of survival (Henry 1990). All are candidates to open in {R-DEPRIV}, none used to set a parameter |
| Tolerance | the source's own spread | the records' range of survival days for the scenario's starting fat mass; outside it means `validation failed`, with the missing mechanism named (for example protein sparing in ketosis, which is not modelled) |

A water-deprived pair (M1a-w) uses the built hydration bands, as the second deprivation.

**M3 validations:** D§4 per species (held-apart field studies, already named by 2809–2812); plus:
- harvest mass = biomass removed (IF-42);
- tissue nutrients leave with the harvest, and the soil pool is unchanged by the harvest;
- the cereal's yield against a held-apart medieval or historical-variety field trial (LIFE-R7).

**M4 validations:**
- litter-bag mass-loss curves held apart from the k source;
- manure-N release against a field incubation study;
- the integrated test: two runs of a field, one with residues and excreta returned and one with them removed. The
  difference in available N and in next-season yield is **reported**, then compared with a long-term manure or residue
  trial (for example Rothamsted Broadbalk; to open in {DECOMP}).

## 8. Build order (keyed to the milestones; drafted once Rex approves the plan and the registry map reconciles)

All work belongs to the realism lane until the split (the Reality keeper queues it), and to the life lane after.
Model per PRODUCTION §2. No unit carries `opus`.

### 8.1 Ingestion and survival lanes (review adopted 2026-11-02)

The lanes are a work breakdown, **not nine simultaneous implementations and not nine instructions to invent
equations.** They are named LN-1 to LN-9 because LIFE-1 to LIFE-29 are already ISSUES ids. Each lane first fills a
**lane card** with seven items:
1. the selected equation or relationship, its source and the conditions it applies to;
2. its state variables, units, compartments and the authoritative owner of each;
3. parameter values, where each came from, and its uncertainty;
4. the numerical update method and the timing test with its tolerance;
5. the functional tests (conservation, boundary, rollback, no double counting);
6. the independent observations used for validation, and the tolerance;
7. status (§6 columns).

Where the evidence does not yet support a selected equation, the lane starts with a narrowly specified research unit
that returns the card or recorded nulls. Implementers build only what a card states.

| Lane | Build or refine | Existing code | Functional tests | Realism tests | First task |
|---|---|---|---|---|---|
| **LN-1 Food composition** | one composition record for the chosen bread preparation, with measurement basis | `nutrition.json` (ship-period rows only) | identity and unit conversions; a portion gets the right constituents; overlapping categories counted once | composition against measured food data; uncertainty of the historical reconstruction labelled | {FOODS-1270} |
| **LN-2 Ingestion and gut holdings** | `life.gut`, its ledger, eligibility to ingest, intake limits, ingestion duration | none | a portion enters the gut once, not the stores; rollback; empty, full and invalid input explicit | supported intake amount and rate limits | {R-INTAKE} |
| **LN-3 Gastric emptying** | the selected equation, stomach → intestine over time | none | no negative contents or over-discharge; internal transfers balance; converges as the step shrinks | independent gastric retention or emptying measurements | {R-TRANSIT} |
| **LN-4 Absorption and residue** | nutrient and water uptake, unabsorbed contents, residue store | `absorbedFraction` (`nutrition.ts:290`), applied instantly | nothing absorbed twice; A6's four balances close | independent absorption and transit measurements | {R-TRANSIT} |
| **LN-5 Expenditure, stores, body mass** | review expenditure; the balance and a separate allocation model; the `body.mass` definition | expenditure built (`physiology.ts:392-402`); daily stores (`nutrition.ts:455-485`) | energy units; expenditure charged once; no invalid stores; balances close; within-day feedback; body-mass tests | independent expenditure, store and body-composition trajectories | {R-STORES} |
| **LN-6 Hunger and satiety** | explicit mappings from body state to the published signals; gut fill kept distinct | none (library rows unsourced) | defined ranges; no host writes; update timing; declared inputs only | held-out hunger and fullness ratings, not "the person eventually eats" | {R-SIGNALS} |
| **LN-7 Water balance** | connect ingestion and absorption to the built hydration machinery | built (`physiology.ts:411-449`) | water enters once; every loss has a destination or a declared boundary | independent hydration observations | review; {WATER-LINK} |
| **LN-8 Functional capacity** | only the capacities the initial acts require, each with a baseline and unit | glycogen factor and others (A11) | declared units; demand compared in the same unit; no impairment twice | measurements per relationship | {R-CAPACITY} |
| **LN-9 Deprivation and crisis** | supported progression of reserves, impairment and crisis | starvation limit; crisis ledger (`crisis.ts`) | no food means no nutrient credit; transitions have traceable causes; events once | independent deprivation trajectories; unsupported terminal thresholds stay unresolved | {R-DEPRIV} |

**Ownership unchanged:** the Catalogue owns identity and source references for the loaf; Life owns the authoritative
composition values (CAT-Q1). Water accounting stays in M1a: the fed run is 30 days and the deprived run up to 120, and
drinking is a declared input without modelled drinking behaviour.

**Order of combination:** (1) LN-1 and LN-2; (2) LN-3 and LN-4, each alone, then connected; (3) LN-5 and LN-7;
(4) LN-6; (5) LN-8 and LN-9; (6) the complete eating loop. This is a dependency order; the research units can run
concurrently from the start.

Every research unit follows §8.3 and fills `lanes/RESEARCH-CARD.md`. Lane cards (specifications for review): `lanes/LN-1-food-composition.md`, `lanes/LN-2-ingestion-gut.md`. Research
drafts: `drafts/life-22-research-foods-1270.md` ({FOODS-1270}), `drafts/life-23-research-intake-limits.md`
({R-INTAKE}), `drafts/life-24-research-transit-absorption.md` ({R-TRANSIT}, returning the LN-3 and LN-4 cards).

### 8.2 Build table

| Stage | Unit (token) | Model | Needs | Unlocks (smallest demonstration) |
|---|---|---|---|---|
| CP-1 | **{FOODS-1270}** (LN-1) research: one composition record for the 1270 bread loaf in a stated condition, on `catalogue/product.<bread>` (CAT-13, Catalogue §3 (j)); measurement basis per value; overlapping categories declared; density or specific volume for LN-2; water checked against the Catalogue's cited share | sonnet (web) | the Catalogue's product record | the LN-1 card; the M1a food |
| CP-1 | **{R-INTAKE}** (LN-2) research: bodily eligibility to ingest, gastric capacity (mass or volume, with the mapping), intake rate and ingestion duration, for the represented conditions | sonnet (web) | nothing | the LN-2 card, or recorded nulls |
| CP-1 | **Contract E1** (in session, not a unit): Economy's goods mass view and `transfer()` for consume (agreed, DC-13); the registry registers `life.gut` and `shared.action.consume` | — | the controller's integration map | E1, E3 |
| CP-1 | {GUT} (LN-2 build): `life.gut` `TransferLedger` with the four compartments; ingestion into the stomach only; empty, full and invalid-input cases; rollback; the `body.mass` tests; a declared, labelled fixture capacity until {R-INTAKE} (RC-11), an undeclared capacity fails configuration, with below- and above-capacity cases | codex | {FOODS-1270}, E1, Kernel K1, 5425 landed | food enters the gut once |
| CP-1 | {ECON-MASS}: Economy's goods mass view; consume through `transfer()` (Economy's lane) | codex | E1 agreed | inventory side of once-only; **CP-1** with {GUT} |
| CP-2 | **{R-TRANSIT}** (LN-3, LN-4) research, runs in parallel with CP-1: one selected gastric-emptying model and one absorption and transit model, each returned as its own card; meal types the sources cover; held-apart retention, emptying and absorption measurements | sonnet (web) | nothing | the LN-3 and LN-4 cards, or recorded nulls |
| CP-2 | {EMPTY} (LN-3 build) then {ABSORB} (LN-4 build), each tested alone, then connected stomach → intestine → absorbed and residue; A6's four balances | codex | {GUT}, {R-TRANSIT} | digestion over time |
| CP-2 | **{R-STORES}** (LN-5) research: store energy densities; a substrate-allocation model by nutritional state and time; review of the built expenditure; independent store, body-composition and day-to-day weight trajectories | sonnet (web) | nothing | the LN-5 card |
| CP-2 | {STORES} (LN-5 build): per-step or justified-delayed stores (A9), the within-day feedback test, the `body.mass` definition, `starvation_stage` read | codex | {ABSORB}, {R-STORES} | energy changes within the day |
| CP-2 | {WATER-LINK} (LN-7 build): ingested and absorbed water into the built hydration balance (`physiology.ts:411-449`); every loss has a destination or a declared boundary; urine to `urine_store` | codex | {ABSORB} | **CP-2** |
| CP-3 | **{R-SIGNALS}** (LN-6) research: a selected model for satiety and for hunger, each with its supported inputs; held-out VAS hunger and fullness data | sonnet (web) | nothing | the LN-6 card |
| CP-3 | {SIGNALS} (LN-6 build): the two writers (A8), `kernel.json` ports; neurology reads `body.hunger_signal` instead of `p.hunger` | codex | {STORES}, {R-SIGNALS} | Cognition's need reads a real signal |
| CP-3 | **{R-CAPACITY}** (LN-8) and **{R-DEPRIV}** (LN-9) research: whether eating has a supported capacity demand, and the baselines the M1a acts need; supported deprivation states, thresholds and independent trajectories | sonnet (web) | nothing | the LN-8 and LN-9 cards, or recorded nulls |
| CP-3 | {CAPACITY-MIN} (LN-8) and {DEPRIV} (LN-9) builds: only what the cards support (A10, A11) | codex | {STORES}, the two cards | supported deprivation consequences |
| CP-3 | {CONSUME}: the host resolver (Kernel's harness and the action owners' legs build it; History states only the evidence it needs, HIST-16, RC-8; beside `work_resolution`, kernel 5006; DC-13): preconditions, the one transfer, the outcome, A12's charging | codex | {GUT}, {ECON-MASS}, {SIGNALS} | the closed loop: Economy → Life → Cognition → ingestion → Life → Cognition |
| CP-3 | {M1A-PAIR}: fed and deprived scenarios, plus M1a-w; fixed seeds; replay; the validation report | composer (fixtures, tests) | {CONSUME}, {DEPRIV} | **CP-3 = M1a** |
| M2 | effort of eating and of foraging through MET and capacity (A11, A12); with Reality's walking model (CG-5) | codex | M1a, Reality 3020 | M1b, M2 |
| M3-0 | 2815 {GROW} → 3015 {CG21} → one demonstration per species (D§3) | codex | queued, unblocked | the four species grow in the fixture world |
| M3-1 | LIFE-R7 research: the first cereal species (Rex picks, LIFE-Q12) | sonnet (web) | nothing | the edible crop's profile |
| M3-2 | {HARVEST}: plant ledger endpoint; harvest transfer (C3); moisture conversion; residues to detritus | codex | 3015, {ECON-MASS} | plant → inventory, once |
| M3-3 | {M3-LOOP}: grow → harvest → store → eat, on the edible crop; paired with a failed-harvest (drought fixture) run | composer | {HARVEST}, {CONSUME}, LIFE-R7 | **M3** |
| M4-0 | {DECOMP} research: litter and manure decomposition k and modifiers, C:N immobilisation, held-apart trials; with CG-6 (excreta) and CG-8 (gaseous N, Reality) | sonnet (web) | nothing | constants or nulls |
| M4-1 | {WASTE}: faeces and urine stores; the void act; `detritus` pools; carcass transfer | codex | {GUT}, CG-6 | excreta reach a cell |
| M4-2 | {DECAY}: decomposition step; mineral release through `addNutrient`; CO₂ to air; LIFE-26 resolved with Reality | codex | {WASTE}, {DECOMP}, 3015 | detritus → soil |
| M4-3 | {M4-LOOP}: the residues and excreta returned vs removed runs; the later-yield comparison | composer | {DECAY}, {M3-LOOP} | **M4** |

The integration point M1a needs from other plans:
- Cognition's consume repertoire and its reading of the two signals (Cognition PLAN);
- Economy's mass view (Economy PLAN);
- the host resolver slot (Kernel PLAN).

M3 needs Reality's ports or the fixture (Reality PLAN), and M4 needs Reality's soil organic matter decision (LIFE-26).

### 8.3 Research guidance: condition-dependent physiology (Rex, 2026-11-03)

Guidance for existing and future research, **not an expansion of M1a and not a reason to stop current work.** It
records a method, not findings: no value or equation enters this plan from it. Studies run under different meals,
bodies and conditions can support a model that responds to those conditions, instead of one average number for every
NPC. Each research task returns its card in `lanes/RESEARCH-CARD.md`, whose fields sit inside §8.1's seven items:
1. **Question and scope:** the quantity or mechanism needed, and the meal, body conditions and timescale the current
   milestone must support (for M1a: the declared M1a person and the 1270 bread preparation).
2. **Existing models first:** look for a suitable established, validated model before constructing one; record its
   equation, variables, units, assumptions and supported conditions.
3. **Evidence table:** sources, participants, meal properties, measurement methods, measured outcomes and uncertainty.
   Normalise compatible units without erasing differences in definitions or methods.
4. **Condition dependence:** only inputs with evidence-supported effects. No age, illness, stress or other modifier
   because it sounds plausible.
5. **Variation:** keep apart differences between people, changes within a person, measurement error and uncertainty
   about the model. Unexplained disagreement between studies never becomes random NPC traits, and a relationship
   for individuals is not inferred from differences between study averages alone.
6. **Validation:** independent observations, acceptance tolerances and numerical checks; calibration and validation
   evidence kept distinct. If suitable validation data is unavailable, say so explicitly.
7. **Recommendation:** the simplest adequate model for the current milestone, its limitations, unresolved choices, and
   optional future extensions (recorded, never prerequisites).

**Direction (Rex, 2026-11-03, clarification).** Evidence, provenance, units, accounting and validation stay required; what is
reduced is unnecessary physiological detail, not realism. Research recommends the simplest adequately supported model
that preserves the bodily effects the game needs: delayed benefit from eating, energy reserves, exertion, fatigue,
recovery, hunger, bodily effects on cognition, and long-term starvation. Proposed equations stay candidates.
Unresolved approximation choices are presented as one coherent parameter set with evidence and limitations, not as
separate approval requests per coefficient. No comprehensive meta-analysis or multi-condition physiology before M1a.
When Life selects the model (§8.4), it writes a short **keep / simplify / defer** list naming which existing build
requirements (§8.1 lanes, §8.2 units, §3.A items) the selection replaces, so the candidate does not land on top of
all the previous work.

Evidence synthesis or meta-regression is used only when the studies are comparable enough and it answers a necessary
question; it does not by itself identify causes. A comprehensive multi-condition model is never a prerequisite for
M1a. Gut bookkeeping and rollback ({GUT}) need only known composition and declared test quantities and limits, and
labelled accounting tests do not wait on physiological parameters. The guidance applies to pending research units
(amended 2026-11-03: 5561 to 5566); a unit already running is never changed silently, it gets a recorded follow-up.

### 8.4 Candidate Life model (Rex, 2026-11-03): the reference for the B2 to B4 selections

Rex supplied a compact candidate model for the whole eating and survival loop. **It is the comparison the in-session
selections make once the research cards land; it does not replace a card, enter a value, or reopen CP-1.** Each part
is labelled as Rex labelled it: *established* (a published form or an accounting identity), *adapted* (a published
approach simplified here) or *proposed* (a game approximation that needs calibration). A *proposed* relationship
enters only with sourced coefficients or with Rex's acceptance of the coefficients as a labelled game
assumption, presented as one coherent parameter set with its evidence and limitations, not one request per coefficient; a test fixture is never promoted to a default, and a missing coefficient is never zero. **Selection rule:**
compare the candidate with the existing working mechanism and with the card's evidence, and keep whichever adequate
model is simpler to maintain; no working code is replaced only to adopt the candidate.

| Part | Candidate (Rex) | Label | Lane | Fit with this plan |
|---|---|---|---|---|
| Intake | `m = min(requested, available, ρ·max(0, V_max − V_stomach), r_eat·Δt)`; inventory −m and stomach +m in one transaction | established (accounting) | LN-2 | A3 and 5567 as staged; kg capacity is the ρ-free case; the volume form needs LN-1's density (5560); the rate term is A12's duration (5561), applied by the harness |
| Digestion | two compartments per non-overlapping constituent: `dS = u − k_s·S`, `dI = k_s·S − k_i·I`, absorbed `a·k_i·I`, residue `(1−a)·k_i·I`; exact linear update between meals; water to hydration on its own | adapted | LN-3, LN-4 | **the first {EMPTY} and {ABSORB} build uses these two compartments**: residue goes intestine → `faeces_store`, and A6's colon account (5567 creates it) stays empty until a colon transit source exists. If first-order emptying fails the bread retention comparison, only the emptying function changes (the power-exponential curve, 5562) |
| Energy convention | the food record states whether its energy already includes digestibility losses; never reduced twice | established | LN-1, LN-4 | added to 5560 (energy basis) |
| Expenditure | `P_total = P_rest + P_activity,net + P_thermal,net + P_processing`, non-overlapping terms; keep the built path after checking its convention | established (accounting) | LN-5 | 5563 item 3 reviews it; Reality's mechanical work later replaces, never adds |
| Stores | carbohydrate reserve G (bounded surrogate, not blood glucose), fat F, lean L; Hall's partition `p = C/(C+F)` with its own densities; `Ġ + ρ_F·Ḟ + ρ_L·L̇ = A_E − P_total` | G proposed; partition established (Hall, used alone, not the validated whole model) | LN-5 | 5563 item 2 lists Hall; the built store rules are the other candidate |
| Starvation | no countdown: depletion `z_L`, `z_F` against a healthy reference that never resets; hazard `λ = k_d·max(0, z_L − z_w)^n·(1 + b_F·z_F)`, one drawn exponential threshold per body, accumulated hazard | proposed | LN-9 | needs survival evidence (added to 5566) or Rex's labelled game assumptions; LIFE-25's thresholds stay null otherwise |
| Fatigue | keep the three-compartment code (`muscular.ts`); make the implicit recruitment timescale explicit before any time-unit change; food never resets fatigue | adapted | LN-8 | LIFE-35 |
| Capacity | `F_avail = F_0·(1 − f)·(L/L_ref)^α`, per task; reserve state exposed separately | proposed | LN-8 | 5565; α per task, never universal |
| Signals | `H = σ(h_0 + h_G(1−g) + h_L·z_L − h_V·v − h_Q·q)`, `S = σ(s_0 + s_V·v + s_Q·q)`, filtered nutrient rate `τ_q·Q̇ = A_E − Q`; volume and nutrient separate inputs; Cognition never subtracts S from H | proposed (fitted) | LN-6 | 5564 asks the volume and nutrient split (`overlap:`); fitted to ratings, never to survival |
| Cognition | alertness formula unchanged (§3.E); response latency `T = T_0·[1 + b_A(1−A) + b_L·z_L]` per task | proposed | later | no generic hunger penalty beyond Cognition's need |
| Mass and water | `ΔM = intake + inhaled − exhaled − excreted`; internal transfers leave M unchanged; no invented balancing waste flow | established (accounting) | LN-5, LN-7 | A9 and {WATER-LINK} |

Rex's acceptance suite (material transfer, digestion, energy, fatigue, signals, starvation and refeeding, mortality
step-size and replay consistency, empirical comparison within each model's domain) is the §7 checklist for these
builds; the mortality item applies only if the hazard is adopted.
