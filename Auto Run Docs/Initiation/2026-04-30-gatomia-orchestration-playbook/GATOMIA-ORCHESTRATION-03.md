# Phase 03: Hook and Trigger Engine Refactor

This phase simplifies the current hooks architecture into a clearer execution-flow engine that can model hooks, triggers, and schedules without duplicated concepts or fragmented UI rules. It matters because the existing hooks system already has useful behavior and persistence, but the project now needs a flexible foundation that can react to execution flows, code changes, and future scheduling rules without piling on more ad hoc configuration paths.

## Tasks

- [x] Audit and model the current hook system before refactoring it:
  - Inspect `src/features/hooks/`, the hook providers, and the hooks webview components to identify overlap between trigger configuration, action configuration, validation, execution, and logging
  - Reuse existing persistence and type definitions when viable; only introduce new abstractions if they eliminate concrete duplication or ambiguity
  - Capture the target architecture in `docs/architecture/hooks/hook-execution-model.md` with YAML front matter and wiki-links to `[[Trigger-Model]]`, `[[Schedule-Model]]`, and `[[Hook-Composer-UX]]`

- [x] Refactor the backend hook model into a clearer execution-flow contract:
  - Introduce a normalized domain model that separates event sources, conditions, schedules, and actions while preserving migration from the current stored hook shape
  - Extend trigger support so future phases can react to execution-flow events, repository or file-code changes, and explicit manual triggers without rewriting the executor again
  - Preserve backward compatibility for existing stored hooks only where necessary for current workspace state migration
  - Add telemetry and output-channel logging for evaluation, execution, skip reasons, and failure reasons

- [x] Refactor hook execution and validation around the new model:
  - Reuse `HookManager`, `HookExecutor`, `TriggerRegistry`, and related services where possible before creating replacement files
  - Consolidate validation so trigger, schedule, and action errors are surfaced consistently in one place
  - Make room for schedule stubs or interfaces even if full scheduler execution lands in a later phase, so the model is ready now without overbuilding

- [ ] Redesign the hooks configuration UI around the simplified model:
  - Reuse current hooks-view patterns, selector components, and argument-template editing where they still fit
  - Replace confusing or redundant configuration paths with a clearer composition flow for event source, conditions, timing, and actions
  - Ensure the UI language matches the new execution-flow model and remains understandable to engineers who are not already familiar with the current internal terminology

- [ ] Create structured documentation for the new hook system:
  - Write `docs/architecture/hooks/trigger-model.md` and `docs/architecture/hooks/schedule-model.md` with YAML front matter and wiki-links back to `[[Hook-Execution-Model]]`
  - Write `docs/architecture/hooks/hook-composer-ux.md` describing how users create and reason about hooks, triggers, and schedules in the redesigned UI

- [ ] Write tests for the refactored hook engine and UI:
  - Add or update unit tests for migrations, validation, trigger evaluation, and execution logging
  - Add UI tests that cover the simplified configuration flow and key validation/error states
  - Prefer extending current hook provider and component test suites before introducing new fixtures

- [ ] Run the hook-system quality gates and fix failures:
  - Run targeted hook-related tests first
  - Run `npm run check`
  - Verify existing hook import, export, enable, disable, and execution-log workflows still function after the refactor
