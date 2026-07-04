// Dual-track optimizer: turns attribution reports into concrete revision
// suggestions — prompt rewrites (textual-gradient style: failure evidence acts
// as the gradient) and skill patches (trigger/instructions). Suggestions become
// new TargetVersions only when accepted, and must survive the regression gate.

import type {
  Attribution,
  OptimizationSuggestion,
  RootCause,
  SkillDef,
  TargetVersion,
} from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { parseSkill } from "../eval/runner.ts";

export interface FailureSummary {
  rootCause: RootCause;
  count: number;
  evidence: string[];
}

export function summarizeFailures(attributions: Attribution[]): FailureSummary[] {
  const byCause = new Map<RootCause, Attribution[]>();
  for (const a of attributions) {
    const arr = byCause.get(a.rootCause) ?? [];
    arr.push(a);
    byCause.set(a.rootCause, arr);
  }
  return [...byCause.entries()]
    .map(([rootCause, as]) => ({
      rootCause,
      count: as.length,
      evidence: as.map((a) => a.recommendation).slice(0, 5),
    }))
    .sort((x, y) => y.count - x.count);
}

/**
 * Propose a prompt rewrite from failure evidence. Deterministic, rule-based
 * "textual gradient": each root cause contributes a targeted amendment.
 * (An LLM-backed rewriter can be plugged in via settings; this fallback keeps
 * the loop runnable offline.)
 */
export function proposePromptRewrite(
  baseVersion: TargetVersion,
  attributions: Attribution[],
  rewriteHint?: string
): { proposedContent: string; rationale: string } {
  const summaries = summarizeFailures(attributions.filter((a) => a.fixLayer === "prompt"));
  const amendments: string[] = [];
  const rationaleParts: string[] = [];

  for (const s of summaries) {
    if (s.rootCause === "prompt-instruction-defect") {
      amendments.push(
        "Follow the output format EXACTLY as specified. Before answering, restate the required format constraints to yourself and verify the final answer satisfies every one of them."
      );
      rationaleParts.push(
        `${s.count} failure(s) attributed to prompt-instruction-defect — counterfactual replay showed a rewritten prompt flips the outcome.`
      );
    }
    if (s.rootCause === "base-model-error") {
      amendments.push("Work step by step and double-check factual claims before finalizing the answer.");
      rationaleParts.push(`${s.count} failure(s) attributed to base-model-error — mitigation added, consider swapping the model.`);
    }
  }
  if (rewriteHint) amendments.push(rewriteHint);
  if (amendments.length === 0) {
    amendments.push("Be precise and complete; verify the answer against the task requirements before responding.");
    rationaleParts.push("no prompt-layer attributions; generic tightening proposed");
  }

  const proposedContent = `${baseVersion.content.trim()}\n\n## Revision (auto-proposed from attribution)\n${amendments
    .map((a) => `- ${a}`)
    .join("\n")}`;
  return { proposedContent, rationale: rationaleParts.join(" ") };
}

/** Propose a skill patch: sharpen triggers on selection errors, harden instructions on execution errors. */
export function proposeSkillPatch(
  baseVersion: TargetVersion,
  attributions: Attribution[]
): { proposedContent: string; rationale: string } {
  const skill: SkillDef = parseSkill(baseVersion.content);
  const skillAttrs = attributions.filter((a) => a.fixLayer === "skill");
  const rationaleParts: string[] = [];

  const selectionErrors = skillAttrs.filter((a) => a.rootCause === "wrong-skill-selected").length;
  const executionErrors = skillAttrs.filter((a) => a.rootCause === "right-skill-executed-poorly").length;
  const toolErrors = skillAttrs.filter((a) => a.rootCause === "tool-call-error").length;

  if (selectionErrors) {
    skill.triggerDescription = `${skill.triggerDescription} Trigger ONLY when the task explicitly matches this description; when in doubt, do NOT trigger.`;
    rationaleParts.push(`${selectionErrors} selection failure(s): trigger description sharpened to reduce false activation.`);
  }
  if (executionErrors) {
    skill.instructions = `${skill.instructions}\nExecute carefully: validate inputs, follow each step in order, and verify the result before finishing.`;
    rationaleParts.push(`${executionErrors} execution failure(s): instructions hardened with validation steps.`);
  }
  if (toolErrors) {
    skill.instructions = `${skill.instructions}\nOn tool errors, retry once with corrected arguments before reporting failure.`;
    rationaleParts.push(`${toolErrors} tool failure(s): retry guidance added.`);
  }
  if (rationaleParts.length === 0) rationaleParts.push("no skill-layer attributions; no-op patch");

  return { proposedContent: JSON.stringify(skill, null, 2), rationale: rationaleParts.join(" ") };
}

/** Create a suggestion record from an experiment's attributions. */
export function suggestFromAttributions(
  repo: Repo,
  targetId: string,
  attributions: Attribution[]
): OptimizationSuggestion {
  const target = repo.getTarget(targetId);
  if (!target) throw new Error(`target not found: ${targetId}`);
  if (!target.activeVersionId) throw new Error("target has no active version");
  const base = repo.getVersion(target.activeVersionId);
  if (!base) throw new Error("active version missing");

  const { proposedContent, rationale } =
    target.type === "prompt"
      ? proposePromptRewrite(base, attributions)
      : proposeSkillPatch(base, attributions);

  return repo.createSuggestion({
    targetId,
    baseVersionId: base.id,
    proposedContent,
    rationale,
    attributionIds: attributions.map((a) => a.id),
  });
}

/** Accepting a suggestion mints a new version (does NOT activate it — the gate decides). */
export function acceptSuggestion(repo: Repo, suggestionId: string): TargetVersion {
  const s = repo.getSuggestion(suggestionId);
  if (!s) throw new Error(`suggestion not found: ${suggestionId}`);
  const version = repo.createVersion({
    targetId: s.targetId,
    content: s.proposedContent,
    parentVersionId: s.baseVersionId,
    changelog: s.rationale,
    origin: "optimizer",
  });
  repo.setSuggestionStatus(suggestionId, "accepted");
  return version;
}
