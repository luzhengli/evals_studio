// Opt-in end-to-end verification against the REAL codex CLI.
//
//   bun run e2e:codex          # requires a local `codex` binary + login
//
// Never runs as part of `bun test` (fully offline there). The flow covers the
// whole chain on a real engine: target → sample set → experiment → run →
// trace → grading → attribution (on failures). Artifacts land in
// artifacts/codex-e2e/. Exit codes: 0 = verified · 2 = blocked (no binary or
// no auth) · 1 = ran but failed.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../db/db.ts";
import { Repo } from "../db/repo.ts";
import { now } from "../core/ids.ts";
import { runExperiment } from "../eval/runner.ts";
import { attributeExperiment } from "../attribution/attribute.ts";

const OUT_DIR = "artifacts/codex-e2e";
const BIN = process.env.CODEX_BIN ?? "codex";

async function preflight(): Promise<string | null> {
  const found = Bun.which(BIN);
  if (!found) return `codex binary not found ("${BIN}"). Install codex CLI or set CODEX_BIN.`;
  const proc = Bun.spawn([BIN, "--version"], { stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) return `"${BIN} --version" exited ${code} — CLI unusable.`;
  const home = process.env.CODEX_HOME ?? join(process.env.HOME ?? "", ".codex");
  if (!existsSync(join(home, "auth.json")))
    return `no codex auth found at ${join(home, "auth.json")} — run "codex login" first.`;
  return null;
}

async function main() {
  const blocker = await preflight();
  if (blocker) {
    console.error(`BLOCKED: ${blocker}`);
    console.error("This opt-in verification cannot run on this machine; nothing was executed.");
    process.exit(2);
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const repo = new Repo(openDb(join(OUT_DIR, "studio.db")));

  const engine = repo.createEngine({
    kind: "codex",
    name: "codex CLI (real)",
    config: { bin: BIN, timeoutMs: "240000" },
  });

  const target = repo.createTarget({
    type: "prompt",
    name: "codex-e2e-precision-prompt",
    description: "Minimal real-engine prompt: exact-format compliance.",
  });
  const v1 = repo.createVersion({
    targetId: target.id,
    content:
      "You are a precise assistant. Follow the task instructions EXACTLY. Reply with only what is asked — no extra words, no punctuation beyond what is required.",
    parentVersionId: null,
    changelog: "initial",
    origin: "manual",
  });

  const set = repo.createSampleSet({
    targetId: target.id,
    name: "codex-e2e minimal set",
    description: "two deterministic-oracle samples",
    goal: "verify the real codex engine end to end",
    scenario: "offline CI cannot cover real engines; this opt-in run does",
  });
  const contamination = { audited: false, auditedAt: null, verdict: null, notes: "" };
  const base = {
    sampleSetId: set.id,
    capability: "format-compliance",
    expectedTrajectory: [],
    expectedSkill: null,
    expectedSideEffects: [],
    source: "manual" as const,
    freshAsOf: now(),
    contamination,
    mockSpec: null,
  };
  repo.createSample({ ...base, name: "exact-ok", input: "Reply with exactly: OK", groundTruth: "exact:OK", tags: ["happy-path"], tier: "B" });
  repo.createSample({ ...base, name: "arithmetic", input: "What is 2+3? Reply with just the number.", groundTruth: "exact:5", tags: ["happy-path"], tier: "B" });

  const exp = repo.createExperiment({
    name: "codex real-engine e2e",
    targetId: target.id,
    targetVersionId: v1.id,
    baselineVersionId: null,
    sampleSetId: set.id,
    engineId: engine.id,
    mode: "single",
    evalConfig: { k: 1, judgeId: "mock-judge", passThreshold: 1 },
  });

  console.log(`running experiment ${exp.id} on real codex (2 samples × k=1)…`);
  const { runs, report } = await runExperiment(repo, exp.id);

  const failures = runs.filter((r) => !r.grading.pass);
  let attributions: unknown[] = [];
  if (failures.length > 0) {
    console.log(`${failures.length} failing run(s) — running counterfactual attribution on the real engine…`);
    attributions = await attributeExperiment(repo, exp.id);
  }

  const traces = runs.map((r) => ({ runId: r.id, trace: repo.getTraceByRun(r.id) }));
  await Bun.write(join(OUT_DIR, "benchmark.json"), JSON.stringify(report, null, 2));
  await Bun.write(join(OUT_DIR, "runs.json"), JSON.stringify(runs, null, 2));
  await Bun.write(join(OUT_DIR, "traces.json"), JSON.stringify(traces, null, 2));
  await Bun.write(join(OUT_DIR, "attributions.json"), JSON.stringify(attributions, null, 2));

  const arm = report.arms[0];
  const engineErrors = runs.filter((r) => r.error).length;
  const summary = [
    `# codex real-engine e2e — ${new Date().toISOString()}`,
    ``,
    `- codex: ${Bun.which(BIN)}`,
    `- experiment: ${exp.id} (${exp.name})`,
    `- samples: ${arm.samples} · k=1 · pass^1 = ${arm.passK.mean}`,
    `- runs: ${runs.length} · engine errors: ${engineErrors}`,
    `- trace steps recorded: ${traces.reduce((a, t) => a + (t.trace?.steps.length ?? 0), 0)} (timestamped, includes tokens)`,
    `- attributions: ${attributions.length}`,
    ``,
    `verdict: ${engineErrors === 0 && arm.samples === 2 ? "VERIFIED — full chain executed on the real codex CLI" : "COMPLETED WITH ERRORS — inspect runs.json"}`,
  ].join("\n");
  await Bun.write(join(OUT_DIR, "result.md"), summary);
  console.log(`\n${summary}\n\nartifacts: ${OUT_DIR}/`);

  process.exit(engineErrors === 0 ? 0 : 1);
}

main();
