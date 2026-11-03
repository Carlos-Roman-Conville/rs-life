import { C_TO_K, M, MMHG_PER_PA, R_GAS, airDensity, pressureAtAltitude, waterVapourPressure } from "./physics.js";
import { addHeat } from "./world.js";
import { libraryRow } from "./library.js";
// ---------------------------------------------------------------------------------------------------------------- the library's numbers
const num = (s) => Number(s.replace(/,/g, ""));
function grab(text, rx, what, group = 1) {
    const m = rx.exec(text);
    if (!m)
        throw new Error(`atmosphere: the library text for ${what} no longer reads ${rx}`);
    return num(m[group]);
}
const cell = (file, table, id, column) => String(libraryRow(file, table, id)[column]);
/** The default outside air's water vapour, kg per kg of dry air (the still's value, process.ts before it moved here). */
export const OUTSIDE_WATER_KG_PER_KG = 0.012;
let cached = null;
function lib() {
    if (cached)
        return cached;
    const baseline = (id, col) => cell("atmosphere", "baseline", `atmosphere.baseline.${id}`, col);
    const bg = (id) => cell("gasdynamics", "box_model", `gasdynamics.box_model.${id}`, "Formula");
    const heavy = bg("heavier-gases-pool");
    const heavyIds = [...heavy.matchAll(/([A-Z][A-Za-z0-9]*) \(([\d.]+) x air\)/g)].map(m => m[1].toLowerCase());
    const layer = /lower half's concentration is x([\d.]+) the mean, the upper half x([\d.]+)/.exec(heavy);
    if (!layer || heavyIds.length === 0)
        throw new Error("atmosphere: the library text for the heavier gases no longer reads as expected");
    cached = {
        fo2: grab(baseline("oxygen-o2", "Dry-air fraction"), /([\d.]+)%/, "the oxygen fraction") / 100,
        fco2: grab(baseline("carbon-dioxide-co2", "Dry-air fraction"), /([\d.]+)%/, "the carbon dioxide fraction") / 100,
        waterMmHg: grab(baseline("water-vapour-h2o", "Partial pressure at sea level (mmHg)"), /(\d+)/, "the airway water vapour pressure"),
        uniformFrac: grab(bg("return-to-baseline"), /within (\d+)% of the baseline/, "the uniform tolerance") / 100,
        layerLow: num(layer[1]), layerHigh: num(layer[2]), heavyGases: heavyIds,
    };
    return cached;
}
// ---------------------------------------------------------------------------------------------------------------- units (gasdynamics.units)
/** Volume fraction to ppm. */
export const fractionToPpm = (fraction) => fraction * 1e6;
/** ppm to volume fraction. */
export const ppmToFraction = (ppm) => ppm / 1e6;
/** Partial pressure in mmHg = fraction x total pressure (mmHg). */
export const partialPressureMmHg = (fraction, totalMmHg) => fraction * totalMmHg;
/** Air changes per hour from a flow in m3 per minute: ACH = flow / volume x 60. */
export const achFromFlow = (flowM3PerMin, volumeM3) => flowM3PerMin / volumeM3 * 60;
/** The flow in m3 per minute that an ACH is: the inverse of `achFromFlow`. */
export const flowFromAch = (ach, volumeM3) => ach * volumeM3 / 60;
/** Moles in a volume of litres of gas at p, T (ideal gas; a region's total moles = p V / (R T)). */
export const litresToMoles = (litres, pPa, tC) => pPa * litres / 1000 / (R_GAS * (tC + C_TO_K));
/** kg of a registry gas in litres of gas at p, T. */
export function litresToKg(reg, gas, litres, pPa, tC) {
    return litresToMoles(litres, pPa, tC) * reg.substance(gas).molarMass;
}
/** Exposure of a concentration held for minutes, ppm-min. */
export const ppmMinutes = (ppm, minutes) => ppm * minutes;
/** Inhaled dose, L = VE (L/min) x fraction x minutes x uptake fraction (`gasdynamics.units` exposure). The uptake is the caller's (CHEMISTRY). */
export const inhaledDoseLitres = (veLMin, fraction, minutes, uptake) => veLMin * fraction * minutes * uptake;
/** The baseline air's volume fractions (library `atmosphere.baseline`): oxygen and CO2 from the rows, nitrogen fills the balance. */
export function baselineAir() {
    const L = lib();
    return { o2: L.fo2, n2: 1 - L.fo2, co2: L.fco2 };
}
/** The air at an altitude: the standard-atmosphere pressure and the inspired PO2 = FiO2 (P - 47 mmHg) once the airways saturate it. */
export function altitudeAir(altitudeM, o2Frac = lib().fo2) {
    const pressurePa = pressureAtAltitude(altitudeM), pressureMmHg = pressurePa * MMHG_PER_PA;
    return { pressurePa, pressureMmHg, inspiredPO2MmHg: o2Frac * (pressureMmHg - lib().waterMmHg) };
}
/** The altitude table's row nearest an altitude. */
export function altitudeRow(altitudeM) {
    const rows = ["0", "500", "1000", "2256", "3000", "5000"].map(h => libraryRow("atmosphere", "altitude", `atmosphere.altitude.${h}`));
    return rows.reduce((a, b) => Math.abs(Number(b["Altitude (m)"]) - altitudeM) < Math.abs(Number(a["Altitude (m)"]) - altitudeM) ? b : a);
}
/** `chemistry.substances` "Density vs air" of a gas (registry id; water vapour is `h2o_v` there), or null where the row has none. */
export function densityVsAir(gas) {
    const v = libraryRow("chemistry", "substances", gas === "water" ? "h2o_v" : gas)["Density vs air"];
    return typeof v === "number" ? v : null;
}
/**
 * The ppm a person at a height of an unmixed box reads: the heavier gases of `gasdynamics.box_model` (those the row names) read
 * x1.5 the mean low and x0.5 high (placeholder factors from that row); a mixed box, or any other gas, reads the mean.
 */
