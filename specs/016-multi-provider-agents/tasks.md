# Tasks: Multi-Provider Cloud Agent Support

**Input**: Design documents from `/specs/016-multi-provider-agents/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per constitution TDD requirement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Extension source**: `src/features/cloud-agents/`, `src/providers/`, `src/panels/`, `src/commands/`
- **Webview source**: `ui/src/components/cloud-agents/`, `ui/src/stores/`
- **Tests**: `tests/unit/features/cloud-agents/`, `tests/unit/webview/`, `tests/integration/cloud-agents/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the provider-agnostic module, UI, and test file skeletons

- [X] T001 Create module skeleton files in `src/features/cloud-agents/types.ts`, `src/features/cloud-agents/cloud-agent-provider.ts`, and `src/features/cloud-agents/provider-registry.ts`
- [X] T002 [P] Create storage/service skeleton files in `src/features/cloud-agents/provider-config-store.ts`, `src/features/cloud-agents/agent-session-storage.ts`, `src/features/cloud-agents/agent-polling-service.ts`, `src/features/cloud-agents/session-cleanup-service.ts`, `src/features/cloud-agents/migration-service.ts`, and `src/features/cloud-agents/logging.ts`
- [X] T003 [P] Create provider adapter skeleton files in `src/features/cloud-agents/adapters/devin-adapter.ts` and `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T004 [P] Create extension UI skeleton files in `src/providers/cloud-agent-progress-provider.ts`, `src/panels/cloud-agent-progress-panel.ts`, `src/panels/cloud-agent-message-handler.ts`, and `src/commands/cloud-agent-commands.ts`
- [X] T005 [P] Create webview skeleton files in `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`, `ui/src/components/cloud-agents/session-list.tsx`, `ui/src/components/cloud-agents/task-status.tsx`, `ui/src/components/cloud-agents/empty-state.tsx`, `ui/src/components/cloud-agents/error-display.tsx`, `ui/src/components/cloud-agents/loading-states.tsx`, `ui/src/components/cloud-agents/pull-request-actions.tsx`, and `ui/src/stores/cloud-agent-store.ts`
- [X] T006 [P] Create test skeleton files in `tests/unit/features/cloud-agents/provider-contract.test.ts`, `tests/unit/features/cloud-agents/provider-registry.test.ts`, `tests/unit/features/cloud-agents/provider-config-store.test.ts`, `tests/unit/features/cloud-agents/agent-session-storage.test.ts`, `tests/unit/features/cloud-agents/agent-polling-service.test.ts`, `tests/unit/features/cloud-agents/migration-service.test.ts`, `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`, `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`, `tests/unit/webview/cloud-agent-store.test.ts`, `tests/unit/webview/session-list.test.ts`, `tests/unit/webview/cloud-agent-progress-view.test.ts`, and `tests/integration/cloud-agents/provider-switching.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts, storage, polling, and logging infrastructure that blocks all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase (TDD)

- [X] T007 [P] Write contract tests for canonical provider/session/task types in `tests/unit/features/cloud-agents/provider-contract.test.ts`
- [X] T008 [P] Write registry behavior tests in `tests/unit/features/cloud-agents/provider-registry.test.ts`
- [X] T009 [P] Write provider configuration persistence tests in `tests/unit/features/cloud-agents/provider-config-store.test.ts`
- [X] T010 [P] Write session storage and read-only retention tests in `tests/unit/features/cloud-agents/agent-session-storage.test.ts`
- [X] T011 [P] Write migration and polling orchestration tests in `tests/unit/features/cloud-agents/migration-service.test.ts` and `tests/unit/features/cloud-agents/agent-polling-service.test.ts`

### Implementation for Foundational Phase

