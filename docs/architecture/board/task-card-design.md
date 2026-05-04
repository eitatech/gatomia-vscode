---
type: reference
title: Task Card Design
created: 2026-05-04
tags:
  - ux
  - board
  - task
  - design
related:
  - '[[Kanban-Board-Model]]'
  - '[[Autonomous-Agent-Loop]]'
---

# Task Card Design

This document details the UX and design rationale for the task cards displayed in the GatomIA Kanban board. Task cards serve as the primary visual interface bridging specification tasks and autonomous execution.

## Interpreting the Task Card

Engineers use the task card to quickly assess the state of an autonomous task and understand what actions, if any, are required from them.

### Agent Ownership
- **Visual Indicator**: The avatar or name of the assigned agent (e.g., "Feature Agent", "QA Agent") is prominently displayed on the card.
- **Interpretation**: Clearly shows which AI entity is responsible for executing the task, helping engineers understand the context and capabilities applied to the work.

### Progress
- **Visual Indicator**: A progress bar or specific sub-task checklist directly on the card, along with status badges (e.g., Running, Pending).
- **Interpretation**: Engineers can see at a glance if a task is actively moving forward, stalled, or waiting for execution, allowing them to monitor velocity.

### Blockers
- **Visual Indicator**: Prominent warning icons and "Blocked" status indicators, often colored in red or orange. A short description of the blocker is shown on the card face.
- **Interpretation**: Immediately flags tasks that require human intervention or resolution of dependencies before they can proceed.

### Retries
- **Visual Indicator**: A retry count badge (e.g., "Retry 1/3") visible on tasks that have failed and are being re-attempted.
- **Interpretation**: Informs the engineer that the autonomous loop is actively trying to resolve an issue without immediate human intervention, indicating system resilience.

### Completion
- **Visual Indicator**: Tasks moved to the "Completed" column feature a distinct success state (e.g., green checkmarks). Links to generated artifacts or pull requests may be attached.
- **Interpretation**: Signals that the agent has finished its work and the output is ready for final review or has been successfully integrated.
