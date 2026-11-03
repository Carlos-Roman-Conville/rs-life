/** Formula atom counts and standard atomic weights (kg/mol), CIAAW:
 * https://ciaaw.org/atomic-weights.htm. Rounded representative values, not isotope masses.
 */
export declare const atomicMass: Record<string, number>;
/** Molar mass of a formula, kg/mol, rounded to 1e-9 so float summing noise never separates it from a row's literal:
 * the one weight set every substance row carries, so reactions conserve total mass. */
export declare function formulaMolarMass(formula: string): number;
/** Parse neutral formulas, including repeated atoms and nested parenthesized groups.
 * Unsupported notation is rejected rather than silently losing atoms.
 */
export declare function formulaAtoms(formula: string): Record<string, number>;
