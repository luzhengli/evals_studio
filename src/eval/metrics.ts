// pass^k statistics and per-metric aggregation (mean + stddev + delta).

import type { Arm, ArmReport, MetricName, MetricStat, Run, TargetType } from "../core/types.ts";
import { metricsFor } from "../core/types.ts";

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function stat(xs: number[], baseline?: number[]): MetricStat {
  const m = mean(xs);
  return { mean: round(m), stddev: round(stddev(xs)), delta: baseline ? round(m - mean(baseline)) : null };
}

/**
 * pass^k per sample: 1 iff ALL k attempts of the sample passed (tau-bench).
 * Returns the per-sample binary vector, so mean = pass^k estimate and stddev
 * reflects cross-sample dispersion.
 */
export function passKVector(runs: Run[]): number[] {
  const bySample = groupBy(runs, (r) => r.sampleId);
  return [...bySample.values()].map((rs) => (rs.every((r) => r.grading.pass) ? 1 : 0));
}

/** Per-metric score vector: mean assertion score per sample (averaged over attempts). */
export function metricVector(runs: Run[], metric: string): number[] {
  const bySample = groupBy(runs, (r) => r.sampleId);
  const out: number[] = [];
  for (const rs of bySample.values()) {
    const scores: number[] = [];
    for (const r of rs) {
      const relevant = r.grading.assertions.filter((a) => a.metric === metric);
      if (relevant.length) scores.push(mean(relevant.map((a) => a.score)));
    }
    if (scores.length) out.push(mean(scores));
  }
  return out;
}

export function buildArmReport(
  arm: Arm,
  runs: Run[],
  targetType: TargetType,
  k: number,
  baselineRuns?: Run[]
): ArmReport {
  const perMetric: Record<string, MetricStat> = {};
  for (const metric of metricsFor(targetType)) {
    perMetric[metric] = stat(metricVector(runs, metric), baselineRuns ? metricVector(baselineRuns, metric) : undefined);
  }
  return {
    arm,
    samples: new Set(runs.map((r) => r.sampleId)).size,
    k,
    passK: stat(passKVector(runs), baselineRuns ? passKVector(baselineRuns) : undefined),
    perMetric,
    timeMs: stat(
      runs.map((r) => r.timing.durationMs),
      baselineRuns?.map((r) => r.timing.durationMs)
    ),
    tokens: stat(
      runs.map((r) => r.tokens.input + r.tokens.output),
      baselineRuns?.map((r) => r.tokens.input + r.tokens.output)
    ),
  };
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
