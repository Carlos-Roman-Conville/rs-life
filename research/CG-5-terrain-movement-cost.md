# CG-5 (Reality half): terrain, slope and water as a movement cost

Research unit 3020, 2026-11-01. Research only: no code, no registry edit. Reality owns the surface; Life owns the
body's locomotion energy and speed (Pandolf-style load carriage) and population movement between cells.

## Question

CHAINS.md row 1.7 (Movement) says energy is `body.expenditure` ("MET cost built"), displacement has no id, and CG-5
reads "no row moves an organism between places" (Reality / Life, approved 2026-11-01). The two halves must meet at one
number per place. This unit asks what the surface contributes to the cost of walking and wading, what the usual
published coefficients are, how far apart the sources are, and what single quantity Reality should publish.

Registry state (grep of `registry/quantities.json`):

- `body.expenditure`: unit kcal (cumulative), scope body, writer `realism.physiology.energy_expenditure`, status seed.
  A Pandolf output in watts has to be integrated over time (1 W for 1 s = 2.39e-4 kcal) before it lands here.
- `world.elevation` (m, writer `realism.terrain.geomorphology`, planned) and `world.base_elevation` (m, writer
  `realism.terrain.provinces`, planned) exist, so a grade between two cells can be computed from their elevation
  difference and the distance between them.
- `world.water_depth` (m, writer null: "Reality writes it (phases 8, 13, 16)") and `world.current` (m/s, ocean
  current, writer `realism.ocean.tides_currents`, planned) exist.
- `world.slope_failure` exists but is a stability quantity (excavation), not a walking grade.
- Not found by grep: any terrain factor, surface class, ground roughness or snow depth/density quantity, and any
  displacement or travel-speed quantity. The keeper should confirm none exists under another prefix.

## Equations

### E1. Pandolf 1977 (load-carriage energy, level and uphill)

    M = 1.5 W + 2.0 (W + L) (L / W)^2 + eta (W + L) (1.5 V^2 + 0.35 V G)

| Symbol | Meaning | Unit |
|---|---|---|
| M | metabolic rate | W |
| W | body mass | kg |
| L | carried load | kg |
| V | walking speed | m/s |
| G | grade | percent (rise over run x 100) |
| eta | terrain factor, 1.0 for blacktop or treadmill | dimensionless |

Source: Pandolf, Givoni and Goldman 1977, J Appl Physiol 43(4):577-581, read through S1 (equation and units) and S2
(same equation, printed in a validation paper). Eta multiplies only the speed-dependent term, not the standing terms.
Stated scope is "standing or walking slowly"; no valid range is printed in S1. Reported weakness: it underpredicts at
higher loads and speeds (S1). The 1971 Givoni-Goldman predecessor is reported valid for 2.5-9 km/h, grades to 25% and
loads to 30 kg (search summary, not read in the original). One printing in S2 drops the square on L/W; S1 and S5 keep
it, and I use the squared form.

### E2. Downhill correction (Santee et al., 2001) (open: printed forms disagree)

Pandolf's equation has no downhill branch. Santee et al. 2001 (Aviat Space Environ Med 72:562-566; the USARIEM
report T01-11 is the equation's primary home) added one for G < 0. I could not read either primary document. Two
printed forms, which do not agree:

- S2 (Military Medicine 2018, Table 1): the Santee term is added to Pandolf when G < 0, and equals
  `-eta [ G (M+L) S / 3.5 - (M+L) (G+6)^2 / M + 25 S^2 ]` (S = speed). The paper says the original publication printed
  a minus sign where a multiplication belongs, so the `25 S^2` term is the paper's corrected reading.
- S5 (PMC8560389, Table 1, text garbled in the copy I read): for G < 0 the 0.35 V G term is replaced by
  `eta [ G (W+L) V / 3.5 - (W+L) (G+6)^2 / W + (25 - V^2) ]`, with an overall factor `2.985 W` to convert to oxygen
  units.

