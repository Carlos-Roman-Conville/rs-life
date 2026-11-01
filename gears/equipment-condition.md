# Equipment condition as three independent properties (2768)

Statement: the condition of a piece of equipment is not one number. It has three
properties, each wearing on its own, each 1 for new (`Condition` in `src/registry.ts`):

- capability: what it can physically reach (a cracked crucible, a burnt-out furnace
  lining: the maximum falls);
- control: how reliably it holds a condition (a leaking seal, a sagging bellows: it
  reaches the maximum but cannot hold it; the +/- widens and a run drifts);
- accuracy: how truly its measuring roles report (offset and precision worsen with
  time since calibration and with rough use; calibration needs a standard).

Wear by use: each property falls per run by the process's severity (heat over 80 % of
the maximum, corrosive reagents, pressure) and by the material (clay fast, glass
medium, brass slow). Repair or calibration restores it. Producing a thing, measuring
it and identifying it are three different achievements.

The numeric home is `data/library/equipment.json`, table `wear` (rules and placeholder
rates); the values are not restated as a second runtime configuration.

Provenance: first stated in the pirate game's science/SCIENTIFIC_EQUIPMENT.md section 4
("Wear, calibration and the two confidence ratings"), added and refined 2026-10-29 from
an outside AI's suggestion, agreed there, all rows marked proposed.

Source: none (an outside AI's suggestion; no reference was cited). The ship-maintenance
loop it was tied to in the game is game content and is not part of this gear.

Evidence level 5 (hypothesis): a modelling structure, with no measured wear data.

Validation: not validated. Needed: wear and calibration-drift records for laboratory
apparatus (balances, thermometers, furnace linings) by use and material before any rate
leaves placeholder status.
