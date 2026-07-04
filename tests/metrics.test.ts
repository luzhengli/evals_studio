import { describe, expect, test } from "bun:test";
import { mean, metricVector, passKVector, stat, stddev } from "../src/eval/metrics.ts";
import type { Run } from "../src/core/types.ts";

const run = (sampleId: string, pass: boolean, scores: Record<string, number> = {}): Run => ({
  id: `r-${Math.random()}`,
  experimentId: "e",
  sampleId,
  arm: "candidate",
  attempt: 1,
  output: "",
  selectedSkill: null,
  grading: {
    assertions: Object.entries(scores).map(([metric, score]) => ({
      name: metric,
      kind: "exact-match",
      metric: metric as any,
      pass: score >= 0.5,
      score,
      evidence: "",
    })),
    sideEffect: null,
    pass,
  },
  timing: { durationMs: 10 },
  tokens: { input: 1, output: 1 },
  error: null,
  createdAt: 0,
});

describe("stats", () => {
  test("mean/stddev", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    expect(stddev([1])).toBe(0);
  });

  test("stat delta vs baseline", () => {
    const s = stat([1, 1, 0, 0], [0, 0, 0, 0]);
    expect(s.mean).toBe(0.5);
    expect(s.delta).toBe(0.5);
    expect(stat([1]).delta).toBeNull();
  });
});

describe("pass^k", () => {
  test("sample passes only if ALL k attempts pass", () => {
    const runs = [
      run("s1", true),
      run("s1", true),
      run("s1", false), // s1: one flaky failure → 0
      run("s2", true),
      run("s2", true),
      run("s2", true), // s2: all pass → 1
    ];
    const v = passKVector(runs);
    expect(v.sort()).toEqual([0, 1]);
    expect(mean(v)).toBe(0.5);
  });
});

describe("metricVector", () => {
  test("averages assertion scores per sample over attempts", () => {
    const runs = [
      run("s1", true, { output_quality: 1 }),
      run("s1", false, { output_quality: 0 }),
      run("s2", true, { output_quality: 1 }),
    ];
    const v = metricVector(runs, "output_quality");
    expect(v.sort()).toEqual([0.5, 1]);
  });
});
