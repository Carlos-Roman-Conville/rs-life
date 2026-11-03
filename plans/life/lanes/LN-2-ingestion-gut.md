# LN-2 Ingestion and gut holdings: lane card (Life keeper, 2026-11-02; draft for review, not committed)

Checkpoint CP-1. Plan: `../PLAN.md` §3.A2 to A5, A7, A9 (body mass), §7. Research unit for the physical limits:
`../drafts/life-23-research-intake-limits.md` ({R-INTAKE}). Build unit {GUT} is drafted after this card is reviewed.

## 1. Relationship and conditions

Ingestion is one kernel `transfer()` of `q` kg of a Life food from an Economy inventory (or a Life plant organ) into
the body's stomach (A4, DC-13). On arrival the food's composition (LN-1) becomes the stomach's constituent amounts
(A5). **No constituent reaches an absorbed pool at ingestion**; that is LN-3 and LN-4.

**Accepted intake:** `q = min(q_requested, q_available, q_gastric_room)`, all in kg of the food as prepared (A3).
- `q_gastric_room` = declared capacity − current stomach contents. Unknown ≠ zero ≠ unlimited (Rex, RC-11): until
  {R-INTAKE} returns a sourced capacity, the scenario declares a **labelled fixture capacity**, recorded in the run
  record with basis `fixture`; an undeclared capacity fails configuration and is never read as unlimited. A fixture
  capacity proves the accounting and the handling of a supplied limit, not human stomach capacity. With a volume
  model the sourced capacity needs LN-1's density.
- If `q_gastric_room ≤ 0`, the act is `impossible: stomach full`, its trace naming the capacity's basis (proposal for
  review; a physical precondition, like an empty source).
- `q < q_requested` with `q > 0` is `completed` with q.

**Eligibility (A2):** in-world `impossible` comes only from represented bodily or physical constraints: a death
record, 0 kg at the source, or a full stomach against the declared capacity (§1). An unknown or ambiguous composition for a
declared food fails configuration before the run (LN-1 §1), and a good outside the scenario's supported ingestion pathway, and invalid input, are host or configuration errors, recorded in the trace and never an in-world outcome; no physiological conclusion is invented for them (agreed with Economy, 2026-11-02). Inability to ingest needs its own
sourced outcome later. Any further bodily condition (swallowing impairment, unconsciousness) enters only with a
source from {R-INTAKE}, and only for conditions the engine represents. Today's `gutFunction` argument
(`src/nutrition.ts:291`) is an absorption multiplier, not an ability to swallow, and is **not** used for eligibility.
Access and permission are the resolver's and their owners' (A2), never this lane's.

**Ingestion duration:** `q / intake_rate`, null until {R-INTAKE}; while null, A12 has no eating duration to charge,
and the run says so.

## 2. State, units, owner

`life.gut` is Life's `TransferLedger` (kernel `transfer.ts:7`: `id`, `snapshot`, `restore`, `unit`, `apply`).

| Account | Holds | Unit | Valid range | Written by |
|---|---|---|---|---|
| `<body>/stomach` | constituent amounts (LN-1's categories) plus the list of food ids received, with kg each (for the outcome's taste and for tests) | each constituent's LN-1 unit; food ids in kg | ≥ 0 | consume transfer (in); LN-3 (out) |
| `<body>/intestine` | constituent amounts | as above | ≥ 0 | LN-3 (in); LN-4 (out) |
| `<body>/colon` | constituent amounts still in the absorbing compartment | as above | ≥ 0 | LN-4 |
| `<body>/faeces_store` | material past absorption, awaiting voiding | as above | ≥ 0 | LN-4 (in); voiding, M4 (out) |

- **Quantities the ledger answers** (`unit(account, quantity)`): a Life food id → `kg` at `stomach` only (the
  consume endpoint); each constituent → its LN-1 unit at all four accounts (for LN-3 and LN-4's internal transfers).
  Anything else throws, so a mismatched request fails inside `transfer()` before anything moves.
- **`apply(stomach, foodId, +q)`** adds `q × composition` to the stomach's constituents and records `foodId: +q`.
  A negative delta on a food id throws: food identity is dissolved at entry, and nothing leaves the stomach as a food
  (vomiting is not represented).
- **The gut term of `body.mass`** is the sum of the mass constituents over the four accounts. Gut water is only here,
  never in `body.water` (A9 non-overlap).
- `snapshot()` returns a detached deep copy; `restore()` never throws (kernel `transaction.ts:8`).

## 3. Parameters, sources, uncertainty

Composition: LN-1. Physical limits ({R-INTAKE}): gastric capacity (mass or volume, with the meal and population it
was measured on), intake rate for a solid food like bread, and any sourced eligibility condition. Each null until an
opened source fills it, with a `searched:` line.

## 4. Numerical method and timing

Ingestion is instantaneous in the kernel's host phase (one kernel instant, A4). The meal's duration is charged as
expenditure (A12) but does not spread the transfer over time: the whole q enters the stomach at the resolution instant.
Whether a source supports spreading entry over the eating duration is an {R-INTAKE} question; until then this is a
declared simplification, and LN-3's timing test starts from that instant.

## 5. Functional tests (CP-1)

- **Once-only:** consume of q: inventory −q kg, stomach +q kg (as constituent mass), journal exactly one entry,
  `body.mass` +q, absorbed pools and stores unchanged.
- **Composition carried:** each stomach constituent rises by exactly `q × 10 × c_k`.
- **Empty gut:** a first meal into an empty gut behaves as any other.
- **Capacity (IT-M1a-3, RC-11):** against the declared fixture capacity, a portion below it enters once and raises
  `body.mass` by m; a request above the room gives `completed` with q = room; `room ≤ 0` gives `impossible: stomach
  full`; a scenario with no declared capacity fails configuration before the run.
- **Configuration:** a declared food with a missing, duplicated or condition-mismatched composition fails load before
  the run, and no outcome is ever emitted for it.
- **Invalid input:** q ≤ 0, non-finite q, a food id the run did not resolve at load, a unit other than kg, a non-food quantity at stomach,
  a negative food-id delta: each rejected as a host error recorded in the trace; nothing moves and no in-world outcome is emitted.
- **Rollback (A7, Rex 2026-11-02):** an injected throw in `life.gut.apply` (and separately in the Economy side) leaves
  the economy, gut and journal snapshots and the transactional event log byte-identical to before; no
  successful-transfer event survives; then exactly one `failed` outcome with the intention's cause is emitted; any
  expenditure committed before the throw is unchanged.
- **One outcome per cause:** across completed, impossible and failed.
- **Fence:** the gut and the resolver never read `mind.*`.
- **Body-mass partition:** each gram in the gut accounts is held by exactly one account and never also in `body.water`
  or tissue.

## 6. Independent comparison

At CP-1 none is claimed: the accounting is verification. Once {R-INTAKE} returns a capacity and an intake rate, the
lane is checked against held-apart measurements of meal size or eating rate for the represented population (not the
source that set the value).

## 7. Status

D: this card. I, C, N, V: none. Needs LN-1 (for composition), contract E1 (agreed, DC-13) and the registry entries for
`life.gut` and `shared.action.consume`.
