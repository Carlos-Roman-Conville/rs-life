/** Per-cell elemental stocks. All fluxes use the kernel transaction at their own step;
 * see gears/soil-integration.md. Hosts supply initial pools and funded input accounts. */
import { transfer, TransferJournal, SECOND, type TransferLedger, type TransferRequest } from "@rex/kernel";
import type { Trace } from "./trace.ts";

export const NUTRIENTS = ["N", "P", "K"] as const;
export type Nutrient = typeof NUTRIENTS[number];
export type NutrientAmounts = Record<Nutrient, number>;
const empty = (): NutrientAmounts => ({ N: 0, P: 0, K: 0 });

function amount(q: number): number {
  if (!Number.isFinite(q) || q < 0) throw new Error("soils: nutrient balance/amount must be finite and non-negative");
  return q;
}
function element(quantity: string): Nutrient {
  const el = NUTRIENTS.find(el => quantity === `nutrient:${el}`);
  if (!el) throw new Error(`soils: unknown quantity ${quantity}`);
  return el;
}
function copy(pool: Readonly<NutrientAmounts>): NutrientAmounts {
  return { N: amount(pool.N), P: amount(pool.P), K: amount(pool.K) };
}

/** kg of each element in the whole cell, not kg per area. */
export class SoilCell implements TransferLedger {
  readonly id: string;
  readonly areaM2: number;
  #pool: NutrientAmounts;
  constructor(id: string, areaM2: number, pool: NutrientAmounts) {
    if (!id.trim() || !Number.isFinite(areaM2) || areaM2 <= 0) throw new Error("soils: cell needs id and positive finite areaM2");
    this.id = id;
    this.areaM2 = areaM2;
    this.#pool = copy(pool);
  }
  get pool(): Readonly<NutrientAmounts> { return Object.freeze({ ...this.#pool }); }
  unit(account: string, quantity: string): string {
    if (account !== `soil:${this.id}`) throw new Error(`soils: unknown cell account ${account}`);
    element(quantity);
    return "kg";
  }
  /** Kernel adapter: owner refuses an overdraw; no stock clamp. */
  apply(account: string, quantity: string, delta: number): void {
    this.unit(account, quantity);
    const el = element(quantity);
    this.#pool[el] = amount(this.#pool[el] + delta);
  }
  snapshot(): NutrientAmounts { return { ...this.#pool }; }
  restore(snapshot: unknown): void { this.#pool = { ...snapshot as NutrientAmounts }; }
}

export const poolPerArea = (cell: SoilCell, el: Nutrient): number => cell.pool[el] / cell.areaM2;

/** Named non-negative kg accounts. Initial inputs must be funded by the host;
 * missing accounts start at zero. Share a ledger/journal across cells as appropriate. */
export class NutrientLedger implements TransferLedger {
  readonly id: string;
  readonly journal: TransferJournal;
  #accounts = new Map<string, NutrientAmounts>();
  constructor(initial: Record<string, NutrientAmounts> = {}, journal = new TransferJournal(), id = "nutrients") {
    if (!id.trim()) throw new Error("soils: ledger needs an id");
    this.id = id;
    this.journal = journal;
    for (const [name, pool] of Object.entries(initial)) {
      if (!name.trim()) throw new Error("soils: account needs a name");
      this.#accounts.set(name, copy(pool));
    }
  }
  balance(account: string, el: Nutrient): number { return this.#accounts.get(account)?.[el] ?? 0; }
  total(el: Nutrient): number { return [...this.#accounts.values()].reduce((sum, pool) => sum + pool[el], 0); }
  unit(account: string, quantity: string): string {
    if (!account.trim()) throw new Error("soils: account needs a name");
    element(quantity);
    return "kg";
  }
  apply(account: string, quantity: string, delta: number): void {
    this.unit(account, quantity);
    const el = element(quantity), pool = this.#accounts.get(account) ?? empty();
    const next = amount(pool[el] + delta);
    this.#accounts.set(account, { ...pool, [el]: next });
  }
  snapshot(): Map<string, NutrientAmounts> { return new Map([...this.#accounts].map(([name, pool]) => [name, { ...pool }])); }
  restore(snapshot: unknown): void {
    this.#accounts = new Map([...(snapshot as Map<string, NutrientAmounts>)].map(([name, pool]) => [name, { ...pool }]));
  }
}

/** One atomic batch, including all elements of a harvest/loss. t is realism seconds;
 * the kernel journal uses integer milliseconds. Zero amounts are no-ops. */
export function transferNutrients(cell: SoilCell, quantities: Partial<NutrientAmounts>, account: string,
  process: string, ledger: NutrientLedger, trace?: Trace, t = 0, intoSoil = false): void {
  const before = cell.pool;
  const accountBefore = Object.fromEntries(NUTRIENTS.map(el => [el, ledger.balance(account, el)])) as NutrientAmounts;
  const requests: TransferRequest[] = [];
  for (const el of NUTRIENTS) {
    const q = amount(quantities[el] ?? 0);
    if (q === 0) continue;
    const soil = { ledger: cell, account: `soil:${cell.id}` }, other = { ledger, account };
    requests.push({ t: t * SECOND, process, quantity: `nutrient:${el}`, unit: "kg", amount: q,
      from: intoSoil ? other : soil, to: intoSoil ? soil : other });
  }
  transfer(ledger.journal, ...requests);
  for (const request of requests) {
    const el = element(request.quantity), q = request.amount;
    trace?.record({ t, process, quantity: request.quantity, from: request.from.account, to: request.to.account, amount: q });
    trace?.check(t, request.quantity, before[el] + accountBefore[el], cell.pool[el] + ledger.balance(account, el),
      1e-12 * Math.max(1, before[el] + accountBefore[el]));
  }
}

export function transferNutrient(cell: SoilCell, el: Nutrient, q: number, to: string, process: string,
  ledger: NutrientLedger, trace?: Trace, t = 0): void {
  transferNutrients(cell, { [el]: q }, to, process, ledger, trace, t);
}
export function addNutrient(cell: SoilCell, el: Nutrient, q: number, from: string, process: string,
  ledger: NutrientLedger, trace?: Trace, t = 0): void {
  transferNutrients(cell, { [el]: q }, from, process, ledger, trace, t, true);
}
