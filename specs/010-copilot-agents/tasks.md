# Implementation Tasks: Copilot Agents Integration

**Feature**: 010-copilot-agents  
**Branch**: `010-copilot-agents`  
**Generated**: 2026-01-24  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides actionable, dependency-ordered tasks for implementing the Copilot Agents Integration feature. This feature is **NOT about creating new agents** - the agents and tools already exist. This is about **mapping and implementing the integration** of existing GitHub Copilot agents and their tools within the VS Code extension.

Tasks are organized by user story to enable independent implementation and testing. Each task follows the strict checklist format with Task IDs, parallelization markers, and story labels.

**MVP Scope**: User Stories 1-4 (P1 priority - core functionality)

**Tests**: Included per constitution (TDD mandatory)

---

## Phase 1: Setup & Infrastructure

**Goal**: Establish project structure, dependencies, and foundational types.

**Tasks**:

- [X] T001 Create feature directory structure at src/features/agents/ with subdirectories for types, tests
- [X] T002 [P] Install gray-matter dependency for YAML frontmatter parsing in package.json
- [X] T003 [P] Create TypeScript types file at src/features/agents/types.ts with all interfaces from contracts
- [X] T004 [P] Create test directory structure at tests/unit/features/agents/ and tests/integration/agents/
- [X] T005 Create resources/ directory structure: resources/agents/, resources/prompts/, resources/skills/, resources/instructions/
- [X] T006 Configure extension activation to initialize agent feature in src/extension.ts

**Completion Criteria**: All foundational files created, dependencies installed, project compiles without errors.

---

## Phase 2: User Story 1 - Discover Registered Agents (P1)

**Goal**: Users can see all registered agents in GitHub Copilot Chat participants list.

**Independent Test**: Install extension, open Copilot Chat, verify agents appear with descriptions.

### Tests

- [X] T007 [P] [US1] Write unit test for AgentLoader.loadAgents() in tests/unit/features/agents/agent-loader.test.ts
- [X] T008 [P] [US1] Write unit test for AgentLoader.parseAgentFile() with valid YAML frontmatter
- [X] T009 [P] [US1] Write unit test for AgentLoader validation (malformed YAML, missing fields)
- [X] T010 [US1] Write integration test for agent discovery in tests/integration/agents/agent-registration.test.ts
- [X] T011 [US1] Write integration test for chat participant registration with VS Code API

### Implementation

- [X] T012 [US1] Implement AgentLoader class in src/features/agents/agent-loader.ts with loadAgents() method
- [X] T013 [US1] Implement AgentLoader.parseAgentFile() to parse markdown with YAML frontmatter using gray-matter
- [X] T014 [US1] Implement AgentLoader.validateDefinition() to check required fields (id, name, description, commands)
- [X] T015 [US1] Implement ChatParticipantRegistry class in src/features/agents/chat-participant-registry.ts
- [X] T016 [US1] Implement ChatParticipantRegistry.registerAgent() using vscode.chat.createChatParticipant
- [X] T017 [US1] Implement AgentService coordinator in src/services/agent-service.ts
- [X] T018 [US1] Wire up AgentService.initialize() in extension activation (src/extension.ts)
- [X] T019 [US1] Add error handling for GitHub Copilot Chat unavailable scenario
- [X] T020 [US1] Add telemetry for agent discovery and registration events

**Acceptance**: All T007-T011 tests pass, agents appear in Copilot Chat dropdown with correct metadata.

---

## Phase 3: User Story 3 - Access Agent Resources (P1)

**Goal**: Agents automatically load prompts, skills, and instructions from resources/ directory.

**Independent Test**: Invoke agent command requiring resources, verify correct resources are accessed.

**Note**: Implemented before US2 because US2 depends on resource loading.

### Tests

- [X] T021 [P] [US3] Write unit test for ResourceCache.load() in tests/unit/features/agents/resource-cache.test.ts
- [X] T022 [P] [US3] Write unit test for ResourceCache.get() with prompts, skills, instructions
- [X] T023 [P] [US3] Write unit test for ResourceCache.reload() for hot-reload functionality
- [X] T024 [US3] Write unit test for FileWatcher detecting resource file changes
- [X] T025 [US3] Write integration test for resource loading on extension activation

