# Tasks: Devin Remote Implementation Integration

**Input**: Design documents from `/specs/001-devin-integration/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md

**Tests**: Tests are included per project constitution (TDD required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create feature directory structure: `src/features/devin/`, `ui/src/components/devin/`, `tests/unit/features/devin/`, `tests/integration/devin/`
- [x] T002 [P] Verify native fetch API availability (no external HTTP client needed - using native fetch per YAGNI)
- [x] T003 Configure Devin feature constants and configuration defaults in `src/features/devin/config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Types and Contracts

- [x] T004 [P] Create Devin API type definitions in `src/features/devin/types.ts` (enums: SessionStatus, TaskStatus, EventType, ApiVersion)
- [x] T005 [P] Create entity interfaces in `src/features/devin/entities.ts` (DevinSession, DevinTask, DevinCredentials, DevinProgressEvent)
- [x] T006 Implement API version detection utility in `src/features/devin/api-version-detector.ts` (detectApiVersion function)

### API Client Foundation

- [x] T007 Create base Devin API client interface in `src/features/devin/devin-api-client.ts`
- [x] T008 Implement v3 API client methods in `src/features/devin/devin-api-client-v3.ts` (createSession, getSession, listSessions)
- [x] T009 Implement v1/v2 API client methods in `src/features/devin/devin-api-client-v1.ts` (createSession, getSession, listSessions)
- [x] T010 Create API client factory in `src/features/devin/devin-api-client-factory.ts` (returns appropriate client based on token prefix)

### Credentials Management

- [x] T011 Implement credentials manager in `src/features/devin/devin-credentials-manager.ts` (SecretStorage integration, validation)

### Session Storage

- [x] T012 Implement session storage service in `src/features/devin/devin-session-storage.ts` (workspace state, 7-day retention)

### Error Handling & Retry

- [x] T013 Create Devin API error types in `src/features/devin/errors.ts`
- [x] T014 Implement retry logic with exponential backoff in `src/features/devin/retry-handler.ts` (max 3 attempts)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Start Single Task Implementation Remotely (Priority: P1) 🎯 MVP

**Goal**: Enable users to select a single task from a spec and send it to Devin for remote implementation

**Independent Test**: Can be fully tested by selecting one task from a spec, triggering Devin implementation, and verifying Devin receives the correct context (branch, spec, task details) to begin work.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T015 [US1] Unit test for API client createSession in `tests/unit/features/devin/devin-api-client.test.ts`
- [x] T016 [US1] Unit test for session manager startTask in `tests/unit/features/devin/devin-session-manager.test.ts`
- [x] T017 [US1] Unit test for credentials manager in `tests/unit/features/devin/devin-credentials-manager.test.ts`
- [x] T018 [US1] Integration test for single task delegation workflow in `tests/integration/devin/single-task-workflow.test.ts`

### Implementation for User Story 1

- [x] T019 [US1] Implement session manager in `src/features/devin/devin-session-manager.ts` (startTask, mapSpecTaskToDevinPrompt)
- [x] T077 [US1] Implement spec file content reader in `src/features/devin/spec-content-reader.ts` (read spec markdown, extract task details, FR-003)
- [x] T020 [US1] Create VS Code command for "Implement with Devin" in `src/commands/devin-commands.ts` (startSingleTask command)
- [x] T021 [US1] Add context menu item for spec tasks in `src/providers/spec-explorer-provider.ts` ("Implement with Devin" menu item) (manifest update deferred to T056)
- [x] T022 [US1] Implement git branch validation in `src/features/devin/git-validator.ts` (clean working directory check)
- [x] T023 [US1] Create task initiation confirmation dialog in `src/features/devin/task-initiation-ui.ts`
- [x] T024 [US1] Add telemetry for task start events in `src/features/devin/telemetry.ts`
- [x] T025 [US1] Implement error handling and user notifications in `src/features/devin/error-notifications.ts`
- [x] T076 [US1] Implement session cancellation in `src/features/devin/devin-session-manager.ts` (cancelSession method, FR-012)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 3 - Monitor Remote Implementation Progress (Priority: P1)

**Goal**: Provide real-time progress screen showing Devin's implementation status

**Independent Test**: Can be fully tested by initiating a Devin task and verifying the progress screen displays real-time updates including status changes, logs, and artifacts.

