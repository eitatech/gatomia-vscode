---
type: architecture
title: Pluggable Task Source Model
created: 2026-05-04
tags:
  - architecture
  - tasks
  - orchestration
related:
  - '[[Task-Normalization-Contract]]'
  - '[[Autonomous-Execution-States]]'
---

# Pluggable Task Source Model

## Context

GatomIA orchestrates tasks across multiple specification systems (SpecKit, OpenSpec). Currently, tasks are read directly from Markdown by `task-parser.ts` which has rigid format expectations. As the project moves toward a unified board and autonomous agents, we need a pluggable task layer that separates *discovering and parsing* tasks from *orchestrating* tasks.

## Design

We introduce a `TaskProvider` interface that translates proprietary task sources into a normalized model.

1. **Normalized Task Model:** The core application consumes `NormalizedTask`. This abstracts away Markdown intricacies, preserving essential metadata: ID, title, status, execution hints, and source mapping.
2. **Provider Contract:** New specification formats implement the `TaskProvider` interface (`getTasks()`, `updateTask()`).
3. **Registry/Service:** A centralized `TaskService` uses the `SpecSystemAdapter` to find task files, then delegates to the appropriate `TaskProvider` to read and parse them.

## Integration

- **Backward Compatibility:** Providers use existing logic in `task-parser.ts` and `spec-kit-adapter.ts` to read SpecKit / OpenSpec specs.
- **Extensibility:** The system degrades gracefully when tasks cannot be fully parsed. See [[Task-Normalization-Contract]] for guidelines on writing new providers.
- **Autonomous Execution:** The model includes fields for agent parallelization and observability, described in [[Autonomous-Execution-States]].
