# Kernel golden drift diagnosis (5158)

## Method

Diagnosed 2026-11-01. The baseline is realism `15dc9d2d31bbb31735df3ed7bccf5721ec0bcd39`; the pinned target is `407484359e41360ebac3a0c698f0e91973518180`. There are **81 first-parent commits** after the baseline (the task described an earlier 68-commit range). Every revision was executed: **82 revisions × 5 runs = 410 unique full records**. No history interval was inferred from unchanged endpoints or skipped because it looked like documentation.

The read-only harness is `../kernel/harness/golden/golden.test.ts`; `SOURCE.md` records the realism baseline. The kernel working HEAD was `d62287a904e0a1fd99524e5cd5cc81f60f593c7d`. Its realism golden files are unchanged from the issue's kernel `3b44147` (only settlement goldens and SOURCE notes changed). Node was `v24.14.1`, Vitest `5.0.5`; `canonical` and `fnv1a64` came from the already-installed `@rex/kernel` v0.1.0.

`scripts/golden-drift.ts` is both the dedicated Vitest config and the diagnostic test. It copies the harness's `plain`, `checkRecord` and `worldRecord` construction and uses the same five record shapes, default durations, variants and step sizes. It excludes wall time exactly as the harness does. The baseline was checked with `Buffer.equals` against all five recorded files **before scanning history**; all five were byte-identical. Hashes below are evidence labels, not substitutes for the byte comparison.

| Run | Baseline bytes | Baseline FNV-1a-64 | HEAD FNV-1a-64 | Changed steps |
|---|---:|---|---|---:|
| human week | 59378 | `e47f7d5299c852f0` | `f4dd47c900b1c557` | 5 |
| wound: bound-at-once | 186215 | `9d081a490c959f3c` | `bef06996d561cd0b` | 11 |
| wound: bound-after-hour | 186236 | `04dc130abaf078aa` | `75d26f782886520d` | 11 |
| wound: never-bound | 186208 | `7a9f432a70acca52` | `dfdf40c1284d7b9f` | 11 |
| horse stable | 74704 | `8fb4493c92e1b4a9` | `9c4d9e9201eca0b3` | 5 |

For each revision, only `src`, `examples` and `data` were extracted under `.bisect/<full-sha>` using `git archive --output=... <sha> src examples data` and `tar -xf ... -C ...`. This is the Windows binary-safe equivalent of the requested pipe. Modules resolve existing dependencies by walking up to realism/node_modules; no install, link, junction or worktree was made. Each capture used a fresh Vitest process. Parallel captures had separate result files and an atomic archive-directory claim; comparison was then performed strictly in first-parent order against the immediately preceding successful record.

Before archive cleanup, the final script runs `find .bisect -ignore_readdir_race -type l`, rejects any output, and also recursively checks for symlinks, Windows junctions and accidental node_modules. The earlier captures used the same recursive Node checks; the final global find also returned no links. Cleanup verifies the resolved SHA directory is inside `.bisect`, then uses Node's recursive removal (the Windows-safe equivalent of `rm -rf`). Archive directories were removed after each capture; all remaining scratch evidence and logs were removed after this report was assembled, leaving `.bisect/` empty.

All 410 unique records were captured successfully; there were **no historical API gaps** to bridge. No repository suite was run. The initial launcher needed a Windows tar fix (relative archive path avoids interpreting `E:` as a remote host); a deliberate pause stopped the sequential launcher before parallel capture. A global find scan also encountered a disappearing sibling archive during concurrent cleanup; bounded full-scan retries were added and the affected revision was recaptured successfully. Direct recursive shell cleanup was rejected by automatic review, so recovery used a Git-manifest-verified file-by-file deletion followed by empty-directory removal. Those launcher/cleanup events are not historical model failures. The five HEAD first-difference paths reproduce I-1066: human week `.days[0].kcalOut`; each wound variant `.days[0].fatigue.hand.L`; horse stable `.days[0].co2PeakPpm`.

Reproduce from empty `.bisect/` in PowerShell (pin the target so this diagnostic commit does not extend the range):

```powershell
$env:GOLDEN_DRIFT_SHA = '15dc9d2'
npx --no-install vitest run --config scripts/golden-drift.ts --configLoader runner
if ($LASTEXITCODE -ne 0) { throw "Baseline mismatch: stop" }
foreach ($sha in @(git rev-list --first-parent --reverse 15dc9d2..4074843)) {
  $env:GOLDEN_DRIFT_SHA = $sha
  npx --no-install vitest run --config scripts/golden-drift.ts --configLoader runner
  if ($LASTEXITCODE -ne 0) { throw "Capture failed: $sha" }
}
```

Optional parallel mode is documented in the script header. `.bisect/evidence.json` contains every changed path and before/after value; `.bisect/state.json` contains the latest full canonical records. Preserve findings in the report before safely clearing scratch. The report's inventories below retain every changed key pattern after scratch cleanup. A newly added/removed subtree is one changed key, matching the harness's first-difference traversal; array indices sort lexicographically, also matching the harness.

## Attribution

**Intended** means the boundary commit's own message or flags explicitly describe the affected change; numerical plausibility or an implementation diff alone is not sufficient. Added fields count as record changes. Reasons R1 onward below quote the boundary commit's own evidence, not later explanations. Each row is one run at one adjacent-commit boundary.

