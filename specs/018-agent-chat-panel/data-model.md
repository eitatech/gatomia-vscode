# Phase 1 Data Model: Interactive Agent Chat Panel

**Feature**: `018-agent-chat-panel`
**Date**: 2026-04-24
**Status**: Complete
**Inputs**: [spec.md](./spec.md), [research.md](./research.md)

This document captures the TypeScript-typed entities, their validation rules, relationships, and state transitions. All types live under `src/features/agent-chat/types.ts` and are mirrored (where applicable) into `ui/src/features/agent-chat/types.ts` for the webview.

---

## 1. Entities

### 1.1 `AgentChatSession`

A single end-to-end run of an agent surfaced in the chat panel. The aggregate root for everything the feature persists.

```ts
interface AgentChatSession {
  /** UUIDv4 assigned when the session is created. Primary key. */
  id: string;

  /** Session source: drives how runtime and UI behave. */
  source: "acp" | "cloud";

  /** Reference to the underlying agent (ACP descriptor id or Cloud provider id). */
  agentId: string;

  /** Display name snapshotted at session start so UI stays stable if the catalog changes. */
  agentDisplayName: string;

  /** Resolved capabilities at session start. See §1.3. */
  capabilities: ResolvedCapabilities;

  /** Current mode id (undefined when no mode selector is shown). */
  selectedModeId?: string;

  /** Current model id (undefined when no model selector is shown). */
  selectedModelId?: string;

  /** Execution target chosen by the user. */
  executionTarget: ExecutionTarget;

  /** Lifecycle state. See §2. */
  lifecycleState: SessionLifecycleState;

  /** What caused the session to start (hook id, command id, URI, or null when user-initiated). */
  trigger: SessionTrigger;

  /** Worktree handle when executionTarget = "worktree"; null otherwise. */
  worktree: WorktreeHandle | null;

  /** Cloud provider linkage when source = "cloud"; null otherwise. */
  cloud: CloudLinkage | null;

  /** Unix millisecond timestamps. */
  createdAt: number;
  updatedAt: number;
  endedAt?: number;

  /** Workspace identifier (VS Code workspace folder uri) for scoping. */
  workspaceUri: string;
}
```

**Validation rules**:

- `id` MUST be a valid UUIDv4 and unique within the workspace manifest.
- `source` MUST be `"acp"` or `"cloud"`; no other values in v1 (FR-000).
- `agentId` MUST be non-empty and resolvable via the ACP provider registry or the cloud provider registry.
- `selectedModeId` MUST be undefined when `capabilities.modes` is empty OR `capabilities.source === "none"`; otherwise MUST be one of `capabilities.modes[].id`.
- `selectedModelId` MUST follow the same rule as `selectedModeId` for models.
- `executionTarget` MUST be `"local"` when `source = "cloud"` → **invalid** combination (cloud always uses cloud target). Enforced at construction.
- `executionTarget = "worktree"` requires `worktree !== null`.
- `executionTarget = "cloud"` requires `cloud !== null` AND `source = "cloud"`.
- `endedAt` MUST be `undefined` unless `lifecycleState` is a terminal state (see §2).
- `updatedAt ≥ createdAt`; `endedAt ≥ updatedAt` when set.

---

### 1.2 `ChatMessage`

A single entry in the session's conversation transcript.

