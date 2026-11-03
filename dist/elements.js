/** Formula atom counts and standard atomic weights (kg/mol), CIAAW:
 * https://ciaaw.org/atomic-weights.htm. Rounded representative values, not isotope masses.
 */
export const atomicMass = {
    H: .001008, C: .012011, N: .014007, O: .015999, S: .03206,
    K: .039098, Ca: .040078, Hg: .20059, Pb: .2072, Fe: .055845, Cu: .063546,
};
/** Molar mass of a formula, kg/mol, rounded to 1e-9 so float summing noise never separates it from a row's literal:
 * the one weight set every substance row carries, so reactions conserve total mass. */
export function formulaMolarMass(formula) {
    let kg = 0;
    for (const [el, n] of Object.entries(formulaAtoms(formula))) {
        const w = atomicMass[el];
        if (w === undefined)
            throw new Error(`no atomic weight for ${el} in ${formula}`);
        kg += w * n;
    }
    return Math.round(kg * 1e9) / 1e9;
}
/** Parse neutral formulas, including repeated atoms and nested parenthesized groups.
 * Unsupported notation is rejected rather than silently losing atoms.
 */
export function formulaAtoms(formula) {
    let i = 0;
    function count() {
        const digits = /^\d+/.exec(formula.slice(i))?.[0];
        if (!digits)
            return 1;
        i += digits.length;
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n <= 0)
            throw new Error(`invalid formula ${formula}`);
        return n;
    }
    function group(nested) {
        const atoms = {};
        while (i < formula.length && formula[i] !== ")") {
            let part;
            if (formula[i] === "(") {
                i++;
                part = group(true);
            }
            else {
                const el = /^[A-Z][a-z]?/.exec(formula.slice(i))?.[0];
                if (!el)
                    throw new Error(`invalid formula ${formula}`);
                i += el.length;
                part = { [el]: 1 };
            }
            const n = count();
            for (const [el, value] of Object.entries(part))
                atoms[el] = (atoms[el] ?? 0) + value * n;
        }
        if (!Object.keys(atoms).length || (nested && formula[i++] !== ")"))
            throw new Error(`invalid formula ${formula}`);
        return atoms;
    }
    const atoms = group(false);
    if (i !== formula.length)
        throw new Error(`invalid formula ${formula}`);
    return atoms;
}