Variables: as E1 (M or W = body mass, L load, S or V speed, G grade in percent, negative downhill). Valid range:
not printed in either source. My arithmetic on the printed forms: neither form gives zero correction at G = 0 (at
L = 0 the bracket is -36 + 25 S^2 in S2, or -36 + 25 - V^2 in S5), so a branch switch at G = 0 jumps. That may be
intended (the term only applies for G < 0) or may point to a transcription error. The keeper must have the T01-11
original read before this goes into code. Performance: on a rough outdoor course the Pandolf + Santee combination had
the smallest bias (-13 +/- 87 W) and lowest RMSE (99 W) of six equations (S2); in a separate field trial with unloaded
walkers it overpredicted by 17% (S5).

### E3. Minetti et al. 2002 cost of transport against gradient

Minetti, Moia, Roi, Susta and Ferretti 2002, J Appl Physiol 93:1039-1046: 10 trained subjects on a treadmill,
gradients i from -0.45 to +0.45 (i as a fraction, rise over run), fifth-order polynomial fits of the cost per kg per
metre, J/(kg m), for walking and running separately.

- Running, as printed on a secondary page (S6): `C_r(i) = 155.4 i^5 - 30.4 i^4 - 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6`.
  That page's own table disagrees with its formula at several grades, so treat the coefficients as checked against
  one secondary source only.
- Walking polynomial: **null**. The walking coefficients are not printed in any source I could read as text (the paper
  PDFs were compressed binaries my tools could not decode). Walking anchors that two secondary summaries agree on:
  cost at i = +0.45 is 17.33 J/(kg m) (S7), and level walking about 1.64 J/(kg m) (S7; the polynomial needs the paper). The cost at i = -0.45
  is listed as 3.46 in one place and 3.92 in another.
- Shape, from sources that agree: cost falls on shallow descents, reaches a minimum around -10% to -20% grade, and
  rises on steeper descents (S1 summary text; S2; S6). Margaria's older figure for the minimum is -10% (search summary).
  The polynomial is a fit, not a mechanism; use it only inside +/-0.45.

### E4. Tobler's hiking function (speed against slope)

    W_t = 6 exp( -3.5 | S + 0.05 | )

