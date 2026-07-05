// Seeds the two DoD e2e demos end-to-end so the UI opens onto a fully worked
// example: experiments run, attributions computed, optimizer suggestion
// accepted, A/B + gate evaluated. Idempotent-ish: refuses to reseed a
// non-empty database unless --force.

import { rmSync } from "node:fs";
import { Repo } from "../db/repo.ts";
import { seedPromptDemo, seedSkillDemo } from "./fixtures.ts";
import { runExperiment } from "../eval/runner.ts";
import { attributeExperiment } from "../attribution/attribute.ts";
import { acceptSuggestion, suggestFromAttributions } from "../optimize/optimizer.ts";
import { auditSampleSet } from "../samples/tools.ts";
import { runAnalysisTask } from "../attribution/agents.ts";
import { generateReport } from "../attribution/report.ts";

const force = process.argv.includes("--force");
if (force) rmSync("data", { recursive: true, force: true });

const repo = new Repo();
if (repo.listTargets().length > 0) {
  console.log("database already seeded — run with --force to reset");
  process.exit(0);
}

console.log("seeding demo 1: prompt target (release-notes-writer)…");
const promptDemo = seedPromptDemo(repo);
auditSampleSet(repo, promptDemo.sampleSet.id);

const exp1 = repo.createExperiment({
  name: "release-notes v1 · pass^3",
  targetId: promptDemo.target.id,
  targetVersionId: promptDemo.v1.id,
  baselineVersionId: null,
  sampleSetId: promptDemo.sampleSet.id,
  engineId: promptDemo.engine.id,
  mode: "single",
  evalConfig: { k: 3, judgeId: "mock-judge", passThreshold: 1 },
});
await runExperiment(repo, exp1.id);
const attrs1 = await attributeExperiment(repo, exp1.id);
console.log(`  attribution: ${attrs1.map((a) => a.rootCause).join(", ")}`);

const suggestion = suggestFromAttributions(repo, promptDemo.target.id, attrs1);
const v2 = acceptSuggestion(repo, suggestion.id);
repo.setActiveVersion(promptDemo.target.id, v2.id);

const exp2 = repo.createExperiment({
  name: "release-notes v2 vs v1 · A/B + gate",
  targetId: promptDemo.target.id,
  targetVersionId: v2.id,
  baselineVersionId: promptDemo.v1.id,
  sampleSetId: promptDemo.sampleSet.id,
  engineId: promptDemo.engine.id,
  mode: "ab-prompt",
  evalConfig: { k: 3, judgeId: "mock-judge", passThreshold: 1 },
});
const res2 = await runExperiment(repo, exp2.id);
console.log(`  gate: ${res2.report.gate?.summary}`);

// a deliberately degraded v3 to show the gate blocking a negative optimization
const v3 = repo.createVersion({
  targetId: promptDemo.target.id,
  content: `${v2.content}\n[worse] Also keep answers extremely terse.`,
  parentVersionId: v2.id,
  changelog: "over-aggressive terseness (demo of a negative optimization)",
  origin: "manual",
});
const exp3 = repo.createExperiment({
  name: "release-notes v3 vs v2 · gate blocks regression",
  targetId: promptDemo.target.id,
  targetVersionId: v3.id,
  baselineVersionId: v2.id,
  sampleSetId: promptDemo.sampleSet.id,
  engineId: promptDemo.engine.id,
  mode: "ab-prompt",
  evalConfig: { k: 3, judgeId: "mock-judge", passThreshold: 1 },
});
const res3 = await runExperiment(repo, exp3.id);
console.log(`  gate: ${res3.report.gate?.summary}`);

console.log("seeding demo 2: skill target (create-jira-ticket)…");
const skillDemo = seedSkillDemo(repo, promptDemo.engine);
auditSampleSet(repo, skillDemo.sampleSet.id);

const exp4 = repo.createExperiment({
  name: "jira skill · with/without A/B · pass^2",
  targetId: skillDemo.target.id,
  targetVersionId: skillDemo.v1.id,
  baselineVersionId: null,
  sampleSetId: skillDemo.sampleSet.id,
  engineId: skillDemo.engine.id,
  mode: "ab-skill",
  evalConfig: { k: 2, judgeId: "mock-judge", passThreshold: 1 },
});
await runExperiment(repo, exp4.id);
const attrs4 = await attributeExperiment(repo, exp4.id);
console.log(`  attribution: ${attrs4.map((a) => a.rootCause).join(", ")}`);
suggestFromAttributions(repo, skillDemo.target.id, attrs4);

console.log("seeding demo 3: attribution agent → analysis → report…");
const agent = repo.createAgent({
  name: "skill-triage",
  scenario: "skill trigger regressions in chat support",
  criteria: "focus on wrong-skill-selected; treat side-effect violations and 技能 execution issues as high severity",
  judgeId: "mock-judge",
});
const task = repo.createAnalysisTask({
  agentId: agent.id,
  experimentId: exp4.id,
  name: `${agent.name} × ${exp4.name}`,
  total: attrs4.length,
});
runAnalysisTask(repo, task.id);
const report = generateReport(repo, { experimentId: exp4.id, taskId: task.id });
console.log(`  analysis findings: ${repo.getAnalysisTask(task.id)?.findings.length} · report: ${report.name}`);

console.log("\nseeded. run `bun run dev` and open http://localhost:4747");
