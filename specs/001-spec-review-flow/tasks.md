# Tasks: Spec Explorer review flow

**Input**: Design documents from `/specs/001-spec-review-flow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Extend specification/change-request interfaces with `review`, `archived`, `archivalBlocker`, and blocker metadata in `src/features/spec/review-flow/types.ts`
- [X] T002 [P] Define telemetry event constants for Send to Review, Send to Archived, reopen, unarchive, and dispatch flows in `src/features/spec/review-flow/telemetry.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 [P] Author new/updated unit tests that cover status persistence (including multi-change-request reopen rules), pending counters, and archived/unarchive state transitions in `tests/unit/features/spec/review-flow-state.test.ts`
- [X] T004 Persist new status fields, pending counts, timestamps, multi-request enforcement, and unarchive hooks in the SpecExplorer state store in `src/features/spec/review-flow/state.ts`
- [X] T005 [P] Update storage serialization/deserialization helpers for specs and change requests in `src/features/spec/review-flow/storage.ts`
- [X] T006 [P] Broadcast Review and Archived lanes plus blocker metadata through the provider in `src/features/spec/providers/spec-explorer-provider.ts`
- [X] T007 [P] Add matching data structures and actions in the webview store at `ui/src/stores/spec-explorer-store.ts`

---

## Phase 3: User Story 1 - Send completed spec to review (Priority: P1) 🎯 MVP

**Goal**: Authors can only send specs to Review when all tasks/checklist items are cleared, moving the document out of Current Specs instantly.
**Independent Test**: Close all blockers on a spec, click Send to Review, and confirm the spec disappears from Current Specs, appears in Review with metadata, and telemetry logs the transition.

### Tests for User Story 1 (write first)

