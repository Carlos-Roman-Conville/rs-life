# Process order: each process reads finished inputs (2768)

Statement: within one step the processes run in a fixed, declared order, and the
order is chosen so that each process reads only inputs that an earlier process has
already finished for that step. The scheduler (`src/scheduler.ts`) runs processes by
rate (fast every step, slow every N steps); within a step it never reorders them.
Declaring the order is the rule; the particular order of the processes is data the
host and `kernel.json` declare, not a constant here.

Provenance: first stated in the pirate game's body/BODY.md section 4 ("The overnight
tick"): the table's source line reads "Order chosen so each step reads only finished
inputs." The game marked the order proposed; no date is given on that section (the
document's other rows are dated 2026-10-29).

Source: none beyond the design reasoning (a read-after-write ordering of a
sequential update, as in any fixed-step simulation loop). No external reference was
searched for this rule.

Evidence level 5 (design rule, hypothesis): an ordering convention, not an empirical
claim. It is a property of the scheduler and the kernel's per-process declarations (2765),
not something compared with data.
