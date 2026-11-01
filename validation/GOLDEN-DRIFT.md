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

The full per-boundary attribution table, the boundary evidence (R1–R11) and the complete changed-key inventories are in [GOLDEN-DRIFT-attribution.md](GOLDEN-DRIFT-attribution.md). Summary, one row per commit:

| Commit | Unit | Intended or unexplained | Boundary count |
|---|---|---|---|
| `4c7e6f9` | 2621 | intended | 5 |
| `2d8057a` | 2623 | intended | 5 |
| `d797082` | 2656 | intended | 5 |
| `8cee7ac` | 2677 / 2687 | intended | 5 |
| `5e9a866` | 2633 | intended | 3 |
| `c0ed753` | 2634 | unexplained | 5 |
| `3df7606` | 2723 | intended | 3 |
| `84257ea` | 2727 | unexplained | 3 |
| `8e57a45` | 2787 | intended | 3 |
| `12f61ac` | 2832 | intended | 3 |
| `9342308` | 2833 | intended | 3 |

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
