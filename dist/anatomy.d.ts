/** Organ assemblies on the same registry/graph as the still. Blood, gas and food
 * transfers remain owned by circulation, atmosphere and nutrition. Graph signals
 * are adequacies, not transfers of fictitious blood or nutrient mass.
 */
import { type LibraryRow } from "./library.ts";
import { type RespiratoryProfile } from "./respiration.ts";
import { type CirculationOptions } from "./circulation.ts";
import { type MealItem, type MealOptions } from "./nutrition.ts";
import type { Process } from "./scheduler.ts";
import type { World } from "./world.ts";
import { type Crisis } from "./crisis.ts";
import { type HealingFactors } from "./medicine.ts";
export type AnatomyTable = "organs" | "tissues" | "damage_function" | "timescales" | "species";
export declare const anatomyRules: (table: AnatomyTable) => {
    [k: string]: LibraryRow;
};
export interface SpeciesProfile {
    fields: Record<string, string | number | boolean | null>;
    organs: string[];
    organMassKg: Record<string, number | null>;
    bloodMlKg: number;
    cardiacOutputLMinKg: number;
    temperatureC: number;
    haemoglobinGDL: number | null;
    respiratory: RespiratoryProfile | null;
}
/** Species differences come from columns, never a species switch in the process.
 * Organ masses, Hb and maximal ventilation are read from the library's slots; a null
 * slot (no cited source) stays null and the host can supply a profile.
 */
export declare function speciesProfile(column?: "Human default" | "A horse (example)"): SpeciesProfile;
/** Delegate the species cell to physiology; human measurements are unavailable here, so its rate is null. */
export declare function speciesRmr(profile: SpeciesProfile, massKg: number): number | null;
export interface OrganState {
    component: string;
    row: LibraryRow;
    damage: number;
    function: number | null;
    massKg: number | null;
    /** Host supplies quantified insults/resistance; low function alone has no damage rate. */
    insult: number;
    resistance: number;
    repairAllowed: boolean;
}
export interface BodyAssembly {
    body: string;
    profile: SpeciesProfile;
    organs: Record<string, OrganState>;
    tissues: Record<string, {
        row: LibraryRow;
        integrity: number;
        component: string;
    }>;
    crises: Crisis[];
    /** Qualitative source rows, never a fabricated potassium concentration or hazard;
     * kineticsSeconds is the organ row's cited cascade timescale, null while none is cited. */
    cascades: Record<string, {
        statement: string;
        kineticsSeconds: number | null;
    }>;
    signals: Record<string, {
        component: string;
        output: string;
    }>;
    elapsedSeconds: number;
}
/** Adds an assembly to an existing host body. Zero-mass shells are views into the
 * body's existing mass, not extra thermal tissue. Unknown organ masses stay null.
 */
export declare function assembleBody(w: World, body: string, profile?: SpeciesProfile): BodyAssembly;
/** Wire a quantified adequacy from any graph component (including another organ).
 * Dependencies alone do not imply that potassium adequacy equals kidney function.
 */
export declare function connectOrganInput(w: World, a: BodyAssembly, organ: string, source: string, output: string): void;
/** Run after circulation/breathing and on input-change events (dt=0 supported).
 * Daily damage uses only explicit insults. Repair needs an explicit nutrition gate.
 */
export declare function anatomyProcess(a: BodyAssembly, factors?: HealingFactors): Process;
/** Shared process factories: no duplicated gas exchange or perfusion formula. */
export declare function assemblyCirculation(a: BodyAssembly, options?: CirculationOptions): Process;
export declare function assemblyBreathing(a: BodyAssembly, room: string): Process;
/** Intestines' absorption x function rule; nutrition owns all food transfers. */
export declare function feedAssembly(w: World, a: BodyAssembly, meal: MealItem[], options?: MealOptions): void;