```ts
type ChatMessage =
  | UserChatMessage
  | AgentChatMessage
  | SystemChatMessage
  | ToolCallChatMessage
  | ErrorChatMessage;

interface ChatMessageBase {
  /** UUIDv4 unique within this session's transcript. */
  id: string;
  sessionId: string;
  /** Unix ms. */
  timestamp: number;
  /** Monotonic sequence number within the session (append order), starting at 0. */
  sequence: number;
  /** Snapshot of the mode/model in effect when this message was produced. */
  contextAtTurn?: {
    modeId?: string;
    modelId?: string;
    executionTarget: ExecutionTarget;
  };
}

interface UserChatMessage extends ChatMessageBase {
  role: "user";
  content: string;
  /** True if this was the first prompt (task instruction); false for follow-ups. */
  isInitialPrompt: boolean;
  /**
   * Delivery state for follow-up input submitted while the agent may be mid-turn.
   * Initial-prompt messages are always `"delivered"` on creation.
   *
   * Transitions (follow-ups):
   *   "pending"   → the webview has submitted the message; extension has not yet routed it
   *   "queued"    → extension accepted it but the agent is mid-turn; it will be sent on next turn boundary
   *   "delivered" → extension forwarded it to the agent (e.g. `AcpClient.sendPrompt`)
   *   "rejected"  → extension refused it (agent does not accept follow-ups, session is read-only,
   *                 session is in a terminal state, or cloud session); `rejectionReason` is set
   */
  deliveryStatus: "pending" | "queued" | "delivered" | "rejected";
  /** Populated only when `deliveryStatus === "rejected"`; human-readable reason shown in the transcript. */
  rejectionReason?: string;
}

interface AgentChatMessage extends ChatMessageBase {
  role: "agent";
  /** Plain text content, possibly markdown. Streamed chunk-by-chunk but stored coalesced per turn. */
  content: string;
  /** Stable id of the agent turn this message belongs to (one turn = one assistant response). */
  turnId: string;
  /** True when the turn finished; false if this is an interim snapshot. */
  isTurnComplete: boolean;
  /** Populated when isTurnComplete = true. */
  stopReason?: string;
}

interface SystemChatMessage extends ChatMessageBase {
  role: "system";
  /** Machine-readable kind so the UI can style appropriately. */
  kind:
    | "session-started"
    | "mode-changed"
    | "model-changed"
    | "target-changed"
    | "worktree-created"
    | "worktree-cleaned"
    | "read-only-notice"
    | "ended-by-shutdown"
    | "restored-from-persistence";
  content: string;
}

interface ToolCallChatMessage extends ChatMessageBase {
  role: "tool";
  toolCallId: string;
  title?: string;
  /** Latest status reported by the agent. */
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
}

interface ErrorChatMessage extends ChatMessageBase {
  role: "error";
  content: string;
  /** Machine-readable error category to drive retry controls (FR-020). */
  category:
    | "acp-handshake"
    | "acp-empty-response"
    | "acp-timeout"
    | "acp-spawn-failed"
    | "worktree-create-failed"
    | "worktree-cleanup-failed"
    | "cloud-dispatch-failed"
    | "cloud-disconnected"
    | "unknown";
  retryable: boolean;
}
```

**Validation rules**:

- `id` unique per session; `sequence` strictly monotonic.
- `UserChatMessage.isInitialPrompt = true` MUST appear exactly once per session (the first message); all subsequent user messages have `isInitialPrompt = false`.
- `UserChatMessage.deliveryStatus` MUST be `"delivered"` for initial-prompt messages at creation time (the session runner only starts after the initial prompt is delivered).
- For follow-up `UserChatMessage` entries, `deliveryStatus` MUST start as `"pending"`; updates MUST go through `agent-chat/messages/updated` patches (panel protocol §3.4) so the webview and persisted transcript stay in sync. Once the status reaches `"delivered"` or `"rejected"` it is terminal (no further transitions).
- `UserChatMessage.rejectionReason` MUST be present and non-empty when `deliveryStatus === "rejected"`, and absent otherwise.
- `ToolCallChatMessage.toolCallId` uniquely identifies a tool call within the session (`status` is updated in place by transitions; the messages list stores the latest materialized status; history of status changes is preserved via `SystemChatMessage` entries when needed).
- `AgentChatMessage.isTurnComplete = false` entries MUST be superseded by a later entry with `isTurnComplete = true` carrying the same `turnId` (coalescing).

---

### 1.3 `ResolvedCapabilities`

The result of the hybrid capability discovery resolver (R1).

```ts
type ResolvedCapabilities =
  | {
      source: "agent";
      modes: ModeDescriptor[];
      models: ModelDescriptor[];
      acceptsFollowUp: boolean;
    }
  | {
      source: "catalog";
      modes: ModeDescriptor[];
      models: ModelDescriptor[];
      acceptsFollowUp: boolean;
    }
  | { source: "none" };

interface ModeDescriptor {
  /** Machine id (e.g. "code", "ask", "plan"). */
  id: string;
  /** UI label (e.g. "Code"). */
  displayName: string;
  /** Prefix prepended to each turn's first message to steer the agent. Optional. */
  promptPrefix?: string;
}

interface ModelDescriptor {
  id: string;
  displayName: string;
  /** How the model is communicated to the agent at session start. */
  invocation: "initial-prompt" | "cli-flag";
  /** Optional template (e.g. "--model {id}" for cli-flag). */
  invocationTemplate?: string;
}
```

**Validation rules**:

- `modes[].id` unique within the list; `models[].id` unique within the list.
- `acceptsFollowUp = false` MUST cause the input-bar to be disabled after the initial turn with a clear explanation (FR-003, FR-004).
- `source = "agent"` overrides `source = "catalog"` when both provide values (FR-011b).
- `source = "none"` MUST cause the mode and model selectors to be hidden (FR-011a).

---

### 1.4 `ExecutionTarget`

Discriminated union for where the agent actually runs.

```ts
type ExecutionTarget =
  | { kind: "local" }
  | { kind: "worktree"; worktreeId: string }
  | { kind: "cloud"; providerId: string; cloudSessionId: string };
```

**Validation rules**:

- `kind = "worktree"` requires a matching `WorktreeHandle.id === worktreeId` inside `AgentChatSession.worktree`.
- `kind = "cloud"` requires a matching `CloudLinkage` AND `source = "cloud"`.
- `ExecutionTarget` MUST NOT change mid-session once a turn has been produced (the transcript carries a `contextAtTurn.executionTarget` snapshot instead, FR-014). UI changes to the target selector therefore apply to the **next session**, not the current one.

---

### 1.5 `WorktreeHandle`

Metadata for a per-session git worktree (R3).

```ts
interface WorktreeHandle {
  /** UUIDv4 (not necessarily equal to sessionId, to allow future cross-session reuse though v1 = 1:1). */
  id: string;
  /** Absolute path, e.g. `<repoRoot>/.gatomia/worktrees/<session-id>/`. */
  absolutePath: string;
  /** Branch name, e.g. `gatomia/agent-chat/<session-id>`. */
  branchName: string;
  /** SHA of the commit the branch was created from. */
  baseCommitSha: string;
  /** Lifecycle of the worktree itself (independent of the session). */
  status: "created" | "in-use" | "abandoned" | "cleaned";
  createdAt: number;
  cleanedAt?: number;
}
```

**Validation rules**:

- `absolutePath` MUST live under `<repoRoot>/.gatomia/worktrees/` for v1.
- `branchName` MUST match `^gatomia/agent-chat/[0-9a-f-]{36}$` (UUIDv4 pattern after the prefix).
- Once `status = "cleaned"`, `cleanedAt` is set and the worktree MUST be absent from disk; the handle remains in session metadata for audit.

---

### 1.6 `CloudLinkage`

Link from an `AgentChatSession` (source = "cloud") to the spec 016 `AgentSession`.

```ts
interface CloudLinkage {
  /** Provider id from spec 016 registry (e.g. "devin", "github-copilot-coding-agent"). */
  providerId: string;
  /** spec 016 AgentSession.localId. */
  cloudSessionLocalId: string;
  /** Provider-external URL (e.g. Devin session URL, GitHub issue URL). */
  externalUrl?: string;
}
```

**Validation rules**:

- `providerId` MUST be registered in spec 016's `ProviderRegistry`.
- `cloudSessionLocalId` MUST correspond to a row in `AgentSessionStorage`.

---

### 1.7 `SessionTrigger`

Where the session came from.

```ts
type SessionTrigger =
  | { kind: "user" }
  | { kind: "hook"; hookId: string; executionId: string }
  | { kind: "command"; commandId: string }
  | { kind: "spec-task"; specId: string; taskId: string }
  | { kind: "restore-from-persistence" };
```

No validation rules beyond type safety.

---

### 1.8 `AgentChatEvent`

The event stream between the runner (ACP or cloud) and the panel/store. **Not persisted**; persistence is message-based (see §1.2).

```ts
type AgentChatEvent =
  | { type: "session/started"; sessionId: string; at: number }
  | { type: "message/user-submitted"; sessionId: string; message: UserChatMessage }
  | { type: "message/agent-chunk"; sessionId: string; turnId: string; textDelta: string; at: number }
  | { type: "message/agent-turn-finished"; sessionId: string; turnId: string; stopReason: string; at: number }
  | { type: "tool/call-started"; sessionId: string; toolCallId: string; title?: string; at: number }
  | { type: "tool/call-updated"; sessionId: string; toolCallId: string; status: ToolCallChatMessage["status"]; at: number }
  | { type: "lifecycle/transitioned"; sessionId: string; from: SessionLifecycleState; to: SessionLifecycleState; at: number }
  | { type: "error"; sessionId: string; category: ErrorChatMessage["category"]; message: string; retryable: boolean; at: number };
```

**Consumers**:

