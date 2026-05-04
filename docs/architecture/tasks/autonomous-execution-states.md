---
type: reference
title: Autonomous Execution States
created: 2026-05-04
tags:
  - tasks
  - agents
  - execution
related:
  - '[[Pluggable-Task-Source-Model]]'
---

# Autonomous Execution States

As GatomIA introduces autonomous agents, tasks require metadata to support queued orchestration and parallel execution. This document outlines the execution model that lives inside a normalized task.

## TaskExecutionMetadata

```typescript
export type ExecutionState = 
  | 'queued'    // Task is ready but waiting for resources
  | 'ready'     // Task has all prerequisites met
  | 'running'   // Agent is actively working on the task
  | 'blocked'   // Task is waiting on a dependency
  | 'completed' // Task finished successfully
  | 'failed'    // Task encountered a fatal error
  | 'skipped';  // Task is intentionally bypassed

export interface TaskExecutionMetadata {
  state: ExecutionState;
  intent?: string;             // Detailed description or prompt for the agent
  suggestedRole?: string;      // Role of the agent (e.g., 'frontend', 'backend', 'qa')
  parallelizable?: boolean;    // Whether this task can run concurrently with others in its group
  dependsOn?: string[];        // Array of task IDs that must complete first
  errorMessage?: string;       // Reason for failure, if applicable
}
```

## State Transitions

- A task starts as `queued` or `ready`.
- When an agent picks it up, it becomes `running`.
- If prerequisites aren't met, or an external blocker occurs, it transitions to `blocked`.
- Terminal states are `completed`, `failed`, or `skipped`.

These states map to the core `TaskStatus` but provide higher fidelity for the orchestration engine.
