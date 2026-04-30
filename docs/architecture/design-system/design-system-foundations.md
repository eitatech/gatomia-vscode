---
type: reference
title: Design System Foundations
created: 2026-04-30
tags:
  - design-system
  - webview
  - orchestration
  - hooks
  - kanban
related:
  - '[[Design-System-Audit]]'
  - '[[Workflow-Interaction-Patterns]]'
---

# Design System Foundations

See also: [[Design-System-Audit]] and [[Workflow-Interaction-Patterns]]

## Purpose

This document defines the minimal shared visual contract for workflow-heavy webviews in GatomIA. It is intentionally narrow: the goal is to give orchestration, hooks, Cloud Agents, and later Kanban or flow-based surfaces a common system for grouping, spacing, status, and actions without flattening each feature into the same layout.

## Source Of Truth

The current foundation is implemented in:

- `ui/src/app.css`
- `ui/src/components/workflow/status-badge.tsx`
- `ui/src/components/workflow/panel-section.tsx`
- `ui/src/components/workflow/metric-row.tsx`
- `ui/src/components/workflow/empty-state.tsx`
- `ui/src/components/workflow/action-toolbar.tsx`

These foundations extend the existing VS Code theme-variable strategy rather than introducing a custom palette.

## Core Principles

### Native To VS Code

- Use VS Code theme variables for colors, borders, text, and emphasis.
- Prefer `var(--vscode-...)` tokens first, with local fallbacks only where needed.
- Avoid hard-coded branded palettes for workflow state unless the VS Code token model cannot express the state.

### Small Shared Surface Area

- Share primitives for status, section grouping, metrics, empty states, and actions.
- Keep domain-specific layouts inside their feature when the structure is unique, such as agent-chat transcript rendering.
- Reuse `Button` and other existing controls before adding new wrappers.

### State Must Be Glanceable

- Every workflow object should expose status close to its title or primary identifier.
- Status color, label, and action placement must stay consistent across list rows, cards, inspector sections, and future board lanes.
- Empty, loading, degraded, and success states should be explicit rather than implied by missing content.

## Tokens

### Spacing Tokens

Defined in `ui/src/app.css`:

- `--workflow-space-page`: default page padding for workflow surfaces.
- `--workflow-space-section`: spacing between grouped sections.
- `--workflow-space-card`: interior card padding baseline.
- `--workflow-space-inline`: compact inline spacing for chips, badges, and small action clusters.

Recommended use:

- page shell: `p-4`
- section stack: `gap-3`
- larger grouped content: `gap-4`
- compact inline actions or metadata: `gap-2` or smaller

### Density Tokens

- `--workflow-density-compact-min-height`
- `--workflow-density-relaxed-min-height`

Use compact density for rows, badges, and small action areas. Use relaxed density for cards, inspector sections, and detail-heavy views.

### Panel Tokens

- `--workflow-panel-radius`
- `--workflow-panel-border-color`
- `--workflow-panel-background`
- `--workflow-panel-muted-background`
- `--workflow-panel-subtle-background`
- `--workflow-elevation-1`

Panel grouping levels:

- border only: standard content sections and lane cards
- border plus muted background: secondary grouping or nested summaries
- border plus subtle elevation: sections that must stand off from the page, such as grouped hook lists or board columns

### Status Tokens

Shared status tones are backed by VS Code variables:

- `active`
- `warning`
- `success`
- `danger`
- `neutral`

These tones resolve through the `StatusBadge` mapping and should be the default status language for workflow surfaces.

## Shared Primitives

### `StatusBadge`

Use for compact, glanceable state or count information.

Responsibilities:

- normalize status strings such as `waiting-for-input` or `ended-by-shutdown`
- map raw state to a shared tone
- render small chips for object state, counts, or compact metadata

Use when:

- showing session state in orchestration
- showing hook counts or execution state in hooks
- showing Kanban card state or lane counters later

Avoid using it for large banners or verbose error copy.

### `PanelSection`

Use for any bordered grouped section with optional header, description, and actions.

Variants:

- `default`: standard section surface
- `muted`: secondary grouped surface
- `elevated`: grouped surface needing stronger hierarchy

Padding modes:

- `compact`
- `default`
- `relaxed`

Use when:

- grouping orchestration lanes
- grouping hooks by action type
- building future inspector panels or board columns

