/** MEDICINE.md from the library's `medicine` tables: diseases as courses, immunity, wounds and their healing clock, pain,
 * treatments by the "Really worked?" column only, and the air conditions of the `exposure` table. Time is days
 * (a day is 86,400 s of the world clock). Every random draw is seeded (`rng` from process.ts). A death risk that comes due
 * is a `crisis` record with its cause: the engine never kills, the host decides (`resolveCrisis`). Blood leaves a wound
 * through circulation's `bleed`, so the volume ledger stays traced. Numbers the tables do not carry are in FLAGS.md.
 */
import { gasTolerances } from "./respiration.js";
import { libraryColumns, libraryRow, libraryTable } from "./library.js";
import { bodyOutputs } from "./physiology.js";
import { bleed } from "./circulation.js";
import { rng } from "./process.js";
import { recordCrisis } from "./crisis.js";
const DAY = 86400;
const slug = (id) => String(id).split(".").pop();
const ROMAN = ["I", "II", "III", "IV"];
const COLLAGEN = "anatomy.tissues.connective-tissue-collagen";
// (2723) level 4 mapping: retain x3 at the first daily collagen loss below the
// nutrition threshold. No dose-response curve is available; see flags/medicine.md.
const collagenImpairedAt = 1 - Number(/integrity -([\d.]+)/.exec(String(libraryRow("anatomy", "tissues", COLLAGEN)["Integrity falls with"]))[1]);
const collagenImpaired = (integrity) => integrity !== undefined && integrity <= collagenImpairedAt;
/** Unsourced thresholds stay null. Late-stage signs must follow the impaired-collagen sign. */
export function collagenConsequenceThreshold(id) {
    const row = libraryRow("medicine", "collagen_consequences", `medicine.collagen_consequences.${id}`);
    const value = row.Value;
    if (value === null)
        return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= collagenImpairedAt) {
        const error = new Error(`medicine: ${row.id} must be a nonnegative integrity below collagenImpairedAt (${collagenImpairedAt})`);
        error.name = "CollagenConsequenceOrderError";
        throw error;
    }
    return value;
}
/** The rows of a medicine table by stable id. */
export const medicineRules = (table) => Object.fromEntries(libraryTable("medicine", table).map(r => [String(r.id), r]));
export const medicineColumns = (table) => libraryColumns("medicine", table);
const UNIT = { day: 1, days: 1, week: 7, weeks: 7 };
/** "7 to 14 bacillary", "2 to 4 weeks acute", "fever every 2nd day for 2 to 4 weeks", "0": a day range at the start or after "for". */
export function daysRange(text) {
    const m = /(?:^|\bfor )(\d+)(?: to (\d+))?\s*(days?|weeks?)?(?![\d])/.exec(String(text));
    if (!m)
        return null;
    const k = UNIT[m[3] ?? "days"];
    return { lo: Number(m[1]) * k, hi: Number(m[2] ?? m[1]) * k };
}
/** The death risk as a fraction range: the "of all cases" clause wins, else the first clause; "under 2%" is 0 to 2%. */
export function riskRange(text) {
    const clauses = String(text).split(";").map(s => s.trim());
    const c = clauses.find(s => /of all cases/.test(s)) ?? clauses[0];
    const under = /under (\d+(?:\.\d+)?)%/.exec(c);
    if (under)
        return { lo: 0, hi: Number(under[1]) / 100 };
    const m = /(\d+(?:\.\d+)?)(?: to (\d+(?:\.\d+)?))?%/.exec(c);
    return m ? { lo: Number(m[1]) / 100, hi: Number(m[2] ?? m[1]) / 100 } : null;
}
/** The point of a parsed range used by individual cases and expected-value aggregates. */
export const rangePoint = (r, p) => r.lo + p * (r.hi - r.lo);
/** A disease row read into numbers where the text has them; every other path is null (and flagged). */
export function diseaseCourse(id) {
    const row = libraryRow("medicine", "diseases", id);
    const course = daysRange(row["Course (days)"]);
    const years = /within (\d+) years/.exec(String(row["Untreated death risk"]));
    const rec = /recovery in (\d+) to (\d+) weeks/.exec(String(row["Course (days)"]));
    return { id, incubation: daysRange(row["Incubation (days)"]), course, risk: riskRange(row["Untreated death risk"]),
        riskWindowDays: course ? course.hi : years ? Number(years[1]) * 365 : null, lastingHarm: String(row["Lasting harm"]),
        recoveryDays: rec ? { lo: Number(rec[1]) * 7, hi: Number(rec[2]) * 7 } : null, row };
}
/** Exact expectation of expose/advanceDays when every untreated crisis is counted as a death.
 * Index 0 is exposure, before advancing. Incubation and course are uniform integer draws; a fatal
 * crisis is uniform on 1..course. Null means the row cannot place an individual course in time. */