| Run | Commit | Unit | First changed key | Keys changed (summarised) | Commit's own stated reason |
|---|---|---|---|---|---|
| human week | `4c7e6f9` | 2621 | `.days[0].massKg` | 323: days 227; checks 44; components 51; world.transferHash 1 | **intended** — “This is an expected model correction, not tolerance drift” (R1) |
| wound: bound-at-once | `4c7e6f9` | 2621 | `.days[0].outputs.aerobic_today` | 577: days 195; week days 276; checks 47; components 58; week.world.transferHash 1 | **intended** — “This is an expected model correction, not tolerance drift” (R1) |
| wound: bound-after-hour | `4c7e6f9` | 2621 | `.days[0].outputs.aerobic_today` | 577: days 195; week days 276; checks 47; components 58; week.world.transferHash 1 | **intended** — “This is an expected model correction, not tolerance drift” (R1) |
| wound: never-bound | `4c7e6f9` | 2621 | `.days[0].outputs.aerobic_today` | 577: days 195; week days 276; checks 47; components 58; week.world.transferHash 1 | **intended** — “This is an expected model correction, not tolerance drift” (R1) |
| horse stable | `4c7e6f9` | 2621 | `.days[0].co2PeakPpm` | 602: days 540; restingVentilation 1; checks 32; components 28; world.transferHash 1 | **intended** — “This is an expected model correction, not tolerance drift” (R1) |
| human week | `2d8057a` | 2623 | `.days[0].kcalOut` | 338: days 238; checks 43; components 55; world.transferCount 1; world.transferHash 1 | **intended** — “Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.” (R2) |
| wound: bound-at-once | `2d8057a` | 2623 | `.days[0].healingFactors.energyBalanceKcalDay` | 685: days 238; week days 322; checks 53; components 70; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.” (R2) |
| wound: bound-after-hour | `2d8057a` | 2623 | `.days[0].healingFactors.energyBalanceKcalDay` | 685: days 238; week days 322; checks 53; components 70; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.” (R2) |
| wound: never-bound | `2d8057a` | 2623 | `.days[0].healingFactors.energyBalanceKcalDay` | 685: days 238; week days 322; checks 53; components 70; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.” (R2) |
| horse stable | `2d8057a` | 2623 | `.days[0].co2PeakPpm` | 815: days 750; checks 26; components 37; world.transferCount 1; world.transferHash 1 | **intended** — “Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.” (R2) |
| human week | `d797082` | 2656 | `.world.checks.byQuantity.element:C.hash` | 27: checks 27 | **intended** — “World and Trace now retain Neumaier carries” (R3) |
| wound: bound-at-once | `d797082` | 2656 | `.week.world.checks.byQuantity.element:C.hash` | 31: checks 31 | **intended** — “World and Trace now retain Neumaier carries” (R3) |
| wound: bound-after-hour | `d797082` | 2656 | `.week.world.checks.byQuantity.element:C.hash` | 31: checks 31 | **intended** — “World and Trace now retain Neumaier carries” (R3) |
| wound: never-bound | `d797082` | 2656 | `.week.world.checks.byQuantity.element:C.hash` | 31: checks 31 | **intended** — “World and Trace now retain Neumaier carries” (R3) |
| horse stable | `d797082` | 2656 | `.world.checks.byQuantity.element:C.hash` | 15: checks 15 | **intended** — “World and Trace now retain Neumaier carries” (R3) |
| human week | `8cee7ac` | 2677 / 2687 | `.world.components[0].props.water_start_kg` | 1: components 1 | **intended** — “Deficit uses starting minus current total (free plus bound) water.” (R4) |
| wound: bound-at-once | `8cee7ac` | 2677 / 2687 | `.week.world.components[0].props.water_start_kg` | 1: components 1 | **intended** — “Deficit uses starting minus current total (free plus bound) water.” (R4) |
| wound: bound-after-hour | `8cee7ac` | 2677 / 2687 | `.week.world.components[0].props.water_start_kg` | 1: components 1 | **intended** — “Deficit uses starting minus current total (free plus bound) water.” (R4) |
| wound: never-bound | `8cee7ac` | 2677 / 2687 | `.week.world.components[0].props.water_start_kg` | 1: components 1 | **intended** — “Deficit uses starting minus current total (free plus bound) water.” (R4) |
| horse stable | `8cee7ac` | 2677 / 2687 | `.world.components[0].props.water_start_kg` | 1: components 1 | **intended** — “Deficit uses starting minus current total (free plus bound) water.” (R4) |
| wound: bound-at-once | `5e9a866` | 2633 | `.medicine.crisisTimeOrigin` | 1: medicine 1 | **intended** — “a state cursor and a fixed world-time origin” (R5) |
| wound: bound-after-hour | `5e9a866` | 2633 | `.medicine.crisisTimeOrigin` | 1: medicine 1 | **intended** — “a state cursor and a fixed world-time origin” (R5) |
| wound: never-bound | `5e9a866` | 2633 | `.medicine.crisisTimeOrigin` | 1: medicine 1 | **intended** — “a state cursor and a fixed world-time origin” (R5) |
| human week | `c0ed753` | 2634 | `.days[0].outputs.activity` | 8: days 7; components 1 | **unexplained** — “Drive local and systemic fatigue from one activity schedule” (R6) |
| wound: bound-at-once | `c0ed753` | 2634 | `.days[0].outputs.activity` | 15: days 7; week days 7; components 1 | **unexplained** — “Drive local and systemic fatigue from one activity schedule” (R6) |
| wound: bound-after-hour | `c0ed753` | 2634 | `.days[0].outputs.activity` | 15: days 7; week days 7; components 1 | **unexplained** — “Drive local and systemic fatigue from one activity schedule” (R6) |
| wound: never-bound | `c0ed753` | 2634 | `.days[0].outputs.activity` | 15: days 7; week days 7; components 1 | **unexplained** — “Drive local and systemic fatigue from one activity schedule” (R6) |
| horse stable | `c0ed753` | 2634 | `.days[0].outputs.activity` | 31: days 30; components 1 | **unexplained** — “Drive local and systemic fatigue from one activity schedule” (R6) |
| wound: bound-at-once | `3df7606` | 2723 | `.days[0].healingFactors.collagenIntegrity` | 15: days 14; medicine 1 | **intended** — “HealingFactors now accepts collagenIntegrity instead of vitCMg.” (R7) |
| wound: bound-after-hour | `3df7606` | 2723 | `.days[0].healingFactors.collagenIntegrity` | 15: days 14; medicine 1 | **intended** — “HealingFactors now accepts collagenIntegrity instead of vitCMg.” (R7) |
| wound: never-bound | `3df7606` | 2723 | `.days[0].healingFactors.collagenIntegrity` | 15: days 14; medicine 1 | **intended** — “HealingFactors now accepts collagenIntegrity instead of vitCMg.” (R7) |
| wound: bound-at-once | `84257ea` | 2727 | `.days[0].outputs.medicine.exposure.altitude-illness-the-mountain-sickness` | 120: days 56; week days 56; components 8 | **unexplained** — “Deduplicate gas tolerance ownership and medicine effects (2727)” (R8) |
| wound: bound-after-hour | `84257ea` | 2727 | `.days[0].outputs.medicine.exposure.altitude-illness-the-mountain-sickness` | 120: days 56; week days 56; components 8 | **unexplained** — “Deduplicate gas tolerance ownership and medicine effects (2727)” (R8) |
| wound: never-bound | `84257ea` | 2727 | `.days[0].outputs.medicine.exposure.altitude-illness-the-mountain-sickness` | 120: days 56; week days 56; components 8 | **unexplained** — “Deduplicate gas tolerance ownership and medicine effects (2727)” (R8) |
| wound: bound-at-once | `8e57a45` | 2787 | `.days[0].outputs.medicine.signs.gum_bleeding` | 30: days 14; week days 14; components 2 | **intended** — “Add dentition-aware signs, nullable late-stage thresholds and tissue crises” (R9) |
| wound: bound-after-hour | `8e57a45` | 2787 | `.days[0].outputs.medicine.signs.gum_bleeding` | 30: days 14; week days 14; components 2 | **intended** — “Add dentition-aware signs, nullable late-stage thresholds and tissue crises” (R9) |
| wound: never-bound | `8e57a45` | 2787 | `.days[0].outputs.medicine.signs.gum_bleeding` | 30: days 14; week days 14; components 2 | **intended** — “Add dentition-aware signs, nullable late-stage thresholds and tissue crises” (R9) |
| wound: bound-at-once | `12f61ac` | 2832 | `.days[0].fatigue.hand.L` | 17: days 14; checks 2; week.world.transferHash 1 | **intended** — “3CC updates clamp compartment bound roundoff within the existing 1e-12 conservation tolerance and renormalise the sum to one.” (R10) |
| wound: bound-after-hour | `12f61ac` | 2832 | `.days[0].fatigue.hand.L` | 17: days 14; checks 2; week.world.transferHash 1 | **intended** — “3CC updates clamp compartment bound roundoff within the existing 1e-12 conservation tolerance and renormalise the sum to one.” (R10) |
| wound: never-bound | `12f61ac` | 2832 | `.days[0].fatigue.hand.L` | 17: days 14; checks 2; week.world.transferHash 1 | **intended** — “3CC updates clamp compartment bound roundoff within the existing 1e-12 conservation tolerance and renormalise the sum to one.” (R10) |
| wound: bound-at-once | `9342308` | 2833 | `.days[0].fatigue.hand.L` | 19: days 14; checks 3; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “reason: exact solution of the same equations replaces 1 s explicit Euler” (R11) |
| wound: bound-after-hour | `9342308` | 2833 | `.days[0].fatigue.hand.L` | 19: days 14; checks 3; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “reason: exact solution of the same equations replaces 1 s explicit Euler” (R11) |
| wound: never-bound | `9342308` | 2833 | `.days[0].fatigue.hand.L` | 19: days 14; checks 3; week.world.transferCount 1; week.world.transferHash 1 | **intended** — “reason: exact solution of the same equations replaces 1 s explicit Euler” (R11) |

