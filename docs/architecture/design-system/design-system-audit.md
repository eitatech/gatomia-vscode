---
type: analysis
title: Design System Audit
created: 2026-04-30
tags:
  - design-system
  - webview
  - orchestration
  - hooks
  - agent-chat
  - preview
related:
  - '[[Design-System-Foundations]]'
  - '[[Workflow-Interaction-Patterns]]'
---

# Design System Audit

## Scope

This audit captures the current shared UI patterns across the webview surfaces referenced by Phase 02 before introducing new design-system primitives. It focuses on existing shared UI, page registration, hooks, cloud-agents, preview, and agent-chat so later orchestration work can reuse the strongest patterns instead of layering on another styling dialect.

Sampled sources:

- `ui/src/page-registry.tsx`
- `ui/src/components/ui/button.tsx`
- `ui/src/components/pill-button.tsx`
- `ui/src/components/cloud-agents/*.tsx`
- `ui/src/features/orchestration/index.tsx`
- `ui/src/features/hooks-view/index.tsx`
- `ui/src/features/hooks-view/components/hook-list-item.tsx`
- `ui/src/features/agent-chat/index.tsx`
- `ui/src/features/agent-chat/components/status-header.tsx`
- `ui/src/features/agent-chat/components/tool-call-card.tsx`
- `ui/src/features/preview/preview-app.tsx`
- `ui/src/components/preview/document-outline.tsx`

## Patterns Worth Reusing

### 1. VS Code theme variables are already the visual source of truth

The newer surfaces consistently style against VS Code tokens such as `--vscode-button-background`, `--vscode-panel-border`, `--vscode-descriptionForeground`, and validation colors. This is the right baseline because it keeps the webviews visually native without inventing a parallel palette.

Keep:

- VS Code token-driven colors for all states, surfaces, and actions
- Tailwind utility composition where it only wraps those tokens
- Existing use of badge, validation, and button variables instead of hard-coded hex colors

### 2. Rounded card and section composition is already emerging

`orchestration`, `preview`, and parts of `hooks` already converge on a pattern of:

- rounded containers
- thin border using `--vscode-panel-border` or `--vscode-input-border`
- compact vertical rhythm (`gap-3`, `gap-4`, `px-3/4/5`, `py-2/3/4`)
- a muted secondary text line for metadata and help copy

This is the clearest candidate for the base panel/section contract in [[Design-System-Foundations]].

### 3. Status is already expressed as a badge-like affordance

The project already uses compact state chips in several places:

- orchestration `StatePill`
- hooks execution badges and timing badges
- agent-chat lifecycle badge in `status-header`
- badge counters in orchestration bucket headers

The visual forms differ, but the interaction model is aligned: status should be glanceable, short, and adjacent to the object it describes.

### 4. Central page bootstrapping already supports cross-surface reuse

`ui/src/index.tsx` and `ui/src/page-registry.tsx` provide a single page registration and render path for `hooks`, `document-preview`, `agent-chat`, and `orchestration`. That means shared primitives can be introduced once under `ui/src/components/` and reused without changing bootstrapping architecture.

## Drift And Duplication To Normalize

### 1. There are two active styling dialects

The strongest inconsistency today is not component shape, but implementation style:

- newer surfaces (`orchestration`, `preview`, parts of `hooks`) use inline Tailwind utility strings plus VS Code variables
- older cloud-agent and devin components rely on legacy semantic class names such as `session-item`, `task-item`, `empty-state`, and `session-header`
- agent-chat mixes custom BEM-like classes (`agent-chat-*`) with its own isolated visual language

Impact:

- spacing and elevation do not scale consistently between surfaces
- shared primitives are harder to introduce because each surface expects a different styling contract
- later orchestration and Kanban work would otherwise need adapters for each dialect

### 2. Shared button primitives exist but are not the default

The repo already has reusable controls in:

- `ui/src/components/ui/button.tsx`
- `ui/src/components/pill-button.tsx`

But orchestration, preview, and parts of hooks still render one-off `<button>` elements with duplicated border, radius, hover, and padding classes. The design system should treat these existing components as the default action entry points before adding any new toolbar or badge wrappers.

### 3. Empty-state patterns are repeated with different structure and density

Current empty-state implementations vary across:

- orchestration large dashed bordered placeholder with primary action
- preview `PreviewFallback`
- cloud-agent `empty-state.tsx`
- raw list fallbacks like `No sessions`

