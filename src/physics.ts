/**
 * Real-world formulas and constants (SI). Every function cites its source key (the host's SOURCES.md, ENG-*).
 * Nothing here is a game rule: these are the physics the engine runs on. Simplifications are named in the doc comment.
 */
import { formulaMolarMass } from "./elements.ts";

export const R_GAS = 8.314; // J/(mol K)  ENG-GAS
export const MMHG_PER_PA = 760 / 101325;
export const P_SEA_LEVEL = 101325; // Pa

/** Barometric formula for the lower atmosphere under standard conditions (ATM-STD). h in metres, returns Pa. */
export function pressureAtAltitude(h: number): number {
  return P_SEA_LEVEL * Math.pow(1 - 0.0065 * h / 288.15, 5.256);
}

/** Antoine equation for water, 1 to 100 C: log10 p(mmHg) = A - B/(C + T). Returns Pa. ENG-ANT (NIST). */
export function waterVapourPressure(tC: number): number {
  const A = 8.07131, B = 1730.63, C = 233.426;
  const mmHg = Math.pow(10, A - B / (C + tC));
  return mmHg / MMHG_PER_PA;
}

/** Inverse of the Antoine equation: the boiling point (C) of water at pressure p (Pa). ENG-ANT. */
export function waterBoilingPoint(pPa: number): number {
  const A = 8.07131, B = 1730.63, C = 233.426;
  const mmHg = pPa * MMHG_PER_PA;
  return B / (A - Math.log10(mmHg)) - C;
}

/** Latent heat of vaporisation of water, J/kg: about 2501 - 2.37 T kJ/kg for T in C (2257 kJ/kg at 100 C). ENG-LAT. */
export function waterLatentHeat(tC: number): number {
  return (2501 - 2.37 * tC) * 1000;
}

/** Specific heats, J/(kg K). ENG-CP. */
export const CP = { water: 4186, air: 1005, copper: 385, glass: 840, iron: 450, charcoal: 1000, waterVapour: 1996 } as const;

/** Higher heating values, J/kg. ENG-HHV (NIST, Engineering ToolBox). */
export const HHV = { charcoal: 30.0e6, wood_dry: 16.0e6, ethanol: 26.8e6 } as const;

/** Molar masses, kg/mol. ENG-STOICH. Formula weights from src/elements.ts, the same set the substance rows carry; air is a mixture (28.97 g/mol rounded). */
export const M = {
  C: formulaMolarMass("C"), O2: formulaMolarMass("O2"), CO2: formulaMolarMass("CO2"), CO: formulaMolarMass("CO"),
  H2O: formulaMolarMass("H2O"), N2: formulaMolarMass("N2"), air: 0.029,
};

/**
 * Charcoal (as carbon) burning: complete, C + O2 -> CO2 (1 kg C: 2.667 kg O2 -> 3.667 kg CO2);
 * starved, 2C + O2 -> 2CO (1 kg C: 1.333 kg O2 -> 2.333 kg CO). The share that goes to CO rises as the air's oxygen
 * fraction falls under 0.15 (a simplification of the real dependence on temperature and mixing; GAS-BOX, CHM-BP).
 */
export function carbonCombustion(kgC: number, o2Fraction: number) {
  const coShare = o2Fraction >= 0.15 ? 0 : Math.min(1, (0.15 - o2Fraction) / 0.10);
  const kgCO2 = kgC * (1 - coShare) * (M.CO2 / M.C);
  const kgCO = kgC * coShare * (M.CO / M.C);
  const kgO2 = kgC * (1 - coShare) * (M.O2 / M.C) + kgC * coShare * (0.5 * M.O2 / M.C);
  // CO carries away unreleased heat: CO's heat of combustion is about 10.1 MJ/kg of CO (ENG-HHV)
  const heat = kgC * HHV.charcoal - kgCO * 10.1e6;
  return { kgCO2, kgCO, kgO2, heatJ: heat };
}

/** Convective or overall heat flow, W = U A dT. ENG-HT. */
export function heatFlow(U: number, areaM2: number, dT: number): number {
  return U * areaM2 * dT;
}

/** Ideal gas: moles in a volume. ENG-GAS. */
export function molesInVolume(pPa: number, volumeM3: number, tK: number): number {
  return pPa * volumeM3 / (R_GAS * tK);
}

/** Density of air at p, T (kg/m3), ideal gas. */
export function airDensity(pPa: number, tK: number): number {
  return pPa * M.air / (R_GAS * tK);
}