### Implementation

- [X] T026 [P] [US3] Implement ResourceCache class in src/features/agents/resource-cache.ts
- [X] T027 [P] [US3] Implement ResourceCache.load() to scan and cache all resource files (prompts, skills, instructions)
- [X] T028 [P] [US3] Implement ResourceCache.get() for fast resource lookups by type and name
- [X] T029 [US3] Implement ResourceCache.reload() for incremental updates on file changes
- [X] T030 [US3] Implement FileWatcher class in src/features/agents/file-watcher.ts
- [X] T031 [US3] Implement FileWatcher with vscode.workspace.createFileSystemWatcher for resources/**
- [X] T032 [US3] Wire up FileWatcher to ResourceCache.reload() with debouncing (500ms)
- [X] T033 [US3] Add ResourceCache initialization to AgentService.initialize()
- [X] T034 [US3] Add telemetry for resource loading and reload events

**Acceptance**: All T021-T025 tests pass, resources cached in memory <5s, hot-reload works.

---

## Phase 4: User Story 2 - Execute Agent Commands (P1)

**Goal**: Users can invoke agent commands and see tool execution results.

**Independent Test**: Type agent command in chat, verify tool executes and returns formatted results.

### Tests

- [X] T035 [P] [US2] Write unit test for ToolRegistry.register() in tests/unit/features/agents/tool-registry.test.ts
- [X] T036 [P] [US2] Write unit test for ToolRegistry.execute() with valid tool handler
- [X] T037 [P] [US2] Write unit test for ToolRegistry.execute() with missing tool (error case)
- [X] T038 [US2] Write unit test for chat command parsing (agent, command, input)
- [X] T039 [US2] Write integration test for full tool execution flow in tests/integration/agents/tool-execution.test.ts
- [X] T040 [US2] Write integration test for tool response rendering in chat

### Implementation

- [X] T041 [P] [US2] Implement ToolRegistry class in src/features/agents/tool-registry.ts
- [X] T042 [P] [US2] Implement ToolRegistry.register() to map tool name to handler function
- [X] T043 [P] [US2] Implement ToolRegistry.execute() to invoke tool with params and return response
- [X] T044 [US2] Implement command parsing in ChatParticipantRegistry request handler
- [X] T045 [US2] Implement ToolExecutionContext builder to assemble context for tool handlers
- [X] T046 [US2] Implement AgentResources loader to fetch cached resources for specific agent
- [X] T047 [US2] Implement tool response renderer to display markdown + file links in chat
- [X] T048 [US2] Wire up chat participant handler to ToolRegistry.execute()
- [X] T049 [US2] Add progress reporting for long-running tool executions using stream.progress()
- [X] T050 [US2] Add telemetry for tool executions (duration, success/failure)
- [X] T051 [US2] Implement cancellation token support for tool executions

**Acceptance**: All T035-T040 tests pass, users can execute commands and see formatted results.

---

## Phase 5: User Story 4 - Handle Tool Execution Errors (P1)

**Goal**: Users receive clear, actionable error messages when tool executions fail.

**Independent Test**: Trigger various failure scenarios, verify error messages are helpful.

### Tests

- [X] T052 [P] [US4] Write unit test for error handling with invalid input in tool handler
- [X] T053 [P] [US4] Write unit test for error handling with missing resource file
- [X] T054 [P] [US4] Write unit test for error handling with tool execution timeout
- [X] T055 [P] [US4] Write unit test for error handling when tool not registered
- [X] T056 [US4] Write integration test for full error flow (error → log → display)

### Implementation

- [X] T057 [P] [US4] Implement custom error classes (AgentError, ToolExecutionError, ResourceError) in src/features/agents/types.ts
- [X] T058 [P] [US4] Implement error formatter to convert errors to user-friendly messages
- [X] T059 [US4] Add try-catch blocks in ToolRegistry.execute() with error classification
- [X] T060 [US4] Add error logging to extension output channel with full context
- [X] T061 [US4] Implement error response rendering in chat with actionable guidance
- [X] T062 [US4] Add telemetry for error events with error type and context
- [X] T063 [US4] Add validation for tool handler parameters before execution

**Acceptance**: All T052-T056 tests pass, error messages are clear and actionable in all scenarios.

---

## Phase 6: User Story 5 - View Agent Documentation (P2)

**Goal**: Users can access agent documentation through /help command.

**Independent Test**: Type @agent /help, verify documentation displays correctly.

### Tests

- [X] T064 [P] [US5] Write unit test for help command handler returning agent command list
- [X] T065 [P] [US5] Write unit test for help command with specific command parameter
- [X] T066 [US5] Write integration test for /help command end-to-end

### Implementation

- [X] T067 [P] [US5] Implement built-in /help tool handler for all agents
- [X] T068 [P] [US5] Register /help command in all agent definitions automatically
- [X] T069 [US5] Implement help content formatter using agent definition markdown body
- [X] T070 [US5] Add command usage examples to help output
- [X] T071 [US5] Add telemetry for help command usage

**Acceptance**: All T064-T066 tests pass, help command displays comprehensive documentation.

---

## Phase 7: User Story 6 - Configure Agent Behavior (P3)

**Goal**: Users can customize agent behavior through extension settings.

**Independent Test**: Change settings, verify agents use new configuration.

### Tests

- [X] T072 [P] [US6] Write unit test for configuration loading from workspace settings
- [X] T073 [P] [US6] Write unit test for custom resources path override
- [X] T074 [US6] Write integration test for settings changes triggering reload

### Implementation

- [X] T075 [P] [US6] Add configuration schema to package.json (contributes.configuration)
- [X] T076 [P] [US6] Implement ConfigurationService in src/services/agent-service.ts
- [X] T077 [US6] Implement settings: gatomia.agents.resourcesPath (default: "resources")
- [X] T078 [US6] Implement settings: gatomia.agents.enableHotReload (default: true)
- [X] T079 [US6] Implement settings: gatomia.agents.logLevel (default: "info")
- [X] T080 [US6] Wire up configuration change listener to reload agents
- [X] T081 [US6] Add telemetry for configuration changes

**Acceptance**: All T072-T074 tests pass, settings changes apply without restart.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Production-ready quality with documentation, examples, and final testing.

**Tasks**:

- [X] T082 [P] Create example agent definition at resources/agents/example.agent.md
- [X] T083 [P] Create example tool handler implementation with inline documentation
- [X] T084 [P] Add comprehensive JSDoc comments to all public APIs
- [X] T085 [P] Create README.md for features/agents/ directory with architecture overview
- [X] T086 Run full test suite and ensure >80% code coverage
- [X] T087 Perform manual end-to-end testing with real agents
- [X] T088 Run npm run check (lint + format) and fix all issues
- [X] T089 [P] Update CHANGELOG.md with feature description
- [X] T090 [P] Update extension README.md with agent usage instructions
- [X] T091 Performance testing: verify agent registration <5s, autocomplete <200ms
- [X] T092 Accessibility testing: verify screen reader support for agent responses
- [X] T093 Create demo video showing agent discovery and execution
- [X] T094 Write migration guide for existing prompt/skill files

**Completion Criteria**: All tests pass, coverage >80%, documentation complete, ready for release. ✅ COMPLETE

---

## Dependency Graph

```
Setup (T001-T006)
  └─> US1: Discover Agents (T007-T020)
        ├─> US3: Access Resources (T021-T034) [blocking for US2]
        │     └─> US2: Execute Commands (T035-T051)
        │           └─> US4: Handle Errors (T052-T063)
        │                 ├─> US5: Documentation (T064-T071)
        │                 └─> US6: Configuration (T072-T081)
        │                       └─> Polish (T082-T094)
```

**Critical Path**: T001 → T006 → T007-T020 → T021-T034 → T035-T051 → T052-T063

**Parallelization Opportunities**: Within each phase, tasks marked [P] can be executed in parallel.

---

## Parallel Execution Examples

### Phase 1 Setup (can run in parallel)
- T002 (install dependency), T003 (types), T004 (test dirs), T005 (resources dir)

### Phase 2 User Story 1 Tests (can run in parallel after T003-T006)
- T007, T008, T009 (unit tests)
- T010, T011 (integration tests) - run after unit tests pass

### Phase 3 User Story 3 Implementation (can run in parallel after tests pass)
- T026 (ResourceCache), T027-T028 (cache methods) can start together
- T030-T031 (FileWatcher) can run parallel to ResourceCache

### Phase 4 User Story 2 Implementation (can run in parallel after US3 complete)
- T041-T043 (ToolRegistry) separate from T044-T046 (command parsing)

---

## Implementation Strategy

### MVP Scope (Target: Phases 1-5)
Focus on P1 user stories (US1-US4) for initial release:
1. **Phase 1**: Setup and infrastructure
2. **Phase 2**: Agent discovery and registration
3. **Phase 3**: Resource loading infrastructure
4. **Phase 4**: Command execution
5. **Phase 5**: Error handling

**Estimated**: ~63 tasks for MVP functionality

### Post-MVP (Phases 6-8)
Add P2-P3 features and polish:
- Phase 6: Documentation/help (P2)
- Phase 7: Configuration (P3)
- Phase 8: Polish and production readiness

---

## Test-First Development Workflow

For each user story:
1. ✅ **Write tests first** (T###-T### in "Tests" section)
2. ✅ **Run tests** (they should fail - RED)
3. ✅ **Implement code** (T###-T### in "Implementation" section)
4. ✅ **Run tests** (they should pass - GREEN)
5. ✅ **Refactor** if needed while keeping tests green
6. ✅ **Run `npm run check`** before moving to next story

---

## Success Metrics

| User Story | Metric | Target | Verification |
|------------|--------|--------|--------------|
| US1 | Agent discovery time | <10s | SC-001, SC-003 |
| US2 | Command execution time | <30s | SC-002 |
| US2 | Autocomplete latency | <200ms | SC-008 |
| US3 | Resource loading time | <5s | SC-007 |
| US3 | Resource reload time | <5s | SC-010 |
| US4 | Error message clarity | 100% actionable | SC-006 |
| US5 | Help access | <3 interactions | SC-004 |
| All | Test coverage | >80% | npm run test:coverage |

---

## Notes

- **File Naming**: All files MUST use kebab-case per constitution
- **TypeScript**: Strict mode enabled, no `any` types
- **Testing**: TDD mandatory - tests before implementation
- **Telemetry**: Log all significant operations
- **Error Handling**: No silent failures, all errors logged

---

## Quick Commands

```bash
# Run all tests
npm test

# Run specific story tests
npm test -- tests/unit/features/agents/
npm test -- -t "User Story 1"

# Run with coverage
npm run test:coverage

# Lint and format (MANDATORY before commit)
npm run check

# Build
npm run build

# Launch extension
Press F5 in VS Code
```

---

## References

- **Spec**: [spec.md](./spec.md)
- **Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Contracts**: [contracts/](./contracts/)
- **Quickstart**: [quickstart.md](./quickstart.md)
- **Constitution**: [../../.specify/memory/constitution.md](../../.specify/memory/constitution.md)

---

## Total Task Count

- **Phase 1 (Setup)**: 6 tasks
- **Phase 2 (US1 - P1)**: 14 tasks (5 tests + 9 implementation)
- **Phase 3 (US3 - P1)**: 14 tasks (5 tests + 9 implementation)
- **Phase 4 (US2 - P1)**: 17 tasks (6 tests + 11 implementation)
- **Phase 5 (US4 - P1)**: 12 tasks (5 tests + 7 implementation)
- **Phase 6 (US5 - P2)**: 8 tasks (3 tests + 5 implementation)
- **Phase 7 (US6 - P3)**: 10 tasks (3 tests + 7 implementation)
- **Phase 8 (Polish)**: 13 tasks

**Total**: 94 tasks

**MVP Scope (Phases 1-5)**: 63 tasks  
**Parallel Opportunities**: ~40 tasks can run in parallel (marked with [P])
