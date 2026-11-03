import data from "../data/reactions.json" with { type: "json" };
import { C_TO_K, R_GAS } from "./physics.js";
import { formulaAtoms } from "./elements.js";
export const defaultReactions = data.reactions;
/** Heat per kg of the first reactant (the fuel), J/kg, same sign as `heat`; derived from the row, never stored. */
export function heatPerKg(reg, reaction) {
    const fuel = reaction.reactants[0];
    return reaction.heat / (fuel.coefficient * reg.substance(fuel.substance).molarMass);
}
function validate(reg, reaction) {
    if (!reaction.reactants.length || !reaction.products.length || !Number.isFinite(reaction.heat)
        || !Number.isFinite(reaction.conditions.minimumTemperatureC) || reaction.conditions.minimumTemperatureC <= -C_TO_K
        || !reaction.source)
        throw new Error(`invalid reaction ${reaction.id}`);
    const balance = {};
    for (const [side, sign] of [[reaction.reactants, -1], [reaction.products, 1]]) {
        const seen = new Set();
        for (const term of side) {
            const key = `${term.substance}:${term.phase}`;
            if (seen.has(key) || !Number.isFinite(term.coefficient) || term.coefficient <= 0)
                throw new Error(`invalid reagent in ${reaction.id}`);
            seen.add(key);
            const s = reg.substance(term.substance);
            if (!(s.molarMass > 0) || !(s.cp[term.phase] > 0))
                throw new Error(`missing thermal data for ${key}`);
            for (const [el, n] of Object.entries(formulaAtoms(s.formula)))
                balance[el] = (balance[el] ?? 0) + sign * n * term.coefficient;
        }
    }
    if (Object.values(balance).some(n => Math.abs(n) > 1e-10))
        throw new Error(`unbalanced reaction ${reaction.id}`);
    if (reaction.conditions.catalyst)
        reg.substance(reaction.conditions.catalyst);
    const minO2 = reaction.conditions.minO2;
    if (minO2 !== undefined) {
        const sourced = typeof reaction.minO2Source === "string" && reaction.minO2Source.startsWith("https://");
        if (!(minO2 > 0 && minO2 <= 1) || (!sourced && (reaction.minO2Source !== null || !reaction.conditions.note.includes("[model]"))))
            throw new Error(`invalid oxygen condition ${reaction.id}`);
    }
    const rate = reaction.rate;
    if (rate.kind === "arrhenius" && (!(rate.k0PerS >= 0) || !Number.isFinite(rate.k0PerS)
        || !(rate.activationEnergyJPerMol >= 0) || !Number.isFinite(rate.activationEnergyJPerMol) || !rate.source))
        throw new Error(`invalid kinetics ${reaction.id}`);
    if (rate.kind !== "arrhenius" && (rate.kind !== "complete" || !rate.note.includes("[model]")))
        throw new Error(`missing rate model ${reaction.id}`);
}
/** Oxygen volume fraction of a vessel's gas: o2 moles over all gas moles (ideal gas, so mole and volume fractions agree). */
function oxygenFraction(reg, v) {
    const { o2, total } = gasMoles(reg, v);
    return total > 0 ? o2 / total : 0;
}
function gasMoles(reg, v) {
    let o2 = 0, total = 0;
    for (const x of v.contents)
        if (x.phase === "gas") {
            const n = x.mass / reg.substance(x.substance).molarMass;
            total += n;
            if (x.substance === "o2")
                o2 += n;
        }
    return { o2, total };
}
/** Largest extent that leaves the vessel's oxygen fraction at minO2 or above: (o2 + d x) / (total + dn x) = minO2,
 * d and dn being the reaction's gas o2 and gas mole change per extent. Infinity when the reaction cannot lower the fraction. */
function oxygenFloorExtent(reg, v, reaction, minO2) {
    const gas = (terms, only) => terms.reduce((s, x) => s + (x.phase === "gas" && (only === undefined || x.substance === only) ? x.coefficient : 0), 0);
    const d = gas(reaction.products, "o2") - gas(reaction.reactants, "o2");
    const dn = gas(reaction.products) - gas(reaction.reactants);
    const { o2, total } = gasMoles(reg, v), slope = minO2 * dn - d;
    return slope > 0 ? Math.max(0, (o2 - minO2 * total) / slope) : Infinity;
}
/** Vessel reactions, in record order. Reactants/catalysts must be inside the vessel.
 * k = k0 exp(-Ea/RT): https://goldbook.iupac.org/terms/view/A00446
 * [model] First-order limiting-reagent extent, integrated at frozen step temperature:
 * extent = available * (1-exp(-k dt)); complete fallback is explicitly marked in each record.
 * Hess's law and constant-cp sensible enthalpy, relative to 298.15 K (25 C):
 * https://srd.nist.gov/JPCRD/jpcrdS2Vol11.pdf and each record's formation enthalpies.
 * Endothermic extent is also limited by sensible heat above the minimum temperature.
 * conditions.minO2 is the oxygen volume fraction of the vessel's gas under which the reaction does not run,
 * and a floor: a step's extent is capped so the vessel's oxygen fraction does not fall below it.
 * Named simplifications: constant heat capacities, irreversible reactions, threshold ignition,
 * perfect mixing, no pressure/equilibrium kinetics, instantaneous gas transport along the first
 * outgoing gas edge (no edge means retained gas). Gas carries sensible enthalpy to its receiver.
 */
