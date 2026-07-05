// JSON API. Routing is a flat match table; all handlers are sync-ish and
// return plain objects. Experiments run in-process (single-user tool).

import { Repo } from "../db/repo.ts";
import { parseSkill, runExperiment } from "../eval/runner.ts";
import { attributeExperiment } from "../attribution/attribute.ts";
import { runAnalysisTask } from "../attribution/agents.ts";
import { ensureDefaultTemplate, generateReport } from "../attribution/report.ts";
import { acceptSuggestion, suggestFromAttributions } from "../optimize/optimizer.ts";
import { diffLines } from "../optimize/diff.ts";
import { auditSampleSet, makeFalseActivationProbe, makeNearMissProbe } from "../samples/tools.ts";
import { runPipeline } from "../pipeline/pipeline.ts";
import { computeCoverage, nextTierSuggestion } from "../eval/coverage.ts";
import { validateSkillDef } from "../eval/skillSpec.ts";
import { sortTraceSteps, traceErrors } from "../core/trace.ts";
import { now } from "../core/ids.ts";
import type { Sample } from "../core/types.ts";

export interface ApiCtx {
  repo: Repo;
}

type Handler = (ctx: ApiCtx, params: Record<string, string>, body: any, url: URL) => Promise<unknown> | unknown;

const routes: { method: string; pattern: string; handler: Handler }[] = [];
const route = (method: string, pattern: string, handler: Handler) => routes.push({ method, pattern, handler });

// ---- overview ----
route("GET", "/api/overview", ({ repo }) => {
  const targets = repo.listTargets();
  const experiments = repo.listExperiments();
  const attributions = repo.listAttributions();
  const causeCounts: Record<string, number> = {};
  for (const a of attributions) causeCounts[a.rootCause] = (causeCounts[a.rootCause] ?? 0) + 1;
  return {
    targets: targets.length,
    prompts: targets.filter((t) => t.type === "prompt").length,
    skills: targets.filter((t) => t.type === "skill").length,
    experiments: experiments.length,
    experimentsDone: experiments.filter((e) => e.status === "done").length,
    attributions: attributions.length,
    causeCounts,
    recentExperiments: experiments.slice(0, 8).map((e) => ({ ...e, benchmark: repo.getBenchmark(e.id) })),
  };
});

// ---- targets ----
route("GET", "/api/targets", ({ repo }) =>
  repo.listTargets().map((t) => ({
    ...t,
    versions: repo.listVersions(t.id).length,
    sampleSets: repo.listSampleSets(t.id).length,
  }))
);
route("POST", "/api/targets", ({ repo }, _p, body) => {
  const target = repo.createTarget({ type: body.type, name: body.name, description: body.description ?? "" });
  if (body.content) {
    repo.createVersion({
      targetId: target.id,
      content: body.content,
      parentVersionId: null,
      changelog: "initial version",
      origin: "manual",
    });
  }
  return repo.getTarget(target.id);
});
route("GET", "/api/targets/:id", ({ repo }, p) => {
  const target = repo.getTarget(p.id);
  if (!target) throw new NotFound("target");
  return {
    target,
    versions: repo.listVersions(p.id),
    sampleSets: repo.listSampleSets(p.id).map((s) => ({ ...s, samples: repo.listSamples(s.id).length })),
    experiments: repo.listExperiments().filter((e) => e.targetId === p.id),
    suggestions: repo.listSuggestions(p.id),
  };
});
route("POST", "/api/targets/:id/versions", ({ repo }, p, body) => {
  const target = repo.getTarget(p.id);
  if (!target) throw new NotFound("target");
  return repo.createVersion({
    targetId: p.id,
    content: body.content,
    parentVersionId: body.parentVersionId ?? target.activeVersionId,
    changelog: body.changelog ?? "",
    origin: "manual",
  });
});
route("POST", "/api/targets/:id/activate", ({ repo }, p, body) => {
  repo.setActiveVersion(p.id, body.versionId);
  return repo.getTarget(p.id);
});

// ---- versions / diff ----
route("GET", "/api/versions/:a/diff/:b", ({ repo }, p) => {
  const a = repo.getVersion(p.a);
  const b = repo.getVersion(p.b);
  if (!a || !b) throw new NotFound("version");
  return { a, b, diff: diffLines(a.content, b.content) };
});

