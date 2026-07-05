---
version: alpha
name: Agent Eval Studio
description: Material-inspired, minimal, data-dense visual language for a self-hosted prompt/skill evaluation studio.
colors:
  canvas: "#f8f9fa"
  surface: "#ffffff"
  border: "#e0e3e7"
  ink: "#1f2328"
  ink-2: "#57606a"
  primary: "#1a73e8"
  primary-dim: "#e8f0fe"
  pass: "#188038"
  pass-dim: "#e6f4ea"
  fail: "#d93025"
  fail-dim: "#fce8e6"
  warn: "#e37400"
  warn-dim: "#fef7e0"
  code: "#f6f8fa"
  cause-prompt-defect: "#7b1fa2"
  cause-wrong-skill: "#e37400"
  cause-poor-execution: "#f9ab00"
  cause-tool-error: "#1a73e8"
  cause-base-model: "#5f6368"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 400
  page-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 20px
    fontWeight: 600
  section-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 15px
    fontWeight: 600
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 12px
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12.5px
    fontWeight: 400
  table:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 13px
    fontWeight: 400
rounded:
  sm: 6px
  md: 8px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: 32px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 32px
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.fail}"
    rounded: "{rounded.sm}"
    height: 32px
  chip:
    rounded: "{rounded.full}"
    typography: "{typography.caption}"
  chip-pass:
    backgroundColor: "{colors.pass-dim}"
    textColor: "{colors.pass}"
  chip-fail:
    backgroundColor: "{colors.fail-dim}"
    textColor: "{colors.fail}"
  chip-warn:
    backgroundColor: "{colors.warn-dim}"
    textColor: "{colors.warn}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: 32px
  nav-item-active:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  code-block:
    backgroundColor: "{colors.code}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: 10px
---

# DESIGN.md — Agent Eval Studio visual language

Material-inspired, minimal, data-dense. One consistent system across all pages.
Implemented with Tailwind CSS v4; the tokens above are defined in `src/web/app.css` via `@theme`
and consumed by the React components in `src/web/ui.tsx`.

## Overview

1. **Calm surface, loud data.** Neutral canvas; color is reserved for state (pass/fail/warn) and the single primary accent.
2. **Density with hierarchy.** Tables and dashboards are compact (13–14px body); hierarchy comes from weight and spacing, not size explosions.
3. **Everything is inspectable.** Any metric links to the runs behind it; any run links to its trace; any failure links to its attribution and agent analysis.
4. **No decoration without information.** No gradients, no shadows deeper than `shadow-sm`, no icons that don't disambiguate.
5. **Concepts explain themselves.** Every non-obvious metric or algorithm (pass^k, counterfactual attribution, regression gate, side-effect levels, capability matrix, B/A/E/R tiers, trace steps) carries a small `?` help trigger with an accurate one-paragraph explanation, localized (zh/en).

## Colors

`canvas` is the app background; `surface` hosts cards and tables over 1px `border` hairlines.
`ink`/`ink-2` are primary/secondary text. `primary` (Google blue) marks actions, links and active nav;
`pass`/`fail`/`warn` (+ their `-dim` tints) are reserved for verdicts and states — never decoration.
`code` backs code/trace panels. Root causes keep fixed identity colors (`cause-*` tokens) so a cause
is recognizable across dashboard bars, chips and reports. Tier identity: B `pass`, A `primary`, E `warn`, R `fail`.

## Typography

System UI stack for prose; mono (`ui-monospace`) for ids, numerals, traces and diffs. Base 14px;
page title 20/600; section title 15/600; caption 12px in `ink-2`; tables 13px; mono 12.5px.
Numbers: 2 decimals for rates, `ms` for durations, mono font.

## Layout

4px grid. Page gutter 24px; max content width 1200px, centered. Fixed left sidebar (208px) with
product name + nav (dashboard, targets, samples, experiments, attribution, analysis agents,
reports, settings); active item is a `primary-dim` pill. Cards: `rounded-lg border bg-surface p-4`.

## Elevation & Depth

Flat by default. Hairline borders separate surfaces; `shadow-sm` is the maximum elevation and is
reserved for popovers (help tooltips). No other shadows.

## Shapes

Radii: 6px controls (buttons/inputs), 8px cards, full-round chips and nav pills.

## Components

- **Card**: white surface, hairline border, 8px radius, 16px padding, title row with optional right-aligned action.
- **StatChip**: pass/fail/warn tinted pill, 12px, mono numerals.
- **MetricTile**: big numeral (mean), small `±stddev`, small delta arrow (green up / red down; direction-aware for "higher is better").
- **Table**: full-width, 13px, hairline row dividers, sticky header, hover row tint `code`. First column is the entity link.
- **Timeline (trace)**: vertical list of steps ordered by actual start time; each step = type chip (llm / tool-call / routing / state / side-effect), name, error chip when failed, tokens, wall-clock start and duration right-aligned; expandable payload in mono on `code`. Steps with errors get a `fail` border; run-level errors render as a full-width `fail-dim` banner above the page body.
- **Coverage matrix**: capability rows × tier columns (B/A/E/R); filled cells `pass-dim` with count, empty cells `fail-dim` dot — an empty cell is a gap, not blank space. Tier budget line (actual vs 40/30/20/10 target) and a gap list below.
- **Diff view**: two-tone unified diff, added `pass-dim`, removed `fail-dim`, mono 12.5px.
- **Wizard**: numbered horizontal stepper (goal → scenario → cases → fields); one step visible at a time; Back/Next right-aligned.
- **Help tooltip**: 14px circular `?` trigger inline after a term; popover on hover/focus, 288px wide, surface + hairline + `shadow-sm`.
- **Empty state**: centered, one sentence + primary action button. Never a bare blank page.
- **Buttons**: primary = filled `primary` white text; secondary = hairline border on surface; destructive = `fail` text ghost. Height 32px, radius 6px, 13px/500.
- **Forms**: labels above inputs, 12px/500 `ink-2`; inputs 32px, hairline border, focus ring `primary` 2px.

States:

- pass^k chip: `k=<k> · <mean>±<stddev>` with pass/fail tint by threshold, plus a pass^k help trigger.
- Side-effect levels: L1 semantic / L2 audit / L3 sandbox-harm shown as three stacked mini-chips, each independently pass/fail.
- Severity chips (agent findings): high `fail`, medium `warn`, low neutral.

## Do's and Don'ts

- **Do** keep labels lowercase-first and terse in English ("run experiment", "view trace"); Chinese copy is complete, natural sentences — no half-translated fragments.
- **Do** put an explanation behind a help trigger instead of widening a label.
- **Do** route every aggregate number to its underlying entities (metric → runs → trace → attribution).
- **Don't** collapse prompt/skill metrics into a single pass/fail anywhere in the UI.
- **Don't** introduce new colors for new states — reuse the state palette or a `cause-*` identity color.
- **Don't** use shadows, gradients or icons that don't disambiguate.