export function reactionProcess(vessel, reactions = defaultReactions) {
    return { name: "reactions", every: 1, step(w, dt) {
            if (!Number.isFinite(dt) || dt < 0)
                throw new Error("invalid reaction timestep");
            if (dt === 0)
                return;
            const reg = w.registry, v = reg.component(vessel);
            // Validate all records before mutating anything, including unknown substances and unbalanced equations.
            for (const reaction of reactions)
                validate(reg, reaction);
            const edge = w.graph.from(vessel, "gas")[0];
            const receiver = edge ? reg.component(edge.to) : undefined;
            for (const reaction of reactions) {
                const min = reaction.conditions.minimumTemperatureC;
                if (v.temperatureC < min)
                    continue;
                if (reaction.conditions.catalyst && reg.contentMass(v, reaction.conditions.catalyst) <= 0)
                    continue;
                if (reaction.conditions.minO2 !== undefined && oxygenFraction(reg, v) < reaction.conditions.minO2)
                    continue;
                let extent = Math.min(...reaction.reactants.map(x => reg.contentMass(v, x.substance, x.phase) / (reg.substance(x.substance).molarMass * x.coefficient)));
                if (extent <= 0)
                    continue;
                if (reaction.rate.kind === "arrhenius") {
                    const k = reaction.rate.k0PerS * Math.exp(-reaction.rate.activationEnergyJPerMol / (R_GAS * (v.temperatureC + C_TO_K)));
                    extent *= -Math.expm1(-k * dt);
                }
                if (reaction.conditions.minO2 !== undefined)
                    extent = Math.min(extent, oxygenFloorExtent(reg, v, reaction, reaction.conditions.minO2));
                if (extent <= 0)
                    continue;
                const cap = reg.heatCapacity(v);
                if (!(cap > 0))
                    throw new Error(`no heat capacity in ${vessel}`);
                const molarCapacity = (terms) => terms.reduce((sum, x) => {
                    const s = reg.substance(x.substance);
                    return sum + x.coefficient * s.molarMass * s.cp[x.phase];
                }, 0);
                const deltaCap = molarCapacity(reaction.products) - molarCapacity(reaction.reactants);
                const energyPerMolAtMin = reaction.heat + deltaCap * (min - 25);
                if (reaction.heat > 0 && energyPerMolAtMin > 0)
                    extent = Math.min(extent, cap * Math.max(0, v.temperatureC - min) / energyPerMolAtMin);
                if (extent <= 0)
                    continue;
                const sensible = cap * (v.temperatureC - 25) - extent * reaction.heat;
                const process = `reaction:${reaction.id}`, reservoir = `chemical:${reaction.id}`;
                for (const [terms, sign] of [[reaction.reactants, -1], [reaction.products, 1]])
                    for (const x of terms) {
                        const kg = extent * x.coefficient * reg.substance(x.substance).molarMass;
                        reg.addContent(v, x.substance, x.phase, sign * kg);
                        w.trace.record({ t: w.t, process, quantity: `mass:${x.substance}`, from: sign < 0 ? vessel : reservoir,
                            to: sign < 0 ? reservoir : vessel, amount: kg, chemicalChange: true });
                    }
                v.temperatureC = 25 + sensible / reg.heatCapacity(v);
                const heat = -extent * reaction.heat;
                w.trace.record({ t: w.t, process, quantity: "energy", from: heat >= 0 ? reservoir : vessel,
                    to: heat >= 0 ? vessel : reservoir, amount: Math.abs(heat), note: `reaction enthalpy; ${extent} mol; ${reaction.source}` });
                if (!receiver || receiver === v)
                    continue;
                for (const x of reaction.products.filter(x => x.phase === "gas")) {
                    const s = reg.substance(x.substance), kg = extent * x.coefficient * s.molarMass;
                    const carried = kg * s.cp.gas * (v.temperatureC - 25);
                    const oldEnergy = reg.heatCapacity(receiver) * (receiver.temperatureC - 25);
                    reg.addContent(v, x.substance, "gas", -kg);
                    reg.addContent(receiver, x.substance, "gas", kg);
                    receiver.temperatureC = 25 + (oldEnergy + carried) / reg.heatCapacity(receiver);
                    w.trace.record({ t: w.t, process, quantity: `mass:${x.substance}`, from: vessel, to: receiver.id, amount: kg });
                    w.trace.record({ t: w.t, process, quantity: "energy", from: vessel, to: receiver.id, amount: carried, note: "gas sensible enthalpy relative to 25 C" });
                }
            }
        } };
}
