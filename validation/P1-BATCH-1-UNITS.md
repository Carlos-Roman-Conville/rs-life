# P1 batch 1: units, mechanisms and validation markers (independent check)

Checked by a session that wrote none of these commits. Code and flags are unchanged; this file only reports.

Scope (2761) (redo of 2714): every commit from `fe6322f` on that names a unit in 2620 to 2636 in its message or in added or removed lines, chosen with `git log --oneline -G '\(26(2[0-9]|3[0-6])\)' fe6322f^..HEAD`. The first pass (2714) missed 2620, 2624, 2634, 2635 and 2636; they are added below.

| Commit | Unit(s) named |
|---|---|
| 82cbec6 | 2622 |
| 4c7e6f9 | 2621 |
| 2d8057a | 2623 |
| 5381e00 | 2625 |
| 3b9d69f | 2626 |
| 5e9a866 | 2633 |
| fe6322f | 2620 |
| 507271a | 2624 |
| c0ed753 | 2634 |
| 2405d78 | 2635 |
| a89fbf9 | 2636 |

Later commits in the same `-G` match only touch flag text of an already-listed unit and add no outputs: 14fd1d0 (2620 report line), 3437dbe (2635), 184c6bf (2636 conflict resolved by 2752), c0750cb and 659c5ce (2625 wording). No commit in the range names 2627 to 2632.

## 1. Commits in scope

82cbec6, 4c7e6f9, 2d8057a, 5381e00, 3b9d69f, 5e9a866, fe6322f, 507271a, c0ed753, 2405d78, a89fbf9 (units 2622, 2621, 2623, 2625, 2626, 2633, 2620, 2624, 2634, 2635, 2636).

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

Outputs added by the five units added in 2761:

