---
type: architecture
title: Schedule Model
created: 2026-05-04
tags:
  - hooks
  - schedules
  - execution-flow
related:
  - '[[Hook-Execution-Model]]'
---

# Schedule Model

The Schedule Model defines the timing and conditional prerequisites for hook execution.

## Timing Control
Schedules dictate *when* a hook executes relative to its trigger:
- **Immediate (After execution)**: Runs as soon as the trigger resolves (default behavior).
- **Pre-execution (Before execution)**: Runs before the primary agent action, optionally blocking execution until the hook resolves successfully.

## Conditions
Conditions are evaluated after a trigger fires but before the action executes. A schedule may define:
- Required workspace states.
- File existence checks.
- Specific trigger context values.

By decoupling schedules and conditions from actions, the engine achieves greater flexibility.

See [[Hook-Execution-Model]] for how schedules interact with triggers and actions.