- [X] T012 Implement canonical provider, session, task, pull request, and error types in `src/features/cloud-agents/types.ts` and `src/features/cloud-agents/cloud-agent-provider.ts`
- [X] T013 Implement provider registration and active-provider orchestration in `src/features/cloud-agents/provider-registry.ts`
- [X] T014 Implement workspace-backed provider configuration persistence in `src/features/cloud-agents/provider-config-store.ts`
- [X] T015 Implement provider-agnostic session CRUD and read-only marking in `src/features/cloud-agents/agent-session-storage.ts`
- [X] T016 Implement migration and cleanup services in `src/features/cloud-agents/migration-service.ts` and `src/features/cloud-agents/session-cleanup-service.ts`
- [X] T017 Implement polling orchestration and provider hooks in `src/features/cloud-agents/agent-polling-service.ts`
- [X] T018 Implement shared logging helpers in `src/features/cloud-agents/logging.ts` and wire them into `src/features/cloud-agents/provider-registry.ts`, `src/features/cloud-agents/provider-config-store.ts`, and `src/features/cloud-agents/agent-session-storage.ts`
- [X] T019 Verify foundational coverage in `tests/unit/features/cloud-agents/provider-contract.test.ts`, `tests/unit/features/cloud-agents/provider-registry.test.ts`, `tests/unit/features/cloud-agents/provider-config-store.test.ts`, `tests/unit/features/cloud-agents/agent-session-storage.test.ts`, `tests/unit/features/cloud-agents/migration-service.test.ts`, and `tests/unit/features/cloud-agents/agent-polling-service.test.ts`

**Checkpoint**: Foundation ready. Contracts, storage, migration, cleanup, polling, and logging are available for all stories.

---

## Phase 3: User Story 1 - Select and Configure a Cloud Agent Provider (Priority: P1) MVP

**Goal**: Users can select a provider from the Cloud Agents welcome state, configure credentials, switch providers, and existing Devin users are auto-migrated.

**Independent Test**: Open Cloud Agents, verify the welcome view shows provider options, configure a provider, confirm the selected provider is persisted and shown, and verify existing Devin users are auto-migrated.

### Tests for User Story 1 (TDD)

- [X] T020 [P] [US1] Write Devin adapter credential lifecycle tests in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`
- [X] T021 [P] [US1] Write GitHub Copilot adapter credential lifecycle tests in `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`
- [X] T022 [P] [US1] Write provider welcome and migration tests in `tests/unit/webview/cloud-agent-progress-view.test.ts` and `tests/integration/cloud-agents/provider-switching.test.ts`

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement Devin adapter metadata and credential methods in `src/features/cloud-agents/adapters/devin-adapter.ts`
- [X] T024 [P] [US1] Implement GitHub Copilot adapter metadata and credential methods in `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T025 [US1] Implement provider selection and credential commands in `src/commands/cloud-agent-commands.ts`
- [X] T026 [US1] Implement provider welcome-state rendering and selection logic in `src/providers/cloud-agent-progress-provider.ts` and `ui/src/components/cloud-agents/empty-state.tsx`
- [X] T027 [US1] Register Cloud Agents view and provider-selection commands in `package.json`
- [X] T028 [US1] Bootstrap adapters, migration, and provider selection wiring in `src/extension.ts`
- [X] T029 [US1] Add telemetry and logging for selection, credential changes, and migration in `src/features/cloud-agents/provider-registry.ts`, `src/features/cloud-agents/migration-service.ts`, and `src/commands/cloud-agent-commands.ts`
- [X] T030 [US1] Validate User Story 1 in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`, `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`, `tests/unit/webview/cloud-agent-progress-view.test.ts`, and `tests/integration/cloud-agents/provider-switching.test.ts`

**Checkpoint**: Provider selection and configuration work independently. Existing Devin users are migrated automatically.

---

## Phase 4: User Story 2 - View Task Progress for the Active Provider (Priority: P2)

**Goal**: Users can view active and recent sessions from the active provider with provider-specific status details, external links, and polling updates.

**Independent Test**: Configure a provider, seed or create sessions, verify the tree view and panel render live status, PR links, and previous-provider read-only sessions.

### Tests for User Story 2 (TDD)

- [X] T031 [P] [US2] Write provider polling and status-mapping tests in `tests/unit/features/cloud-agents/agent-polling-service.test.ts`, `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`, and `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`
- [X] T032 [P] [US2] Write webview store and list rendering tests in `tests/unit/webview/cloud-agent-store.test.ts`, `tests/unit/webview/session-list.test.ts`, and `tests/unit/webview/cloud-agent-progress-view.test.ts`

### Implementation for User Story 2

- [X] T033 [P] [US2] Implement Devin session status mapping, completion handling, and blocked-session actions in `src/features/cloud-agents/adapters/devin-adapter.ts`
- [X] T034 [P] [US2] Implement GitHub Copilot session status mapping, linked PR extraction, and blocked-session actions in `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T035 [US2] Implement provider-agnostic tree view session rendering in `src/providers/cloud-agent-progress-provider.ts`
- [X] T036 [US2] Implement provider-agnostic state store and main panel view in `ui/src/stores/cloud-agent-store.ts` and `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`
- [X] T037 [P] [US2] Implement session and task UI components in `ui/src/components/cloud-agents/session-list.tsx`, `ui/src/components/cloud-agents/task-status.tsx`, and `ui/src/components/cloud-agents/pull-request-actions.tsx`
- [X] T038 [P] [US2] Implement empty, loading, and error UI states in `ui/src/components/cloud-agents/empty-state.tsx`, `ui/src/components/cloud-agents/loading-states.tsx`, and `ui/src/components/cloud-agents/error-display.tsx`
- [X] T039 [US2] Implement webview panel and message bridge in `src/panels/cloud-agent-progress-panel.ts` and `src/panels/cloud-agent-message-handler.ts`
- [X] T040 [US2] Wire polling, cleanup, blocked notifications, and panel refresh in `src/extension.ts`
- [X] T041 [US2] Add telemetry and logging for polling, status updates, cleanup, and external link actions in `src/features/cloud-agents/agent-polling-service.ts`, `src/features/cloud-agents/session-cleanup-service.ts`, and `src/providers/cloud-agent-progress-provider.ts`
- [X] T042 [US2] Validate User Story 2 in `tests/unit/features/cloud-agents/agent-polling-service.test.ts`, `tests/unit/webview/cloud-agent-store.test.ts`, `tests/unit/webview/session-list.test.ts`, and `tests/unit/webview/cloud-agent-progress-view.test.ts`

