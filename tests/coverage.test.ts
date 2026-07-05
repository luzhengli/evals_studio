// Capability × tier coverage matrix (B40/A30/E20/R10) and gap analysis.

import { describe, expect, test } from "bun:test";
import { computeCoverage, nextTierSuggestion } from "../src/eval/coverage.ts";
import type { Sample, SampleTier } from "../src/core/types.ts";

let n = 0;
const sample = (capability: string | null, tier: SampleTier | null): Sample => ({
  id: `s${n++}`,
  sampleSetId: "set",
  name: `sample-${n}`,
  input: "x",
  capability,
  tier,
  groundTruth: null,
  expectedTrajectory: [],
  expectedSkill: null,
  expectedSideEffects: [],
  tags: [],
  source: "manual",
  freshAsOf: Date.now(),
  contamination: { audited: false, auditedAt: null, verdict: null, notes: "" },
  mockSpec: null,
  createdAt: Date.now(),
});

describe("coverage matrix", () => {
  test("counts cells per capability × tier and lists sample ids", () => {
    const samples = [
      sample("fmt", "B"),
      sample("fmt", "B"),
      sample("fmt", "A"),
      sample("safety", "R"),
    ];
    const r = computeCoverage("set", samples);
    expect(r.capabilities).toEqual(["fmt", "safety"]);
    const cell = r.cells.find((c) => c.capability === "fmt" && c.tier === "B")!;
    expect(cell.count).toBe(2);
    expect(cell.sampleIds).toHaveLength(2);
    // 2 capabilities × 4 tiers = 8 cells always materialized
    expect(r.cells).toHaveLength(8);
  });

  test("tier distribution measured against B40/A30/E20/R10 targets", () => {
    // 4B 3A 2E 1R = exact target mix
    const samples = [
      ...Array.from({ length: 4 }, () => sample("c", "B")),
      ...Array.from({ length: 3 }, () => sample("c", "A")),
      ...Array.from({ length: 2 }, () => sample("c", "E")),
      sample("c", "R"),
    ];
    const r = computeCoverage("set", samples);
    for (const d of r.tiers) expect(d.deviation).toBe(0);
    expect(r.gaps.filter((g) => g.kind === "tier-deficit")).toHaveLength(0);
  });

  test("gaps: empty cells, tier deficits and untagged samples", () => {
    const samples = [sample("fmt", "B"), sample("fmt", "B"), sample("fmt", "B"), sample(null, null)];
    const r = computeCoverage("set", samples);
    expect(r.untagged).toBe(1);
    // fmt has no A/E/R samples → 3 empty cells
    expect(r.gaps.filter((g) => g.kind === "empty-cell")).toHaveLength(3);
    // everything is B → A/E deficits beyond tolerance (R misses by exactly 10 = tolerance)
    const deficits = r.gaps.filter((g) => g.kind === "tier-deficit").map((g) => g.tier);
    expect(deficits).toContain("A");
    expect(deficits).toContain("E");
    expect(r.gaps.some((g) => g.kind === "untagged")).toBe(true);
  });

  test("nextTierSuggestion points at the largest deficit", () => {
    const samples = [sample("c", "B"), sample("c", "B"), sample("c", "A")];
    const r = computeCoverage("set", samples);
    // E and R are both at 0; E has the larger target so the larger deficit
    expect(nextTierSuggestion(r)).toBe("E");
  });

  test("empty set: no capabilities, no spurious gaps except nothing", () => {
    const r = computeCoverage("set", []);
    expect(r.total).toBe(0);
    expect(r.cells).toHaveLength(0);
    expect(r.gaps).toHaveLength(0);
  });
});
