# Splitting realism into Reality and Life (plan, 2026-10-31) (2764)

Rex decided on 2026-10-31 (`Toolchain/ENGINES.md`, "Reality and Life are separate engines"): **Reality** is the physical
world and nothing alive (physics, mechanics, chemistry, gases and atmosphere, optics and acoustics, materials, terrain
and geology, climate and weather); **Life** is every organism as a species configuration (species records, phenotype,
physiology, ageing, reproduction, illness, plants, pollinators, food web, decomposition). This package (`@rex/realism`)
holds both today. This file says what goes where, which cross-reads become kernel ports, the order of moves that keeps
every suite green, and which tests go where. **No code moves until this plan is accepted and the registry keeper has
re-owned the registry rows by domain tag.** Phase 6 mechanics is built in a new package `Toolchain/reality/`
(`@rex/reality`, own repo, importing `@rex/kernel` only) from the start.

## 1. The rule

- A module belongs to Reality if it would be true of a world with no living thing in it; otherwise to Life.
- Reality never imports Life. Life imports Reality one way (the shared substrate, section 7, A); state crosses only
  through declared kernel ports.
- A mixed module is split inside realism first (section 5, step 2), so each move is a pure move.
- Conservation (mass, elements, energy) spans both engines: a transfer between a body and a room is one ledger entry,
  written through the substrate, never two.

## 2. Source modules (`src/`)

| Module | Goes to | Notes |
|---|---|---|
| `elements.ts` | Reality (substrate) | element table and masses |
| `registry.ts` | Reality (substrate) | components and contents; Kahan carry |
| `graph.ts` | Reality (substrate) | connection graph; Kernel keeper may claim it (section 7, A) |
| `world.ts` | Reality (substrate) | world, ledger checks |
| `trace.ts` | Reality (substrate) | after step 2e it keeps generic records; crisis types move to Life; Kernel keeper may claim it |
| `scheduler.ts`, `snapshot.ts` | Reality (substrate) | already adopting the Kernel (2605, 2606); Kernel keeper may claim them |
| `library.ts` | both | the loader is shared; each package loads its own library files |
| `physics.ts` | Reality | after step 2a removes the body constants (`metabolicHeat`, `O2_ENERGY_J_PER_L`, `SWEAT_LATENT`) to Life |
| `reactions.ts` | Reality | chemistry |
| `process.ts` | Reality | stills, combustion, walls, losses, wear, thermometer; `bodyProcess` moves to Life (step 2d) |
| `atmosphere.ts` | split (step 2b) | Reality keeps air composition, altitude, gas units, layering, room air, gas sources (lamps, fire, rot, sulphur), the grid; Life takes respiration: `alveolarPO2`, `RespiratoryProfile`, `respiratoryState*`, `cohbAfter`, `bodyGasFlows`, `accumulateExposure`, `breathingProcess`, gas tolerances (medicine reads them) |
| `environment.ts` | split (step 2c) | Reality keeps place conditions, diurnal curve, sun hours, vapour pressure, WBGT as a measure of the place, `environmentProcess`; Life takes body exposure effects: `coldWater`, `sunburnFraction`, wind chill as felt |
| `physiology.ts` | Life | |
| `nutrition.ts` | Life | |
| `circulation.ts` | Life | owns saturation since 2725 |
| `anatomy.ts` | Life | species profiles |
| `muscular.ts` | Life | |
| `neurology.ts` | Life | |
| `medicine.ts` | Life | |
| `crisis.ts` | Life | the crisis and cause-of-death ledger |
| `population.ts` | Life | until Society exists (labour and migration move there under DUP-41) |
| `ecology.ts` | Life | organisms and depletion; soil formation and physical nutrient transport are Reality's (section 3) |
| `index.ts`, `cli.ts` | both | each package gets its own |

## 3. Library files (`data/library/`)

