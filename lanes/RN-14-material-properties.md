# RN-14 Material data and constitutive models: property contract (Reality keeper, 2026-11-02; draft for review)

Plan: `../PLAN.md` §3.L (C-4). Added by the review of 2026-11-02. This is a contract that every consuming lane reads.
It is **not** a library that must be complete before any physical test: rows land with the lane that first consumes
them.

## 1. What every property row records

| Field | Meaning |
|---|---|
| `id`, `version` | stable id; version bumped on any value change, and run-pinned like Life's composition rows |
| `subject` | a material id, or for interface properties a **contact pair** `{a, b}` (unordered unless stated) |
| `property` | for example `density`, `cp`, `E` (Young's modulus), `MOR`, `breaking_load`, `mu_s`, `mu_k`, `e` (restitution) |
| `value` or `range` | a value with uncertainty `{lo, hi}`, or a range only; the basis of the spread (sample SD, table range, reconstruction) |
| `units` | from the kernel units table |
| `condition` | the state it applies to: temperature, moisture content (wood), wet or dry and lubrication (friction), surface finish, grain direction, impact speed (restitution), load duration |
| `valid_range` | the condition range the source supports |
| `relationship` | for a constitutive model rather than a constant (for example a duration-of-load factor, or a force–depth curve for RN-13): the model, its parameters and its domain |
| `source` | an opened page, table and row; "to open" leaves the value null |
| `label` | M, C, A or F (PLAN §5) |
| `consumers` | the mechanisms that read it (RN-5, RN-7, RN-8, RN-13, RN-9 ...) |
| `outside_range` | what happens outside `valid_range` or when missing: by default **null and reported**, which makes the consuming result unknown; never silent extrapolation. A row may name a sourced extrapolation rule instead |

## 2. Rules

- **Contact-pair properties** (μ_s, μ_k, e) belong to the pair and its condition, never to one material. Oak on wet
  oak and oak on dry oak are two rows.
- **One copy.** No lane keeps its own number for a property this contract holds; it reads the row and records the
  version it used.
- **Calibration and validation** follow REAL-39: a fitted parameter names its calibration set, and its validation uses a
  different one.
- **Existing rows.** `realism/data/materials.json` holds `cp` and `maxTemperatureC` per material, with source and a
  check note, but no condition, range, uncertainty or consumers fields (read 2026-11-02). The contract adds those fields
  to the existing rows; it does not rewrite their values. `maxTemperatureC` is an engine failure limit, and the
  copper row records its melting point as unverified. That stays as written until a review card checks it.

## 3. Tests (with the first consuming lane)

- Load-time: every row has the fields above; units parse; `lo ≤ value ≤ hi`; a pair row is found for either order.
- A query outside `valid_range` returns null and a reason, and the consuming mechanism reports unknown.
- A consuming lane's test records the property version in its trace.

## 4. First rows, per consumer (none queued)

- CP-3: μ_k and μ_s for the dragged-load surfaces used (RN-5); the rope's breaking load and the pulley block's η
  (RN-7). Sonnet research, then composer data.
- CP-4: wood E and MOR with moisture and duration conditions (RN-7, Wood Handbook); restitution pairs (RN-5); fluid
  densities with temperature and salinity (RN-8).
- CP-5: tissue and armour force–depth ranges (RN-13), each with its calibration and validation sets declared.
