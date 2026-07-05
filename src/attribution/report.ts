// Analysis report generation. Templates are markdown with {{placeholder}}
// slots; users can author their own templates, and a built-in default is
// seeded on first use. Reports are rendered from an experiment's benchmark,
// attributions, analysis findings and sample-set coverage.

import type { AnalysisFinding, AnalysisTask, ReportTemplate } from "../core/types.ts";
import { Repo } from "../db/repo.ts";
import { computeCoverage } from "../eval/coverage.ts";
import { summarizeFailures } from "../optimize/optimizer.ts";

export const DEFAULT_TEMPLATE_NAME = "standard-attribution-report";

export const DEFAULT_TEMPLATE = `# {{title}}

- experiment: {{experiment}} ({{experimentId}})
- target: {{target}} ({{targetType}})
- generated: {{date}}
- analysis agent: {{agent}}

## Headline metrics

{{metrics}}

## Root-cause distribution

{{causes}}

## Analysis findings

{{findings}}

## Coverage (capability × tier)

{{coverage}}

## Recommended next actions

{{actions}}
`;

/** Seed the built-in template once; returns the existing one when present. */
export function ensureDefaultTemplate(repo: Repo): ReportTemplate {
  const existing = repo.listTemplates().find((t) => t.builtIn && t.name === DEFAULT_TEMPLATE_NAME);
  if (existing) return existing;
  return repo.createTemplate({
    name: DEFAULT_TEMPLATE_NAME,
    description: "Built-in: headline metrics + root causes + findings + coverage gaps.",
    template: DEFAULT_TEMPLATE,
    builtIn: true,
  });
}

export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => data[key] ?? m);
}

/** Assemble the placeholder data for an experiment (+ optional analysis task). */
export function buildReportData(repo: Repo, experimentId: string, task: AnalysisTask | null): Record<string, string> {
  const exp = repo.getExperiment(experimentId);
  if (!exp) throw new Error(`experiment not found: ${experimentId}`);
  const target = repo.getTarget(exp.targetId);
  const benchmark = repo.getBenchmark(experimentId);
  const attributions = repo.listAttributions(experimentId);
  const agent = task ? repo.getAgent(task.agentId) : null;
  const samples = repo.listSamples(exp.sampleSetId);
  const coverage = computeCoverage(exp.sampleSetId, samples);

  const metrics = benchmark
    ? benchmark.arms
        .map(
          (arm) =>
            `- **${arm.arm}**: pass^${arm.k} ${arm.passK.mean}±${arm.passK.stddev}` +
            Object.entries(arm.perMetric)
              .map(([m, s]) => ` · ${m} ${s.mean}`)
              .join("")
        )
        .join("\n")
    : "_no benchmark yet — run the experiment first_";

  const causes = attributions.length
    ? summarizeFailures(attributions)
        .map((s) => `- **${s.rootCause}** × ${s.count}\n  - ${s.evidence[0] ?? ""}`)
        .join("\n")
    : "_no attributions — all samples passed or attribution has not been run_";

  const findings = task?.findings.length
    ? task.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.rootCause} — ${f.notes}`).join("\n")
    : "_no analysis findings — run an attribution agent analysis_";

  const coverageLines = [
    coverage.tiers
      .map((t) => `- tier ${t.tier}: ${t.count} (${(t.actual * 100).toFixed(0)}% vs target ${(t.target * 100).toFixed(0)}%)`)
      .join("\n"),
    coverage.gaps.length ? `\n**gaps:**\n${coverage.gaps.map((g) => `- ${g.detail}`).join("\n")}` : "\n_no coverage gaps_",
  ].join("\n");

  const actions = buildActions(task?.findings ?? [], attributions.length, coverage.gaps.length);

  return {
    title: `Attribution report — ${exp.name}`,
    experiment: exp.name,
    experimentId: exp.id,
    target: target?.name ?? "?",
    targetType: target?.type ?? "?",
    date: new Date().toISOString().slice(0, 10),
    agent: agent ? `${agent.name} (${agent.scenario})` : "none",
    metrics,
    causes,
    findings,
    coverage: coverageLines,
    actions,
  };
}

function buildActions(findings: AnalysisFinding[], attributionCount: number, gapCount: number): string {
  const acts: string[] = [];
  const high = findings.filter((f) => f.severity === "high");
  const disputed = findings.filter((f) => !f.agreesWithRootCause);
  if (high.length) acts.push(`address ${high.length} high-severity finding(s) first — they match the agent's criteria or hit edge/adversarial tiers`);
  if (disputed.length) acts.push(`${disputed.length} finding(s) lack a confirming counterfactual flip — re-run attribution or review manually`);
  if (attributionCount > 0) acts.push("generate an optimizer suggestion from these attributions and gate it against the baseline");
  if (gapCount > 0) acts.push(`fill ${gapCount} coverage gap(s) before trusting the headline pass^k`);
  if (!acts.length) acts.push("no failures attributed — consider raising k or adding E/R-tier samples");
  return acts.map((a) => `- ${a}`).join("\n");
}

/** Render + persist a report. */
export function generateReport(
  repo: Repo,
  opts: { experimentId: string; templateId?: string; taskId?: string | null; name?: string }
): ReturnType<Repo["createReport"]> {
  const template = opts.templateId ? repo.getTemplate(opts.templateId) : ensureDefaultTemplate(repo);
  if (!template) throw new Error(`template not found: ${opts.templateId}`);
  const task = opts.taskId ? repo.getAnalysisTask(opts.taskId) : null;
  const data = buildReportData(repo, opts.experimentId, task);
  const content = renderTemplate(template.template, data);
  return repo.createReport({
    name: opts.name ?? data.title,
    templateId: template.id,
    taskId: task?.id ?? null,
    experimentId: opts.experimentId,
    content,
  });
}
