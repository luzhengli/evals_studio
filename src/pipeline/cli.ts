// CLI: bun src/pipeline/cli.ts <experimentId> [outDir]
// Exits 1 when the regression gate fails — wire this into CI.

import { Repo } from "../db/repo.ts";
import { runPipeline } from "./pipeline.ts";

const [experimentId, outDir = "artifacts"] = process.argv.slice(2);
if (!experimentId) {
  console.error("usage: bun src/pipeline/cli.ts <experimentId> [outDir]");
  const repo = new Repo();
  const exps = repo.listExperiments();
  if (exps.length) {
    console.error("\navailable experiments:");
    for (const e of exps) console.error(`  ${e.id}  ${e.name} (${e.status})`);
  }
  process.exit(2);
}

const repo = new Repo();
const { artifacts, gatePass } = await runPipeline(repo, experimentId, outDir);

const bm = artifacts.benchmark;
console.log(`benchmark written to ${outDir}/benchmark.json`);
for (const arm of bm.arms) {
  console.log(
    `  ${arm.arm}: pass^${arm.k} = ${arm.passK.mean.toFixed(4)} ± ${arm.passK.stddev.toFixed(4)}` +
      (arm.passK.delta != null ? ` (Δ ${arm.passK.delta >= 0 ? "+" : ""}${arm.passK.delta.toFixed(4)})` : "")
  );
}
if (bm.gate) {
  console.log(bm.gate.pass ? `GATE PASS — ${bm.gate.summary}` : `GATE FAIL — ${bm.gate.summary}`);
}
process.exit(gatePass ? 0 : 1);
