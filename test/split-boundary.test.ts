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

const files = import.meta.glob(["../src/*.ts", "../src/mechanics/*.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const IMPORT_RE = /from\s+"(\.\.?\/[^"\n]+\.ts)"/g;

function moduleStem(importPath: string): string {
  return importPath.replace(/\.ts$/, "");
}

function localImportStems(source: string, mod: string): string[] {
  const stems: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const parts = mod.split("/").slice(0, -1);
    for (const part of moduleStem(match[1]!).split("/")) {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
    }
    stems.push(parts.join("/"));
  }
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
    const mechanics = Object.keys(files)
      .map(path => path.replace(/\\/g, "/"))
      .filter(path => path.startsWith("../src/mechanics/"))
      .map(path => moduleStem(path.slice("../src/".length)));
    for (const mod of [...REALITY, ...mechanics]) {
      const stems = localImportStems(sourceForModule(mod), mod);
      for (const stem of stems) {
        if (!LIFE.has(stem)) continue;
        const edge = `${mod}->${stem}`;
        violations.push(edge);
      }
    }
    expect(violations).toEqual([]);
  });
});