**Note**: US3 is P1 and implemented before US2 because monitoring is essential for US1 to be usable.

### Tests for User Story 3 ⚠️

- [x] T026 [US3] Unit test for polling service in `tests/unit/features/devin/devin-polling-service.test.ts`
- [x] T027 [US3] Unit test for session status mapper in `tests/unit/features/devin/status-mapper.test.ts`
- [x] T028 [US3] Integration test for progress monitoring in `tests/integration/devin/progress-monitoring.test.ts`

### Implementation for User Story 3

- [x] T029 [US3] Implement polling service in `src/features/devin/devin-polling-service.ts` (5-10s intervals, status updates)
- [x] T030 [US3] Create Devin progress tree view provider in `src/providers/devin-progress-provider.ts`
- [x] T031 [US3] Implement status mapper in `src/features/devin/status-mapper.ts` (map Devin API status to local status)
- [x] T032 [US3] Create webview message handler in `src/panels/devin-message-handler.ts`
- [x] T033 [US3] Implement Devin progress panel webview in `src/panels/devin-progress-panel.ts`
- [x] T034 [P] [US3] Create React SessionList component in `ui/src/components/devin/session-list.tsx`
- [x] T035 [P] [US3] Create React TaskStatus component in `ui/src/components/devin/task-status.tsx`
- [x] T036 [P] [US3] Create React DevinProgressView component in `ui/src/components/devin/devin-progress-view.tsx`
- [x] T037 [US3] Implement Devin store for webview state in `ui/src/stores/devin-store.ts`
- [x] T038 [US3] Add VS Code command to open Devin progress panel in `src/commands/devin-commands.ts`
- [x] T039 [US3] Implement progress event handling in `src/features/devin/progress-event-handler.ts`
- [x] T040 [US3] Add notification service for completion events in `src/features/devin/notification-service.ts`

**Checkpoint**: At this point, User Stories 1 AND 3 should both work independently (start task + monitor progress)

---

## Phase 5: User Story 2 - Start All Tasks Implementation Remotely (Priority: P2)

**Goal**: Enable batch delegation of all remaining tasks in a spec to Devin

**Independent Test**: Can be fully tested by selecting "Implement all tasks with Devin" from a spec and verifying Devin receives all task contexts with proper sequencing information.

### Tests for User Story 2 ⚠️

- [x] T041 [US2] Unit test for batch task processing in `tests/unit/features/devin/batch-processor.test.ts`
- [x] T042 [US2] Integration test for batch task delegation in `tests/integration/devin/batch-task-workflow.test.ts`

### Implementation for User Story 2

- [x] T043 [US2] Implement batch task processor in `src/features/devin/batch-processor.ts` (queue multiple tasks, dependency handling)
- [x] T044 [US2] Create VS Code command for "Implement All with Devin" in `src/commands/devin-commands.ts` (startAllTasks command)
- [x] T045 [US2] Add "Implement All" button to spec explorer in `src/providers/spec-explorer-provider.ts` (manifest update deferred to T056)
- [x] T046 [US2] Implement batch confirmation dialog in `src/features/devin/batch-initiation-ui.ts`
- [x] T047 [US2] Update session manager for batch operations in `src/features/devin/devin-session-manager.ts` (getStorage accessor + BatchProcessor integration)
- [x] T048 [US2] Add batch progress tracking in `src/features/devin/batch-progress-tracker.ts`

**Checkpoint**: At this point, User Stories 1, 2, and 3 should all work independently

---

## Phase 6: User Story 4 - Review and Approve Devin Pull Request (Priority: P2)

**Goal**: Enable users to review and act on pull requests created by Devin directly from VS Code

**Independent Test**: Can be fully tested by completing a Devin session and verifying the user can access, review, and take action on the resulting pull request from within VS Code.

### Tests for User Story 4 ⚠️

- [x] T049 [US4] Unit test for PR link handler in `tests/unit/features/devin/pr-link-handler.test.ts`
- [x] T050 [US4] Integration test for PR review workflow in `tests/integration/devin/pr-review-workflow.test.ts`

### Implementation for User Story 4

