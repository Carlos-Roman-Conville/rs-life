/** Per-cell elemental stocks. All fluxes use the kernel transaction at their own step;
 * see gears/soil-integration.md. Hosts supply initial pools and funded input accounts. */
import { transfer, TransferJournal, SECOND } from "@rex/kernel";
export const NUTRIENTS = ["N", "P", "K"];
const empty = () => ({ N: 0, P: 0, K: 0 });
function amount(q) {
    if (!Number.isFinite(q) || q < 0)
        throw new Error("soils: nutrient balance/amount must be finite and non-negative");
    return q;
}
function element(quantity) {
    const el = NUTRIENTS.find(el => quantity === `nutrient:${el}`);
    if (!el)
        throw new Error(`soils: unknown quantity ${quantity}`);
    return el;
}
function copy(pool) {
    return { N: amount(pool.N), P: amount(pool.P), K: amount(pool.K) };
}
/** kg of each element in the whole cell, not kg per area. */
export class SoilCell {
    id;
    areaM2;
    #pool;
    constructor(id, areaM2, pool) {
        if (!id.trim() || !Number.isFinite(areaM2) || areaM2 <= 0)
            throw new Error("soils: cell needs id and positive finite areaM2");
        this.id = id;
        this.areaM2 = areaM2;
        this.#pool = copy(pool);
    }
    get pool() { return Object.freeze({ ...this.#pool }); }
    unit(account, quantity) {
        if (account !== `soil:${this.id}`)
            throw new Error(`soils: unknown cell account ${account}`);
        element(quantity);
        return "kg";
    }
    /** Kernel adapter: owner refuses an overdraw; no stock clamp. */
    apply(account, quantity, delta) {
        this.unit(account, quantity);
        const el = element(quantity);
        this.#pool[el] = amount(this.#pool[el] + delta);
    }
    snapshot() { return { ...this.#pool }; }
    restore(snapshot) { this.#pool = { ...snapshot }; }
}
export const poolPerArea = (cell, el) => cell.pool[el] / cell.areaM2;
/** Named non-negative kg accounts. Initial inputs must be funded by the host;
 * missing accounts start at zero. Share a ledger/journal across cells as appropriate. */
export class NutrientLedger {
    id;
    journal;
    #accounts = new Map();
    constructor(initial = {}, journal = new TransferJournal(), id = "nutrients") {
        if (!id.trim())
            throw new Error("soils: ledger needs an id");
        this.id = id;
        this.journal = journal;
        for (const [name, pool] of Object.entries(initial)) {
            if (!name.trim())
                throw new Error("soils: account needs a name");
            this.#accounts.set(name, copy(pool));
        }
    }
    balance(account, el) { return this.#accounts.get(account)?.[el] ?? 0; }
    total(el) { return [...this.#accounts.values()].reduce((sum, pool) => sum + pool[el], 0); }
    unit(account, quantity) {
        if (!account.trim())
            throw new Error("soils: account needs a name");
        element(quantity);
        return "kg";
    }
    apply(account, quantity, delta) {
        this.unit(account, quantity);
        const el = element(quantity), pool = this.#accounts.get(account) ?? empty();
        const next = amount(pool[el] + delta);
        this.#accounts.set(account, { ...pool, [el]: next });
    }
    snapshot() { return new Map([...this.#accounts].map(([name, pool]) => [name, { ...pool }])); }
    restore(snapshot) {
        this.#accounts = new Map([...snapshot].map(([name, pool]) => [name, { ...pool }]));
    }
}
/** One atomic batch, including all elements of a harvest/loss. t is realism seconds;
 * the kernel journal uses integer milliseconds. Zero amounts are no-ops. */
export function transferNutrients(cell, quantities, account, process, ledger, trace, t = 0, intoSoil = false) {
    const before = cell.pool;
    const accountBefore = Object.fromEntries(NUTRIENTS.map(el => [el, ledger.balance(account, el)]));
    const requests = [];
    for (const el of NUTRIENTS) {
        const q = amount(quantities[el] ?? 0);
        if (q === 0)
            continue;
        const soil = { ledger: cell, account: `soil:${cell.id}` }, other = { ledger, account };
        requests.push({ t: t * SECOND, process, quantity: `nutrient:${el}`, unit: "kg", amount: q,
            from: intoSoil ? other : soil, to: intoSoil ? soil : other });
    }
    transfer(ledger.journal, ...requests);
    for (const request of requests) {
        const el = element(request.quantity), q = request.amount;
        trace?.record({ t, process, quantity: request.quantity, from: request.from.account, to: request.to.account, amount: q });
        trace?.check(t, request.quantity, before[el] + accountBefore[el], cell.pool[el] + ledger.balance(account, el), 1e-12 * Math.max(1, before[el] + accountBefore[el]));
    }
}
export function transferNutrient(cell, el, q, to, process, ledger, trace, t = 0) {
    transferNutrients(cell, { [el]: q }, to, process, ledger, trace, t);
}
export function addNutrient(cell, el, q, from, process, ledger, trace, t = 0) {
    transferNutrients(cell, { [el]: q }, from, process, ledger, trace, t, true);
}
