# Project Harness Template

This reference defines a reusable project harness that can be adapted to web, native app, iOS, macOS, backend, library, and CLI projects. Use it to initialize a new harness or repair an incomplete one.

## 1. Harness Model

Every project harness has two layers:

- Harness Core: reusable agent workflow, handoff files, feature acceptance tracking, validation recording, design/reference routing, and safety rules.
- Project Adapter: stack-specific commands, project layout, platform constraints, privacy/security boundaries, release workflow, and environment gotchas.

Promote:

- Startup and verification entry points.
- Cross-session progress handoff.
- Machine-readable feature acceptance.
- Conditional reference document routing.
- Design source routing for UI work.
- Explicit conflict priority.
- Safety boundaries for secrets, user data, permissions, signing, release, and destructive operations.

Do not promote:

- Product-specific behavior.
- Repo-specific paths that do not exist in the target project.
- Platform-specific commands as universal defaults.
- Release or signing details that are not true for the target project.
- Private local context, raw logs, secrets, or user data.
- Stale PRD or prototype contents as default truth.

## 2. Recommended Files

```text
<repo>/
├── AGENTS.md
├── progress.md
├── feature_list.json
├── init.sh                  # or init.ps1 / Makefile / package script
├── Scripts/
│   └── run-core-e2e.sh       # optional, when repeatable checks exist
├── DESIGN.md                # UI projects only
└── Design/
    └── README.md             # only when prototypes/mockups exist
```

Use project-specific names only when the repository already has a convention. For example, `parrot-progress.md` is acceptable in the Parrot project, but new projects should prefer `progress.md` unless there is a reason to namespace it.

## 3. `AGENTS.md` Template

```markdown
# Project: <PROJECT_NAME>

<One paragraph describing what the project is, target users, platform/runtime, and core product or library purpose.>

## Commands

- Bootstrap / verify: `<COMMAND>`
- Run locally: `<COMMAND>`
- Test: `<COMMAND>`
- Lint / typecheck: `<COMMAND>`
- Build: `<COMMAND>`
- Package / release: `<COMMAND or "Not configured">`

## Layout

- `<path>/` contains <purpose>.
- `<path>/` contains <purpose>.
- `<path>/` contains <purpose>.
- `progress.md` records current state, known issues, and next steps.
- `feature_list.json` records feature acceptance criteria and verification state.

## Product Constraints

- <Project-specific scope constraint.>
- <Privacy/security/user-data constraint.>
- <Platform/runtime constraint.>
- <Persistence constraint.>

## Code Conventions

- <Language/runtime version.>
- <Framework conventions.>
- <Dependency policy.>
- <Error handling policy.>
- <Testing convention.>

## Design Harness

- `DESIGN.md` is the mandatory design source for UI/UX work when this project has user-facing UI.
- Before UI work, read and align with `DESIGN.md`.
- Do not rewrite `DESIGN.md` during ordinary feature work.
- Use prototypes or mockups only when the user explicitly asks to reference them.
- If `Design/` exists, treat it as conditional reference assets unless this project explicitly states otherwise.
- Conflict priority: user instruction > privacy/security/platform constraints > current code > `DESIGN.md` > conditional references.

## Workflow

- For non-trivial tasks, start by reading `progress.md` and `feature_list.json`.
- Use `<BOOTSTRAP_COMMAND>` as the baseline fresh-session verification command.
- Before implementing product functionality, choose a high-priority feature with `passes: false` unless the user asks for a different task.
- Build success is only a baseline; mark a feature passing only after verifying its acceptance criteria.
- After feature work, update `feature_list.json` with status, `last_verified`, and notes, then update `progress.md`.
- Read PRDs, specs, design prototypes, or planning docs only when the user explicitly asks for alignment/review or the task is planning work.

## Release Workflow

- <Release command or "Not configured yet".>
- <Versioning/tagging rule.>
- <Packaging/signing/deployment rule.>
- <Release validation command.>

## Gotchas

- <Known environment issue.>
- <Known permission or platform issue.>
- <Known test limitation.>
- <Known generated file or build output rule.>

## When In Doubt

- Ask before changing product scope, privacy behavior, signing, release channel, deployment target, or persistence of user data.
- Ask before deleting files, migrating data, restructuring project layout, or adding dependencies.
- If docs conflict with current code or user intent, call out the mismatch before coding.
```

## 4. `progress.md` Template