### Boundary evidence and re-record requirements

**R1 — `4c7e6f9` (2621), intended.** All five runs change their gas state, coupled energy/water state and downstream ledgers. The same commit also states: ‘The horse's Kleiber-scaled exchange replaces the unscaled human MET source, moving its thirty-day CO2 peak from about 1,070 to 810 ppm and ventilation to about 28.026 L/min.’ This explicitly covers the human and horse numerical changes.

Source at this commit: `flags/atmosphere.md, NOTE (2621), at 4c7e6f9`.

> The instruction to preserve human checkpoint numbers conflicts with RMR-scaled gas exchange: the human fixture supplies height/age/sex too. Published rows were left intact; a fresh human week gives day-1 CO2 1378.817 ppm versus published 1406.432. This is an expected model correction, not tolerance drift; subsequent energy/water values can also shift slightly through changed room gas composition.

**R2 — `2d8057a` (2623), intended.** All five records change through immediate traced body mass updates, the shared body-water ledger and its initialization fields. The commit message also says ‘refresh checkpoints’ and calls out changed hydration/mass expectations. The added/changed mass checks and transfer counts belong to this deliberately changed accounting.

Source at this commit: `flags/physiology.md, (2623) report, at 2d8057a`.

> Heat capacity and metabolic demand now follow immediate water mass, so checkpoint figures change.

**R3 — `d797082` (2656), intended.** Only conservation-check expected values/hashes change: 27 human-week keys, 31 per wound variant, 15 horse keys. Daily predictions and final components/transfers are byte-identical across this boundary. The report explicitly contrasts naive error with compensated zero final error against exact totals, and says printed checkpoint output is identical. That is consistent with the hidden check-record drift; numerical ledger correction was stated, even though the physical model was unchanged.

Source at this commit: `flags/independence.md, (2656) note and report, at d797082`.

> World and Trace now retain Neumaier carries, including across trace folds/compaction; ledger comparison snapshots include the World carries. No physical model or conservation tolerance changed.

**R4 — `8cee7ac` (2677 / 2687), intended.** Exactly one key changes per run: the body/horse component's `props.water_start_kg`, now including glycogen-bound water. For the human fixtures it is 40 -> 41.2 kg. No daily values, checks or transfer hashes change at this boundary. The flags explicitly define this total-water reference and separately document preserving host deficits; both units share one commit, so the SOURCE reason must be one line for that commit.

Source at this commit: `flags/physiology.md, (2677) and (2687), at 8cee7ac`.

> Deficit uses starting minus current total (free plus bound) water. Missing initial water splits the library total into free and bound portions; explicit contents remain free water.

**R5 — `5e9a866` (2633), intended.** Each wound record gains exactly `.medicine.crisisTimeOrigin = 0`. This is the persisted fixed world-time origin explicitly described by the commit's flag. Human week and horse records do not change. It is a record-schema addition, not a changed wound prediction.

Source at this commit: `flags/medicine.md, (2633) NOTE for flushMedicineCrises, at 5e9a866`.

> `flushMedicineCrises(world, state)` flushes appended records once using a state cursor and a fixed world-time origin.

**R6 — `c0ed753` (2634), unexplained.** All changed keys are newly published `outputs.activity`: `physiology.met.sleeping` at human day endpoints/final body state, and null for the horse's numeric MET fixture. Counts are 8 human-week, 15 per wound variant (wound days plus embedded week), and 31 horse keys. The implementation makes this provenance clear, but the message/flags discuss the shared schedule and muscular.fatigue_3cc outputs without stating that physiology's serialized activity output is being added. Under the task's explicit-intent rule this remains unexplained, rather than inferring re-record permission from the feature title.

Source at this commit: `commit message and flags/muscular.md NOTE (2634), at c0ed753`.

> Drive local and systemic fatigue from one activity schedule

