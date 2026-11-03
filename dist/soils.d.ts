/** Per-cell elemental stocks. All fluxes use the kernel transaction at their own step;
 * see gears/soil-integration.md. Hosts supply initial pools and funded input accounts. */
import { TransferJournal, type TransferLedger } from "@rex/kernel";
import type { Trace } from "./trace.ts";
export declare const NUTRIENTS: readonly ["N", "P", "K"];
export type Nutrient = typeof NUTRIENTS[number];
export type NutrientAmounts = Record<Nutrient, number>;
/** kg of each element in the whole cell, not kg per area. */
export declare class SoilCell implements TransferLedger {
    #private;
    readonly id: string;
    readonly areaM2: number;
    constructor(id: string, areaM2: number, pool: NutrientAmounts);
    get pool(): Readonly<NutrientAmounts>;
    unit(account: string, quantity: string): string;
    /** Kernel adapter: owner refuses an overdraw; no stock clamp. */
    apply(account: string, quantity: string, delta: number): void;
    snapshot(): NutrientAmounts;
    restore(snapshot: unknown): void;
}
export declare const poolPerArea: (cell: SoilCell, el: Nutrient) => number;
/** Named non-negative kg accounts. Initial inputs must be funded by the host;
 * missing accounts start at zero. Share a ledger/journal across cells as appropriate. */
export declare class NutrientLedger implements TransferLedger {
    #private;
    readonly id: string;
    readonly journal: TransferJournal;
    constructor(initial?: Record<string, NutrientAmounts>, journal?: TransferJournal, id?: string);
    balance(account: string, el: Nutrient): number;
    total(el: Nutrient): number;
    unit(account: string, quantity: string): string;
    apply(account: string, quantity: string, delta: number): void;
    snapshot(): Map<string, NutrientAmounts>;
    restore(snapshot: unknown): void;
}
/** One atomic batch, including all elements of a harvest/loss. t is realism seconds;
 * the kernel journal uses integer milliseconds. Zero amounts are no-ops. */
export declare function transferNutrients(cell: SoilCell, quantities: Partial<NutrientAmounts>, account: string, process: string, ledger: NutrientLedger, trace?: Trace, t?: number, intoSoil?: boolean): void;
export declare function transferNutrient(cell: SoilCell, el: Nutrient, q: number, to: string, process: string, ledger: NutrientLedger, trace?: Trace, t?: number): void;
export declare function addNutrient(cell: SoilCell, el: Nutrient, q: number, from: string, process: string, ledger: NutrientLedger, trace?: Trace, t?: number): void;