| Output id | Commit (unit) | Stated unit | Arithmetic | Verdict |
|---|---|---|---|---|
| `rmr_kcal` (`src/physiology.ts:488`), `rmr_label` (`:489`) | fe6322f (2620) | No unit next to the output; header (`src/physiology.ts:14`) lists it bare. `flags/physiology.md:53` quotes it as kcal/day. `rmr_label` is a string. | `restingMetabolicRate` returns kcal/day (Mifflin-St Jeor or Kleiber-type power law) | Not stated in code (suffix and flag only); arithmetic consistent with kcal/day |
| `activity` (`src/physiology.ts:486`) | c0ed753 (2634) | Schedule row id or null; no unit applies | String id | Stated and consistent |
| `muscular.fatigue_3cc.<group>.<side>` (`src/muscular.ts:267`) | c0ed753 (2634) | `README.md:260-261` names the ids but gives no unit | Fatigue state of the 3-compartment model, dimensionless fraction (not checked against the model's definition in this pass) | Not stated |
| `aerobic_today` (`src/circulation.ts:242`) | 2405d78 (2635) | Not in code or README (`README.md:226`). Stated as mL O2/min only in the flag, `flags/circulation.md:17` and `flags/muscular.md:20` ("circulation owns aerobic_today in mL O2/min"). | `delivery(maxCo * trainingFactor)`; maxCo is a flow, trainingFactor a unitless fraction (checked 0..1 by `fraction()`), so still mL O2/min | Stated in flags only; consistent |
| `population.cohorts.labour` (`src/population.ts:322`) | a89fbf9 (2636) | `LabourRow.personHours` doc comment, `src/population.ts:246`: person*h | Sum of `personHours` for adultsM and adultsF | Stated (doc comment, not at the output) and consistent |

Problems in this list: `metabolic_w`, `rmr_kcal` and `muscular.fatigue_3cc.*` have no unit next to the output; `aerobic_today` has its unit in the flags only.

## 3. Mechanism ids named by these commits

Ids named in the added lines (2d8057a only): `realism.nutrition.body_mass` and `realism.physiology.water_balance`.

Both appear in `../registry/mechanisms.json`:
- `realism.nutrition.body_mass` (registry entry near line 36382)
- `realism.physiology.water_balance` (registry entry near line 40089)

Added in 2761: 507271a (2624) names `realism.neurology.pk` in its added lines (`src/neurology.ts` comment, `flags/neurology.md:28`). It is in `../registry/mechanisms.json` (the mechanism list near line 36157; also a `restates` reference near line 18551). fe6322f, c0ed753, 2405d78 and a89fbf9 add no `realism.` ids.

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

Added in 2761:

| Unit | `validation (NNNN)` test | `(NNNN) unvalidated:` line | `(NNNN) report:` line | Verdict |
|---|---|---|---|---|
| 2620 (fe6322f) | Yes (`test/physiology.test.ts:291`, Mifflin-St Jeor) | No `unvalidated:` line; `flags/physiology.md:53` is `(2620) validation failed:` for the horse formula (no test written, nothing changed) | Yes (`flags/physiology.md:54`) | Complete; the horse failure is recorded as a failed validation, not an unvalidated flag. NOTE at `flags/physiology.md:38` present |
| 2624 (507271a) | No (`test/neurology.test.ts` adds 40 lines of exact-mass tests, none named `validation (2624)`) | Yes (`flags/neurology.md:29`) | Yes (`flags/neurology.md:30`) | Complete through the unvalidated flag (no test; the report states mass accounting is verified, biology is not). NOTE at `:28` present |
| 2634 (c0ed753) | Yes (`test/fatigue.test.ts:117`, `:127`) | No `(2634) unvalidated:` line | Yes (`flags/muscular.md:19`) | Test and report present; no unvalidated line (none needed if the report states the tested ranges). NOTE at `flags/muscular.md:18` present |
| 2635 (2405d78) | Yes (`test/circulation.test.ts:229`) | Yes (`flags/circulation.md:20`, `flags/muscular.md:23`) | Yes (`flags/circulation.md:19`, `flags/muscular.md:22`) | Complete. `pathway` (`flags/circulation.md:18`, `flags/muscular.md:21`) and `open` (`flags/circulation.md:21`, `flags/physiology.md:50`) lines present |
| 2636 (a89fbf9) | Yes (`test/population.test.ts:319`) | Yes (`flags/ecology-and-population.md:20`) | Yes (`flags/ecology-and-population.md:21`) | Complete. NOTEs at `:18`, `:19` present; the 2636 conflict line was resolved by 184c6bf (2752) |

`flags/FLAGS-validation.md` has no matching lines for these units; the markers are in the topic flag files above.

## Result

Problems: 5

1. `metabolic_w` (`src/physiology.ts:487`, 4c7e6f9): no unit stated next to the output; it is named by suffix only.
2. Unit 2622 (82cbec6): no `validation (2622)` test, no `(2622) unvalidated:` line, and no `(2622) report:` line; it has only `sourced:` and `searched:` lines in `flags/nutrition.md` and `flags/physiology.md`.
3. `rmr_kcal` (`src/physiology.ts:488`, fe6322f, 2620): no unit in code or header; kcal/day appears only in `flags/physiology.md:53`.
4. `muscular.fatigue_3cc.<group>.<side>` (`src/muscular.ts:267`, c0ed753, 2634): no unit stated in code, README or flags.
5. `aerobic_today` (`src/circulation.ts:242`, 2405d78, 2635): mL O2/min is stated only in the flags, not at the output or in `README.md`. (The 2714 file already noted this.)

Also noted, not counted: 2624 has no `validation (2624)` test (accepted through its `unvalidated:` flag); 2634 has no `unvalidated:` line though it has a test and a report; 2620 records a failed horse validation rather than an `unvalidated:` flag.

All 11 units (2620 to 2626 and 2633 to 2636) were audited across the commits above. No mechanism ids are missing from the registry. Nothing in the code was changed (2761).