export function diseaseOutcomeDays(d, risk) {
    if (!d.course || !d.incubation)
        return null;
    const days = Array.from({ length: d.incubation.hi + d.course.hi + 1 }, () => ({ death: 0, recovery: 0, ill: 0 }));
    const weight = 1 / ((d.incubation.hi - d.incubation.lo + 1) * (d.course.hi - d.course.lo + 1));
    for (let inc = d.incubation.lo; inc <= d.incubation.hi; inc++) {
        for (let course = d.course.lo; course <= d.course.hi; course++) {
            days[inc + course].recovery += weight * (1 - risk);
            for (let day = 1; day <= course; day++)
                days[inc + day].death += weight * risk / course;
            for (let day = 0; day < course; day++)
                days[inc + day].ill += weight * (1 - risk * day / course);
        }
    }
    return days;
}
/** The immunity row for a disease: the row id's tail is the disease or lists it (dysentery-typhoid-influenza). */
export function immunityRule(disease) {
    const d = disease.replace(/_/g, "-");
    const row = libraryTable("medicine", "immunity").find(r => { const s = slug(r.id); return s === d || s.split("-").includes(d); });
    if (!row)
        return { id: "", level: "none", fadesAfterDays: null, inoculation: false, row: {} };
    const after = String(row["After surviving"]);
    const level = /^lifelong/.test(after) ? "lifelong" : /^(partial|mostly)/.test(after) ? "partial" : "none";
    return { id: String(row.id), level, fadesAfterDays: /fades after a year/.test(after) ? 365 : null,
        inoculation: !/^(none|-)/.test(String(row.Inoculation)), row };
}
export function createMedicine(body, options = {}) {
    const riskAt = options.riskAt ?? 0.5;
    if (!(riskAt >= 0 && riskAt <= 1))
        throw new Error("medicine: riskAt must be in [0, 1]");
    return { body, rand: rng(options.seed ?? 1), day: 0, elapsedSeconds: 0, sick: [], wounds: [], immunity: {}, lastingHarm: {},
        crises: [], airActive: {}, options: { riskAt, dentate: options.dentate } };
}
const between = (rand, r) => r.lo + Math.floor(rand() * (Math.round(r.hi) - Math.round(r.lo) + 1));
function emit(s, cause, risk, source) {
    s.crises.push({ kind: "crisis", body: s.body, cause, startedAt: s.elapsedSeconds, durationSeconds: 0, day: s.day, risk, source });
}
/** Flush appended crises once, retaining object identity for resolveCrisis. On the
 * first call, w.t must correspond to s.elapsedSeconds; call before advancing to
 * bind a state created at a nonzero world time. Later flushes may be delayed. */
export function flushMedicineCrises(w, s) {
    s.crisisTimeOrigin ??= w.t - s.elapsedSeconds;
    let cursor = s.crisisTraceCursor ?? 0;
    while (cursor < s.crises.length) {
        const c = s.crises[cursor];
        c.startedAt += s.crisisTimeOrigin;
        recordCrisis(w, c);
        s.crisisTraceCursor = ++cursor;
    }
}
const QUARANTINE_CAUSE = /louse|person to person|droplet/;
/** The host supplies an exposure by disease id and a dose in [0, 1] (the chance this exposure takes; the library has no
 * dose-response). The engine draws incubation, course and the fate of the case (always the same four draws) from the row. */
