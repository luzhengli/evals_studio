// DoD e2e demo 1 (prompt target): record samples → run pass^k → attribution
// yields prompt-instruction-defect → optimizer rewrite → regression gate
// judges the good rewrite PASS and a degraded rewrite FAIL.

import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { openDb } from "../src/db/db.ts";
import { Repo } from "../src/db/repo.ts";
import { seedPromptDemo } from "../src/scripts/fixtures.ts";
import { runExperiment } from "../src/eval/runner.ts";
import { attributeExperiment } from "../src/attribution/attribute.ts";
import { acceptSuggestion, suggestFromAttributions } from "../src/optimize/optimizer.ts";
import { runPipeline } from "../src/pipeline/pipeline.ts";

const K = 3;

describe("e2e prompt target", () => {
  const repo = new Repo(openDb(":memory:"));
  const demo = seedPromptDemo(repo);

  test("full loop: pass^k → attribution → rewrite → gate", async () => {
    // ---- 1. run pass^k experiment on v1 ----
    const exp1 = repo.createExperiment({
      name: "v1 baseline eval",
      targetId: demo.target.id,
      targetVersionId: demo.v1.id,
      baselineVersionId: null,
      sampleSetId: demo.sampleSet.id,
      engineId: demo.engine.id,
      mode: "single",
      evalConfig: { k: K, judgeId: "mock-judge", passThreshold: 1 },
    });
    const { runs, report } = await runExperiment(repo, exp1.id);

    expect(runs).toHaveLength(demo.samples.length * K);
    const arm = report.arms[0];
    // 4 samples: format-strict fails, flaky fails on attempt 2, clean passes, side-effect fails
    expect(arm.passK.mean).toBeCloseTo(0.25, 5);
    expect(arm.passK.stddev).toBeGreaterThan(0);
    // prompt metric taxonomy present, not a single pass/fail
    expect(Object.keys(arm.perMetric).sort()).toEqual(
      ["instruction_following", "output_quality", "reliability", "side_effect_safety"].sort()
    );
    // side-effect sample: semantic passes but safety fails
    const seRun = runs.find((r) => r.sampleId === demo.samples[3].id && r.arm === "candidate")!;
    const seAssert = seRun.grading.assertions.find((a) => a.name === "side-effect-safety")!;
    expect(seAssert.pass).toBe(false);
    expect(seAssert.evidence).toContain("L2 audit: FAIL");
    expect(seRun.grading.assertions.find((a) => a.name === "ground-truth")!.pass).toBe(true);

    // ---- 2. attribution: counterfactual replay → prompt-instruction-defect ----
    const attrs = await attributeExperiment(repo, exp1.id);
    expect(attrs.length).toBeGreaterThanOrEqual(2);
    const formatAttr = attrs.find((a) => a.sampleId === demo.samples[0].id)!;
    expect(formatAttr.rootCause).toBe("prompt-instruction-defect");
    expect(formatAttr.fixLayer).toBe("prompt");
    const rewriteCf = formatAttr.counterfactuals.find((c) => c.intervention === "rewrite-prompt")!;
    expect(rewriteCf.outcomeFlipped).toBe(true);
    expect(formatAttr.traceStepIndex).not.toBeNull();

    // ---- 3. optimizer proposes a rewrite from attributions ----
    const suggestion = suggestFromAttributions(repo, demo.target.id, attrs);
    expect(suggestion.proposedContent).toContain("## Revision");
    expect(suggestion.rationale).toContain("prompt-instruction-defect");
    const v2 = acceptSuggestion(repo, suggestion.id);
    expect(v2.version).toBe(2);
    expect(v2.origin).toBe("optimizer");

    // ---- 4. A/B: v2 candidate vs v1 baseline → gate PASS ----
    const exp2 = repo.createExperiment({
      name: "v2 vs v1",
      targetId: demo.target.id,
      targetVersionId: v2.id,
      baselineVersionId: demo.v1.id,
      sampleSetId: demo.sampleSet.id,
      engineId: demo.engine.id,
      mode: "ab-prompt",
      evalConfig: { k: K, judgeId: "mock-judge", passThreshold: 1 },
    });
    const outDir = "/tmp/eval-studio-test-artifacts";
    const { artifacts, gatePass } = await runPipeline(repo, exp2.id, outDir);
    expect(gatePass).toBe(true);
    const cand = artifacts.benchmark.arms.find((a) => a.arm === "candidate")!;
    const base = artifacts.benchmark.arms.find((a) => a.arm === "baseline")!;
    expect(cand.passK.mean).toBeCloseTo(0.75, 5); // flaky sample still fails pass^3
    expect(base.passK.mean).toBeCloseTo(0.25, 5);
    expect(cand.passK.delta).toBeCloseTo(0.5, 5);
    // artifacts on disk
    expect(await Bun.file(`${outDir}/benchmark.json`).exists()).toBe(true);
    expect(await Bun.file(`${outDir}/grading.json`).exists()).toBe(true);
    expect(await Bun.file(`${outDir}/timing.json`).exists()).toBe(true);
    const grading = await Bun.file(`${outDir}/grading.json`).json();
    expect(grading.runs[0].assertions[0].verdict).toMatch(/PASS|FAIL/);
    rmSync(outDir, { recursive: true, force: true });

    // ---- 5. degraded rewrite (v3) → gate FAIL blocks negative optimization ----
    const v3 = repo.createVersion({
      targetId: demo.target.id,
      content: `${v2.content}\n[worse] Also keep answers extremely terse.`,
      parentVersionId: v2.id,
      changelog: "over-aggressive terseness (degrades format compliance)",
      origin: "manual",
    });
    const exp3 = repo.createExperiment({
      name: "v3 vs v2",
      targetId: demo.target.id,
      targetVersionId: v3.id,
      baselineVersionId: v2.id,
      sampleSetId: demo.sampleSet.id,
      engineId: demo.engine.id,
      mode: "ab-prompt",
      evalConfig: { k: K, judgeId: "mock-judge", passThreshold: 1 },
    });
    const res3 = await runExperiment(repo, exp3.id);
    expect(res3.report.gate).not.toBeNull();
    expect(res3.report.gate!.pass).toBe(false);
    expect(res3.report.gate!.summary).toContain("gate FAIL");
  });
});