| File | Goes to | Notes |
|---|---|---|
| `atmosphere.json`, `gasdynamics.json`, `chemistry.json`, `equipment.json`, `science.json` | Reality | |
| `environment.json` | Reality | exposure rows that state a body effect are restated as Life rows that read the place |
| `ecology.json` | split | `soil` to Reality; `depletion_rules` to Life |
| `anatomy.json`, `circulation.json`, `medicine.json`, `muscular.json`, `neurology.json`, `nutrition.json`, `physiology.json`, `population.json` | Life | `anatomy.respiratory` and `physiology.ventilation` stay Life (breathing) |
| `sources.json` | Reality | one shared copy in `reality/data/`, read by Life (section 7, B) |
| `validation/<table>.json`, `validation/index.json` | split by row domain | one file per table; index preserves original table order (5239); domain ownership split remains planned |
| `scripts/check_library.py` | both | each package runs it on its own files |

## 4. Cross-reads that become kernel ports

Each line is one port, declared in the writer's and the reader's own kernel.json and checked by the kernel (Kernel
DESIGN section 8.1): the reader declares a direction "in" port on the quantity; the writer keeps the quantity in its
process writes and stays its only writer. A two-way row (body heat; water between vessels and bodies) is one quantity
per direction, each with its own single writer; water and food moved through the substrate ledger are
Reality-written ledger quantities that Life reads, or calls when Life's action makes Reality move them (drinking);
food from a container has the host or Economy as writer. Rows marked planned get no port until their mechanism is
built, because a port needs a built registry row. Quantity ids come from the registry keeper. (2775)

| Port | Writer -> reader | Today |
|---|---|---|
| room air composition and pressure (O2, CO2, CO, H2S, SO2, CH4, H2, N2, water vapour) | Reality -> Life (respiration) | `roomGasFraction`, `breathingProcess` |
| body gas exchange (O2 taken, CO2 and water vapour given) | Life -> Reality (room air) | `bodyGasFlows`, `applyGasFlows`; one transfer each way |
| body heat exchange (metabolic heat out, sweat latent heat, conduction to air and water) | Life -> Reality (room energy) and Reality -> Life (thermoregulation) | `bodyProcess`, physiology heat terms |
| place conditions (air temperature, humidity, WBGT, wind, sun, water temperature) | Reality -> Life | `placeOutputs`, `environmentProcess` |
| water moved between vessels and bodies (drinking, sweat to vapour, urine and waste) | both, through the substrate ledger | `addBodyWater`, evaporation |
| food mass moved from a container to a body | host or Economy -> Life, through the substrate | `ingest` |
| gas exposure accumulated by a body | Reality -> Life (medicine) | `accumulateExposure` |
| light at a place (planned, phase 8) | Reality -> Life (vision, overlap group 4) | none |
| contact and impact events (planned, phase 6 and 6b) | Reality (mechanics) -> Life (injury) | none; Combat reads both |
| weather and soil state (planned, phases 13 to 17) | Reality -> Life (plants) | none |
| decomposition products (planned, phase 11) | Life -> Reality (soil, air, water) | none |

## 5. Order of moves (every suite green at each step)

1. **Docs.** This file; the registry keeper re-owns registry rows by domain tag (reality or life). No code.
2. **Untangle inside realism**, one belt unit each, full engine suite and the pirate world suite at each (a shared
   interface changes, PLATFORM.md section 11b):
   a. body constants out of `physics.ts` into `physiology.ts`, re-exported from the old names until hosts move; Done (2845).
   b. split `atmosphere.ts` into `atmosphere.ts` (Reality) and `respiration.ts` (Life); `index.ts` re-exports both; Done (2778).
   c. split `environment.ts` into `environment.ts` (Reality) and `exposure.ts` (Life); Done (2779).
   d. move `bodyProcess` from `process.ts` to `physiology.ts`; Done (2845).
   e. `trace.ts` keeps generic records; the `Crisis` type and its helpers live in `crisis.ts` only; Done (2777): trace keeps generic records; crisis.ts owns the crisis view.
   f. a lint check (a test) that no Reality-side module imports a Life-side one. Done (2780); exceptions listed in the test until steps 2a and 2d.
3. **Process declarations.** `kernel.json` declares one process per mechanism group, so every quantity has one
   declared writer (unit 2765), and the garbled quantity ids are replaced by the registry's clean ones. The section 4
   ports are declared after step 4, one Composer unit in each package's lane, needing the move.
