// Attribution agents + analysis tasks + report templates, fully offline on
// the mock engine: pull attribution items → agent analysis with progress →
// render a report from a (custom or built-in) template.

import { describe, expect, test } from "bun:test";
import { openDb } from "../src/db/db.ts";
import { Repo } from "../src/db/repo.ts";
import { seedSkillDemo } from "../src/scripts/fixtures.ts";
import { runExperiment } from "../src/eval/runner.ts";
import { attributeExperiment } from "../src/attribution/attribute.ts";
import { analyzeAttribution, runAnalysisTask } from "../src/attribution/agents.ts";
import { ensureDefaultTemplate, generateReport, renderTemplate } from "../src/attribution/report.ts";

describe("attribution agents & analysis reports", () => {
  const repo = new Repo(openDb(":memory:"));
  const demo = seedSkillDemo(repo);
  let experimentId: string;

  test("setup: run experiment + attribution on the skill demo", async () => {
    const exp = repo.createExperiment({
      name: "jira analysis base",
      targetId: demo.target.id,
      targetVersionId: demo.v1.id,
      baselineVersionId: null,
      sampleSetId: demo.sampleSet.id,
      engineId: demo.engine.id,
      mode: "ab-skill",
      evalConfig: { k: 1, judgeId: "mock-judge", passThreshold: 1 },
    });
    experimentId = exp.id;
    await runExperiment(repo, exp.id);
    const attrs = await attributeExperiment(repo, exp.id);
    expect(attrs.length).toBeGreaterThan(0);
  });

  test("analysis task pulls attribution items and tracks progress", () => {
    const agent = repo.createAgent({
      name: "skill triage",
      scenario: "skill trigger regressions in chat support",
      criteria: "focus on wrong-skill-selected and 技能 execution issues",
      judgeId: "mock-judge",
    });
    const attrs = repo.listAttributions(experimentId);
    const task = repo.createAnalysisTask({
      agentId: agent.id,
      experimentId,
      name: "triage run",
      total: attrs.length,
    });
    const done = runAnalysisTask(repo, task.id);

    expect(done.status).toBe("done");
    expect(done.total).toBe(attrs.length);
    expect(done.done).toBe(attrs.length);
    expect(done.findings).toHaveLength(attrs.length);
    expect(done.finishedAt).not.toBeNull();

    // criteria mention skills → skill-cause findings are high severity
    const skillFinding = done.findings.find((f) => f.rootCause === "wrong-skill-selected")!;
    expect(skillFinding.severity).toBe("high");
    expect(skillFinding.notes).toContain("scenario:");
  });

  test("finding agreement follows the confirming counterfactual flip", () => {
    const agent = repo.createAgent({ name: "x", scenario: "", criteria: "", judgeId: "mock-judge" });
    const flipped = {
      id: "a",
      runId: "r",
      sampleId: "nonexistent",
      experimentId,
      rootCause: "wrong-skill-selected" as const,
      counterfactuals: [
        { intervention: "force-skill" as const, applied: true, outcomeFlipped: true, replayOutput: "", evidence: "" },
      ],
      traceStepIndex: null,
      fixLayer: "skill" as const,
      recommendation: "",
      createdAt: 0,
    };
    expect(analyzeAttribution(agent, repo, flipped).agreesWithRootCause).toBe(true);
    const unflipped = { ...flipped, counterfactuals: [{ ...flipped.counterfactuals[0], outcomeFlipped: false }] };
    const f = analyzeAttribution(agent, repo, unflipped);
    expect(f.agreesWithRootCause).toBe(false);
    expect(f.severity).toBe("medium");
  });

  test("built-in template renders a full report with findings and coverage", () => {
    const task = repo.listAnalysisTasks(experimentId)[0];
    const report = generateReport(repo, { experimentId, taskId: task.id });
    expect(report.content).toContain("# Attribution report — jira analysis base");
    expect(report.content).toContain("## Root-cause distribution");
    expect(report.content).toContain("wrong-skill-selected");
    expect(report.content).toContain("[HIGH]");
    expect(report.content).toContain("tier B:");
    expect(repo.getReport(report.id)).not.toBeNull();
  });

  test("custom templates render placeholders; unknown slots stay literal", () => {
    const tpl = repo.createTemplate({
      name: "mini",
      description: "",
      template: "EXP={{experiment}} CAUSES:\n{{causes}}\nUNKNOWN={{nope}}",
      builtIn: false,
    });
    const report = generateReport(repo, { experimentId, templateId: tpl.id, name: "mini report" });
    expect(report.name).toBe("mini report");
    expect(report.content).toContain("EXP=jira analysis base");
    expect(report.content).toContain("UNKNOWN={{nope}}");
  });

  test("renderTemplate is a pure substitution", () => {
    expect(renderTemplate("a {{x}} b {{x}}", { x: "1" })).toBe("a 1 b 1");
  });

  test("default template is seeded once and marked built-in", () => {
    const t1 = ensureDefaultTemplate(repo);
    const t2 = ensureDefaultTemplate(repo);
    expect(t1.id).toBe(t2.id);
    expect(t1.builtIn).toBe(true);
  });
});