```markdown
# <PROJECT_NAME> Progress Handoff

## Current State

- Date: <YYYY-MM-DD>
- Project type: <web / ios / macos / backend / library / cli / other>
- Main entry point: `<path>`
- Bootstrap command: `<command>`
- Latest verification: <short factual summary>
- Default product context: current code, `feature_list.json`, `progress.md`, and current user instruction.
- Conditional references: <PRDs/designs/specs are read only when explicitly requested, if applicable.>

## Startup Checklist

- [ ] Can bootstrap: `<command>`
- [ ] Can run tests: `<command>`
- [ ] Can build: `<command>`
- [ ] Can inspect progress: `progress.md`
- [ ] Can inspect acceptance: `feature_list.json`

## Completed

- <Completed feature or foundation item with verification evidence.>

## Not Yet Implemented

- <Known unimplemented feature or "See feature_list.json for failing/blocked items.">

## Known Constraints

- <Platform/runtime constraint.>
- <Privacy/security constraint.>
- <Environment or automation limitation.>

## Suggested Next Steps

1. <Concrete next step.>
2. <Concrete next step.>
3. <Concrete next step.>

## Session Log

### <YYYY-MM-DD> - <Short Title>

- Context read: `<files>`.
- Changes made: <facts only>.
- Verification: `<commands>` and result.
- Known limitations: <facts only>.
- Follow-up: <next action>.
```

## 5. `feature_list.json` Template

```json
{
  "project": "<PROJECT_NAME>",
  "platform": "<web|ios|macos|backend|library|cli|other>",
  "updated": "<YYYY-MM-DD>",
  "source_documents": [
    "AGENTS.md",
    "progress.md"
  ],
  "status_values": [
    "passing",
    "failing",
    "blocked"
  ],
  "features": [
    {
      "id": "foundation.project-builds",
      "priority": "P0",
      "category": "foundation",
      "description": "The project can be bootstrapped and verified by a fresh developer or agent session.",
      "acceptance": [
        "Run the baseline bootstrap command from the repository root.",
        "Verify project metadata or dependency resolution succeeds.",
        "Verify the baseline build or test command succeeds."
      ],
      "passes": false,
      "last_verified": null,
      "notes": "Initialize this item with the target project's real bootstrap command."
    },
    {
      "id": "foundation.agent-handoff",
      "priority": "P0",
      "category": "foundation",
      "description": "A fresh agent can understand current state, next work, and verification requirements without prior chat history.",
      "acceptance": [
        "Read progress.md for current state and next steps.",
        "Read feature_list.json for implementation priorities and verification criteria.",
        "Use the documented bootstrap command for baseline verification."
      ],
      "passes": false,
      "last_verified": null,
      "notes": "Mark passing only after the handoff files are accurate for the current project."
    }
  ],
  "conditional_reference_documents": [
    {
      "path": "Docs/<SPEC_OR_PRD>.md",
      "use_when": "Only when the user explicitly requests this document, planning, alignment, or review."
    }
  ]
}
```

Rules:

- Keep `id` stable and machine-readable.
- Use `passes: false` until acceptance has been verified.
- `last_verified` must be a real date, not the date the feature was added.
- `notes` must record verification evidence, not optimistic intent.
- Keep conditional docs out of `source_documents` unless they are truly default project context.

## 6. `init.sh` Template

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

OPEN_PROJECT=false
SKIP_BUILD=false
RUN_APP=false

for arg in "$@"; do
  case "$arg" in
    --open)
      OPEN_PROJECT=true
      ;;
    --run)
      RUN_APP=true
      ;;
    --skip-build)
      SKIP_BUILD=true
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: ./init.sh [--open] [--run] [--skip-build]

Bootstraps this project for a fresh agent or developer session.
Customize this script for the project's real stack.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Run ./init.sh --help for usage." >&2
      exit 2
      ;;
  esac
done

echo "=== Project initialization ==="
echo "Root: $ROOT_DIR"

echo
echo "=== Environment checks ==="
<CHECK_REQUIRED_TOOLS>

if [[ "$SKIP_BUILD" == false ]]; then
  echo
  echo "=== Baseline verification ==="
  <BASELINE_COMMAND>
else
  echo
  echo "Skipping baseline verification because --skip-build was provided."
fi

if [[ "$RUN_APP" == true ]]; then
  echo
  echo "=== Running app ==="
  <RUN_COMMAND>
fi

if [[ "$OPEN_PROJECT" == true ]]; then
  echo
  echo "=== Opening project ==="
  <OPEN_COMMAND>
fi

echo
echo "=== Environment ready ==="
echo "Next files to read: progress.md and feature_list.json"
```

Adapter substitutions:

- Web: check `node`, run `npm install` or package manager command if appropriate, then `npm run lint`, `npm test`, or `npm run build`.
- iOS/macOS: check `xcodebuild`, run `xcodebuild -list`, then build/test with the real scheme and destination.
- Backend: check language runtime and service dependencies, then run unit/integration tests.
- Library: run typecheck/unit tests/build artifacts.
- CLI: run compile/test plus a smoke command like `<binary> --help`.

Do not include destructive cleanup, permission resets, database migrations, or signing changes by default. Add them only as explicit flags with safe help text.

## 7. `Scripts/run-core-e2e.sh` Template

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Core regression checks ==="

<COMMAND_1>
<COMMAND_2>
<COMMAND_3>

echo "Core regression checks passed."
```

Use this only when the project has stable focused checks. Do not create fake low-value tests merely to fill the file.

## 8. `DESIGN.md` Template

Use this only for UI projects.

