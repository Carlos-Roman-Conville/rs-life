/** ECOLOGY.md from the library's `ecology` tables: the logistic stock model with its depletion rules (`depletion_rules`) and
 * the soil nutrient ledger (`nutrient_removal`). The host supplies every stock and field (r, K, q and soil pools: the Caribbean
 * grounds stay in the game). Time is days. A stock's growth enters from `environment` and a catch leaves to `catch`, both
 * traced, and the step checks stock = before + growth - catch. Numbers the tables do not carry are in FLAGS.md.
 */
import { libraryRow } from "./library.ts";
import type { Trace } from "./trace.ts";
import { SoilCell, NutrientLedger, NUTRIENTS, poolPerArea, transferNutrients, type NutrientAmounts } from "./soils.ts";

const DAY = 86400;
const YEAR = 365;

const depletion = (slug: string) => String(libraryRow("ecology", "depletion_rules", `ecology.depletion_rules.${slug}`)["Formula or statement"]);
const soilRow = (slug: string) => String(libraryRow("ecology", "soil", `ecology.soil.${slug}`).Formula);
/** The first capture group of a pattern in a table cell as a number; a row whose wording changed fails loudly. */
function figure(text: string, re: RegExp, what: string): number {
  const m = re.exec(text);
  if (!m) throw new Error(`ecology: cannot read ${what} from "${text}"`);
  return Number(m[1]);
}

// ---------------------------------------------------------------- stocks

export interface Stock {
  id: string;
  /** Biomass or head count, in the host's unit. */
  B: number;
  /** Carrying capacity, same unit. */
  K: number;
  /** Intrinsic growth rate per year. */
  r: number;
  /** Penned stock neither depletes by itself nor breeds (the turtle crawl row). */
  penned: boolean;
  /** Multiplier on r (nesting-beach take), until `rMultiplierUntilDay`. */
  rMultiplier: number;
  rMultiplierUntilDay: number | null;
  day: number;
}
export function createStock(id: string, B: number, K: number, r: number, o: { penned?: boolean } = {}): Stock {
  if (!(K > 0) || !(r >= 0) || !(B >= 0)) throw new Error("ecology: stock needs K > 0, r >= 0, B >= 0");
  return { id, B, K, r, penned: o.penned ?? false, rMultiplier: 1, rMultiplierUntilDay: null, day: 0 };
}

/** Maximum sustainable yield per year of the Schaefer model: r K / 4, at B = K / 2. */
export const msyPerYear = (s: Pick<Stock, "r" | "K">) => s.r * s.K / 4;

const effectiveR = (s: Stock) => s.rMultiplierUntilDay !== null && s.day >= s.rMultiplierUntilDay ? s.r : s.r * s.rMultiplier;

/** Fished out: B under this fraction of K (the row's 0.2). */
export const fishedOutFraction = () => figure(depletion("a-ground-is-fished-out"), /B under ([\d.]+) K/, "the fished-out fraction");
/** The catch multiplier on a fished-out ground (the row's x0.2). */
export const fishedOutCatchFactor = () => figure(depletion("a-ground-is-fished-out"), /catch x([\d.]+)/, "the fished-out catch factor");
export const isFishedOut = (s: Stock) => s.B < fishedOutFraction() * s.K;

/** Daily catch per fisher: q x effort x B / K, times the fished-out factor under 0.2 K. `q` is the host's (its Fishing skill). */
export function dailyCatch(s: Stock, q: number, effort: number): number {
  return q * effort * s.B / s.K * (isFishedOut(s) ? fishedOutCatchFactor() : 1);
}

export interface StockStep { growth: number; catch: number; unmet: number }

/** The overnight update B += r B (1 - B/K) / 365 - catch, one day. A catch beyond what stands is cut to B and the rest is
 * `unmet`; a penned stock does not grow. The transfers go to `trace` and the balance is checked. */