- [X] T008 [P] [US1] Add gating + transition unit tests for `canSendToReview` and state updates in `tests/unit/features/spec/review-flow-send-to-review.test.ts`
- [X] T009 [P] [US1] Add webview tests for button enable/disable messaging in `tests/unit/webview/spec-explorer/send-to-review-button.test.tsx`
- [X] T010 [P] [US1] Create integration test covering spec move Current→Review in `tests/integration/spec-explorer/send-to-review-flow.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement `canSendToReview` gating + status update with timestamps in `src/features/spec/review-flow/state.ts`
- [X] T012 [US1] Register a VS Code command to invoke Send to Review logic in `src/features/spec/review-flow/commands/send-to-review-command.ts`
- [X] T013 [US1] Refresh provider messaging so Current Specs removes the item and Review list receives it in `src/providers/spec-explorer-provider.ts` (already implemented)
- [X] T014 [US1] Build the Send to Review button + blocker tooltip UI in `ui/src/components/spec-explorer/review-list/send-to-review-button.tsx`
- [X] T015 [US1] Emit structured telemetry/logs for send-to-review actions in `src/features/spec/review-flow/telemetry.ts` (already implemented)

**Checkpoint**: MVP ready—Review lane shows only fully completed specs with accurate gating. ✅ **COMPLETED**

---

## Phase 4: User Story 2 - File change request from review (Priority: P2)

**Goal**: Reviewers can file structured change requests directly from Review, pushing specs back to Current Specs with traceable entries in Changes.
**Independent Test**: Submit a change request from a Review spec and confirm it appears in Changes with context, duplicates are prevented, and the spec returns to Current Specs marked Reopened.

### Tests for User Story 2 (write first)

- [X] T016 [P] [US2] Extend unit tests for change-request creation, reopen transition, duplicate guard, and multi-change-request reopening rules in `tests/unit/features/spec/review-flow-change-request-from-review.test.ts`
- [X] T017 [P] [US2] Cover form validation + surface existing change-request info in `tests/unit/webview/spec-explorer/change-request-form.test.tsx`
- [X] T018 [P] [US2] Add integration test for Review→Reopened workflow (including concurrent change requests) in `tests/integration/spec-explorer/change-requests-from-review.test.ts`

### Implementation for User Story 2

- [X] T019 [US2] Enhance `change-requests-service` to capture review context, set `archivalBlocker`, track multi-change-request blockers, and mark specs reopened in `src/features/spec/review-flow/change-requests-service.ts`
- [X] T020 [US2] Update provider/webview messaging to push change requests into the Changes lane in `src/features/spec/providers/spec-explorer-provider.ts`
- [X] T021 [US2] Update the change-request form component with Review metadata + duplicate surfacing in `ui/src/components/spec-explorer/change-request-form.tsx`
- [X] T022 [US2] Render blocker highlights + edit affordances (including counts when multiple blockers exist) in `ui/src/components/spec-explorer/changes-list.tsx`
- [X] T023 [US2] Emit telemetry/log entries for change-request submissions, reopen events, and outstanding-blocker counts in `src/features/spec/review-flow/telemetry.ts`

**Checkpoint**: Reviewers can document issues without leaving Review, and specs re-enter Current Specs automatically.

---

## Phase 5: User Story 3 - Archive reviewed specs (Priority: P2)

**Goal**: Reviewers can archive verified specs, removing them from Review and storing immutable metadata in an Archived lane.
**Independent Test**: From a Review spec with zero blockers, click Send to Archived; confirm removal from Review, appearance in Archived, read-only view, and transition telemetry.

### Tests for User Story 3 (write first)

- [X] T024 [P] [US3] Add unit tests for `canArchive`, blocker detection, and `archivedAt` timestamping in `tests/unit/features/spec/review-flow-archive.test.ts`
- [X] T025 [P] [US3] Add component tests for archive button gating and blocker tooltips in `tests/unit/webview/spec-explorer/archive-button.test.tsx`
- [X] T026 [P] [US3] Expand integration coverage to verify Review removal + Archived listing in `tests/integration/spec-explorer/archive-flow.test.ts`

### Implementation for User Story 3

- [X] T027 [US3] Implement archive transition logic with logging + audit trail, including checks for multi-change-request blockers, in `src/features/spec/review-flow/state.ts`
- [X] T028 [US3] Register archive and unarchive commands plus provider events in `src/features/spec/review-flow/commands/send-to-archived-command.ts`
- [X] T029 [US3] Build the archived lane and read-only panel (with Unarchive action) in `ui/src/components/spec-explorer/archived-list.tsx`
- [X] T030 [US3] Add archive button + gating indicators to the Review list UI at `ui/src/components/spec-explorer/review-list/archive-button.tsx`
- [X] T031 [US3] Emit telemetry/log entries for archive success/failure and unarchive actions in `src/features/spec/review-flow/telemetry.ts`

**Checkpoint**: Review stays lean; archived specs remain accessible without polluting active queues.

---

## Phase 6: User Story 4 - Generate tasks and reopen spec (Priority: P3)

**Goal**: Change requests can dispatch to the tasks prompt, reopen specs until fixes are done, and automatically return them to Review afterward.
**Independent Test**: Dispatch a change request → tasks attached; failure surfaces retry; mark tasks complete and confirm spec returns to Review with addressed change request.

### Tests for User Story 4 (write first)

- [X] T032 [P] [US4] Add unit tests for task dispatch payloads, retry, and reopen→review FSM in `tests/unit/features/spec/review-flow-tasks-dispatch.test.ts`
- [X] T033 [P] [US4] Add integration test covering dispatch, task completion, and auto-return to Review in `tests/integration/spec-explorer/tasks-dispatch-flow.test.ts`
- [X] T034 [P] [US4] Cover webview actions UI states (dispatch, retry, progress) in `tests/unit/webview/spec-explorer/change-request-actions.test.tsx`

### Implementation for User Story 4

- [X] T035 [US4] Implement contract-compliant tasks prompt wrapper with latency/error tracking in `src/features/spec/review-flow/tasks-dispatch.ts`
- [X] T036 [US4] Attach tasks, set `archivalBlocker`, and detect completion → Review transitions in `src/features/spec/review-flow/state.ts`
- [X] T037 [US4] Update provider to broadcast task/CR status updates in `src/features/spec/providers/spec-explorer-provider.ts`
- [X] T038 [US4] Build UI actions for dispatch/retry/status badges in `ui/src/components/spec-explorer/change-request-actions.tsx`
- [X] T039 [US4] Emit telemetry/metrics for dispatch successes, failures, and durations in `src/features/spec/review-flow/telemetry.ts`

**Checkpoint**: End-to-end remediation loop complete—specs reopen until tasks resolve and return to Review automatically.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T040 [P] Update `specs/001-spec-review-flow/quickstart.md` and user-facing docs with new Review/Archived/Unarchive workflows
- [X] T041 [P] Run repo-wide lint, format, and targeted test suites for review flow (`npm run lint`, `npm run test -- review-flow`)
- [X] T042 [P] Validate telemetry dashboards/logging configs reflect Send to Review/Archived/Unarchive events in `src/features/spec/review-flow/telemetry.ts`
- [X] T043 [P] Add latency-focused integration tests (mock timers) verifying SC-001/SC-002/SC-006 thresholds in `tests/integration/spec-explorer/review-flow-latency.test.ts`
- [X] T044 Document success-criteria monitoring dashboards and alerting thresholds in `docs/review-flow-observability.md`

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup enables shared typing/telemetry; foundational persistence and provider changes must complete before user stories.
- **User Stories**: US1 (P1) builds Send to Review gating and is the MVP. US2 depends on foundational work and reuses US1 Review lane. US3 depends on US1 + US2 data because archiving checks change requests. US4 can start after foundational work but benefits from US2 infrastructure.
- **Graph**: Phase1 → Phase2 → US1 → {US2, US4} → US3 (archiving requires US2 blockers to resolve) → Polish.

---

## Parallel Execution Examples

### User Story 1

- Run T008–T010 tests in parallel (unit, webview, integration) because they hit independent files.
- Implement T011–T015 concurrently by splitting extension-state (T011–T013) and webview/telemetry (T014–T015) across contributors.

### User Story 2

- T016–T018 tests run simultaneously; they mock the provider independently.
- T019 (service) and T021 (form UI) can progress in parallel; T020/T022 follow once service/UI shapes finalize.

### User Story 3

- T024–T026 test tasks share fixtures but separate files—execute concurrently.
- T027/T028 (extension) can run parallel to T029/T030 (webview); T031 telemetry wiring follows completion of either branch.

### User Story 4

- T032–T034 tests cover state, integration, and UI components independently.
- T035/T037/T038 touch different layers (dispatch service, provider, UI) and can move in parallel after payload schema agreement; T036/T039 integrate results afterward.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational phases to align types, persistence, and providers.
2. Deliver US1 end-to-end (tests + implementation + telemetry).
3. Validate Review lane accuracy and gating before taking on additional scope.

### Incremental Delivery

1. **US1**: Ship Send to Review gating + Review lane clarity.
2. **US2**: Layer change requests + reopen cycle while keeping US1 stable.
3. **US3**: Add archiving once Review contains only vetted specs.
4. **US4**: Finish remediation automation and telemetry to close the loop.
5. Use Polish phase for docs, monitoring, and repo-wide quality gates.

### Parallel Team Strategy

- After Phase 2, dedicate one engineer to US1 (extension), one to US1 UI/tests, enabling quick MVP.
- Once US1 code stabilizes, assign:
  - Developer A: US2 service/provider work.
  - Developer B: US3 archiving UI + commands (after US2 blockers logic ready).
  - Developer C: US4 tasks dispatch + telemetry.
- Reconvene for Polish tasks to ensure consistency and release readiness.