export function layeredPpm(gas, meanPpm, layer, mixed) {
    const L = lib();
    if (mixed || !L.heavyGases.includes(gas))
        return meanPpm;
    return meanPpm * (layer === "low" ? L.layerLow : L.layerHigh);
}
// ---------------------------------------------------------------------------------------------------------------- the room as a box
/** The room's air as a component: its contents are the gases (kg), its temperature the air's; props volume_m3, ach, pressurePa. */
export function roomGasFraction(w, room, gas) {
    const total = room.contents.filter(x => x.phase === "gas").reduce((a, x) => a + x.mass / w.registry.substance(x.substance).molarMass, 0);
    const n = w.registry.contentMass(room, gas, "gas") / w.registry.substance(gas).molarMass;
    return total > 0 ? n / total : 0;
}
/** Standard outside air as gas contents for a volume at p, T: the baseline fractions, plus water at kg per kg of air. */
export function airContents(volumeM3, pressurePa, tC, waterKgPerKgAir = OUTSIDE_WATER_KG_PER_KG) {
    const b = baselineAir(), airKg = airDensity(pressurePa, tC + C_TO_K) * volumeM3;
    return [
        { substance: "o2", phase: "gas", mass: b.o2 * M.O2 / M.air * airKg }, { substance: "n2", phase: "gas", mass: b.n2 * M.N2 / M.air * airKg },
        { substance: "co2", phase: "gas", mass: b.co2 * M.CO2 / M.air * airKg }, { substance: "co", phase: "gas", mass: 0 },
        { substance: "water", phase: "gas", mass: waterKgPerKgAir * airKg },
    ];
}
const STANDARD_GASES = ["o2", "n2", "co2", "co", "water"];
/**
 * The room's box model: ventilation exchanges its gases and heat with the outside at ACH (V dC/dt = -Q (C - C_out), with the
 * sources added by `sourcesProcess` and `breathingProcess`); humidity from its vapour. Any gas the room holds beyond the standard
 * five is carried out at zero outside. Sets `rh`, `co2ppm`, `o2frac`, `coppm` (and `<gas>ppm` for the others it holds).
 */
