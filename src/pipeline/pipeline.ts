// Offline pipeline: run an experiment, emit artifacts:
//   timing.json   — per-run durations
//   grading.json  — per-assertion PASS/FAIL with evidence
//   benchmark.json— aggregated pass_rate/time/tokens mean+stddev+delta + gate
// Returns gate verdict so CI can fail on negative regressions.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BenchmarkReport, Run } from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { runExperiment } from "../eval/runner.ts";
import type { ExecutionEngine } from "../core/types.ts";
import type { Judge } from "../eval/judge.ts";

export interface PipelineArtifacts {
  timing: { experimentId: string; runs: { runId: string; sampleId: string; arm: string; attempt: number; durationMs: number }[] };
  grading: {
    experimentId: string;
    runs: {
      runId: string;
      sampleId: string;
      arm: string;
      attempt: number;
      pass: boolean;
      assertions: { name: string; metric: string; verdict: "PASS" | "FAIL"; score: number; evidence: string }[];
    }[];
  };
  benchmark: BenchmarkReport;
}

export function buildArtifacts(experimentId: string, runs: Run[], report: BenchmarkReport): PipelineArtifacts {
  return {
    timing: {
      experimentId,
      runs: runs.map((r) => ({
        runId: r.id,
        sampleId: r.sampleId,
        arm: r.arm,
        attempt: r.attempt,
        durationMs: r.timing.durationMs,
      })),
    },
    grading: {
      experimentId,
      runs: runs.map((r) => ({
        runId: r.id,
        sampleId: r.sampleId,
        arm: r.arm,
        attempt: r.attempt,
        pass: r.grading.pass,
        assertions: r.grading.assertions.map((a) => ({
          name: a.name,
          metric: a.metric,
          verdict: a.pass ? "PASS" as const : "FAIL" as const,
          score: a.score,
          evidence: a.evidence,
        })),
      })),
    },
    benchmark: report,
  };
}

export async function runPipeline(
  repo: Repo,
  experimentId: string,
  outDir: string,
  opts: { engine?: ExecutionEngine; judge?: Judge } = {}
): Promise<{ artifacts: PipelineArtifacts; gatePass: boolean }> {
  const { runs, report } = await runExperiment(repo, experimentId, opts);
  const artifacts = buildArtifacts(experimentId, runs, report);

  mkdirSync(outDir, { recursive: true });
  await Bun.write(join(outDir, "timing.json"), JSON.stringify(artifacts.timing, null, 2));
  await Bun.write(join(outDir, "grading.json"), JSON.stringify(artifacts.grading, null, 2));
  await Bun.write(join(outDir, "benchmark.json"), JSON.stringify(artifacts.benchmark, null, 2));

  return { artifacts, gatePass: report.gate ? report.gate.pass : true };
}
