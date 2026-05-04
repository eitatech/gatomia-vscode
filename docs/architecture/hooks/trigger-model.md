---
type: architecture
title: Trigger Model
created: 2026-05-04
tags:
  - hooks
  - triggers
  - events
related:
  - '[[Hook-Execution-Model]]'
---

# Trigger Model

The Trigger Model defines the event sources that initiate hook execution flows in the GatomIA architecture.

## Overview
A trigger is the entry point for a hook execution. The updated architecture normalizes triggers so that the execution engine handles them consistently, regardless of their source.

## Event Sources
1. **Agent Execution Flow Events**: Triggers fired when an agent operation starts or completes.
2. **File/Repository Changes**: Triggers based on Git events or file system watchers.
3. **Manual Invocations**: Explicit user-triggered actions from the UI or command palette.

## Evaluation Pipeline
The `TriggerRegistry` listens to these diverse event sources and normalizes them into a standard `ExecutionEvent`. This event contains contextual data (e.g., output paths, clipboard content, agent status) that the `HookExecutor` uses to evaluate conditions and build template contexts.

See [[Hook-Execution-Model]] for how triggers fit into the broader execution pipeline.
