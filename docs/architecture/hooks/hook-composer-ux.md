---
type: architecture
title: Hook Composer UX
created: 2026-05-04
tags:
  - hooks
  - ui
  - configuration
related:
  - '[[Hook-Execution-Model]]'
---

# Hook Composer UX

The Hook Composer UX defines how users configure and reason about execution flows within the extension's Webview UI.

## Design Philosophy
The UI language matches the simplified execution-flow model:
1. **Event Source**: "When this happens..." (Select trigger/event).
2. **Conditions & Schedule**: "Only if..." and "Run before/after..." (Timing and prereqs).
3. **Action**: "Do this..." (MCP tool, command, etc.).

## Component Breakdown
- **Trigger/Action Selector**: Merged into a cohesive flow. Users select an event source mapping, schedule options, and fallback mechanisms for legacy triggers.
- **Argument Template Editor**: Provides a rich variable picker with categorized output variables (e.g., `$agentOutput`, `$outputPath`) that visually represent the context available from the selected Event Source.
- **Validation**: Real-time validation surfaces errors consistently across triggers, schedules, and actions in a single view.

This design reduces cognitive load by eliminating redundant configuration paths and directly mirroring the runtime [[Hook-Execution-Model]].
