# Core temperature drift rule (2768)

Formula, each hour, for work class c at the current WBGT:

    over = max(0, WBGT - ceiling_c - acclim_bonus - shade_bonus)
    coreTemp += over * drift_c - cooling(wind, shade, rest, drinking)

`over` stands for the gap between the heat produced (M, from the MET cost) and the heat
the air can take (radiation, convection, evaporation at this WBGT and wind); `cooling`
holds the evaporative and convective terms the rule can still buy. The rule is the
one-line shadow of the heat balance S = M - W - (R + C + E + K), kept because it is
cheap; the full balance with clothing insulation and skin wettedness is the upgrade if
the drift proves too coarse. Heat and cold share one `coreTemp` and one sign convention.

Constants: the numeric home is `data/library/physiology.json`, table `wbgt_limits`:
ceilings (acclimatised 30 / 28 / 25 C, unacclimatised 28.5 / 26 / 23 C for light,
moderate and heavy work) and the drift rates 0.15 / 0.25 / 0.4 C per hour per C over.
`src/physiology.ts` reads that table; the values here describe it and are not another
runtime configuration.

Provenance: first stated in the pirate game's body/PHYSIOLOGY.md section 4
("Thermoregulation: heat"), "Core drift (proposed)", after that document's audit of
2026-10-29, with placeholder rates marked proposed.

Source: the ceilings are NIOSH criteria (2016) and ACGIH TLVs as summarised by the US
Navy heat-flag tables (library source key PHY-WBGT); the heat balance is textbook. The
drift rule and its three rates have no source: they are the game's placeholders.

Evidence level: the WBGT ceilings level 4 (estimate from the published guidance,
summarised second-hand); the drift form and rates level 5 (hypothesis, uncalibrated).

Validation: not validated against measured core temperature under work in heat. Needed:
paired WBGT, work rate and core-temperature observations from heat-stress studies,
fitted per work class with uncertainty, before the rates replace the placeholders.
