# Soil nutrient integration (3001)

Rule: every physical flow uses `transfer()` from `@rex/kernel`. A source debit
and destination credit are one transaction; a harvest or loss batches its N, P
and K requests in that same transaction. The cell and named accounts implement
`TransferLedger`, declare kg, and refuse negative or non-finite balances. A refusal
restores all participants and the journal. Losses have explicit `loss:<pathway>`
accounts. For each element, sum of cell pools plus account balances is invariant.
The host supplies all initial stocks, including funded input accounts; missing
accounts contain zero. Inputs are never silently borrowed from an infinite source.

A pool changes per transfer, at the causing flux's own step. Life's uptake,
decomposition/mineralisation, leaching and `realism.terrain.nutrient_transport`
apply transfers immediately, regardless of their scheduler period. Plants read
the already-debited pool (Life keeper's DESIGN section 2.4 position). There is no
pending or yearly buffer and no second integration on a slower clock. Soils is
the only writer of its slow dynamics: formation once per world and pedogenesis
per year, both also through transfers. The yearly soils/hydrology processes run
only their stocks' slow internal dynamics.

Why: integrating the same fast flux again at the annual tick duplicates it;
separate source and sink calculations break conservation (CG-20, DUP-51, DUP-53).
One amount, one atomic transfer, and an immediate stock update also remove the
CG-22 timescale ambiguity.

The registry timescale text for `realism.terrain.soils` and `.hydrology` should
read "pools change per transfer at the flux's step; formation once per world;
pedogenesis per year". The registry keeper owns that edit; this unit changes
neither the registry nor `kernel.json`. Ports wait for the registry ids/handoff.

Implementation: `src/soils.ts` owns `SoilCell`, `NutrientLedger` and the transfer
wrappers. Pools are kg of each element over the whole cell; `areaM2` and
`poolPerArea` give the explicit kg/m2 conversion (CG-9). `transferNutrients` is
the atomic multi-element entry point; `transferNutrient` and `addNutrient` wrap
one request. Zero amounts do nothing. Realism wrapper time is seconds and trace
time stays seconds; journal time is converted to kernel integer milliseconds.
Ecology functions accept days. A trace record per moved element and conservation
check are emitted after a successful transaction; the journal does not yet feed
the realism trace directly.

Harvest uses the pre-transfer derived fertility and yield in whole-cell tonnes
on the selected library row's harvested-part/moisture basis. It transfers
yield times kg/t to `crop:<field>` once, reporting any shortage per element.
`uptakeByPlant` instead certifies that Life already transferred uptake: harvest
leaves soil untouched and plant-to-crop export belongs outside this ledger.
Its `transferred` and `shortfall` are zero in that mode, not an audit of Life's
plant inventory. Yield still reads the current, already-debited fertility; hosts
must not assume the same maxYield gives the same tonnage before and after uptake.

Legacy crop names select these recorded defaults: cane = sugarcane-howeler,
tobacco = tobacco-howeler, maize = maize-howeler, cassava = cassava-howeler,
pease = field-pea-mpsg. Full `ecology.nutrient_removal.*` ids or row slugs select
other measurements. Null figures throw naming the row. No fixed-N share is
invented for pea: total harvested N is exported, and CG-7 must supply the separately
sourced fixation input (3000's legume note). The lumped soil debit is provisional
for legumes without that input.

Manure takes whole-cell fresh tonnes, defaults to `beef-open-concrete-lot`, and
allows `opts.row` to select another `ecology.manure_nutrients` row. Its return is
kg added per element, replacing the former index delta. The host funds `manure`
in the field's ledger. No implicit storage/ammonia loss fraction is invented.
Fallow and erosion retain their table index rates, converted per element as
`rate * days/365 * pool0_el/f0`. Fallow debits funded `inputs:fallow`, a placeholder
until CG-7 supplies sourced inputs. Erosion credits `loss:erosion`, a placeholder
until `realism.terrain.nutrient_transport` supplies the transport mechanism.
Erosion overdraws throw atomically; only harvest explicitly returns a shortfall.
Fallow and erosion return the derived index change, not a second stock update.

Provenance: PLATFORM sections 7a, 8 and 11a; CHAINS CG-9, CG-20 and CG-22 approved
by Rex 2026-11-01; Reality keeper's unit 3001 and kernel-transfer amendment 3006.
This is a conservation/integration contract, not a new empirical rate. Numeric
homes are `data/library/ecology.json` and the host's initial stocks.

Verification: `test/soils.test.ts` checks conservation, refusal rollback including
a late-element failure, one uptake debit, shortages, and daily versus hourly
annual fluxes to 1e-9 relative. `test/ecology.test.ts` checks its callers. These
are verification and local integration, not empirical validation or full Life /
terrain port integration. Validation remains open: an independent long-term
field N, P and K budget with measured inputs, harvest, losses and stock changes
is needed, including its measurement uncertainties. Placeholder input/erosion
rates and the level-4 index are not validated.
