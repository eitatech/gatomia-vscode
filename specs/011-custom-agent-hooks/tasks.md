# Tasks: Custom Agent Hooks Refactoring

**Input**: Design documents from `/specs/011-custom-agent-hooks/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md  
**Branch**: `011-custom-agent-hooks`

**Tests**: Tests are MANDATORY per Constitution Check III (TDD required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- VS Code Extension structure: `src/` for extension, `ui/src/` for webview
- Tests: `tests/unit/` for unit tests, `tests/integration/` for integration tests
- Paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [X] T001 Create type definitions file for agent registry at `src/features/hooks/agent-registry-types.ts`
- [X] T002 [P] Extend existing `CustomActionParams` interface in `src/features/hooks/types.ts` to add `agentId` and `agentType` fields
- [X] T003 [P] Create constants file for agent registry configuration at `src/features/hooks/agent-registry-constants.ts`
- [X] T004 [P] Create template variable constants and standard variable definitions at `src/features/hooks/template-variable-constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `AgentRegistry` service skeleton in `src/features/hooks/agent-registry.ts` with empty methods
- [X] T006 [P] Create `AgentDiscoveryService` interface in `src/features/hooks/agent-discovery-service.ts`
- [X] T007 [P] Create `TemplateVariableParser` class skeleton in `src/features/hooks/template-variable-parser.ts`
- [X] T008 [P] Create `FileWatcherService` class skeleton in `src/features/hooks/file-watcher-service.ts`
- [X] T009 Setup test infrastructure for hooks feature in `tests/unit/features/hooks/` directory
- [X] T010 [P] Configure VS Code extension to initialize agent registry on activation in `src/extension.ts`

**Checkpoint**: ✅ Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Select Custom Agent from Dropdown (Priority: P1) MVP

**Goal**: Enable users to select custom agents from a dropdown showing agents from `.github/agents/*.agent.md` files and VS Code extensions

**Independent Test**: Open hooks configuration UI, click agent name field, verify dropdown appears with grouped agents (Local Agents and Background Agents)

### Tests for User Story 1 (TDD - Write First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] Unit test for `AgentRegistry.discoverLocalAgents()` in `tests/unit/features/hooks/agent-registry.test.ts`
- [x] T012 [P] [US1] Unit test for `AgentRegistry.getAgentsGroupedByType()` in `tests/unit/features/hooks/agent-registry.test.ts`
- [x] T013 [P] [US1] Unit test for duplicate agent name resolution in `tests/unit/features/hooks/agent-registry.test.ts`
- [x] T014 [P] [US1] Unit test for `FileAgentDiscovery` class in `tests/unit/features/hooks/file-agent-discovery.test.ts`
- [x] T015 [P] [US1] Integration test for agent dropdown flow end-to-end in `tests/integration/agent-dropdown-flow.integration.test.ts`

### Implementation for User Story 1

- [x] T016 [P] [US1] Implement `FileAgentDiscovery` class in `src/features/hooks/file-agent-discovery.ts` to scan `.github/agents/` directory
- [x] T017 [P] [US1] Implement agent file parsing logic to convert `.agent.md` to `AgentRegistryEntry` in `src/features/hooks/file-agent-discovery.ts`
- [x] T018 [US1] Implement `AgentRegistry.discoverLocalAgents()` to use `FileAgentDiscovery` in `src/features/hooks/agent-registry.ts`
- [x] T019 [US1] Implement duplicate name detection and source indicator logic in `AgentRegistry` at `src/features/hooks/agent-registry.ts`
- [x] T020 [US1] Implement `AgentRegistry.getAgentsGroupedByType()` method in `src/features/hooks/agent-registry.ts`
- [x] T021 [US1] Create `AgentDropdownProvider` class in `src/features/hooks/agent-dropdown-provider.ts` to provide dropdown data (implemented in HookViewProvider)
- [x] T022 [P] [US1] Create React `AgentDropdown` component in `ui/src/components/hooks-view/agent-dropdown.tsx`
- [x] T023 [US1] Implement webview bridge message handling for agent requests in `ui/src/bridge/hooks-bridge.ts` (handled in component)
- [x] T024 [US1] Wire up agent dropdown to hooks configuration UI in `ui/src/components/hooks-view/hook-config-form.tsx`
- [x] T025 [US1] Add validation to ensure selected agent exists before saving hook in `src/features/hooks/hook-manager.ts`
- [x] T025.5 [US1] Add pre-save agent availability check to prevent saving hooks with unavailable agents in `src/features/hooks/hook-manager.ts`
- [x] T026 [US1] Add logging for agent selection operations per FR-015 in `AgentDropdownProvider`

