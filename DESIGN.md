# DESIGN.md — Agent Eval Studio visual language

Material-inspired, minimal, data-dense. One consistent system across all pages. Tailwind CSS v4 with the tokens below defined in `src/web/app.css` via `@theme`.

## Principles

1. **Calm surface, loud data.** Neutral canvas; color is reserved for state (pass/fail/warn) and the single primary accent.
2. **Density with hierarchy.** Tables and dashboards are compact (13–14px body); hierarchy comes from weight and spacing, not size explosions.
3. **Everything is inspectable.** Any metric links to the runs behind it; any run links to its trace; any failure links to its attribution.
4. **No decoration without information.** No gradients, no shadows deeper than `shadow-sm`, no icons that don't disambiguate.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#f8f9fa` | app background |
| `--color-surface` | `#ffffff` | cards, tables |
| `--color-border` | `#e0e3e7` | 1px hairlines |
| `--color-ink` | `#1f2328` | primary text |
| `--color-ink-2` | `#57606a` | secondary text |
| `--color-primary` | `#1a73e8` | actions, links, active nav (Google blue) |
| `--color-primary-dim` | `#e8f0fe` | primary tint backgrounds |
| `--color-pass` | `#188038` | pass states |
| `--color-pass-dim` | `#e6f4ea` | pass tint |
| `--color-fail` | `#d93025` | fail states |
| `--color-fail-dim` | `#fce8e6` | fail tint |
| `--color-warn` | `#e37400` | warnings, near-miss |
| `--color-warn-dim` | `#fef7e0` | warn tint |
| `--color-code` | `#f6f8fa` | code/trace backgrounds |

Typography: system UI stack (`ui-sans-serif`); mono for ids, traces, diffs (`ui-monospace`). Base 14px; page title 20px/600; section title 15px/600; caption 12px `--color-ink-2`.

Spacing: 4px grid. Cards: `rounded-lg border bg-surface p-4`. Page gutter 24px. Max content width 1200px, centered.

## Components

- **App shell**: fixed left sidebar (208px) with product name + nav (Dashboard, Targets, Samples, Experiments, Traces, Attribution, Optimize, Settings). Active item: `--color-primary-dim` pill.
- **Card**: white surface, hairline border, 8px radius, 16px padding, title row with optional right-aligned action.
- **StatChip**: pass/fail/warn tinted pill, 12px, mono numerals.
- **MetricTile**: big numeral (mean), small `±stddev`, small delta arrow (green up / red down; direction-aware for "higher is better").
- **Table**: full-width, 13px, hairline row dividers, sticky header, hover row tint `#f6f8fa`. First column is the entity link.
- **Timeline (trace)**: vertical list of steps; each step = type chip (llm / tool / routing / state), name, duration right-aligned; expandable payload in mono on `--color-code`.
- **Diff view**: two-tone unified diff, added `--color-pass-dim`, removed `--color-fail-dim`, mono 12.5px.
- **Wizard**: numbered horizontal stepper (goal → scenario → cases → fields); one step visible at a time; Back/Next right-aligned.
- **Empty state**: centered, one sentence + primary action button. Never a bare blank page.
- **Buttons**: primary = filled `--color-primary` white text; secondary = hairline border on surface; destructive = `--color-fail` text ghost. Height 32px, radius 6px, 13px/500.
- **Forms**: labels above inputs, 12px/500 `--color-ink-2`; inputs 32px, hairline border, focus ring `--color-primary` 2px.

## States

- pass^k chip: `k=<k> · <mean>±<stddev>` with pass/fail tint by threshold.
- Root causes get fixed colors: prompt-instruction-defect `#7b1fa2`, wrong-skill-selected `#e37400`, right-skill-executed-poorly `#f9ab00`, tool-call-error `#1a73e8`, base-model-error `#5f6368`.
- Side-effect levels: L1 semantic / L2 audit / L3 sandbox-harm shown as three stacked mini-chips, each independently pass/fail.

## Voice

Labels are lowercase-first, terse, English ("run experiment", "view trace"). Numbers: 2 decimals for rates, ms for durations, mono font.
