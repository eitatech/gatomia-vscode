---
type: architecture
title: Hook Execution Model
created: 2026-05-04
tags:
  - hooks
  - triggers
  - execution-flow
related:
  - '[[Trigger-Model]]'
  - '[[Schedule-Model]]'
  - '[[Hook-Composer-UX]]'
---

# Hook Execution Model

## Current State Audit
The current hook system (`src/features/hooks/`) models hooks mainly as static mappings between a trigger (event) and an action (MCP, Github, Git, Agent, Custom, etc). It relies on multiple components:
- `HookManager`: Persistence and CRUD operations.
- `TriggerRegistry`: Mapping of predefined events to hook IDs.
- `HookExecutor`: Execution logic for when a trigger fires.
- `TemplateContextBuilder` / `TemplateVariableParser`: Argument templating based on context.

While functional, there is overlap between how triggers, actions, and validation logic handle execution flows, particularly around scheduling or multi-condition evaluation. 

## Target Architecture

The new Hook Execution Model standardizes the execution pipeline into four discrete phases to simplify evaluation and remove duplication.

### 1. Event Sources (Triggers)
Abstracts how a hook begins execution. This includes agent operation completions, file system events, or explicit manual calls. See [[Trigger-Model]].

### 2. Conditions & Schedules
Allows execution flows to define pre-requisite conditions and timing without hardcoding them into the executor. See [[Schedule-Model]].

### 3. Actions
Standardized units of work (MCP action, ACP action, terminal command) executed when triggers and schedules are satisfied. 

### 4. Logging & Telemetry
A unified logging pipeline across the execution-flow. Failed triggers, unmet conditions, or action errors will uniformly surface through the same diagnostic channel.

## Persistence
We preserve the existing `Hook[]` JSON array state in workspace/global storage (`.vscode/gatomia/hooks.json`), using a migration layer inside `HookManager` to map the legacy shape into the discrete runtime objects.

## User Experience
The configuration UI will map directly to this 4-step pipeline (Event -> Condition -> Timing -> Action). See [[Hook-Composer-UX]] for the configuration flow breakdown.