### `MetricRow`

Use for compact label/value summaries inside cards, sections, or inspectors.

Use when:

- surfacing last activity, provider, worktree, branch, task counts, or timing details
- presenting compact operational metadata without inventing bespoke grids

### `EmptyState`

Use for explicit loading-adjacent and no-data states with optional actions.

Structure:

- optional eyebrow
- title
- supporting copy
- optional action area
- optional extra child content

Use when:

- a workflow surface has no configured hooks
- orchestration has no sessions or is waiting on provider setup
- a future Kanban lane or board has no items yet

### `ActionToolbar`

Use for grouped actions that should share density and alignment.

Options:

- alignment: `start`, `between`, `end`
- density: `compact`, `default`

Use when:

- rendering card-level actions
- rendering row-level utilities
- keeping primary and secondary actions visually aligned across surfaces

## Shared Status Semantics

The product should collapse feature-specific terms into these user-facing families:

| Family | Tone | Typical raw states | Meaning |
| --- | --- | --- | --- |
| Active | `active` | `running`, `executing`, `queued`, `initializing` | Work is progressing now |
| Waiting | `warning` | `waiting`, `pending`, `blocked`, `paused`, `waiting-for-input` | Work is paused on input or dependency |
| Completed | `success` | `completed`, `success`, `passed` | Work finished successfully |
| Failed | `danger` | `failed`, `error`, `cancelled`, `rejected`, `ended-by-shutdown` | Work stopped unsuccessfully |
| Informational | `neutral` | unknown or informational-only states | Secondary or non-critical context |

Rules:

- The same raw state should resolve to the same tone anywhere it appears.
- Count badges may use `neutral` unless they communicate health.
- Degraded system conditions should usually use `warning` for recoverable issues and `danger` for failures.

## Shared Action Affordances

Action affordances should stay consistent across orchestration, hooks, and future Kanban views.

Rules:

- Primary actions use the existing shared `Button` styling.
- Secondary actions should stay inline and compact rather than creating new button dialects.
- Row- or card-level actions belong in an `ActionToolbar` aligned with the object they affect.
- Destructive actions should stay separated from navigation or reveal actions.
- Header actions should be concise and appear in the section header area when they affect the whole group.

## Surface Guidance

### Orchestration

- Use `PanelSection` for bucket lanes and grouped summaries.
- Use `StatusBadge` for lane counts and session state.
- Use `MetricRow` for session metadata inside cards.
- Use `EmptyState` for global no-session or degraded-provider states.

### Hooks

- Use `PanelSection` for action-type groups.
- Use `StatusBadge` for hook counts, timing labels, and execution states.
- Use `EmptyState` for loading and no-configured-hook states.
- Keep compact density because hooks are row-oriented operations UI.

### Kanban And Flow Phases

- Use the same status families and tones for cards, lanes, flow nodes, and inspector details.
- Use `PanelSection` as the default basis for inspectors and side panels.
- Use `ActionToolbar` so board and flow actions mirror orchestration card actions.
- Use `MetricRow` for card detail panels rather than custom metadata tables when the information is label/value shaped.

## Example Reuse Model

### Orchestration

- bucket header count: neutral `StatusBadge`
- session card state: mapped `StatusBadge`
- session metadata: stacked `MetricRow`
- session actions: `ActionToolbar`

### Hooks

- action-type group shell: `PanelSection`
- group count: neutral `StatusBadge`
- row execution result: mapped `StatusBadge`
- list empty fallback: compact `EmptyState`

### Kanban

- lane shell: `PanelSection`
- lane count: neutral `StatusBadge`
- card state chip: mapped `StatusBadge`
- card footer actions: `ActionToolbar`
- inspector metadata: `MetricRow`

## Non-Goals

- This foundation does not replace all existing feature-specific classes immediately.
- It does not define a branded illustration system.
- It does not prescribe one exact layout for transcript, board, and flow surfaces.
- It does not replace existing shared controls such as `Button` unless there is a demonstrated gap.

## Adoption Order

1. Reuse the workflow primitives in orchestration-heavy surfaces first.
2. Pull hooks, Cloud Agents, and adjacent operations UI into the same status and grouping language.
3. Apply the same contract to [[Workflow-Interaction-Patterns]] for Kanban boards, flow views, and inspectors.