**R7 — `3df7606` (2723), intended.** Each wound record has 15 changed keys: seven new daily healingFactors.collagenIntegrity values (1), seven removed vitCMg values (1500), and the medicine state's new collagenIntegrity=1. The flags explicitly state the input replacement and medicine's consumption of collagen state. Human week and horse records do not change. The commit's ‘without changing model values or tolerances’ statement concerns the model constants; the flags separately explain this recorded input/schema replacement.

Source at this commit: `flags/medicine.md, (2723) pathway, at 3df7606`.

> HealingFactors now accepts collagenIntegrity instead of vitCMg. Missing collagen applies no multiplier and yields no diagnosis; it is not evidence of adequate nutrition.

**R8 — `84257ea` (2727), unexplained.** Every wound record gains eight medicine.exposure.* output fields, all zero, at seven wound-day checkpoints, seven embedded-week checkpoints and final body outputs: 8 x (7 + 7 + 1) = 120 keys. Existing keys do not change. The flags claim the intended combined-condition computation and say ‘no number was changed’, but neither the message nor flags states that eight new diagnostics will be serialized for unexposed bodies. The computational pathway is documented; this golden-schema expansion is not explicitly claimed.

Source at this commit: `commit message and flags/medicine.md (2727), at 84257ea`.

> Medicine combines low inspired oxygen and low saturation using the maximum stage, not additive effects; medicineProcess consumes breathing outputs. Chemistry gas rows now reference the owners.

**R9 — `8e57a45` (2787), intended.** Each wound record gains medicine.signs.gum_bleeding and medicine.signs.teeth_lost at seven wound-day checkpoints, seven embedded-week checkpoints and final body outputs: 30 added keys. Both values are null in these fixtures. The commit explicitly says it adds dentition-aware signs and nullable late-stage thresholds; the flags name gum bleeding, its null behavior, and the unsourced/null tooth-loss threshold. This is an explicitly stated addition, unlike the two schema expansions listed as unexplained.

Source at this commit: `commit message and flags/medicine.md (2787), at 8e57a45`.

> `medicine.signs.gum_bleeding` follows the existing impaired-collagen threshold when `MedicineOptions.dentate` is true, is 0 for a body without teeth or after recovery, and null when dentition is unspecified.

**R10 — `12f61ac` (2832), intended.** Each wound record changes 17 keys: hand fatigue/peak endpoints, the hand-fraction check hash and last actual, and the transfer hash. The first daily hand value moves from 4.287481930343092e-22 to 4.287481930343113e-22. This is the expressly documented roundoff normalization, separately attributable from the following integrator replacement. Human week and horse records are unchanged.

Source at this commit: `flags/muscular.md, (2832) NOTE, at 12f61ac`.

> 3CC updates clamp compartment bound roundoff within the existing 1e-12 conservation tolerance and renormalise the sum to one. Larger bound or conservation errors still throw.

**R11 — `9342308` (2833), intended.** Each wound record changes 19 keys: hand fatigue/peak endpoints, hand-fraction check count/hash, total checks, transfer count and transfer hash. The first daily hand value changes from 4.287481930343113e-22 to 4.270386764980067e-22. Both the changed predictions and aggregated trace shape are expressly covered by the commit message and re-recorded flags. Human week and horse records are unchanged.

Source at this commit: `flags/muscular.md, (2833) re-recorded: traces transfers and conserves fibres, at 9342308`.

> - (2833) re-recorded: test/muscular.test.ts, traces transfers and conserves fibres: 120 sum checks and >120 transfers -> 1 sum check and 3 integrated transfers, bitwise split equality -> absolute difference <=1e-12; reason: exact solution of the same equations replaces 1 s explicit Euler

### Complete changed-key inventories

Each inventory lists all differing paths for the named run(s) at that commit. Only day-array indices are collapsed to `[*]`; component and content indices are retained. Brace groups list the exact suffix keys, not an unrestricted wildcard. The three wound variants share an inventory only when their path sets are identical. Counts in the main table retain actual differing paths; collapsing days here does not claim every day changed.

<details><summary>4c7e6f9: human week — 130 path patterns</summary>

- `.days[*].{kcalOut, massKg, metabolicWaterKg, roomCo2PeakPpm, storedKcal, waterDeficitKg, waterInKg, waterKg, waterOutKg}`
- `.days[*].outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.days[*].waterOutByKg.{breath, skin diffusion, sweat, urine}`
- `.world.checks.byQuantity.element:C.first.{actual, expected}`
- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.world.checks.byQuantity.element:O.first.{actual, expected}`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.world.checks.byQuantity.energy:daily-and-pending.hash`
- `.world.checks.byQuantity.energy:daily-and-pending.last.{actual, expected}`
- `.world.checks.byQuantity.energy:stored.hash`
- `.world.checks.byQuantity.energy:stored.last.{actual, expected}`
- `.world.checks.byQuantity.mass:body.first.{actual, expected}`
- `.world.checks.byQuantity.mass:body.hash`
- `.world.checks.byQuantity.mass:body.last.{actual, expected}`
- `.world.checks.byQuantity.mass:co2.first.{actual, expected}`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.world.checks.byQuantity.mass:o2.first.{actual, expected}`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.world.components[0].contents[0].mass`
- `.world.components[0].{mass, temperatureC}`
- `.world.components[0].props.{co2ppmMin, co2ppmPeak, expenditure_kcal, fat_kg, nut_balance_kcal, nut_spent_mark, nut_stored_kcal, nut_sweat_mark, nut_unplaced_kcal, nut_water_mark, pal_last, sweat_kg, urine_kg, waterDeficitKg, waterDeficitPct}`
- `.world.components[0].props.outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.world.components[1].contents[0].mass`
- `.world.components[1].contents[1].mass`
- `.world.components[1].contents[2].mass`
- `.world.components[1].contents[4].mass`
- `.world.components[1].props.{co2ppm, o2frac, rh, wbgt_c}`
- `.world.components[1].props.outputs.{air_c, felt_c, wbgt_c}`
- `.world.components[1].temperatureC`
- `.world.transferHash`

</details>

<details><summary>4c7e6f9: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 176 path patterns</summary>