Common semantics exist, but layout, typography, and action placement are inconsistent. A minimal empty-state wrapper should normalize:

- title
- supporting copy
- optional primary action
- optional secondary context such as provider/session guidance

### 4. Status semantics are not visually normalized

Current state treatment varies by feature:

- orchestration uses custom sky/emerald/rose/amber chips
- hooks uses validation/testing token colors plus execution icons
- agent-chat lifecycle badge styling is hidden inside feature-specific classes
- cloud-agent status is plain text in several places

The underlying state families are already similar enough for a shared contract:

- running/active
- waiting/blocked
- completed/success
- failed/error
- paused/disabled
- neutral/info

### 5. Spacing scale is converging but not encoded

The repo repeatedly uses the same few layout values:

- page padding: `p-4`
- container gaps: `gap-3`, `gap-4`
- compact sections: `p-3`
- larger headers/content cards: `p-4`, `px-5 py-4`
- compact badges/actions: `px-2 py-0.5`, `px-2.5 py-1.5`, `px-3 py-2`

These should become named spacing and density tokens in [[Design-System-Foundations]] rather than staying implicit.

### 6. Elevation and grouping are inconsistent

Some surfaces use subtle shadows (`shadow-sm`), others rely only on border contrast, and older components do neither. The design system should define when a grouping uses:

- border only
- border plus background shift
- border plus subtle elevation

Without that rule, orchestration columns, hook rows, preview footers, and later inspector panels will keep looking like unrelated products.

## Minimal Contract To Define Next

The smallest design-system contract that fits the current codebase should include:

### Tokens

- spacing tokens for page, section, card, and compact inline content
- density tokens for relaxed versus compact list rows
- status color mappings backed by VS Code theme variables
- panel grouping tokens for border, background, and optional elevation
- badge tokens for count badges, status badges, and timing badges

### Reusable Primitives

- `status-badge`
- `panel-section`
- `metric-row`
- `empty-state`
- `action-toolbar`

These should be introduced only where existing components cannot be cleanly extended. `Button`, `PillButton`, and `PreviewFallback` should be evaluated for reuse before inventing replacements.

## Surface-Specific Notes

### Orchestration

This is the strongest reference surface for layout hierarchy:

- clear page header
- lane-based grouped cards
- count badges
- compact action rows

What to keep:

- overall information architecture
- lane grouping
- compact metadata grid inside cards

What to normalize:

- replace local button styling with shared actions
- replace local `StatePill` with shared status badge
- extract repeated rounded section styling into a shared panel wrapper

### Hooks

Hooks is already close to a reusable operations UI:

- list rows with inline metadata chips
- row action affordances on hover/focus
- validation/error surfaces

What to keep:

- compact row density
- metadata chip pattern
- execution feedback with icon + label

What to normalize:

- timing/status/action chips should share badge semantics with orchestration
- delete confirmation should use the same panel and action styling as other warning states

### Agent Chat

Agent chat has the most feature-specific visual language. It should not be flattened, but it should share status and toolbar semantics with the rest of the product.

What to keep:

- conversation-specific BEM structure where transcript layout depends on it
- compact session-level status header
- tool-call card as the basis for task/file-impact cards

What to normalize:

- lifecycle badge semantics should map to the same shared state model used elsewhere
- header/toolbars should reuse shared action sizing and spacing

### Preview

Preview has strong document-reading ergonomics and should remain document-first.

What to keep:

- restrained header density
- footer metadata grid
- `PreviewFallback` as a likely base for a generic empty state

What to normalize:

- floating table-of-contents and header actions should share button and panel contracts
- stale/outdated banners should align with the same warning and info status language used in hooks/orchestration

### Cloud Agents / Devin

These surfaces are the clearest refactor candidates because they still use older ad hoc classes and duplicate each other heavily.

What to keep:

- provider/session/task domain structure

What to normalize first:

- session rows
- task status rows
- empty states
- PR action blocks

## Recommendation

Phase 02 should treat [[Design-System-Foundations]] as an extraction pass, not a redesign pass. The goal is to codify the strongest patterns already visible in orchestration, hooks, preview, and shared buttons, then use that contract to pull cloud-agent/devin and future workflow surfaces into the same system.

The immediate win is a minimal contract for status, section grouping, spacing, empty states, and action layout. That is enough to support orchestration-heavy UI now and extend directly into [[Workflow-Interaction-Patterns]] for cards, flows, boards, and inspector panels later.