export function roomAirProcess(room) {
    return { name: "room", every: 1, step(w, dt) {
            const r = w.registry.component(room), reg = w.registry;
            const V = r.props.volume_m3, ach = r.props.ach ?? 0, Q = ach * V / 3600 * dt; // m3 exchanged this step
            const frac = Math.min(1, Q / V);
            const tK = r.temperatureC + C_TO_K, outsideC = w.env.outsideC ?? r.temperatureC;
            const rho = airDensity(r.props.pressurePa, tK);
            const air = baselineAir();
            const outside = { o2: air.o2 * M.O2 / M.air, n2: air.n2 * M.N2 / M.air, co2: air.co2 * M.CO2 / M.air, co: 0, water: (w.env.outsideWaterKgPerKgAir ?? OUTSIDE_WATER_KG_PER_KG) };
            const others = [...new Set(r.contents.filter(x => x.phase === "gas" && !STANDARD_GASES.includes(x.substance)).map(x => x.substance))];
            for (const gas of [...STANDARD_GASES, ...others]) {
                const have = reg.contentMass(r, gas, "gas");
                const want = (outside[gas] ?? 0) * rho * V; // kg of this gas in a room-volume of outside air
                const d = (want - have) * frac;
                if (Math.abs(d) < 1e-15)
                    continue;
                reg.addContent(r, gas, "gas", d);
                w.trace.record({ t: w.t, process: "ventilation", quantity: `mass:${gas}`, from: d > 0 ? "outside" : room, to: d > 0 ? room : "outside", amount: Math.abs(d) });
            }
            // heat exchange with outside by the same air change
            const cap = reg.heatCapacity(r);
            const q = (outsideC - r.temperatureC) * cap * frac;
            addHeat(w, r, q);
            w.trace.record({ t: w.t, process: "ventilation", quantity: "energy", from: q > 0 ? "outside" : room, to: q > 0 ? room : "outside", amount: Math.abs(q) });
            // humidity
            const nWater = reg.contentMass(r, "water", "gas") / M.H2O;
            const pWater = nWater * R_GAS * (r.temperatureC + C_TO_K) / V;
            r.props.rh = Math.min(1.5, pWater / waterVapourPressure(Math.min(100, r.temperatureC)));
            r.props.co2ppm = roomGasFraction(w, r, "co2") * 1e6;
            r.props.o2frac = roomGasFraction(w, r, "o2");
            r.props.coppm = roomGasFraction(w, r, "co") * 1e6;
            for (const gas of others)
                r.props[`${gas}ppm`] = roomGasFraction(w, r, gas) * 1e6;
        } };
}
const sourceRow = (id) => libraryRow("gasdynamics", "sources_sinks", `gasdynamics.sources_sinks.${id}`);
/** A lamp or candle, each: O2 -0.03 L/min, CO2 +0.03 (the row). Its CO "if it gutters" has no rate (FLAGS.md). */
export function lampFlows(count = 1) {
    const t = String(sourceRow("a-lamp-or-candle").Species);
    return { o2: grab(t, /O2 (-[\d.]+) L\/min/, "a lamp's oxygen") * count, co2: grab(t, /CO2 \+([\d.]+)/, "a lamp's CO2") * count };
}
/** A fire with its row's example rates (a cargo fire: 100 L/min CO2, 20 CO); oxygen follows from the carbon: C + O2 and 2C + O2, so O2 = CO2 + CO / 2. */
export function fireFlows(scale = 1) {
    const t = String(sourceRow("a-fire-structure-cargo")["Rate (placeholder)"]);
    const co2 = grab(t, /([\d.]+) L\/min CO2, ([\d.]+) CO/, "a fire's CO2") * scale, co = grab(t, /([\d.]+) L\/min CO2, ([\d.]+) CO/, "a fire's CO", 2) * scale;
    return { o2: -(co2 + co / 2), co2, co };
}
/** Rot in the bilge: H2S at its row's rate, L/min (a foul bilge). The CH4 and CO2 of rot have no rate (FLAGS.md). */
export function rotFlows() {
    return { h2s: grab(String(sourceRow("rot-in-the-bilge-and-stores")["Rate (placeholder)"]), /H2S ([\d.]+) L\/min/, "rot's H2S") };
}
/** A stinkpot burning grams of sulphur a minute: the row's 70 L of SO2 per 100 g, one mole of O2 for each of SO2 (S8 + 8 O2). */
export function sulphurFlows(gramsPerMin) {
    const t = String(sourceRow("a-stinkpot")["Rate (placeholder)"]);
    const so2 = grab(t, /([\d.]+) g sulphur: about ([\d.]+) L SO2/, "a stinkpot's SO2", 2) / grab(t, /([\d.]+) g sulphur: about ([\d.]+) L SO2/, "a stinkpot's sulphur") * gramsPerMin;
    return { so2, o2: -so2 };
}
/**
 * Move gases between a room and a named outside (a fire, a body, a lamp): litres at the room's conditions to kg, traced as
 * `mass:<gas>` from the source to the room (or room to sink). A consumption is limited to what the room holds.
 */
