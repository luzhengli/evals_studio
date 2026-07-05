# ⊜ Agent Eval Studio

Self-hosted, single-user studio for **data-driven evaluation and self-evolution of Prompts and Skills** used by agentic engines (Codex / Claude Code / PI Agent / any OpenAI-compatible endpoint).

The core output is not a pass rate — it is *attribution*: where did it fail, why, and should you fix the **prompt** or the **skill**.

## Quickstart

```bash
bun install
bun run test          # all suites, fully offline (mock engine + mock judge)
bun run seed          # seed the end-to-end demos (incl. analysis agent + report)
bun run dev           # → http://localhost:4747
bun run e2e:codex     # OPT-IN: verify the full chain on the REAL codex CLI
                      # (requires local `codex` + login; exits 2 with a clear
                      #  blocker message when unavailable — never fakes a pass)
```

## The loop

1. **Build samples** — wizard (goal → scenario → cases → fields); ingest real traces, generate adversarial probes (false-activation / near-miss), audit contamination & freshness. Tag every sample into the **capability × tier matrix** (B basic 40% · A advanced 30% · E edge 20% · R adversarial 10%) — the set page shows the matrix and its coverage gaps, so few cases cross-cover many scenarios.
2. **Run experiments** — experiment = sample set × engine × target version × eval config. Every sample runs **k times (pass^k)**; A/B modes isolate candidate-vs-baseline prompts or with/without-skill arms. Traces record every step with wall-clock start time, duration, input/output, selected skill, tokens and errors; the run page shows them as a time-ordered timeline with run/step errors surfaced.
3. **Attribute failures** — each failing case is replayed under counterfactual interventions (*rewrite prompt / force skill / disable skill / swap model*); the flip pattern classifies the root cause: `prompt-instruction-defect · wrong-skill-selected · right-skill-executed-poorly · tool-call-error · base-model-error`.
4. **Analyze with agents** — create **attribution agents** (analysis scenario + error-attribution criteria); an analysis task pulls an experiment's attribution items, reviews each one under the agent's criteria (progress tracked on the sample-set page) and feeds **markdown reports** rendered from customizable `{{placeholder}}` templates.
5. **Optimize under a gate** — the optimizer turns attributions into prompt rewrites / skill patches (incl. negative-trigger boundaries from false-activation probes); new versions must beat the baseline on pass^k *and every category metric* or the regression gate blocks them.

Skills follow the open **Agent Skills** format (agentskills.io): `SkillDef` carries `description`, trigger + negative-trigger boundaries, `tools` (allowed-tools — out-of-list calls are graded as execution failures), `compatibility` and `metadata`, with a built-in spec validator.

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

TypeScript · Bun · SQLite (`bun:sqlite`) · React 19 · Tailwind CSS v4. The UI is a hash-routed React SPA (zh-CN/en-US i18n, concept help tooltips for pass^k / counterfactuals / gate / side-effect levels / capability matrix / trace steps). See [CLAUDE.md](CLAUDE.md) for architecture and [DESIGN.md](DESIGN.md) for the visual language.