- `.days[*].healingFactors.energyBalanceKcalDay`
- `.days[*].outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.days[*].outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.days[*].outputs.circulation.quantities.{arterial-oxygen-saturation, cardiac-output, oxygen-delivery-do2}`
- `.week.days[*].{kcalOut, massKg, metabolicWaterKg, roomCo2PeakPpm, storedKcal, waterDeficitKg, waterInKg, waterKg, waterOutKg}`
- `.week.days[*].outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.week.days[*].outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.week.days[*].outputs.circulation.quantities.{arterial-oxygen-saturation, cardiac-output, oxygen-delivery-do2}`
- `.week.days[*].waterOutByKg.{breath, skin diffusion, sweat, urine}`
- `.week.world.checks.byQuantity.element:C.first.{actual, expected}`
- `.week.world.checks.byQuantity.element:C.hash`
- `.week.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:H.hash`
- `.week.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:N.hash`
- `.week.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:O.first.{actual, expected}`
- `.week.world.checks.byQuantity.element:O.hash`
- `.week.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.week.world.checks.byQuantity.energy:daily-and-pending.hash`
- `.week.world.checks.byQuantity.energy:daily-and-pending.last.{actual, expected}`
- `.week.world.checks.byQuantity.energy:stored.hash`
- `.week.world.checks.byQuantity.energy:stored.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body-composition-proxy.hash`
- `.week.world.checks.byQuantity.mass:body-composition-proxy.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body.first.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body.hash`
- `.week.world.checks.byQuantity.mass:body.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:co2.first.{actual, expected}`
- `.week.world.checks.byQuantity.mass:co2.hash`
- `.week.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:n2.hash`
- `.week.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.week.world.checks.byQuantity.mass:o2.first.{actual, expected}`
- `.week.world.checks.byQuantity.mass:o2.hash`
- `.week.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:water.hash`
- `.week.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.week.world.components[0].contents[0].mass`
- `.week.world.components[0].{mass, temperatureC}`
- `.week.world.components[0].props.{co2ppmMin, co2ppmPeak, expenditure_kcal, fat_kg, nut_balance_kcal, nut_spent_mark, nut_stored_kcal, nut_sweat_mark, nut_unplaced_kcal, nut_water_mark, pal_last, sweat_kg, urine_kg, waterDeficitKg, waterDeficitPct}`
- `.week.world.components[0].props.outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.week.world.components[0].props.outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.week.world.components[0].props.outputs.circulation.quantities.{arterial-oxygen-saturation, cardiac-output, oxygen-delivery-do2}`
- `.week.world.components[1].contents[0].mass`
- `.week.world.components[1].contents[1].mass`
- `.week.world.components[1].contents[2].mass`
- `.week.world.components[1].contents[4].mass`
- `.week.world.components[1].props.{co2ppm, o2frac, rh, wbgt_c}`
- `.week.world.components[1].props.outputs.{air_c, felt_c, wbgt_c}`
- `.week.world.components[1].temperatureC`
- `.week.world.transferHash`

</details>

<details><summary>4c7e6f9: horse stable — 80 path patterns</summary>

- `.days[*].{co2PeakPpm, ventilationLMin, waterInKg, waterKg, waterOutKg}`
- `.days[*].outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, sao2, skin_diffusion_l_per_h, sweat_l_per_h, ventilation_l_min, water_deficit_pct, wbgt_c}`
- `.restingVentilation`
- `.world.checks.byQuantity.element:C.first.{actual, expected}`
- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.world.checks.byQuantity.element:O.first.{actual, expected}`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.world.checks.byQuantity.mass:co2.first.{actual, expected}`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:o2.first.{actual, expected}`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.world.components[0].contents[0].mass`
- `.world.components[0].props.{co2ppmMin, co2ppmPeak, sweat_kg, waterDeficitKg, waterDeficitPct}`
- `.world.components[0].props.outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, sao2, skin_diffusion_l_per_h, sweat_l_per_h, ventilation_l_min, water_deficit_pct, wbgt_c}`
- `.world.components[0].temperatureC`
- `.world.components[1].contents[0].mass`
- `.world.components[1].contents[1].mass`
- `.world.components[1].contents[2].mass`
- `.world.components[1].contents[4].mass`
- `.world.components[1].props.{co2ppm, o2frac, rh}`
- `.world.components[1].temperatureC`
- `.world.transferHash`

</details>

<details><summary>2d8057a: human week — 134 path patterns</summary>

