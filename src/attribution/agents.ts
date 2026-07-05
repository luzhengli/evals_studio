// Custom attribution agents: user-configured analyzers with a scenario and
// error-attribution criteria. An analysis task pulls the attribution items of
// an experiment and produces per-item findings (agree/disagree with the
// counterfactual root cause + severity + notes). The default analyzer is
// deterministic and offline; an LLM judge can be referenced via judgeId but
// all model access still goes through the Judge abstraction.

import type {
  AnalysisFinding,
  AnalysisTask,
  Attribution,
  AttributionAgent,
  InterventionKind,
  RootCause,
} from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { now } from "../core/ids.ts";

/** Which counterfactual flip is expected to confirm each root cause. */
const CONFIRMING_FLIP: Partial<Record<RootCause, InterventionKind>> = {
  "prompt-instruction-defect": "rewrite-prompt",
  "wrong-skill-selected": "force-skill",
  "right-skill-executed-poorly": "disable-skill",
  "base-model-error": "swap-model",
};

/** The attribution items an analysis task can pull for an experiment. */
export function pullAttributionItems(repo: Repo, experimentId: string): Attribution[] {
  return repo.listAttributions(experimentId);
}

/**
 * Deterministic per-item analysis:
 * - agree when the confirming counterfactual flipped (or the cause needs no replay);
 * - severity: high when the agent's criteria mention the root cause (its focus
 *   area) or the sample sits in an E/R tier; medium when evidence is ambiguous
 *   (no confirming flip); low otherwise.
 */
export function analyzeAttribution(agent: AttributionAgent, repo: Repo, a: Attribution): AnalysisFinding {
  const confirming = CONFIRMING_FLIP[a.rootCause];
  const flip = confirming ? a.counterfactuals.find((c) => c.intervention === confirming) : undefined;
  // tool-call-error and disable-skill-based false activations are evidence-based, not flip-based
  const agrees = confirming == null || a.counterfactuals.length === 0 ? true : Boolean(flip?.outcomeFlipped);

  const sample = repo.getSample(a.sampleId);
  const criteria = agent.criteria.toLowerCase();
  const causeInFocus =
    criteria.includes(a.rootCause) ||
    (a.rootCause.includes("skill") && /skill|技能/.test(criteria)) ||
    (a.rootCause.includes("prompt") && /prompt|提示词/.test(criteria)) ||
    (a.rootCause === "tool-call-error" && /tool|工具/.test(criteria));
  const highTier = sample?.tier === "E" || sample?.tier === "R";

  const severity: AnalysisFinding["severity"] = causeInFocus || highTier ? "high" : agrees ? "low" : "medium";

  const notes = [
    `scenario: ${agent.scenario || "(unspecified)"}`,
    agrees
      ? `counterfactual evidence supports "${a.rootCause}"${flip ? ` (${flip.intervention} flipped the outcome)` : ""}`
      : `no confirming flip for "${a.rootCause}" — evidence is indirect; re-check under the agent's criteria`,
    causeInFocus ? "matches the agent's attribution criteria — prioritized" : "outside the agent's focus criteria",
    highTier ? `sample is ${sample?.tier}-tier (edge/adversarial) — regression risk is elevated` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    attributionId: a.id,
    runId: a.runId,
    sampleId: a.sampleId,
    rootCause: a.rootCause,
    agreesWithRootCause: agrees,
    severity,
    notes,
  };
}

/** Run an analysis task to completion, updating progress per item. */
export function runAnalysisTask(repo: Repo, taskId: string): AnalysisTask {
  const task = repo.getAnalysisTask(taskId);
  if (!task) throw new Error(`analysis task not found: ${taskId}`);
  const agent = repo.getAgent(task.agentId);
  if (!agent) throw new Error(`agent not found: ${task.agentId}`);

  const items = pullAttributionItems(repo, task.experimentId);
  repo.updateAnalysisTask(taskId, { status: "running", total: items.length, done: 0, findings: [] });

  const findings: AnalysisFinding[] = [];
  try {
    for (const a of items) {
      findings.push(analyzeAttribution(agent, repo, a));
      repo.updateAnalysisTask(taskId, { done: findings.length, findings });
    }
    repo.updateAnalysisTask(taskId, { status: "done", finishedAt: now() });
  } catch (e) {
    repo.updateAnalysisTask(taskId, { status: "failed", finishedAt: now() });
    throw e;
  }
  return repo.getAnalysisTask(taskId)!;
}