// ---- sample sets & samples ----
route("GET", "/api/sample-sets", ({ repo }, _p, _b, url) => {
  const targetId = url.searchParams.get("targetId") ?? undefined;
  return repo.listSampleSets(targetId).map((s) => ({
    ...s,
    samples: repo.listSamples(s.id).length,
    targetName: repo.getTarget(s.targetId)?.name ?? "?",
    targetType: repo.getTarget(s.targetId)?.type,
  }));
});
route("POST", "/api/sample-sets", ({ repo }, _p, body) =>
  repo.createSampleSet({
    targetId: body.targetId,
    name: body.name,
    description: body.description ?? "",
    goal: body.goal ?? "",
    scenario: body.scenario ?? "",
  })
);
route("GET", "/api/sample-sets/:id", ({ repo }, p) => {
  const set = repo.getSampleSet(p.id);
  if (!set) throw new NotFound("sample set");
  return { set, target: repo.getTarget(set.targetId), samples: repo.listSamples(p.id) };
});
route("POST", "/api/sample-sets/:id/samples", ({ repo }, p, body) => {
  const base: Omit<Sample, "id" | "createdAt"> = {
    sampleSetId: p.id,
    name: body.name,
    input: body.input,
    capability: body.capability || null,
    tier: body.tier || null,
    groundTruth: body.groundTruth || null,
    expectedTrajectory: body.expectedTrajectory ?? [],
    expectedSkill: body.expectedSkill || null,
    expectedSideEffects: body.expectedSideEffects ?? [],
    tags: body.tags ?? ["happy-path"],
    source: body.source ?? "manual",
    freshAsOf: now(),
    contamination: { audited: false, auditedAt: null, verdict: null, notes: "" },
    mockSpec: body.mockSpec ?? null,
  };
  const created = [repo.createSample(base)];
  if (body.generateFalseActivation && body.falseActivationInput) {
    created.push(repo.createSample(makeFalseActivationProbe(base, body.falseActivationInput)));
  }
  if (body.generateNearMiss && body.nearMissInput) {
    created.push(repo.createSample(makeNearMissProbe(base, body.nearMissInput)));
  }
  return created;
});
route("POST", "/api/sample-sets/:id/audit", ({ repo }, p) => auditSampleSet(repo, p.id));

// ---- coverage matrix (capability × tier, B40/A30/E20/R10) ----
route("GET", "/api/sample-sets/:id/coverage", ({ repo }, p) => {
  const set = repo.getSampleSet(p.id);
  if (!set) throw new NotFound("sample set");
  const report = computeCoverage(p.id, repo.listSamples(p.id));
  return { ...report, nextTier: nextTierSuggestion(report) };
});
route("POST", "/api/samples/:id/coverage", ({ repo }, p, body) => {
  const sample = repo.getSample(p.id);
  if (!sample) throw new NotFound("sample");
  repo.updateSampleCoverage(p.id, body.capability || null, body.tier || null);
  return repo.getSample(p.id);
});

// ---- analysis progress surfaced on the sample-set page ----
route("GET", "/api/sample-sets/:id/analyses", ({ repo }, p) => {
  const set = repo.getSampleSet(p.id);
  if (!set) throw new NotFound("sample set");
  const expIds = new Set(
    repo
      .listExperiments()
      .filter((e) => e.sampleSetId === p.id)
      .map((e) => e.id)
  );
  return repo
    .listAnalysisTasks()
    .filter((t) => expIds.has(t.experimentId))
    .map((t) => ({ ...t, agentName: repo.getAgent(t.agentId)?.name ?? "?" }));
});

// ---- skill spec validation (agentskills.io) ----
route("POST", "/api/skills/validate", (_ctx, _p, body) => {
  try {
    const skill = parseSkill(body.content ?? "");
    return { valid: true, issues: validateSkillDef(skill) };
  } catch (e: any) {
    return { valid: false, issues: [`not a SkillDef JSON: ${e?.message ?? e}`] };
  }
});

// ---- engines ----
route("GET", "/api/engines", ({ repo }) => repo.listEngines());
route("POST", "/api/engines", ({ repo }, _p, body) =>
  repo.createEngine({ kind: body.kind, name: body.name, config: body.config ?? {} })
);

