# Phase 06: Kanban Task Board and Autonomous Agent Loop

This phase turns the normalized task model into a visual Kanban board where engineers can see queued, active, blocked, and completed work while agents act autonomously against pluggable task sources. It matters because this is the user-facing bridge between specification tasks and autonomous execution, making GatomIA feel like a real developer workflow orchestrator rather than a collection of disconnected tools.

## Tasks

- [x] Define the Kanban board contract from the normalized task model before building the board UI:
  - Audit the orchestration prototype, pluggable task model, and design-system patterns first so the board reuses existing status semantics and interaction patterns
  - Define the smallest useful board states and card metadata needed to support autonomous execution visibility without overloading the first board release
  - Capture the contract in `docs/architecture/board/kanban-board-model.md` with YAML front matter and wiki-links to `[[Autonomous-Agent-Loop]]` and `[[Task-Card-Design]]`

- [x] Build the Kanban board UI on top of the pluggable task source layer:
  - Reuse the existing webview architecture and shared design-system primitives before creating one-off board-specific styling
  - Implement columns for queued, ready, running, blocked, completed, and failed work using the normalized task states introduced earlier
  - Show source information, agent ownership, timestamps, blockers, and current execution activity on each task card in a way that remains scannable

- [ ] Implement the first autonomous agent execution loop for board tasks:
  - Reuse current orchestration and agent session capabilities before introducing new execution machinery
  - Allow eligible tasks to be claimed, started, observed, and completed through a narrow orchestration service that updates both the board and running-agent views
  - Support task parallelization only where the normalized task model marks work as parallel-safe and visible coordination remains clear

- [ ] Add autonomous bug-detection and remediation hooks into the task loop:
  - Integrate the refactored trigger and execution-flow system so code-change events, task failures, or verification failures can create follow-up work or re-run corrective flows
  - Keep the first version explicit and observable: every autonomous action should produce visible task-state changes and traceable logs rather than hidden background behavior
  - Document the behavior in `docs/architecture/board/autonomous-agent-loop.md` with YAML front matter and wiki-links to `[[Kanban-Board-Model]]`

- [ ] Document the board UX for future product evolution:
  - Create `docs/architecture/board/task-card-design.md` with YAML front matter and wiki-links to `[[Kanban-Board-Model]]` and `[[Autonomous-Agent-Loop]]`
  - Describe how engineers interpret agent ownership, progress, blockers, retries, and completion in the board interface

- [ ] Write tests for the board and autonomous execution loop:
  - Add UI tests for column grouping, task-card rendering, status transitions, and blocked or failed-state behavior
  - Add service-level tests for claiming tasks, parallel-eligibility decisions, and orchestration updates shared with the running-agent view

- [ ] Run validation for the board phase and fix failures:
  - Run targeted board, orchestration, and task-layer tests first
  - Run `npm run check`
  - Verify the Kanban board and running-agent prototype stay synchronized for task execution visibility