- `.days[*].{kcalOut, massKg, metabolicWaterKg, roomCo2PeakPpm, storedKcal, waterDeficitKg, waterInKg, waterKg, waterOutKg}`
- `.days[*].outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.days[*].waterOutByKg.{breath, skin diffusion, sweat, urine}`
- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.world.checks.byQuantity.energy:daily-and-pending.hash`
- `.world.checks.byQuantity.energy:daily-and-pending.last.{actual, expected}`
- `.world.checks.byQuantity.energy:stored.first.{actual, expected}`
- `.world.checks.byQuantity.energy:stored.hash`
- `.world.checks.byQuantity.energy:stored.last.{actual, expected}`
- `.world.checks.byQuantity.mass:body.{count, hash}`
- `.world.checks.byQuantity.mass:body.first.{actual, expected, t}`
- `.world.checks.byQuantity.mass:body.last.{actual, expected}`
- `.world.checks.byQuantity.mass:body:week`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.world.checks.byQuantity.mass:nutrient:sodium.last.expected`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.world.checks.count`
- `.world.components[0].contents[0].mass`
- `.world.components[0].{mass, temperatureC}`
- `.world.components[0].props.{co2ppmMin, co2ppmPeak, expenditure_kcal, fat_kg, nut_balance_kcal, nut_spent_mark, nut_start_mass, nut_stored_kcal, nut_sweat_mark, nut_unplaced_kcal, nut_water_mark, nut_water_report_mark, pal_last, sweat_kg, urine_kg, waterDeficitKg, waterDeficitPct, water_start_kg, water_start_mass_kg}`
- `.world.components[0].props.outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.world.components[1].contents[0].mass`
- `.world.components[1].contents[1].mass`
- `.world.components[1].contents[2].mass`
- `.world.components[1].contents[4].mass`
- `.world.components[1].props.{co2ppm, o2frac, rh, wbgt_c}`
- `.world.components[1].props.outputs.{air_c, felt_c, wbgt_c}`
- `.world.components[1].temperatureC`
- `.world.{transferCount, transferHash}`

</details>

<details><summary>2d8057a: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 205 path patterns</summary>

- `.days[*].healingFactors.energyBalanceKcalDay`
- `.days[*].outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.days[*].outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.days[*].outputs.circulation.quantities.{arterial-oxygen-saturation, blood-volume, cardiac-output, haemoglobin, oxygen-delivery-do2, plasma-volume, plasma-volume-evidence-level, red-cell-mass}`
- `.week.days[*].{kcalOut, massKg, metabolicWaterKg, roomCo2PeakPpm, storedKcal, waterDeficitKg, waterInKg, waterKg, waterOutKg}`
- `.week.days[*].outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.week.days[*].outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.week.days[*].outputs.circulation.quantities.{arterial-oxygen-saturation, blood-volume, cardiac-output, haemoglobin, oxygen-delivery-do2, plasma-volume, plasma-volume-evidence-level, red-cell-mass}`
- `.week.days[*].waterOutByKg.{breath, skin diffusion, sweat, urine}`
- `.week.world.checks.byQuantity.element:C.hash`
- `.week.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:H.hash`
- `.week.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:N.hash`
- `.week.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.week.world.checks.byQuantity.element:O.hash`
- `.week.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.week.world.checks.byQuantity.energy:daily-and-pending.hash`
- `.week.world.checks.byQuantity.energy:daily-and-pending.last.{actual, expected}`
- `.week.world.checks.byQuantity.energy:stored.first.{actual, expected}`
- `.week.world.checks.byQuantity.energy:stored.hash`
- `.week.world.checks.byQuantity.energy:stored.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body-composition-proxy.first.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body-composition-proxy.hash`
- `.week.world.checks.byQuantity.mass:body-composition-proxy.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body.{count, hash}`
- `.week.world.checks.byQuantity.mass:body.first.{actual, expected, t}`
- `.week.world.checks.byQuantity.mass:body.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:body:week`
- `.week.world.checks.byQuantity.mass:co2.hash`
- `.week.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:n2.hash`
- `.week.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.week.world.checks.byQuantity.mass:o2.hash`
- `.week.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.week.world.checks.byQuantity.mass:water.hash`
- `.week.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.week.world.checks.byQuantity.volume:blood:body.hash`
- `.week.world.checks.byQuantity.volume:blood:body.last.{actual, expected}`
- `.week.world.checks.byQuantity.volume:blood:checkpoint.hash`
- `.week.world.checks.byQuantity.volume:blood:checkpoint.last.{actual, expected}`
- `.week.world.checks.count`
- `.week.world.components[0].contents[0].mass`
- `.week.world.components[0].{mass, temperatureC}`
- `.week.world.components[0].props.{blood_red_cells_ml, blood_volume_ml, circulation_dehydration_ml, co2ppmMin, co2ppmPeak, expenditure_kcal, fat_kg, nut_balance_kcal, nut_spent_mark, nut_start_mass, nut_stored_kcal, nut_sweat_mark, nut_unplaced_kcal, nut_water_mark, nut_water_report_mark, pal_last, sweat_kg, urine_kg, waterDeficitKg, waterDeficitPct, water_start_kg, water_start_mass_kg}`
- `.week.world.components[0].props.outputs.{aerobic_today, alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_day_kcal, energy_balance_kcal, energy_expenditure_kcal, energy_unplaced_kcal, fat_kg, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, protein_need_g, rmr_kcal, sao2, skin_diffusion_l_per_h, ventilation_l_min, water_change_kg, water_deficit_pct, wbgt_c}`
- `.week.world.components[0].props.outputs.circulation.blood_gas.{arterial-pco2, oxygen-content-with-co, saturation-sao2}`
- `.week.world.components[0].props.outputs.circulation.quantities.{arterial-oxygen-saturation, blood-volume, cardiac-output, haemoglobin, oxygen-delivery-do2, plasma-volume, plasma-volume-evidence-level, red-cell-mass}`
- `.week.world.components[1].contents[0].mass`
- `.week.world.components[1].contents[1].mass`
- `.week.world.components[1].contents[2].mass`
- `.week.world.components[1].contents[4].mass`
- `.week.world.components[1].props.{co2ppm, o2frac, rh, wbgt_c}`
- `.week.world.components[1].props.outputs.{air_c, felt_c, wbgt_c}`
- `.week.world.components[1].temperatureC`
- `.week.world.{transferCount, transferHash}`

</details>

<details><summary>2d8057a: horse stable — 90 path patterns</summary>

- `.days[*].{co2PeakPpm, kcalOut, massKg, storedKcal, ventilationLMin, waterInKg, waterKg, waterOutKg}`
- `.days[*].outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_kcal, energy_expenditure_kcal, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, rmr_kcal, sao2, skin_diffusion_l_per_h, sweat_l_per_h, ventilation_l_min, water_deficit_pct, wbgt_c}`
- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.{actual, expected}`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.{actual, expected}`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:N.last.{actual, expected}`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.element:O.last.{actual, expected}`
- `.world.checks.byQuantity.mass:body`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.{actual, expected}`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.{actual, expected}`
- `.world.checks.count`
- `.world.components[0].contents[0].mass`
- `.world.components[0].{mass, temperatureC}`
- `.world.components[0].props.{co2ppmMin, co2ppmPeak, expenditure_kcal, pal_last, sweat_kg, waterDeficitKg, waterDeficitPct, water_start_kg, water_start_mass_kg}`
- `.world.components[0].props.outputs.{alveolar_po2_mmhg, breath_water_l_per_h, co2_ppm, energy_balance_kcal, energy_expenditure_kcal, inspired_po2_mmhg, metabolic_w, o2_frac, paco2_mmhg, pal, rmr_kcal, sao2, skin_diffusion_l_per_h, sweat_l_per_h, ventilation_l_min, water_deficit_pct, wbgt_c}`
- `.world.components[1].contents[0].mass`
- `.world.components[1].contents[1].mass`
- `.world.components[1].contents[2].mass`
- `.world.components[1].contents[4].mass`
- `.world.components[1].props.{co2ppm, o2frac, rh}`
- `.world.components[1].temperatureC`
- `.world.{transferCount, transferHash}`

</details>

<details><summary>d797082: human week — 27 path patterns</summary>

- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.expected`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.expected`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.mass:body:week.hash`
- `.world.checks.byQuantity.mass:body:week.last.expected`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.expected`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.expected`
- `.world.checks.byQuantity.mass:nutrient:iron.hash`
- `.world.checks.byQuantity.mass:nutrient:magnesium.hash`
- `.world.checks.byQuantity.mass:nutrient:magnesium.last.expected`
- `.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.world.checks.byQuantity.mass:nutrient:vit_b1.hash`
- `.world.checks.byQuantity.mass:nutrient:vit_b1.last.expected`
- `.world.checks.byQuantity.mass:nutrient:vit_b3.hash`
- `.world.checks.byQuantity.mass:nutrient:vit_b9.hash`
- `.world.checks.byQuantity.mass:nutrient:vit_b9.last.expected`
- `.world.checks.byQuantity.mass:nutrient:vit_c.hash`
- `.world.checks.byQuantity.mass:nutrient:vit_c.last.expected`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.expected`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.expected`