/** Energy per litre of oxygen consumed (STPD), J/L: 20.1 kJ/L (PHY-MET, PHY-FAO). */
export const O2_ENERGY_J_PER_L = 20100;

/** Metabolic heat of a body, W: MET x 3.5 mL O2/kg/min x 20.1 kJ/L (PHY-MET, PHY-FAO). */
export function metabolicHeat(met: number, massKg: number): number {
  const litresO2PerMin = met * 3.5 * massKg / 1000;
  return litresO2PerMin * O2_ENERGY_J_PER_L / 60;
}

/** Joules per kilocalorie, the thermochemical calorie (4.184 J), the unit the food and expenditure tables use. */
export const KCAL_J = 4184;

/** Latent heat of sweat evaporation, J/kg (about 2.43 MJ/kg at skin temperature). ENG-LAT. */
export const SWEAT_LATENT = 2.43e6;

export const C_TO_K = 273.15;

/** ASHRAE 2023 HVAC Applications ch.6 eq.2 and table 1: still air V=0,
 * unoccupied surface Fa=0.5, k_m = 0.089 Fa / L, kg/(m2 s Pa).
 * https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch06/a23_ch06_si.aspx
 * Pool correlation extrapolated to a warm vessel; no boiling or surface condensation here.
 */
export function surfaceEvaporationKgPerS(area: number, waterC: number, partialPa: number): number {
  return 0.089 * 0.5 / waterLatentHeat(waterC) * Math.max(0, area)
    * Math.max(0, waterVapourPressure(waterC) - partialPa);
}

/** Brick heat capacity/density: LBNL Buildings library.
 * https://simulationresearch.lbl.gov/modelica/releases/v1.1_build0_rc2/help/Buildings_HeatTransfer_Data_Solids.html
 * Thickness and whole-assembly U: CIBSE Domestic Heating Design Guide table 6.1,
 * solid brick 228 mm, dense plaster. Plaster thermal mass is neglected.
 * https://mcscertified.com/wp-content/uploads/2020/04/Guidance-on-U-Values-from-Domestic-Heating-Design-Guide.pdf
 * h=10 W/(m2 K) retains the scenario's ENG-HT free-convection assumption.
 */
export const BRICK_WALL = { thicknessM: 0.228, density: 1920, cp: 790, U: 2.11, h: 10 } as const;

/** Counterflow effectiveness, NTU=UA/Cmin, Cr=Cmin/Cmax; Cr=0 for isothermal condensation.
 * https://fchartsoftware.com/ees/heat_transfer_library/heat_exchangers/hs1000.htm
 * Includes the equal-capacity limit to avoid 0/0.
 */
export function counterflowEffectiveness(ntu: number, capacityRatio: number): number {
  if (Number.isNaN(ntu) || !Number.isFinite(capacityRatio) || ntu < 0 || capacityRatio < 0 || capacityRatio > 1) throw new Error("invalid NTU or capacity ratio");
  if (ntu === 0) return 0;
  if (!Number.isFinite(ntu)) return 1;
  if (capacityRatio === 1) return ntu / (1 + ntu);
  const numerator = -Math.expm1(-ntu * (1 - capacityRatio));
  return numerator / (1 - capacityRatio + capacityRatio * numerator);
}

/** Churchill-Chu horizontal-cylinder natural convection, Nu=hD/k (Ra<1e12).
 * https://www.fchartsoftware.com/ees/heat_transfer_library/free_convection/hs3045.htm
 * Equation: https://nrel.gov/docs/fy11osti/51825.pdf
 * Fixed liquid-water properties at 40 C (a named property approximation):
 * k=0.628 W/(m K), nu=0.658e-6 m2/s, alpha=1.51e-7 m2/s, beta=0.000385 /K.
 * https://staff.washington.edu/calebktw/water_properties.html
 * Neglects copper and condensate-film resistances; U is water-side controlled.
 */
export function condenserWaterCoefficient(deltaC: number, diameterM: number): number {
  if (!Number.isFinite(diameterM) || diameterM <= 0) throw new Error("positive condenser diameter required");
  const nu = 0.658e-6, alpha = 1.51e-7, k = 0.628, beta = 0.000385;
  const pr = nu / alpha;
  const ra = 9.807 * beta * Math.abs(deltaC) * diameterM ** 3 / (nu * alpha);
  const nusselt = (0.60 + 0.387 * ra ** (1 / 6) / (1 + (0.559 / pr) ** (9 / 16)) ** (8 / 27)) ** 2;
  return nusselt * k / diameterM;
}