W_t is walking speed in km/h, S = dh/dx = tan(theta), the dimensionless slope (not percent). Source: S8 (Wikipedia
summary of Tobler 1993; I did not read Tobler's own report). Flat ground gives about 5 km/h; the maximum is about
6 km/h at S = -0.05; off-path travel is multiplied by 0.6 (3/5); the same page gives horseback x 5/4 and the pace
form `p = 0.6 exp(3.5 |m + 0.05|)` in s/m. The page gives no validity range; its worked table runs from -60 to +50
degrees, which is outside what the metabolic data in E3 cover.

### E5. Wading and swimming against a current

No source I found gives a usable equation for the metabolic cost of a human wading or swimming against a current.

- Wading in still water (S9, Halsey, Tyler and Kuliukas 2014, Biology Open; 20 wading participants, knee-high and
  thigh-high water, 0.41 m/s and up; data pooled with two earlier studies at chest and waist depth): oxygen
  consumption was not significantly different from land at the cadences tested, and a clear extra cost appeared only
  above about 0.35 m/s, even in chest-high water. No equation is stated; the numbers are in the paper's table and
  figures, which I did not see.
- Current: laboratory studies with jets on an underwater treadmill report extra cost with flow (S10 gives a drag
  force up to about 47 N at a jet speed near 1.2 m/s), but none used a natural stream and none gives a depth-speed-
  flow formula. **Null.**
- Physics form the keeper could use once a drag coefficient is sourced: drag on the legs ~ 0.5 rho C_d A v_rel^2,
  with v_rel the walking speed relative to the water. C_d and the wetted area A are **null** here.
- Deep-water swimming cost was not researched in this unit.

### Derived relation (my arithmetic on E1, no new coefficient)

If Life gives a body a sustainable metabolic power budget P (W) for travel, E1 solves for speed on a given cell:
`eta (W + L) (1.5 V^2 + 0.35 V G) = P - 1.5 W - 2.0 (W + L)(L / W)^2`. For G >= 0 this is a quadratic in V with one
positive root. This is how eta feeds a speed as well as an energy. It is a consequence of Pandolf's own form, not
a source-validated speed law.

## Parameters

Eta is a ratio to firm, level, hard surface (blacktop or treadmill = 1.0). Values below are from the Pandolf /
Soule and Goldman lineage unless marked. Primary documents (Soule and Goldman 1972, J Appl Physiol 32:706-708;
Pandolf, Haisman and Goldman 1976, Ergonomics 19:683-690 for snow) were **not read**; the standard table comes from
S1, which does not say which entry came from which paper.

| Surface | eta | Source and spread | Note |
|---|---|---|---|
| blacktop, treadmill | 1.0 | S1; S5 measured pavement/treadmill 0.97-0.99 | reference |
| dirt road | 1.1 | S1 gives 1.1; S2 used 1.2 for dirt road "following Richmond et al."; spread 1.1-1.2 | |
| grass | 1.08 | S5 measured grass/treadmill 1.06 (averaged) to 1.08 (two faster speeds), n = 9; about 1.09 against pavement | not in the S1 table |
| light brush | 1.2 | S1 | |
| heavy brush | 1.5 | S1 | |
| swampy bog | 1.8 | S1 | |
| loose sand | 2.1 | S1; S11 intro repeats 2.1 for Soule and Goldman. Direct sand studies give ratios of 1.34 (Davies and Mackinnon 2006), up to about 1.8 (Zamparo 1992) and 2.1-2.7 (Lejeune 1998) against firm ground (S12, S13) | spread 1.34-2.7; ratios depend on speed and sand and are not the same quantity as eta, which scales only the speed-dependent term |
| soft snow 15 cm | 2.5 | S1 only | |
| soft snow 25 cm | 3.3 | S1 only | |
| soft snow 35 cm | 4.1 | S1 only | |
| snow, by sinkage | `eta = 0.0005 z^3 + 0.0001 z^2 + 0.1072 z + 1.2604`, `z = h (1 - rho0 / 1.186)` | S14 (Richmond et al. 2019 abstract) | h snow depth, rho0 snow density; units not stated in the abstract, so null until the paper is read. The abstract's illustration z = 10 gives 2.84 |
| woodchips | about 1.27 | S11: net metabolic rate 27% above sidewalk at 1.25 m/s, 10 adults | ratio of net rate, not of the speed term |
| dirt, gravel, grass (cobbled) | about 1.0 | S11: not significantly different from sidewalk at 1.25 m/s | |
| level wading, knee-to-thigh deep | about 1.0 times the substrate value below roughly 0.35 m/s | S9 | above that speed null |
| wading against a current | null | no source with a usable form (E5) | |
| wet packed sand, mud (not bog), rock/coral rubble, tall cane | null | no study I could read measures these | |

Terrain classes a world could store, with the proposed mapping:

| World class | Proposed eta | Basis |
|---|---|---|
| paved track | 1.0 | blacktop |
| dirt track | 1.1-1.2 (store 1.1, flag the 1.2 alternative) | dirt road |
| beach sand, dry loose | 2.1 | loose sand (S1); direct studies 1.34-2.7 |
| beach sand, wet and packed | null | no source |
| mangrove mud | 1.8 as nearest class (bog); true mud null | class assignment, not a measurement |
| rainforest undergrowth | 1.2 (light) to 1.5 (heavy) by stand density | class assignment from brush; no rainforest measurement |
| cane field | null (1.5, heavy brush, is the nearest class but is my assignment) | no source |
| shallow reef flat, walked | substrate eta (bare reef rock and rubble null) times about 1.0 for wading below about 0.35 m/s | S9 for the water part |
| deep water | not a walking surface | swimming not researched |

The spread column matters to the keeper: the same word "sand" spans 1.34 to 2.7 across four sources, and "dirt road"
spans 1.1 to 1.2 across two. Store the value with its source id so a later study can replace it.

## Interface

Proposal for the registry keeper (do not edit the registry from this unit):

- **`world.terrain_factor`**: dimensionless eta >= 1.0 (1.0 = firm level hard surface), per cell, scope world, writer
  `realism.terrain.surface` (a new Reality row under `realism.terrain.*`), planned. It is derived from the cell's soil
  class, cover class, snow depth and density where those exist, and from a class table with the values above. Null
  where unmapped, not zero.
- **Grade is not a new quantity.** `world.elevation` already exists. Grade for a move from cell a to cell b is
  `(elev_b - elev_a) / distance_ab` (dimensionless, signed), computed by whoever takes the step from the two cells.
  Publishing one slope per cell would hide the direction of travel, which decides the sign and so which of E1/E2 applies.
- Water: `world.water_depth` and `world.current` already cover wading depth and flow. Until E5 has a source, Life should
  treat a wading cell as the substrate eta for speeds below about 0.35 m/s and ask Reality for a swim/ford rule above it.
- Optional later: `world.terrain_speed_factor` (dimensionless, off-path multiplier on Tobler). The only value found is
  0.6, from S8; keep it null in the registry until a better source or until Life prefers the derived relation above.

Why one eta fits both halves: Pandolf's energy equation takes eta directly. Tobler's speed function does not, but its
off-path factor (0.6) plays the same part, and the derived relation above gives a Pandolf-consistent speed from eta
and a power budget. So Life can compute energy per metre as `M / V` from eta and grade, and speed either from Tobler
with an off-path multiplier or from the power-budget root. Reality stays out of the body: it publishes what the ground
is, and Life says what the ground costs.

## Validation

Data a future implementation could be tested against (separate from the coefficient sources above):

1. The 2020 real-world walking study (S11): net metabolic rate on sidewalk, dirt, gravel, grass and woodchips at
   about 1.25 m/s, 10 adults. Test: the table's eta for woodchips (about 1.27) and near-1.0 for dirt/gravel/grass.
2. Sand: Zamparo 1992 (J/kg/m at 3-7 km/h on sand and firm ground, S12) and Lejeune 1998 (S13); test that the model's
   sand cost sits inside the 1.34-2.7 spread across speeds.
3. Snow: the Pandolf 1976 snow trials and the Richmond 2019 re-fit (S14); the snow table (2.5/3.3/4.1) against the
   sinkage polynomial at matching depths once units are known.
4. Field walking over mixed terrain with measured O2: S5 (PMC8560389) gives measured mean 981 +/- 91 mL O2/kg unloaded
   and 1,310 +/- 153 loaded, against Pandolf/Santee at +17% and about +12-13%. S2 reports -13 +/- 87 W bias on a rough
   military course. An implementation should land within these errors and no worse.
5. Wading: Halsey 2014 (S9) plus the earlier chest-high and waist-high data it compiles; test that cost matches land
   below about 0.35 m/s.
6. Downhill: treadmill data at negative grades down to -12% (Santee et al., summarised in S15), and the Minetti anchors
   (+0.45: 17.33 J/(kg m)). The model should show a cost minimum on moderate descents.

## Sources

- S1: https://en.wikipedia.org/wiki/Pandolf_equation (Pandolf equation, units, the eta table including snow by depth, underprediction caveat; secondary, does not name which original gave each eta).
- S2: https://academic.oup.com/milmed/article/183/9-10/e357/5025891 (Military Medicine 2018, Table 1: Pandolf and Santee forms, the typo note, 1.0/1.2 for paved/dirt, bias -13 +/- 87 W).
- S3: https://jhp-ojs-tamucc.tdl.org/jhp/article/view/67 (Richmond, Potter, Santee 2015 abstract: eta derived from a limited set of surfaces; full text PDF was compressed and unread).
- S4: https://jhp-ojs-tamucc.tdl.org/JHP/article/view/124 (accuracy of predictive equations for load carriage; cited for underprediction, abstract only).
- S5: https://pmc.ncbi.nlm.nih.gov/articles/PMC8560389/ (field walking: Pandolf/Santee Table 1 as printed, grass 1.08, asphalt 1.0, prediction errors).
- S6: https://aifithub.io/articles/minetti-energy-cost-uphill-downhill-methodology/ (Minetti running polynomial, i as fraction, range, caveat about its own table).
- S7: https://github.com/jacquescorbytuech/running-knowledge-base/blob/main/sources/minetti-2002-uphill-downhill-cost.md (Minetti walking anchors 1.64 and 17.33 J/(kg m); secondary summary).
- S8: https://en.wikipedia.org/wiki/Tobler%27s_hiking_function (Tobler formula, 0.6 off-path factor, max speed).
- S9: https://pmc.ncbi.nlm.nih.gov/articles/PMC4154292 (Halsey et al. 2014 energy cost of wading).
- S10: https://digitalcommons.usu.edu/hper_facpub/286 (aquatic treadmill drag from jets; surfaced in a search result, not opened).
- S11: https://www.biorxiv.org/content/10.1101/2019.12.29.890434v1.full (real-world walking surface study, bioRxiv 2019 and PLOS One 2020: woodchips +27%, intro quotes Soule and Goldman 1.0/1.2/1.5/2.1).
- S12: https://archive-ouverte.unige.ch/unige:10151 (Zamparo 1992, energy cost of walking or running on sand; abstract values via search).
- S13: https://researchonline.ljmu.ac.uk/24141/1/jeb246787.pdf (sand-sinking-depth walking study; Lejeune 1998 and Davies and Mackinnon 2006 ratios came from a search summary of the sand literature, not opened here).
- S14: https://pubmed.ncbi.nlm.nih.gov/30487109/ (Richmond et al. 2019, snow terrain coefficient and sinkage formula).
- S15: https://pmc.ncbi.nlm.nih.gov/articles/PMC8069713/ (Orr et al. 2021 review: Santee et al. found energy fell down to -12% grade; qualitative terrain ranking).
- Not read, named for the keeper: Soule and Goldman 1972 (J Appl Physiol 32:706-708); Pandolf, Haisman, Goldman 1976 (Ergonomics 19:683-690); Santee et al. 2001 (Aviat Space Environ Med 72:562-566) and USARIEM T01-11; Minetti et al. 2002 (https://iris.unibs.it/retrieve/ddc633e4-3c03-4e2e-e053-3705fe0a4c80/Minetti%20JAP%202002.pdf, binary only to my tools); Tobler 1993 report.

- (3020) report: Confidence medium for the Pandolf equation and the standard eta table (identical in S1 and S2/S5, but both are secondary and none of Soule and Goldman 1972, Pandolf 1976 or Santee 2001 could be read), low for the Santee downhill term (two printed forms disagree, neither vanishes at G = 0), for the Minetti walking polynomial (null: only anchors 1.64 and 17.33 J/(kg m), and the -0.45 value is listed as 3.46 and 3.92) and for wading against a current (null: no usable form). Open choices for the keeper: (1) publish eta only and compute grade per move from `world.elevation`, as proposed, or also publish a per-cell slope; (2) the sand value, 2.1 from the table or a range 1.34-2.7 from direct studies; (3) whether cane, mud and wet sand stay null or take a class proxy (heavy brush 1.5, bog 1.8); (4) have the T01-11 Santee equation and the Minetti paper read by a session that can decode PDFs before E2 or E3 is implemented. What the Life side needs: eta and a signed grade per move, the body mass and load it already has, Pandolf E1 for level and uphill, a downhill rule it must source (E2 unresolved, so a stopgap is Pandolf at G = 0), a power budget for the speed root, `body.expenditure` conversion from W to kcal, and the population-movement half (dispersal, migration) which this unit did not touch.
