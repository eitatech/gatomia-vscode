---
type: architecture
title: Kanban Board Model
created: 2026-05-04
tags:
  - architecture
  - orchestration
  - ui
related:
  - '[[Autonomous-Agent-Loop]]'
  - '[[Task-Card-Design]]'
---

# Kanban Board Model

This document defines the Kanban board contract derived from the normalized task model. This contract provides the foundation for the visual task board where engineers can monitor work status, including queued, active, blocked, and completed tasks, while autonomous agents execute tasks from pluggable sources.

## Core Principles

1.  **Reusability:** The board reuses existing status semantics and interaction patterns from the orchestration prototype and design-system primitives.
2.  **Simplicity:** The first release focuses on the smallest useful set of board states and card metadata to support autonomous execution visibility.
3.  **Synchronization:** The board acts as a view layer on top of the normalized task model, ensuring consistency with the orchestration layer.

## Board States (Columns)

The board implements the following minimal set of columns, mapped from the normalized task states:

*   **Queued:** Tasks that have been discovered from a source but are not yet ready or prioritized for execution.
*   **Ready:** Tasks that are eligible for execution and are waiting to be claimed by an agent.
*   **Running:** Tasks that have been claimed and are currently being executed by an autonomous agent.
*   **Blocked:** Tasks that cannot proceed due to dependencies, errors requiring intervention, or missing information.
*   **Completed:** Tasks that have successfully finished execution and verification.
*   **Failed:** Tasks that encountered an unrecoverable error during execution.

## Task Card Metadata

Each task card on the board must display the following essential metadata to ensure it remains scannable and informative:

*   **Task ID & Title:** A clear, concise identifier and description of the work.
*   **Source Information:** The origin of the task (e.g., GitHub Issue, local spec file, BD issue).
*   **Agent Ownership:** Which agent (if any) currently holds the claim to the task.
*   **Status / Execution Activity:** Real-time updates on what the agent is doing (e.g., "Running tests...", "Generating code...").
*   **Blockers / Errors:** Clear indicators if the task is blocked or has failed, including a brief summary of the reason.
*   **Timestamps:** When the task was created, started, and last updated.
*   **Parallelization Eligibility:** Visual indicator if the task is marked as parallel-safe within the normalized task model.

## Integration with Autonomous Agent Loop

The Kanban board is intrinsically linked to the [[Autonomous-Agent-Loop]]. As agents claim, start, observe, and complete tasks via the orchestration service, those state changes are immediately reflected on the board. The board provides the human-readable visibility into the autonomous processes operating underneath.

## Future Evolution

For details on how the task cards themselves should be designed and styled for optimal user experience, refer to [[Task-Card-Design]].