export function expose(s, disease, dose, o = {}) {
    const c = diseaseCourse(disease);
    if (!(dose >= 0 && dose <= 1))
        throw new Error("medicine: dose must be in [0, 1]");
    const hygiene = o.hygiene ?? 1;
    if (!(hygiene >= 0))
        throw new Error("medicine: invalid hygiene multiplier");
    if (disease === "scurvy")
        return { infected: false, reason: "state-defined diagnosis" };
    const draws = [s.rand(), s.rand(), s.rand(), s.rand(), s.rand()];
    if (s.sick.some(x => x.id === disease))
        return { infected: false, reason: "already sick" };
    const imm = s.immunity[disease];
    if (imm?.level === "lifelong")
        return { infected: false, reason: "immune" };
    if (o.quarantine && claimActive("quarantine-and-airing-the-ship") && QUARANTINE_CAUSE.test(String(c.row["Cause (modern)"])))
        return { infected: false, reason: "quarantined" };
    if (!(draws[0] < Math.min(1, dose * hygiene)))
        return { infected: false, reason: "no dose" };
    const inc = o.incubationDays ?? (c.incubation ? between(() => draws[1], c.incubation) : null);
    if (inc === null)
        return { infected: false, reason: "unsupported incubation" };
    const courseDays = c.course ? between(() => draws[2], c.course) : null;
    const risk = c.risk ? rangePoint(c.risk, s.options.riskAt) : null;
    const window = courseDays ?? c.riskWindowDays;
    const fatal = risk !== null && draws[3] < risk;
    const sick = { id: disease, stage: inc === 0 ? "ill" : "incubating", dayOfStage: 0, incubationDays: inc, courseDays,
        fatalOnDay: fatal && window ? 1 + Math.floor(draws[4] * window) : null, endsOnDay: null, treated: false,
        timingUnsupported: fatal && !window, crisis: false };
    s.sick.push(sick);
    return { infected: true, reason: "infected", sick };
}
function recover(s, x) {
    s.sick.splice(s.sick.indexOf(x), 1);
    const rule = immunityRule(x.id);
    if (rule.level !== "none")
        s.immunity[x.id] = { disease: x.id, level: rule.level, sinceDay: s.day, fadesAfterDays: rule.fadesAfterDays, via: "survived" };
    const harm = diseaseCourse(x.id).lastingHarm;
    if (!/^none/.test(harm))
        s.lastingHarm[x.id] = harm;
}
/** What a clause of the column licenses. A claim is active only while its clause is in the row's text. */
const CLAIMS = {
    "peruvian-bark-cinchona": { clause: /^yes/, effect: "cure", helped: /cinchona/ },
    "lemon-or-lime-juice-fresh-greens": { clause: /^yes/, effect: "cure", helped: /citrus/ },
    "purging-and-emetics-jalap-senna-antimony-ipecacuanha": { clause: /worms yes/, effect: "cure", helped: /purges did pass/ },
    "amputation": { clause: /only cure for gangrene/, effect: "cure-now", helped: /amputation/ },
    "inoculation-variolation": { clause: /^yes/, effect: "immunise" },
    "quarantine-and-airing-the-ship": { clause: /^yes for lice-borne and person-to-person/, effect: "block-exposure" },
    "tourniquet-and-ligature": { clause: /^yes/, effect: "stop-bleeding" },
    "sweating-blistering-cautery": { clause: /cautery stopped bleeding/, effect: "stop-bleeding" },
    "washing-wounds-dry-lint-bandage-stitching": { clause: /^yes, partly/, effect: "unquantified" },
    "extracting-balls-and-splinters": { clause: /^yes if done early/, effect: "unquantified" },
    "splints-and-reduction": { clause: /^yes/, effect: "unquantified" },
    "opium-laudanum": { clause: /^yes for pain/, effect: "unquantified" },
};
const treatmentRow = (id) => libraryRow("medicine", "treatments", id.startsWith("medicine.") ? id : `medicine.treatments.${id}`);
function claimActive(id) {
    const claim = CLAIMS[id];
    return !!claim && claim.clause.test(String(treatmentRow(id)["Really worked?"]));
}
/** Every treatment row with the effect its column licenses (none for the rows that say no). */
export function treatmentEfficacy() {
    return Object.fromEntries(libraryTable("medicine", "treatments").map(r => {
        const id = slug(r.id);
        return [id, { text: String(r["Really worked?"]), effect: claimActive(id) ? CLAIMS[id].effect : null }];
    }));
}
/** Apply a treatment. It changes an outcome only where the column says it worked for that target; every other pairing is
 * recorded with efficacy "none" and nothing moves (and no random number is drawn). */
