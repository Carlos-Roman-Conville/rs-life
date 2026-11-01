/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const REALITY = [
  "elements",
  "registry",
  "graph",
  "world",
  "trace",
  "scheduler",
  "snapshot",
  "library",
  "physics",
  "reactions",
  "process",
  "atmosphere",
  "environment",
] as const;

const LIFE = new Set([
  "physiology",
  "nutrition",
  "circulation",
  "anatomy",
  "muscular",
  "neurology",
  "medicine",
  "crisis",
  "population",
  "ecology",
  "respiration",
  "exposure",
]);

/** Known Reality→Life imports until named SPLIT steps land. */
const EXCEPTIONS = new Set([
  "process->physiology", // until SPLIT step 2d
]);

const files = import.meta.glob("../src/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const IMPORT_RE = /from\s+"\.\/([^"]+\.ts)"/g;

function moduleStem(importPath: string): string {
  return importPath.replace(/\.ts$/, "");
}

function localImportStems(source: string): string[] {
  const stems: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) stems.push(moduleStem(match[1]!));
  return stems;
}

function sourceForModule(name: string): string {
  const suffix = `/src/${name}.ts`;
  const key = Object.keys(files).find((k) => k.replace(/\\/g, "/").endsWith(suffix));
  if (!key) throw new Error(`split-boundary: missing source for ${name}.ts`);
  return files[key]!;
}

describe("Reality/Life split boundary", () => {
  it("Reality never imports Life (2780)", () => {
    const violations: string[] = [];
    for (const mod of REALITY) {
      const stems = localImportStems(sourceForModule(mod));
      for (const stem of stems) {
        if (!LIFE.has(stem)) continue;
        const edge = `${mod}->${stem}`;
        if (EXCEPTIONS.has(edge)) continue;
        violations.push(edge);
      }
    }
    expect(violations).toEqual([]);
  });
});