**Checkpoint**: At this point, User Story 1 should be fully functional - users can select agents from dropdown showing local agents with source indicators

---

## Phase 4: User Story 3 - Pass Trigger Context to Agent Arguments (Priority: P1) 🎯 MVP

**Goal**: Enable users to use template variables like `{specId}` and `{timestamp}` in hook arguments to pass trigger context to agents

**Independent Test**: Create hook with arguments `"Spec: {specId}, Status: {newStatus}"`, trigger hook, verify agent receives `"Spec: 011-custom-agent-hooks, Status: review"`

**Note**: US3 is implemented before US2 because it's P1 (same priority as US1) and US2 (P2) is lower priority

### Tests for User Story 3 (TDD - Write First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T027 [P] [US3] Unit test for `TemplateVariableParser.extractVariables()` in `tests/unit/features/hooks/template-variable-parser.test.ts`
- [x] T028 [P] [US3] Unit test for `TemplateVariableParser.substitute()` with all trigger types in `tests/unit/features/hooks/template-variable-parser.test.ts`
- [x] T029 [P] [US3] Unit test for missing variable replacement (empty string) in `tests/unit/features/hooks/template-variable-parser.test.ts`
- [x] T030 [P] [US3] Unit test for `TemplateContextBuilder` class in `tests/unit/features/hooks/template-context-builder.test.ts`
- [x] T031 [P] [US3] Integration test for template substitution in hook execution in `tests/integration/template-substitution.integration.test.ts`

### Implementation for User Story 3

- [x] T032 [P] [US3] Implement `TemplateVariableParser.extractVariables()` method in `src/features/hooks/template-variable-parser.ts`
- [x] T033 [P] [US3] Implement `TemplateVariableParser.substitute()` method with regex replacement in `src/features/hooks/template-variable-parser.ts`
- [x] T034 [P] [US3] Implement `TemplateVariableParser.validateSyntax()` method in `src/features/hooks/template-variable-parser.ts`
- [x] T035 [US3] Create `TemplateContextBuilder` class in `src/features/hooks/template-context-builder.ts`
- [x] T036 [US3] Implement `TemplateContextBuilder.buildContext()` for spec triggers in `src/features/hooks/template-context-builder.ts`
- [x] T037 [P] [US3] Add standard template variables (timestamp, triggerType, user) to `template-variable-constants.ts`
- [x] T038 [P] [US3] Add spec-specific template variables (specId, specPath, oldStatus, newStatus) to `template-variable-constants.ts`
- [x] T039 [US3] Integrate template variable substitution into `HookExecutor` at `src/features/hooks/hook-executor.ts`
- [x] T040 [P] [US3] Create React `ArgumentTemplateEditor` component in `ui/src/components/hooks-view/argument-template-editor.tsx`
- [x] T041 [US3] Add template variable hints/autocomplete to argument editor in `ui/src/components/hooks-view/argument-template-editor.tsx`
- [x] T042 [US3] Update hook configuration form to use argument template editor in `ui/src/components/hooks-view/hook-config-form.tsx`
- [x] T043 [US3] Add logging for template variable substitution per FR-015 in `HookExecutor`

**Checkpoint**: At this point, User Stories 1 AND 3 should both work - users can select agents and pass trigger context via template variables

---

## Phase 5: User Story 2 - Choose Agent Type (Priority: P2)

**Goal**: Enable users to manually override agent type (Local vs Background) and ensure system detects type automatically

**Independent Test**: Configure hook with local agent, verify it's marked "Local Agent", switch to background agent, verify execution invokes external CLI

### Tests for User Story 2 (TDD - Write First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T044 [P] [US2] Unit test for automatic agent type detection in `tests/unit/features/hooks/agent-registry.test.ts`
- [x] T045 [P] [US2] Unit test for agent type override in hook configuration in `tests/unit/features/hooks/hook-manager.test.ts`
- [x] T046 [P] [US2] Unit test for background agent execution logic in `tests/unit/features/hooks/hook-executor.test.ts`
- [x] T047 [US2] Integration test for local vs background agent invocation in `tests/integration/agent-execution.integration.test.ts`

