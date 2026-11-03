/** Caller-parameterised population state; no library reads or response defaults. */
export interface TissuePopulation {
  id: string;
  organ: string;
  cellType: string;
  region?: string | null;
  viableMassKg: number;
  capacity: number;
  injury: number;
  repairCapacity: number | null;
  senescentFraction: number;
  turnoverPerDay: number | null;
  fibroticFraction: number;
  matrixIntegrity: number;
}

export interface TissueInputs {
  injuryRate: number | null;
  repairRate: number | null;
  matrixChangeRate: number | null;
}

function numberIn(name: string, value: number, min = 0, max = Infinity): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`tissue: invalid ${name}`);
}

function validate(pop: TissuePopulation): void {
  numberIn("viableMassKg", pop.viableMassKg);
  numberIn("injury", pop.injury);
  for (const key of ["capacity", "senescentFraction", "fibroticFraction", "matrixIntegrity"] as const)
    numberIn(key, pop[key], 0, 1);
  for (const key of ["repairCapacity", "turnoverPerDay"] as const)
    if (pop[key] !== null) numberIn(key, pop[key]);
}

export function createTissuePopulation(
  init: Omit<TissuePopulation, "matrixIntegrity"> & { matrixIntegrity?: number },
): TissuePopulation {
  // One defines the intact structure of a new population; it is not a fitted model value.
  const pop = { ...init, matrixIntegrity: init.matrixIntegrity ?? 1 };
  validate(pop);
  return pop;
}

/** Mutates one explicit step and returns all mass leaving the viable compartment. */
export function stepTissue(pop: TissuePopulation, days: number, inputs: TissueInputs): { deadMassKg: number } {
  validate(pop);
  numberIn("days", days);
  for (const key of ["injuryRate", "repairRate", "matrixChangeRate"] as const) {
    const value = inputs[key];
    if (value !== null) numberIn(key, value, key === "matrixChangeRate" ? -Infinity : 0);
  }
  let change = 0;
  if (inputs.injuryRate !== null) change += inputs.injuryRate * days;
  if (inputs.repairRate !== null) change -= inputs.repairRate * days;
  pop.injury = Math.max(0, pop.injury + change);
  if (inputs.matrixChangeRate !== null)
    pop.matrixIntegrity = Math.max(0, Math.min(1, pop.matrixIntegrity + inputs.matrixChangeRate * days));
  const deadMassKg = pop.turnoverPerDay === null ? 0 : Math.min(pop.viableMassKg, pop.viableMassKg * pop.turnoverPerDay * days);
  pop.viableMassKg -= deadMassKg;
  return { deadMassKg };
}

function weighted(pops: readonly TissuePopulation[], key: "capacity" | "injury" | "senescentFraction" |
  "fibroticFraction" | "matrixIntegrity" | "repairCapacity" | "turnoverPerDay"): number | null {
  if (pops.some(p => p[key] === null)) return null;
  const mass = pops.reduce((sum, p) => sum + p.viableMassKg, 0);
  // An empty compartment has no weighted state. Retain its definition on a zero-mass split/merge.
  return mass === 0 ? (pops[0]?.[key] ?? 0) : pops.reduce((sum, p) => sum + p.viableMassKg * p[key]!, 0) / mass;
}

export function organAggregate(pops: readonly TissuePopulation[]): {
  viableMassKg: number; capacity: number; injury: number; matrixIntegrity: number;
} {
  pops.forEach(validate);
  if (pops.some(p => p.organ !== pops[0].organ)) throw new Error("tissue: mixed organs");
  const viableMassKg = pops.reduce((sum, p) => sum + p.viableMassKg, 0);
  return {
    viableMassKg,
    capacity: viableMassKg === 0 ? 0 : weighted(pops, "capacity")! * (1 - weighted(pops, "fibroticFraction")!),
    injury: weighted(pops, "injury")!,
    // How matrix integrity enters capacity belongs to DUP-67, not this implementation.
    matrixIntegrity: weighted(pops, "matrixIntegrity")!,
  };
}

export function splitRegions(pop: TissuePopulation, shares: Readonly<Record<string, number>>): TissuePopulation[] {
  validate(pop);
  const entries = Object.entries(shares);
  entries.forEach(([region, share]) => { if (!region) throw new Error("tissue: empty region"); numberIn("share", share, 0, 1); });
  if (!entries.length || Math.abs(entries.reduce((sum, [, share]) => sum + share, 0) - 1) > 1e-12)
    throw new Error("tissue: region shares must sum to one");
  let remaining = pop.viableMassKg;
  return entries.map(([region, share], i) => {
    const viableMassKg = i === entries.length - 1 ? remaining : Math.min(remaining, pop.viableMassKg * share);
    remaining -= viableMassKg;
    return { ...pop, region, viableMassKg };
  });
}

export function mergeRegions(pops: readonly TissuePopulation[]): TissuePopulation {
  if (!pops.length) throw new Error("tissue: no regions to merge");
  pops.forEach(validate);
  const first = pops[0];
  if (pops.some(p => p.id !== first.id || p.organ !== first.organ || p.cellType !== first.cellType))
    throw new Error("tissue: incompatible regions");
  const merged = { ...first, region: null, viableMassKg: organAggregate(pops).viableMassKg };
  for (const key of ["capacity", "injury", "senescentFraction", "fibroticFraction", "matrixIntegrity"] as const)
    merged[key] = weighted(pops, key)!;
  merged.repairCapacity = weighted(pops, "repairCapacity");
  merged.turnoverPerDay = weighted(pops, "turnoverPerDay");
  return merged;
}
