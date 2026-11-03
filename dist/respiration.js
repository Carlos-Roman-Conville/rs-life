import { MMHG_PER_PA } from "./physics.js";
import { libraryRow } from "./library.js";
import { bodyOutputs, metabolicRateW, oxygenLitresPerMin } from "./physiology.js";
import { saturation } from "./circulation.js";
import { applyGasFlows, ppmMinutes, roomGasFraction } from "./atmosphere.js";
const num = (s) => Number(s.replace(/,/g, ""));
function grab(text, rx, what, group = 1) {
    const m = rx.exec(text);
    if (!m)
        throw new Error(`atmosphere: the library text for ${what} no longer reads ${rx}`);
    return num(m[group]);
}
const cell = (file, table, id, column) => String(libraryRow(file, table, id)[column]);
/**
 * Coefficients of the host dashboard's respiratory calculator (`resp`, body/dashboard.html) that no library table carries.
 * They are illustrative placeholders there (its caption says so); FLAGS.md lists each as a NOTE.
 */
export const CALCULATOR = {
    aaGradientMmHg: 7, // arterial PO2 = alveolar PO2 - 7 (the anatomy row: "5 to 10 mmHg in health")
    co2Retention: 0.7, // PaCO2 = 40 + FiCO2 (P - 47) 0.7
    hypoxicDropPerMmHg: 0.5, hypoxicDropMaxMmHg: 15, paco2FloorMmHg: 25, hypoxicCo2LimitFrac: 0.02,
    cohbEqCap: 0.8,
};
let cached = null;
function lib() {
    if (cached)
        return cached;
    const baseline = (id, col) => cell("atmosphere", "baseline", `atmosphere.baseline.${id}`, col);
    const bg = (id) => cell("gasdynamics", "box_model", `gasdynamics.box_model.${id}`, "Formula");
    const bg2 = (id, col) => cell("circulation", "blood_gas", `circulation.blood_gas.${id}`, col);
    const vent = (id) => cell("physiology", "ventilation", `physiology.ventilation.${id}`, "Formula or value");
    const coh = bg2("carboxyhaemoglobin-cohb", "Formula or rule");
    const ve = vent("minute-ventilation"), drive = vent("the-carbon-dioxide-drive");
    cached = {
        waterMmHg: grab(baseline("water-vapour-h2o", "Partial pressure at sea level (mmHg)"), /(\d+)/, "the airway water vapour pressure"),
        rq: grab(bg("oxygen-and-carbon-dioxide-move-together"), /\/ ([\d.]+) \(the respiratory quotient/, "the respiratory quotient"),
        cohbPerPpm: grab(coh, /COHb_eq about ([\d.]+) x ppm \/ (\d+)/, "the COHb equilibrium") / grab(coh, /COHb_eq about ([\d.]+) x ppm \/ (\d+)/, "the COHb equilibrium", 2),
        cohbHalfLifeH: grab(coh, /t_half (\d+) h/, "the COHb half-time"), cohbVentRef: grab(coh, /x VE\/(\d+)/, "the COHb ventilation reference"),
        veBase: grab(ve, /VE = ([\d.]+) \+/, "the resting ventilation"), vePerMl: grab(ve, /\+ ([\d.]+) x \(VO2/, "the ventilation slope"),
        veOffset: grab(ve, /\(VO2 - (\d+)\)/, "the ventilation offset"),
        veMax: grab(cell("anatomy", "respiratory", "anatomy.respiratory.ventilation-capacity-maximal", "Human default"), /\d+ to (\d+)/, "the maximal ventilation"),
        co2DriveFactor: grab(drive, /VE x ([\d.]+) per/, "the CO2 drive factor"), co2DrivePerMmHg: grab(drive, /per ([\d.]+) mmHg of PaCO2/, "the CO2 drive step"),
        paco2Normal: grab(drive, /PaCO2 over (\d+)/, "the normal PaCO2"), co2DriveFails: grab(drive, /over (\d+) mmHg the drive fails/, "the CO2 drive limit"),
        hypoxicBelow: grab(vent("the-hypoxic-drive"), /under (\d+) mmHg/, "the hypoxic drive threshold"),
    };
    return cached;
}
/** Alveolar gas equation (ATM-ALV): PAO2 = FiO2 (P - 47) - PaCO2 / 0.8, mmHg, not below zero. */
export function alveolarPO2(o2Frac, pressureMmHg, paco2MmHg) {
    const L = lib();
    return Math.max(0, o2Frac * (pressureMmHg - L.waterMmHg) - paco2MmHg / L.rq);
}
/** The human profile; `over` replaces fields for another species. */
export function respiratoryProfile(over = {}) {
    const L = lib();
    return { medium: "air", maxVentilationLMin: L.veMax, aaGradientMmHg: CALCULATOR.aaGradientMmHg,
        restingVentilationLMin: L.veBase, ventilationPerMlVo2: L.vePerMl, vo2OffsetMlMin: L.veOffset, ...over };
}
/**
 * The respiratory side for one body in one air: minute ventilation from the MET, the CO2 drive (x2 per 5 mmHg of PaCO2 over
 * 40, capped at the profile's maximum and held at the library's 70 mmHg where the drive fails) and the hypoxic drive, then the
 * alveolar gas equation, the A-a gradient and the Severinghaus curve; carbon monoxide gives no drive. The calculator's rules
 * for the retained inspired CO2 and the hypoxic drive are in `CALCULATOR`.
 */
export function respiratoryState(air, met, massKg, profile = respiratoryProfile()) {
    return respiratoryStateFromVo2(air, oxygenLitresPerMin(metabolicRateW(met, { mass: massKg, props: {} })) * 1000, profile);
}
/** Respiratory state using the same oxygen demand (mL/min) as the body's gas exchange. */
export function respiratoryStateFromVo2(air, vo2, profile = respiratoryProfile()) {
    const L = lib(), C = CALCULATOR, pw = air.pressureMmHg - L.waterMmHg;
    const ve = Math.min(profile.maxVentilationLMin, profile.restingVentilationLMin + profile.ventilationPerMlVo2 * Math.max(0, vo2 - profile.vo2OffsetMlMin));
    const pio2 = air.o2Frac * pw;
    let paco2 = L.paco2Normal + air.co2Frac * pw * C.co2Retention;
    let drive = Math.min(profile.maxVentilationLMin, ve * Math.pow(L.co2DriveFactor, Math.max(0, Math.min(paco2, L.co2DriveFails) - L.paco2Normal) / L.co2DrivePerMmHg));
    const first = Math.max(0, pio2 - paco2 / L.rq);
    if (first < L.hypoxicBelow && air.co2Frac < C.hypoxicCo2LimitFrac) {
        const drop = Math.min(C.hypoxicDropMaxMmHg, (L.hypoxicBelow - first) * C.hypoxicDropPerMmHg);
        paco2 = Math.max(C.paco2FloorMmHg, paco2 - drop);
        drive = Math.min(profile.maxVentilationLMin, drive * (1 + drop / C.hypoxicDropMaxMmHg));
    }
    const pao2 = Math.max(0, pio2 - paco2 / L.rq), pa = Math.max(0, pao2 - profile.aaGradientMmHg);
    return { vo2MlMin: vo2, inspiredPO2MmHg: pio2, paco2MmHg: paco2, alveolarPO2MmHg: pao2, arterialPO2MmHg: pa, sao2: saturation(pa),
        ventilationLMin: drive, cohbEq: Math.min(CALCULATOR.cohbEqCap, L.cohbPerPpm * air.coPpm), cohbHalfTimeMin: L.cohbHalfLifeH * 60 / Math.max(1, drive / L.cohbVentRef) };
}
/** COHb after `minutes`: it approaches its equilibrium with the half-time the ventilation sets (uptake is faster at work). */
export function cohbAfter(cohb, coPpm, ventilationLMin, minutes) {
    const L = lib(), eq = Math.min(CALCULATOR.cohbEqCap, L.cohbPerPpm * coPpm), half = L.cohbHalfLifeH * 60 / Math.max(1, ventilationLMin / L.cohbVentRef);
    return cohb + (eq - cohb) * (1 - Math.pow(0.5, minutes / half));
}
// ---------------------------------------------------------------------------------------------------------------- the library's thresholds
/** Species susceptibility data only; medicine owns diagnosis and consequences. */
export function gasTolerances() {
    const text = cell("anatomy", "respiratory", "anatomy.respiratory.gas-tolerances-species", "Human default");
    return { hypoxiaO2Pct: grab(text, /under ([\d.]+)% O2/, "species oxygen tolerance"),
        hypercapniaCo2Pct: grab(text, /CO2 over ([\d.]+)%/, "species carbon dioxide tolerance") };
}
/** The inhalation effect thresholds of a gas (`chemistry.substances`): "1% drowsy; 3% headache" as {at, unit, falling, effect}. */
export function gasThresholds(gas) {
    const out = [];
    let text = cell("chemistry", "substances", gas, "Effect thresholds (inhalation)");
    if (gas === "o2")
        text = cell("atmosphere", "thresholds_layering", "atmosphere.thresholds_layering.o2", "Exposure bands")
            .replace("species hypoxia tolerance:", `${gasTolerances().hypoxiaO2Pct}%`);
    if (gas === "co2") {
        const course = cell("medicine", "exposure", "medicine.exposure.hypercapnia-the-close-air", "Course");
        text = `${grab(course, /drowsy at ([\d.]+)%/, "drowsiness")}% drowsy; ${gasTolerances().hypercapniaCo2Pct}% headache, panting; ${grab(course, /confusion at ([\d.]+)%/, "confusion")}% confusion; ${grab(course, /narcosis ([\d.]+)/, "narcosis")}% unconscious`;
    }
    for (const piece of text.split(";")) {
        const m = /^\s*(under |over )?([\d,.]+)(?: to [\d,.]+)? ?(%|ppm)\s*(.*)$/.exec(piece);
        if (m)
            out.push({ at: num(m[2]), unit: m[3], falling: m[1] === "under " || gas === "o2", effect: m[4].trim() });
    }
    return out;
}
/** A threshold in ppm. */
export const thresholdPpm = (t) => t.unit === "%" ? t.at * 1e4 : t.at;
/**
 * The gases a body exchanges from metabolic power in W: physiology supplies oxygen L/min and the respiratory quotient
 * (0.8) sets CO2. With no RMR inputs, 70 kg at 1 MET matches the person row (0.25 O2, 0.2 CO2) to 2%; 28 kg matches
 * the goat row's 0.1. Physiology handles breath water and sweat.
 */
export function bodyGasFlows(metabolicW) {
    const o2 = oxygenLitresPerMin(metabolicW);
    return { o2: -o2, co2: o2 * lib().rq };
}
/** Gases tracked as `<gas>ppm` on a room and `<gas>ppmMin` on a body, besides the standard five. */
export const EXPOSURE_GASES = ["co2", "co", "h2s", "so2", "ch4", "h2"];
// ---------------------------------------------------------------------------------------------------------------- exposure and breathing
/**
 * Exposure integration for a body in a room: ppm-minutes of each gas the room reports (`<gas>ppm` on the room, `<gas>ppmMin`
 * summed on the body) and the peak (`<gas>ppmPeak`). Carbon dioxide reads ambient (400) and carbon monoxide zero where the room
 * reports none, as physiology did before this moved here.
 */
export function accumulateExposure(body, room, dt) {
    const p = body.props, rp = room.props;
    for (const gas of EXPOSURE_GASES) {
        const ppm = rp[`${gas}ppm`] ?? (gas === "co2" ? 400 : undefined);
        if (ppm === undefined)
            continue;
        p[`${gas}ppmMin`] = (p[`${gas}ppmMin`] ?? 0) + ppmMinutes(ppm, dt / 60);
        p[`${gas}ppmPeak`] = Math.max(p[`${gas}ppmPeak`] ?? 0, ppm);
    }
}
/**
 * A body breathing the room's air. Each step: the body takes O2 from the room and gives CO2 back (`bodyGasFlows` at
 * `outputs.metabolic_w` from physiology, else the `met` option through `metabolicRateW`), then the respiratory state of the room's air is written as outputs
 * by id and COHb moves toward its equilibrium. A profile whose medium is not air has no exchange and null outputs (gills and
 * water are not modelled: FLAGS.md). Place it after `roomAirProcess`.
 */
export function breathingProcess(body, room, o = {}) {
    const profile = o.profile ?? respiratoryProfile();
    return { name: "breathing", every: o.every ?? 10, step(w, dt) {
            const b = w.registry.component(body), r = w.registry.component(room), out = bodyOutputs(b);
            if (profile.medium !== "air") {
                for (const id of ["o2_frac", "co2_ppm", "co_ppm", "sao2", "cohb", "ventilation_l_min"])
                    out[id] = null;
                return;
            }
            const metabolicW = typeof out.metabolic_w === "number" ? out.metabolic_w
                : o.met === undefined ? undefined : metabolicRateW(o.met, b);
            if (metabolicW === undefined)
                throw new Error(`breathing: no metabolic rate for ${body}: run physiology first or pass the met option`);
            const flows = bodyGasFlows(metabolicW);
            applyGasFlows(w, room, flows, dt, "breathing", body);
            const o2 = roomGasFraction(w, r, "o2"), co2 = roomGasFraction(w, r, "co2"), co = roomGasFraction(w, r, "co");
            const s = respiratoryStateFromVo2({ pressureMmHg: r.props.pressurePa * MMHG_PER_PA, o2Frac: o2, co2Frac: co2, coPpm: co * 1e6 }, -flows.o2 * 1000, profile);
            b.props.cohb = cohbAfter(b.props.cohb ?? 0, co * 1e6, s.ventilationLMin, dt / 60);
            out.o2_frac = o2;
            out.co2_ppm = co2 * 1e6;
            out.co_ppm = co * 1e6;
            out.sao2 = s.sao2;
            out.cohb = b.props.cohb;
            out.ventilation_l_min = s.ventilationLMin;
            out.pressure_mmhg = r.props.pressurePa * MMHG_PER_PA;
            out.inspired_po2_mmhg = s.inspiredPO2MmHg;
            out.alveolar_po2_mmhg = s.alveolarPO2MmHg;
            out.paco2_mmhg = s.paco2MmHg;
        } };
}
