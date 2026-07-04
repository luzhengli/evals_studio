// Deterministic mock engine. Behavior is scripted per-sample via Sample.mockSpec,
// including how the outcome responds to counterfactual interventions — this makes
// attribution, pass^k flakiness and side-effect grading fully demoable offline.

import type {
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  MockOutcome,
  TraceStep,
} from "../core/types.ts";

export class MockEngine implements ExecutionEngine {
  readonly kind = "mock" as const;

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const spec = req.sample.mockSpec;
    if (!spec) {
      return {
        output: `[mock] echo: ${req.sample.input}`,
        trace: [llmStep(0, req.promptText, req.sample.input, `[mock] echo: ${req.sample.input}`)],
        tokens: { input: 50, output: 20 },
        durationMs: 5,
        selectedSkill: null,
        error: null,
      };
    }

    // pick outcome by intervention (selection layer first, then execution, then model)
    // Prompt-content markers make version A/B testable offline: a prompt carrying
    // "[worse]" behaves like a degraded rewrite; one carrying "## Revision" (the
    // optimizer's amendment header) behaves like an improved rewrite.
    let outcome: MockOutcome = spec.base;
    const iv = req.interventions;
    const promptWorsened = req.promptText.includes("[worse]");
    const promptImproved = /## Revision/.test(req.promptText);
    if (promptWorsened && spec.onWorsenedPrompt) outcome = spec.onWorsenedPrompt;
    else if (iv?.rewrittenPrompt && spec.onRewrittenPrompt) outcome = spec.onRewrittenPrompt;
    else if (promptImproved && spec.onRewrittenPrompt) outcome = spec.onRewrittenPrompt;
    else if (iv?.forceSkill && spec.onForcedSkill) outcome = spec.onForcedSkill;
    else if (iv?.disableSkills && spec.onDisabledSkill) outcome = spec.onDisabledSkill;
    else if (!iv && req.skills.length === 0 && spec.onDisabledSkill) outcome = spec.onDisabledSkill;
    else if (iv?.swapModel && spec.onSwappedModel) outcome = spec.onSwappedModel;

    // deterministic flakiness for pass^k demos (only applies to unintervened runs)
    const flaky = !iv && spec.flakyFailAttempts?.includes(req.attempt);
    const output = flaky ? `[mock] degraded answer (attempt ${req.attempt})` : outcome.output;

    const skillsDisabled = iv?.disableSkills || req.skills.length === 0;
    const selectedSkill = iv?.forceSkill ?? (skillsDisabled ? null : (outcome.selectedSkill ?? null));

    const trace: TraceStep[] = [];
    let idx = 0;
    const effectivePrompt = iv?.rewrittenPrompt ?? req.promptText;

    trace.push({
      index: idx++,
      type: "routing",
      name: "skill-routing",
      input: req.sample.input,
      output: selectedSkill ? `selected skill: ${selectedSkill}` : "no skill selected",
      skillSelected: selectedSkill,
      durationMs: 2,
    });

    for (const call of outcome.toolCalls ?? []) {
      trace.push({
        index: idx++,
        type: "tool-call",
        name: call.tool,
        input: JSON.stringify(call.args),
        output: call.error ? `ERROR: ${call.error}` : "ok",
        durationMs: 8,
      });
    }

    for (const se of outcome.sideEffects ?? []) {
      trace.push({
        index: idx++,
        type: "side-effect",
        name: `${se.kind}:${se.locus}`,
        input: se.locus,
        output: `emulated ${se.kind} at ${se.locus}`,
        durationMs: 3,
      });
    }

    trace.push(llmStep(idx, effectivePrompt, req.sample.input, output, outcome.tokens));

    return {
      output,
      trace,
      tokens: outcome.tokens ?? { input: 120, output: 60 },
      durationMs: 10 + trace.length * 5,
      selectedSkill,
      error: outcome.toolCalls?.find((c) => c.error)?.error ?? null,
    };
  }
}

function llmStep(
  index: number,
  effectivePrompt: string,
  input: string,
  output: string,
  tokens?: { input: number; output: number }
): TraceStep {
  return {
    index,
    type: "llm",
    name: "generate",
    input,
    output,
    effectivePrompt,
    durationMs: 20,
    tokens: tokens ?? { input: 120, output: 60 },
  };
}
