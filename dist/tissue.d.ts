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
export declare function createTissuePopulation(init: Omit<TissuePopulation, "matrixIntegrity"> & {
    matrixIntegrity?: number;
}): TissuePopulation;
/** Mutates one explicit step and returns all mass leaving the viable compartment. */
export declare function stepTissue(pop: TissuePopulation, days: number, inputs: TissueInputs): {
    deadMassKg: number;
};
export declare function organAggregate(pops: readonly TissuePopulation[]): {
    viableMassKg: number;
    capacity: number;
    injury: number;
    matrixIntegrity: number;
};
export declare function splitRegions(pop: TissuePopulation, shares: Readonly<Record<string, number>>): TissuePopulation[];
export declare function mergeRegions(pops: readonly TissuePopulation[]): TissuePopulation;
