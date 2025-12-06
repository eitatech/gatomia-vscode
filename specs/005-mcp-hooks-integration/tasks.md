---
description: "Implementation tasks for MCP Hooks Integration"
---

# Tasks: MCP Server Integration for Hooks

**Input**: Design documents from `/specs/005-mcp-hooks-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: NOT requested in spec - test tasks omitted per template guidelines

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [X] T001 Extend ActionType union to include "mcp" in src/features/hooks/types.ts
- [X] T002 [P] Add MCPActionParams interface with serverId, toolName, parameterMappings, timeout in src/features/hooks/types.ts
- [X] T003 [P] Add ParameterMapping interface with toolParam, source, value in src/features/hooks/types.ts
- [X] T004 [P] Add ServerStatus type ("available" | "unavailable" | "unknown") in src/features/hooks/types.ts
- [X] T005 [P] Add MCPServer interface with id, name, description, status, tools, lastDiscovered in src/features/hooks/types.ts
- [X] T006 [P] Add MCPTool interface with name, displayName, description, inputSchema, serverId in src/features/hooks/types.ts
- [X] T007 [P] Add JSONSchema and JSONSchemaProperty interfaces in src/features/hooks/types.ts
- [X] T008 [P] Add type guard isValidMCPParams in src/features/hooks/types.ts
- [X] T009 [P] Add type guard isValidParameterMapping in src/features/hooks/types.ts
- [X] T010 [P] Add type guard isValidMCPServer in src/features/hooks/types.ts
- [X] T011 [P] Add type guard isValidMCPTool in src/features/hooks/types.ts
- [X] T012 [P] Add MCP constants (cache TTL, timeouts, concurrency limits) in src/features/hooks/types.ts
- [X] T013 Update ActionParameters union to include MCPActionParams in src/features/hooks/types.ts

**Checkpoint**: Type system ready - all MCP entities and guards defined

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T014 Create MCP service interfaces file at src/features/hooks/services/mcp-contracts.ts (copy from contracts/mcp-service.ts)
- [X] T015 [P] Create MCP discovery service with cache at src/features/hooks/services/mcp-discovery.ts implementing IMCPDiscoveryService
- [X] T016 [P] Create MCP client service at src/features/hooks/services/mcp-client.ts implementing IMCPClientService
- [X] T017 [P] Create MCP parameter resolver at src/features/hooks/services/mcp-parameter-resolver.ts implementing IMCPParameterResolver
- [X] T018 [P] Create MCP execution pool with semaphore at src/features/hooks/services/mcp-execution-pool.ts implementing IMCPExecutionPool
- [X] T019 [P] Create Copilot MCP utility functions at src/utils/copilot-mcp-utils.ts for MCP server discovery via VS Code API
- [X] T020 Create unit test for mcp-discovery service at tests/unit/features/hooks/services/mcp-discovery.test.ts
- [X] T021 [P] Create unit test for mcp-client service at tests/unit/features/hooks/services/mcp-client.test.ts
- [X] T022 [P] Create unit test for mcp-parameter-resolver at tests/unit/features/hooks/services/mcp-parameter-resolver.test.ts
- [X] T023 [P] Create unit test for mcp-execution-pool at tests/unit/features/hooks/services/mcp-execution-pool.test.ts
- [X] T024 Implement discoverServers method in mcp-discovery.ts with 5-minute cache TTL
- [X] T025 [P] Implement getServer method in mcp-discovery.ts
- [X] T026 [P] Implement getTool method in mcp-discovery.ts
- [X] T027 [P] Implement clearCache and isCacheFresh methods in mcp-discovery.ts
- [X] T028 Implement executeTool method in mcp-client.ts with timeout handling
- [X] T029 [P] Implement validateParameters method in mcp-client.ts using JSON Schema validation
- [X] T030 Implement resolve method in mcp-parameter-resolver.ts for batch parameter mapping
- [X] T031 [P] Implement resolveSingle method in mcp-parameter-resolver.ts for context/literal/template sources
- [X] T032 Implement execute method in mcp-execution-pool.ts with concurrency limit of 5
- [X] T033 [P] Implement getStatus and drain methods in mcp-execution-pool.ts
- [X] T034 Implement queryMCPServers function in copilot-mcp-utils.ts using VS Code Extension API
- [X] T035 [P] Implement queryMCPTools function in copilot-mcp-utils.ts
- [X] T036 Run all foundational unit tests and ensure passing (npm run test)

**Checkpoint**: Foundation ready - all services implemented and tested, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse and Select MCP Server Actions (Priority: P1) 🎯 MVP

**Goal**: Enable users to discover configured MCP servers in Copilot and select their actions for hook configuration

**Independent Test**: Open hook configuration UI → View list of MCP servers → Expand server to see tools → Select an action → Save configuration

### Implementation for User Story 1

- [X] T037 [P] [US1] Create MCPActionPicker React component skeleton at webview-ui/src/features/hooks-view/components/mcp-action-picker.tsx
- [X] T038 [P] [US1] Create useMCPServers custom hook at webview-ui/src/features/hooks-view/hooks/use-mcp-servers.ts
- [X] T039 [US1] Implement server discovery call in useMCPServers hook using VS Code webview message API
- [X] T040 [US1] Add state management for servers, loading, error states in useMCPServers hook
- [X] T041 [US1] Implement tree view structure in MCPActionPicker with servers as parent nodes
- [X] T042 [US1] Add expandable tool children under each server node in MCPActionPicker
- [X] T043 [US1] Add search input to filter servers and tools by name in MCPActionPicker
- [X] T044 [US1] Implement server/tool selection handler in MCPActionPicker emitting selection event
- [X] T045 [US1] Add visual indicator for server status (available/unavailable/unknown) in MCPActionPicker
- [X] T046 [US1] Style MCPActionPicker using shadcn/ui components (Tree, Input, Badge)
- [X] T047 [US1] Integrate MCPActionPicker into hook configuration form in webview-ui/src/features/hooks-view/
- [X] T048 [US1] Add message handler in hook-view-provider.ts to respond to MCP server discovery requests
- [X] T049 [US1] Connect message handler to mcp-discovery service in hook-view-provider.ts
- [X] T050 [US1] Implement hook save logic to persist MCP action configuration in hook-manager.ts
- [X] T051 [US1] Validate MCP action params on save using isValidMCPParams type guard
- [X] T052 [US1] Update hook serialization to include MCP action parameters
- [X] T053 [US1] Update hook deserialization to restore MCP action configuration
- [X] T054 [US1] Add error handling for unavailable servers in UI (display warning message)
- [X] T055 [US1] Add loading state during server discovery in MCPActionPicker
- [X] T056 [US1] Test complete user flow: open UI → select MCP action → save → verify persistence

**Checkpoint**: At this point, User Story 1 should be fully functional - users can browse MCP servers, select actions, and save configurations

---

## Phase 4: User Story 2 - Execute MCP Actions from Hooks (Priority: P2)

**Goal**: Enable configured hooks to automatically execute assigned MCP actions when triggered

**Independent Test**: Create hook with MCP action → Trigger hook event → Verify MCP action executes → Confirm success feedback

### Implementation for User Story 2

- [X] T057 [P] [US2] Create MCP action executor at src/features/hooks/actions/mcp-action.ts implementing action executor interface
- [X] T058 [US2] Implement execute method in mcp-action.ts accepting MCPActionParams and ExecutionContext
- [X] T059 [US2] Add server availability check in execute method using mcp-discovery service
- [X] T060 [US2] Implement parameter resolution in execute method using mcp-parameter-resolver service
- [X] T061 [US2] Add parameter validation in execute method using mcp-client service validateParameters
- [X] T062 [US2] Implement tool execution call in execute method using mcp-client service executeTool
- [X] T063 [US2] Apply execution pool for concurrency control in execute method using mcp-execution-pool
- [X] T064 [US2] Handle timeout using configured or default 30s timeout
- [X] T065 [US2] Return execution result with success/error status and output
- [X] T066 [US2] Extend hook-executor.ts to recognize "mcp" action type
- [X] T067 [US2] Add branch in hook-executor.ts to delegate MCP actions to mcp-action executor
- [X] T068 [US2] Create unit test for mcp-action executor at tests/unit/features/hooks/actions/mcp-action.test.ts
- [X] T069 [US2] Test successful execution path in mcp-action.test.ts
- [X] T070 [US2] Test parameter resolution and mapping in mcp-action.test.ts
- [X] T071 [US2] Test parameter validation failure handling in mcp-action.test.ts
- [X] T072 [US2] Test timeout handling in mcp-action.test.ts
- [X] T073 [US2] Test concurrency pool limiting in mcp-action.test.ts
- [X] T074 [US2] Add execution logging for MCP actions (start, success, failure, timeout)
- [X] T075 [US2] Implement execution feedback to user via VS Code notifications
- [X] T076 [US2] Display execution success message with duration
- [X] T077 [US2] Display execution error message with details on failure
- [X] T078 [US2] Create integration test at tests/integration/mcp-hooks-integration.test.ts for end-to-end flow
- [X] T079 [US2] Test hook trigger → parameter mapping → MCP execution → success result in integration test
- [X] T080 [US2] Test multiple hooks with different MCP actions executing independently

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - hooks can execute MCP actions with proper feedback

---

## Phase 5: User Story 3 - Handle MCP Server Availability (Priority: P3)

**Goal**: Gracefully handle scenarios where MCP servers become unavailable or fail to respond

**Independent Test**: Disable MCP server → Trigger hook using that server → Verify error handling → Confirm no crash and user feedback

### Implementation for User Story 3

- [X] T081 [P] [US3] Add server availability validation in mcp-action.ts before execution
- [X] T082 [US3] Implement graceful degradation when server unavailable (log error, skip execution, don't crash)
- [X] T083 [US3] Add visual indicator for unavailable servers in MCPActionPicker (gray out or badge)
- [X] T084 [US3] Display error notification when hook references unavailable server
- [X] T085 [US3] Add hook validation check in hook-manager.ts to detect invalid MCP server references
- [X] T086 [US3] Mark hooks as invalid when referenced MCP server not found
- [X] T087 [US3] Prevent execution of invalid hooks (check before execution in hook-executor.ts)
- [X] T088 [US3] Add "update hook" action in error notification allowing user to reconfigure
- [X] T089 [US3] Add "remove hook" action in error notification allowing user to delete invalid hook
- [X] T090 [US3] Implement detailed error logging for MCP failures (server unavailable, tool not found, validation errors, timeouts)
- [X] T091 [US3] Add error details to ExecutionContext for debugging
- [X] T092 [US3] Implement automatic retry logic for transient server failures (1 retry with 2s delay)
- [X] T093 [US3] Handle large MCP output payloads (truncate if >1MB, log warning)
- [X] T094 [US3] Handle MCP server configuration changes (detect via cache invalidation, prompt refresh)
- [X] T095 [US3] Create unit tests for error handling scenarios at tests/unit/features/hooks/actions/mcp-action.test.ts
- [X] T096 [US3] Test server unavailable error handling
- [X] T097 [US3] Test tool not found error handling
- [X] T098 [US3] Test parameter validation error handling with detailed messages
- [X] T099 [US3] Create integration test for unavailable server scenario
- [X] T100 [US3] Test hook remains stable when MCP server fails

**Checkpoint**: All user stories should now be independently functional with robust error handling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T101 [P] Add JSDoc comments to all MCP service interfaces
- [X] T102 [P] Add JSDoc comments to all MCP type definitions in types.ts
- [X] T103 [P] Add inline code comments for complex parameter mapping logic
- [X] T104 Update extension README.md with MCP hooks integration documentation
- [X] T105 [P] Add troubleshooting section to quickstart.md based on testing findings
- [X] T106 Code cleanup: Remove console.log statements, ensure consistent error handling
- [X] T107 [P] Code cleanup: Apply Biome formatting (npm run format)
- [X] T108 Refactor: Extract common error handling into utility functions
- [X] T109 [P] Refactor: Simplify parameter resolver logic if needed
- [X] T110 Performance: Verify cache TTL is optimal (5 minutes)
- [X] T111 [P] Performance: Add lazy loading for tool details in UI
- [X] T112 Run complete test suite (npm run test) and ensure 100% pass rate
- [X] T113 [P] Run test coverage (npm run test:coverage) and target >80% coverage
- [X] T114 Security: Validate all user inputs in parameter mapping
- [X] T115 [P] Security: Sanitize MCP output before display
- [X] T116 Run Biome linter (npm run check) and fix all issues
- [X] T117 Validate quickstart.md examples work end-to-end
- [X] T118 Test with real MCP servers (GitHub, if available in dev environment)
- [X] T119 [P] Update CHANGELOG.md with feature description
- [X] T120 Create pull request with comprehensive description and screenshots

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1, US2, US3 can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for action configuration UI integration
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US2 for execution paths to add error handling

### Within Each Phase

**Phase 1 (Setup)**:
- All type definition tasks T001-T013 can run in parallel (marked [P])
- T001 must complete before T013 (ActionType before ActionParameters)

**Phase 2 (Foundational)**:
- Service contract file (T014) must complete first
- Service implementations (T015-T019) can run in parallel after T014
- Test file creation (T020-T023) can run in parallel
- Service method implementations (T024-T035) depend on their service file creation
- Test execution (T036) must be last

**Phase 3 (US1)**:
- UI component and hook creation (T037-T038) can run in parallel
- UI implementation (T039-T046) depends on T037-T038
- Integration tasks (T047-T053) depend on UI completion
- Testing tasks (T054-T056) must be last

**Phase 4 (US2)**:
- Executor creation (T057) must complete first
- Executor implementation (T058-T065) sequential (each builds on previous)
- Hook-executor integration (T066-T067) depends on T065
- Test file creation (T068) can happen any time after T057
- Test cases (T069-T077) can run in parallel after executor complete
- Integration tests (T078-T080) must be last

**Phase 5 (US3)**:
- Error handling additions (T081-T089) sequential (each builds on executor)
- Logging and retry (T090-T094) can run in parallel after error handling
- Tests (T095-T100) must be last

**Phase 6 (Polish)**:
- Documentation tasks (T101-T105) can run in parallel
- Cleanup tasks (T106-T109) sequential
- Performance tasks (T110-T111) can run in parallel
- Testing tasks (T112-T113) after cleanup
- Security and validation (T114-T120) final steps

### Parallel Opportunities

- **Setup**: All 13 tasks can run in parallel (except T001 before T013)
- **Foundational**: 5 service files + 4 test files = 9 parallel tasks initially
- **User Story 1**: Component files (T037-T038) can be 2 parallel tasks
- **User Story 2**: Test cases (T069-T077) can be up to 9 parallel tasks
- **User Story 3**: Test cases (T095-T097) can be 3 parallel tasks
- **Polish**: Documentation (5 tasks), cleanup (2 tasks), performance (2 tasks) can all run in parallel within their groups

---

## Parallel Example: Foundational Phase

```bash
# Create all service files in parallel:
Task T015: "Create mcp-discovery.ts implementing IMCPDiscoveryService"
Task T016: "Create mcp-client.ts implementing IMCPClientService"
Task T017: "Create mcp-parameter-resolver.ts implementing IMCPParameterResolver"
Task T018: "Create mcp-execution-pool.ts implementing IMCPExecutionPool"
Task T019: "Create copilot-mcp-utils.ts for MCP server discovery"

