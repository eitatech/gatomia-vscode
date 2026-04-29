# Implementation Plan: Interactive Agent Chat Panel

**Branch**: `018-agent-chat-panel` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-agent-chat-panel/spec.md`

## Summary

Replace the current log-window experience for ACP agent executions with a dedicated, per-session **chat-style webview panel** that streams output, accepts follow-up input, and exposes mode/model/execution-target selectors. The same panel also surfaces **Cloud provider sessions** from the multi-provider registry (spec 016) as a **read-only progress monitor** with cancel-only controls; non-ACP local agents (Copilot Chat participants, gh-copilot CLI) are explicitly out of scope and keep their current UIs.

The design adds a new `features/agent-chat/` module that owns session identity, capability discovery (hybrid: ACP `initialize` → gatomia-maintained catalog → hide), per-session **git worktree** isolation (one worktree per session, never auto-deleted, explicit cleanup action), and per-workspace persistence of transcripts and metadata. A new `AgentChatPanel` webview renders one panel instance per session; a **Running Agents** tree view lists in-flight and recent sessions and serves as the click-through entry point. Execution is delegated: ACP sessions are driven by the existing `AcpClient`/`AcpSessionManager` (extended with a per-session event channel for streaming), and Cloud sessions are adapted from the existing `ProviderRegistry` + `AgentSessionStorage` in spec 016. On VS Code restart, ACP sessions reappear as "ended by shutdown" with full transcript; Cloud sessions re-attach via existing polling. The existing ACP log `OutputChannel` is retained unchanged for diagnostics (FR-022).

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict: true, target: ES2022)
**Primary Dependencies**: VS Code Extension API 1.84.0+, React 18.3+ (webview), `@agentclientprotocol/sdk` (already wired via `src/services/acp/acp-client.ts`), existing `src/features/cloud-agents/*` module (spec 016), existing `src/services/acp/*` (ACP client, session manager, provider registry, `KNOWN_AGENTS` catalog via `src/providers/hook-view-provider.ts`)
**Storage**:
- Session metadata + transcripts: VS Code `workspaceState` (per-workspace JSON, key `gatomia.agentChat.sessions`), size-bounded via transcript truncation policy resolved in Phase 0
- Worktrees: git worktrees on disk under `<repoRoot>/.gatomia/worktrees/<session-id>/` (added to `.gitignore` on first use)
- Cloud provider credentials and sessions: already covered by spec 016 (`SecretStorage` + `AgentSessionStorage`); not re-implemented here
**Testing**: Vitest 3.2+ with the existing dual resolution in `vitest.config.ts`; TDD required per Constitution III. Unit tests under `tests/unit/features/agent-chat/`, webview tests under `tests/unit/webview/agent-chat/`, integration tests under `tests/integration/agent-chat/`.
**Target Platform**: VS Code Desktop 1.84.0+ (all OS). Git CLI required for the Worktree execution target; missing-git is a clean-failure case (FR-015c).
**Project Type**: VS Code extension (dual-build: esbuild for extension, Vite for webview)
**Performance Goals**:
- SC-001: first agent output visible in chat within 2 s of run start
- SC-002: follow-up message delivered within 1 s in ≥95% of attempts
- SC-006: cloud status updates within 30 s lag (inherited from spec 016 polling cadence)
- FR-021: responsive scrolling and no UI freeze under high-throughput output (virtualized message list)
**Constraints**:
- Single active chat panel per session (FR-008), no cross-session bleed-through
- Worktrees are **never** auto-deleted (FR-015a)
- ACP subprocesses die with the VS Code window and are **not** respawned on restart (FR-019b)
- Non-ACP local agents (Copilot Chat participants, gh-copilot CLI) are out of scope (FR-000, Edge Cases)
- Cloud sessions in the chat panel are **read-only** in v1 (FR-003, FR-010, FR-011)
- Kebab-case filenames mandatory (Constitution I)
- `workspaceState` has practical size ceilings — transcript storage must cap message volume per session with a clear truncation UX (Phase 0 research)
**Scale/Scope**:
- Expected concurrent ACP sessions per workspace: up to ~5 (Phase 0 to validate memory/process footprint)
- Per-session transcript ceiling target: on the order of 10k messages before truncation kicks in (Phase 0 to finalize)
- 1 new extension-side feature module (`features/agent-chat/`), 1 new webview feature module (`ui/src/features/agent-chat/`), 1 new webview entry (`agent-chat`), 1 new panel (`panels/agent-chat-panel.ts`), 1 new tree view provider (`providers/running-agents-tree-provider.ts`), extensions to existing ACP services and the spec 016 cloud-agents types/events

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Kebab-Case File Naming | PASS | All new files use kebab-case: `agent-chat-panel.ts`, `agent-chat-session-store.ts`, `agent-capabilities-service.ts`, `agent-capabilities-catalog.ts`, `acp-chat-runner.ts`, `cloud-chat-adapter.ts`, `agent-worktree-service.ts`, `agent-chat-registry.ts`, `running-agents-tree-provider.ts`, `chat-transcript.tsx`, `mode-selector.tsx`, etc. |
| II. TypeScript-First | PASS | All entities, events, and webview↔extension messages defined as TypeScript interfaces with `strict: true`. No `any`. Public APIs of each new service documented with JSDoc. Capability discovery keeps strong typing via a discriminated union (`ReportedByAgent` \| `CatalogFallback` \| `NotSupported`). |
| III. Test-First (TDD) | PASS | Phase 1 contracts drive contract tests first: AcpClient event stream, capability resolver, worktree lifecycle, session store persistence + restart behavior, panel↔webview message protocol. Implementation follows only after red tests exist. Integration tests cover the P1 story (trigger ACP → stream to panel → follow-up → end), the P2 story (click running item → correct panel opens), and the restart persistence flow. |
| IV. Observability | PASS | Structured telemetry via a new `features/agent-chat/telemetry.ts` following the established `logTelemetry(event, properties)` pattern already used in `features/hooks/actions/acp-action.ts`, `features/hooks/actions/git-action.ts`, and `features/devin/telemetry.ts`. Events: `agent-chat.session.started`, `.streamed`, `.follow-up-sent`, `.cancelled`, `.ended-by-shutdown`, `.worktree.created`, `.worktree.failed`, `.worktree.cleaned`, `.capabilities.resolved`, `.panel.opened`, `.panel.reopened`. The existing ACP `OutputChannel` is retained unchanged (FR-022) as the raw-output diagnostic surface. No silent failures: every error path routes to both telemetry and the panel's transcript (FR-020). |
| V. Simplicity & YAGNI | PASS | v1 deliberately **excludes** cloud-session follow-up input (read-only), non-ACP local agent routing, ACP subprocess respawn on restart, automatic worktree deletion, and user-configurable mode/model catalogs. The execution-target selector is exactly three options. Only one chat panel per session (FR-008). Capability catalog extends the existing `KNOWN_AGENTS` surface instead of introducing a new registry. Session storage reuses `workspaceState`, matching spec 016 and `015-hooks-refactor`. |

**All gates pass. No violations to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/018-agent-chat-panel/
├── plan.md                                 # This file (/speckit.plan command output)
├── research.md                             # Phase 0 output (this command)
├── data-model.md                           # Phase 1 output (this command)
├── quickstart.md                           # Phase 1 output (this command)
├── contracts/                              # Phase 1 output (this command)
│   ├── agent-chat-panel-protocol.md        # Webview <-> extension message contract
│   ├── agent-capabilities-contract.md      # Hybrid capability discovery contract (ACP initialize + catalog)
│   ├── agent-chat-session-storage.md       # Persisted session + transcript schema, versioning, migration
│   └── worktree-lifecycle.md               # Per-session worktree states and failure handling
├── checklists/
│   └── requirements.md                     # Spec quality checklist (already created)
└── tasks.md                                # Phase 2 output (/speckit.tasks - NOT created here)
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── agent-chat/                         # NEW: this feature
│   │   ├── types.ts                        # AgentChatSession, ChatMessage, AgentCapabilities,
│   │   │                                   #   ExecutionTarget, AgentChatEvent, SessionLifecycleState
│   │   ├── agent-chat-registry.ts          # In-memory registry of active sessions, panel routing,
│   │   │                                   #   shutdown flush (persists "ended by shutdown" on dispose)
│   │   ├── agent-chat-session-store.ts     # Per-workspace JSON persistence of sessions + transcripts
│   │   │                                   #   in workspaceState, restore on activation (FR-019a/b)
│   │   ├── agent-capabilities-service.ts   # Hybrid discovery: initialize -> catalog -> hide (FR-011a/b)
│   │   ├── agent-capabilities-catalog.ts   # gatomia-maintained fallback catalog (extends KNOWN_AGENTS)
│   │   ├── acp-chat-runner.ts              # Drives one ACP session; emits AgentChatEvent stream;
│   │   │                                   #   integrates with AcpClient/AcpSessionManager;
│   │   │                                   #   forwards follow-up user input into sendPrompt
│   │   ├── cloud-chat-adapter.ts           # Adapts cloud-agents (spec 016) session updates into
│   │   │                                   #   AgentChatEvents; read-only + cancel-only (FR-016, FR-018)
│   │   ├── agent-worktree-service.ts       # Per-session worktree create, path/branch naming,
│   │   │                                   #   .gitignore seeding, failure handling (FR-015/a/b/c)
│   │   └── telemetry.ts                    # Feature-scoped telemetry events
│   ├── cloud-agents/                       # EXISTING (spec 016): extended, NOT rewritten
│   │   ├── types.ts                        # MODIFIED: add optional AgentSession.chatPanelId link
│   │   ├── agent-polling-service.ts        # MODIFIED: add onSessionUpdated EventEmitter that drives cloud-chat-adapter
│   │   └── ... (all other files unchanged)
│   └── hooks/
│       └── actions/
│           └── acp-action.ts               # MODIFIED: route its ACP execution through acp-chat-runner
│                                           #   when the chat panel is enabled; keep log channel output
├── services/
│   └── acp/
│       ├── acp-client.ts                   # MODIFIED: add per-session event emitter (agent_message_chunk,
│       │                                   #   tool_call, tool_call_update, status) for streaming to
│       │                                   #   agent-chat, while keeping existing OutputChannel output
│       └── acp-session-manager.ts          # MODIFIED: expose subscribe(sessionKey) -> event stream;
│                                           #   key cached AcpClient instances by (providerId, cwd)
│                                           #   so Worktree-target sessions get isolated subprocesses
│                                           #   (F1 fix: prevents cross-session cwd contamination)
├── providers/
│   └── running-agents-tree-provider.ts     # NEW: tree view listing in-flight + recent sessions;
│                                           #   click -> open agent chat panel; groups by state
├── panels/
│   └── agent-chat-panel.ts                 # NEW: webview panel (one instance per session),
│                                           #   postMessage bridge to ui/src/features/agent-chat
├── commands/
│   └── agent-chat-commands.ts              # NEW: openForSession, cancel, cleanupWorktree,
│                                           #   changeMode, changeModel, changeExecutionTarget
└── extension.ts                            # MODIFIED: register agent-chat services, tree view,
                                            #   webview entry, commands; wire restart restore flow

ui/
├── package.json                            # MODIFIED: add `@tanstack/react-virtual` dependency
│                                           #   (permissive MIT license) for transcript virtualization
└── src/
    ├── features/
    │   └── agent-chat/                     # NEW: React webview feature module
    │       ├── index.tsx                   # Feature entry; bridges to extension via postMessage
    │       ├── types.ts                    # Shared types with extension (mirrored from src/features/agent-chat/types.ts)
    │       ├── components/
    │       │   ├── chat-transcript.tsx     # Virtualized message list
    │       │   ├── chat-message-item.tsx   # Message rendering (user/agent/system/tool)
    │       │   ├── tool-call-item.tsx      # Tool call + status rendering
    │       │   ├── input-bar.tsx           # Follow-up input (ACP-only; disabled with reason otherwise)
    │       │   ├── mode-selector.tsx       # Mode selector (Code/Ask/Plan); hidden if no capabilities
    │       │   ├── model-selector.tsx      # Model selector; hidden if no capabilities
    │       │   ├── target-selector.tsx     # Execution target selector (Local/Worktree/Cloud)
    │       │   ├── status-header.tsx       # Session status + agent name + lifecycle state
    │       │   ├── worktree-banner.tsx     # Worktree path + branch + "clean up worktree" action
    │       │   ├── read-only-banner.tsx    # Cloud session read-only label
    │       │   └── retry-action.tsx        # Retry / open-in-provider actions on failure
    │       └── hooks/
    │           └── use-session-bridge.ts   # postMessage <-> extension state sync
    └── page-registry.tsx                   # MODIFIED: register "agent-chat" as a SupportedPage
                                            #   (single-entry Vite build: pages are selected at runtime
                                            #   via data-page attribute on #root; no per-entry files)

tests/
├── unit/
│   ├── features/
│   │   └── agent-chat/
│   │       ├── agent-chat-registry.test.ts
│   │       ├── agent-chat-session-store.test.ts
│   │       ├── agent-capabilities-service.test.ts
│   │       ├── agent-capabilities-catalog.test.ts
│   │       ├── acp-chat-runner.test.ts
│   │       ├── cloud-chat-adapter.test.ts
│   │       ├── agent-worktree-service.test.ts
│   │       └── telemetry.test.ts
│   ├── providers/
│   │   └── running-agents-tree-provider.test.ts
│   ├── panels/
│   │   └── agent-chat-panel.test.ts
│   └── webview/
│       └── agent-chat/
│           ├── chat-transcript.test.tsx
│           ├── input-bar.test.tsx
│           ├── mode-selector.test.tsx
│           ├── target-selector.test.tsx
│           └── use-session-bridge.test.ts
└── integration/
    └── agent-chat/
        ├── acp-streaming-and-followup.test.ts       # P1 story end-to-end
        ├── click-running-item-opens-panel.test.ts   # P2 story end-to-end
        ├── mode-model-target-selection.test.ts      # P3 story end-to-end
        ├── restart-persistence.test.ts              # FR-019a/b/c
        └── worktree-lifecycle.test.ts               # FR-015/a/b/c
```

**Structure Decision**: Follows the existing extension + webview architecture (see `016-multi-provider-agents/plan.md` for precedent). A new `features/agent-chat/` module encapsulates all session, capability, worktree, and persistence logic. Existing ACP services in `src/services/acp/` receive additive changes (event-stream subscription, per-`(providerId, cwd)` client keying) rather than rewrites. The existing `features/cloud-agents/` module (spec 016) is reused as the Cloud execution target's control plane; the new `cloud-chat-adapter.ts` is the only bridge the chat panel needs. The existing `OutputChannel` for ACP stays unchanged (FR-022). One `AgentChatPanel` webview instance is created per session; the panel collection is tracked in `agent-chat-registry.ts`. Telemetry uses the project-wide `logTelemetry(event, properties)` pattern and `ui/package.json` gains exactly one new dependency (`@tanstack/react-virtual`, MIT) for transcript virtualization.

## Complexity Tracking

> No violations to track. All Constitution Check gates passed.