### Implementation for User Story 2

- [x] T048 [P] [US2] Implement automatic agent type detection logic in `AgentRegistry.discoverLocalAgents()` at `src/features/hooks/agent-registry.ts`
- [x] T049 [P] [US2] Create React `AgentTypeSelector` component in `ui/src/components/hooks-view/agent-type-selector.tsx`
- [x] T050 [US2] Add agent type selector to hook configuration form in `ui/src/components/hooks-view/hook-config-form.tsx`
- [x] T051 [US2] Implement agent type override handling in `HookManager.validateHook()` at `src/features/hooks/hook-manager.ts`
- [x] T052 [US2] Update `HookExecutor` to route based on agent type (local vs background) in `src/features/hooks/hook-executor.ts`
- [x] T053 [P] [US2] Implement local agent execution path in `HookExecutor` at `src/features/hooks/hook-executor.ts`
- [x] T054 [P] [US2] Implement background agent execution path (CLI invocation) in `HookExecutor` at `src/features/hooks/hook-executor.ts`
- [x] T055 [US2] Add agent type validation before hook save in `HookManager` at `src/features/hooks/hook-manager.ts`

**Checkpoint**: ✅ All P1 and P2 user stories now complete - agent selection, template variables, and agent type handling fully functional

---

## Phase 6: Real-Time Agent Refresh (Cross-Story Feature)

**Goal**: Implement real-time agent list refresh when files change or extensions are installed (FR-014, SC-006)

**Independent Test**: Add new `.agent.md` file to `.github/agents/`, verify it appears in dropdown within 5 seconds without manual refresh

### Tests for Real-Time Refresh (TDD - Write First)

- [ ] T056 [P] Unit test for `FileWatcherService.startWatching()` in `tests/unit/features/hooks/file-watcher-service.test.ts`
- [ ] T057 [P] Unit test for file change event handling in `tests/unit/features/hooks/file-watcher-service.test.ts`
- [ ] T058 [P] Unit test for debouncing logic in `tests/unit/features/hooks/file-watcher-service.test.ts`
- [ ] T059 [P] Integration test for file watcher → registry refresh flow in `tests/integration/agent-refresh.integration.test.ts`

### Implementation for Real-Time Refresh

- [ ] T060 [P] Implement `FileWatcherService.startWatching()` using VS Code `FileSystemWatcher` in `src/features/hooks/file-watcher-service.ts`
- [ ] T061 [P] Implement debouncing logic (500ms) for file change events in `src/features/hooks/file-watcher-service.ts`
- [ ] T062 [US1] Integrate file watcher with agent registry in `AgentRegistry.initialize()` at `src/features/hooks/agent-registry.ts`
- [ ] T063 [US1] Implement `AgentRegistry.onAgentsChanged` event emitter in `src/features/hooks/agent-registry.ts`
- [ ] T064 [US1] Subscribe to registry changes in webview and update dropdown in `ui/src/components/hooks-view/agent-dropdown.tsx`
- [ ] T065 [P] Create `ExtensionMonitorService` skeleton in `src/features/hooks/extension-monitor-service.ts`
- [ ] T066 [P] Implement extension install/uninstall event listeners in `ExtensionMonitorService` at `src/features/hooks/extension-monitor-service.ts`
- [ ] T067 Integrate extension monitor with agent registry in `AgentRegistry.initialize()` at `src/features/hooks/agent-registry.ts`

**Checkpoint**: Real-time refresh working - agent list updates automatically when files or extensions change

---

## Phase 7: Extension Agent Discovery (User Story 4 - Priority: P3)

**Goal**: Discover agents from VS Code extensions automatically (optional for MVP, can be deferred)

**Independent Test**: Install VS Code extension with `chatParticipants` contribution, verify agent appears in dropdown under "Background Agents"

**Note**: This phase can be skipped for MVP if time is constrained

### Tests for User Story 4 (TDD - Write First)

- [ ] T068 [P] [US4] Unit test for extension manifest scanning in `tests/unit/features/hooks/extension-agent-discovery.test.ts`
- [ ] T069 [P] [US4] Unit test for `chatParticipants` extraction in `tests/unit/features/hooks/extension-agent-discovery.test.ts`
- [ ] T070 [P] [US4] Integration test for extension-registered agents appearing in dropdown in `tests/integration/extension-agents.integration.test.ts`