4. **New package.** `Toolchain/reality/` (`@rex/reality`, own repo, importing `@rex/kernel` only) receives the Reality-side
   modules, library files and tests by a history-keeping move (git subtree or filter-repo); phase 6 mechanics starts
   there. `realism` keeps the Life side and is renamed to Life later (Rex's `rs-life`); until then the backup job mirrors
   `realism` to `rs-life`. Then each package declares its section 4 ports in its
   own kernel.json (DESIGN section 8.1). Dependencies follow Kernel DESIGN section 16 (Rex,
   2026-10-31): the new reality repo cuts v0.1.0 when the move lands, and Life depends on it as
   "@rex/reality": "git+file:///E:/backups/reality-sim/git/<reality repo>.git#v0.1.0", never a file: link; both depend on
   @rex/kernel at a kernel tag. Hosts (the pirate web, History) pin each engine's tag the same way. (2824)
5. **Hosts.** The pirate web links both packages; its world suite passes against the pair. The pirate web pins realism (and later reality and life) at
   tags in its own paired units, removing each old folder link with cmd /c rmdir, never a recursive delete.
6. **Re-audit.** The registry keeper re-audits ownership; the lint check from step 2f runs in both packages.

## 6. Tests

| Goes to Reality | Goes to Life | Integration (stays with Life, reads both) |
|---|---|---|
| `reactions`, `still`, `registry`, `scheduler`, `snapshot`, `trace`, `ledger-sums`, `library-loader`, the Reality part of `library`, `atmosphere` (gas part), `environment` (place part) | `anatomy`, `circulation`, `medicine`, `mortality`, `muscular`, `fatigue`, `neurology`, `nutrition`, `physiology`, `population`, `ecology`, `water-ledger`, `energy-oxygen`, `hydration-week`, `perf`, the Life part of `library`, `atmosphere` (breathing part), `environment` (exposure part) | `checkpoint1`, `checkpoint2`, `independence` (horse stable: bodies in rooms), the examples `human-week`, `human-wound`, `horse-stable`, `horse-stable-long` |

## 7. Decisions

Decided 2026-10-31 by the controller (architecture call, recorded for Rex to overrule):
- **A. The substrate.** Elements, registry, graph, world, trace, scheduler and snapshot live in `@rex/reality`. Life
  imports Reality one way, never the reverse; nothing scientific enters the kernel. Carve-out: any piece of the substrate
  that is pure infrastructure with no scientific content (for example generic trace records, the per-step scheduler
  wrapper, snapshot plumbing) may go to `@rex/kernel` and be re-exported; the Kernel keeper decides that list before the
  step 4 move, and Reality keeps the rest.
- **A, carve-out list (Kernel keeper, 2026-10-31).** To the kernel: `src/trace.ts` only, after step 2e removes the
  `Crisis` import and the `crises` field (what remains is generic audit plumbing: transfer, check and note records, a
  plain tolerance comparison, Neumaier sums, compaction with keep-marked notes and the beforeCompact hook). It moves
  byte-identically and is re-exported from `@rex/reality`, so no golden or trace hash moves; `chemicalChange` on a
  transfer stays an opaque optional flag the kernel never interprets; the Kernel keeper amends its DESIGN section 10 in
  the same change. Reality keeps `scheduler.ts` (typed on World; retires when each process becomes a kernel process),
  `snapshot.ts` (World's participant capture; the generic half is already in the kernel), `graph.ts` (its port kinds
  and edge properties carry physics), and `elements.ts`, `registry.ts` and `world.ts`. Order: step 2e in realism, then
  the kernel unit adds `trace.ts` and its doc fix, then a realism unit replaces its `trace.ts` with the re-export. Done (2801, 2803): trace.ts lives in the kernel;
  realism re-exports it. <!-- (2803) -->
- **B. Library sources.** `sources.json` is shared data: one copy in `reality/data/` that Life reads; no duplicate.
- **C. Timing (revised 2026-10-31 after an organisation review).** The held sleep unit 2724 edits only `neurology.ts`,
  `physiology.ts`, `medicine.ts` and their tests and flags. So step 3 (per-mechanism `kernel.json`, unit 2765), steps 2b,
  2c, 2e and 2f, the substrate move and phase 6 mechanics in `Toolchain/reality/` start without waiting for it. Only
  steps 2a and 2d, and the move of any Life module 2724 edits, wait for 2724 so no unit edits a file mid-move.
