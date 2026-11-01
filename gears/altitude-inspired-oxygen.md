# Altitude, inspired oxygen and the alveolar gas equation (2768)

Formulas:

    P(h) = 101325 * (1 - 0.0065 h / 288.15)^5.256 Pa    (lower atmosphere, standard conditions)
    inspired PO2 = FiO2 * (P - 47 mmHg)                  (47 mmHg: water vapour at body temperature)
    PAO2 = FiO2 * (P - 47) - PaCO2 / 0.8                 (alveolar gas equation)

Oxygen stays at 20.95 % of dry air while total pressure falls with altitude; the
airways saturate the inspired air with water vapour before the lungs see it. The
barometric formula is the standard atmosphere, not weather.

Where the numbers live: `src/physics.ts` (`pressureAtAltitude`) and `src/atmosphere.ts`
compute them.
The calculator coefficients no table carries are listed in `flags/atmosphere.md`.

Provenance: first stated in the pirate game's world/ATMOSPHERE.md section 2 ("Pressure
and altitude"), 2026-10-29, as "rex (the model); science (values)". The game's example
altitudes (sea level to 5000 m, the Blue Mountains at 2256 m) are game content and are
not stated here.

Source: the standard atmosphere (library key ATM-STD) and standard respiratory
physiology for the alveolar gas equation (ATM-ALV).

Evidence level: textbook standard equations, stronger than level 4 (estimate); the
numeric level is for the platform owner to assign. The typical resting saturation
column of the game's table is an approximation, not part of this gear.

Validation: the equations are exact definitions of the standard model, so validation
means unit-level checks of the arithmetic (sea level 760 mmHg and 149 mmHg inspired
PO2; 99 mmHg alveolar at PaCO2 40). Real altitude deviates from the standard atmosphere
with weather and latitude.
