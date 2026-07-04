// Sample-construction utilities: contamination audit, freshness, adversarial
// variants (false-activation / near-miss are the highest-value samples), and
// trace-replay ingestion (turn a real production trace into a sample).

import type { ContaminationAudit, Sample, TraceStep } from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { id, now } from "../core/ids.ts";

const NINETY_DAYS = 90 * 24 * 3600 * 1000;

export function isStale(sample: Sample, at = now()): boolean {
  return at - sample.freshAsOf > NINETY_DAYS;
}

/**
 * Heuristic contamination audit (structural requirement, cheap and local):
 *  - suspicious markers of public benchmark provenance
 *  - verbatim ground truth embedded in the input (answer leakage)
 * An LLM memorization probe can be layered on via a configured judge.
 */
export function auditContamination(sample: Sample): ContaminationAudit {
  const notes: string[] = [];
  let verdict: ContaminationAudit["verdict"] = "clean";

  const benchmarkMarkers = /\b(GSM8K|MMLU|HumanEval|HellaSwag|tau-bench|BIG-bench|SWE-bench)\b/i;
  if (benchmarkMarkers.test(sample.input)) {
    verdict = "suspect";
    notes.push("input references a public benchmark name");
  }
  if (sample.groundTruth) {
    const gt = sample.groundTruth.replace(/^(exact|regex|json|code):/, "").trim();
    if (gt.length >= 8 && sample.input.includes(gt)) {
      verdict = "contaminated";
      notes.push("ground truth appears verbatim in the input (answer leakage)");
    }
  }
  if (isStale(sample)) notes.push("sample is stale (>90 days since freshAsOf) — refresh recommended");

  return { audited: true, auditedAt: now(), verdict, notes: notes.join("; ") || "no contamination signals" };
}

export function auditSampleSet(repo: Repo, sampleSetId: string): { sampleId: string; audit: ContaminationAudit }[] {
  const out: { sampleId: string; audit: ContaminationAudit }[] = [];
  for (const s of repo.listSamples(sampleSetId)) {
    const audit = auditContamination(s);
    repo.updateSampleContamination(s.id, audit);
    out.push({ sampleId: s.id, audit });
  }
  return out;
}

/**
 * Adversarial variants for skill targets:
 *  - false-activation probe: a task that superficially resembles the trigger
 *    but must NOT invoke the skill (expectedSkill = null)
 *  - near-miss probe: a task just inside the trigger boundary
 */
export function makeFalseActivationProbe(
  base: Omit<Sample, "id" | "createdAt">,
  distractorInput: string
): Omit<Sample, "id" | "createdAt"> {
  return {
    ...base,
    name: `${base.name} (false-activation probe)`,
    input: distractorInput,
    expectedSkill: null,
    tags: [...base.tags.filter((t) => t !== "happy-path"), "false-activation", "adversarial"],
    source: "adversarial",
  };
}

export function makeNearMissProbe(
  base: Omit<Sample, "id" | "createdAt">,
  nearMissInput: string
): Omit<Sample, "id" | "createdAt"> {
  return {
    ...base,
    name: `${base.name} (near-miss probe)`,
    input: nearMissInput,
    tags: [...base.tags.filter((t) => t !== "happy-path"), "near-miss", "adversarial"],
    source: "adversarial",
  };
}

/** Ingest a recorded trace back into a sample (trace replay → regression sample). */
export function sampleFromTrace(
  sampleSetId: string,
  name: string,
  input: string,
  steps: TraceStep[],
  finalOutput: string
): Omit<Sample, "id" | "createdAt"> {
  const trajectory = steps
    .filter((s) => s.type === "tool-call" || (s.type === "routing" && s.skillSelected))
    .map((s) => ({ action: s.type === "routing" ? `skill:${s.skillSelected}` : s.name }));
  const routed = steps.find((s) => s.type === "routing" && s.skillSelected);
  return {
    sampleSetId,
    name,
    input,
    groundTruth: finalOutput ? finalOutput : null,
    expectedTrajectory: trajectory,
    expectedSkill: routed?.skillSelected ?? null,
    expectedSideEffects: [],
    tags: ["happy-path"],
    source: "trace-replay",
    freshAsOf: now(),
    contamination: { audited: false, auditedAt: null, verdict: null, notes: "" },
    mockSpec: null,
  };
}
