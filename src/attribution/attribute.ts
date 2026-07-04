// Counterfactual-replay attribution. For each failing run we replay the SAME
// sample with targeted interventions and observe whether the outcome flips:
//   rewrite-prompt  → prompt/input layer
//   force-skill     → skill selection layer
//   disable-skill   → skill selection layer (false activation)
//   swap-model      → base model layer
// Classification order is fixed: selection/input layer → execution layer →
// base model. The result is a structured report: root cause + counterfactual
// evidence + trace locus + fix recommendation (prompt vs skill).

import type {
  Attribution,
  CounterfactualResult,
  ExecutionEngine,
  Experiment,
  Interventions,
  InterventionKind,
  RootCause,
  Run,
  Sample,
  TargetType,
  TraceStep,
} from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { buildEngine } from "../engines/registry.ts";
import { gradeRun } from "../eval/grade.ts";
import { buildJudge, type Judge } from "../eval/judge.ts";
import type { ArmSpec } from "../eval/runner.ts";
import { armsForExperiment } from "../eval/runner.ts";

export interface AttributionContext {
  repo: Repo;
  exp: Experiment;
  targetType: TargetType;
  engine: ExecutionEngine;
  judge: Judge;
  armSpec: ArmSpec;
}

/** Replay one intervention and report whether the failing outcome flipped to pass. */
async function replayWith(
  ctx: AttributionContext,
  sample: Sample,
  kind: InterventionKind,
  interventions: Interventions
): Promise<CounterfactualResult> {
  try {
    const result = await ctx.engine.execute({
      sample,
      targetType: ctx.targetType,
      promptText: ctx.armSpec.promptText,
      skills: ctx.armSpec.skills,
      interventions,
      attempt: 1,
    });
    const grading = await gradeRun(sample, ctx.targetType, result, ctx.judge, ctx.armSpec.promptText);
    // Interventions deliberately alter routing, so routing-dependent assertions
    // (trigger-accuracy, trajectory) are excluded from the flip verdict — only
    // outcome-level assertions count.
    const routingAssertions = new Set(["trigger-accuracy", "trajectory"]);
    const outcomeAssertions = grading.assertions.filter((a) => !routingAssertions.has(a.name));
    const flipped = outcomeAssertions.every((a) => a.pass);
    return {
      intervention: kind,
      applied: true,
      outcomeFlipped: flipped,
      replayOutput: result.output.slice(0, 500),
      evidence: flipped
        ? `replay with ${kind} PASSED — failure is causally linked to this layer`
        : `replay with ${kind} still failed (${outcomeAssertions.filter((a) => !a.pass).map((a) => a.name).join(", ")})`,
    };
  } catch (e: any) {
    return {
      intervention: kind,
      applied: false,
      outcomeFlipped: false,
      replayOutput: "",
      evidence: `replay error: ${e?.message ?? e}`,
    };
  }
}

function defaultRewrite(promptText: string): string {
  return `${promptText.trim()}\n\nIMPORTANT: follow every stated constraint exactly (format, length, tone). Verify the final answer against each requirement before responding.`;
}

function findTraceStep(trace: TraceStep[], pred: (s: TraceStep) => boolean): number | null {
  const s = trace.find(pred);
  return s ? s.index : null;
}

