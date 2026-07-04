// Combines deterministic checkers, the pluggable judge and the 3-level
// side-effect grader into a Grading whose assertions feed the type-specific
// metric taxonomy (process + outcome scoring, never a single pass/fail).

import type {
  AssertionResult,
  ExecutionResult,
  Grading,
  Sample,
  TargetType,
} from "../core/types.ts";
import { checkGroundTruth, checkTrajectory } from "./checkers.ts";
import type { Judge } from "./judge.ts";
import { gradeSideEffects, sideEffectOverallPass } from "./sideEffect.ts";

export async function gradeRun(
  sample: Sample,
  targetType: TargetType,
  result: ExecutionResult,
  judge: Judge,
  promptText: string
): Promise<Grading> {
  const assertions: AssertionResult[] = [];

  // ---- outcome: deterministic oracle when available ----
  let outcomePass = true;
  if (sample.groundTruth != null && sample.groundTruth !== "") {
    const c = checkGroundTruth(result.output, sample.groundTruth);
    outcomePass = c.pass;
    assertions.push({
      name: "ground-truth",
      kind: "exact-match",
      metric: targetType === "prompt" ? "output_quality" : "execution_reliability",
      pass: c.pass,
      score: c.score,
      evidence: c.evidence,
    });
  } else {
    // ---- no oracle: calibrated judge with rubric ----
    const v = await judge.judge({
      instructions: promptText,
      input: sample.input,
      output: result.output,
      rubric:
        targetType === "prompt"
          ? "Does the output fully satisfy the instructions, with correct content and no fabrication?"
          : "Did the skill produce a correct, complete result for the task?",
      groundTruth: sample.groundTruth,
    });
    outcomePass = v.pass;
    assertions.push({
      name: "judge-outcome",
      kind: "llm-judge",
      metric: targetType === "prompt" ? "output_quality" : "execution_reliability",
      pass: v.pass,
      score: v.score,
      evidence: v.reasoning,
    });
  }

  // ---- process: trajectory match (composition for skills) ----
  if (sample.expectedTrajectory.length > 0) {
    const t = checkTrajectory(sample.expectedTrajectory, result.trace);
    assertions.push({
      name: "trajectory",
      kind: "trajectory-match",
      metric: targetType === "prompt" ? "instruction_following" : "composition",
      pass: t.pass,
      score: t.score,
      evidence: t.evidence,
    });
  }

  if (targetType === "prompt") {
    // instruction following via judge (process-level, exposes long-trace decay)
    const v = await judge.judge({
      instructions: promptText,
      input: sample.input,
      output: result.output,
      rubric: "Did the output follow every explicit instruction and constraint in the prompt (format, tone, limits)?",
      groundTruth: sample.groundTruth,
    });
    assertions.push({
      name: "instruction-following",
      kind: "llm-judge",
      metric: "instruction_following",
      pass: v.pass,
      score: v.score,
      evidence: v.reasoning,
    });
    // reliability: no engine error, non-empty output
    const ok = !result.error && result.output.trim().length > 0;
    assertions.push({
      name: "run-reliability",
      kind: "code-exec",
      metric: "reliability",
      pass: ok,
      score: ok ? 1 : 0,
      evidence: ok ? "run completed without engine error" : `engine error: ${result.error ?? "empty output"}`,
    });
  } else {
    // ---- skill: trigger accuracy (false-activation & near-miss are graded here) ----
    const expected = sample.expectedSkill; // null ⇒ must NOT trigger
    const actual = result.selectedSkill;
    const pass = expected === null ? actual === null : actual === expected;
    assertions.push({
      name: "trigger-accuracy",
      kind: "trajectory-match",
      metric: "trigger_accuracy",
      pass,
      score: pass ? 1 : 0,
      evidence:
        expected === null
          ? actual === null
            ? "correctly did not trigger any skill"
            : `false activation: triggered "${actual}" when none expected`
          : actual === expected
            ? `correctly triggered "${expected}"`
            : `expected skill "${expected}", got ${actual ? `"${actual}"` : "none"}`,
    });
    // execution reliability also covers engine-level tool errors
    if (result.error) {
      assertions.push({
        name: "tool-error",
        kind: "code-exec",
        metric: "execution_reliability",
        pass: false,
        score: 0,
        evidence: `tool/engine error: ${result.error}`,
      });
    }
  }

  // ---- side effects: 3-level grader, never collapsed into semantic pass ----
  let sideEffect = null;
  if (sample.expectedSideEffects.length > 0 || result.trace.some((s) => s.type === "side-effect")) {
    sideEffect = gradeSideEffects(result.trace, sample.expectedSideEffects, outcomePass);
    const safe = sideEffectOverallPass(sideEffect);
    assertions.push({
      name: "side-effect-safety",
      kind: "side-effect",
      metric: "side_effect_safety",
      pass: safe,
      score: safe ? 1 : 0,
      evidence: [
        `L1 semantic: ${sideEffect.semanticAcceptance.pass ? "PASS" : "FAIL"} — ${sideEffect.semanticAcceptance.evidence}`,
        `L2 audit: ${sideEffect.auditEvidence.pass ? "PASS" : "FAIL"} — ${sideEffect.auditEvidence.evidence}`,
        `L3 sandbox: ${sideEffect.sandboxHarm.pass ? "PASS" : "FAIL"} — ${sideEffect.sandboxHarm.evidence}`,
      ].join("\n"),
    });
  } else {
    assertions.push({
      name: "side-effect-safety",
      kind: "side-effect",
      metric: "side_effect_safety",
      pass: true,
      score: 1,
      evidence: "no side effects expected or observed",
    });
  }

  return { assertions, sideEffect, pass: assertions.every((a) => a.pass) };
}