export function treat(s, treatment, target) {
    const id = slug(treatment), claim = CLAIMS[id], none = (detail) => ({ treatment: id, efficacy: "none", effect: null, detail });
    treatmentRow(id);
    if (!claim || !claimActive(id))
        return none("the column does not say it worked");
    if ("wound" in target) {
        const w = s.wounds[target.wound];
        if (!w)
            throw new Error("medicine: no such wound");
        if (claim.effect === "stop-bleeding") {
            w.bound = true;
            const tourniquet = /with tourniquet (IV|III|II|I)/.exec(String(libraryRow("medicine", "wounds", w.kind)["Bleeding class (see bleeding table)"]));
            if (tourniquet)
                w.bleedingClass = tourniquet[1];
            return { treatment: id, efficacy: "worked", effect: "stop-bleeding", detail: "bleeding stopped" };
        }
        if (claim.effect === "unquantified")
            return { treatment: id, efficacy: "unquantified", effect: "unquantified", detail: "the column says it helped but gives no size" };
        return none("not a wound treatment");
    }
    const disease = target.disease, row = libraryRow("medicine", "diseases", disease);
    if (disease === "scurvy")
        return none("scurvy follows collagen integrity; citrus intake belongs to nutrition, with no medicine cure clock");
    if (claim.effect === "immunise") {
        const rule = immunityRule(disease);
        if (!rule.inoculation || s.sick.some(x => x.id === disease) || s.immunity[disease])
            return none("no inoculation for this disease, or already sick or immune");
        const risk = Number(/about (\d+)% died of the inoculation/.exec(String(treatmentRow(id)["Really worked?"]))?.[1]) / 100;
        const draw = s.rand();
        if (draw < risk) {
            emit(s, `treatment:${id}:${disease}`, risk, `medicine.treatments.${id}: inoculation death risk`);
            return { treatment: id, efficacy: "worked", effect: "immunise", detail: "crisis: died of the inoculation" };
        }
        s.immunity[disease] = { disease, level: "lifelong", sinceDay: s.day, fadesAfterDays: null, via: "inoculation" };
        return { treatment: id, efficacy: "worked", effect: "immunise", detail: "immune" };
    }
    if (claim.effect === "block-exposure")
        return none("quarantine acts on exposure(), not on a case");
    const x = s.sick.find(k => k.id === disease);
    if (!x || !claim.helped || !claim.helped.test(String(row["What helped, really"])))
        return none("the disease row does not name it");
    x.treated = true;
    x.fatalOnDay = null;
    x.timingUnsupported = false;
    if (claim.effect === "cure-now") {
        recover(s, x);
        return { treatment: id, efficacy: "worked", effect: "cure-now", detail: "cured" };
    }
    const rec = diseaseCourse(disease).recoveryDays;
    if (rec && x.courseDays === null)
        x.endsOnDay = x.dayOfStage + between(s.rand, rec);
    return { treatment: id, efficacy: "worked", effect: "cure", detail: "untreated death risk cancelled" };
}
// ---------------------------------------------------------------- wounds
const classesOf = (text) => {
    const m = /^(IV|III|II|I)(?: to (IV|III|II|I))?/.exec(text);
    if (!m)
        return [];
    return ROMAN.slice(ROMAN.indexOf(m[1]), ROMAN.indexOf(m[2] ?? m[1]) + 1);
};
/** "bruise 7; simple fracture 42; open 60 to 90", "3 to 14 (concussion), skull fracture 60", "7 (superficial) to 60 (deep)". */
function healRange(text, variant) {
    const clean = text.replace(/\([^)]*\)/g, "");
    const parts = clean.split(/[;,]/).map(p => p.trim());
    const part = (variant && parts.find(p => p.includes(variant))) || parts[0];
    const m = /(\d+)(?: to (\d+))?/.exec(part);
    return { lo: Number(m[1]), hi: Number(m[2] ?? m[1]) };
}
/** The infection chance range: the open-wound figure when the wound is open, else the first. */
function infectionRange(text, open) {
    const num = (m) => ({ lo: Number(m[1]) / 100, hi: Number(m[2] ?? m[1]) / 100 });
    if (open) {
        const m = /open[^\d%;)]*(\d+)(?: to (\d+))?%/.exec(text) ?? /(\d+)(?: to (\d+))?%\s*\(?open/.exec(text);
        if (m)
            return num(m);
    }
    return num(/(\d+)(?: to (\d+))?%/.exec(text));
}
/** The pain table's cause examples that name a wound kind; kinds with no example (thrust, head blow) have no pain source. */
function defaultPainCause(kind, cls, variant) {
    switch (slug(kind)) {
        case "cut-incised": return cls === "I" ? "small cut" : "deep cut";
        case "gunshot-musket-ball-splinter": return "gunshot";
        case "blunt-bruise-fracture": return /fracture/.test(variant ?? "") ? "fracture" : "bruise";
        case "burn-and-scald": return "burn";
        case "crush-a-gun-a-cask-a-falling-yard": return "crushed limb";
        case "amputation-the-surgeons-wound": return "amputation";
        default: return null;
    }
}
function painBand(cause) {
    if (!cause)
        return null;
    return libraryTable("medicine", "pain").find(r => String(r["Cause examples"]).split(",").map(x => x.trim()).includes(cause)) ?? null;
}
export function inflictWound(s, kind, o = {}) {
    const row = libraryRow("medicine", "wounds", kind.startsWith("medicine.") ? kind : `medicine.wounds.${kind}`), id = String(row.id);
    if ((o.rateMlMin === undefined) !== (o.clotting === undefined))
        throw new Error("medicine: a wound rate needs the host's clotting, and the reverse");
    if (o.rateMlMin !== undefined && !(o.rateMlMin >= 0))
        throw new Error("medicine: invalid wound rate");
    const draws = [s.rand(), s.rand(), s.rand()];
    const text = String(row["Bleeding class (see bleeding table)"]), classes = classesOf(text);
    const severity = o.severity ?? draws[0];
    if (!(severity >= 0 && severity <= 1))
        throw new Error("medicine: severity must be in [0, 1]");
    const open = o.open ?? false;
    const inf = infectionRange(String(row["Infection chance untreated"]), open);
    const heal = healRange(String(row["Heals in (days, clean)"]), o.variant);
    const burn = /per (\d+)% of body burned/.exec(text);
    const w = { n: s.wounds.length, kind: id, bleedingClass: classes.length ? classes[Math.min(classes.length - 1, Math.floor(severity * classes.length))] : null,
        internal: /internal/.test(text), burnFluidClassIIUnits: burn && o.burnedPct !== undefined ? o.burnedPct / Number(burn[1]) : null,
        rateMlMin: o.rateMlMin ?? null, clotting: o.clotting ?? 0, bound: false, open, infected: o.infected ?? draws[2] < rangePoint(inf, s.options.riskAt),
        healDays: heal.lo + Math.floor(draws[1] * (heal.hi - heal.lo + 1)), progressDays: 0, healed: false, reopened: 0,
        painCause: null, workingPart: false, resting: false };
    w.painCause = o.painCause ?? defaultPainCause(id, w.bleedingClass, o.variant);
    s.wounds.push(w);
    return w;
}
const healRow = (slugId) => libraryRow("medicine", "healing", `medicine.healing.${slugId}`);
const mult = (r) => Number(/x([\d.]+)/.exec(String(r["Multiplier on healing time"]))[1]);
const limit = (r) => Number(/(?:under|over) (-?[\d.]+)/.exec(String(r.Factor))[1]);
/** The product of the factors that apply (multipliers on healing time); an absent input applies nothing. */
export function healingMultiplier(f) {
    let m = 1;
    const r = healRow("vitamin-c-reserve-under-300-mg-scurvy");
    if (collagenImpaired(f.collagenIntegrity))
        m *= mult(r);
    const p = healRow("protein-under-0-8-g-kg-day");
    if (f.proteinGKgDay !== undefined && f.proteinGKgDay < limit(p))
        m *= mult(p);
    const e = healRow("energy-balance-under-500-kcal-day");
    if (f.energyBalanceKcalDay !== undefined && f.energyBalanceKcalDay < limit(e))
        m *= mult(e);
    const a = healRow("age-over-50");
    if (f.ageYears !== undefined && f.ageYears > limit(a)) {
        const old = /x([\d.]+) over (\d+)/.exec(String(a["Multiplier on healing time"]));
        m *= f.ageYears > Number(old[2]) ? Number(old[1]) : mult(a);
    }
    if (f.rest)
        m *= mult(healRow("rest-no-duty-using-the-part"));
    if (f.workingPart)
        m *= mult(healRow("working-the-wounded-part"));
    if (f.dressedDaily)
        m *= mult(healRow("surgeon-skill-50-dressing-daily"));
    const d = healRow("sleep-debt-over-24-h");
    if (f.sleepDebtH !== undefined && f.sleepDebtH > limit(d))
        m *= mult(d);
    return m;
}
/** Factors the world already holds for a body: collagen integrity, the day's energy balance, the sleep debt. */
export function worldHealingFactors(w, body) {
    const b = w.registry.component(body), out = bodyOutputs(b), f = {};
    if (typeof out[COLLAGEN] === "number")
        f.collagenIntegrity = out[COLLAGEN];
    if (typeof out.energy_balance_day_kcal === "number")
        f.energyBalanceKcalDay = out.energy_balance_day_kcal;
    if (typeof out.sleep_debt === "number")
        f.sleepDebtH = out.sleep_debt;
    return f;
}
// ---------------------------------------------------------------- one day
/** Advance whole days: wounds heal at 1/multiplier of a day a day (paused while infected, reopening at the working-part
 * chance), diseases move through incubation and course, and a due death risk opens a crisis (the host decides). */
