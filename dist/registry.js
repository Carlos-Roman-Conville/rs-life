/**
 * Service 1: the registry. Stable ids for substances (properties only, never behaviour), materials (what a component is
 * made of), components (equipment, organs, structures: a thermal mass with contents and ports) and assemblies.
 */
import substanceData from "../data/substances.json" with { type: "json" };
import materialData from "../data/materials.json" with { type: "json" };
export class Registry {
    substances = new Map();
    materials = new Map();
    components = new Map();
    addSubstance(s) { this.substances.set(s.id, s); return s; }
    addMaterial(m) { this.materials.set(m.id, m); return m; }
    addComponent(c) {
        if (!this.materials.has(c.material))
            throw new Error(`component ${c.id}: unknown material ${c.material}`);
        for (const x of c.contents)
            if (!this.substances.has(x.substance))
                throw new Error(`component ${c.id}: unknown substance ${x.substance}`);
        this.components.set(c.id, c);
        return c;
    }
    substance(id) { const s = this.substances.get(id); if (!s)
        throw new Error(`unknown substance ${id}`); return s; }
    material(id) { const m = this.materials.get(id); if (!m)
        throw new Error(`unknown material ${id}`); return m; }
    component(id) { const c = this.components.get(id); if (!c)
        throw new Error(`unknown component ${id}`); return c; }
    /** Thermal mass of a component with its contents, J/K. */
    heatCapacity(c) {
        let cap = c.mass * this.material(c.material).cp;
        for (const x of c.contents)
            cap += x.mass * (this.substance(x.substance).cp[x.phase] ?? 1000);
        return cap;
    }
    contentMass(c, substance, phase) {
        return c.contents.filter(x => x.substance === substance && (!phase || x.phase === phase)).reduce((a, x) => a + x.mass, 0);
    }
    /** Kahan carry per content entry: the low-order bits each `mass +=` rounded away, so thousands of equal small steps onto a
     * large mass (a horse's water, minute after minute for a month) do not drift one way past the ledger's 1e-9. */
    carry = new WeakMap();
    addContent(c, substance, phase, kg) {
        const x = c.contents.find(y => y.substance === substance && y.phase === phase);
        if (x) {
            const y = kg - (this.carry.get(x) ?? 0), t = x.mass + y;
            this.carry.set(x, (t - x.mass) - y);
            x.mass = t;
        }
        else
            c.contents.push({ substance, phase, mass: kg });
        if (x && x.mass < 1e-12) {
            x.mass = 0;
            this.carry.delete(x);
        }
    }
}
/**
 * The default substances and materials, loaded from data/substances.json and data/materials.json (each row cites its
 * source). A game's own data extends these.
 */
export function defaultRegistry() {
    const r = new Registry();
    for (const s of substanceData.rows)
        r.addSubstance(s);
    for (const m of materialData.rows)
        r.addMaterial(m);
    return r;
}
