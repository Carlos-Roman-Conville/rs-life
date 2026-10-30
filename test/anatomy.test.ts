import { describe, expect, it } from "vitest";
import { World } from "../src/world.ts";
import { defaultRegistry } from "../src/registry.ts";
import { bodyOutputs } from "../src/physiology.ts";
import { loseBlood } from "../src/circulation.ts";
import { stockPools } from "../src/nutrition.ts";
import { libraryTable } from "../src/library.ts";
import { anatomyProcess, anatomyRules, assembleBody, assemblyBreathing, assemblyCirculation, connectOrganInput, feedAssembly, speciesRmr, speciesProfile } from "../src/anatomy.ts";

function fixture(profile = speciesProfile(), mass = 70) {
  const w = new World(defaultRegistry());
  const b = w.registry.addComponent({ id: "body", kind: "body", material: "flesh", mass, temperatureC: profile.temperatureC,
    contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { male: 1 } });
  const a = assembleBody(w, b.id, profile), p = anatomyProcess(a);
  return { w, b, a, p, out: bodyOutputs(b) };
}

describe("anatomy assembly", () => {
  it("builds every human organ at 1 with valid graph ports, tissues and no duplicate body mass", () => {
    const { w, a, p, out } = fixture();
    assemblyCirculation(a).step(w, 60); p.step(w, 60);
    expect(Object.keys(a.organs)).toEqual(libraryTable("anatomy", "organs").map(r => r.id));
    for (const [id, state] of Object.entries(a.organs)) {
      expect(state.function).toBe(1); expect(out[id]).toBe(1);
      expect(w.registry.component(state.component).kind).toBe("organ");
      expect(w.graph.to(state.component, "fluid")).toHaveLength(1);
      expect(w.graph.from(state.component, "fluid")).toHaveLength(1);
    }
    for (const edge of w.graph.edges) {
      expect(w.registry.component(edge.from).ports.some(p => p.id === edge.fromPort && p.kind === edge.kind)).toBe(true);
      expect(w.registry.component(edge.to).ports.some(p => p.id === edge.toPort && p.kind === edge.kind)).toBe(true);
    }
    expect([...w.registry.components.values()].reduce((sum, c) => sum + c.mass, 0)).toBe(70);
    expect(a.crises).toEqual([]); expect(w.trace.failed()).toEqual([]);
    expect(Object.keys(anatomyRules("timescales"))).toHaveLength(6);
  });

  it("class IV immediately propagates the known brain perfusion and emits a crisis, preserving unsupported links", () => {
    const { w, b, a, p, out } = fixture();
    loseBlood(w, "body", b.props.circulation_initial_ml / 2);
    assemblyCirculation(a).step(w, 60); p.step(w, 60);
    expect(out.brain).toBe(0.5);
    expect(out.kidneys).toBeNull(); // Class IV has no numeric kidney perfusion row.
    expect(a.cascades.brain.statement).toBe(a.organs.brain.row["Failure cascade (model)"]);
    expect(a.cascades.brain.kineticsSeconds).toBeNull();
    expect(a.crises).toEqual([expect.objectContaining({ kind: "crisis", organ: "circulation.bleeding.iv" })]);
    w.t += 600; assemblyCirculation(a).step(w, 600); p.step(w, 600);
    expect(a.crises).toHaveLength(1); expect(a.crises[0].durationSeconds).toBe(600);
    expect(b.props.blood_volume_ml + w.trace.outOf("body", "volume:blood")).toBe(b.props.circulation_initial_ml);
    expect(w.trace.checks.length).toBeGreaterThan(0); expect(w.trace.failed()).toEqual([]);
  });

  it("class III exposes the kidney cascade without fabricating potassium kinetics", () => {
    const { w, a, p, out } = fixture();
    loseBlood(w, "body", 1500); assemblyCirculation(a).step(w, 60); p.step(w, 60);
    expect(out.kidneys).toBe(0.5); expect(out.intestines).toBe(0.3);
    expect(a.cascades.kidneys.statement).toContain("potassium up");
    expect(a.cascades.kidneys.kineticsSeconds).toBeNull();
  });

  it("builds the horse column without species code and refuses missing respiratory and Hb parameters", () => {
    const { w, a, p } = fixture(speciesProfile("A horse (example)"), 500);
    p.step(w, 0);
    expect(a.profile.bloodMlKg).toBe(80); expect(a.profile.temperatureC).toBe(38);
    expect(a.organs.intestines.massKg).toBeNull();
    // The library slots exist and are null until cited (flags/anatomy.md); the profile reads them, no species code.
    for (const r of libraryTable("anatomy", "organs"))
      for (const col of ["Mass (kg, Human default)", "Mass (kg, A horse (example))", "Cascade kinetics (s)"]) expect(r[col]).toBeNull();
    expect(Object.values(speciesProfile().organMassKg).every(m => m === null)).toBe(true);
    expect(speciesProfile().haemoglobinGDL).toBe(15); expect(speciesProfile().respiratory).not.toBeNull();
    expect(Object.values(a.organs).every(o => o.function === 1)).toBe(true);
    expect(() => assemblyBreathing(a, "room")).toThrow(/ventilation/);
    expect(() => assemblyCirculation(a)).toThrow(/haemoglobin/);
    const supplied = { ...speciesProfile("A horse (example)"), haemoglobinGDL: 12 }; // explicit host experiment
    const second = fixture(supplied, 500);
    expect(second.b.props.blood_volume_ml).toBe(40000);
    assemblyCirculation(second.a).step(second.w, 60);
    expect(second.out["circulation.quantities.haemoglobin"]).toBe(12);
  });

  it("fails missing organ rows before mutating the registry", () => {
    const { w } = fixture(), count = w.registry.components.size;
    const profile = speciesProfile(); profile.organs.push("nonexistent-organ");
    expect(() => assembleBody(w, "body", profile)).toThrow(/no row nonexistent-organ/);
    expect(w.registry.components.size).toBe(count);
  });

  it("reads inputs from graph edges and propagates explicit adequacies", () => {
    const { w, a, p, out } = fixture();
    connectOrganInput(w, a, "kidneys", a.organs.heart.component, "host-perfusion");
    bodyOutputs(w.registry.component(a.organs.heart.component))["host-perfusion"] = 0.4;
    p.step(w, 0); expect(out.kidneys).toBe(0.4);
    const supply = w.graph.to(a.organs.brain.component, "fluid")[0];
    w.graph.edges = w.graph.edges.filter(e => e.id !== supply.id);
    // Tissue input remains: disconnecting blood must not silently imply healthy perfusion.
    p.step(w, 0); expect(out.brain).toBeNull();
  });

  it("applies health times input adequacy, daily repair and crises without a death outcome", () => {
    const { w, a, p, out } = fixture();
    a.organs.brain.damage = 1; p.step(w, 0);
    expect(out.brain).toBe(0); expect(a.crises[0].kind).toBe("crisis");
    a.organs.liver.damage = 0.5; a.organs.liver.repairAllowed = true;
    p.step(w, 86399); expect(out.liver).toBe(0.5);
    w.t += 86400; p.step(w, 1); expect(out.liver).toBe(0.51);
    expect(out.brain).toBe(0); // nervous tissue has zero repair
    expect(a.crises[0].durationSeconds).toBe(86400);
    expect(a.crises.every(c => c.kind === "crisis")).toBe(true);
  });

  it("updates collagen daily from the nutrition pool and passes integrity along the graph", () => {
    const { w, a, p, out } = fixture(); stockPools(w, "body", { vit_c: 0 });
    p.step(w, 86399); expect(out.skin).toBe(1);
    p.step(w, 1); expect(out["anatomy.tissues.connective-tissue-collagen"]).toBe(0.98);
    expect(out.skin).toBe(0.98); expect(a.tissues["anatomy.tissues.muscle"].integrity).toBe(1);
  });

  it("reuses nutrition absorption and conserves retained nutrient and water transfers", () => {
    const normal = fixture(), impaired = fixture();
    impaired.a.organs.intestines.damage = 0.5; impaired.p.step(impaired.w, 0);
    const food = libraryTable("nutrition", "foods").find(r => String(r.id).includes("orange"));
    expect(food).toBeDefined();
    for (const f of [normal, impaired]) {
      stockPools(f.w, "body", { vit_c: 0 });
      f.b.contents.push({ substance: "water", phase: "liquid", mass: 0 });
      f.w.conserve("water", ["body"]);
      f.w.conserve("nutrient:vit_c", ["body"]);
      feedAssembly(f.w, f.a, [{ food: String(food!.id), kg: 0.1 }]);
      f.w.afterStep(); expect(f.w.trace.failed()).toEqual([]);
    }
    expect(impaired.b.props.intake_kcal).toBe(normal.b.props.intake_kcal / 2);
    expect(impaired.w.trace.into("body", "mass:water")).toBe(normal.w.trace.into("body", "mass:water") / 2);
  });
});


it("delegates the horse row's RMR to physiology with the supplied mass", () => {
  const profile = speciesProfile("A horse (example)");
  expect(profile.fields["anatomy.species.rmr-formula"]).toBe("Kleiber's law 70 x kg^0.75");
  expect(speciesRmr(profile, 500)).toBe(70 * Math.pow(500, 0.75));
  profile.fields["anatomy.species.rmr-formula"] = "80 x kg^0.5";
  expect(speciesRmr(profile, 500)).toBe(80 * Math.pow(500, 0.5));
  profile.fields["anatomy.species.rmr-formula"] = "unknown";
  expect(() => speciesRmr(profile, 500)).toThrow("unsupported RMR formula");
  expect(speciesRmr(speciesProfile(), 70)).toBeNull();
});