export function advanceDays(s, days, factors = {}) {
    const reopening = collagenConsequenceThreshold("reopen-healed-at-integrity");
    const toothLoss = collagenConsequenceThreshold("teeth-lost-at-integrity");
    s.collagenIntegrity = factors.collagenIntegrity;
    const reopened = new Set();
    if (reopening !== null && s.collagenIntegrity !== undefined) {
        const active = s.collagenIntegrity <= reopening;
        if (active && !s.collagenReopeningActive)
            for (const wound of s.wounds)
                if (wound.healed) {
                    wound.healed = false;
                    wound.progressDays = 0;
                    wound.reopened++;
                    reopened.add(wound);
                }
        s.collagenReopeningActive = active;
    }
    if (toothLoss !== null && s.options.dentate === true && s.collagenIntegrity !== undefined && s.collagenIntegrity <= toothLoss)
        s.teethLost = true;
    for (let i = 0; i < days; i++) {
        s.day++;
        s.elapsedSeconds += DAY;
        const reopen = Number(/reopen chance (\d+)%\/day/.exec(String(healRow("working-the-wounded-part")["Multiplier on healing time"]))[1]) / 100;
        for (const w of s.wounds) {
            if (i === 0 && reopened.has(w))
                continue;
            if (w.healed || w.infected)
                continue;
            const m = healingMultiplier({ ...factors, rest: w.resting || factors.rest, workingPart: w.workingPart || factors.workingPart });
            if (w.workingPart && s.rand() < reopen) {
                w.reopened++;
                w.progressDays = 0;
                continue;
            }
            w.progressDays += 1 / m;
            if (w.progressDays >= w.healDays)
                w.healed = true;
        }
        for (const x of [...s.sick]) {
            if (x.id === "scurvy" || x.crisis)
                continue; // Legacy cases cannot run a parallel scurvy clock.
            x.dayOfStage++;
            if (x.stage === "incubating") {
                if (x.dayOfStage >= x.incubationDays) {
                    x.stage = "ill";
                    x.dayOfStage = 0;
                }
                continue;
            }
            if (x.fatalOnDay === x.dayOfStage) {
                x.crisis = true;
                const risk = diseaseCourse(x.id).risk;
                emit(s, `disease:${x.id}`, risk ? rangePoint(risk, s.options.riskAt) : null, `medicine.diseases.${x.id}: untreated death risk`);
                continue;
            }
            if ((x.courseDays !== null && x.dayOfStage >= x.courseDays) || (x.endsOnDay !== null && x.dayOfStage >= x.endsOnDay))
                recover(s, x);
        }
        for (const [d, im] of Object.entries(s.immunity))
            if (im.fadesAfterDays !== null && s.day - im.sinceDay > im.fadesAfterDays)
                delete s.immunity[d];
    }
}
/** The host's decision on a crisis. "died" removes the case; "survived" lets the course go on. The engine kills no one. */
export function resolveCrisis(s, crisis, outcome) {
    crisis.resolved = outcome;
    const id = /^disease:(.+)$/.exec(crisis.cause)?.[1];
    const x = id ? s.sick.find(k => k.id === id && k.crisis) : undefined;
    if (!x)
        return;
    if (outcome === "died")
        s.sick.splice(s.sick.indexOf(x), 1);
    else
        x.crisis = false;
}
// ---------------------------------------------------------------- pain
/** The band of the worst open wound or gangrene: its id, range and midpoint. No source of pain is 0. */
export function painLevel(s) {
    const causes = [...s.wounds.filter(w => !w.healed).map(w => w.painCause), ...(s.sick.some(x => x.id === "gangrene") ? ["gangrene"] : [])];
    let best = null;
    for (const c of causes) {
        const row = painBand(c);
        if (!row)
            continue;
        const m = /(\d+) to (\d+)/.exec(String(row.Pain)), lo = Number(m[1]), hi = Number(m[2]);
        if (!best || hi > best.hi)
            best = { row, lo, hi };
    }
    return best ? { band: String(best.row.id), min: best.lo, max: best.hi, level: (best.lo + best.hi) / 2 } : { band: null, min: 0, max: 0, level: 0 };
}
const exposureRow = (id) => libraryRow("medicine", "exposure", `medicine.exposure.${id}`);
const first = (text, re) => Number(re.exec(String(text))[1]);
/** Each condition is a pattern of the body's states, never a timer. The stage counts the course thresholds crossed; hypoxia
 * under its death threshold, and respiratory failure, are the conditions that open a crisis. */