export function stepStock(s: Stock, catchAmount: number, trace?: Trace): StockStep {
  if (!(catchAmount >= 0)) throw new Error("ecology: catch must be >= 0");
  const growth = s.penned ? 0 : effectiveR(s) * s.B * (1 - s.B / s.K) / YEAR;
  const before = s.B;
  // Growth is added before the catch is taken, as in the row: B + growth - catch.
  const available = before + growth;
  const taken = Math.min(catchAmount, available);
  s.B = available - taken;
  s.day += 1;
  if (trace) {
    const t = s.day * DAY;
    if (growth > 0) trace.record({ t, process: "ecology.stock", quantity: `stock:${s.id}`, from: "environment", to: s.id, amount: growth });
    if (growth < 0) trace.record({ t, process: "ecology.stock", quantity: `stock:${s.id}`, from: s.id, to: "environment", amount: -growth });
    if (taken > 0) trace.record({ t, process: "ecology.stock", quantity: `stock:${s.id}`, from: s.id, to: "catch", amount: taken });
    trace.check(t, `stock:${s.id}`, before + growth - taken, s.B, 1e-9 * Math.max(1, s.K));
  }
  return { growth, catch: taken, unmet: catchAmount - taken };
}

/** Years for a logistic stock to go from fraction `from` of K to `to`: ln[(to/(1-to)) / (from/(1-from))] / r. */
export function logisticYears(r: number, from: number, to: number): number {
  if (!(r > 0) || !(from > 0 && from < 1) || !(to > 0 && to < 1)) throw new Error("ecology: logisticYears needs r > 0 and fractions in (0, 1)");
  return Math.log((to / (1 - to)) / (from / (1 - from))) / r;
}
/** The recovery row: years from 0.2 K back to 0.8 K ("about 2.8/r"; the logistic gives ln 16 / r = 2.77/r). */
export const recoveryYears = (r: number) => logisticYears(r, 0.2, 0.8);

/** Years a stock fished at a constant `catchPerYear` takes to reach zero from B0, by the logistic curve. Only a catch above MSY
 * collapses; at exactly MSY the stock holds, below it settles. Returns null when the stock does not collapse. */
export function collapseYears(s: Pick<Stock, "r" | "K">, B0: number, catchPerYear: number): number | null {
  const { r, K } = s;
  const h = catchPerYear;
  const msy = msyPerYear(s);
  if (h <= msy) return null;
  // dB/dt = -(r/K)(u^2 + c^2), u = B - K/2, c^2 = K h / r - K^2 / 4: u = -c tan(atan(-u0/c)... ) solved for u = -K/2.
  const c = Math.sqrt(K * h / r - K * K / 4);
  const u0 = B0 - K / 2;
  return (Math.atan(u0 / c) - Math.atan(-K / 2 / c)) * K / (r * c);
}

/** Taking breeding females on the beach in the nesting season: r x0.5 for a decade (3,650 days). */
export function takeNestingFemales(s: Stock): void {
  const text = depletion("nesting-beaches");
  if (!/for a decade/.test(text)) throw new Error(`ecology: cannot read the nesting duration from "${text}"`);
  s.rMultiplier = figure(text, /r x([\d.]+)/, "the nesting r multiplier");
  s.rMultiplierUntilDay = s.day + 10 * YEAR;
}

/** Food a crawl of N pens gives: N x the row's kg per turtle. */
export const crawlFoodKg = (n: number) => n * figure(depletion("turtle-crawls-goods-md-row-60"), /N x (\d+) kg/, "kg per turtle");

export function stockOutputs(s: Stock) {
  return {
    "ecology.depletion_rules.overnight-stock-update": s.B,
    "ecology.depletion_rules.a-ground-is-fished-out": isFishedOut(s),
    "ecology.depletion_rules.daily-catch-per-fisher.fill": s.B / s.K,
  };
}

// ---------------------------------------------------------------- soil

export interface Field {
  readonly id: string;
  readonly cell: SoilCell;
  readonly ledger: NutrientLedger;
  readonly f0: number;
  readonly pool0: Readonly<NutrientAmounts>;
  readonly f: number;
}
/** Only the display index is clamped; elemental pools never are. Level 4 estimate:
 * gears/soil-fertility-index.md. */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Former values only, retained for callers inspecting the superseded library row.
 * @deprecated Harvest uses nutrientRemoval, never this index drain. */