### Implementation for User Story 4

- [ ] T071 [P] [US4] Create `ExtensionAgentDiscovery` class in `src/features/hooks/extension-agent-discovery.ts`
- [ ] T072 [P] [US4] Implement extension manifest scanning via `vscode.extensions.all` in `src/features/hooks/extension-agent-discovery.ts`
- [ ] T073 [P] [US4] Implement `chatParticipants` contribution point parsing in `ExtensionAgentDiscovery`
- [ ] T074 [US4] Integrate extension discovery into `AgentRegistry.discoverAll()` at `src/features/hooks/agent-registry.ts`
- [ ] T075 [US4] Add extension agent validation logic in `AgentRegistry` at `src/features/hooks/agent-registry.ts`

**Checkpoint**: Extension agents now discoverable - full agent registry functionality complete

---

## Phase 8: Agent Availability & Error Handling (Cross-Story)

**Goal**: Implement agent availability checking and error handling per FR-010, FR-015

**Independent Test**: Delete `.agent.md` file for configured hook, trigger hook, verify error notification appears with retry option

### Tests for Availability & Error Handling (TDD - Write First)

- [ ] T076 [P] Unit test for `AgentRegistry.checkAgentAvailability()` in `tests/unit/features/hooks/agent-registry.test.ts`
- [ ] T077 [P] Unit test for agent unavailability error handling in `tests/unit/features/hooks/hook-executor.test.ts`
- [ ] T078 [P] Integration test for deleted agent file error flow in `tests/integration/agent-availability.integration.test.ts`

### Implementation for Availability & Error Handling

- [ ] T079 [P] Implement `AgentRegistry.checkAgentAvailability()` method in `src/features/hooks/agent-registry.ts`
- [ ] T080 [P] Implement agent availability validation before hook save in `HookManager` at `src/features/hooks/hook-manager.ts`
- [ ] T081 Implement agent unavailability error notification with retry option in `HookExecutor` at `src/features/hooks/hook-executor.ts`
- [ ] T082 [P] Add comprehensive logging for execution events per FR-015 in `HookExecutor` at `src/features/hooks/hook-executor.ts`
- [ ] T083 [P] Add telemetry for agent discovery count and dropdown render time in `AgentRegistry` and `AgentDropdownProvider`
- [ ] T084 Add error context (agent ID, trigger type, stack trace) to all error logs in `HookExecutor`

**Checkpoint**: Error handling complete - system gracefully handles agent unavailability with user notifications

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T085 [P] Add JSDoc comments to all public APIs in `AgentRegistry`, `TemplateVariableParser`, and related classes
- [ ] T086 [P] Update `quickstart.md` with examples of agent selection and template variable usage
- [ ] T087 [P] Create example `.agent.md` files in `.github/agents/` for testing
- [ ] T088 [P] Run `npm run check` to validate linting and formatting compliance
- [ ] T089 Code review and refactoring of agent registry implementation
- [ ] T090 [P] Performance profiling of agent dropdown rendering with 50+ agents
- [ ] T091 [P] Add additional unit tests for edge cases (empty agent directory, malformed YAML, etc.)
- [ ] T092 Security review of template variable substitution (no code execution)
- [ ] T093 Validate Constitution Check compliance for all new files (kebab-case, TypeScript strict, TDD, observability)
- [ ] T094 Run quickstart.md validation - verify all user scenarios work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 3 (Phase 4)**: Depends on Foundational phase completion (can run parallel with US1)
- **User Story 2 (Phase 5)**: Depends on Foundational phase completion (P2 priority, after P1 stories)
- **Real-Time Refresh (Phase 6)**: Depends on User Story 1 completion (extends registry)
- **User Story 4 (Phase 7)**: Depends on Foundational phase completion (P3 priority, optional for MVP)
- **Availability & Error Handling (Phase 8)**: Depends on User Stories 1-3 completion
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies, but builds on US1
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Extends US1 registry discovery

### Within Each User Story

- Tests MUST be written FIRST and FAIL before implementation (TDD required by Constitution)
- Models/types before services
- Services before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002, T003, T004 can run in parallel (different files)

**Phase 2 (Foundational)**:
- T006, T007, T008, T010 can run in parallel (different files)