export async function attributeRun(ctx: AttributionContext, run: Run, sample: Sample): Promise<Attribution> {
  const trace = ctx.repo.getTraceByRun(run.id)?.steps ?? [];
  const cfs: CounterfactualResult[] = [];
  let rootCause: RootCause;
  let traceStepIndex: number | null = null;
  let fixLayer: TargetType;
  let recommendation: string;

  const toolErrorIdx = findTraceStep(trace, (s) => s.type === "tool-call" && s.output.startsWith("ERROR:"));
  const routingIdx = findTraceStep(trace, (s) => s.type === "routing");
  const llmIdx = findTraceStep(trace, (s) => s.type === "llm");

  if (ctx.targetType === "prompt") {
    // ---- input layer: rewrite prompt ----
    const rewrite = await replayWith(ctx, sample, "rewrite-prompt", {
      rewrittenPrompt: defaultRewrite(ctx.armSpec.promptText),
    });
    cfs.push(rewrite);
    if (rewrite.outcomeFlipped) {
      rootCause = "prompt-instruction-defect";
      traceStepIndex = llmIdx;
      fixLayer = "prompt";
      recommendation =
        "Rewriting the prompt flipped the outcome: the prompt under-specifies constraints the model needs. Tighten the instruction text (format/constraint restatement) at the system prompt.";
    } else if (toolErrorIdx != null) {
      // ---- execution layer ----
      rootCause = "tool-call-error";
      traceStepIndex = toolErrorIdx;
      fixLayer = "prompt";
      recommendation = `A tool call errored at trace step ${toolErrorIdx} and rewriting the prompt did not recover. Add tool-usage guidance / fallback instructions to the prompt, or fix the tool.`;
    } else {
      // ---- base model layer ----
      const swap = await replayWith(ctx, sample, "swap-model", { swapModel: "alt-model" });
      cfs.push(swap);
      rootCause = "base-model-error";
      traceStepIndex = llmIdx;
      fixLayer = "prompt";
      recommendation = swap.outcomeFlipped
        ? "Swapping the base model flipped the outcome while prompt rewrites did not: this is a base-model capability gap. Prefer a stronger model for this task class."
        : "Neither prompt rewrite nor model swap recovered the failure — likely an inherent capability/knowledge gap. Consider decomposing the task or adding examples to the prompt.";
    }
  } else {
    // ---- skill target: selection layer first ----
    const expected = sample.expectedSkill;
    const actual = run.selectedSkill;
    const selectionWrong = expected === null ? actual !== null : actual !== expected;

    if (selectionWrong) {
      const cf =
        expected === null
          ? await replayWith(ctx, sample, "disable-skill", { disableSkills: true })
          : await replayWith(ctx, sample, "force-skill", { forceSkill: expected });
      cfs.push(cf);
      rootCause = "wrong-skill-selected";
      traceStepIndex = routingIdx;
      fixLayer = "skill";
      recommendation =
        expected === null
          ? `False activation: skill "${actual}" triggered on a task it should not handle${cf.outcomeFlipped ? "; disabling the skill fixes the outcome" : ""}. Sharpen the skill's triggerDescription with explicit negative conditions.`
          : `Wrong/missing skill selection (expected "${expected}", got ${actual ? `"${actual}"` : "none"})${cf.outcomeFlipped ? "; forcing the correct skill fixes the outcome" : ""}. Make the triggerDescription more discriminative for this scenario.`;
    } else if (toolErrorIdx != null) {
      // ---- execution layer: tool errors ----
      rootCause = "tool-call-error";
      traceStepIndex = toolErrorIdx;
      fixLayer = "skill";
      recommendation = `Correct skill triggered but a tool call errored at trace step ${toolErrorIdx}. Add argument validation / retry guidance to the skill instructions.`;
    } else {
      // ---- execution layer vs base model ----
      const disable = await replayWith(ctx, sample, "disable-skill", { disableSkills: true });
      cfs.push(disable);
      if (disable.outcomeFlipped) {
        rootCause = "right-skill-executed-poorly";
        traceStepIndex = llmIdx;
        fixLayer = "skill";
        recommendation =
          "Correct skill triggered but its execution produced a wrong result — the model does BETTER without the skill. The skill instructions are misleading; rewrite the execution steps.";
      } else {
        const swap = await replayWith(ctx, sample, "swap-model", { swapModel: "alt-model" });
        cfs.push(swap);
        if (swap.outcomeFlipped) {
          rootCause = "base-model-error";
          traceStepIndex = llmIdx;
          fixLayer = "skill";
          recommendation =
            "Correct skill, clean tools, but a stronger model executes it correctly: base-model capability gap. Consider a stronger engine model or simplifying the skill's steps.";
        } else {
          rootCause = "right-skill-executed-poorly";
          traceStepIndex = llmIdx;
          fixLayer = "skill";
          recommendation =
            "Correct skill triggered but execution fails under every counterfactual — the skill instructions themselves are defective for this case. Add explicit handling for this scenario to the instructions.";
        }
      }
    }
  }

  return ctx.repo.createAttribution({
    runId: run.id,
    experimentId: ctx.exp.id,
    sampleId: sample.id,
    rootCause,
    counterfactuals: cfs,
    traceStepIndex,
    fixLayer,
    recommendation,
  });
}

/**
 * Attribute all failing runs of an experiment (first failing attempt per
 * sample per arm — attempts share a root cause by construction).
 */
export async function attributeExperiment(
  repo: Repo,
  experimentId: string,
  opts: { engine?: ExecutionEngine; judge?: Judge } = {}
): Promise<Attribution[]> {
  const exp = repo.getExperiment(experimentId);
  if (!exp) throw new Error(`experiment not found: ${experimentId}`);
  const target = repo.getTarget(exp.targetId);
  if (!target) throw new Error(`target not found: ${exp.targetId}`);
  const version = repo.getVersion(exp.targetVersionId);
  if (!version) throw new Error("version missing");
  const baseline = exp.baselineVersionId ? repo.getVersion(exp.baselineVersionId) : null;
  const engineCfg = repo.getEngine(exp.engineId);
  if (!engineCfg) throw new Error("engine missing");

  const engine = opts.engine ?? buildEngine(engineCfg);
  const judge = opts.judge ?? buildJudge(exp.evalConfig.judgeId, repo.listSettings());
  const arms = armsForExperiment(exp, version, baseline);
  const runs = repo.listRuns(experimentId);

  // candidate-side failures only; baseline/without-skill arms are references
  const attributableArms = new Set(["candidate", "with-skill"]);
  const failing = runs.filter((r) => attributableArms.has(r.arm) && !r.grading.pass);
  const seen = new Set<string>();
  const out: Attribution[] = [];

  for (const run of failing) {
    const key = `${run.sampleId}:${run.arm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sample = repo.getSample(run.sampleId);
    if (!sample) continue;
    const armSpec = arms.find((a) => a.arm === run.arm);
    if (!armSpec) continue;
    const ctx: AttributionContext = { repo, exp, targetType: target.type, engine, judge, armSpec };
    out.push(await attributeRun(ctx, run, sample));
  }
  return out;
}
