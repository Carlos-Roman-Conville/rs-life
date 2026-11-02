# Gears (2768)

(2768) The gear files hold statements first made in the pirate game's design documents.
The realism engine cites these files, never the game's documents; each file records
where the statement first appeared. The pirate repo's docs should point back to the gear
file for every statement listed here (pirate unit 2769). Game content (stats, combat
moves, fishing, duties) is not here; it is flagged `game content` in `flags/`.

- `aerobic-training-clamp.md`: the training-factor clamp on aerobic capacity, from the
  Banister fitness and fatigue state. Cited by `src/muscular.ts` (`trainingFactor`) and
  the table `physiology.banister`.
- `anatomy-crisis-floors.md`: the organ function floors that open a crisis. Cited by
  `src/circulation.ts` (crisis source text), `src/anatomy.ts` and the table
  `anatomy.crisis_floors`.
- `altitude-inspired-oxygen.md`: barometric pressure, inspired PO2 and the alveolar gas
  equation. Cited by `src/atmosphere.ts`.
- `core-temperature-drift.md`: the hourly core-temperature drift above a WBGT ceiling.
  Cited by `src/physiology.ts` and the table `physiology.wbgt_limits`.
- `process-order.md`: processes run in a fixed declared order so each reads finished
  inputs. Cited by `src/scheduler.ts`.
- `equipment-condition.md`: capability, control and accuracy as three independent
  wearing properties. Cited by `src/registry.ts` (`Condition`) and the table
  `equipment.wear`.
- `muscular-state-model.md`: muscle groups split by real heads, development, fatigue
  and condition values, activation profiles, limb strength computed from muscle. Cited
  by the tables `muscular.groups`, `values`, `activations` and `limb_strength`.
- `population-simulation-levels.md`: unvisited, discovered and active levels of detail
  for a settlement's cohorts. Cited by the table `population.cohorts`.
- `soil-integration.md`: immediate kernel nutrient transfers, input/loss accounts,
  harvest/uptake ownership and slow soil dynamics (3001).
- `soil-fertility-index.md`: level-4 Liebig index derived from N, P and K stocks,
  replacing the independent harvest fertility drain (3001).