**Checkpoint**: Active and recent provider sessions render correctly and update through polling.

---

## Phase 5: User Story 3 - Dispatch a Task to the Active Provider (Priority: P3)

**Goal**: Users can dispatch spec tasks to the active provider and immediately track the resulting session from the Cloud Agents area.

**Independent Test**: Trigger “Run with Cloud Agent” from the spec explorer, confirm the task is dispatched to the active provider, and verify a new session appears and begins polling.

### Tests for User Story 3 (TDD)

- [X] T043 [P] [US3] Write Devin dispatch tests in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`
- [X] T044 [P] [US3] Write GitHub Copilot dispatch tests in `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`
- [X] T045 [P] [US3] Write command-level dispatch integration tests in `tests/integration/cloud-agents/provider-switching.test.ts`

### Implementation for User Story 3

- [X] T046 [P] [US3] Implement Devin session creation mapping in `src/features/cloud-agents/adapters/devin-adapter.ts`
- [X] T047 [P] [US3] Implement GitHub Copilot issue assignment and session creation in `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T048 [US3] Implement run and start dispatch command flows in `src/commands/cloud-agent-commands.ts`
- [X] T049 [US3] Register cloud-agent dispatch commands and spec explorer menu contributions in `package.json`
- [X] T050 [US3] Wire new-session persistence, polling start, and provider redirect behavior in `src/extension.ts`, `src/commands/cloud-agent-commands.ts`, and `src/features/cloud-agents/agent-session-storage.ts`
- [X] T051 [US3] Add telemetry and logging for dispatch operations in `src/commands/cloud-agent-commands.ts` and `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T052 [US3] Validate User Story 3 in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`, `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`, and `tests/integration/cloud-agents/provider-switching.test.ts`

**Checkpoint**: Dispatch works for the active provider and new sessions are tracked immediately.

---

## Phase 6: User Story 4 - Cancel or Manage a Running Task (Priority: P4)

**Goal**: Users can cancel running tasks and respond to blocked sessions using provider-specific actions.

**Independent Test**: Start a provider session, cancel it from the tree or panel, and verify status changes; trigger a blocked state and verify the provider-specific action is offered.

### Tests for User Story 4 (TDD)

