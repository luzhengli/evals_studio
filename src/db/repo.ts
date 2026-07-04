import type { Database } from "bun:sqlite";
import { getDb } from "./db.ts";
import { id, now } from "../core/ids.ts";
import type {
  Attribution,
  BenchmarkReport,
  EngineConfig,
  EvalTarget,
  Experiment,
  OptimizationSuggestion,
  Run,
  Sample,
  SampleSet,
  TargetVersion,
  Trace,
} from "../core/types.ts";

const J = JSON.stringify;
const P = <T>(s: string | null, fallback: T): T => (s == null ? fallback : (JSON.parse(s) as T));

export class Repo {
  constructor(private db: Database = getDb()) {}

  // ---- targets ----
  createTarget(t: Omit<EvalTarget, "id" | "createdAt" | "activeVersionId">): EvalTarget {
    const row: EvalTarget = { ...t, id: id("tgt"), activeVersionId: null, createdAt: now() };
    this.db
      .query(
        "INSERT INTO targets (id, type, name, description, active_version_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(row.id, row.type, row.name, row.description, row.activeVersionId, row.createdAt);
    return row;
  }

  getTarget(tid: string): EvalTarget | null {
    const r = this.db.query("SELECT * FROM targets WHERE id = ?").get(tid) as any;
    return r ? this.mapTarget(r) : null;
  }

  listTargets(): EvalTarget[] {
    return (this.db.query("SELECT * FROM targets ORDER BY created_at DESC").all() as any[]).map(
      (r) => this.mapTarget(r)
    );
  }

  private mapTarget(r: any): EvalTarget {
    return {
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.description,
      activeVersionId: r.active_version_id,
      createdAt: r.created_at,
    };
  }

  setActiveVersion(targetId: string, versionId: string) {
    this.db.query("UPDATE targets SET active_version_id = ? WHERE id = ?").run(versionId, targetId);
  }

  // ---- versions ----
  createVersion(
    v: Omit<TargetVersion, "id" | "version" | "createdAt">
  ): TargetVersion {
    const maxRow = this.db
      .query("SELECT MAX(version) as v FROM target_versions WHERE target_id = ?")
      .get(v.targetId) as any;
    const version = (maxRow?.v ?? 0) + 1;
    const row: TargetVersion = { ...v, id: id("ver"), version, createdAt: now() };
    this.db
      .query(
        "INSERT INTO target_versions (id, target_id, version, content, parent_version_id, changelog, origin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(row.id, row.targetId, row.version, row.content, row.parentVersionId, row.changelog, row.origin, row.createdAt);
    // first version becomes active automatically
    const t = this.getTarget(v.targetId);
    if (t && !t.activeVersionId) this.setActiveVersion(v.targetId, row.id);
    return row;
  }

  getVersion(vid: string): TargetVersion | null {
    const r = this.db.query("SELECT * FROM target_versions WHERE id = ?").get(vid) as any;
    return r ? this.mapVersion(r) : null;
  }

  listVersions(targetId: string): TargetVersion[] {
    return (
      this.db
        .query("SELECT * FROM target_versions WHERE target_id = ? ORDER BY version ASC")
        .all(targetId) as any[]
    ).map((r) => this.mapVersion(r));
  }

  private mapVersion(r: any): TargetVersion {
    return {
      id: r.id,
      targetId: r.target_id,
      version: r.version,
      content: r.content,
      parentVersionId: r.parent_version_id,
      changelog: r.changelog,
      origin: r.origin,
      createdAt: r.created_at,
    };
  }

  // ---- sample sets ----
  createSampleSet(s: Omit<SampleSet, "id" | "createdAt">): SampleSet {
    const row: SampleSet = { ...s, id: id("set"), createdAt: now() };
    this.db
      .query(
        "INSERT INTO sample_sets (id, target_id, name, description, goal, scenario, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(row.id, row.targetId, row.name, row.description, row.goal, row.scenario, row.createdAt);
    return row;
  }

  getSampleSet(sid: string): SampleSet | null {
    const r = this.db.query("SELECT * FROM sample_sets WHERE id = ?").get(sid) as any;
    return r ? this.mapSampleSet(r) : null;
  }

  listSampleSets(targetId?: string): SampleSet[] {
    const rows = targetId
      ? this.db.query("SELECT * FROM sample_sets WHERE target_id = ? ORDER BY created_at DESC").all(targetId)
      : this.db.query("SELECT * FROM sample_sets ORDER BY created_at DESC").all();
    return (rows as any[]).map((r) => this.mapSampleSet(r));
  }

  private mapSampleSet(r: any): SampleSet {
    return {
      id: r.id,
      targetId: r.target_id,
      name: r.name,
      description: r.description,
      goal: r.goal,
      scenario: r.scenario,
      createdAt: r.created_at,
    };
  }

  // ---- samples ----
  createSample(s: Omit<Sample, "id" | "createdAt">): Sample {
    const row: Sample = { ...s, id: id("smp"), createdAt: now() };
    this.db
      .query(
        `INSERT INTO samples (id, sample_set_id, name, input, ground_truth, expected_trajectory,
          expected_skill, expected_side_effects, tags, source, fresh_as_of, contamination, mock_spec, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.sampleSetId,
        row.name,
        row.input,
        row.groundTruth,
        J(row.expectedTrajectory),
        row.expectedSkill,
        J(row.expectedSideEffects),
        J(row.tags),
        row.source,
        row.freshAsOf,
        J(row.contamination),
        row.mockSpec ? J(row.mockSpec) : null,
        row.createdAt
      );
    return row;
  }

  updateSampleContamination(sampleId: string, contamination: Sample["contamination"]) {
    this.db.query("UPDATE samples SET contamination = ? WHERE id = ?").run(J(contamination), sampleId);
  }

  getSample(sid: string): Sample | null {
    const r = this.db.query("SELECT * FROM samples WHERE id = ?").get(sid) as any;
    return r ? this.mapSample(r) : null;
  }

  listSamples(sampleSetId: string): Sample[] {
    return (
      this.db.query("SELECT * FROM samples WHERE sample_set_id = ? ORDER BY created_at ASC").all(sampleSetId) as any[]
    ).map((r) => this.mapSample(r));
  }

  private mapSample(r: any): Sample {
    return {
      id: r.id,
      sampleSetId: r.sample_set_id,
      name: r.name,
      input: r.input,
      groundTruth: r.ground_truth,
      expectedTrajectory: P(r.expected_trajectory, []),
      expectedSkill: r.expected_skill,
      expectedSideEffects: P(r.expected_side_effects, []),
      tags: P(r.tags, []),
      source: r.source,
      freshAsOf: r.fresh_as_of,
      contamination: P(r.contamination, { audited: false, auditedAt: null, verdict: null, notes: "" }),
      mockSpec: r.mock_spec ? P(r.mock_spec, null) : null,
      createdAt: r.created_at,
    };
  }

  // ---- engines ----
  createEngine(e: Omit<EngineConfig, "id" | "createdAt">): EngineConfig {
    const row: EngineConfig = { ...e, id: id("eng"), createdAt: now() };
    this.db
      .query("INSERT INTO engines (id, kind, name, config, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(row.id, row.kind, row.name, J(row.config), row.createdAt);
    return row;
  }

  getEngine(eid: string): EngineConfig | null {
    const r = this.db.query("SELECT * FROM engines WHERE id = ?").get(eid) as any;
    return r ? { id: r.id, kind: r.kind, name: r.name, config: P(r.config, {}), createdAt: r.created_at } : null;
  }

  listEngines(): EngineConfig[] {
    return (this.db.query("SELECT * FROM engines ORDER BY created_at ASC").all() as any[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      config: P(r.config, {}),
      createdAt: r.created_at,
    }));
  }

  // ---- experiments ----
  createExperiment(e: Omit<Experiment, "id" | "createdAt" | "finishedAt" | "status">): Experiment {
    const row: Experiment = { ...e, id: id("exp"), status: "pending", createdAt: now(), finishedAt: null };
    this.db
      .query(
        `INSERT INTO experiments (id, name, target_id, target_version_id, baseline_version_id,
          sample_set_id, engine_id, mode, eval_config, status, created_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.name,
        row.targetId,
        row.targetVersionId,
        row.baselineVersionId,
        row.sampleSetId,
        row.engineId,
        row.mode,
        J(row.evalConfig),
        row.status,
        row.createdAt,
        row.finishedAt
      );
    return row;
  }

  setExperimentStatus(eid: string, status: Experiment["status"], finishedAt: number | null = null) {
    this.db.query("UPDATE experiments SET status = ?, finished_at = ? WHERE id = ?").run(status, finishedAt, eid);
  }

  getExperiment(eid: string): Experiment | null {
    const r = this.db.query("SELECT * FROM experiments WHERE id = ?").get(eid) as any;
    return r ? this.mapExperiment(r) : null;
  }

  listExperiments(): Experiment[] {
    return (this.db.query("SELECT * FROM experiments ORDER BY created_at DESC").all() as any[]).map((r) =>
      this.mapExperiment(r)
    );
  }

  private mapExperiment(r: any): Experiment {
    return {
      id: r.id,
      name: r.name,
      targetId: r.target_id,
      targetVersionId: r.target_version_id,
      baselineVersionId: r.baseline_version_id,
      sampleSetId: r.sample_set_id,
      engineId: r.engine_id,
      mode: r.mode,
      evalConfig: P(r.eval_config, { k: 3, judgeId: "mock-judge", passThreshold: 1 }),
      status: r.status,
      createdAt: r.created_at,
      finishedAt: r.finished_at,
    };
  }

  // ---- runs ----
  createRun(run: Omit<Run, "id" | "createdAt">): Run {
    const row: Run = { ...run, id: id("run"), createdAt: now() };
    this.db
      .query(
        `INSERT INTO runs (id, experiment_id, sample_id, arm, attempt, output, selected_skill, grading, timing, tokens, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.experimentId,
        row.sampleId,
        row.arm,
        row.attempt,
        row.output,
        row.selectedSkill,
        J(row.grading),
        J(row.timing),
        J(row.tokens),
        row.error,
        row.createdAt
      );
    return row;
  }

  getRun(rid: string): Run | null {
    const r = this.db.query("SELECT * FROM runs WHERE id = ?").get(rid) as any;
    return r ? this.mapRun(r) : null;
  }

  listRuns(experimentId: string): Run[] {
    return (
      this.db.query("SELECT * FROM runs WHERE experiment_id = ? ORDER BY created_at ASC").all(experimentId) as any[]
    ).map((r) => this.mapRun(r));
  }

  private mapRun(r: any): Run {
    return {
      id: r.id,
      experimentId: r.experiment_id,
      sampleId: r.sample_id,
      arm: r.arm,
      attempt: r.attempt,
      output: r.output,
      selectedSkill: r.selected_skill,
      grading: P(r.grading, { assertions: [], sideEffect: null, pass: false }),
      timing: P(r.timing, { durationMs: 0 }),
      tokens: P(r.tokens, { input: 0, output: 0 }),
      error: r.error,
      createdAt: r.created_at,
    };
  }

  // ---- traces ----
  createTrace(t: Omit<Trace, "id" | "createdAt">): Trace {
    const row: Trace = { ...t, id: id("trc"), createdAt: now() };
    this.db
      .query("INSERT INTO traces (id, run_id, steps, created_at) VALUES (?, ?, ?, ?)")
      .run(row.id, row.runId, J(row.steps), row.createdAt);
    return row;
  }

  getTraceByRun(runId: string): Trace | null {
    const r = this.db.query("SELECT * FROM traces WHERE run_id = ?").get(runId) as any;
    return r ? { id: r.id, runId: r.run_id, steps: P(r.steps, []), createdAt: r.created_at } : null;
  }

  // ---- attributions ----
  createAttribution(a: Omit<Attribution, "id" | "createdAt">): Attribution {
    const row: Attribution = { ...a, id: id("att"), createdAt: now() };
    this.db
      .query(
        `INSERT INTO attributions (id, run_id, experiment_id, sample_id, root_cause, counterfactuals,
          trace_step_index, fix_layer, recommendation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.runId,
        row.experimentId,
        row.sampleId,
        row.rootCause,
        J(row.counterfactuals),
        row.traceStepIndex,
        row.fixLayer,
        row.recommendation,
        row.createdAt
      );
    return row;
  }

  listAttributions(experimentId?: string): Attribution[] {
    const rows = experimentId
      ? this.db.query("SELECT * FROM attributions WHERE experiment_id = ? ORDER BY created_at ASC").all(experimentId)
      : this.db.query("SELECT * FROM attributions ORDER BY created_at DESC").all();
    return (rows as any[]).map((r) => ({
      id: r.id,
      runId: r.run_id,
      experimentId: r.experiment_id,
      sampleId: r.sample_id,
      rootCause: r.root_cause,
      counterfactuals: P(r.counterfactuals, []),
      traceStepIndex: r.trace_step_index,
      fixLayer: r.fix_layer,
      recommendation: r.recommendation,
      createdAt: r.created_at,
    }));
  }

  // ---- suggestions ----
  createSuggestion(s: Omit<OptimizationSuggestion, "id" | "createdAt" | "status">): OptimizationSuggestion {
    const row: OptimizationSuggestion = { ...s, id: id("sug"), status: "proposed", createdAt: now() };
    this.db
      .query(
        `INSERT INTO suggestions (id, target_id, base_version_id, proposed_content, rationale, attribution_ids, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(row.id, row.targetId, row.baseVersionId, row.proposedContent, row.rationale, J(row.attributionIds), row.status, row.createdAt);
    return row;
  }

  setSuggestionStatus(sid: string, status: OptimizationSuggestion["status"]) {
    this.db.query("UPDATE suggestions SET status = ? WHERE id = ?").run(status, sid);
  }

  getSuggestion(sid: string): OptimizationSuggestion | null {
    const r = this.db.query("SELECT * FROM suggestions WHERE id = ?").get(sid) as any;
    return r ? this.mapSuggestion(r) : null;
  }

  listSuggestions(targetId?: string): OptimizationSuggestion[] {
    const rows = targetId
      ? this.db.query("SELECT * FROM suggestions WHERE target_id = ? ORDER BY created_at DESC").all(targetId)
      : this.db.query("SELECT * FROM suggestions ORDER BY created_at DESC").all();
    return (rows as any[]).map((r) => this.mapSuggestion(r));
  }

  private mapSuggestion(r: any): OptimizationSuggestion {
    return {
      id: r.id,
      targetId: r.target_id,
      baseVersionId: r.base_version_id,
      proposedContent: r.proposed_content,
      rationale: r.rationale,
      attributionIds: P(r.attribution_ids, []),
      status: r.status,
      createdAt: r.created_at,
    };
  }

  // ---- benchmarks ----
  saveBenchmark(report: BenchmarkReport) {
    this.db
      .query("INSERT OR REPLACE INTO benchmarks (experiment_id, report, created_at) VALUES (?, ?, ?)")
      .run(report.experimentId, J(report), now());
  }

  getBenchmark(experimentId: string): BenchmarkReport | null {
    const r = this.db.query("SELECT report FROM benchmarks WHERE experiment_id = ?").get(experimentId) as any;
    return r ? P(r.report, null) : null;
  }

  // ---- settings ----
  setSetting(key: string, value: string) {
    this.db.query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  getSetting(key: string): string | null {
    const r = this.db.query("SELECT value FROM settings WHERE key = ?").get(key) as any;
    return r ? r.value : null;
  }

  listSettings(): Record<string, string> {
    const rows = this.db.query("SELECT key, value FROM settings").all() as any[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
