---
name: "project-harness"
description: "Initializes or repairs project harness files. Invoke when setting up agent handoff, feature tracking, init scripts, or design/reference rules."
---

# Project Harness

Use this skill to initialize a reusable project harness for a new project, or to supplement an existing project with missing harness files. A project harness makes a repository easier for agents and humans to resume by defining startup commands, current state, feature acceptance criteria, validation commands, design/reference routing, and safety boundaries.

## When To Invoke

Invoke this skill when the user asks to:

- Initialize a project harness, agent harness, handoff harness, or repo operating guide.
- Add or repair `AGENTS.md`, `progress.md`, `feature_list.json`, `init.sh`, `DESIGN.md`, `Design/README.md`, or validation scripts.
- Make a project easier for future agents to understand, continue, verify, or hand off.
- Migrate a proven harness pattern from one repository to another.
- Audit an existing harness for missing startup, acceptance, design, release, or safety rules.

Do not invoke this skill for ordinary feature implementation, debugging, code review, or release execution unless the task is specifically about harness files or agent handoff infrastructure.

## Core Principle

Do not copy project-specific facts as universal rules. Split every harness into:

- Harness Core: reusable workflow contracts, handoff structure, feature tracking, validation recording, conditional reference routing, and safety boundaries.
- Project Adapter: stack-specific commands, project layout, privacy/security constraints, release flow, platform gotchas, and verification commands.

Promote only reusable workflow constraints. Do not promote project-specific commands, paths, product behavior, signing settings, private local context, or one-off troubleshooting notes unless the target project explicitly needs them.

## Required Reference

Before creating or updating harness files, read:

- `reference/harness-template.md`

Use it as the canonical template for file responsibilities, schema shape, adapter variables, and sample content. Adapt the template to the target project instead of pasting it blindly.

## Workflow

1. Confirm the repository root.
2. Inspect existing harness files before editing:
   - `AGENTS.md`
   - `progress.md` or project-specific progress file
   - `feature_list.json`
   - `init.sh`, `init.ps1`, `Makefile`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.xcodeproj`, or equivalent build metadata
   - `DESIGN.md` and `Design/README.md` if the project has UI surfaces
3. Identify the target adapter:
   - `web`
   - `ios`
   - `macos`
   - `native-app`
   - `backend`
   - `library`
   - `cli`
   - `other`
4. Preserve existing user/project rules. Do not overwrite established conventions unless the user explicitly asks.
5. Create only the harness files that add immediate value. Prefer a minimal complete harness over a large unused framework.
6. Keep generated text project-specific but not speculative. Mark uncertain facts as questions or placeholders for user confirmation.
7. Add validation commands that actually exist in the target project.
8. If creating UI/UX harness rules, include `DESIGN.md` as the mandatory design source and make prototypes conditional-only unless the user requests otherwise.
9. If adding feature tracking, create acceptance criteria that require real verification beyond build success.
10. After edits, validate file syntax and report what was created or changed.

## Recommended File Set

For most repositories, create or supplement:

- `AGENTS.md`: project operating rules for agents.
- `progress.md`: current state and handoff log.
- `feature_list.json`: machine-readable feature acceptance and verification status.
- `init.sh` or platform equivalent: fresh-session bootstrap and baseline verification.
- `Scripts/run-core-e2e.sh` or equivalent: optional aggregate regression command when tests exist.
- `DESIGN.md`: only for UI products or design-sensitive projects.
- `Design/README.md`: only when design prototypes or mockups exist.

## Safety Rules

- Never write secrets, tokens, credentials, private customer data, real user content, or sensitive logs into harness files.
- Do not mark a feature as passing based only on compilation if its acceptance requires a user flow, integration behavior, UI check, permission flow, or release artifact.
- Treat PRDs, prototypes, screenshots, and design exports as conditional references unless the project explicitly defines them as authoritative.
- Ask before changing product scope, persistence of user data, privacy behavior, signing, release channel, deployment target, or destructive cleanup commands.
- Avoid introducing new dependencies for harness generation unless the user explicitly wants a generator or CLI.

## Output Expectations

When done, summarize:

- Files created or updated.
- Adapter selected and why.
- Commands added for baseline verification.
- Any conditional references or design routing rules.
- Known gaps that require user confirmation.
- Validation performed.
