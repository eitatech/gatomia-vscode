# Phase 04: Pluggable Task Source and Execution Model

This phase creates the pluggable task foundation that lets GatomIA read, normalize, and act on tasks coming from SpecKit, OpenSpec, and future specification providers. It matters because the later Kanban and autonomous-agent features depend on a stable task model, and the project needs that model to be provider-agnostic rather than hard-wired to one specification system.

## Tasks

- [x] Audit existing task parsing and spec-system integration before building a new task layer:
  - Inspect `src/utils/task-parser.ts`, `src/utils/spec-kit-adapter.ts`, spec review-flow task dispatch code, prompt targets, and any current task-oriented UI or commands
  - Reuse the existing spec adapter and parser seams where possible so the new task source layer plugs into real project structures instead of duplicating discovery logic
  - Capture the design in `docs/architecture/tasks/pluggable-task-source-model.md` with YAML front matter and wiki-links to `[[Task-Normalization-Contract]]` and `[[Autonomous-Execution-States]]`

- [x] Implement a normalized task domain model and provider interface:
  - Create a small provider contract that can ingest tasks from SpecKit, OpenSpec, and future task providers without changing downstream board or orchestration code
  - Normalize task identity, grouping, status, source metadata, blocking relationships, execution hints, and file references using the smallest useful model
  - Preserve a clear separation between source-specific parsing and normalized task consumption

- [x] Build the first provider implementations and read services:
  - Implement provider adapters for existing SpecKit and OpenSpec task sources by reusing current adapter and parser behavior where possible
  - Add a task aggregation service that can expose normalized task collections to orchestration and future board UIs
  - Include explicit handling for unsupported or partially parsed task sources so the system degrades clearly instead of silently failing

- [ ] Add autonomous execution metadata for downstream agent orchestration:
  - Extend the normalized task model with execution intent, suggested agent role, parallelization eligibility, and observable lifecycle states without yet building the full board UI
  - Ensure the model can represent queued, ready, running, blocked, completed, failed, and skipped states consistently across providers
  - Document these states in `docs/architecture/tasks/autonomous-execution-states.md` with YAML front matter and wiki-links to `[[Pluggable-Task-Source-Model]]`

- [ ] Document provider integration for future extensibility:
  - Create `docs/architecture/tasks/task-normalization-contract.md` explaining how new spec or task systems can plug into GatomIA
  - Include required metadata, parsing expectations, and compatibility rules using Obsidian-style wiki-links across the task docs

- [ ] Write tests for normalized task ingestion and provider behavior:
  - Add unit tests for provider adapters, normalization rules, unsupported-source handling, and execution-state mapping
  - Add integration-style tests that prove task sources can be discovered from realistic SpecKit and OpenSpec workspace layouts

- [ ] Run task-layer validation and fix failures:
  - Run targeted task and adapter tests first
  - Run `npm run check`
  - Verify the new task source layer does not break current spec browsing or existing task-related commands