**Phase 3 (User Story 1)**:
- T011, T012, T013, T014, T015 (all tests) can run in parallel
- T016, T017 (discovery classes) can run in parallel
- T022, T023 (webview components) can run in parallel

**Phase 4 (User Story 3)**:
- T027, T028, T029, T030, T031 (all tests) can run in parallel
- T032, T033, T034 (parser methods) can run in parallel
- T037, T038, T040 (constants and components) can run in parallel

**Phase 5 (User Story 2)**:
- T044, T045, T046, T047 (all tests) can run in parallel
- T048, T049, T053, T054 (detection, UI, execution paths) can run in parallel

**Cross-Phase Parallel Work**:
- User Story 1 (Phase 3) and User Story 3 (Phase 4) can proceed in parallel after Foundational phase
- Different team members can work on different user stories simultaneously

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD):
Task: "Unit test for AgentRegistry.discoverLocalAgents() in tests/unit/features/hooks/agent-registry.test.ts"
Task: "Unit test for AgentRegistry.getAgentsGroupedByType() in tests/unit/features/hooks/agent-registry.test.ts"
Task: "Unit test for duplicate agent name resolution in tests/unit/features/hooks/agent-registry.test.ts"
Task: "Unit test for FileAgentDiscovery class in tests/unit/features/hooks/file-agent-discovery.test.ts"
Task: "Integration test for agent dropdown flow end-to-end in tests/integration/agent-dropdown-flow.integration.test.ts"

# Launch agent discovery classes together:
Task: "Implement FileAgentDiscovery class in src/features/hooks/file-agent-discovery.ts"
Task: "Implement agent file parsing logic to convert .agent.md to AgentRegistryEntry in src/features/hooks/file-agent-discovery.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 Only - Both P1)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T010) - CRITICAL
3. Complete Phase 3: User Story 1 - Agent Dropdown (T011-T026, includes T025.5)
4. Complete Phase 4: User Story 3 - Template Variables (T027-T043)
5. Complete Phase 8: Error Handling (T076-T084) - Essential for production
6. **STOP and VALIDATE**: Test US1 + US3 independently
7. MVP Ready: Users can select agents and pass context via templates

**MVP Scope**: ~44 tasks (T001-T043 + T076-T084, includes T025.5)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Agent selection working
3. Add User Story 3 → Test independently → Template variables working
4. Add User Story 2 → Test independently → Agent type override working
5. Add Real-Time Refresh (Phase 6) → Agent list updates automatically
6. Add User Story 4 (optional) → Extension agents discoverable
7. Add Polish (Phase 9) → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 - Agent Dropdown (T011-T026)
   - Developer B: User Story 3 - Template Variables (T027-T043)
   - Developer C: Real-Time Refresh setup (T056-T059 tests)
3. After US1 + US3 complete:
   - Developer A: User Story 2 - Agent Type (T044-T055)
   - Developer B: Real-Time Refresh implementation (T060-T067)
   - Developer C: Error Handling (T076-T084)
4. Final: All developers contribute to Polish (T085-T094)

---

## Task Summary

**Total Tasks**: 95 tasks

**By Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (User Story 1 - P1): 17 tasks (5 tests + 12 implementation)
- Phase 4 (User Story 3 - P1): 17 tasks (5 tests + 12 implementation)
- Phase 5 (User Story 2 - P2): 12 tasks (4 tests + 8 implementation)
- Phase 6 (Real-Time Refresh): 12 tasks (4 tests + 8 implementation)
- Phase 7 (User Story 4 - P3): 7 tasks (3 tests + 4 implementation)
- Phase 8 (Availability & Error Handling): 9 tasks (3 tests + 6 implementation)
- Phase 9 (Polish): 10 tasks

**By Priority**:
- P1 (MVP): 44 tasks (Phases 1-4 + Phase 8)
- P2: 12 tasks (Phase 5)
- P3: 7 tasks (Phase 7 - optional)
- Cross-cutting: 22 tasks (Phases 6 + 9)

**Parallel Opportunities**: ~35 tasks marked [P] can run in parallel

**Test Tasks**: 26 test tasks (following TDD - all written before implementation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- TDD REQUIRED: All tests must be written FIRST and FAIL before implementation
- Constitution Check: All tasks follow kebab-case naming, TypeScript strict mode, observability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `npm run check` frequently to ensure code quality