- `AgentChatPanel` (webview): maps to React state via `use-session-bridge.ts`.
- `AgentChatSessionStore`: coalesces streaming agent chunks into `AgentChatMessage` rows, then persists.
- `AgentChatRegistry`: updates lifecycle state and emits to the running-agents tree.

---

## 2. Session lifecycle (state machine)

```text
                             ┌──────────────┐
        create ───────────▶  │  initializing│
                             └──────┬───────┘
                                    │ ready to run
                                    ▼
                             ┌──────────────┐   cancel()       ┌───────────┐
                             │    running   │ ───────────────▶ │ cancelled │◀─ terminal
                             └──┬────────┬──┘                  └───────────┘
               agent awaits input│        │ agent completes
                                 ▼        ▼
                   ┌──────────────────┐  ┌─────────────┐
                   │waiting-for-input │  │  completed  │ ◀─ terminal
                   └────┬─────────────┘  └─────────────┘
           user sends   │
                        ▼
                   (back to running)
                                        ┌──────────────────┐
         error from runtime ───────────▶│     failed       │ ◀─ terminal
                                        └──────────────────┘
         VS Code shutdown while running ─┐
                                         ▼
                                ┌──────────────────┐
                                │ ended-by-shutdown│ ◀─ terminal (ACP only)
                                └──────────────────┘
```

```ts
type SessionLifecycleState =
  | "initializing"
  | "running"
  | "waiting-for-input"
  | "completed"
  | "failed"
  | "cancelled"
  | "ended-by-shutdown";

const TERMINAL_STATES = new Set<SessionLifecycleState>([
  "completed",
  "failed",
  "cancelled",
  "ended-by-shutdown",
]);
```

**Rules**:

- Transitions MUST emit a `lifecycle/transitioned` event so the tree view and panel stay in sync.
- `ended-by-shutdown` is entered only during deactivation (`extension.deactivate`) for ACP sessions not already in a terminal state. Cloud sessions MUST NOT transition to `ended-by-shutdown`; they remain in their last-known state and re-attach via spec 016 on next launch.
- Terminal states are absorbing: once entered, no further transitions. A new run of "the same" task is a **new session** (new `id`), per research R9.

---

## 3. Persistence model

### 3.1 Storage layout (`workspaceState` keys)

| Key | Shape | Purpose |
|-----|-------|---------|
| `gatomia.agentChat.sessions.index` | `{ schemaVersion: 1; sessions: SessionManifestEntry[] }` | Lightweight manifest, drives the running-agents tree |
| `gatomia.agentChat.sessions.transcript.<session-id>` | `{ schemaVersion: 1; messages: ChatMessage[] }` | Full transcript for one session |
| `gatomia.agentChat.worktreesOrphaned` | `{ schemaVersion: 1; orphans: OrphanedWorktree[] }` | Worktrees that outlived their session manifest entry |
| `gatomia.agentChat.settings` | `{ schemaVersion: 1; autoOpenPanelOnNewSession: boolean; maxConcurrentAcpSessions: number }` | User-tweakable settings cache |

```ts
interface SessionManifestEntry {
  id: string;
  source: "acp" | "cloud";
  agentId: string;
  agentDisplayName: string;
  lifecycleState: SessionLifecycleState;
  executionTargetKind: "local" | "worktree" | "cloud";
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
  /** True when the transcript is archived to disk (see R4). */
  transcriptArchived: boolean;
  /** Present when executionTarget.kind === "worktree". */
  worktreePath?: string;
  /** Present when source = "cloud". */
  cloudSessionLocalId?: string;
}

interface OrphanedWorktree {
  sessionId: string;
  absolutePath: string;
  branchName: string;
  cleanedAt?: number;
}
```

### 3.2 Archival (R4)

When a transcript exceeds 10,000 messages or ~2 MB JSON:

1. The oldest 25% of messages are written to `<globalStorage>/agent-chat/<session-id>/transcript-<epoch>.jsonl` (append-only JSON Lines).
2. Those messages are removed from the `workspaceState` transcript entry.
3. A `SystemChatMessage` with `kind = "restored-from-persistence"` content (marker) is inserted as the new message 0 referencing the archive file.
4. The manifest's `transcriptArchived` flag is set to `true`.
5. Panel reopen lazy-loads archives on demand via the panel ↔ extension bridge (`agent-chat/transcript-archive/request` message).

### 3.3 Retention