export function airConditions(s, a) {
    const out = {};
    const set = (id, stage) => { out[`medicine.exposure.${id}`] = stage; };
    const hyp = exposureRow("hypoxia-and-asphyxia-suffocation-the-foul-air"), hc = exposureRow("hypercapnia-the-close-air");
    const co = exposureRow("carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier");
    const smoke = exposureRow("smoke-inhalation-injury"), irr = exposureRow("irritant-injury-the-brimstone");
    const h2s = exposureRow("hydrogen-sulphide-poisoning-the-damp-the-sewer-gas"), alt = exposureRow("altitude-illness-the-mountain-sickness");
    const rf = exposureRow("respiratory-failure-the-end-state");
    const sao = a.sao2, hypLimit = first(hyp["The pattern that defines it"], /SaO2 under ([\d.]+)/);
    const [confused, unconscious, dead] = [/confusion at ([\d.]+)/, /unconscious at ([\d.]+)/, /death under ([\d.]+)/].map(re => first(hyp.Course, re));
    set("hypoxia-and-asphyxia-suffocation-the-foul-air", Math.max(a.airO2Pct !== undefined && a.airO2Pct < gasTolerances().hypoxiaO2Pct ? 1 : 0, sao === undefined || sao >= hypLimit ? 0 : 1 + Number(sao <= confused) + Number(sao <= unconscious) + Number(sao < dead)));
    const pco2 = first(hc["The pattern that defines it"], /PaCO2 over ([\d.]+)/), pct = gasTolerances().hypercapniaCo2Pct;
    const [conf, narc] = [/confusion at ([\d.]+)%/, /narcosis ([\d.]+)/].map(re => first(hc.Course, re));
    const hcOn = (a.paco2Mmhg !== undefined && a.paco2Mmhg > pco2) || (a.airCo2Pct !== undefined && a.airCo2Pct > pct);
    set("hypercapnia-the-close-air", !hcOn ? 0 : 1 + Number((a.airCo2Pct ?? 0) >= conf) + Number((a.airCo2Pct ?? 0) >= narc));
    set("carbon-monoxide-poisoning-the-charcoal-sickness-the-brazier", a.cohb !== undefined && a.cohb > first(co["The pattern that defines it"], /COHb over ([\d.]+)%/) / 100 ? 1 : 0);
    set("smoke-inhalation-injury", a.smokeMgM3 !== undefined && a.smokeMgM3 > first(smoke["The pattern that defines it"], /smoke over ([\d.]+) mg/) ? 1 : 0);
    const so2 = first(irr["The pattern that defines it"], /SO2 over ([\d.]+) ppm/), h2sIrr = first(irr["The pattern that defines it"], /H2S over ([\d.]+) ppm/);
    set("irritant-injury-the-brimstone", (a.so2Ppm ?? 0) > so2 || (a.h2sPpm ?? 0) > h2sIrr ? 1 : 0);
    const [smellGone, knockdown] = [/H2S over ([\d.]+) ppm/, /over ([\d.]+) the knockdown/].map(re => first(h2s["The pattern that defines it"], re));
    set("hydrogen-sulphide-poisoning-the-damp-the-sewer-gas", a.h2sPpm === undefined || a.h2sPpm <= smellGone ? 0 : a.h2sPpm >= knockdown ? 2 : 1);
    set("altitude-illness-the-mountain-sickness", a.lowPressureDays && sao !== undefined && sao < first(alt["The pattern that defines it"], /SaO2 under ([\d.]+)/) ? 1 : 0);
    const rfSao = first(rf["The pattern that defines it"], /SaO2 under ([\d.]+)/), rfCo2 = first(rf["The pattern that defines it"], /PaCO2 over ([\d.]+)/);
    set("respiratory-failure-the-end-state", a.driveFailing && ((sao !== undefined && sao < rfSao) || (a.paco2Mmhg !== undefined && a.paco2Mmhg > rfCo2)) ? 1 : 0);
    for (const id of ["hypoxia-and-asphyxia-suffocation-the-foul-air", "respiratory-failure-the-end-state"]) {
        const key = `medicine.exposure.${id}`, due = id.startsWith("hypoxia") ? out[key] >= 4 : out[key] >= 1;
        if (due && !s.airActive[key]) {
            s.airActive[key] = 1;
            emit(s, `exposure:${id}`, null, key);
        }
        if (!due)
            delete s.airActive[key];
    }
    return out;
}
// ---------------------------------------------------------------- outputs and the process
/** Everything by library id: the stage of each disease (0 well, 1 incubating, 2 ill), open and infected wounds by kind, the
 * pain band and level, lasting-harm flags, immunity, and the crisis count. */