export function cropDemand(): Record<string, number> {
  const text = soilRow("fertility-drain-per-harvest");
  const out: Record<string, number> = {};
  for (const m of text.matchAll(/([a-z]+) (-?\d*\.\d+)/g)) out[m[1]] = Number(m[2]);
  if (!Object.keys(out).length) throw new Error(`ecology: cannot read crop demands from "${text}"`);
  return out;
}

/** Host supplies the cell and may share a funded ledger. Default ledger has no inputs.
 * Positive reference pools are required to define pool/pool0; a depleted cell can be
 * reached through transfers after creation. f0 = 0 gives a permanently zero index. */
export function createField(id: string, f: number, cell: SoilCell, ledger = new NutrientLedger()): Field {
  if (!(f >= 0 && f <= 1)) throw new Error("ecology: fertility must be in [0, 1]");
  const pool0 = Object.freeze({ ...cell.pool });
  if (NUTRIENTS.some(el => pool0[el] <= 0)) throw new Error("ecology: reference nutrient pools must be positive");
  return Object.freeze({ id, cell, ledger, f0: f, pool0,
    get f() { return clamp01(f * Math.min(...NUTRIENTS.map(el => cell.pool[el] / pool0[el]))); } });
}

/** Clearing forest assigns the row's f = 0.9 to the host's existing stock, without adding mass. */
export const clearForest = (id: string, cell: SoilCell, ledger?: NutrientLedger): Field =>
  createField(id, figure(soilRow("deforestation"), /f = ([\d.]+)/, "the new-field fertility"), cell, ledger);

const cropRows: Record<string, string> = {
  cane: "sugarcane-howeler", tobacco: "tobacco-howeler", maize: "maize-howeler",
  cassava: "cassava-howeler", pease: "field-pea-mpsg",
};
/** Explicit row ids (or slugs) select other measurements; legacy crop names use the
 * documented defaults. No fixed-N credit is invented for legumes (CG-7). */
export function nutrientRemoval(crop: string): NutrientAmounts {
  return nutrientFigures("nutrient_removal", cropRows[crop] ?? crop);
}
function nutrientFigures(table: string, row: string): NutrientAmounts {
  const id = row.startsWith(`ecology.${table}.`) ? row : `ecology.${table}.${row}`;
  const values = libraryRow("ecology", table, id);
  const result = { N: 0, P: 0, K: 0 };
  for (const el of NUTRIENTS) {
    const value = values[`${el} kg/t`];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error(`ecology: missing/invalid ${el} removal or content figure in row ${id}`);
    result[el] = value;
  }
  return result;
}
function nonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`ecology: ${name} must be finite and non-negative`);
}

export interface Harvest {
  yield: number;
  /** Change in the derived index, retained for compatibility; never a second debit. */
  drain: number;
  /** Nutrients exported in the yield (kg), soil debits (kg), and unmet soil demand (kg). */
  removal: NutrientAmounts;
  transferred: NutrientAmounts;
  shortfall: NutrientAmounts;
}
/** yield = maxYield x (0.3 + 0.7 f) x rain x labour, reading f before any transfer.
 * Host yields are tonnes of the harvested part on the selected nutrient_removal row's
 * basis (fresh stalk/root or dry grain/leaf), over this whole cell, not tonnes/ha.
 * uptakeByPlant means Life already debited uptake through transferNutrient; plant-to-crop
 * export is outside this soil ledger. Otherwise all elements move in one atomic batch. */