- [x] T051 [US4] Implement PR link handler in `src/features/devin/pr-link-handler.ts` (open PR in VS Code)
- [x] T052 [US4] Create PR review integration in `src/features/devin/pr-review-integration.ts` (approve, request changes, merge)
- [x] T053 [US4] Add PR action buttons to progress panel in `ui/src/components/devin/pull-request-actions.tsx`
- [x] T054 [US4] Implement spec status update on PR merge in `src/features/devin/spec-status-updater.ts`
- [x] T055 [US4] Add PR notification handler in `src/features/devin/pr-notification-handler.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Documentation & Configuration

- [x] T056 [P] Update extension manifest in `package.json` (add Devin commands, views, activation events)
- [x] T057 [P] Add Devin configuration schema in `package.json` (contributes.configuration)
- [x] T058 [P] Create Devin output channel logging in `src/features/devin/logging.ts`

### Error Handling & Edge Cases

- [x] T059 Handle Devin API unavailable errors in `src/features/devin/error-handling.ts`
- [x] T060 Implement network interruption recovery in `src/features/devin/network-recovery.ts`
- [x] T061 Add session timeout handling in `src/features/devin/session-timeout-handler.ts`
- [x] T078 Add merge conflict detection and notification in `src/features/devin/merge-conflict-detector.ts` (edge case handling)
- [x] T063 Add authentication failure handling in `src/features/devin/auth-error-handler.ts`

### Performance & Observability

- [x] T064 [P] Add telemetry for all Devin operations in `src/features/devin/telemetry.ts`
- [x] T065 Implement session cleanup (7-day retention) in `src/features/devin/session-cleanup.ts`
- [x] T066 Add rate limiting protection in `src/features/devin/rate-limiter.ts`
- [x] T067 Optimize polling intervals based on session state in `src/features/devin/devin-polling-service.ts`

### UI Polish

- [x] T068 [P] Add loading states to React components in `ui/src/components/devin/loading-states.tsx`
- [x] T069 [P] Implement error state displays in `ui/src/components/devin/error-display.tsx`
- [x] T070 Add empty state for no active sessions in `ui/src/components/devin/empty-state.tsx`

### Testing

- [x] T071 [P] Add contract tests for Devin API in `tests/contract/devin-api-contract.test.ts`
- [x] T072 [P] Add end-to-end test for complete workflow in `tests/integration/devin/end-to-end.test.ts`

### Validation

- [x] T073 Run quickstart.md validation - verify all setup steps work
- [x] T074 Run `npm run check` - ensure all linting passes
- [x] T075 Run `npm test` - ensure all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US3 → US2 → US4)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for session creation but can use mock data for testing
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 infrastructure
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 and US3 for sessions and progress

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/entities before services
- Services before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 and US3 can start in parallel
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- React components within US3 marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for API client createSession in tests/unit/features/devin/devin-api-client.test.ts"
Task: "Unit test for session manager startTask in tests/unit/features/devin/devin-session-manager.test.ts"
Task: "Unit test for credentials manager in tests/unit/features/devin/devin-credentials-manager.test.ts"

# After tests are written and failing, launch implementation:
Task: "Implement session manager in src/features/devin/devin-session-manager.ts"
Task: "Create VS Code command for 'Implement with Devin' in src/commands/devin-commands.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + US3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (start single task)
4. Complete Phase 4: User Story 3 (monitor progress) - essential for US1 usability
5. **STOP and VALIDATE**: Test User Story 1 + 3 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + US3 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 4 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (start single task)
   - Developer B: User Story 3 (monitor progress) - in parallel with US1
   - Developer C: User Story 2 (batch tasks) - after US1 complete
   - Developer D: User Story 4 (PR review) - after US3 complete
3. Stories complete and integrate independently

---

## Task Summary

| Phase | Tasks | Story | Priority |
|-------|-------|-------|----------|
| Phase 1: Setup | 3 | - | - |
| Phase 2: Foundational | 11 | - | - |
| Phase 3: US1 | 13 | Start Single Task | P1 |
| Phase 4: US3 | 12 | Monitor Progress | P1 |
| Phase 5: US2 | 8 | Start All Tasks | P2 |
| Phase 6: US4 | 7 | Review PR | P2 |
| Phase 7: Polish | 18 | - | - |
| **Total** | **72** | | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **CRITICAL: Tests MUST be written BEFORE implementation (TDD)** - no [P] marker on test tasks
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All file names use kebab-case per project constitution
- All code must pass `npm run check` before completion
- Use native fetch API (no axios/external HTTP clients per YAGNI)
