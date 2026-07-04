# ⊜ Agent Eval Studio

Self-hosted, single-user studio for **data-driven evaluation and self-evolution of Prompts and Skills** used by agentic engines (Codex / Claude Code / PI Agent / any OpenAI-compatible endpoint).

The core output is not a pass rate — it is *attribution*: where did it fail, why, and should you fix the **prompt** or the **skill**.

## Quickstart

```bash
bun install
bun run test          # all suites, fully offline (mock engine + mock judge)
bun run seed          # seed the two end-to-end demos
bun run dev           # → http://localhost:4747
```

## The loop

1. **Build samples** — wizard (goal → scenario → cases → fields); ingest real traces, generate adversarial probes (false-activation / near-miss), audit contamination & freshness.
2. **Run experiments** — experiment = sample set × engine × target version × eval config. Every sample runs **k times (pass^k)**; A/B modes isolate candidate-vs-baseline prompts or with/without-skill arms.
3. **Attribute failures** — each failing case is replayed under counterfactual interventions (*rewrite prompt / force skill / disable skill / swap model*); the flip pattern classifies the root cause: `prompt-instruction-defect · wrong-skill-selected · right-skill-executed-poorly · tool-call-error · base-model-error`.
4. **Optimize under a gate** — the optimizer turns attributions into prompt rewrites / skill patches; new versions must beat the baseline on pass^k *and every category metric* or the regression gate blocks them.

## Metrics (never a single pass/fail)

| target | categories |
|---|---|
| prompt | instruction_following · output_quality · side_effect_safety · reliability |
| skill | trigger_accuracy · execution_reliability · side_effect_safety · composition |

All headline numbers are **pass^k** with mean ± stddev (+ delta vs baseline).

Side effects are graded on **three independent endpoints** — semantic acceptance, audit-visible evidence, sandbox tool-state harm — and only ever execute against an in-memory sandbox with snapshot/rollback. A semantic pass never implies safety.

## CI pipeline

```bash
bun run pipeline <experimentId> [outDir]
# emits timing.json, grading.json (per-assertion PASS/FAIL + evidence),
# benchmark.json (pass_rate/time/tokens mean+stddev+delta, same schema for both target types)
# exit code 1 when the regression gate fails
```

## Stack

TypeScript · Bun · SQLite (`bun:sqlite`) · Tailwind CSS v4 · no frontend framework. See [CLAUDE.md](CLAUDE.md) for architecture and [DESIGN.md](DESIGN.md) for the visual language.
