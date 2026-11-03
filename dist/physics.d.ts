export declare const R_GAS = 8.314;
export declare const MMHG_PER_PA: number;
export declare const P_SEA_LEVEL = 101325;
/** Barometric formula for the lower atmosphere under standard conditions (ATM-STD). h in metres, returns Pa. */
export declare function pressureAtAltitude(h: number): number;
/** Antoine equation for water, 1 to 100 C: log10 p(mmHg) = A - B/(C + T). Returns Pa. ENG-ANT (NIST). */
export declare function waterVapourPressure(tC: number): number;
/** Inverse of the Antoine equation: the boiling point (C) of water at pressure p (Pa). ENG-ANT. */
export declare function waterBoilingPoint(pPa: number): number;
/** Latent heat of vaporisation of water, J/kg: about 2501 - 2.37 T kJ/kg for T in C (2257 kJ/kg at 100 C). ENG-LAT. */
export declare function waterLatentHeat(tC: number): number;
/** Specific heats, J/(kg K). ENG-CP. */
export declare const CP: {
    readonly water: 4186;
    readonly air: 1005;
    readonly copper: 385;
    readonly glass: 840;
    readonly iron: 450;
    readonly charcoal: 1000;
    readonly waterVapour: 1996;
};
/** Higher heating values, J/kg. ENG-HHV (NIST, Engineering ToolBox). */
export declare const HHV: {
    readonly charcoal: 30000000;
    readonly wood_dry: 16000000;
    readonly ethanol: 26800000;
};
/** Molar masses, kg/mol. ENG-STOICH. Formula weights from src/elements.ts, the same set the substance rows carry; air is a mixture (28.97 g/mol rounded). */
export declare const M: {
    C: number;
    O2: number;
    CO2: number;
    CO: number;
    H2O: number;
    N2: number;
    air: number;
};
/**
 * Charcoal (as carbon) burning: complete, C + O2 -> CO2 (1 kg C: 2.667 kg O2 -> 3.667 kg CO2);
 * starved, 2C + O2 -> 2CO (1 kg C: 1.333 kg O2 -> 2.333 kg CO). The share that goes to CO rises as the air's oxygen
 * fraction falls under 0.15 (a simplification of the real dependence on temperature and mixing; GAS-BOX, CHM-BP).
 */
export declare function carbonCombustion(kgC: number, o2Fraction: number): {
    kgCO2: number;
    kgCO: number;
    kgO2: number;
    heatJ: number;
};
/** Convective or overall heat flow, W = U A dT. ENG-HT. */
export declare function heatFlow(U: number, areaM2: number, dT: number): number;
/** Ideal gas: moles in a volume. ENG-GAS. */
export declare function molesInVolume(pPa: number, volumeM3: number, tK: number): number;
/** Density of air at p, T (kg/m3), ideal gas. */
export declare function airDensity(pPa: number, tK: number): number;
/** Joules per kilocalorie, the thermochemical calorie (4.184 J), the unit the food and expenditure tables use. */
export declare const KCAL_J = 4184;
export declare const C_TO_K = 273.15;
/** ASHRAE 2023 HVAC Applications ch.6 eq.2 and table 1: still air V=0,
 * unoccupied surface Fa=0.5, k_m = 0.089 Fa / L, kg/(m2 s Pa).
 * https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch06/a23_ch06_si.aspx
 * Pool correlation extrapolated to a warm vessel; no boiling or surface condensation here.
 */
export declare function surfaceEvaporationKgPerS(area: number, waterC: number, partialPa: number): number;
/** Brick heat capacity/density: LBNL Buildings library.
 * https://simulationresearch.lbl.gov/modelica/releases/v1.1_build0_rc2/help/Buildings_HeatTransfer_Data_Solids.html
 * Thickness and whole-assembly U: CIBSE Domestic Heating Design Guide table 6.1,
 * solid brick 228 mm, dense plaster. Plaster thermal mass is neglected.
 * https://mcscertified.com/wp-content/uploads/2020/04/Guidance-on-U-Values-from-Domestic-Heating-Design-Guide.pdf
 * h=10 W/(m2 K) retains the scenario's ENG-HT free-convection assumption.
 */
export declare const BRICK_WALL: {
    readonly thicknessM: 0.228;
    readonly density: 1920;
    readonly cp: 790;
    readonly U: 2.11;
    readonly h: 10;
};
/** Counterflow effectiveness, NTU=UA/Cmin, Cr=Cmin/Cmax; Cr=0 for isothermal condensation.
 * https://fchartsoftware.com/ees/heat_transfer_library/heat_exchangers/hs1000.htm
 * Includes the equal-capacity limit to avoid 0/0.
 */
export declare function counterflowEffectiveness(ntu: number, capacityRatio: number): number;
/** Churchill-Chu horizontal-cylinder natural convection, Nu=hD/k (Ra<1e12).
 * https://www.fchartsoftware.com/ees/heat_transfer_library/free_convection/hs3045.htm
 * Equation: https://nrel.gov/docs/fy11osti/51825.pdf
 * Fixed liquid-water properties at 40 C (a named property approximation):
 * k=0.628 W/(m K), nu=0.658e-6 m2/s, alpha=1.51e-7 m2/s, beta=0.000385 /K.
 * https://staff.washington.edu/calebktw/water_properties.html
 * Neglects copper and condensate-film resistances; U is water-side controlled.
 */
export declare function condenserWaterCoefficient(deltaC: number, diameterM: number): number;
