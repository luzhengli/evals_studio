# Agent Eval Studio Progress Handoff

## Current State

- Date: 2026-07-05
- Project type: web + backend + cli
- Main server entry point: `src/server/index.ts`
- Main web entry point: `src/web/main.tsx` (React 19 SPA, hash routing)
- Pipeline CLI entry point: `src/pipeline/cli.ts`
- Opt-in real-engine e2e: `src/scripts/codexE2e.ts` (`bun run e2e:codex`)
- Bootstrap command: `bun install`
- Baseline verification: `bun run test`
- Build verification: `bun run build:web`
- Local run command: `bun run dev` at `http://localhost:4747`
- Latest verification (2026-07-05, attribution-eval enhancement session):
  - `bun run test`: 77 pass / 0 fail across 12 files (fully offline).
  - `bunx tsc --noEmit`: clean.
  - `bun run build:web`: emits `public/app.css` + `public/main.js` from the React sources.
  - `bun run e2e:codex`: VERIFIED on this machine against codex-cli 0.139.0 — 2 samples, pass^1 = 1.0, 0 engine errors, timestamped traces with tokens; artifacts in `artifacts/codex-e2e/`.
  - Browser verification via dev server: dashboard, sample-set detail (coverage matrix + analysis progress), run detail (error banner + time-ordered timeline + attribution + agent findings), reports (generate + view + templates) all render with zero console errors; zh/en switch works.
- Default product context: current code, `CLAUDE.md`, `DESIGN.md`, `feature_list.json`, `progress.md`, and the current user instruction.
- Conditional references: `.trae/project-harness/reference/harness-template.md` is a harness template; read it when repairing harness files, not for ordinary product work.

## Startup Checklist

- [ ] Read `CLAUDE.md` for architecture, commands, non-negotiable principles, and code conventions.
- [ ] Read `progress.md` for current handoff state and known constraints.
- [ ] Read `feature_list.json` for acceptance criteria and verification state.
- [ ] Run `bun install` if dependencies are missing or stale.
- [ ] Run `bun run test` before claiming baseline correctness.
- [ ] Run `bun run build:web` when UI or static assets change.

## Completed

- Core domain model defines Prompt and Skill as peer `EvalTarget` types with separate metric taxonomies.
- Bun server exposes JSON API routes and serves the **React 19 SPA** from `public/` (vanilla-TS SPA fully removed — no dual architecture).
- SQLite persistence via `src/db/repo.ts` with typed JSON payloads; additive migrations cover pre-existing databases (samples.capability/tier).
- Mock engine and mock judge support deterministic offline tests and demos.
- Evaluation runner records pass^k experiments, traces, per-metric grades, side-effect safety, and benchmark reports.
- Trace steps carry `startedAt` + `error`; timelines render in wall-clock order with run/step errors surfaced (`src/core/trace.ts`).
- SkillDef aligned with the Agent Skills spec (agentskills.io): description, negativeTriggers, allowed `tools` (graded as an execution boundary), compatibility, metadata + `validateSkillDef` linting (`src/eval/skillSpec.ts`, `POST /api/skills/validate`).
- Capability × tier coverage matrix (B40/A30/E20/R10) with gap analysis (`src/eval/coverage.ts`) surfaced on the sample-set page and in reports.
- Custom attribution agents (scenario + criteria) analyze an experiment's attribution items with tracked progress (`src/attribution/agents.ts`); markdown reports render from customizable `{{placeholder}}` templates (`src/attribution/report.ts`).
- Real codex engine parses `codex exec --json` JSONL events into timestamped trace steps with tokens and errors; `bun run e2e:codex` verifies the full chain opt-in and exits 2 with a blocker message when codex/auth is missing.
- Optimizer adds negative-trigger boundaries from false-activation probes to skill patches; regression gate unchanged.
- Concept help tooltips (pass^k, counterfactual attribution, regression gate, side-effect levels, capability matrix, B/A/E/R, trace step) in accurate zh-CN + en-US.
- `DESIGN.md` follows the google-labs-code/design.md format (YAML front-matter tokens + canonical section order).

## Not Yet Implemented Or Unverified

- No dedicated `lint` script; verification relies on `bun test`, `bunx tsc --noEmit`, and `bun run build:web`.
- `bun run pipeline <experimentId> [outDir]` requires an existing experiment in the configured database.
- claude-code / pi-agent CLI engines remain interface-shape-covered only (no opt-in e2e yet; codex has one).
- The attribution-agent analyzer is deterministic/rule-based; an LLM-judge-backed analyzer can be plugged in via `judgeId` but is not exercised offline.
- Running attribution twice on the same experiment creates duplicate attribution rows (and thus duplicate analysis findings); dedupe is a candidate improvement.

## Known Constraints

- Tests must not hit the network; use deterministic mock engine/judge paths for automated regression coverage.
- Model access must go through `ExecutionEngine` and `Judge` abstractions configured through settings; do not hardcode LLM endpoints.
- DB access should stay behind `src/db/repo.ts`; avoid scattered direct SQL in feature code.
- Side-effecting tools must mutate only isolated sandbox state during evaluation; never execute real external side effects in tests.
- Prompt and Skill remain peer evaluation targets; do not collapse metrics to a single pass/fail.
- UI changes must follow `DESIGN.md`; all copy goes through `src/web/i18n.ts` (zh-CN default + en-US, keep both dictionaries complete).
- `bun run seed -- --force` deletes `data/`; never use it as a default bootstrap step.
- Secrets, API keys, real user data, private traces, and sensitive logs must not be added to harness files.

## Suggested Next Steps

1. Consider deduping attributions per (run, sample, arm) on re-attribution.
2. Add opt-in e2e scripts for claude-code / pi-agent mirroring `e2e:codex`.
3. Consider a `lint`/`typecheck` package script wrapping `bunx tsc --noEmit`.

## Session Log

### 2026-07-05 - Attribution Eval Enhancement (React migration + codex e2e)

- Context read: `CLAUDE.md`, `progress.md`, `feature_list.json`, `README.md`, `DESIGN.md`, full `src/` + `tests/`, agentskills.io specification, google-labs-code/design.md specification.
- Changes: React 19 migration of the whole SPA (old `dom.ts`/`components.ts`/`pages/*.ts` removed); trace `startedAt`/`error` + wall-clock ordering; Agent-Skills-spec SkillDef + allowed-tools grading + spec validator; capability × tier coverage matrix + gaps; attribution agents + analysis tasks + report templates/reports (4 new tables + repo + API); real codex JSONL engine + `bun run e2e:codex`; concept help tooltips; DESIGN.md rewritten to the design.md spec; README/CLAUDE.md updated.
- Verification: `bun run test` 77/77; `bunx tsc --noEmit` clean; `bun run build:web` ok; `bun run e2e:codex` VERIFIED (real codex-cli 0.139.0, artifacts in `artifacts/codex-e2e/`); browser walkthrough of dashboard / samples / run / reports pages with zero console errors.
- Known limitations: see "Not Yet Implemented Or Unverified".

### 2026-07-05 - Harness Supplement

- Created `progress.md`, `feature_list.json`, `init.sh`; `bun run test` passed with 48 tests at that time.
