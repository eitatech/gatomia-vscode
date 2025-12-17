# Implementation Plan: Spec Explorer review flow

**Branch**: `001-spec-review-flow` | **Date**: 2025-12-07 | **Spec**: `specs/001-spec-review-flow/spec.md`
**Input**: Feature specification from `/specs/001-spec-review-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Extend SpecExplorer so authors explicitly send completed specs to the Review folder once all tasks and checklist items finish, reviewers can archive or unarchive specs as blockers are resolved/discovered, and the existing change-request/task flow continues to reopen specs when necessary. Implementation centers on enforcing button gating rules, persisting status transitions (Current → Review → Archived/Unarchived), instrumenting telemetry for Send to Review/Archived/Unarchived, and ensuring UI/webview state mirrors extension-side updates.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (extension + React webview)  
**Primary Dependencies**: VS Code Extension API, React 18, Vite build, Zustand/store utilities, Vitest + Testing Library  
**Storage**: Local workspace specs + in-memory stores (no external DB)  
**Testing**: Vitest unit + integration suites (tests/unit, tests/integration)  
**Target Platform**: VS Code desktop (Extension Development Host)  
**Project Type**: VS Code extension with React webview companion  
**Performance Goals**: Spec transitions visible within 2 minutes; button enablement within 1 minute of last task completion; UI interactions under 200 ms paint time  
**Constraints**: Enforce TDD, instrumentation for status transitions, no blocking operations on VS Code extension host thread  
**Scale/Scope**: Tens of concurrent specs per workspace; each spec may have up to ~10 change requests/tasks in-flight

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Kebab-case naming**: PASS — existing directories/files already conform and added artifacts will follow (spec docs already kebab-case).
- **TypeScript-first development**: PASS — extension + webview remain TypeScript with strict configs; no alternate languages introduced.
- **Test-first development**: PASS — plan mandates Vitest specs for button gating, telemetry, and state transitions before implementation.
- **Observability & instrumentation**: PASS — Send to Review/Archived flows require telemetry/logging per success criteria.
- **Simplicity & YAGNI**: PASS — scope limited to review/archive workflow refinements without speculative features.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── extension.ts
├── features/
│   └── spec/
│       └── review-flow/
│           ├── commands/
│           ├── services/
│           ├── telemetry/
│           ├── state/
│           └── storage.ts   # helpers for persisting spec/change-request state
├── providers/
├── utils/
└── webview/

ui/
├── src/
│   ├── components/spec-explorer/
│   │   ├── review-list/
│   │   ├── actions/
│   │   └── change-requests/
│   ├── hooks/
│   └── stores/
└── tests/

tests/
├── unit/features/spec/
├── integration/spec-explorer/
└── webview/
```

**Structure Decision**: Single VS Code extension project with a React webview bundle. Backend logic (extension host) lives in `src/` while UI resides in `ui/`. Tests follow existing Vitest layout under `tests/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Phase 0 – Research & Clarifications

### Unknowns Identified

- How to reliably determine when all tasks/checklist items are complete so Send to Review only appears when valid.
- Whether archiving should move physical files or simply update status metadata.
- What telemetry/logging is required to prove success criteria (transition SLAs, duplicate prevention).

### Research Tasks Executed

- Reviewed existing SpecExplorer state service and checklist aggregation to confirm gating signals.
- Assessed options for persisting Archived specs without disrupting file paths.
- Evaluated observability expectations from constitution + success criteria to scope telemetry fields.

### Outcomes (see `research.md`)

- Send to Review gating will use the extension’s normalized task/checklist counters, refreshed via worker events.
- Archived specs become a new FSM state + Archived lane; no file moves required.
- Structured telemetry events will log Send to Review/Archived plus reopen flows, including latency + blocker counts.

## Phase 1 – Design & Contracts

### Data Model (`data-model.md`)

- Specification entity now includes `status` enum `current | review | reopened | archived`, timestamps (`reviewEnteredAt`, `archivedAt`), and blocker counters (`pendingTasks`, `pendingChecklistItems`).
- ChangeRequest captures an `archivalBlocker` flag to guard Send to Archived/Unarchive and models reopen transitions.
- FSM extended with Review ↔ Archived ↔ Unarchived paths plus validation rules ensuring gating occurs only when blockers are zero.

### API Contracts (`contracts/spec-review-flow.yaml`)

- Added `/specs/{specId}/send-to-review`, `/specs/{specId}/send-to-archived`, and `/specs/{specId}/unarchive` endpoints with 409 error payloads describing blockers.
- Updated `/specs/review` listing schema and specification object fields to expose pending counts and change requests.
- Extended change-request payload with `archivalBlocker` and expanded telemetry-friendly metadata on specification responses.

### Quickstart (`quickstart.md`)

- Documented the explicit Send to Review flow with enablement messaging, plus the reviewer-facing Send to Archived workflow.
- Updated workflows to reference the Review lane (formerly Ready to Review) and the archive lane, including implementation files/tests.
- Refreshed FSM diagrams and lane descriptions to include the Archived state and unarchive escape hatch.

### Agent Context

- Ran `.specify/scripts/bash/update-agent-context.sh codex` to capture TypeScript/VS Code extension stack details for downstream agents.

## Constitution Check – Post Design

- **Kebab-case**: Still PASS — no new files violate naming.
- **TypeScript-first**: PASS — designs continue to rely on TS for extension + React webview.
- **Test-first**: PASS — plan requires Vitest specs before feature coding (see Phase 2 steps).
- **Observability**: PASS — telemetry coverage defined in research + contracts.
- **Simplicity/YAGNI**: PASS — Archived lane implemented via status flags rather than new services.

## Phase 2 – Implementation Outline

1. **Extension state updates**: Extend spec state machine, add `canSendToReview/Archive/Unarchive` helpers, persist timestamps, multi-change-request enforcement, and emit telemetry. Cover with unit tests in `tests/unit/features/spec/review-flow-*.test.ts`.
2. **Commands & providers**: Implement Send to Review/Archived/Unarchive commands plus providers that refresh lanes, ensuring multi-spec concurrency safety.
3. **Webview UI**: Add gated buttons, Archived lane component, unarchive action, blocker messaging, and optimistic disable/enable feedback using Zustand stores. Include component/unit tests in `ui/src/components/spec-explorer/__tests__`.
4. **Change request integration**: Wire `archivalBlocker` updates when change requests open/close; ensure reopen flows bring specs back to Current Specs automatically even when archived/unarchived.
5. **Observability & QA**: Emit telemetry/logs for actions, add integration tests validating transitions, and verify success criteria metrics via mocked timers plus telemetry dashboards that track send/transition latency.
