# Agent Eval Studio

Self-hosted, single-user web app for data-driven evaluation and self-evolution of **Prompts and Skills** used by agentic execution engines (Codex / PI Agent / Claude Code / OpenAI-compatible endpoints).

## Commands

- `bun install` — install deps
- `bun run dev` — build web assets + start server (http://localhost:4747) with watch
- `bun run test` — run all tests (bun:test, no network needed)
- `bun run seed` — seed demo data (two e2e demos: prompt target + skill target)
- `bun run pipeline` — offline CI pipeline: runs evals, emits `artifacts/{timing,grading,benchmark}.json`, applies regression gate (exit code 1 on negative regression)

## Project Harness

`AGENTS.md` intentionally points here, so this file is the primary harness entry for agents.

Fresh-session workflow:

1. Read `CLAUDE.md` for project architecture, commands, principles, and conventions.
2. Read `progress.md` for current handoff state, latest verification, known constraints, and next steps.
3. Read `feature_list.json` for machine-readable acceptance criteria and verification status.
4. Use `./init.sh` for safe baseline bootstrap and verification.

Harness file responsibilities:

- `CLAUDE.md`: stable project rules, architecture, commands, and non-negotiable engineering constraints.
- `progress.md`: dated current state, session handoff, latest verification, and suggested next steps.
- `feature_list.json`: feature acceptance criteria, pass/fail status, verification evidence, and conditional references.
- `init.sh`: safe bootstrap only; it must not seed, delete, migrate, reset data, or call real external engines by default.

Do not mark features passing in `feature_list.json` without real verification evidence. Do not modify `AGENTS.md` unless the project stops using `CLAUDE.md` as the harness entry.

## Architecture

```
src/
  core/types.ts        Domain model: EvalTarget, TargetVersion, Sample, SampleSet,
                       Experiment, Run, Trace, Attribution, BenchmarkReport
  core/ids.ts          id generation
  db/                  SQLite (bun:sqlite) schema + repositories. Single file db at data/studio.db
  engines/             ExecutionEngine interface + implementations:
                       mock (deterministic, drives tests/demos), openai-compat (DeepSeek/GLM/any),
                       codex, claude-code, pi-agent (CLI-backed)
  sandbox/             LM-emulated / in-memory sandbox with snapshot+rollback. Side-effecting
                       tools NEVER execute for real; they mutate an isolated SandboxState.
  eval/
    checkers.ts        Deterministic checkers (exact/contains/regex/json/code-exec/final-state)
    judge.ts           Pluggable Judge interface + LLM-as-Judge with rubric + calibration + mock judge
    sideEffect.ts      3-level side-effect grader: semantic / audit-evidence / sandbox-state-harm
    runner.ts          pass^k experiment runner (k attempts per sample, per arm)
    metrics.ts         pass^k, mean, stddev, delta; per-type metric categories
  attribution/         Counterfactual replay + root-cause classification
                       {prompt-instruction-defect | wrong-skill-selected |
                        right-skill-executed-poorly | tool-call-error | base-model-error}
  optimize/            Prompt rewrite + skill patch suggestions; version diff; regression gate
  pipeline/            Offline CI: timing.json + grading.json -> benchmark.json + gate
  server/              Bun.serve JSON API + static hosting of public/
  web/                 Vanilla-TS SPA (hash routing) + Tailwind CSS v4. Style guide: DESIGN.md
tests/                 bun:test suites; everything runs offline via mock engine/judge
```

## Non-negotiable principles

1. **Attribution over pass-rate.** Every failed run must be attributable: which layer (prompt vs skill), which root cause, which trace step, and a concrete fix locus.
2. **Prompt and Skill are peer EvalTargets** (`type: 'prompt' | 'skill'`) sharing samples, experiments, traces, attribution, versions and gates. Metrics differ:
   - prompt: `instruction_following`, `output_quality`, `side_effect_safety`, `reliability`
   - skill: `trigger_accuracy`, `execution_reliability`, `side_effect_safety`, `composition`
   - Never collapse to a single pass/fail.
3. **Root cause via counterfactual replay**: re-run the same failing sample with interventions (rewrite prompt / force correct skill / disable skill / swap model) and observe outcome flips. Classification order: selection/input layer → execution layer → base model.
4. **pass^k, not pass@1.** All headline metrics are pass^k with mean+stddev+delta.
5. **Side effects are graded on 3 endpoints** (semantic acceptance / audit-visible evidence / sandbox tool-state harm) and never executed for real. Semantic pass ≠ side-effect safe.
6. **Process + outcome scoring.** Oracle available → deterministic checker; otherwise calibrated LLM-judge + rubric.
7. **No hardcoded LLM endpoints.** All model access goes through the `ExecutionEngine`/`Judge` abstractions configured in the settings table.

## Conventions

- TypeScript strict; Bun APIs (`bun:sqlite`, `Bun.serve`, `bun:test`). No Node-only deps.
- DB access only through `src/db/repo.ts`. JSON columns hold typed payloads serialized with `JSON.stringify`.
- All engine/judge calls accept `AbortSignal`-free simple async fns; mock implementations must stay deterministic (seeded) so tests are stable.
- Web UI: no framework; `src/web/dom.ts` `h()` helper; every page follows DESIGN.md tokens.
- Tests must not hit the network. Real engines (codex/claude-code/openai-compat) are covered by interface-shape tests only.