- [X] T053 [P] [US4] Write Devin cancel and blocked-session tests in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`
- [X] T054 [P] [US4] Write GitHub Copilot cancel and blocked-session tests in `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`
- [X] T055 [P] [US4] Write cancel-command and blocked-notification integration tests in `tests/integration/cloud-agents/provider-switching.test.ts`

### Implementation for User Story 4

- [X] T056 [P] [US4] Implement Devin cancel and blocked-session handling in `src/features/cloud-agents/adapters/devin-adapter.ts`
- [X] T057 [P] [US4] Implement GitHub Copilot cancel and blocked-session handling in `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T058 [US4] Implement cancel command flows and read-only protections in `src/commands/cloud-agent-commands.ts`
- [X] T059 [US4] Register cancel command and running-session menu contributions in `package.json`
- [X] T060 [US4] Wire blocked-session notifications and provider actions in `src/extension.ts` and `src/panels/cloud-agent-message-handler.ts`
- [X] T061 [US4] Add telemetry and logging for cancel and blocked-session events in `src/commands/cloud-agent-commands.ts`, `src/features/cloud-agents/adapters/devin-adapter.ts`, and `src/features/cloud-agents/adapters/github-copilot-adapter.ts`
- [X] T062 [US4] Validate User Story 4 in `tests/unit/features/cloud-agents/adapters/devin-adapter.test.ts`, `tests/unit/features/cloud-agents/adapters/github-copilot-adapter.test.ts`, and `tests/integration/cloud-agents/provider-switching.test.ts`

**Checkpoint**: Cancel and blocked-session management work for any provider.

---

## Phase 7: User Story 5 - Add a New Provider in the Future (Priority: P5)

**Goal**: A developer can add a new provider by implementing the adapter contract and registering it without modifying core logic.

**Independent Test**: Add a mock provider, register it, set it active, and verify the system can route selection, dispatch, and cancel flows through it.

### Tests for User Story 5 (TDD)

- [X] T063 [P] [US5] Write adapter contract tests for registered providers in `tests/unit/features/cloud-agents/provider-contract.test.ts`
- [X] T064 [P] [US5] Write mock-provider extensibility tests in `tests/integration/cloud-agents/provider-switching.test.ts`

### Implementation for User Story 5

- [X] T065 [P] [US5] Create reusable mock provider fixture in `tests/fixtures/mock-provider-adapter.ts`
- [X] T066 [US5] Add JSDoc examples and extension guidance to `src/features/cloud-agents/cloud-agent-provider.ts`
- [X] T067 [US5] Update the developer extension guide in `specs/016-multi-provider-agents/quickstart.md` and `specs/016-multi-provider-agents/contracts/provider-adapter.md`
- [X] T068 [US5] Validate User Story 5 in `tests/unit/features/cloud-agents/provider-contract.test.ts` and `tests/integration/cloud-agents/provider-switching.test.ts`

**Checkpoint**: Extensibility is verified with a mock provider and documented for future providers.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finalize cross-story behavior, deprecations, and validation

- [X] T069 [P] Add provider API failure recovery and retry behavior in `src/features/cloud-agents/adapters/devin-adapter.ts`, `src/features/cloud-agents/adapters/github-copilot-adapter.ts`, and `src/features/cloud-agents/agent-polling-service.ts`
- [X] T076 [P] Add credential-expiry detection during polling and dispatch: detect authentication failures (HTTP 401/403), notify user with actionable message, offer re-configure credentials without losing session history (FR-020) in `src/features/cloud-agents/agent-polling-service.ts` and `src/commands/cloud-agent-commands.ts`
- [X] T077 Add orphaned provider config detection on activation: check if stored activeProviderId exists in ProviderRegistry, if not found notify user and redirect to provider selection flow (FR-021) in `src/features/cloud-agents/migration-service.ts`
- [X] T070 [P] Ensure session completion sync and read-only retention behavior in `src/features/cloud-agents/agent-polling-service.ts`, `src/features/cloud-agents/session-cleanup-service.ts`, and `src/features/cloud-agents/agent-session-storage.ts`
- [X] T071 [P] Replace direct Devin bootstrap with cloud-agents bootstrap in `src/extension.ts`
- [X] T072 [P] Finalize Cloud Agents view and command contributions and remove deprecated Devin-only contributions in `package.json`
- [X] T073 [P] Finalize provider-agnostic panel UX in `src/panels/cloud-agent-progress-panel.ts`, `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`, and `ui/src/components/cloud-agents/error-display.tsx`
- [X] T074 Validate quickstart scenarios and developer extension guidance in `specs/016-multi-provider-agents/quickstart.md` and `specs/016-multi-provider-agents/contracts/provider-adapter.md`
- [X] T075 Resolve remaining linting and formatting issues in `src/features/cloud-agents/cloud-agent-provider.ts`, `src/providers/cloud-agent-progress-provider.ts`, `src/panels/cloud-agent-progress-panel.ts`, `src/commands/cloud-agent-commands.ts`, `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`, `ui/src/stores/cloud-agent-store.ts`, and `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Stories (Phases 3-7)**: Depend on Foundational completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational and delivers the MVP provider-selection workflow
- **US2 (P2)**: Starts after Foundational and is independently testable with seeded or mocked sessions
- **US3 (P3)**: Starts after Foundational and is independently testable with a selected provider
- **US4 (P4)**: Starts after Foundational and is independently testable with seeded running sessions
- **US5 (P5)**: Starts after Foundational and is independently testable with a mock provider fixture

### Within Each User Story

- Tests must be written and fail before implementation
- Provider-specific adapter tasks marked `[P]` can run in parallel
- Core orchestration before UI wiring where required
- Each story must be validated independently before moving on

### Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel
- Foundational tests marked `[P]` can run in parallel
- Provider adapter tasks for Devin and GitHub Copilot can run in parallel inside each story
- Webview component tasks marked `[P]` can run in parallel
- Different user stories can be split across multiple developers after Foundational completes

---

## Parallel Example: User Story 1

```bash
# Launch provider-selection tests together:
Task T020: "Write Devin adapter credential lifecycle tests"
Task T021: "Write GitHub Copilot adapter credential lifecycle tests"
Task T022: "Write provider welcome and migration tests"

