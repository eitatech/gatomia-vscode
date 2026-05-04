---
type: architecture
title: Workflow Node Types
created: 2026-05-04
tags:
  - workflow
  - react-flow
  - ui
  - nodes
related:
  - '[[Workflow-Composer-Contract]]'
---

# Workflow Node Types

This document explains how the visual nodes in the React Flow composer map to the underlying execution-flow backend concepts (`Hook` model).

## Core Node Types

### Source Node (`source`)
- **Backend Mapping**: Maps to `EventSource` in the `Hook` model (`hook.events` or legacy `hook.trigger`).
- **Description**: Represents the starting point of a workflow. Defines what triggers the execution, such as an agent operation, file change, or manual invocation.

### Condition Node (`condition`)
- **Backend Mapping**: Maps to `Condition` in the `Hook` model (`hook.conditions`).
- **Description**: Acts as a gatekeeper. Evaluates a logical expression or state (e.g., branch name, file existence) to determine if execution should proceed.

### Schedule Node (`schedule`)
- **Backend Mapping**: Maps to `Schedule` in the `Hook` model (`hook.schedule`).
- **Description**: Controls the timing of execution, either delaying it, scheduling it via cron, or passing it through immediately.

### Action Node (`action`)
- **Backend Mapping**: Maps to `ActionConfig` in the `Hook` model (`hook.action`).
- **Description**: Represents the actual work performed, such as running an agent, executing a git command, or calling a GitHub API.

## Extensibility

To add a new node type:
1. Update the `Hook` backend model (and `ui/src/features/hooks-view/types.ts`).
2. Add the new React Flow node component in `ui/src/components/workflow-graph/nodes/base-nodes.tsx`.
3. Register the new type in `ui/src/components/workflow-graph/nodes/index.ts`.
4. Update the mapper utility `ui/src/features/workflow-composer/utils/mapper.ts` to transform the new backend entity into the visual graph node.
