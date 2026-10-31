# Aerobic training clamp (2635)

Formula: trainingFactor = clamp(0.6 + k1 * fitness - k2 * fatigue, 0.6, 1.0).
Circulation alone owns aerobic_today = oxygenDelivery(CO_max * trainingFactor,
Hb, SaO2, COHb), in mL O2/min. The option defaults to 1 and is read each step;
the host updates it from muscular.trainingFactor after its daily Banister step.
Actual flow and actual DO2 are unchanged by this option.

Source: proposed in PHYSIOLOGY.md section 2, uncalibrated, as quoted in this
unit's task. That game document and PLATFORM.md are absent from this folder;
no external folder was read. Evidence level 4 to 5 (estimate, not calibrated).
The numeric home is physiology.banister: training-factor-min/max hold 0.6/1.0;
training-k1/k2-normalisation explicitly reference the existing k rows unchanged.
These references label the proposed use of study coefficients on MET-hour sums
as estimates, without introducing a second coefficient set. DUP-18: the current
Busso means are k1=0.048, k2=0.117, tau1=38 days, tau2=1.9 days. The old prose's
0.4/42 and 0.4/7 are not used. Performance remains a compatibility diagnostic;
no src reader outside muscular consumes it.

## Constant daily load audit

From zero initial state, after n daily impulses of load L (MET-hours above 2 MET):
fitness = L * (1-exp(-n/38))/(1-exp(-1/38)); fatigue similarly uses 1.9 days.
The steady raw factor is 0.6 + 1.5621972193 * L. It reaches 1 at
L=0.2560496172. Every positive first-day load gives a raw value below 0.6.
The following illustrative grid covers rest, very light activity, and sustained
work/exercise (8 is one hour at 10 MET); 192 is an extreme 24-hour-at-10-MET
arithmetic envelope, not a realistic duty prescription. The task gives the load
unit but no exact game schedule range in this folder.

| L | Day 1 raw | Day 30 raw | Steady raw | Steady clamped |
|---:|---:|---:|---:|---:|
| 0 | 0.6000 | 0.6000 | 0.6000 | 0.6000 |
| 0.1 | 0.5931 | 0.6723 | 0.7562 | 0.7562 |
| 0.25 | 0.5828 | 0.7808 | 0.9905 | 0.9905 |
| 0.5 | 0.5655 | 0.9615 | 1.3811 | 1.0000 |
| 1 | 0.5310 | 1.3230 | 2.1622 | 1.0000 |
| 4 | 0.3240 | 3.4920 | 6.8488 | 1.0000 |
| 8 | 0.0480 | 6.3840 | 13.0976 | 1.0000 |
| 16 | -0.5040 | 12.1680 | 25.5952 | 1.0000 |
| 32 | -1.6080 | 23.7361 | 50.5903 | 1.0000 |
| 64 | -3.8160 | 46.8722 | 100.5806 | 1.0000 |
| 192 | -12.6480 | 139.4165 | 300.5419 | 1.0000 |

Thus all ordinary sustained work loads on this grid saturate at the upper bound;
rest sits at the lower bound, although tiny positive loads can be interior.
The scale is Rex's open question; no rescaling was applied.

## Validation status

The test reads archived opened rows of data/library/validation.json. Reference
20 L/min maximal output, 15 g/dL Hb and saturation(95), multiplied by the cited
0.9 extraction and divided by the fixture's 70 kg, lies within FRIEND men's
20-29 mean +/- SD (36.3 to 58.9 mL/kg/min). This validates only compatibility
with that broad range, not the clamp or the MET-hour normalisation. FRIEND is
apparently healthy, not verified untrained; the pooled extraction value reached
0.9 at 4.5 L/min and is not a measured extraction for this fixture.
Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/ and the Europe PMC
Skattebo 2020 abstract URL stored in validation.vo2max_norms.o2-extraction-fraction-max.
Per-kg and pool conversions, including BODY.md's proposed /40, belong exclusively
to the game's adapter and are never stored as engine capacity.
