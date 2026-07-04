// ---------------------------------------------------------------------------
// Agent Eval Studio — domain model
// Prompt and Skill are peer EvalTargets sharing samples/experiments/traces/
// attribution/versions/gates. Only metric taxonomies differ.
// ---------------------------------------------------------------------------

export type TargetType = "prompt" | "skill";

export const PROMPT_METRICS = [
  "instruction_following",
  "output_quality",
  "side_effect_safety",
  "reliability",
] as const;
export const SKILL_METRICS = [
  "trigger_accuracy",
  "execution_reliability",
  "side_effect_safety",
  "composition",
] as const;
export type PromptMetric = (typeof PROMPT_METRICS)[number];
export type SkillMetric = (typeof SKILL_METRICS)[number];
export type MetricName = PromptMetric | SkillMetric;

export function metricsFor(type: TargetType): readonly MetricName[] {
  return type === "prompt" ? PROMPT_METRICS : SKILL_METRICS;
}

// ----- EvalTarget & versions ------------------------------------------------

export interface EvalTarget {
  id: string;
  type: TargetType;
  name: string;
  description: string;
  activeVersionId: string | null;
  createdAt: number;
}

/** Skill definition (content of a TargetVersion when type === 'skill'). */
export interface SkillDef {
  name: string;
  /** When the skill SHOULD trigger — used to grade trigger_accuracy. */
  triggerDescription: string;
  instructions: string;
  tools: string[];
}

export interface TargetVersion {
  id: string;
  targetId: string;
  /** monotonically increasing per target */
  version: number;
  /** prompt text, or JSON-serialized SkillDef */
  content: string;
  parentVersionId: string | null;
  changelog: string;
  /** how this version came to be */
  origin: "manual" | "optimizer";
  createdAt: number;
}

// ----- Samples ---------------------------------------------------------------

export type SampleSource = "manual" | "trace-replay" | "llm-synthesized" | "adversarial";

/** Highest-value adversarial categories are first-class tags. */
export type SampleTag = "false-activation" | "near-miss" | "happy-path" | "adversarial" | string;

export type SideEffectKind = "file-write" | "message-send" | "api-call" | "state-mutation";

export interface ExpectedSideEffect {
  kind: SideEffectKind;
  /** e.g. path, channel, endpoint */
  locus: string;
  allowed: boolean;
}

export interface ExpectedTrajectoryStep {
  /** tool name or "skill:<name>" or "respond" */
  action: string;
  optional?: boolean;
}

export interface ContaminationAudit {
  audited: boolean;
  auditedAt: number | null;
  /** heuristics + notes: overlap with known public sets, model memorization probe result */
  verdict: "clean" | "suspect" | "contaminated" | null;
  notes: string;
}

export interface Sample {
  id: string;
  sampleSetId: string;
  name: string;
  /** the user/task input given to the engine */
  input: string;
  groundTruth: string | null;
  expectedTrajectory: ExpectedTrajectoryStep[];
  /** for skill targets: which skill should trigger; null = skill must NOT trigger (false-activation probe) */
  expectedSkill: string | null;
  expectedSideEffects: ExpectedSideEffect[];
  tags: SampleTag[];
  source: SampleSource;
  /** freshness: when the sample content was authored/refreshed */
  freshAsOf: number;
  contamination: ContaminationAudit;
  /** deterministic behavior script for the mock engine (tests/demos) */
  mockSpec: MockSpec | null;
  createdAt: number;
}

export interface SampleSet {
  id: string;
  targetId: string;
  name: string;
  description: string;
  /** wizard provenance: goal → scenario → cases → fields */
  goal: string;
  scenario: string;
  createdAt: number;
}

// ----- Mock engine scripting (deterministic tests & demos) -------------------

/**
 * Describes how the mock engine behaves for a sample, including how outcome
 * responds to counterfactual interventions — this is what makes attribution
 * demoable offline.
 */
export interface MockSpec {
  /** base behavior without interventions */
  base: MockOutcome;
  /** outcome when the prompt is rewritten (counterfactual: rewrite-prompt) */
  onRewrittenPrompt?: MockOutcome;
  /** outcome when the correct skill is forced (counterfactual: force-skill) */
  onForcedSkill?: MockOutcome;
  /** outcome when skills are disabled (counterfactual: disable-skill) */
  onDisabledSkill?: MockOutcome;
  /** outcome when the base model is swapped (counterfactual: swap-model) */
  onSwappedModel?: MockOutcome;
  /** outcome when the prompt carries the "[worse]" marker (negative-optimization demos) */
  onWorsenedPrompt?: MockOutcome;
  /** per-attempt flakiness: attempt indices (1-based) that fail even if base passes */
  flakyFailAttempts?: number[];
}

export interface MockOutcome {
  output: string;
  /** skill the mock 'selects' (null = none) */
  selectedSkill?: string | null;
  toolCalls?: { tool: string; args: Record<string, unknown>; error?: string }[];
  sideEffects?: { kind: SideEffectKind; locus: string }[];
  tokens?: { input: number; output: number };
}

// ----- Engines ----------------------------------------------------------------

export type EngineKind = "mock" | "openai-compat" | "codex" | "claude-code" | "pi-agent";

export interface EngineConfig {
  id: string;
  kind: EngineKind;
  name: string;
  /** kind-specific config: baseUrl/apiKey/model for openai-compat; binary path for CLIs */
  config: Record<string, string>;
  createdAt: number;
}

/** Counterfactual interventions applied on replay. */
export interface Interventions {
  rewrittenPrompt?: string;
  forceSkill?: string;
  disableSkills?: boolean;
  swapModel?: string;
}

