# RN-1 Placement and reach: lane card (Reality keeper, 2026-11-02; structure accepted by Rex; Economy and Life agreed 2026-11-02, with amendments)

CP-1 consumes none of C-2, C-3 or C-4 (body geometry, demand and capacity, materials), so REAL-48 and REAL-49 do not
block it.

Checkpoint CP-1. Plan: `../PLAN.md` §3.L (C-1), R-1, §8. Nothing here is queued. No number in this card is a measured
value: CP-1's placements are declared fixture data, labelled as fixture.

## 1. Relationship and conditions

**What the lane provides:** whether an actor can act on a target **without moving**, for the M1a eat act. The
relationship is declared adjacency, not geometry:

    reachable(actor, target)  ⇔  cell(actor) = cell(target)  ∨  edge(cell(actor), cell(target), kind = reach) exists

- **Applies to:** a fixture world whose cells and `reach` edges are declared by the location owner (KRN-46; Settlement
  or the harness fixture), with goods held in an Economy inventory whose cell a declared table gives.
- **Claims nothing about:** arm length, posture, obstacles, line of sight, or contested access. A `reach` edge is a
  fixture declaration that the target can be taken from that cell; it is not an anatomical measurement.
- **Cells are reach zones** (amended 2026-11-03, PLAN §3.S W-1). A cell here is a declared space with no wall or
  closed container between its contents, not a map cell. A closed container is its own zone, reached only through a
  declared `reach` edge. Map resolution never defines reach. "Same cell" stays valid for the
  labelled adjacent-bread M1a fixture and its test (Rex, 2026-11-03); it is not the universal reach rule.
- **Contested access** (two actors, one loaf) is not reach. It is the resolver's ordering and Economy's stock refusal
  (kernel PLAN M1a fixture). RN-1 answers the same way for both actors.
- **Later geometry** (reach from posture and arm segments, C-2) replaces the basis, not the record. It needs
  measurements and its own card.

## 2. State, units, owner

| Item | Unit | Owner | Notes |
|---|---|---|---|
| `world.position.cell` per body; per inventory through the table below | cell id | Reality (REAL-40) | changes only through a resolved move (RN-2) or a declared mechanics event; never written by Economy, Life or Cognition |
| `world.position.{x, y, z}` | m | Reality | null at CP-1; not read by RN-1 |
| `reach` edges | edge list (cell, cell, kind) | the location owner declares; Reality reads | static within a run at CP-1; directed unless declared symmetric |
| which inventory holds a good | inventory id | Economy (an Inventory holds `holder`, `market`, `stock`; no place field) | Economy adds no place field and writes no position (Economy keeper, 2026-11-02) |
| inventory → cell | the declared table | fixture at CP-1; later the location owner (Settlement premises, or a ship; CONTRACTS §1) | Reality reads; one declared table, not inferred. Goods in transit sit at the ship's position later, not at CP-1 |

**The result record (C-1), returned to the resolver:**

    { actor, target, result: "reachable" | "unreachable" | "unknown",
      basis: "fixture-adjacency", limitation: "declared adjacency; no anatomical or obstacle claim",
      missing?: [names of the missing inputs, when result = unknown] }

- `unknown` when the actor's cell, the target's inventory → cell row, or the edge table is missing. **Missing data is
  never `unreachable`**, and never an in-world outcome (agreed with Economy 2026-11-02; Economy PLAN EN-1 item 5, the
  EN-4 card; Life agreed the rule in the food review):
  - **At load**, the configuration check requires a cell for every body and inventory the fixture names, so `unknown`
    cannot arise at CP-1.
  - **If it arises at run time anyway**, the resolver records a host error with the missing inputs named. It emits no
    `impossible` and no `shared.action.outcome` an agent could learn from.
- `unreachable` only when every input is present and neither condition holds.
- No `distance_m` at CP-1. A consumer that needs one asks for it, and it then carries its own basis.

**Composition with Life's preconditions (agreed with Life 2026-11-02; Life PLAN §3.A2).** Before opening the
transaction, the resolver makes two pure reads from committed state: this reach record and Life's preconditions. Life
never reads reach, and Reality never reads the body. The order is fixed: death, reach, source 0 kg, stomach full (once
sourced). The one outcome lists every failing reason. `unreachable` is an in-world `impossible` with reason
"unreachable", and the fixture basis goes in the trace.

## 3. Parameters, sources, uncertainty

None. The relation has no parameters. The cells, edges and placements are **fixture** data, labelled as fixture and
supplied by their owners. They define the scenario and make no physical claim. Reality supplies no default placement.

## 4. Numerical method and timing

- Evaluated once per intention, **before** the resolver opens the eat transaction, from committed state at that
  instant. No integration, no time step.
- Timing test: the result read inside the transaction equals the one read before it (nothing moved in between: M1a has
  no moves). From CP-2 on, the resolver reads it at the transaction's instant.

## 5. Functional tests (composer unit; vitest, in `realism/test/mechanics/`)

1. Same cell → `reachable`; a `reach` edge → `reachable`; neither → `unreachable`. A closed container declared as its own
   zone, with no edge from the actor's zone → `unreachable` (amended 2026-11-03).
2. Directed edge: a→b declared, b→a not → `reachable` one way only (unless declared symmetric).
3. Missing actor cell, missing inventory → cell row, missing edge table → each fails the load-time configuration
   check with the missing input named. Called directly at run time, RN-1 returns `unknown` (never `unreachable`), and the
   resolver records a host error, emitting no in-world outcome.
4. Invalid ids (a cell not in the world, an inventory mapped to no cell) → a configuration error before the run, not an
   in-world outcome.
5. No position changes: evaluating reach for every actor-target pair leaves `world.position` and the trace unchanged
   (zero journal entries).
6. The resolver order: in the harness, Economy's `transfer()` is never called for an intention whose reach result is
   not `reachable` (kernel M1a fixture; asserted on the journal).
7. Two actors, one loaf: both get `reachable`; the stock outcome is Economy's and the resolver's, not RN-1's.
8. Replay: the same fixture and seed give the same records.
9. Trace provenance (Rex, 2026-11-02): every reach read the resolver records carries `basis: fixture-adjacency` and
   `source: fixture` in the trace, so the outcome reads as "eating works under declared access". A CP-1 pass claims
   nothing about general reach, obstacles or movement.

## 6. Independent observations

None apply. A declared adjacency is a scenario definition, not a physical prediction, so there is nothing to validate it
against, and the card says so rather than claiming realism. Geometric reach (later) is validated against measured
reach envelopes for the posture represented; that is the later card's item 6.

## 7. Status

| D | I | Cn | N | V |
|---|---|---|---|---|
| this card | no | no (resolver read point is kernel 3006's) | no | not applicable at CP-1 (fixture) |

**Units when the belt lifts** (not queued; numbers from `_agent/next_number.py`):
- the predicate, the result record, the inventory → cell table reader and the load-time check (codex, small; `realism/src/mechanics/reach.ts`,
  REAL-42);
- the tests in §5 (composer).
