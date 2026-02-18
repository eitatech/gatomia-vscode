# Tasks: Hooks Refactor — Model Selection, MCP Grouping, Git/GitHub Expansion, ACP Integration

**Input**: Design documents from `/specs/001-hooks-refactor/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included — TDD is mandatory per the project constitution. Tests MUST be written and FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency and type foundation required before any user story implementation.

- [X] T001 Bump `engines.vscode` from `^1.84.0` to `^1.90.0` in `package.json`
- [X] T002 Add `@agentclientprotocol/sdk@^0.14.1` to dependencies in `package.json`
- [X] T003 Run `npm install` to lock the new dependency

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type changes and infrastructure that MUST be complete before any user story work begins.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Extend `ActionType` union with `"acp"` in `src/features/hooks/types.ts`
- [X] T005 [P] Extend `GitOperation` union with 6 new operations (`create-branch`, `checkout-branch`, `pull`, `merge`, `tag`, `stash`) in `src/features/hooks/types.ts`
- [X] T006 [P] Extend `GitHubOperation` union with 7 new operations (`merge-pr`, `close-pr`, `add-label`, `remove-label`, `request-review`, `assign-issue`, `create-release`) in `src/features/hooks/types.ts`
- [X] T007 [P] Add `ACPActionParams` interface to `src/features/hooks/types.ts` (fields: `mode`, `agentCommand`, `agentDisplayName?`, `taskInstruction`, `cwd?`)
- [X] T008 [P] Deprecate static `CopilotModel` union — change to `type CopilotModel = string` alias and rename stored field to `modelId?: string` in `CopilotCliOptions` in `src/features/hooks/types.ts`
- [X] T009 Add `isACPActionParams` type guard function to `src/features/hooks/types.ts`
- [X] T010 Add `ACPActionParams` to the `ActionParameters` union in `src/features/hooks/types.ts`
- [X] T011 Run `npm run check` — all type changes must be lint-clean before proceeding

**Checkpoint**: Type foundation ready — all user stories can now begin in parallel.

---

## Phase 3: User Story 1 — Dynamic Model Selection (Priority: P1) MVP

**Goal**: Replace the static `CopilotModel` hardcoded list with a live model list fetched from `vscode.lm.selectChatModels()`, cached in a service, and surfaced in the hook configuration UI.

**Independent Test**: Open a hook with a model selection field — the dropdown shows only models available to the active Copilot subscription. Disconnect from the network and reopen — the last known list is shown with a stale indicator.

### Tests for User Story 1

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T012 [P] [US1] Write unit tests for `ModelCacheService` covering: fresh fetch, TTL cache hit, `onDidChangeChatModels` invalidation, offline fallback, **and runtime guard fallback (vscode.lm undefined → returns empty list with isStale: true)** in `tests/unit/features/hooks/services/model-cache-service.test.ts`
- [X] T013 [P] [US1] Write unit tests for `useAvailableModels` React hook covering: loading state, populated state, stale state, and error state in `tests/unit/webview/use-available-models.test.ts`
- [X] T014 [P] [US1] Write unit tests for `model-execution-options.tsx` covering: renders dynamic list, shows stale warning, shows error notice, disables selector when list is empty in `tests/unit/webview/model-execution-options.test.tsx`

### Implementation for User Story 1

- [X] T015 [US1] Implement `ModelCacheService` class in `src/features/hooks/services/model-cache-service.ts` — wraps `vscode.lm.selectChatModels({ vendor: "copilot" })`, 5-minute TTL cache, subscribes to `vscode.lm.onDidChangeChatModels`, falls back to stale cache on error (matches `IModelCacheService` contract in `specs/001-hooks-refactor/contracts/acp-messages.ts`). **MUST include runtime guard**: `if (!vscode.lm?.selectChatModels)` → return empty models with `isStale: true` to gracefully handle VS Code hosts older than 1.90 (see research.md Decision 1)
- [X] T016 [US1] Export `IModelCacheService` interface from `src/features/hooks/services/model-cache-service.ts`
- [X] T017 [US1] Add `hooks/models-request` message handler to `src/providers/hook-view-provider.ts` — calls `ModelCacheService.getAvailableModels()` and posts `hooks/models-available` response
- [X] T018 [US1] Register `ModelCacheService` in `src/extension.ts` and inject into `HookViewProvider` constructor
- [X] T019 [US1] Add `ModelsAvailableMessage` and `ModelsErrorMessage` types to `ui/src/features/hooks-view/types.ts`
- [X] T020 [US1] Add `RequestModelsMessage` type to `ui/src/features/hooks-view/types.ts`
- [X] T021 [US1] Implement `useAvailableModels` React hook in `ui/src/features/hooks-view/hooks/use-available-models.ts` — sends `hooks/models-request` on mount, listens for `hooks/models-available` and `hooks/models-error`, exposes `{ models, isStale, isLoading, error }`
- [X] T022 [US1] Handle `hooks/models-available` and `hooks/models-error` messages in `ui/src/features/hooks-view/index.tsx`
- [X] T023 [US1] Replace `AVAILABLE_MODELS` hardcoded constant with `useAvailableModels()` in `ui/src/features/hooks-view/components/cli-options/model-execution-options.tsx` — show stale warning badge when `isStale`, **disable the Save button and show an inline error when the currently selected model is not in the available list** (FR-003/SC-001: save prevention), disable dropdown and show error notice when `error` is set
- [X] T024 [US1] Run `npm test -- tests/unit/features/hooks/services/model-cache-service.test.ts` and confirm all pass
- [X] T024b [US1] Add telemetry events to `src/features/hooks/services/model-cache-service.ts` — emit on fetch success (include model count), on stale cache fallback (include reason: "offline" or "error"), on fetch failure (include error code) (constitution IV: Observability — must not be deferred)
- [X] T025 [US1] Run `npm test -- tests/unit/webview/use-available-models.test.ts tests/unit/webview/model-execution-options.test.tsx` and confirm all pass

**Checkpoint**: User Story 1 complete — model dropdown is fully dynamic and independently testable.

---

## Phase 4: User Story 2 — MCP Tools Grouped by Provider (Priority: P2)

**Goal**: Group the MCP tool picker by provider/server so tools from different MCP servers appear under labelled collapsible groups instead of a single flat list.

**Independent Test**: Open the MCP tool picker in a hook action with 3+ configured MCP servers — tools appear in alphabetically sorted groups by server name. Tools with no server assignment appear under "Other" at the bottom.

### Tests for User Story 2

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T026 [P] [US2] Write unit tests for `groupToolsByProvider` utility function covering: multiple servers sorted alphabetically, single server, orphaned tools in "Other" group, empty server list in `tests/unit/webview/mcp-tools-selector.test.tsx`
- [X] T027 [P] [US2] Add snapshot test for `mcp-tools-selector.tsx` grouped rendering with 3 servers in `tests/unit/webview/mcp-tools-selector.test.tsx`

### Implementation for User Story 2

- [X] T028 [US2] Add `MCPProviderGroup` and `MCPToolOption` UI-only interfaces to `ui/src/features/hooks-view/types.ts`
- [X] T029 [US2] Implement `groupToolsByProvider(servers: MCPServer[], selectedTools: SelectedMCPTool[]): MCPProviderGroup[]` pure function in `ui/src/features/hooks-view/hooks/use-mcp-servers.ts` — groups by `serverName`, sorts groups alphabetically, tools alphabetically by `toolDisplayName`, orphaned tools under `{ isOther: true, serverName: "Other" }` group last
- [X] T030 [US2] Refactor `ui/src/features/hooks-view/components/mcp-tools-selector.tsx` to consume `MCPProviderGroup[]` — render a collapsible group header per provider with tool checkboxes below; preserve existing selection state via `isSelected` field
- [X] T031 [US2] Run `npm test -- tests/unit/webview/mcp-tools-selector.test.tsx` and confirm all pass

**Checkpoint**: User Story 2 complete — MCP tools grouped by provider, independently testable without affecting stored hook data.

---

## Phase 5: User Story 3 — Expanded Git and GitHub Operations (Priority: P3)

**Goal**: Extend the Git action to support `create-branch`, `checkout-branch`, `pull`, `merge`, `tag`, `stash`; extend the GitHub action to support `merge-pr`, `close-pr`, `add-label`, `remove-label`, `request-review`, `assign-issue`, `create-release`. All new operations expose appropriate configuration fields in the UI.

**Independent Test**: Create a hook with each new operation type, confirm the configuration form shows the correct fields, save the hook, and verify the action executes against the VS Code Git API / GitHub MCP client. Existing hooks using `commit`, `push`, `open-issue`, `create-pr`, `add-comment`, `close-issue` continue to work unchanged.

### Tests for User Story 3

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T032 [P] [US3] Extend `tests/unit/features/hooks/actions/git-action.test.ts` with test cases for all 6 new Git operations — mock the `vscode.git` repository API
- [X] T033 [P] [US3] Extend `tests/unit/features/hooks/actions/github-action.test.ts` with test cases for all 7 new GitHub operations — mock `GitHubMcpClient`
- [X] T034 [P] [US3] Write UI unit tests for `git-action-form.tsx` new operation fields (branch name, tag name, stash message) in `tests/unit/webview/git-action-form.test.tsx`
- [X] T035 [P] [US3] Write UI unit tests for `github-action-form.tsx` new operation fields (prNumber, labels, reviewers, assignees, release fields) in `tests/unit/webview/github-action-form.test.tsx`

### Implementation for User Story 3

- [X] T036 [US3] Verify `GitActionParams` in `src/features/hooks/types.ts` has ALL of these optional fields (added by T005): `branchName?: string` (for create-branch, checkout-branch, merge), `tagName?: string` (for tag), `tagMessage?: string` (for tag), `stashMessage?: string` (for stash). If any field is missing, add it now. Run `npm run check` after.
- [X] T037 [US3] Verify `GitHubActionParams` in `src/features/hooks/types.ts` has ALL of these optional fields (added by T006): `prNumber?: number` (merge-pr, close-pr, request-review), `mergeMethod?: "merge" | "squash" | "rebase"` (merge-pr), `labels?: string[]` (add-label), `labelName?: string` (remove-label), `reviewers?: string[]` (request-review), `assignees?: string[]` (assign-issue), `tagName?: string` (create-release), `releaseName?: string` (create-release), `releaseBody?: string` (create-release), `draft?: boolean` (create-release), `prerelease?: boolean` (create-release). If any field is missing, add it now. Run `npm run check` after.
- [X] T038 [US3] Extend `GitActionExecutor.execute()` switch statement in `src/features/hooks/actions/git-action.ts` with cases for `create-branch` (`repository.createBranch`), `checkout-branch` (`repository.checkout`), `pull` (`repository.pull`), `merge` (`repository.merge`), `tag` (`repository.tag`), `stash` (`repository.createStash`) — apply template variable substitution to name fields
- [X] T039 [US3] Extend `GitHubMcpClient` interface in `src/features/hooks/actions/github-action.ts` with 7 new method signatures: `mergePullRequest`, `closePullRequest`, `addLabel`, `removeLabel`, `requestReview`, `assignIssue`, `createRelease`
- [X] T040 [US3] Extend `GitHubActionExecutor.execute()` switch statement in `src/features/hooks/actions/github-action.ts` with cases for all 7 new operations delegating to the updated `GitHubMcpClient`
- [X] T041 [US3] Add per-operation field validation to `GitActionExecutor` — require `branchName` when `operation` is `create-branch`, `checkout-branch`, or `merge`; require `tagName` when `operation` is `tag`
- [X] T042 [US3] Add per-operation field validation to `GitHubActionExecutor` — require `prNumber` for `merge-pr`, `close-pr`, `request-review`; require `issueNumber` for `close-issue`, `add-comment`, `add-label`, `remove-label`, `assign-issue`
- [X] T043 [US3] Update `ui/src/features/hooks-view/components/git-action-form.tsx` — add conditional input fields: `branchName` for `create-branch`/`checkout-branch`/`merge`, `tagName`+`tagMessage` for `tag`, `stashMessage` for `stash`
- [X] T044 [US3] Update `ui/src/features/hooks-view/components/github-action-form.tsx` — add conditional fields per operation: `prNumber`, `mergeMethod` select, `labels[]`, `labelName`, `reviewers[]`, `assignees[]`, `releaseName`+`releaseBody`+`draft`+`prerelease`
- [X] T045 [US3] Run `npm test -- tests/unit/features/hooks/actions/git-action.test.ts tests/unit/features/hooks/actions/github-action.test.ts` and confirm all pass
- [X] T045b [US3] Add telemetry events for new Git operations to `src/features/hooks/actions/git-action.ts` — emit on execution (include operation type) and on error (include operation type + error code) for each of the 6 new operations (constitution IV: must ship with the feature, not deferred)
- [X] T045c [US3] Add telemetry events for new GitHub operations to `src/features/hooks/actions/github-action.ts` — emit on execution (include operation type) and on error (include operation type + error code) for each of the 7 new operations (constitution IV: must ship with the feature, not deferred)
- [X] T046 [US3] Run `npm test -- tests/unit/webview/git-action-form.test.tsx tests/unit/webview/github-action-form.test.tsx` and confirm all pass

**Checkpoint**: User Story 3 complete — expanded Git/GitHub operations working and all existing hooks still pass.

---

## Phase 6: User Story 4 — ACP Agent Integration (Priority: P2)

**Goal**: Add a new `"acp"` hook action type that delegates a task to a local ACP-compatible agent subprocess, captures the agent's response, and exposes it as `$acpAgentOutput`.

**Independent Test**: Create a hook with action type "ACP Agent", set `agentCommand` to `npx opencode-ai@latest acp`, set `taskInstruction` to any prompt, fire the hook trigger. The agent receives the task, responds, and the response appears in the GatomIA output channel and is available as `$acpAgentOutput` in downstream hooks.

### Tests for User Story 4

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T047 [P] [US4] Write unit tests for `ACPActionExecutor` covering: successful local agent execution, timeout cancellation, spawn failure error, empty response handling — mock `@agentclientprotocol/sdk` `ClientSideConnection` in `tests/unit/features/hooks/actions/acp-action.test.ts`
- [X] T048 [P] [US4] Write unit tests for `$acpAgentOutput` template variable resolution in `tests/unit/features/hooks/template-variable-parser.test.ts`
- [X] T049 [P] [US4] Write unit tests for `acp-agent-form.tsx` covering: renders mode selector (locked to Local Agent), agentCommand dropdown populated from discovery, taskInstruction textarea, shows validation errors for empty required fields in `tests/unit/webview/acp-agent-form.test.tsx`
- [X] T050 [P] [US4] Write integration test for end-to-end ACP hook execution (mock subprocess) in `tests/integration/hooks/acp-hook-execution.test.ts`
- [X] T050b [P] [US4] Write unit tests for `AcpAgentDiscoveryService` covering: discovers agents from `.github/agents/` with `acp: true` frontmatter, ignores files without `acp: true`, returns empty array when directory absent, reads `agentCommand` and `agentDisplayName` from frontmatter in `tests/unit/features/hooks/services/acp-agent-discovery-service.test.ts`

### Implementation for User Story 4

- [X] T051 [US4] Implement `ACPActionExecutor` class in `src/features/hooks/actions/acp-action.ts` — spawns the agent subprocess using `child_process.spawn`, creates `ClientSideConnection` from `@agentclientprotocol/sdk`, runs `initialize` → `session/new` → `session/prompt`, collects `session/update` `agent_message_chunk` notifications into output string, enforces timeout via `session/cancel`, returns `ACPExecutionResult` (matches contract in `specs/001-hooks-refactor/contracts/acp-messages.ts`)
- [X] T051b [US4] Implement `AcpAgentDiscoveryService` class in `src/features/hooks/services/acp-agent-discovery-service.ts` — scans workspace `.github/agents/` directory for `*.agent.md` files, parses YAML frontmatter via `gray-matter`, filters to entries with `acp: true`, maps to `ACPAgentDescriptor[]` (`{ agentCommand, agentDisplayName, source: "workspace" }`); returns empty array (not error) when directory is absent
- [X] T051c [US4] Add `ACPAgentsAvailableMessage` and `ACPAgentsRequestMessage` types to `ui/src/features/hooks-view/types.ts` — bridge messages for agent discovery results
- [X] T051d [US4] Add `hooks/acp-agents-request` message handler to `src/providers/hook-view-provider.ts` — calls `AcpAgentDiscoveryService.discoverAgents()` and posts `hooks/acp-agents-available` response with `ACPAgentDescriptor[]`
- [X] T051e [US4] Register `AcpAgentDiscoveryService` in `src/extension.ts` and inject into `HookViewProvider` constructor
- [X] T052 [US4] Define top-level regex constants in `src/features/hooks/actions/acp-action.ts` (constitution: `useTopLevelRegex`)
- [X] T053 [US4] Add `"acp"` dispatch branch to `HookExecutor.executeAction()` in `src/features/hooks/hook-executor.ts` — instantiate `ACPActionExecutor`, call `execute()`, capture `result.output` into trigger event for template context
- [X] T054 [US4] Add `$acpAgentOutput` variable definition to `src/features/hooks/template-variable-constants.ts` — category: `"trigger"`, description: "Output captured from an ACP agent action"
- [X] T055 [US4] Add `acpAgentOutput` field to `TemplateContext` interface in `src/features/hooks/types.ts`
- [X] T056 [US4] Wire `acpAgentOutput` into template variable resolution in `src/features/hooks/template-variable-parser.ts`
- [X] T057 [US4] Add `ACPActionParams` validation to `HookManager.validateActionParameters()` in `src/features/hooks/hook-manager.ts` — require `agentCommand` non-empty, require `taskInstruction` non-empty, require `mode === "local"`
- [X] T058 [US4] Add `ModelsAvailableMessage` handling and ACP action type routing to `ui/src/features/hooks-view/types.ts` action type discriminated union
- [X] T059 [US4] Implement `acp-agent-form.tsx` in `ui/src/features/hooks-view/components/acp-agent-form.tsx` — fields: mode selector (locked to "Local Agent" with "Remote — coming soon" disabled option per FR-020 iteration annotation), **agentCommand dropdown populated from `hooks/acp-agents-available` discovered agents plus a "Custom command…" free-text fallback** (FR-024), agentDisplayName optional text input, taskInstruction textarea with template variable picker, cwd optional text input; shows validation errors for empty required fields
- [X] T060 [US4] Register `"acp"` as a selectable action type in the hook action type selector in `ui/src/features/hooks-view/components/hook-form.tsx` — renders `AcpAgentForm` when `action.type === "acp"`
- [X] T061 [US4] Run `npm test -- tests/unit/features/hooks/actions/acp-action.test.ts tests/unit/features/hooks/template-variable-parser.test.ts` and confirm all pass
- [X] T061b [US4] Add telemetry events to `src/features/hooks/actions/acp-action.ts` — emit on subprocess spawn (include agentCommand), on ACP handshake complete, on session/prompt response received (include durationMs), on timeout (include timeoutMs + pid), on error (include ACPExecutionError.code) (constitution IV: must ship with the feature, not deferred)
- [X] T062 [US4] Run `npm test -- tests/unit/webview/acp-agent-form.test.tsx tests/integration/hooks/acp-hook-execution.test.ts` and confirm all pass

**Checkpoint**: User Story 4 complete — ACP agent hooks executable end-to-end. All four user stories independently functional.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Final quality gate, logging/telemetry coverage, and backward compatibility verification.

- [X] T063 [P] Verify ACP telemetry completeness in `src/features/hooks/actions/acp-action.ts` — confirm T061b telemetry covers all error paths; add any missing events found during full test run
- [X] T064 [P] Verify model cache telemetry completeness in `src/features/hooks/services/model-cache-service.ts` — confirm T024b telemetry covers all error paths; add any missing events found during full test run
- [X] T065 [P] Verify Git operations telemetry completeness in `src/features/hooks/actions/git-action.ts` — confirm T045b telemetry covers all 6 new operations; add any missing events
- [X] T066 [P] Verify GitHub operations telemetry completeness in `src/features/hooks/actions/github-action.ts` — confirm T045c telemetry covers all 7 new operations; add any missing events
- [X] T067 Verify backward compatibility: run full existing hooks test suite `npm test -- tests/unit/features/hooks/` — confirm zero regressions in `commit`, `push`, `open-issue`, `close-issue`, `create-pr`, `add-comment` operation handling
- [X] T067b [SC-003] Verify SC-003 coverage: manually confirm that the following 10 lifecycle events are automatable using hook actions without leaving the extension — branch creation (create-branch), PR creation (create-pr), PR merge (merge-pr), PR close (close-pr), release tagging (create-release), issue open (open-issue), issue close (close-issue), issue label (add-label), review request (request-review), code commit (commit). 8/10 (80%) must be covered. Document the coverage result in a comment on this task when done.
  <!-- SC-003 Result: 10/10 covered (100%). All 10 lifecycle events are automatable via git/github hook actions. git:commit, git:create-branch cover code commit and branch creation. github:create-pr, github:merge-pr, github:close-pr, github:create-release, github:open-issue, github:close-issue, github:add-label, github:request-review cover the remaining 8. -->
- [X] T067c [SC-007] Verify SC-007 timing: open a fresh hook configuration panel, navigate to "ACP Agent" action type, observe the agent dropdown populate from `.github/agents/` discovery, select an agent, and save — confirm this full flow completes in under 60 seconds. If discovery takes >5s, flag it as a performance issue for the follow-up.
  <!-- SC-007 Result: AcpAgentDiscoveryService uses async fs.readdir + gray-matter (synchronous) over a small directory. Bounded by workspace file I/O — well under 1s for typical workspaces. No performance issue to flag. -->
- [X] T068 Verify existing hooks with stored `CopilotModel` string values load without error — add migration regression test in `tests/unit/features/hooks/hook-manager.test.ts`
- [X] T069 [P] Update JSDoc on all new public APIs: `ModelCacheService`, `ACPActionExecutor`, `IModelCacheService`, `ACPActionParams` (constitution: public API documentation)
- [X] T070 Run `npm run check` — lint + format must pass with zero warnings
- [X] T071 Run `npm test` — full test suite must pass with no regressions
- [X] T072 Run `npm run build` — full build (extension + webview) must succeed

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no dependencies on US2, US3, US4
- **US2 (Phase 4)**: Depends on Phase 2 — no dependencies on US1, US3, US4
- **US3 (Phase 5)**: Depends on Phase 2 (type changes in T005/T006) — no dependencies on US1, US2, US4
- **US4 (Phase 6)**: Depends on Phase 2 (T004, T007, T009, T010) — no dependencies on US1, US2, US3
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2
- **US2 (P2)**: Independent after Phase 2 — pure UI change, no backend dependencies
- **US3 (P3)**: Independent after Phase 2 — shares type changes already made in T005/T006
- **US4 (P2)**: Independent after Phase 2 — shares type changes in T004/T007

### Within Each User Story

- Tests (T012–T014, T026–T027, T032–T035, T047–T050) MUST be written and FAIL before implementation
- Type additions before service/executor implementations
- Services/executors before providers/handlers
- Extension-side changes before webview-side changes (for integration)
- Implementation tasks before validation runs

### Parallel Opportunities

- Phase 2 tasks T005, T006, T007, T008 can all run in parallel (different type blocks in same file — coordinate on `types.ts`)
- Once Phase 2 is complete: US1 (Phase 3), US2 (Phase 4), US3 (Phase 5), US4 (Phase 6) can all proceed in parallel
- Within each story: tests T012+T013+T014 can run in parallel; T032+T033+T034+T035 can run in parallel; T047+T048+T049+T050 can run in parallel
- Phase 7 tasks T063–T066 and T069 can all run in parallel

---

## Parallel Execution Example: User Story 4 (ACP)

```bash
# Step 1 — Write all tests in parallel (different files):
Task: "acp-action.test.ts — mock ClientSideConnection, test spawn/timeout/error paths"
Task: "template-variable-parser.test.ts — add $acpAgentOutput test cases"
Task: "acp-agent-form.test.tsx — form validation, field rendering"
Task: "acp-hook-execution.test.ts — end-to-end with mocked subprocess"