export function applyGasFlows(w, room, flows, dt, process, other) {
    const r = w.registry.component(room), reg = w.registry;
    const limit = (gas, kg) => kg < 0 ? Math.max(kg, -reg.contentMass(r, gas, "gas")) : kg;
    const scale = (() => {
        let s = 1;
        for (const [gas, lpm] of Object.entries(flows))
            if (lpm < 0) {
                const want = -litresToKg(reg, gas, lpm * dt / 60, r.props.pressurePa, r.temperatureC), have = reg.contentMass(r, gas, "gas");
                if (want > have)
                    s = Math.min(s, have / want);
            }
        return s;
    })();
    for (const [gas, lpm] of Object.entries(flows)) {
        const kg = limit(gas, litresToKg(reg, gas, lpm * dt / 60, r.props.pressurePa, r.temperatureC) * scale);
        if (kg === 0)
            continue;
        reg.addContent(r, gas, "gas", kg);
        w.trace.record({ t: w.t, process, quantity: `mass:${gas}`, from: kg > 0 ? other : room, to: kg > 0 ? room : other, amount: Math.abs(kg) });
    }
}
/** Sources and sinks on a room: each step every source's flows go through `applyGasFlows`. */
export function sourcesProcess(room, sources, every = 1) {
    return { name: "sources", every, step(w, dt) {
            for (const s of sources)
                applyGasFlows(w, room, typeof s.flows === "function" ? s.flows(w) : s.flows, dt, `source:${s.id}`, s.id);
        } };
}
/**
 * Host-supplied grid of cells with a mass of each tracked gas in each. Per step (explicit, operator-split; a cell per step at
 * most): advection by the wind (upwind, open cells; enclosed cells block it and exchange with the outside at their ACH),
 * diffusion by a fraction per step, buoyancy up a level for gases lighter than air and settling downhill or down a level for
 * heavier ones (the excess over the background only). Gas enters and leaves only through the wind boundary, the ACH exchange
 * and `release`; each is on the ledger and traced, and `balance` is zero when mass is conserved per species. Cells are
 * equal; the box model takes over when `uniform()` (every species within the library's 10% of its mean).
 */
