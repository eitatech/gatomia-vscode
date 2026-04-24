# Tasks: Interactive Agent Chat Panel

**Feature**: `018-agent-chat-panel`
**Branch**: `018-agent-chat-panel`
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [contracts/](./contracts/)
**TDD**: Mandatory per Constitution Principle III. Every test task MUST be authored and **fail (red)** before its corresponding implementation task begins.
**MVP**: Phase 3 (User Story 1).
**Legend**: `[P]` = parallelizable (different files, no incomplete-dependency), `[USn]` = maps to user story `n` in [spec.md](./spec.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, new module scaffolding, new dependency, and .gitignore seeding. No tests; no behavior change.

- [X] T001 Create feature module directories: `src/features/agent-chat/`, `ui/src/features/agent-chat/`, `ui/src/features/agent-chat/components/`, `ui/src/features/agent-chat/hooks/`, `tests/unit/features/agent-chat/`, `tests/unit/panels/`, `tests/unit/providers/` *(already existed)*, `tests/unit/webview/agent-chat/`, `tests/integration/agent-chat/`
- [X] T002 [P] Add `@tanstack/react-virtual` (MIT) dependency to `ui/package.json` and run `npm --prefix ui install` so webview components can import it *(resolved to v3.13.24, MIT, verified importable)*
- [X] T003 [P] Add `.gatomia/worktrees/` to the workspace's `.gitignore` template/instructions (document in `quickstart.md` that this is seeded on first worktree creation at runtime; no repo-level commit needed yet) *(added to repo root `.gitignore` lines 45-49; verified with `git check-ignore`)*
- [X] T004 [P] Register `"agent-chat"` as a `SupportedPage` in `ui/src/page-registry.tsx` (the project uses a **single-entry Vite build** with runtime page dispatch via the `data-page` attribute on `#root` — there is no `webview-entries/` directory). Add a `lazy(() => import("./features/agent-chat"))` renderer, then create a stub `ui/src/features/agent-chat/index.tsx` exporting `AgentChatFeature` so `getWebviewContent(webview, extensionUri, "agent-chat")` resolves. T035 replaces the stub body in Phase 3 with the real composition. *(Completed: stub in place, build green, `npm run check` passes)*

**Checkpoint**: Directories exist, new dep is installed, webview entry is reachable. No behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, telemetry, persistence, the ACP client/session-manager extensions, and the cloud-agents event hook. Everything below is required by more than one user story.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete and its tests are green.

### Shared types and telemetry

- [X] T005 [P] Create `src/features/agent-chat/types.ts` with `AgentChatSession`, `ChatMessage` (all five variants including `UserChatMessage.deliveryStatus` and `rejectionReason`), `ResolvedCapabilities`, `ModeDescriptor`, `ModelDescriptor`, `ExecutionTarget`, `WorktreeHandle`, `CloudLinkage`, `SessionTrigger`, `AgentChatEvent`, `SessionLifecycleState`, and `TERMINAL_STATES` per [data-model.md](./data-model.md) §1–§2. **Also** declare the forward-compatible `AgentChatRunnerHandle { readonly sessionId: string; cancel(): Promise<void>; dispose(): void }` interface so `AgentChatRegistry` (T011) can type-check in Phase 2 before `AcpChatRunner` (T027) and `CloudChatAdapter` (T060) exist
- [X] T006 [P] Create `ui/src/features/agent-chat/types.ts` mirroring the webview-relevant subset of `src/features/agent-chat/types.ts` plus `AgentChatSessionView`, `ExecutionTargetView`, `ExecutionTargetOption` per [contracts/agent-chat-panel-protocol.md](./contracts/agent-chat-panel-protocol.md) §3.1
- [X] T007 [P] Create `src/features/agent-chat/telemetry.ts` following the `logTelemetry(event: string, properties: Record<string, string | number | boolean>)` pattern used in `src/features/hooks/actions/acp-action.ts:163-170` and `src/features/devin/telemetry.ts:53-59`. Export constants for every event listed in `plan.md` Constitution row IV

### Session store (persistence) — TDD

- [X] T008 [P] Write failing tests `tests/unit/features/agent-chat/agent-chat-session-store.test.ts` covering every case in [contracts/agent-chat-session-storage.md](./contracts/agent-chat-session-storage.md) §9 (create/append/read, archival by count, archival by size, retention eviction + orphan migration, restart restore for ACP / Cloud / missing worktree, **deactivation happy path**, **deactivation update rejection**, **idempotent activation**, concurrency, settings defaults) *(15 tests authored; red before T009a/T009b)*
- [X] T009a Implement the **manifest + transcript CRUD** slice of `src/features/agent-chat/agent-chat-session-store.ts`: `createSession`, `appendMessages`, `getSession`, `listActive`/`listRecent`, `onDidChangeManifest` emitter, and the schema-versioned JSON layout from [contracts/agent-chat-session-storage.md](./contracts/agent-chat-session-storage.md) §2. Must satisfy the create/append/read and concurrency cases from T008
- [X] T009b Implement the **archival / retention / deactivation / restart** slice of the same file: transcript archival by count and size, retention eviction + orphan migration into `gatomia.agentChat.worktreesOrphaned`, `flushForDeactivation(): Promise<void>` with the single-atomic-update contract, and idempotent activation restore per [contracts/agent-chat-session-storage.md](./contracts/agent-chat-session-storage.md) §5–§6. T008 must be fully green after this task *(15/15 green)*

### Registry — TDD

- [X] T010 [P] Write failing tests `tests/unit/features/agent-chat/agent-chat-registry.test.ts` covering: one panel per session (FR-008 invariant), active vs. recent partitioning, shutdown hook transitions non-terminal ACP sessions and persists the manifest exactly once, lookup by session id *(10 tests authored; red before T011)*
- [X] T011 Implement `src/features/agent-chat/agent-chat-registry.ts` until T010 passes. The registry owns `Map<sessionId, WebviewPanel>` and `Map<sessionId, AgentChatRunnerHandle>` (the forward-compatible interface declared in T005; concrete `AcpChatRunner` and `CloudChatAdapter` classes implement it in later phases). Exposes `openPanelFor(sessionId)` / `focusPanel(sessionId)` / `registerSession(session)` / `removeSession(sessionId)` / `attachRunner(sessionId, handle)` *(10/10 green; also exposes `attachPanel`, `getPanel`, `getRunner`, `updateSession`, `shutdown(flushSink)`, `onDidChange`, `dispose`)*

### AcpClient event bus + per-(providerId, cwd) keying — TDD

- [X] T012 [P] Write failing tests extending `src/services/acp/acp-client.test.ts` for: (a) `subscribeSession(sessionId, listener)` fans out every `sessionUpdate` to the listener AND still writes the same content to the existing `OutputChannel` (FR-022 regression); (b) subscriptions are cleanable via the returned `Disposable`; (c) `AcpSessionEvent` payloads match the shape defined in [research.md](./research.md) §R2 *(5 new tests appended; red before T013)*
- [X] T013 Modify `src/services/acp/acp-client.ts` to add a `SessionEventBus` (private `Map<sessionId, Set<listener>>`), a public `subscribeSession(sessionId, listener): Disposable`, and fanout in the existing `sessionUpdate` handler. Do NOT change or remove any existing `OutputChannel.append*` calls. T012 must pass *(24/24 acp-client tests green; FR-022 regression test confirms OutputChannel writes preserved)*
- [X] T014 [P] Write failing tests extending `src/services/acp/acp-session-manager.test.ts` for: (a) `ensureClient(providerId, cwd)` returns distinct `AcpClient` instances for two different `cwd` values with the same `providerId`; (b) same `(providerId, cwd)` pair returns the cached instance; (c) `dispose()` still tears down every cached client; (d) a new `subscribe(sessionKey)` method maps a session key to its client's event stream *(5 new tests appended; red before T015)*
- [X] T015 Modify `src/services/acp/acp-session-manager.ts` to key its `clients` map by the composite `` `${providerId}::${cwd}` `` and to accept `cwd` in `send`, `cancel`, and `ensureClient`. Preserve existing call sites by defaulting `cwd` to the manager's constructor `cwd`. Add `subscribe(sessionKey): vscode.Disposable` that forwards to the right client's `subscribeSession`. T014 must pass *(19/19 acp-session-manager tests green; backward-compatible default behaviour preserved)*

### Cloud-agents (spec 016) event-stream extension — TDD

- [X] T016 [P] Write failing test `tests/unit/features/cloud-agents/agent-polling-service.test.ts` (extend existing file if present) asserting that `AgentPollingService` fires a new `onSessionUpdated(localId)` event exactly once per polling cycle that produces a changed `AgentSession`, and that multiple subscribers receive the event *(4 new tests appended; red before T017)*
- [X] T017 Modify `src/features/cloud-agents/agent-polling-service.ts` to add a `vscode.EventEmitter<{ localId: string; session: AgentSession }>` and expose it as `onSessionUpdated`. Fire from every branch that currently mutates stored session state. Also add an optional `chatPanelId?: string` to `AgentSession` in `src/features/cloud-agents/types.ts`. T016 must pass *(18/18 agent-polling-service tests green; `AgentSession.chatPanelId` added)*

**Checkpoint**: Types exist, persistence is green, ACP client/session-manager support per-session subscription AND per-`(providerId, cwd)` isolation, and spec 016's polling service exposes an update event. User story phases may now begin in parallel.

---

## Phase 3: User Story 1 — Watch and Interact with a Running Agent in a Chat Panel (Priority: P1) 🎯 MVP

**Goal**: When any ACP agent run begins, the user sees a chat-style panel streaming the agent's turn-by-turn output and can send follow-up messages while the run is active. The panel replaces the log window as the primary surface (the log `OutputChannel` remains for diagnostics per FR-022).

**Independent Test** (from [spec.md](./spec.md) US1): trigger any ACP agent session; confirm the chat panel auto-opens, agent output streams in chat form, a follow-up message is deliverable, and the end-of-turn state (`completed`, `failed`, etc.) is visible in the panel header.

### Tests for User Story 1 (TDD, must fail first) ⚠️

- [x] T018 [P] [US1] Contract tests `tests/unit/panels/agent-chat-panel.test.ts` covering every extension→webview and webview→extension message from [contracts/agent-chat-panel-protocol.md](./contracts/agent-chat-panel-protocol.md) §7 that is relevant to US1: `agent-chat/ready` hydration, `agent-chat/input/submit` → pending→delivered happy path, input-submit while mid-turn → pending→queued→delivered, second queued submission → rejected, messages/appended chunk coalescing, error routing
- [x] T019 [P] [US1] Tests `tests/unit/features/agent-chat/acp-chat-runner.test.ts` covering: session lifecycle transitions (`initializing → running → waiting-for-input → completed` and error paths to `failed`), stream events map to `AgentChatEvent` correctly, `submit(userMessage)` forwards to `AcpClient.sendPrompt` with the correct `cwd`, follow-up queueing when a turn is in flight, retry creates a new session id, cancel routes to `AcpClient.cancel`
- [x] T020 [P] [US1] Webview tests `tests/unit/webview/agent-chat/chat-transcript.test.tsx` for virtualized rendering, pin-to-bottom only when scrolled near bottom, no message loss during chunk bursts (simulate 200 messages/s)
- [x] T021 [P] [US1] Webview tests `tests/unit/webview/agent-chat/chat-message-item.test.tsx` covering user / agent / system / tool / error variants and `deliveryStatus` badge rendering
- [x] T022 [P] [US1] Webview tests `tests/unit/webview/agent-chat/input-bar.test.tsx` covering: enabled when `acceptsFollowUp && !terminal`, disabled with explanation when agent has `acceptsFollowUp: false`, disabled with explanation on read-only sessions, submit emits `agent-chat/input/submit`
- [x] T023 [P] [US1] Webview tests `tests/unit/webview/agent-chat/status-header.test.tsx` covering every lifecycle-state badge including `ended-by-shutdown`
- [x] T024 [P] [US1] Webview tests `tests/unit/webview/agent-chat/use-session-bridge.test.ts` covering the `agent-chat/ready` bootstrap, message dispatch, and update-patch merge semantics
- [x] T025 [P] [US1] Integration test `tests/integration/agent-chat/acp-streaming-and-followup.test.ts`: launch a fake ACP agent (mocked `AcpClient`) that emits chunks + a tool call + a turn-finished, verify the full end-to-end flow (panel opens, events render, follow-up dispatched with `deliveryStatus` transitions, OutputChannel also receives output)
- [x] T025a [P] [US1] Webview tests `tests/unit/webview/agent-chat/tool-call-item.test.tsx` covering: pending / running / succeeded / failed / cancelled status badge rendering, title truncation, updates-in-place when the same `toolCallId` receives a `tool/call-updated` event
- [x] T025b [P] [US1] Webview tests `tests/unit/webview/agent-chat/retry-action.test.tsx` covering: "Retry" button emits `agent-chat/control/retry` (ACP session), "Open in provider" button opens the external URL (Cloud session with `externalUrl`), "Dispatch again" button emits `agent-chat/control/redispatch` (Cloud session), visibility is gated on `ErrorChatMessage.retryable === true` per [research.md](./research.md) §R9

### Implementation for User Story 1

- [x] T026 [US1] Implement `src/panels/agent-chat-panel.ts` (class `AgentChatPanel`): extension-side webview wrapper that creates exactly one panel per session id, loads the `agent-chat` webview entry, handles `agent-chat/*` messages, and forwards state changes from `AgentChatRegistry` and `AgentChatSessionStore`. Unit tests (T018) must pass
- [x] T027a [US1] Implement the **lifecycle + event-mapping + submit** slice of `src/features/agent-chat/acp-chat-runner.ts` (class `AcpChatRunner` implementing `AgentChatRunnerHandle` from T005): constructor, `start(initialPrompt)`, subscribe to `AcpClient` via `AcpSessionManager.subscribe` with per-`(providerId, cwd)` resolution, map `AcpSessionEvent` to `AgentChatEvent`, forward to `AgentChatSessionStore.appendMessages` and `AgentChatRegistry`, `submit(userMessage)` happy-path forwarding to `AcpClient.sendPrompt`, lifecycle transitions per [data-model.md](./data-model.md) §2
- [x] T027b [US1] Implement the **follow-up queue + retry + cancel** slice of the same file: queued follow-ups per [contracts/agent-chat-panel-protocol.md](./contracts/agent-chat-panel-protocol.md) §4.2 (pending → queued → delivered → rejected transitions, max 1 in-flight queued per session), `retry()` creates a new session id while preserving mode/model/target, `cancel()` routes to `AcpClient.cancel`, `dispose()` flushes outstanding state. Tests (T019) must be fully green after this task
- [x] T028 [P] [US1] Create `ui/src/features/agent-chat/components/chat-transcript.tsx` using `@tanstack/react-virtual`. Tests (T020) must pass
- [x] T029 [P] [US1] Create `ui/src/features/agent-chat/components/chat-message-item.tsx`. Tests (T021) must pass
- [x] T030 [P] [US1] Create `ui/src/features/agent-chat/components/tool-call-item.tsx` (distinct styling for tool calls, status transitions). Tests (T025a) must pass
- [x] T031 [P] [US1] Create `ui/src/features/agent-chat/components/input-bar.tsx`. Tests (T022) must pass
- [x] T032 [P] [US1] Create `ui/src/features/agent-chat/components/status-header.tsx`. Tests (T023) must pass
- [x] T033 [P] [US1] Create `ui/src/features/agent-chat/components/retry-action.tsx` (renders retry / open-in-provider / dispatch-again buttons inside error messages per [research.md](./research.md) §R9). Tests (T025b) must pass
- [x] T034 [US1] Create `ui/src/features/agent-chat/hooks/use-session-bridge.ts` wiring the `postMessage` bridge to the extension per the panel protocol. Tests (T024) must pass
- [x] T035 [US1] **Replace the Phase 1 stub** in `ui/src/features/agent-chat/index.tsx` (created in T004) with the real composition: chat transcript + input bar + status header + retry action, consuming `use-session-bridge`
- [x] T036 [US1] Confirm the `agent-chat` page registration in `ui/src/page-registry.tsx` (wired in T004) still resolves after T035 expands `AgentChatFeature`; no new entry file is needed because the project uses a single-entry Vite build with runtime page dispatch. If this task is otherwise a no-op at implementation time, collapse it into T035's acceptance
- [x] T037 [US1] Modify `src/features/hooks/actions/acp-action.ts` to route execution through `AcpChatRunner` when the chat panel is enabled (default = enabled) while preserving the existing `OutputChannel` log output (FR-022). Add a feature flag `gatomia.agentChat.enabled` (default `true`) read from VS Code settings so the legacy path remains reachable for rollout safety
- [x] T038 [US1] Create `src/commands/agent-chat-commands.ts` exposing `gatomia.agentChat.startNew`, `gatomia.agentChat.openForSession`, `gatomia.agentChat.cancel`. Register these in `src/extension.ts`
- [x] T039 [US1] Wire restart restore in `src/extension.ts` activation path: initialize `AgentChatSessionStore`, call `listNonTerminal()`, transition ACP sessions to `ended-by-shutdown` idempotently per [contracts/agent-chat-session-storage.md](./contracts/agent-chat-session-storage.md) §6.1
- [x] T040 [US1] Wire `deactivate()` in `src/extension.ts` to `await AgentChatSessionStore.flushForDeactivation()` before disposing `AcpClient`s. Integration test T025 must pass end-to-end after this task
- [x] T041 [US1] Run the `acp-streaming-and-followup.test.ts` integration test green (T025) and manually verify the P1 Quickstart walkthrough in [quickstart.md](./quickstart.md) §2 — automated T025 green; manual Quickstart verification deferred to Phase 4 after the provider-id bridge for `AcpProviderRegistry` is wired into `startAcpSession`

**Checkpoint**: User Story 1 is fully functional. A user triggering any ACP agent sees output streaming into a chat panel and can submit follow-up messages. MVP is shippable here.

---

## Phase 4: User Story 2 — Reopen an Agent's Execution Window by Clicking the Running Item (Priority: P2)

**Goal**: The user can discover every running and recently-completed agent session in a dedicated tree view and click any entry to open that session's chat panel (focusing an existing panel rather than duplicating).

**Independent Test** (from [spec.md](./spec.md) US2): trigger two ACP sessions in parallel; click the first entry in the Running Agents tree → its panel opens with its transcript; click the second → a different panel opens with its transcript; no bleed-through.

### Tests for User Story 2 (TDD, must fail first) ⚠️

- [ ] T042 [P] [US2] Tests `tests/unit/providers/running-agents-tree-provider.test.ts`: tree emits one group per lifecycle bucket ("Active", "Recent", "Orphaned worktrees"), leaves carry `agent display · mode · target · status`, click invokes `gatomia.agentChat.openForSession`, right-click for worktree-backed sessions exposes "Clean up worktree", the provider refreshes on `AgentChatSessionStore.onDidChangeManifest`
- [ ] T043 [P] [US2] Integration test `tests/integration/agent-chat/click-running-item-opens-panel.test.ts`: given two sessions, clicking each opens the correct panel exactly once; clicking an already-open session focuses (does not duplicate)

### Implementation for User Story 2

- [ ] T044 [US2] Implement `src/providers/running-agents-tree-provider.ts` subscribing to `AgentChatSessionStore.onDidChangeManifest`. Tests (T042) must pass
- [ ] T045 [US2] Register the tree view `gatomia.runningAgents` in `package.json` under the existing `gatomia` activity bar container (siblings of `gatomia.specExplorer`, `gatomia.hooksExplorer`, `gatomia.promptsExplorer`)
- [ ] T046 [US2] Register `RunningAgentsTreeProvider` in `src/extension.ts` with `vscode.window.createTreeView("gatomia.runningAgents", { treeDataProvider })`. Ensure the tree reflects state restored by T039
- [ ] T047 [US2] Ensure `AgentChatRegistry.openPanelFor(sessionId)` honors the "one panel per session" invariant (FR-008) — focus existing if present, create new otherwise. Integration test (T043) must pass
- [ ] T048 [US2] Add a command `gatomia.agentChat.openLogChannel` (exposed in the tree view's context menu) that reveals the existing ACP `OutputChannel` so users retain a one-click path to the raw log surface (FR-022)

**Checkpoint**: Users can discover and re-open any running or recent ACP or Cloud chat session from the Running Agents tree.

---

## Phase 5: User Story 3 — Configure Mode, Model, and Execution Target Before or During a Run (Priority: P3)

**Goal**: Every ACP chat panel exposes mode, model, and execution-target selectors grounded in the agent's actual capabilities. Cloud sessions open as read-only monitors. Worktree target creates a per-session `.gatomia/worktrees/<id>/` isolated checkout that the user must explicitly clean up.

**Independent Test** (from [spec.md](./spec.md) US3): open a new ACP session whose catalog entry declares Code/Ask/Plan modes; confirm the selector lists exactly those modes. Pick Worktree; confirm a new directory and branch exist and agent edits land there. Pick Cloud without a configured provider; confirm the panel guides the user to configure one rather than silently falling back.

### Tests for User Story 3 (TDD, must fail first) ⚠️

- [ ] T049 [P] [US3] Tests `tests/unit/features/agent-chat/agent-capabilities-service.test.ts` covering every case in [contracts/agent-capabilities-contract.md](./contracts/agent-capabilities-contract.md) §7 (agent-only modes, agent-only models, agent acceptsFollowUp = false, agent silent + catalog populated, agent silent + catalog no `capabilities`, agent silent + no catalog entry, agent wins on conflict, normalization drops invalid, normalization de-dupes, `humanize` five cases)
- [ ] T050 [P] [US3] Tests `tests/unit/features/agent-chat/agent-capabilities-catalog.test.ts`: snapshot test for shape stability plus at least one resolver test per seeded entry
- [ ] T051 [P] [US3] Tests `tests/unit/features/agent-chat/agent-worktree-service.test.ts` covering every case in [contracts/worktree-lifecycle.md](./contracts/worktree-lifecycle.md) §10: happy path, already-ignored `.gitignore`, missing `.gitignore`, path conflict, branch conflict, not-a-git-repo, **ambiguous-multi-root**, **single-root**, **trigger-resolved-multi-root**, no-HEAD, inspect with uncommitted files, inspect with new commits since base (no remote), inspect when branch is at base, cleanup dirty without confirmation, cleanup dirty with confirmation, cleanup clean without confirmation, self-repair when directory was deleted out-of-band, failure does not start the agent. Organise the suite so `create` / `inspect` / `cleanup` are in three distinct `describe` blocks matching the T059a/T059b/T059c split
- [ ] T052 [P] [US3] Tests `tests/unit/features/agent-chat/cloud-chat-adapter.test.ts`: `attach(localId)` is idempotent, maps `AgentPollingService.onSessionUpdated` events into `AgentChatEvent`s, cancel routes through the active provider adapter, no follow-up input is forwarded to cloud sessions
- [ ] T053 [P] [US3] Webview tests `tests/unit/webview/agent-chat/mode-selector.test.tsx`, `model-selector.test.tsx`, `target-selector.test.tsx`: selectors are hidden when capabilities source is `"none"`, options listed match the resolved capabilities, change emits the correct `agent-chat/control/change-*` message, target selector disables "Cloud" with the correct `disabledReason` when no provider is configured
- [ ] T054 [P] [US3] Webview tests `tests/unit/webview/agent-chat/worktree-banner.test.tsx` and `read-only-banner.test.tsx`: banners render path/branch/status correctly, the "Clean up worktree" button goes through the two-step confirmation flow from [contracts/agent-chat-panel-protocol.md](./contracts/agent-chat-panel-protocol.md) §5 and §4.7
- [ ] T055 [P] [US3] Integration test `tests/integration/agent-chat/mode-model-target-selection.test.ts`: exercises picking each mode, each model, and each target (Local, Worktree, Cloud with and without configured provider)
- [ ] T056 [P] [US3] Integration test `tests/integration/agent-chat/worktree-lifecycle.test.ts`: create a worktree session → agent edits land in the worktree only → inspect reports commits-since-base for a new commit without remote → cleanup two-step flow works → session metadata retains `worktree.status = "cleaned"`

### Implementation for User Story 3

- [ ] T057 [P] [US3] Implement `src/features/agent-chat/agent-capabilities-catalog.ts` with the `AGENT_CAPABILITIES_CATALOG` seeded for the well-known ACP agents (opencode, claude-code, gemini-cli, devin, copilot-language-server). Tests (T050) must pass
- [ ] T058 [P] [US3] Implement `src/features/agent-chat/agent-capabilities-service.ts` with the hybrid resolver, `humanize(id)` pure function per [contracts/agent-capabilities-contract.md](./contracts/agent-capabilities-contract.md) §3, and the `agent-chat.capabilities.resolved` telemetry event. Tests (T049) must pass
- [ ] T059a [US3] Implement the **create + multi-root resolve + `.gitignore` seed** slice of `src/features/agent-chat/agent-worktree-service.ts` per [contracts/worktree-lifecycle.md](./contracts/worktree-lifecycle.md) §4 step 0 (multi-root resolution) and §4 step 1–4 (branch naming, `git worktree add`, `.gitignore` seeding, atomic rollback on partial failure). Must satisfy the `create` `describe` block in T051 and emit the `worktree.created` / `worktree.failed` telemetry events from §9
- [ ] T059b [US3] Implement the **inspect** slice (`inspect(worktreeId): WorktreeInspection`) of the same file per [contracts/worktree-lifecycle.md](./contracts/worktree-lifecycle.md) §5: uses `baseCommitSha..HEAD` for the commit-count, reports uncommitted file count via `git status --porcelain`, and behaves correctly when the branch is at base or HEAD is missing. Must satisfy the `inspect` `describe` block in T051
- [ ] T059c [US3] Implement the **cleanup + self-repair** slice of the same file per [contracts/worktree-lifecycle.md](./contracts/worktree-lifecycle.md) §6: two-step confirmation with dirty-tree warnings, `git worktree remove --force` then `git branch -D`, handle the self-repair case where the directory was deleted out-of-band, emit `worktree.cleaned` / `worktree.abandoned` telemetry. Must satisfy the `cleanup` `describe` block in T051; T051 must be fully green after this task
- [ ] T060 [P] [US3] Implement `src/features/agent-chat/cloud-chat-adapter.ts`: subscribes to `AgentPollingService.onSessionUpdated` (added in T017), maps provider updates to `AgentChatEvent`s, routes cancels through the active provider adapter, refuses follow-up input submissions. Tests (T052) must pass
- [ ] T061 [P] [US3] Create `ui/src/features/agent-chat/components/mode-selector.tsx`. Tests (T053) must pass
- [ ] T062 [P] [US3] Create `ui/src/features/agent-chat/components/model-selector.tsx`. Tests (T053) must pass
- [ ] T063 [P] [US3] Create `ui/src/features/agent-chat/components/target-selector.tsx` including the "Cloud disabled until provider configured" hint. Tests (T053) must pass
- [ ] T064 [P] [US3] Create `ui/src/features/agent-chat/components/worktree-banner.tsx` including the two-step cleanup confirmation dialog. Tests (T054) must pass
- [ ] T065 [P] [US3] Create `ui/src/features/agent-chat/components/read-only-banner.tsx`. Tests (T054) must pass
- [ ] T066 [US3] Extend `src/commands/agent-chat-commands.ts` (created in T038) with `gatomia.agentChat.cleanupWorktree`, `gatomia.agentChat.changeMode`, `gatomia.agentChat.changeModel`, `gatomia.agentChat.changeExecutionTarget`. Wire the two-step cleanup request/response pattern from [contracts/agent-chat-panel-protocol.md](./contracts/agent-chat-panel-protocol.md) §5
- [ ] T067 [US3] Integrate `AgentCapabilitiesService` into `AcpChatRunner` (created in T027) so every new session resolves capabilities at `initialize` and exposes them via `AgentChatSession.capabilities`; record `SystemChatMessage { kind: "mode-changed" | "model-changed" }` entries whenever the user switches
- [ ] T068 [US3] Integrate `AgentWorktreeService` into `AcpChatRunner`: when the user's `executionTarget.kind === "worktree"`, call `T059a` create before spawning and pass `cwd = handle.absolutePath` to the ACP session manager (exercises the T015 `(providerId, cwd)` keying); surface failures as `ErrorChatMessage { category: "worktree-create-failed" }` without starting the agent. Hook `T059c` cleanup into the `gatomia.agentChat.cleanupWorktree` command wired in T066, and `T059b` inspect into the `worktree-banner` refresh loop
- [ ] T069 [US3] Route Cloud target dispatches through the active cloud provider adapter (spec 016) from `AcpChatRunner`/`AgentChatRegistry`: create a companion `CloudChatAdapter` session and attach the chat panel to it; surface "Configure a cloud provider" guidance when none is active (FR-017). Integration tests (T055, T056) must pass

**Checkpoint**: Mode / model / execution-target selection works end-to-end for ACP, Cloud opens as a read-only monitor, and worktree sessions create + clean up safely.

---

## Phase 6: User Story 4 — Monitor Multiple Concurrent Agent Sessions (Priority: P4)

**Goal**: Users can see every active and recent session at a glance, including which are blocked, with an enforced soft cap on concurrent ACP subprocesses and a visible list of any orphaned worktrees needing cleanup.

**Independent Test** (from [spec.md](./spec.md) US4): start three ACP sessions with different modes and targets; confirm all three are listed with the correct agent name, mode, target, and status; one session blocked waiting for input is visibly flagged; attempting a sixth concurrent ACP session surfaces the cap warning.

### Tests for User Story 4 (TDD, must fail first) ⚠️

- [ ] T070 [P] [US4] Tests `tests/unit/features/agent-chat/concurrent-cap.test.ts`: enforce `gatomia.agentChat.maxConcurrentAcpSessions` (default 5) — the 6th ACP session attempt returns a warning/error path before spawning; cloud sessions do not count against the cap
- [ ] T071 [P] [US4] Extend `tests/unit/providers/running-agents-tree-provider.test.ts` with cases for `waiting-for-input` visual flag, the "Orphaned worktrees" group including entries migrated from the manifest, and the right-click cleanup action for orphans
- [ ] T072 [P] [US4] Integration test `tests/integration/agent-chat/multi-session.test.ts`: three simultaneous ACP sessions render correctly, status transitions propagate to the tree, switching focus between panels preserves per-session transcripts (SC-009)

### Implementation for User Story 4

- [ ] T073 [US4] Add the setting `gatomia.agentChat.maxConcurrentAcpSessions` (default 5) to `package.json` `contributes.configuration` and read it in `AgentChatRegistry`. Enforce the cap in `AcpChatRunner.startSession` (raises a typed `ConcurrentCapExceededError` that carries the idle-session list). Tests (T070) must pass
- [ ] T073a [US4] Implement the **cap warning UX** per [research.md](./research.md) §R5: when `ConcurrentCapExceededError` fires, show a `vscode.window.showQuickPick` that lists idle ACP sessions (`waiting-for-input` or any terminal state) as `"<agentDisplayName> · <mode> · <target> · <timeSinceLastActivity>"` with actions `Cancel this session and start new` / `Cancel this session without starting new` / `Keep all, do not start`. Wire the result back into `AgentChatRegistry.startSession` so the user's choice is honoured or the start is aborted with a clear toast (never a silent drop). Extend T070 with a test asserting the quick pick is shown on the 6th ACP attempt and that the correct follow-through action is taken
- [ ] T074 [US4] Extend `RunningAgentsTreeProvider` (created in T044) with:
  - the third group "Orphaned worktrees" populated from `gatomia.agentChat.worktreesOrphaned`
  - a visual flag (`$(bell)` or equivalent codicon) for sessions in `waiting-for-input`
  - a label suffix `(blocked)` in the tree when the flag is active
  Tests (T071) must pass
- [ ] T075 [US4] Wire `AgentChatSessionStore` to migrate evicted worktree references into `gatomia.agentChat.worktreesOrphaned` per [contracts/agent-chat-session-storage.md](./contracts/agent-chat-session-storage.md) §2.4 and §5 during retention eviction
- [ ] T076 [US4] Add a telemetry event `agent-chat.concurrent-cap.hit` emitted when the user is shown the cap warning; document it in `plan.md` Constitution row IV. Integration test (T072) must pass

**Checkpoint**: Multi-session monitoring, concurrency enforcement, and orphaned-worktree visibility are all wired and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression coverage for behaviors that span stories, documentation updates, and the mandatory `npm run check` gate before shipping.

- [ ] T077 Integration test `tests/integration/agent-chat/restart-persistence.test.ts` covering the full Quickstart §6 flow: start 2 ACP sessions + 1 Cloud; simulate VS Code restart; assert the two ACP sessions reappear as `ended-by-shutdown` with full transcripts, the Cloud session re-attaches via spec 016 polling, and worktrees remain on disk
- [ ] T078 [P] Unit test `tests/unit/features/agent-chat/telemetry.test.ts` asserts every event name documented in `plan.md` Constitution row IV actually fires from its expected call site (ACP start/stream/follow-up/cancel/end-by-shutdown, worktree created/failed/cleaned/abandoned, capabilities resolved, panel opened/reopened, error, concurrent-cap-hit)
- [ ] T079 [P] Update `quickstart.md` §8 "Troubleshooting" with any new symptoms discovered during implementation (append only; do not delete existing entries)
- [ ] T080 Run `npm test` and `npm run check` locally; fix any failures. This is the Constitution-mandated merge gate
- [ ] T081 Manually walk through all six sections of [quickstart.md](./quickstart.md) (§2 US1, §3 US2, §4 US3, §5 Worktree, §6 Restart, §7 Tests) in the Extension Development Host and record the outcome in the PR description

**Checkpoint**: All user stories green, all integration tests green, `npm run check` passes, and the manual Quickstart walkthrough succeeds. Feature is mergeable.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no prerequisites.
- **Phase 2 (Foundational)**: depends on Phase 1. BLOCKS every user story.
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US3)**, **Phase 6 (US4)**: each depends only on Phase 2. After Phase 2 completes, all four phases may proceed in parallel if team size allows.
- **Phase 7 (Polish)**: depends on every user-story phase the release targets.

### Within each phase

- Tests (TDD) MUST be written and failing **before** their paired implementation task begins.
- Models/types before services; services before panels/providers; extension-side before webview wiring where events cross the bridge.
- Any task that modifies a file already being modified by an incomplete task is serialized (no same-file parallelism).

### Parallel opportunities

**Phase 1**: T002, T003, T004 are independent of T001 once directories exist; all three carry `[P]`.

**Phase 2**: T005 + T006 + T007 can run in parallel (independent files). T008 and T010 are independent test files. T012 and T014 are independent test files. T016 is independent. Implementation tasks T009a/T009b (same file, so T009b serializes after T009a), T011, T013, T015, T017 each depend only on their paired test task, so any of the five implementation lanes can run in parallel with another as long as their respective tests (T008/T010/T012/T014/T016) are red-first.

**Phase 3 (US1)**: T018–T025b are all `[P]` (different files, no inter-test dependency). Components T028–T033 are `[P]`. `AgentChatPanel` (T026), `AcpChatRunner` (T027a → T027b serialize on the same file), and `use-session-bridge` (T034) are interdependent via type + event contracts — serialize the panel/runner/bridge trio.

**Phase 4 (US2)**: T042 and T043 are `[P]`. T044–T048 serialize on `RunningAgentsTreeProvider` and extension wiring.

**Phase 5 (US3)**: All test tasks T049–T056 are `[P]`. Implementation tasks T057, T058, T060, T061–T065 are `[P]` across distinct files. T059a → T059b → T059c serialize on `agent-worktree-service.ts` (same file). T066–T069 serialize because they all modify `acp-chat-runner.ts` and/or `agent-chat-commands.ts`.

**Phase 6 (US4)**: T070–T072 are `[P]`. T073 → T073a serialize (T073a depends on the typed `ConcurrentCapExceededError` introduced in T073). T074–T076 could be run in parallel once T073a lands (distinct files: tree provider, session store, telemetry hook), though the tasks.md lists them sequentially for clarity.

**Phase 7**: T078 and T079 are `[P]`. T080 must be last (gate).

---

## Parallel Example: User Story 1 — parallelizable test batch

```bash
# Write all US1 tests in parallel (all fail until implementation lands).
Task: T018  "Contract tests for agent-chat panel protocol (US1 subset) in tests/unit/panels/agent-chat-panel.test.ts"
Task: T019  "AcpChatRunner unit tests in tests/unit/features/agent-chat/acp-chat-runner.test.ts"
Task: T020  "Chat transcript virtualization tests in tests/unit/webview/agent-chat/chat-transcript.test.tsx"
Task: T021  "Chat message item tests in tests/unit/webview/agent-chat/chat-message-item.test.tsx"
Task: T022  "Input bar tests in tests/unit/webview/agent-chat/input-bar.test.tsx"
Task: T023  "Status header tests in tests/unit/webview/agent-chat/status-header.test.tsx"
Task: T024  "Use-session-bridge tests in tests/unit/webview/agent-chat/use-session-bridge.test.ts"
Task: T025  "ACP streaming + follow-up integration test in tests/integration/agent-chat/acp-streaming-and-followup.test.ts"
Task: T025a "Tool call item tests in tests/unit/webview/agent-chat/tool-call-item.test.tsx"
Task: T025b "Retry action tests in tests/unit/webview/agent-chat/retry-action.test.tsx"
```

```bash
# Webview components in parallel (different files):
Task: T028 "Implement chat-transcript.tsx"
Task: T029 "Implement chat-message-item.tsx"
Task: T030 "Implement tool-call-item.tsx"
Task: T031 "Implement input-bar.tsx"
Task: T032 "Implement status-header.tsx"
Task: T033 "Implement retry-action.tsx"
```

---

## Parallel Example: User Story 3 — parallelizable test batch

```bash
Task: T049 "Capabilities service tests"
Task: T050 "Capabilities catalog tests"
Task: T051 "Worktree service tests"
Task: T052 "Cloud chat adapter tests"
Task: T053 "Selector component tests (mode/model/target)"
Task: T054 "Banner component tests (worktree/read-only)"
Task: T055 "Mode/model/target selection integration test"
Task: T056 "Worktree lifecycle integration test"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational). All foundational tests green.
2. Complete Phase 3 (User Story 1). All US1 tests green; Quickstart §2 manually validated.
3. **Validate**: run `npm test`, `npm run check`. Ship if acceptance criteria are met.

At this point the feature already delivers the core value described in the user's original request: ACP agent executions open in a chat-style panel with streaming output and follow-up input, replacing the log window as the primary surface.

### Incremental delivery

1. MVP (above) → release.
2. Add Phase 4 (US2) → tree view + click-to-reopen → release.
3. Add Phase 5 (US3) → mode/model/target selection + worktree + cloud monitor → release.
4. Add Phase 6 (US4) → multi-session + concurrent cap + orphaned worktrees → release.
5. Polish (Phase 7) before every release.

Each increment is independently testable and does not regress the previous ones.

### Parallel team strategy

With two or more developers, after Phase 2 completes:

- Developer A: Phase 3 (US1 — MVP).
- Developer B: Phase 4 (US2) once Phase 3's foundational components (`AgentChatPanel`, `AgentChatRegistry`) are merged.
- Developer C: Phase 5 (US3) — the worktree service, capabilities service, and cloud adapter are all touch-distinct from US1/US2 plumbing.
- Rejoin for Phase 6 and Phase 7.

---

## Notes

- `[P]` tasks = different files, no dependency on an incomplete task. Do not parallelize tasks that both modify `src/extension.ts`, `src/services/acp/acp-client.ts`, or any shared file.
- `[USn]` labels map every Phase 3–6 task to the exact user story in [spec.md](./spec.md). Polish tasks (Phase 7) do not carry a story label.
- TDD is mandatory: every implementation task's paired test task MUST be failing before the implementation begins. CI + review enforce this.
- Commit boundaries: commit after each task or logical task group. Squash on merge as usual.
- Safety gates: never mark a task complete without its tests passing. Never merge without `npm run check` and `npm test` both green (Constitution III + mandatory `npm run check` rule).
- Stop at any checkpoint to validate the story independently; each checkpoint is a shippable state.