</details>

<details><summary>d797082: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 31 path patterns</summary>

- `.week.world.checks.byQuantity.element:C.hash`
- `.week.world.checks.byQuantity.element:C.last.expected`
- `.week.world.checks.byQuantity.element:H.hash`
- `.week.world.checks.byQuantity.element:H.last.expected`
- `.week.world.checks.byQuantity.element:N.hash`
- `.week.world.checks.byQuantity.element:O.hash`
- `.week.world.checks.byQuantity.element:O.last.expected`
- `.week.world.checks.byQuantity.mass:body:week.hash`
- `.week.world.checks.byQuantity.mass:body:week.last.expected`
- `.week.world.checks.byQuantity.mass:co2.hash`
- `.week.world.checks.byQuantity.mass:co2.last.expected`
- `.week.world.checks.byQuantity.mass:n2.hash`
- `.week.world.checks.byQuantity.mass:n2.last.expected`
- `.week.world.checks.byQuantity.mass:nutrient:iron.hash`
- `.week.world.checks.byQuantity.mass:nutrient:magnesium.hash`
- `.week.world.checks.byQuantity.mass:nutrient:magnesium.last.expected`
- `.week.world.checks.byQuantity.mass:nutrient:sodium.hash`
- `.week.world.checks.byQuantity.mass:nutrient:sodium.last.expected`
- `.week.world.checks.byQuantity.mass:nutrient:vit_b1.hash`
- `.week.world.checks.byQuantity.mass:nutrient:vit_b1.last.expected`
- `.week.world.checks.byQuantity.mass:nutrient:vit_b3.hash`
- `.week.world.checks.byQuantity.mass:nutrient:vit_b9.hash`
- `.week.world.checks.byQuantity.mass:nutrient:vit_b9.last.expected`
- `.week.world.checks.byQuantity.mass:nutrient:vit_c.hash`
- `.week.world.checks.byQuantity.mass:nutrient:vit_c.last.expected`
- `.week.world.checks.byQuantity.mass:o2.hash`
- `.week.world.checks.byQuantity.mass:o2.last.expected`
- `.week.world.checks.byQuantity.mass:water.hash`
- `.week.world.checks.byQuantity.mass:water.last.expected`
- `.week.world.checks.byQuantity.volume:blood:body.hash`
- `.week.world.checks.byQuantity.volume:blood:checkpoint.hash`

</details>

<details><summary>d797082: horse stable — 15 path patterns</summary>

- `.world.checks.byQuantity.element:C.hash`
- `.world.checks.byQuantity.element:C.last.expected`
- `.world.checks.byQuantity.element:H.hash`
- `.world.checks.byQuantity.element:H.last.expected`
- `.world.checks.byQuantity.element:N.hash`
- `.world.checks.byQuantity.element:N.last.expected`
- `.world.checks.byQuantity.element:O.hash`
- `.world.checks.byQuantity.mass:co2.hash`
- `.world.checks.byQuantity.mass:co2.last.expected`
- `.world.checks.byQuantity.mass:n2.hash`
- `.world.checks.byQuantity.mass:n2.last.expected`
- `.world.checks.byQuantity.mass:o2.hash`
- `.world.checks.byQuantity.mass:o2.last.expected`
- `.world.checks.byQuantity.mass:water.hash`
- `.world.checks.byQuantity.mass:water.last.expected`

</details>

<details><summary>8cee7ac: human week, horse stable — 1 path patterns</summary>

- `.world.components[0].props.water_start_kg`

</details>

<details><summary>8cee7ac: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 1 path patterns</summary>

- `.week.world.components[0].props.water_start_kg`

</details>

<details><summary>5e9a866: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 1 path patterns</summary>

- `.medicine.crisisTimeOrigin`

</details>

<details><summary>c0ed753: human week, horse stable — 2 path patterns</summary>

- `.days[*].outputs.activity`
- `.world.components[0].props.outputs.activity`

</details>

<details><summary>c0ed753: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 3 path patterns</summary>

- `.days[*].outputs.activity`
- `.week.days[*].outputs.activity`
- `.week.world.components[0].props.outputs.activity`

</details>

<details><summary>3df7606: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 3 path patterns</summary>

- `.days[*].healingFactors.{collagenIntegrity, vitCMg}`
- `.medicine.collagenIntegrity`

</details>

<details><summary>84257ea: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 24 path patterns</summary>

- `.days[*].outputs.medicine.exposure.{altitude-illness-the-mountain-sickness, carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier, hydrogen-sulphide-poisoning-the-damp-the-sewer-gas, hypercapnia-the-close-air, hypoxia-and-asphyxia-suffocation-the-foul-air, irritant-injury-the-brimstone, respiratory-failure-the-end-state, smoke-inhalation-injury}`
- `.week.days[*].outputs.medicine.exposure.{altitude-illness-the-mountain-sickness, carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier, hydrogen-sulphide-poisoning-the-damp-the-sewer-gas, hypercapnia-the-close-air, hypoxia-and-asphyxia-suffocation-the-foul-air, irritant-injury-the-brimstone, respiratory-failure-the-end-state, smoke-inhalation-injury}`
- `.week.world.components[0].props.outputs.medicine.exposure.{altitude-illness-the-mountain-sickness, carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier, hydrogen-sulphide-poisoning-the-damp-the-sewer-gas, hypercapnia-the-close-air, hypoxia-and-asphyxia-suffocation-the-foul-air, irritant-injury-the-brimstone, respiratory-failure-the-end-state, smoke-inhalation-injury}`

</details>

<details><summary>8e57a45: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 6 path patterns</summary>

- `.days[*].outputs.medicine.signs.{gum_bleeding, teeth_lost}`
- `.week.days[*].outputs.medicine.signs.{gum_bleeding, teeth_lost}`
- `.week.world.components[0].props.outputs.medicine.signs.{gum_bleeding, teeth_lost}`

</details>

<details><summary>12f61ac: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 5 path patterns</summary>

- `.days[*].fatigue.hand.L`
- `.days[*].fatigue.peakL`
- `.week.world.checks.byQuantity.muscle-fraction:hand.hash`
- `.week.world.checks.byQuantity.muscle-fraction:hand.last.actual`
- `.week.world.transferHash`