// ---- experiments ----
route("GET", "/api/experiments", ({ repo }) =>
  repo.listExperiments().map((e) => ({
    ...e,
    targetName: repo.getTarget(e.targetId)?.name ?? "?",
    targetType: repo.getTarget(e.targetId)?.type,
    benchmark: repo.getBenchmark(e.id),
  }))
);
route("POST", "/api/experiments", ({ repo }, _p, body) =>
  repo.createExperiment({
    name: body.name,
    targetId: body.targetId,
    targetVersionId: body.targetVersionId,
    baselineVersionId: body.baselineVersionId ?? null,
    sampleSetId: body.sampleSetId,
    engineId: body.engineId,
    mode: body.mode ?? "single",
    evalConfig: {
      k: Number(body.k ?? 3),
      judgeId: body.judgeId ?? "mock-judge",
      passThreshold: Number(body.passThreshold ?? 1),
    },
  })
);
route("GET", "/api/experiments/:id", ({ repo }, p) => {
  const exp = repo.getExperiment(p.id);
  if (!exp) throw new NotFound("experiment");
  const runs = repo.listRuns(p.id);
  const samples = Object.fromEntries(repo.listSamples(exp.sampleSetId).map((s) => [s.id, s]));
  return {
    experiment: exp,
    target: repo.getTarget(exp.targetId),
    benchmark: repo.getBenchmark(p.id),
    runs: runs.map((r) => ({ ...r, sampleName: samples[r.sampleId]?.name ?? r.sampleId })),
    attributions: repo.listAttributions(p.id),
  };
});
route("POST", "/api/experiments/:id/run", async ({ repo }, p) => {
  const { report } = await runExperiment(repo, p.id);
  return { report };
});
route("POST", "/api/experiments/:id/attribute", async ({ repo }, p) => {
  const attributions = await attributeExperiment(repo, p.id);
  return { attributions };
});
route("POST", "/api/experiments/:id/pipeline", async ({ repo }, p) => {
  const res = await runPipeline(repo, p.id, `artifacts/${p.id}`);
  return { gatePass: res.gatePass, outDir: `artifacts/${p.id}`, benchmark: res.artifacts.benchmark };
});

// ---- runs & traces ----
// Full execution chain for one question: run + sample + time-ordered trace
// (with step errors surfaced) + attribution + agent analysis findings.
route("GET", "/api/runs/:id", ({ repo }, p) => {
  const run = repo.getRun(p.id);
  if (!run) throw new NotFound("run");
  const sample = repo.getSample(run.sampleId);
  const rawTrace = repo.getTraceByRun(p.id);
  const steps = rawTrace ? sortTraceSteps(rawTrace.steps) : [];
  const attribution = repo.listAttributions(run.experimentId).find((a) => a.runId === run.id) ?? null;
  const findings = repo
    .listAnalysisTasks(run.experimentId)
    .flatMap((t) =>
      t.findings
        .filter((f) => f.runId === run.id)
        .map((f) => ({ ...f, taskId: t.id, taskName: t.name, agentName: repo.getAgent(t.agentId)?.name ?? "?" }))
    );
  return {
    run,
    sample,
    trace: rawTrace ? { ...rawTrace, steps } : null,
    stepErrors: traceErrors(steps),
    attribution,
    findings,
    experiment: repo.getExperiment(run.experimentId),
  };
});

// ---- attributions ----
route("GET", "/api/attributions", ({ repo }, _p, _b, url) => {
  const expId = url.searchParams.get("experimentId") ?? undefined;
  return repo.listAttributions(expId).map((a) => {
    const sample = repo.getSample(a.sampleId);
    const exp = repo.getExperiment(a.experimentId);
    return { ...a, sampleName: sample?.name ?? a.sampleId, experimentName: exp?.name ?? a.experimentId };
  });
});

// ---- optimization ----
route("POST", "/api/targets/:id/suggest", ({ repo }, p, body) => {
  const attrs = repo.listAttributions(body.experimentId);
  if (attrs.length === 0) throw new ApiError(400, "no attributions for this experiment — run attribution first");
  return suggestFromAttributions(repo, p.id, attrs);
});
route("POST", "/api/suggestions/:id/accept", ({ repo }, p) => acceptSuggestion(repo, p.id));
route("POST", "/api/suggestions/:id/reject", ({ repo }, p) => {
  repo.setSuggestionStatus(p.id, "rejected");
  return { ok: true };
});

// ---- attribution agents ----
route("GET", "/api/agents", ({ repo }) => repo.listAgents());
route("POST", "/api/agents", ({ repo }, _p, body) => {
  if (!body.name?.trim()) throw new ApiError(400, "agent name is required");
  return repo.createAgent({
    name: body.name.trim(),
    scenario: body.scenario ?? "",
    criteria: body.criteria ?? "",
    judgeId: body.judgeId?.trim() || "mock-judge",
  });
});

