# RN-2 Paths and movement: the Reality–Life movement contract (Reality keeper, 2026-11-02; proposal, not agreed)

Checkpoint CP-2. Plan: `../PLAN.md` §3.L (C-3), R-1, R-2, R-9. Issue REAL-49. To agree with the Life keeper (the
locomotion model) and the Kernel keeper (step transactions). Nothing here is queued.

## 1. Who supplies what

| Quantity | Owner | Unit | Notes |
|---|---|---|---|
| path (cells), validated | Reality | cell ids | Cognition's move intention names the goal; who plans the route is Cognition's or the host's, not settled here |
| `d_horizontal`, `d_path`, `Δh`, `G = Δh / d_horizontal` per segment | Reality | m, m, m, 1 | from cell centres and `world.elevation` |
| η per segment | Reality (R-2) | 1, ≥ 1 or null | null → Life reports the energy unknown |
| load carried | Economy mass → Reality | kg | Economy's goods view |
| speed V for the step | Life | m s⁻¹ | **Life states whether V is along the path or horizontal**; Reality then uses the matching distance |
| metabolic rate M for the step | Life | W | Life's selected locomotion model (Pandolf is the candidate, CG-5) |
| W_ext for the step | Reality | J, signed | `(m_b + m_L) g Δh_step` for walking, from committed progress |
| capacity to continue | Life | as Life defines | for example a store or fatigue limit; Life's |
| comparison and outcome | the resolver | — | neither engine holds it |

**Grade convention.** Reality computes `G = Δh / d_horizontal` (rise over horizontal run). If Life's model takes grade
as a percentage or as a sine, Life names the conversion and Reality passes G unchanged with its definition attached.

## 2. Movement state (Reality's)

    { mover, path: [cells], seg: index, progress_m: along the current segment (in V's distance convention),
      status: "moving" | "stopped" | "done" | "failed", reason? }

- `progress_m` is authoritative. `world.position.cell` changes when progress crosses a segment boundary.
- No interpolated x, y, z is authoritative at CP-2 unless a consumer needs one; then it is derived from `progress_m`.

## 3. One step = one transaction (kernel PLAN §3.3)

At each move-process instant, the resolver opens one transaction over [Reality movement state, Life body, journal]:
1. Read Life's V and M for the segment's (G, η, load) and Life's capacity to continue.
2. `Δs = min(V Δt, remaining on segment)`. Crossing into the next segment inside one step is split at the boundary
   into two parts, each with its own grade, both inside this step's transaction.
3. Post: progress (and cell, if a boundary is crossed); Life's expenditure for the step; the R-9 transfers for W_ext of
   the step (uphill: metabolism → potential-energy account; downhill: potential-energy account → body heat).
4. Commit, or on any refusal roll back this step only.

**Interruption.** A stop (Cognition's new intention, Life's capacity refusal, a blocked segment) ends the move after
the last committed step. Committed progress and its spent energy stay; nothing earlier is rolled back. There is never
energy spent without matching progress, and never progress without its energy.

## 4. Refusals at validation (before any step)

- `d_horizontal = 0`, `Δh ≠ 0`: vertical segment, refused (`impossible`, "vertical segment, no walking model").
- `d_path = 0`: a repeated cell, removed from the path.
- `|G|` outside the selected model's data range (about ±0.45 for the CG-5 sources): refused, with the range named. Not
  clamped.
- A blocked edge: refused at validation if known then; if it becomes blocked during the move, the move stops at the
  last committed step.

## 5. Tests (composer, once agreed)

- Zero-length and vertical segments refused; a slope gives the right G sign both ways.
- Σ t = Σ d / V exactly for constant V, with d in V's convention.
- An interruption at any step: progress equals the committed steps; journal energy equals Life's M × committed time;
  W_ext equals `(m_b + m_L) g` × committed Δh.
- No teleport: the cell sequence is the path order, one boundary at a time; no travel posted twice on replay.
- A step that throws rolls back only itself (journal shows zero entries for it).
- Step convergence: the same walk at Δt = 1 s and 60 s gives the same position and energy within the stated tolerance
  (exact for constant V on straight segments).

## 6. Validation

Life validates the speed and cost model (CG-5 S5 field data, PLAN §7 R-1 + Life). Reality validates the geometry and
travel against independent route observations for the scenario (to open), and claims nothing else.

## 7. Questions for Life and Kernel

1. Life: is V along the path or horizontal, and in what form does the model take G?
2. Life: what does "capacity to continue" read, and does a refusal stop the move or slow it (a slower V is Life's
   output, never a resolver blend)?
3. Kernel: the move process's period, and whether one transaction per step at that period is inside KRN-49's cost.
