/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  checkPlacement,
  reach,
  type Placement,
  PlacementConfigurationError,
} from "../../src/mechanics/reach.ts";

/** Labelled fixture: cells A, B, C; actors p1, p2; inv-A in A, inv-B in B, inv-C in C; reach edge A→B. */
const fixture = (): Placement => ({
  cells: ["A", "B", "C"],
  bodies: { p1: "A", p2: "B" },
  inventories: { "inv-A": "A", "inv-B": "B", "inv-C": "C" },
  edges: [{ from: "A", to: "B", kind: "reach" }],
});

const names = {
  actors: ["p1", "p2"],
  inventories: ["inv-A", "inv-B", "inv-C"],
};

describe("reach (5542)", () => {
  it("1. same cell: p1 in A, inv-A → reachable with fixture basis, source, and limitation", () => {
    const r = reach(fixture(), "p1", "inv-A");
    expect(r.result).toBe("reachable");
    expect(r.basis).toBe("fixture-adjacency");
    expect(r.source).toBe("fixture");
    expect(r.limitation).toBe("declared adjacency; no anatomical or obstacle claim");
    expect(r.missing).toBeUndefined();
  });

  it("2. edge: p1 in A, inv-B → reachable", () => {
    expect(reach(fixture(), "p1", "inv-B").result).toBe("reachable");
  });

  it("3. neither: p1 in A, inv-C → unreachable with no missing", () => {
    const r = reach(fixture(), "p1", "inv-C");
    expect(r.result).toBe("unreachable");
    expect(r.missing).toBeUndefined();
  });

  it("4. direction: p2 in B, inv-A unreachable unless edge is symmetric", () => {
    expect(reach(fixture(), "p2", "inv-A").result).toBe("unreachable");
    const symmetric: Placement = {
      ...fixture(),
      edges: [{ from: "A", to: "B", kind: "reach", symmetric: true }],
    };
    expect(reach(symmetric, "p2", "inv-A").result).toBe("reachable");
  });

  it("5. load check: checkPlacement throws naming each missing input, then passes for the full fixture", () => {
    const base = fixture();
    expect(() =>
      checkPlacement({ ...base, bodies: {} }, { actors: ["p1"], inventories: ["inv-A"] }),
    ).toThrow(PlacementConfigurationError);
    try {
      checkPlacement({ ...base, bodies: {} }, { actors: ["p1"], inventories: ["inv-A"] });
    } catch (e) {
      expect((e as PlacementConfigurationError).missing).toContain("bodies.p1: missing or invalid cell");
    }

    expect(() =>
      checkPlacement({ ...base, inventories: {} }, { actors: ["p1"], inventories: ["inv-A"] }),
    ).toThrow(PlacementConfigurationError);
    try {
      checkPlacement({ ...base, inventories: {} }, { actors: ["p1"], inventories: ["inv-A"] });
    } catch (e) {
      expect((e as PlacementConfigurationError).missing).toContain(
        "inventories.inv-A: missing or invalid cell",
      );
    }

    expect(() =>
      checkPlacement(
        { ...base, bodies: { ...base.bodies, p1: "Z" } },
        { actors: ["p1"], inventories: ["inv-A"] },
      ),
    ).toThrow(PlacementConfigurationError);
    try {
      checkPlacement(
        { ...base, bodies: { ...base.bodies, p1: "Z" } },
        { actors: ["p1"], inventories: ["inv-A"] },
      );
    } catch (e) {
      expect((e as PlacementConfigurationError).missing).toContain("bodies.p1: unknown cell Z");
    }

    expect(() =>
      checkPlacement(
        {
          ...base,
          edges: [{ from: "A", to: "nowhere", kind: "reach" }],
        },
        names,
      ),
    ).toThrow(PlacementConfigurationError);
    try {
      checkPlacement(
        {
          ...base,
          edges: [{ from: "A", to: "nowhere", kind: "reach" }],
        },
        names,
      );
    } catch (e) {
      expect((e as PlacementConfigurationError).missing.some(m => m.includes("nowhere"))).toBe(true);
    }

    expect(() => checkPlacement(fixture(), names)).not.toThrow();
  });

  it("6. run-time missing data: reach returns unknown with missing named, never unreachable", () => {
    const base = fixture();
    const noActorCell = reach({ ...base, bodies: { p2: "B" } }, "p1", "inv-A");
    expect(noActorCell.result).toBe("unknown");
    expect(noActorCell.missing).toContain("bodies.p1: missing or invalid cell");
    expect(noActorCell.result).not.toBe("unreachable");

    const noInvCell = reach({ ...base, inventories: { "inv-B": "B", "inv-C": "C" } }, "p1", "inv-A");
    expect(noInvCell.result).toBe("unknown");
    expect(noInvCell.missing).toContain("inventories.inv-A: missing or invalid cell");
    expect(noInvCell.result).not.toBe("unreachable");
  });

  it("7. no mutation: reach leaves a deep copy of the placement unchanged", () => {
    const placement = fixture();
    for (const actor of names.actors) {
      for (const inv of names.inventories) {
        const before = structuredClone(placement);
        reach(placement, actor, inv);
        expect(placement).toEqual(before);
      }
    }
  });

  it("8. two actors, one loaf: p1 and p2 both in A, inv-A → both reachable", () => {
    const shared: Placement = {
      ...fixture(),
      bodies: { p1: "A", p2: "A" },
    };
    expect(reach(shared, "p1", "inv-A").result).toBe("reachable");
    expect(reach(shared, "p2", "inv-A").result).toBe("reachable");
  });

  it("9. determinism and provenance: repeated calls deep-equal; every record has fixture basis and source", () => {
    const placement = fixture();
    const pairs: [string, string][] = [
      ["p1", "inv-A"],
      ["p1", "inv-B"],
      ["p2", "inv-C"],
    ];
    for (const [actor, inv] of pairs) {
      const a = reach(placement, actor, inv);
      const b = reach(placement, actor, inv);
      expect(a).toEqual(b);
      expect(a.basis).toBe("fixture-adjacency");
      expect(a.source).toBe("fixture");
    }
  });

  it("10. closed container: chest is its own zone; unreachable without A→chest edge, reachable when declared", () => {
    const closed: Placement = {
      ...fixture(),
      cells: ["A", "B", "C", "chest"],
      inventories: { ...fixture().inventories, "inv-chest": "chest" },
    };
    expect(reach(closed, "p1", "inv-chest").result).toBe("unreachable");
    const open: Placement = {
      ...closed,
      edges: [...closed.edges, { from: "A", to: "chest", kind: "reach" }],
    };
    expect(reach(open, "p1", "inv-chest").result).toBe("reachable");
  });
});
