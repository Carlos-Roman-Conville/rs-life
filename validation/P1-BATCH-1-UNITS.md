# P1 batch 1: units, mechanisms and validation markers (independent check)

Checked by a session that wrote none of these commits. Code and flags are unchanged; this file only reports.

Scope: commits since `fe6322f` whose message or flag lines name a unit in 2620 to 2636 (`git log fe6322f^..HEAD`):

| Commit | Unit(s) named |
|---|---|
| 82cbec6 | 2622 |
| 4c7e6f9 | 2621 |
| 2d8057a | 2623 |
| 5381e00 | 2625 |
| 3b9d69f | 2626 |
| 5e9a866 | 2633 |

No commit in the range names 2620, 2624, 2627 to 2632, or 2634 to 2636. Tests for 2634 to 2636 exist (`test/fatigue.test.ts`, `test/circulation.test.ts`, `test/population.test.ts`) but no batch commit names them, so they are outside this list.

## 1. Commits in scope

82cbec6, 4c7e6f9, 2d8057a, 5381e00, 3b9d69f, 5e9a866.

## 2. Output ids added or changed by these commits (`out.` / `out["…"]` lines in the diffs)

| Output id | Commit | Stated unit | Arithmetic | Verdict |
|---|---|---|---|---|
| `metabolic_w` (`src/physiology.ts:487`) | 4c7e6f9 | Not stated next to the output. The header list (`src/physiology.ts:13`) names it with no unit; only the `_w` suffix gives it. | `metabolicHeat` returns W (`src/physics.ts:80`) | Not stated (suffix only); arithmetic consistent with W |
| `circulation.quantities.plasma-volume` (`src/circulation.ts:165`) | 2d8057a | `src/circulation.ts:1` "Volumes are mL" | `blood_volume_ml - blood_red_cells_ml`, mL | Stated and consistent |
| `circulation.quantities.red-cell-mass` (`src/circulation.ts:166`) | 2d8057a | As above | `blood_red_cells_ml`, mL | Stated and consistent |
| `circulation.quantities.plasma-volume-evidence-level` (`src/circulation.ts:152`) | 2d8057a | Evidence level 5; unitless | Constant 5 | Stated and consistent |
| `glycogen_bound_water_kg` (`src/nutrition.ts:476`) | 2d8057a | `_kg` suffix; listed in the header (`src/nutrition.ts:15`) | `glycogen / 1000 * GLYCOGEN_BOUND_WATER` (g to kg, times g water per g glycogen) | Stated (suffix and header) and consistent |
| `water_change_kg` (`src/nutrition.ts:478`) | 2d8057a | `_kg` suffix; header: "the day's change of the water ledger" (`src/nutrition.ts:15`) | `-(waterDeficitKg)` minus report mark, kg | Stated and consistent |

Outputs checked and not changed by a batch commit (out of this list, noted only): `aerobic_today` (`src/circulation.ts:209`) and `rmr_kcal` (`src/physiology.ts:488`) are not in any batch commit's added lines. `population.cohorts.labour` (person\*h, doc comment at `src/population.ts:300`) was added in 3bb393b, not in batch 1. `aerobic_today` has no unit in its code or in `README.md:224-226`; its arithmetic is mL O2/min (`oxygenDelivery`, `src/circulation.ts:37`). Worth a separate fix.

Problems in this list: `metabolic_w` has no unit next to the output.

## 3. Mechanism ids named by these commits

Ids named in the added lines (2d8057a only): `realism.nutrition.body_mass` and `realism.physiology.water_balance`.

Both appear in `../registry/mechanisms.json`:
- `realism.nutrition.body_mass` (registry entry near line 36382)
- `realism.physiology.water_balance` (registry entry near line 40089)

Mechanisms missing from the registry: none.

## 4. Validation markers per unit

| Unit | `validation (NNNN)` test | `(NNNN) unvalidated:` line | `(NNNN) report:` line | Verdict |
|---|---|---|---|---|
| 2621 | Yes (`test/energy-oxygen.test.ts:14`, `:24`) | Yes (`flags/atmosphere.md:19`) | Yes (`flags/atmosphere.md:20`) | Complete |
| 2622 | No | No (only `sourced:` and `searched:` lines in `flags/nutrition.md:24`, `flags/physiology.md:40`) | No | Missing both marker types and the report line |
| 2623 | Yes (`test/water-ledger.test.ts:344`) | Yes (`flags/physiology.md:43`, `:45`, `:46`) | Yes (`flags/nutrition.md:26`, `flags/physiology.md:47`, `:48`) | Complete |
| 2625 | No | Yes (`flags/muscular.md:16`, `flags/physiology.md:28`) | Yes (`flags/muscular.md:17`, `flags/physiology.md:29`) | Complete through the unvalidated flag (no test; accepted by the brief) |
| 2626 | Yes (`test/population.test.ts:204`) | Yes (`flags/ecology-and-population.md:14`) | Yes (`flags/ecology-and-population.md:15`) | Complete |
| 2633 | Yes (`test/mortality.test.ts:284`) | Yes (4 lines in the batch diffs) | Yes (3 lines in the batch diffs) | Complete |

`flags/FLAGS-validation.md` has no matching lines for these units; the markers are in the topic flag files above.

## Result

Problems: 2

1. `metabolic_w` (`src/physiology.ts:487`, 4c7e6f9): no unit stated next to the output; it is named by suffix only.
2. Unit 2622 (82cbec6): no `validation (2622)` test, no `(2622) unvalidated:` line, and no `(2622) report:` line; it has only `sourced:` and `searched:` lines in `flags/nutrition.md` and `flags/physiology.md`.

No mechanism ids are missing from the registry. Nothing in the code was changed.
