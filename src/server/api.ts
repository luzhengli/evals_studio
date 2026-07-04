// JSON API. Routing is a flat match table; all handlers are sync-ish and
// return plain objects. Experiments run in-process (single-user tool).

import { Repo } from "../db/repo.ts";
import { runExperiment } from "../eval/runner.ts";
import { attributeExperiment } from "../attribution/attribute.ts";
import { acceptSuggestion, suggestFromAttributions } from "../optimize/optimizer.ts";
import { diffLines } from "../optimize/diff.ts";
import { auditSampleSet, makeFalseActivationProbe, makeNearMissProbe } from "../samples/tools.ts";
import { runPipeline } from "../pipeline/pipeline.ts";
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
route("GET", "/api/runs/:id", ({ repo }, p) => {
  const run = repo.getRun(p.id);
  if (!run) throw new NotFound("run");
  const sample = repo.getSample(run.sampleId);
  return { run, sample, trace: repo.getTraceByRun(p.id) };
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