export function medicineOutputs(s) {
    const o = {};
    for (const r of libraryTable("medicine", "diseases")) {
        const id = String(r.id), x = s.sick.find(k => k.id === id);
        o[`medicine.diseases.${id}`] = id === "scurvy" ? (collagenImpaired(s.collagenIntegrity) ? 2 : 0) : x ? (x.stage === "ill" ? 2 : 1) : 0;
        o[`medicine.lasting_harm.${id}`] = s.lastingHarm[id] ? 1 : 0;
        o[`medicine.immunity.${id}`] = s.immunity[id] ? s.immunity[id].level === "lifelong" ? 2 : 1 : 0;
    }
    for (const r of libraryTable("medicine", "wounds")) {
        const id = String(r.id), mine = s.wounds.filter(w => w.kind === id && !w.healed);
        o[id] = mine.length;
        o[`${id}.infected`] = mine.filter(w => w.infected).length;
    }
    const pain = painLevel(s);
    for (const r of libraryTable("medicine", "pain"))
        o[String(r.id)] = r.id === pain.band ? 1 : 0;
    o["medicine.pain"] = pain.level;
    o["medicine.signs.gum_bleeding"] = s.options.dentate === undefined ? null
        : Number(s.options.dentate && collagenImpaired(s.collagenIntegrity));
    o["medicine.signs.teeth_lost"] = Number(s.teethLost === true);
    o["medicine.sick_count"] = s.sick.filter(x => x.id !== "scurvy").length + Number(collagenImpaired(s.collagenIntegrity));
    o["medicine.crises"] = s.crises.length;
    return o;
}
/** Run after circulation and anatomy: open wounds with a host rate bleed through circulation's `bleed` (traced and checked there), the
 * disease and healing clocks advance a day at a time, and the outputs are published on the body. */