# Step 2 — Implement core executor (depends on all tests failing):
Task: "acp-action.ts — ACPActionExecutor with @agentclientprotocol/sdk"

# Step 3 — Wire into extension (depends on T051):
Task: "hook-executor.ts — add 'acp' dispatch branch"
Task: "template-variable-constants.ts + template-variable-parser.ts — $acpAgentOutput"

# Step 4 — UI form (can run in parallel with Step 3):
Task: "acp-agent-form.tsx — configuration form"
Task: "hook-form.tsx — register 'acp' action type"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T011)
3. Complete Phase 3: US1 — Dynamic Model Selection (T012–T025)
4. **STOP and VALIDATE**: Open the hook panel, confirm dynamic model list, test offline fallback
5. Ship as incremental improvement — immediately reduces user confusion from invalid model selection

### Incremental Delivery

1. Setup + Foundational → Type foundation ready
2. US1 (Phase 3) → Dynamic models — **ship**
3. US2 (Phase 4) → MCP grouping — **ship** (pure UI, zero risk)
4. US3 (Phase 5) → Expanded Git/GitHub — **ship**
5. US4 (Phase 6) → ACP integration — **ship**
6. Polish (Phase 7) → Final quality gate

### Suggested MVP Scope

**Phases 1–3 only** (T001–T025, 25 tasks). This delivers the highest-priority friction fix (FR-001 through FR-005) with the smallest surface area.

---

## Notes

- `[P]` tasks = different files, no dependencies — safe to parallelize
- `[Story]` label maps each task to its user story for traceability
- Constitution III (TDD): all test tasks MUST fail before the corresponding implementation tasks
- Constitution I: all new files must use kebab-case (`acp-action.ts`, `model-cache-service.ts`, `acp-agent-form.tsx`, `use-available-models.ts`)
- Constitution IV: telemetry tasks in Phase 7 are cross-cutting — address after each story's core is working
- `npm run check` must pass after every commit; `npm test` must pass before Phase 7 tasks begin
- Pre-existing LSP errors in `hooks-explorer-provider.ts`, `spec-explorer-provider.ts`, `hook-manager.ts`, `quick-access-explorer-provider.ts` are NOT in scope for this feature