export interface ExecutionRequest {
  sample: Sample;
  targetType: TargetType;
  /** effective prompt text (prompt targets) or system prompt hosting the skill */
  promptText: string;
  /** available skills (skill targets); empty for without-skill arm */
  skills: SkillDef[];
  interventions?: Interventions;
  /** 1-based attempt number within pass^k */
  attempt: number;
}

export interface ExecutionResult {
  output: string;
  trace: TraceStep[];
  tokens: { input: number; output: number };
  durationMs: number;
  /** skill the engine routed to, if any */
  selectedSkill: string | null;
  error: string | null;
}

export interface ExecutionEngine {
  readonly kind: EngineKind;
  execute(req: ExecutionRequest): Promise<ExecutionResult>;
}

// ----- Trace -------------------------------------------------------------------

export type TraceStepType = "llm" | "tool-call" | "routing" | "state" | "side-effect";

export interface TraceStep {
  index: number;
  type: TraceStepType;
  name: string;
  input: string;
  output: string;
  /** the prompt text actually in effect at this step (llm steps) */
  effectivePrompt?: string;
  /** routing steps: which skill was selected and why */
  skillSelected?: string | null;
  durationMs: number;
  tokens?: { input: number; output: number };
}

export interface Trace {
  id: string;
  runId: string;
  steps: TraceStep[];
  createdAt: number;
}

// ----- Grading -----------------------------------------------------------------

export type CheckerKind =
  | "exact-match"
  | "contains"
  | "regex"
  | "json-equal"
  | "code-exec"
  | "final-state"
  | "trajectory-match"
  | "llm-judge"
  | "side-effect";

export interface AssertionResult {
  name: string;
  kind: CheckerKind;
  /** which metric category this assertion feeds */
  metric: MetricName;
  pass: boolean;
  /** 0..1 partial credit where applicable; pass ⇔ score >= threshold */
  score: number;
  evidence: string;
}

/** 3-level side-effect grading — each endpoint is independent. */
export interface SideEffectGrade {
  semanticAcceptance: { pass: boolean; evidence: string };
  auditEvidence: { pass: boolean; evidence: string };
  sandboxHarm: { pass: boolean; evidence: string };
}

export interface Grading {
  assertions: AssertionResult[];
  sideEffect: SideEffectGrade | null;
  /** all required assertions passed */
  pass: boolean;
}

// ----- Experiments & runs ---------------------------------------------------------

export type ExperimentMode = "single" | "ab-prompt" | "ab-skill";
export type Arm = "candidate" | "baseline" | "with-skill" | "without-skill";

export interface EvalConfigSpec {
  /** pass^k attempts per sample per arm */
  k: number;
  /** judge id or 'mock-judge' */
  judgeId: string;
  /** pass^k threshold for a sample to count as reliable-pass */
  passThreshold: number;
}

export interface Experiment {
  id: string;
  name: string;
  targetId: string;
  targetVersionId: string;
  /** for ab-prompt: baseline version */
  baselineVersionId: string | null;
  sampleSetId: string;
  engineId: string;
  mode: ExperimentMode;
  evalConfig: EvalConfigSpec;
  status: "pending" | "running" | "done" | "failed";
  createdAt: number;
  finishedAt: number | null;
}

export interface Run {
  id: string;
  experimentId: string;
  sampleId: string;
  arm: Arm;
  attempt: number;
  output: string;
  selectedSkill: string | null;
  grading: Grading;
  timing: { durationMs: number };
  tokens: { input: number; output: number };
  error: string | null;
  createdAt: number;
}

// ----- Attribution ------------------------------------------------------------------

export const ROOT_CAUSES = [
  "prompt-instruction-defect",
  "wrong-skill-selected",
  "right-skill-executed-poorly",
  "tool-call-error",
  "base-model-error",
] as const;
export type RootCause = (typeof ROOT_CAUSES)[number];

export type InterventionKind = "rewrite-prompt" | "force-skill" | "disable-skill" | "swap-model";

export interface CounterfactualResult {
  intervention: InterventionKind;
  applied: boolean;
  outcomeFlipped: boolean;
  replayOutput: string;
  evidence: string;
}

export interface Attribution {
  id: string;
  runId: string;
  experimentId: string;
  sampleId: string;
  rootCause: RootCause;
  counterfactuals: CounterfactualResult[];
  /** index into the trace where the failure manifests */
  traceStepIndex: number | null;
  /** which layer owns the fix */
  fixLayer: TargetType;
  /** concrete locus + suggestion */
  recommendation: string;
  createdAt: number;
}

// ----- Benchmark / gate ----------------------------------------------------------------

export interface MetricStat {
  mean: number;
  stddev: number;
  /** vs baseline arm; null when no baseline */
  delta: number | null;
}

export interface ArmReport {
  arm: Arm;
  samples: number;
  k: number;
  /** headline pass^k over samples */
  passK: MetricStat;
  perMetric: Record<string, MetricStat>;
  timeMs: MetricStat;
  tokens: MetricStat;
}

export interface BenchmarkReport {
  experimentId: string;
  targetType: TargetType;
  generatedAt: number;
  arms: ArmReport[];
  gate: GateResult | null;
}

export interface GateResult {
  pass: boolean;
  /** metric -> verdict */
  checks: { metric: string; candidate: number; baseline: number; delta: number; pass: boolean }[];
  epsilon: number;
  summary: string;
}

// ----- Optimization -------------------------------------------------------------------

export interface OptimizationSuggestion {
  id: string;
  targetId: string;
  baseVersionId: string;
  /** proposed new content */
  proposedContent: string;
  rationale: string;
  /** attribution ids that motivated this suggestion */
  attributionIds: string[];
  status: "proposed" | "accepted" | "rejected";
  createdAt: number;
}