# Create all test files in parallel:
Task T020: "Create mcp-discovery.test.ts"
Task T021: "Create mcp-client.test.ts"
Task T022: "Create mcp-parameter-resolver.test.ts"
Task T023: "Create mcp-execution-pool.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (13 type tasks)
2. Complete Phase 2: Foundational (23 service tasks - CRITICAL)
3. Complete Phase 3: User Story 1 (20 tasks)
4. **STOP and VALIDATE**: Open UI → Browse servers → Select action → Save → Verify persistence
5. Deploy/demo if ready (MVP = browse and configure MCP actions)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (36 tasks)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP = 56 tasks total)
3. Add User Story 2 → Test independently → Deploy/Demo (execution works = 80 tasks total)
4. Add User Story 3 → Test independently → Deploy/Demo (robust = 100 tasks total)
5. Add Polish → Final release (120 tasks total)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (36 tasks, ~2-3 days)
2. **Once Foundational is done, split work**:
   - Developer A: User Story 1 (UI focus - 20 tasks, ~1-2 days)
   - Developer B: User Story 2 (Executor focus - 24 tasks, ~1-2 days)
   - Developer C: User Story 3 (Error handling - 20 tasks, ~1 day)
3. **Reconvene for Polish** (20 tasks, ~1 day)

**Total Timeline**: 5-7 days with 3 developers vs 9-11 days solo

