# Agent Eval Studio Progress Handoff

## Current State

- Date: 2026-07-05
- Project type: web + backend + cli
- Main server entry point: `src/server/index.ts`
- Main web entry point: `src/web/main.ts`
- Pipeline CLI entry point: `src/pipeline/cli.ts`
- Bootstrap command: `bun install`
- Baseline verification: `bun run test`
- Build verification: `bun run build:web`
- Local run command: `bun run dev` at `http://localhost:4747`
- Latest verification: `./init.sh` passed on 2026-07-05 after running Bun check, `bun install`, `bun run test`, and `bun run build:web`.
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
- Bun server exposes JSON API routes and serves the vanilla TypeScript SPA from `public/`.
- SQLite persistence is centralized through `src/db/repo.ts` with typed JSON payloads.
- Mock engine and mock judge support deterministic offline tests and demos.
- Evaluation runner records pass^k experiments, traces, per-metric grades, side-effect safety, and benchmark reports.
- Attribution flow uses counterfactual replay to classify prompt, skill-selection, skill-execution, tool, and base-model failure causes.
- Optimizer and regression gate support prompt rewrite / skill patch suggestions and candidate-vs-baseline blocking.
- Project design language is documented in `DESIGN.md`.
- Project harness skill and reusable template live under `.trae/project-harness/`.

## Not Yet Implemented Or Unverified

- No dedicated `lint` or `typecheck` package script exists; `tsconfig.json` is strict with `noEmit`, but verification currently relies on Bun test/build scripts.
- `bun run pipeline <experimentId> [outDir]` requires an existing experiment in the configured database.
- Real engines (`openai-compat`, `codex`, `claude-code`, `pi-agent`) are not part of the offline test path beyond interface-shape coverage.
- `bun run seed -- --force` or equivalent force seeding is destructive because it can delete `data/`; do not use it as a default bootstrap step.
- See `feature_list.json` for machine-readable acceptance status and follow-up candidates.

## Known Constraints

- Tests must not hit the network; use deterministic mock engine/judge paths for automated regression coverage.
- Model access must go through `ExecutionEngine` and `Judge` abstractions configured through settings; do not hardcode LLM endpoints.
- DB access should stay behind `src/db/repo.ts`; avoid scattered direct SQL in feature code.
- Side-effecting tools must mutate only isolated sandbox state during evaluation; never execute real external side effects in tests.
- Prompt and Skill remain peer evaluation targets; do not collapse metrics to a single pass/fail.
- UI changes must follow `DESIGN.md` and the no-framework `src/web/dom.ts` helper pattern.
- Secrets, API keys, real user data, private traces, and sensitive logs must not be added to harness files.

## Suggested Next Steps

1. Run `bun run test` and record the result in `feature_list.json`.
2. Run `bun run build:web` and record the result in `feature_list.json`.
3. Decide whether a separate `lint` or `typecheck` script is worth adding to `package.json`.
4. Seed demo data only when needed for manual UI review, and avoid force-resetting `data/` without explicit approval.

## Session Log

### 2026-07-05 - Harness Supplement

- Context read: `AGENTS.md`, `CLAUDE.md`, `README.md`, `DESIGN.md`, `package.json`, `tsconfig.json`, `.trae/project-harness/SKILL.md`, `.trae/project-harness/reference/harness-template.md`, representative source and test files.
- Changes made: created `progress.md`, `feature_list.json`, and `init.sh`; left `AGENTS.md` unchanged because it already points to `CLAUDE.md`.
- Verification: `feature_list.json` parsed successfully; `bash -n init.sh` passed; `chmod +x init.sh` applied; `bun run test` passed with 48 tests; `bun run build:web` passed after `bun install`; default `./init.sh` passed end to end.
- Known limitations: no product feature was newly implemented; this session only added project handoff infrastructure.
- Follow-up: consider adding a dedicated `lint` or `typecheck` script if stricter non-test verification becomes useful.