export class Grid {
    nx;
    ny;
    nz;
    cells;
    species;
    spec;
    kg = {};
    background = {}; // kg of a species in one cell of background air
    ledger = {};
    ground;
    enclosed;
    ach;
    molar;
    density;
    constructor(reg, spec) {
        this.spec = spec;
        this.nx = spec.nx;
        this.ny = spec.ny;
        this.nz = spec.nz ?? 1;
        this.cells = this.nx * this.ny * this.nz;
        this.species = spec.species ?? ["o2", "n2", "co2", "co"];
        this.ground = new Float64Array(this.cells);
        this.enclosed = new Uint8Array(this.cells);
        this.ach = new Float64Array(this.cells);
        const air = baselineAir(), frac = { o2: air.o2, n2: air.n2, co2: air.co2 };
        const nCell = spec.pressurePa * this.cellVolume() / (R_GAS * (spec.temperatureC + C_TO_K));
        this.molar = {};
        this.density = {};
        for (const sp of this.species) {
            this.molar[sp] = reg.substance(sp).molarMass;
            this.density[sp] = densityVsAir(sp);
            this.background[sp] = (frac[sp] ?? 0) * nCell * this.molar[sp];
            this.kg[sp] = new Float64Array(this.cells).fill(this.background[sp]);
            this.ledger[sp] = { initial: this.background[sp] * this.cells, in: 0, out: 0, source: 0 };
        }
        for (let z = 0; z < this.nz; z++)
            for (let y = 0; y < this.ny; y++)
                for (let x = 0; x < this.nx; x++) {
                    const i = this.at(x, y, z);
                    this.ground[i] = (spec.elevationM?.(x, y) ?? 0) + z * spec.levelM;
                    this.enclosed[i] = spec.enclosed?.(x, y, z) ? 1 : 0;
                    this.ach[i] = spec.ach?.(x, y, z) ?? 0;
                }
    }
    cellVolume() { return this.spec.cellM * this.spec.cellM * this.spec.levelM; }
    at(x, y, z = 0) { return (z * this.ny + y) * this.nx + x; }
    coords(i) { const x = i % this.nx, y = Math.floor(i / this.nx) % this.ny; return [x, y, Math.floor(i / (this.nx * this.ny))]; }
    elevation(i) { return this.ground[i]; }
    /** Total kg of a species across the grid. */
    total(sp) { let s = 0; for (const v of this.kg[sp])
        s += v; return s; }
    /** The mole fraction of a species in a cell, in ppm of the tracked gases' moles. */
    ppm(sp, i) {
        let n = 0;
        for (const k of this.species)
            n += this.kg[k][i] / this.molar[k];
        return n > 0 ? this.kg[sp][i] / this.molar[sp] / n * 1e6 : 0;
    }
    /** initial + in + sources - out - total: zero (to rounding) when the species is conserved. */
    balance(sp) { const l = this.ledger[sp]; return l.initial + l.in + l.source - l.out - this.total(sp); }
    /** Put kg of a species into a cell (a fire, a vent, a shot); traced as `mass:<gas>` from the source to the grid. */
    release(sp, x, y, z, kg, label, trace, t = 0) {
        this.kg[sp][this.at(x, y, z)] += kg;
        this.ledger[sp].source += kg;
        trace?.record({ t, process: "grid", quantity: `mass:${sp}`, from: label, to: "grid", amount: kg });
    }
    /** Every species within `tol` (default the library's 10%) of its mean over the cells: the box model can take over. */
    uniform(tol = lib().uniformFrac) {
        for (const sp of this.species) {
            const mean = this.total(sp) / this.cells;
            if (mean <= 0)
                continue;
            for (const v of this.kg[sp])
                if (Math.abs(v - mean) > tol * mean)
                    return false;
        }
        return true;
    }
    /** The grid as one box: its total volume and gas contents, to load into a room component when `uniform()`. */
    asBox() {
        return { volume_m3: this.cells * this.cellVolume(), contents: this.species.map(sp => ({ substance: sp, phase: "gas", mass: this.total(sp) })) };
    }
    /** The ppm a body standing in a cell is exposed to this step, summed on its props as `<gas>ppmMin` (crouching reads the lower half). */
    expose(body, i, dt, layer = null) {
        for (const sp of this.species) {
            const ppm = layer ? layeredPpm(sp, this.ppm(sp, i), layer, this.uniform()) : this.ppm(sp, i);
            body.props[`${sp}ppmMin`] = (body.props[`${sp}ppmMin`] ?? 0) + ppmMinutes(ppm, dt / 60);
        }
    }
    neighbours(i) {
        const [x, y, z] = this.coords(i), out = [];
        if (x > 0)
            out.push({ j: this.at(x - 1, y, z), dx: -1, dy: 0, dz: 0 });
        if (x < this.nx - 1)
            out.push({ j: this.at(x + 1, y, z), dx: 1, dy: 0, dz: 0 });
        if (y > 0)
            out.push({ j: this.at(x, y - 1, z), dx: 0, dy: -1, dz: 0 });
        if (y < this.ny - 1)
            out.push({ j: this.at(x, y + 1, z), dx: 0, dy: 1, dz: 0 });
        if (z > 0)
            out.push({ j: this.at(x, y, z - 1), dx: 0, dy: 0, dz: -1 });
        if (z < this.nz - 1)
            out.push({ j: this.at(x, y, z + 1), dx: 0, dy: 0, dz: 1 });
        return out;
    }
    open(i, j) { return this.enclosed[i] === this.enclosed[j]; } // gas does not cross a wall between an enclosed and an open cell
    /** One step of dt seconds. Throws where the diffusion share would be unstable (6 x share over 1). */
    step(dt, rates = {}, trace, t = 0) {
        const { nx, ny, nz } = this, [ux, uy] = rates.windMS ?? [0, 0], k = rates.diffusion ?? null;
        if (k !== null && (k < 0 || 6 * k > 1))
            throw new Error(`grid: diffusion share ${k} is outside 0 to 1/6`);
        const boundary = {};
        for (const sp of this.species)
            boundary[sp] = { in: 0, out: 0 };
        for (const sp of this.species) {
            const old = this.kg[sp], next = Float64Array.from(old), bg = this.background[sp], bd = boundary[sp];
            // advection by the wind: each open cell sends its share downwind; the upwind edge (or a wall) is fed from the background
            if (ux !== 0 || uy !== 0) {
                let fx = Math.min(1, Math.abs(ux) * dt / this.spec.cellM), fy = Math.min(1, Math.abs(uy) * dt / this.spec.cellM);
                if (fx + fy > 1) {
                    const s = 1 / (fx + fy);
                    fx *= s;
                    fy *= s;
                }
                for (let z = 0; z < nz; z++)
                    for (let y = 0; y < ny; y++)
                        for (let x = 0; x < nx; x++) {
                            const i = this.at(x, y, z);
                            if (this.enclosed[i])
                                continue;
                            for (const [f, dx, dy] of [[fx, Math.sign(ux), 0], [fy, 0, Math.sign(uy)]]) {
                                if (f === 0)
                                    continue;
                                const tx = x + dx, ty = y + dy, ux0 = x - dx, uy0 = y - dy;
                                const downOff = tx < 0 || tx >= nx || ty < 0 || ty >= ny;
                                if (!downOff && this.enclosed[this.at(tx, ty, z)])
                                    continue; // blocked by a wall: nothing moves
                                next[i] -= f * old[i];
                                if (downOff)
                                    bd.out += f * old[i];
                                else
                                    next[this.at(tx, ty, z)] += f * old[i];
                                const upOff = ux0 < 0 || ux0 >= nx || uy0 < 0 || uy0 >= ny;
                                if (upOff || this.enclosed[this.at(ux0, uy0, z)]) {
                                    next[i] += f * bg;
                                    bd.in += f * bg;
                                }
                            }
                        }
            }
            // an enclosed cell trades with the outside at its ACH
            for (let i = 0; i < this.cells; i++)
                if (this.enclosed[i] && this.ach[i] > 0) {
                    const d = (bg - next[i]) * Math.min(1, this.ach[i] * dt / 3600);
                    next[i] += d;
                    if (d > 0)
                        bd.in += d;
                    else
                        bd.out -= d;
                }
            // diffusion: a share of each difference crosses each face
            if (k !== null && k > 0) {
                const cur = Float64Array.from(next);
                for (let i = 0; i < this.cells; i++)
                    for (const n of this.neighbours(i))
                        if (n.j > i && this.open(i, n.j)) {
                            const flow = k * (cur[i] - cur[n.j]);
                            next[i] -= flow;
                            next[n.j] += flow;
                        }
            }
            // buoyancy and settling act on the excess over the background, so the air itself does not stratify
            const dens = this.density[sp] ?? null;
            if (dens !== null && dens !== 1) {
                const share = dens > 1 ? rates.settle : rates.rise;
                if (share !== null && share !== undefined) {
                    const cur = Float64Array.from(next), f = Math.min(1, share * Math.abs(dens - 1));
                    for (let i = 0; i < this.cells; i++) {
                        const excess = cur[i] - bg;
                        if (excess <= 0)
                            continue;
                        const [x, y, z] = this.coords(i);
                        let to = -1;
                        if (dens < 1) {
                            if (z < nz - 1)
                                to = this.at(x, y, z + 1);
                        }
                        else {
                            let low = this.ground[i];
                            for (const n of this.neighbours(i))
                                if (n.dz === 0 && this.open(i, n.j) && this.ground[n.j] < low) {
                                    low = this.ground[n.j];
                                    to = n.j;
                                }
                            if (to < 0 && z > 0)
                                to = this.at(x, y, z - 1);
                        }
                        if (to < 0 || !this.open(i, to))
                            continue;
                        next[i] -= f * excess;
                        next[to] += f * excess;
                    }
                }
            }
            this.kg[sp].set(next);
        }
        for (const sp of this.species) {
            const l = this.ledger[sp], bd = boundary[sp];
            l.in += bd.in;
            l.out += bd.out;
            if (trace) {
                if (bd.in > 0)
                    trace.record({ t, process: "grid", quantity: `mass:${sp}`, from: "outside", to: "grid", amount: bd.in });
                if (bd.out > 0)
                    trace.record({ t, process: "grid", quantity: `mass:${sp}`, from: "grid", to: "outside", amount: bd.out });
                trace.check(t, `grid:${sp}`, l.initial + l.in + l.source - l.out, this.total(sp), 1e-9 * Math.max(1, l.initial));
            }
        }
    }
}
/** A grid as a scheduled process: steps it every `every` fast steps with the world's trace and clock. */
export function gridProcess(grid, rates, every = 1) {
    return { name: "grid", every, step(w, dt) { grid.step(dt, typeof rates === "function" ? rates(w) : rates, w.trace, w.t); } };
}
