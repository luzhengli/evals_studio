// pass^k experiment runner. An experiment = (sample set × engine × target
// version × eval config). Modes:
//   single    — one candidate arm
//   ab-prompt — candidate version vs baseline version, isolated arms
//   ab-skill  — with-skill vs without-skill, isolated arms
// Every attempt is persisted as a Run with its full Trace.

import type {
  Arm,
  BenchmarkReport,
  ExecutionEngine,
  Experiment,
  Run,
  Sample,
  SkillDef,
  TargetVersion,
} from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { buildEngine } from "../engines/registry.ts";
import { gradeRun } from "./grade.ts";
import { buildJudge, type Judge } from "./judge.ts";
import { buildArmReport, groupBy } from "./metrics.ts";
import { evaluateGate } from "../optimize/gate.ts";

const BASE_AGENT_PROMPT =
  "You are a capable assistant agent. Use an available skill when—and only when—the task matches its trigger conditions; otherwise answer directly.";

export interface ArmSpec {
  arm: Arm;
  promptText: string;
  skills: SkillDef[];
}

export function armsForExperiment(exp: Experiment, version: TargetVersion, baseline: TargetVersion | null): ArmSpec[] {
  if (exp.mode === "single") {
    return [armFromVersion("candidate", version)];
  }
  if (exp.mode === "ab-prompt") {
    if (!baseline) throw new Error("ab-prompt experiment requires baselineVersionId");
    return [armFromVersion("candidate", version), armFromVersion("baseline", baseline)];
  }
  // ab-skill: with vs without the skill under test
  const skill = parseSkill(version.content);
  return [
    { arm: "with-skill", promptText: BASE_AGENT_PROMPT, skills: [skill] },
    { arm: "without-skill", promptText: BASE_AGENT_PROMPT, skills: [] },
  ];
}

function armFromVersion(arm: Arm, version: TargetVersion): ArmSpec {
  // prompt targets: content is the prompt text; skill targets: content hosts the skill
  try {
    const skill = parseSkill(version.content);
    return { arm, promptText: BASE_AGENT_PROMPT, skills: [skill] };
  } catch {
    return { arm, promptText: version.content, skills: [] };
  }
}

export function parseSkill(content: string): SkillDef {
  const j = JSON.parse(content);
  if (!j || typeof j !== "object" || !j.name || !j.instructions) throw new Error("not a SkillDef");
  return {
    name: j.name,
    description: j.description ?? undefined,
    triggerDescription: j.triggerDescription ?? "",
    negativeTriggers: Array.isArray(j.negativeTriggers) ? j.negativeTriggers : undefined,
    instructions: j.instructions,
    tools: j.tools ?? [],
    compatibility: j.compatibility ?? undefined,
    metadata: j.metadata ?? undefined,
  };
}

export interface RunExperimentResult {
  runs: Run[];
  report: BenchmarkReport;
}

export async function runExperiment(
  repo: Repo,
  experimentId: string,
  opts: { engine?: ExecutionEngine; judge?: Judge } = {}
): Promise<RunExperimentResult> {
  const exp = repo.getExperiment(experimentId);
  if (!exp) throw new Error(`experiment not found: ${experimentId}`);
  const target = repo.getTarget(exp.targetId);
  if (!target) throw new Error(`target not found: ${exp.targetId}`);
  const version = repo.getVersion(exp.targetVersionId);
  if (!version) throw new Error(`version not found: ${exp.targetVersionId}`);
  const baseline = exp.baselineVersionId ? repo.getVersion(exp.baselineVersionId) : null;
  const samples = repo.listSamples(exp.sampleSetId);
  if (samples.length === 0) throw new Error("sample set is empty");

  const engineCfg = repo.getEngine(exp.engineId);
  if (!engineCfg) throw new Error(`engine not found: ${exp.engineId}`);
  const engine = opts.engine ?? buildEngine(engineCfg);
  const judge = opts.judge ?? buildJudge(exp.evalConfig.judgeId, repo.listSettings());

  repo.setExperimentStatus(exp.id, "running");
  const arms = armsForExperiment(exp, version, baseline);
  const runs: Run[] = [];

  try {
    for (const armSpec of arms) {
      for (const sample of samples) {
        for (let attempt = 1; attempt <= exp.evalConfig.k; attempt++) {
          const run = await executeAndGrade(repo, exp, target.type, engine, judge, armSpec, sample, attempt);
          runs.push(run);
        }
      }
    }
  } catch (e) {
    repo.setExperimentStatus(exp.id, "failed", Date.now());
    throw e;
  }

  const report = buildBenchmark(exp, target.type, runs);
  repo.saveBenchmark(report);
  repo.setExperimentStatus(exp.id, "done", Date.now());
  return { runs, report };
}

export async function executeAndGrade(
  repo: Repo,
  exp: Experiment,
  targetType: "prompt" | "skill",
  engine: ExecutionEngine,
  judge: Judge,
  armSpec: ArmSpec,
  sample: Sample,
  attempt: number
): Promise<Run> {
  const result = await engine.execute({
    sample,
    targetType,
    promptText: armSpec.promptText,
    skills: armSpec.skills,
    attempt,
  });
  const grading = await gradeRun(sample, targetType, result, judge, armSpec.promptText, armSpec.skills);
  const run = repo.createRun({
    experimentId: exp.id,
    sampleId: sample.id,
    arm: armSpec.arm,
    attempt,
    output: result.output,
    selectedSkill: result.selectedSkill,
    grading,
    timing: { durationMs: result.durationMs },
    tokens: result.tokens,
    error: result.error,
  });
  repo.createTrace({ runId: run.id, steps: result.trace });
  return run;
}

export function buildBenchmark(exp: Experiment, targetType: "prompt" | "skill", runs: Run[]): BenchmarkReport {
  const byArm = groupBy(runs, (r) => r.arm);
  const candidateArm: Arm = exp.mode === "ab-skill" ? "with-skill" : "candidate";
  const baselineArm: Arm | null = exp.mode === "ab-prompt" ? "baseline" : exp.mode === "ab-skill" ? "without-skill" : null;
  const baselineRuns = baselineArm ? (byArm.get(baselineArm) ?? []) : undefined;

  const arms = [...byArm.entries()].map(([arm, armRuns]) =>
    buildArmReport(
      arm as Arm,
      armRuns,
      targetType,
      exp.evalConfig.k,
      arm === candidateArm && baselineRuns?.length ? baselineRuns : undefined
    )
  );

  const candidateReport = arms.find((a) => a.arm === candidateArm);
  const baselineReport = arms.find((a) => a.arm === baselineArm);
  const gate =
    candidateReport && baselineReport ? evaluateGate(candidateReport, baselineReport) : null;

  return { experimentId: exp.id, targetType, generatedAt: Date.now(), arms, gate };
}
