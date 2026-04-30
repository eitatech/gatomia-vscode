---
type: reference
title: Workflow Interaction Patterns
created: 2026-04-30
tags:
  - design-system
  - orchestration
  - hooks
  - kanban
  - interaction-patterns
related:
  - '[[Design-System-Audit]]'
  - '[[Design-System-Foundations]]'
---

# Workflow Interaction Patterns

See also: [[Design-System-Audit]] and [[Design-System-Foundations]]

## Purpose

This document describes the recurring interaction patterns that later orchestration, hooks, Kanban, and flow-based phases should reuse. It converts the shared visual foundation into concrete UI patterns so future work can build new workflow surfaces without re-deciding how cards, boards, inspectors, or task-state visuals should behave.

## Shared Mental Model

Workflow surfaces in this project all answer the same questions:

- What work exists?
- What state is it in now?
- What needs attention?
- What action can the user take next?

The patterns below keep those answers in the same place across list, board, and inspector views.

## Cards

### When To Use

Use cards for discrete workflow objects with a clear title, state, and small set of next actions.

Examples:

- orchestration session cards
- future Kanban task cards
- flow node summaries
- hook run summaries when they need more detail than a row can carry

### Card Structure

Recommended order:

1. title and object identity
2. state badge close to the title
3. compact supporting metadata
4. current blockers, errors, or waiting reason
5. action toolbar

Use `PanelSection` as the card shell when the card needs standard grouping behavior.

### Card Behavior

- The title area should remain scannable even when metadata grows.
- State should never be hidden only in a footer or hover affordance.
- Primary actions should stay visible without opening a secondary menu when the expected action is obvious.
- Degraded or blocked cards should explain the cause in plain language, not only by color.

## Lists And Compact Rows

### When To Use

Use rows instead of cards when users compare many similar objects quickly.

Examples:

- hooks list
- cloud-agent session lists
- session history or event streams

### Row Rules

- Keep row density compact.
- Reserve the left side for identity and metadata.
- Keep state visible near the identity, not detached at the far edge.
- Row actions should appear in a stable trailing area or an inline toolbar.
- Expanded content should inherit the same status semantics as the collapsed row.

## Boards

### When To Use

Use boards for grouped workflow states where movement between state buckets is meaningful.

Examples:

- orchestration buckets as a lightweight board precursor
- future Kanban lanes
- review pipelines or queue-based task dispatch

### Board Structure

Each lane should contain:

1. lane title
2. lane count badge
3. optional lane summary or filter controls
4. vertically stacked cards or rows
5. explicit lane empty state

Use `PanelSection` for each lane so all lanes share border, padding, and elevation behavior.

### Board Behavior

- Lane counts use neutral badges unless the count itself is a warning signal.
- Empty lanes must stay visible with explicit copy rather than collapsing away.
- Drag-and-drop phases should preserve the same visible state vocabulary even if movement becomes interactive later.
- Lane-level actions belong in the header, card-level actions belong on the card.

## Flows

### When To Use

Use a flow diagram when the user needs to understand dependency, ordering, or branching, not just a state bucket.

Examples:

- orchestration pipelines
- hook trigger chains
- future task dependency views

### Flow Rules

- Nodes should use the same status tones as cards and badges.
- Node chrome should not invent a separate success/warning/error palette.
- Selecting a node should reveal more detail in a side inspector rather than overloading the node itself.
- Edges may communicate relationship or dependency, but state belongs primarily to nodes.

## Inspector Panels

### When To Use

Use an inspector when the selected object needs more detail than the main card, row, or node can show without harming scanability.

Examples:

- orchestration session detail pane
- Kanban card detail panel
- hook configuration or run detail inspector

### Inspector Structure

Recommended order:

1. title and state badge
2. short summary or status explanation
3. metric rows for timing, provider, worktree, branch, or ownership details
4. action toolbar for object-level actions
5. expandable deeper sections for logs, payloads, or related items

Inspectors should prefer `PanelSection` plus `MetricRow` over custom one-off metadata grids unless the content is truly non-tabular.

## Task-State Visuals

All workflow surfaces should share the same task-state visual language defined in [[Design-System-Foundations]].

| State family | Visual treatment | Expected user meaning |
| --- | --- | --- |
| Active | active badge or active node chrome | Work is in progress now |
| Waiting | warning badge plus reason text when relevant | Work needs input, dependency, or approval |
| Completed | success badge | Work finished successfully |
| Failed | danger badge plus visible error context | Work stopped or needs intervention |
| Neutral | neutral badge or muted metadata chip | Informational or secondary context |

Rules:

- Never rely on color alone when blocked or failed context matters.
- Prefer short state labels, with explanation in supporting copy.
- Use the same raw-state normalization everywhere possible so `waiting-for-input` is interpreted consistently.

## Shared Status Semantics Across Surfaces

### Orchestration

- session state and bucket placement use the shared status families
- blocked or waiting sessions remain visible as actionable work, not hidden under active
- degraded provider states surface as explicit empty or warning states

### Hooks

- hook execution status uses the same family mapping as sessions
- timing labels and counts may stay neutral when they do not communicate health
- validation and delete-confirmation states should use the same warning/danger language as other workflow views

### Kanban

- lane names may differ from orchestration buckets, but card badges should still use the same active/waiting/success/danger semantics
- review or blocked columns should still read as warning-state work, not a new palette
- archived or informational-only cards can remain neutral

## Shared Action Affordances Across Surfaces

### Principles

- Keep the most likely next action closest to the object.
- Use the same action density for equivalent scopes.
- Separate destructive actions from navigation or reveal actions.
- Avoid hiding all actions behind hover-only controls for critical workflows.

### Scope Model

- page actions: global refresh, create, connect, or filter actions
- lane or section actions: scoped controls that affect a bucket, group, or inspector section
- object actions: open, retry, pause, edit, delete, reveal, or inspect

### Expected Reuse

- orchestration card footer actions and hooks row actions should align in spacing and button sizing
- future Kanban card actions should feel like orchestration object actions, not a new micro-pattern
- inspector actions should use the same `ActionToolbar` treatment regardless of whether the selected item came from a list, board, or flow

## Empty, Loading, And Degraded Patterns

### Empty

- Explain why the surface is empty.
- Offer the next meaningful action when one exists.
- Keep the copy tied to the workflow domain, such as provider setup, no hooks configured, or no items in lane.

### Loading

- Use the same empty-state shell when possible.
- Explain what source is being refreshed or synchronized.

### Degraded

- State what failed and what the user can do next.
- Prefer warning for recoverable reads and danger for hard failures.
- Link the remediation action to the surface context, such as refresh, reopen, retry, or inspect logs.

## Direct Reuse Checklist For Later Phases

Before adding a new workflow surface, verify:

1. `StatusBadge` can represent the object state.
2. `PanelSection` can provide the container shell.
3. `MetricRow` can carry compact metadata.
4. `EmptyState` can represent empty, loading, or degraded conditions.
5. `ActionToolbar` can standardize action placement.
6. New board, flow, or inspector work still maps back to [[Design-System-Foundations]].