# After tests fail, implement both providers in parallel:
Task T023: "Implement Devin adapter metadata and credential methods"
Task T024: "Implement GitHub Copilot adapter metadata and credential methods"
```

---

## Parallel Example: User Story 2

```bash
# Launch progress-view tests together:
Task T031: "Write provider polling and status-mapping tests"
Task T032: "Write webview store and list rendering tests"

# After tests fail, implement provider status logic in parallel:
Task T033: "Implement Devin session status mapping"
Task T034: "Implement GitHub Copilot session status mapping"
```

---

## Parallel Example: User Story 3

```bash
# Launch dispatch tests together:
Task T043: "Write Devin dispatch tests"
Task T044: "Write GitHub Copilot dispatch tests"
Task T045: "Write command-level dispatch integration tests"

# After tests fail, implement provider dispatch in parallel:
Task T046: "Implement Devin session creation mapping"
Task T047: "Implement GitHub Copilot issue assignment and session creation"
```

---

## Parallel Example: User Story 4

```bash
# Launch cancel/blocked tests together:
Task T053: "Write Devin cancel and blocked-session tests"
Task T054: "Write GitHub Copilot cancel and blocked-session tests"
Task T055: "Write cancel-command and blocked-notification integration tests"

# After tests fail, implement provider cancellation in parallel:
Task T056: "Implement Devin cancel and blocked-session handling"
Task T057: "Implement GitHub Copilot cancel and blocked-session handling"
```

---

## Parallel Example: User Story 5

```bash
# Launch extensibility tests together:
Task T063: "Write adapter contract tests for registered providers"
Task T064: "Write mock-provider extensibility tests"

# After tests fail, implement extensibility support in parallel:
Task T065: "Create reusable mock provider fixture"
Task T066: "Add JSDoc examples and extension guidance"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate provider selection, credential setup, and Devin auto-migration
5. Demo the provider-selection MVP

### Incremental Delivery

1. Finish Setup + Foundational
2. Deliver US1 (provider selection/configuration)
3. Deliver US2 (progress viewing)
4. Deliver US3 (dispatch)
5. Deliver US4 (cancel/manage)
6. Deliver US5 (extensibility)
7. Finish cross-cutting polish

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1
   - Developer B: US2
   - Developer C: US3
3. US4 and US5 can begin once enough provider/session behavior exists for validation

---

## Notes

- [P] tasks touch different files and can be worked independently
- Every user-story task includes a `[US#]` label for traceability
- Each story has explicit independent validation criteria
- TDD is mandatory for this feature per constitution
- All new source files must remain kebab-case
- All implementation files must stay TypeScript-first and strict-mode compatible
- **Constitution mandate**: Run `npm run check` after each phase checkpoint and before marking any task as complete
