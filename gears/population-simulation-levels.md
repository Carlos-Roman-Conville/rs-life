# Population simulation levels (2768)

Statement: a settlement's population is a compact age-sex-role cohort structure
(`data/library/population.json`, table `cohorts`), advanced at one of three levels of
detail: unvisited (aggregate economy, politics and mortality), discovered (named
individuals tracked) and active (full detail). A visited town is updated daily; a
distant one in a batch for the days elapsed. Unvisited never means unaffected: the
aggregate still ages, trades and dies, and an event in it reaches a tracked individual
only through a handoff the host owns.

The numeric home is the `cohorts` and `tick` tables of that file.

Provenance: first stated in the pirate game's combat/COMBAT.md section 4e ("Death, and
resurrection by faction"), 2026-10-29, as an outside AI's proposal. The game's modes,
resurrection by faction and plot-armour discussion in that section are game content and
not part of this gear.

Source: none for the levels (a design proposal); the cohort structure follows ordinary
demographic practice (age-sex pyramids), which the library records per row.

Evidence level 5 (hypothesis): a level-of-detail design, not an empirical claim.

Validation: none against data. A consistency check (the batch advance for a distant
town agrees with the daily advance within tolerance) is the natural test of a design rule.