// ---- analysis tasks (pull attribution items, analyze with a chosen agent) ----
route("GET", "/api/experiments/:id/analyses", ({ repo }, p) =>
  repo.listAnalysisTasks(p.id).map((t) => ({ ...t, agentName: repo.getAgent(t.agentId)?.name ?? "?" }))
);
route("POST", "/api/experiments/:id/analyses", ({ repo }, p, body) => {
  const exp = repo.getExperiment(p.id);
  if (!exp) throw new NotFound("experiment");
  const agent = repo.getAgent(body.agentId);
  if (!agent) throw new ApiError(400, "agentId is required — create an attribution agent first");
  const items = repo.listAttributions(p.id);
  if (items.length === 0) throw new ApiError(400, "no attribution items for this experiment — run attribution first");
  const task = repo.createAnalysisTask({
    agentId: agent.id,
    experimentId: p.id,
    name: body.name?.trim() || `${agent.name} × ${exp.name}`,
    total: items.length,
  });
  return runAnalysisTask(repo, task.id);
});
route("GET", "/api/analyses/:id", ({ repo }, p) => {
  const task = repo.getAnalysisTask(p.id);
  if (!task) throw new NotFound("analysis task");
  return { ...task, agent: repo.getAgent(task.agentId), experiment: repo.getExperiment(task.experimentId) };
});

// ---- report templates ----
route("GET", "/api/templates", ({ repo }) => {
  ensureDefaultTemplate(repo);
  return repo.listTemplates();
});
route("POST", "/api/templates", ({ repo }, _p, body) => {
  if (!body.name?.trim() || !body.template?.trim()) throw new ApiError(400, "template name and content are required");
  return repo.createTemplate({
    name: body.name.trim(),
    description: body.description ?? "",
    template: body.template,
    builtIn: false,
  });
});
route("PUT", "/api/templates/:id", ({ repo }, p, body) => {
  const tpl = repo.getTemplate(p.id);
  if (!tpl) throw new NotFound("template");
  if (tpl.builtIn) throw new ApiError(400, "built-in templates cannot be edited — create a copy instead");
  repo.updateTemplate(p.id, { name: body.name, description: body.description, template: body.template });
  return repo.getTemplate(p.id);
});

// ---- analysis reports ----
route("GET", "/api/reports", ({ repo }, _p, _b, url) => {
  const expId = url.searchParams.get("experimentId") ?? undefined;
  return repo.listReports(expId).map((r) => ({
    ...r,
    experimentName: repo.getExperiment(r.experimentId)?.name ?? r.experimentId,
    templateName: repo.getTemplate(r.templateId)?.name ?? r.templateId,
  }));
});
route("POST", "/api/reports", ({ repo }, _p, body) => {
  if (!body.experimentId) throw new ApiError(400, "experimentId is required");
  return generateReport(repo, {
    experimentId: body.experimentId,
    templateId: body.templateId || undefined,
    taskId: body.taskId || null,
    name: body.name || undefined,
  });
});
route("GET", "/api/reports/:id", ({ repo }, p) => {
  const rep = repo.getReport(p.id);
  if (!rep) throw new NotFound("report");
  return rep;
});

// ---- settings ----
route("GET", "/api/settings", ({ repo }) => repo.listSettings());
route("PUT", "/api/settings", ({ repo }, _p, body) => {
  for (const [k, v] of Object.entries(body ?? {})) repo.setSetting(k, String(v));
  return repo.listSettings();
});

// ---- dispatch ----
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
class NotFound extends ApiError {
  constructor(what: string) {
    super(404, `${what} not found`);
  }
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const ps = pattern.split("/");
  const xs = path.split("/");
  if (ps.length !== xs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].startsWith(":")) params[ps[i].slice(1)] = decodeURIComponent(xs[i]);
    else if (ps[i] !== xs[i]) return null;
  }
  return params;
}

export async function handleApi(ctx: ApiCtx, req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/")) return null;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const params = matchPattern(r.pattern, url.pathname);
    if (!params) continue;
    try {
      const body = req.method === "GET" ? null : await req.json().catch(() => ({}));
      const result = await r.handler(ctx, params, body, url);
      return Response.json(result);
    } catch (e: any) {
      const status = e instanceof ApiError ? e.status : 500;
      return Response.json({ error: String(e?.message ?? e) }, { status });
    }
  }
  return Response.json({ error: "no such endpoint" }, { status: 404 });
}