- Manifest cap: **100 sessions** per workspace. Oldest beyond that are evicted from the manifest AND their transcript keys are deleted.
- Orphaned worktrees (whose session was evicted but whose worktree still exists on disk) are migrated into `gatomia.agentChat.worktreesOrphaned` so the user can still find and clean them.
- Archive files older than 30 days are purged by `session-cleanup-service.ts` (reusing the spec 016 cleanup cadence).

### 3.4 Restart behavior (FR-019a/b/c)

On `extension.activate`:

1. Load `sessions.index`.
2. For each entry with `source = "acp"` and non-terminal `lifecycleState`, transition to `ended-by-shutdown`, append a `SystemChatMessage { kind: "ended-by-shutdown" }` to the transcript, and persist.
3. For each entry with `source = "cloud"` and non-terminal `lifecycleState`, call `cloud-chat-adapter.attach(localId)` to resume polling-driven updates.
4. For each entry with `executionTarget.kind === "worktree"` AND the worktree path exists on disk, verify `git worktree list` includes it; if not, emit a `SystemChatMessage { kind: "worktree-cleaned" }` (self-repair).
5. Register all sessions in the in-memory `AgentChatRegistry`.
6. Refresh the running-agents tree view.

On `extension.deactivate`:

1. For each non-terminal `acp` session, synchronously persist the transition to `ended-by-shutdown`.
2. For each non-terminal `cloud` session, persist the current state but do NOT transition (spec 016 polling will refresh on next launch).
3. Dispose all `AcpClient` subprocesses (existing behavior preserved).

---

## 4. Entity relationships

```text
AgentChatSession (1) ────── (n) ChatMessage
AgentChatSession (1) ───── (0..1) WorktreeHandle
AgentChatSession (1) ───── (0..1) CloudLinkage ─── (1) spec016.AgentSession
AgentChatSession (1) ───── (1) ResolvedCapabilities
AgentChatSession (1) ───── (1) SessionTrigger
AgentChatRegistry (1) ───── (n) AgentChatSession   (active + recent)
AgentChatSessionStore (1) ───── (n) AgentChatSession  (persisted manifest + transcripts)
AgentChatPanel (0..1 per session) ────── (1) AgentChatSession
AgentChatRunner (ACPChatRunner | CloudChatAdapter) (1 per session) ────── (1) AgentChatSession
```

Tree-view entries in the Running Agents view map 1:1 to `SessionManifestEntry` rows.

---

## 5. Invariants

1. **One panel per session**: the `AgentChatRegistry` holds a `Map<sessionId, WebviewPanel>`. Opening a session whose panel exists focuses the existing panel (FR-008).
2. **One runner per session**: a session has at most one active runner (`AcpChatRunner` or `CloudChatAdapter`). The registry is the single source of truth.
3. **Transcripts are append-only** within a session: `sequence` is monotonic and never re-used.
4. **Worktree liveness is independent of session state**: a session can be `completed` while its worktree is still `in-use` (pending user cleanup). This is the expected behavior per FR-015a.
5. **Cloud sessions do not own subprocesses**: cancelling a cloud session routes through spec 016's adapter; no local process is killed.
6. **Mode/model changes are next-turn-scoped**: changing `selectedModeId` or `selectedModelId` takes effect on the next user message, not retroactively. The change is recorded as a `SystemChatMessage { kind: "mode-changed" | "model-changed" }` so the transcript stays truthful (FR-014).

---

## 6. Validation at boundaries

- `AgentChatSessionStore.save(session)` validates invariants 1–6 and throws with a structured error on violation; tests cover each invariant in `tests/unit/features/agent-chat/agent-chat-session-store.test.ts`.
- `AgentCapabilitiesService.resolve(agentId)` returns `ResolvedCapabilities` with the discriminated-union source and never throws for a missing agent (returns `{ source: "none" }`).
- `AgentWorktreeService.create(sessionId)` performs all disk and git operations atomically or rolls back; partial worktree creation MUST NOT leave orphans.
- `AcpChatRunner.submit(userMessage)` validates follow-up acceptance via `capabilities.acceptsFollowUp` and the current lifecycle state before forwarding to `AcpClient.sendPrompt`.

---

## 7. Open schema evolution hooks

- `schemaVersion: 1` is set on every persisted key. A future schema v2 will carry a migration function in `agent-chat-session-store.ts` with tests for each upgrade path.
- `ResolvedCapabilities` is already extensible via the discriminated `source` tag; adding `"user-configured"` in a later spec is non-breaking.
- `SessionTrigger` is extensible by adding new discriminants; readers MUST default-branch defensively.