</details>

<details><summary>9342308: wound: bound-at-once, wound: bound-after-hour, wound: never-bound — 7 path patterns</summary>

- `.days[*].fatigue.hand.L`
- `.days[*].fatigue.peakL`
- `.week.world.checks.byQuantity.muscle-fraction:hand.{count, hash}`
- `.week.world.checks.count`
- `.week.world.{transferCount, transferHash}`

</details>

### Unchanged boundaries

In particular, the respiration split `672ed6b` (2778), exposure split `2aecc5c` (2779), and kernel trace re-export `688e557` (2803) leave all five records byte-identical to their respective parents. Unit 2778 therefore does not belong in Unexplained.

The following first-parent commits changed none of the five canonical records (all five were executed):

`2bc498d`, `b9b762e`, `5389270`, `2a09778`, `da33279`, `9004261`, `4a512f0`, `67b7993`, `9f96467`, `984854d`, `5381e00`, `3b9d69f`, `70cc018`, `507271a`, `2405d78`, `a89fbf9`, `53b0a63`, `b220e2d`, `2f9f58b`, `c0750cb`, `c642101`, `79d09da`, `14fd1d0`, `3437dbe`, `184c6bf`, `659c5ce`, `c4808c5`, `57a6706`, `f964b01`, `2817a7b`, `b696f72`, `f2a9df5`, `3b8b266`, `fbecd32`, `82d53b7`, `a0e3b71`, `a72ecb9`, `2aeb07e`, `971f3bc`, `f26e352`, `a84933b`, `75e4fc2`, `f6d040e`, `f1a5751`, `4917de3`, `67f82c8`, `8247021`, `672ed6b`, `2aecc5c`, `3c0d717`, `cfc22cc`, `688e557`, `0430dc2`, `700653e`, `55f4443`, `cc60126`, `ce0af2d`, `2be3a09`, `09bd809`, `eecf211`, `d48370a`, `ab65bb4`, `c5a4651`, `0667d93`, `d635366`, `ddc778a`, `2c7775a`, `3ac69ca`, `b52d299`, `4074843`.

## Unexplained

- **`c0ed753` (2634):** human week (8 keys), wound: bound-at-once (15 keys), wound: bound-after-hour (15 keys), wound: never-bound (15 keys), horse stable (31 keys). The new serialized activity output is not claimed as an intended record/value change in this commit's message or flags. Existing numerical values are unchanged; the unresolved drift is a schema addition. The owner should explicitly accept/document that added output or exclude/revert it in a separately authorized change before re-recording.

- **`84257ea` (2727):** wound: bound-at-once (120 keys), wound: bound-after-hour (120 keys), wound: never-bound (120 keys). All 120 changes per wound variant are new zero-valued medicine.exposure.* keys. The commit documents combining gas conditions and consuming breathing outputs, but does not claim the new serialized diagnostic fields as an intended record/value change. Explicitly accept/document or remove this schema expansion before re-recording; do not present it as an already-authorized numerical correction.

These boundaries remain regressions under the stated PLATFORM rule. This diagnosis does not authorize re-recording them. Resolve each unexplained change (fix it or obtain an explicit, evidence-backed intended-change decision) before replacing goldens.

### SOURCE.md lines needed for intended commits

A later, separately authorized kernel re-record would need one reason line per intended commit below, alongside the new realism source SHA and this attribution. These are proposed text only; SOURCE.md and all goldens remain unchanged. Unexplained boundaries cannot be silently folded into these reasons.

```text
5158: realism 4c7e6f9 (2621): Physiology owns metabolic O2 demand; RMR/Kleiber-scaled breathing intentionally changes human/horse gas exchange and ventilation, with coupled water, energy, component-state and ledger changes (flags/atmosphere.md NOTE 2621).
5158: realism 2d8057a (2623): Shared body-water ownership and immediate traced body-mass changes intentionally alter heat capacity, metabolic demand, hydration/mass checkpoints, initialization fields and accounting checks/transfers (flags/physiology.md report 2623).
5158: realism d797082 (2656): Neumaier-compensated conservation/trace sums intentionally change check expected values and per-quantity hashes; daily checkpoints, final components and transfers stay unchanged (flags/independence.md 2656).
5158: realism 8cee7ac (2677 / 2687): Glycogen-bound water is included in the starting total-water reference; only props.water_start_kg changes in these five records, with no daily/check/transfer drift (flags/physiology.md 2677/2687).
5158: realism 5e9a866 (2633): Medicine's explicitly documented fixed world-time origin adds crisisTimeOrigin=0 to each wound medicine record; no other captured value changes (flags/medicine.md NOTE 2633).
5158: realism 3df7606 (2723): The documented healing pathway replaces daily healingFactors.vitCMg with collagenIntegrity and stores medicine.collagenIntegrity; wound records gain/lose 15 keys each, without changed human-week or horse records (flags/medicine.md pathway 2723).
5158: realism 8e57a45 (2787): Explicitly added dentition-aware scurvy signs publish gum_bleeding and teeth_lost as null in the wound fixtures, adding 30 keys per variant; no other captured values change (commit message and flags/medicine.md 2787).
5158: realism 12f61ac (2832): Documented 3CC roundoff clamping/renormalization changes wound hand fatigue/peak endpoints, hand-fraction check values/hash and transfer hash; rates and tolerances are unchanged (flags/muscular.md NOTE 2832).
5158: realism 9342308 (2833): Exact constant-effort 3CC replaces 1-second Euler, intentionally changing wound hand fatigue/peak endpoints and aggregating integrated trace flows/checks, with unchanged equations/rates (flags/muscular.md re-recorded 2833).
```

- (5158) report: human week 5 changed steps; wound: bound-at-once 11 changed steps; wound: bound-after-hour 11 changed steps; wound: never-bound 11 changed steps; horse stable 5 changed steps; 43 run-boundaries across 11 commits; intended: 4c7e6f9 (2621), 2d8057a (2623), d797082 (2656), 8cee7ac (2677 / 2687), 5e9a866 (2633), 3df7606 (2723), 8e57a45 (2787), 12f61ac (2832), 9342308 (2833); unexplained: c0ed753 (2634), 84257ea (2727); 5/5 baseline byte matches and 410/410 captures succeeded, no API gaps; a re-record needs the 9 SOURCE.md reason lines above (one per intended commit) and resolution of every unexplained boundary first; no golden/kernel/model edits; .bisect/ empty.