export function harvest(field: Field, crop: string, maxYield: number, rainFactor: number, labourFactor: number,
  trace?: Trace, day = 0, opts: { uptakeByPlant?: boolean } = {}): Harvest {
  const rates = nutrientRemoval(crop);
  nonnegative(maxYield, "maxYield"); nonnegative(rainFactor, "rainFactor"); nonnegative(labourFactor, "labourFactor");
  const before = field.f;
  const y = maxYield * (0.3 + 0.7 * before) * rainFactor * labourFactor;
  const removal = { N: 0, P: 0, K: 0 }, transferred = { N: 0, P: 0, K: 0 }, shortfall = { N: 0, P: 0, K: 0 };
  for (const el of NUTRIENTS) {
    removal[el] = y * rates[el];
    nonnegative(removal[el], `${el} removal`);
    if (!opts.uptakeByPlant) {
      transferred[el] = Math.min(removal[el], field.cell.pool[el]);
      shortfall[el] = removal[el] - transferred[el];
    }
  }
  if (!opts.uptakeByPlant) transferNutrients(field.cell, transferred, `crop:${field.id}`, "ecology.soil.harvest", field.ledger, trace, day * DAY);
  return { yield: y, drain: before - field.f, removal, transferred, shortfall };
}

/** A dry year (rain under 60% of normal) halves yields; otherwise the table has no rain factor: null, the host's. */
export function dryYearFactor(rainFraction: number): number | null {
  const text = soilRow("rain");
  const limit = figure(text, /under (\d+)% of normal/, "the dry-year limit") / 100;
  return rainFraction < limit ? 0.5 : null;
}

/** Apply whole-cell tonnes of fresh manure, debiting the host-funded manure account.
 * Default: Purdue beef-open-concrete-lot; opts.row selects another manure_nutrients row.
 * No implicit availability/loss fraction: explicit losses need their own transfer.
 * Returns the kg added; all mass remains even when the display index reaches 1. */
export function manure(field: Field, tonnes: number, trace?: Trace, day = 0,
  opts: { row?: string } = {}): NutrientAmounts {
  nonnegative(tonnes, "manure tonnes");
  const rates = nutrientFigures("manure_nutrients", opts.row ?? "beef-open-concrete-lot");
  const quantities = { N: tonnes * rates.N, P: tonnes * rates.P, K: tonnes * rates.K };
  transferNutrients(field.cell, quantities, "manure", "ecology.soil.manure", field.ledger, trace, day * DAY, true);
  return quantities;
}

function slowTransfer(field: Field, rate: number, days: number, account: string, process: string,
  intoSoil: boolean, trace?: Trace, day = 0): number {
  nonnegative(days, "days");
  if (field.f0 === 0) throw new Error("ecology: slow index rates require f0 > 0 for conversion to kg");
  const before = field.f;
  const quantities = { N: 0, P: 0, K: 0 };
  for (const el of NUTRIENTS) quantities[el] = rate * days / YEAR * field.pool0[el] / field.f0;
  transferNutrients(field.cell, quantities, account, process, field.ledger, trace, day * DAY, intoSoil);
  return field.f - before;
}
/** Placeholder until CG-7 supplies sourced inputs: debit host-funded inputs:fallow.
 * Table f-rate converted to kg per element using pool0/f0, at this flux's step. */
export function fallow(field: Field, days: number, underBush = false, trace?: Trace, day = 0): number {
  const text = soilRow("fallow");
  const idle = figure(text, /f \+= ([\d.]+) a year idle/, "the idle fallow gain");
  const bush = figure(text, /\+([\d.]+) under bush/, "the bush fallow gain");
  return slowTransfer(field, underBush ? bush : idle, days, "inputs:fallow", "ecology.soil.fallow", true, trace, day);
}
/** Placeholder until realism.terrain.nutrient_transport: table slope rate in kg,
 * transferred to loss:erosion. An overdraw refuses the entire batch, never clamps. */
export function erode(field: Field, days: number, trace?: Trace, day = 0): number {
  const per = figure(soilRow("deforestation"), /f -= ([\d.]+) a year extra/, "the slope erosion");
  return slowTransfer(field, per, days, "loss:erosion", "ecology.soil.deforestation", false, trace, day);
}

export function soilOutputs(field: Field): Record<string, number> {
  const out: Record<string, number> = { "ecology.soil.yield": 0.3 + 0.7 * field.f, "ecology.soil.fertility": field.f };
  for (const el of NUTRIENTS) {
    out[`ecology.soil.${el}.kg`] = field.cell.pool[el];
    out[`ecology.soil.${el}.kg/m2`] = poolPerArea(field.cell, el);
  }
  return out;
}
