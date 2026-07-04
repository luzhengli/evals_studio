// Regression gate: hard-blocks negative optimizations. A candidate passes only
// if pass^k and every per-metric mean does not regress beyond epsilon vs the
// baseline arm.

import type { ArmReport, GateResult } from "../core/types.ts";

export const DEFAULT_EPSILON = 0.02;

export function evaluateGate(
  candidate: ArmReport,
  baseline: ArmReport,
  epsilon = DEFAULT_EPSILON
): GateResult {
  const checks: GateResult["checks"] = [];

  const push = (metric: string, cand: number, base: number) => {
    const delta = round(cand - base);
    checks.push({ metric, candidate: cand, baseline: base, delta, pass: delta >= -epsilon });
  };

  push("pass^k", candidate.passK.mean, baseline.passK.mean);
  for (const [metric, statC] of Object.entries(candidate.perMetric)) {
    const statB = baseline.perMetric[metric];
    if (statB) push(metric, statC.mean, statB.mean);
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    pass: failed.length === 0,
    checks,
    epsilon,
    summary:
      failed.length === 0
        ? `gate PASS: no metric regressed beyond ε=${epsilon}`
        : `gate FAIL: ${failed.map((f) => `${f.metric} Δ${f.delta.toFixed(4)}`).join(", ")} regressed beyond ε=${epsilon}`,
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;
