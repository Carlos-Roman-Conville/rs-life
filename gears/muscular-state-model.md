# Muscular state model: groups, three values, activation profiles (2768)

Statement:

- Groups. The body is described by the muscles that count, split the way real muscles
  split (the deltoid into front, middle and rear heads; the chest into clavicular and
  sternocostal portions; and so on), a functional set of about 25 to 40 groups, left and
  right where it matters (`data/library/muscular.json`, table `groups`).
- Values. Each group carries three values: development (long-term capacity), fatigue
  (temporary) and condition (injury and recovery), plus an accumulated training stimulus
  that turns into development after rest (table `values`). A heavy day weakens that
  evening and strengthens days later.
- Activation profiles. An action recruits several groups at different intensities
  (a fraction of maximum voluntary contraction per group). One shared muscle model that
  actions reference; the profile drives effort required, fatigue, stimulus and how
  injuries bite (table `activations`; a blank is 0).
- Limb strength is computed from muscle, not stored. Per-limb strength is a weighted sum
  of the groups acting on the limb (table `limb_strength`; the weights are estimates).
  This is the "computed" reading; the opposite reading (muscle replaces the stored limb
  number) was left open in the source.
- Muscle is force only; reaction speed, accuracy and technique are separate quantities.

Provenance: first stated in the pirate game's combat/COMBAT.md section 4b ("Under the
limbs: the muscular system and the gym"), 2026-10-29: the split by real muscle heads is
the game owner's rule; the 25 to 40 group model, the three values with accumulated
stimulus and the activation profile (hauling rope as an illustration) are an outside
AI's proposals there. The gym, regimens, occupations and movement tiles in that section
are game content and not part of this gear. The game's per-limb Strength stat (STATS)
is the game's; the engine exposes the weighted sum and the game maps it.

Source: group anatomy is textbook (Gray's, library key MUS-ANAT); activation shapes use
EMG literature where it exists (MUS-EMG: lats, mid trapezius, biceps and rear deltoid
at 50 to 60 % MVIC in inverted and suspension rows; middle and lower trapezius 35 to
60 % in climbing postures). Every other profile and all limb weights are the keeper's
estimates.

Evidence level: group anatomy and the EMG-based profile rows level 4 (estimate from
literature); the three-value structure, the other profiles and the limb weights level 5
(hypothesis).

Validation: not validated. Needed: published EMG activation by exercise per muscle,
and strength-by-limb data to fit the weights; see `flags/muscular.md` for the open items.