```markdown
---
name: <DESIGN_SYSTEM_NAME>
colors:
  surface: '#ffffff'
  on-surface: '#111111'
  primary: '#0050cb'
  error: '#ba1a1a'
typography:
  body-md:
    fontFamily: system
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
spacing:
  unit: 4px
  sm: 8px
  md: 16px
  lg: 24px
rounded:
  sm: 4px
  md: 8px
---

## Brand & Style

<Describe the intended product feel and what to avoid.>

## Platform & Native Implementation

Use platform-native colors, typography, controls, and accessibility behavior first. Token values are review and prototype fallbacks unless the project explicitly uses a custom design system.

## Layout

<Density, spacing, responsiveness, window/screen guidance.>

## Components

<Buttons, forms, dialogs, navigation, tables, cards, menus, empty/loading/error states.>

## Accessibility

<Keyboard, focus, labels, contrast, reduced motion.>

## Update Policy

Day-to-day feature work consumes this file. Update it only for deliberate design direction, token, component, state, or motion changes. Record lint or review results after updates.
```

## 9. `Design/README.md` Template

Use this only when prototypes, mockups, screenshots, or design exports exist.

```markdown
# <PROJECT_NAME> Design Reference Assets

This directory contains visual reference assets. It does not automatically represent current implementation.

## Use Rules

- Daily feature work must not reference this directory by default.
- Use these assets only when the user explicitly asks to reference prototypes, mockups, screenshots, or planned refactor assets.
- If these assets conflict with current code or `DESIGN.md`, treat them as stale unless the user asks for a refactor decision.
- Do not store secrets, production user data, private screenshots, or customer content here.

## Assets

| Surface | Asset | Current app surface | Status |
| --- | --- | --- | --- |
| `<surface>` | `<path>` | `<implementation>` | `<current/stale/future>` |

## Version Status

<Record whether this is a frozen baseline, future refactor target, or exploratory mockup.>
```

## 10. Adapter Checklist

### Web

Common commands:

- Install: `npm install`, `pnpm install`, `yarn install`, or `bun install`.
- Dev: `npm run dev`.
- Typecheck: `npm run typecheck`.
- Lint: `npm run lint`.
- Test: `npm test`.
- Build: `npm run build`.

Harness concerns:

- Environment variables and secrets must stay in `.env.local` or secret manager, never harness files.
- UI work reads `DESIGN.md`.
- Browser smoke or Playwright checks are stronger than build-only verification for user flows.
- PRDs and design exports are conditional unless explicitly authoritative.

### iOS

Common commands:

- Metadata: `xcodebuild -list -project <Project>.xcodeproj` or `-workspace <Workspace>.xcworkspace`.
- Build: `xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=<Device>' build`.
- Test: `xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=<Device>' test`.

Harness concerns:

- Do not change bundle identifier, signing team, entitlements, deployment target, or capabilities unless required.
- Record simulator/device assumptions.
- Permission flows require real or equivalent UI verification.
- Secrets go to Keychain or secure config, not repository files.

### macOS

Common commands:

- Metadata: `xcodebuild -list -project <Project>.xcodeproj`.
- Build: `xcodebuild -scheme <Scheme> -destination 'platform=macOS' build`.
- Run: open the exact built app bundle when testing TCC-sensitive behavior.

Harness concerns:

- TCC permissions, menu bar apps, global shortcuts, app signing identity, and Keychain access may be sensitive to bundle identity.
- Do not reset permissions or kill running apps without explicit flags.
- Debug build/run scripts should avoid multiple derived app identities when permission tests matter.

### Native App / Desktop

Harness concerns:

- Record app runtime, packaging target, update channel, signing/notarization state, and installer behavior.
- UI smoke should cover actual window flows when possible.
- Keep platform permissions and secure storage rules explicit.

### Backend

Harness concerns:

- Record service dependencies, database migration policy, seed data policy, and rollback rules.
- Do not run destructive migrations or seed resets by default.
- Integration tests should use isolated test databases or mocks.
- Secrets stay in environment variables or secret manager.

### Library

Harness concerns:

- Record supported language/runtime versions.
- Feature tracking should focus on public API, compatibility, docs, and release artifacts.
- Verification should include unit tests, typecheck, docs build when relevant, and package dry run.

### CLI

Harness concerns:

- Include a smoke command such as `<binary> --help`.
- Track shell completion, config file paths, environment variables, and destructive command safeguards.
- Verification should cover exit codes and stderr/stdout contracts.

## 11. Validation Checklist

After initializing or repairing a harness:

- `AGENTS.md` names real commands and real paths.
- `progress.md` current state is factual and dated.
- `feature_list.json` parses as valid JSON.
- `feature_list.json` does not mark unverified items as passing.
- `init.sh` or equivalent has executable syntax and safe flags.
- UI projects have design routing rules.
- Conditional references are labeled with `use_when`.
- No secrets, tokens, private user data, screenshots, or raw sensitive logs were added.
- The user receives a concise summary of files created/changed and remaining gaps.