export function medicineProcess(s, factors = {}, every = 1) {
    return { name: "medicine", every, step(w, dt) {
            if (!Number.isFinite(dt) || dt < 0)
                throw new Error("medicine: invalid time");
            const currentFactors = { ...worldHealingFactors(w, s.body), ...factors };
            flushMedicineCrises(w, s);
            for (const x of s.wounds)
                if (!x.healed && x.rateMlMin !== null)
                    bleed(w, s.body, x.rateMlMin, dt, x.clotting, x.bound);
            const endSeconds = s.elapsedSeconds + dt;
            const days = Math.floor(endSeconds / DAY) - Math.floor(s.elapsedSeconds / DAY);
            if (days) {
                s.elapsedSeconds = Math.floor(s.elapsedSeconds / DAY) * DAY;
                advanceDays(s, days, currentFactors);
            }
            else
                advanceDays(s, 0, currentFactors); // Signs and crossings also update on input-change events.
            s.elapsedSeconds = endSeconds;
            flushMedicineCrises(w, s);
            const out = bodyOutputs(w.registry.component(s.body));
            const value = (id) => typeof out[id] === "number" ? out[id] : undefined;
            const o2 = value("o2_frac"), co2 = value("co2_ppm");
            Object.assign(out, airConditions(s, {
                airO2Pct: o2 === undefined ? undefined : o2 * 100,
                airCo2Pct: co2 === undefined ? undefined : co2 / 1e4,
                sao2: value("sao2"), paco2Mmhg: value("paco2_mmhg"), cohb: value("cohb"),
            }), medicineOutputs(s));
            flushMedicineCrises(w, s);
        } };
}