---

## Notes

- **[P]** tasks = different files, no dependencies → maximize parallelism
- **[Story]** label maps task to specific user story for traceability
- **Tests NOT included** per spec (no explicit test requirement) - focus on implementation
- Each user story should be independently completable and testable
- Verify services work before building UI (test T036 checkpoint critical)
- Commit after each logical group of tasks (not every single task)
- Stop at any checkpoint to validate story independently
- **Constitution compliance**: All tasks follow existing patterns (github-action.ts model)
- **Biome enforcement**: T107 and T116 ensure code quality

---

## Total Task Count

- **Phase 1 (Setup)**: 13 tasks
- **Phase 2 (Foundational)**: 23 tasks (BLOCKING)
- **Phase 3 (User Story 1)**: 20 tasks
- **Phase 4 (User Story 2)**: 24 tasks
- **Phase 5 (User Story 3)**: 20 tasks
- **Phase 6 (Polish)**: 20 tasks

**TOTAL**: 120 tasks

**Parallel Opportunities Identified**:
- Setup: 12 of 13 tasks can run in parallel
- Foundational: 9 of 23 tasks can run in parallel initially
- User Story 1: 2 tasks can run in parallel initially
- User Story 2: 9 test tasks can run in parallel
- User Story 3: 3 test tasks can run in parallel
- Polish: 14 of 20 tasks can run in parallel

**Independent Test Criteria**:
- **US1**: Open UI → Select MCP action → Save → Verify persistence
- **US2**: Trigger hook → Verify MCP execution → Confirm success feedback
- **US3**: Disable server → Trigger hook → Verify error handling → No crash

**Suggested MVP Scope**: User Story 1 only (56 tasks = Setup + Foundational + US1)
- Delivers core value: browse and configure MCP actions
- Fully testable and demonstrable
- Execution (US2) and error handling (US3) can be added incrementally
