import { describe, expect, test } from "bun:test";
import { evaluateGate } from "../src/optimize/gate.ts";
import { diffLines } from "../src/optimize/diff.ts";
import type { ArmReport } from "../src/core/types.ts";

const report = (passK: number, metrics: Record<string, number>): ArmReport => ({
  arm: "candidate",
  samples: 4,
  k: 3,
  passK: { mean: passK, stddev: 0.1, delta: null },
  perMetric: Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, { mean: v, stddev: 0, delta: null }])),
  timeMs: { mean: 10, stddev: 1, delta: null },
  tokens: { mean: 100, stddev: 5, delta: null },
});

describe("regression gate", () => {
  test("passes when nothing regresses beyond epsilon", () => {
    const g = evaluateGate(report(0.8, { output_quality: 0.9 }), report(0.5, { output_quality: 0.89 }));
    expect(g.pass).toBe(true);
    expect(g.checks.find((c) => c.metric === "pass^k")!.delta).toBeCloseTo(0.3);
  });

  test("hard-fails on pass^k regression", () => {
    const g = evaluateGate(report(0.4, {}), report(0.7, {}));
    expect(g.pass).toBe(false);
    expect(g.summary).toContain("gate FAIL");
  });

  test("hard-fails when a category metric regresses even if pass^k improves", () => {
    const g = evaluateGate(
      report(0.9, { side_effect_safety: 0.5 }),
      report(0.5, { side_effect_safety: 0.9 })
    );
    expect(g.pass).toBe(false);
    expect(g.checks.find((c) => c.metric === "side_effect_safety")!.pass).toBe(false);
  });

  test("tolerates regressions within epsilon", () => {
    const g = evaluateGate(report(0.79, {}), report(0.8, {}), 0.02);
    expect(g.pass).toBe(true);
  });
});

describe("diffLines", () => {
  test("LCS line diff", () => {
    const d = diffLines("a\nb\nc", "a\nx\nc");
    expect(d).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "x" },
      { type: "same", text: "c" },
    ]);
  });
});
