# Contract: Agent Chat Panel ↔ Webview Message Protocol

**Feature**: `018-agent-chat-panel`
**Status**: Frozen for v1
**Consumers**: `src/panels/agent-chat-panel.ts` (extension side), `ui/src/features/agent-chat/` (webview side)

This contract defines every message that crosses the VS Code webview postMessage bridge for the Interactive Agent Chat Panel. Types are authoritative; all messages MUST round-trip as JSON.

---

## 1. Transport

- Extension → webview: `panel.webview.postMessage(msg)`.
- Webview → extension: `vscode.postMessage(msg)` via the bridge already used by other panels (e.g. `ui/src/bridge/vscode.ts`).
- Every message MUST carry a `type` discriminator of the form `agent-chat/<domain>/<action>`.
- Messages MUST NOT be batched; one message = one logical event. Coalescing for high-throughput streams happens **inside** a single message payload (see §3.3).
- Unknown message types MUST be logged but MUST NOT crash either side (defensive defaulting).

---

## 2. Message envelope

```ts
interface ProtocolMessage<T extends string, P> {
  type: T;
  /** Correlation id for request/response pairs. Optional for one-way notifications. */
  requestId?: string;
  /** Payload. Shape depends on `type`. */
  payload: P;
}
```

- `requestId` is mandatory for request messages and MUST be echoed back on the matching response.
- Notifications (no response expected) MAY omit `requestId`.

---

## 3. Extension → Webview messages

### 3.1 `agent-chat/session/loaded`

Sent when the panel first opens or is focused, to hydrate the webview with the full session state.

```ts
interface SessionLoadedPayload {
  session: AgentChatSessionView;        // read-only projection of AgentChatSession
  messages: ChatMessage[];              // full transcript at open time (or head-window after archive)
  availableModes: ModeDescriptor[];     // [] when mode selector should be hidden
  availableModels: ModelDescriptor[];   // [] when model selector should be hidden
  availableTargets: ExecutionTargetOption[]; // always at least one entry
  hasArchivedTranscript: boolean;       // true if older messages are on disk
}

interface AgentChatSessionView {
  id: string;
  source: "acp" | "cloud";
  agentDisplayName: string;
  selectedModeId?: string;
  selectedModelId?: string;
  executionTarget: ExecutionTargetView;
  lifecycleState: SessionLifecycleState;
  acceptsFollowUp: boolean;
  isReadOnly: boolean;                  // true for cloud sessions (FR-003)
  worktree?: { path: string; branch: string; status: "created" | "in-use" | "abandoned" | "cleaned" };
  cloud?: { providerId: string; providerDisplayName: string; externalUrl?: string };
}

interface ExecutionTargetView {
  kind: "local" | "worktree" | "cloud";
  label: string;
}

interface ExecutionTargetOption {
  kind: "local" | "worktree" | "cloud";
  label: string;
  enabled: boolean;
  /** Present when enabled = false; explains why (e.g. "no cloud provider configured"). */
  disabledReason?: string;
}
```

### 3.2 `agent-chat/session/lifecycle-changed`

Sent on every `SessionLifecycleState` transition.

```ts
interface LifecycleChangedPayload {
  sessionId: string;
  from: SessionLifecycleState;
  to: SessionLifecycleState;
  at: number;
  /** If the new state is terminal, a short human-readable reason. */
  reason?: string;
}
```

### 3.3 `agent-chat/messages/appended`

Sent when one or more new `ChatMessage` entries have been added. Batches are ALLOWED here to keep up with ACP chunk bursts.

```ts
interface MessagesAppendedPayload {
  sessionId: string;
  messages: ChatMessage[];   // already coalesced by the extension (see data-model §1.2)
}
```

### 3.4 `agent-chat/messages/updated`

Sent when existing messages are updated in place (e.g. tool call status transitions, agent turn finalization).

```ts
interface MessagesUpdatedPayload {
  sessionId: string;
  updates: Array<{
    id: string;              // existing message id
    patch: Partial<ChatMessage>;
  }>;
}
```

### 3.5 `agent-chat/capabilities/changed`

Sent when capability discovery re-runs (rare; e.g. user switched catalog entry, or agent reported new capabilities mid-session).

```ts
interface CapabilitiesChangedPayload {
  sessionId: string;
  availableModes: ModeDescriptor[];
  availableModels: ModelDescriptor[];
  acceptsFollowUp: boolean;
}
```

### 3.6 `agent-chat/worktree/status`

Sent when the worktree state changes (created, in-use → abandoned, cleaned).

```ts
interface WorktreeStatusPayload {
  sessionId: string;
  worktree:
    | { status: "created" | "in-use" | "abandoned"; path: string; branch: string }
    | { status: "cleaned"; at: number };
}
```

### 3.7 `agent-chat/transcript-archive/chunk`

Response to `agent-chat/transcript-archive/request`. Streams archived messages in paged chunks.

```ts
interface ArchiveChunkPayload {
  sessionId: string;
  requestId: string;
  offset: number;           // position within the archive
  messages: ChatMessage[];
  hasMore: boolean;
}
```

### 3.8 `agent-chat/error`

Sent when the extension needs to surface an error to the UI that is NOT tied to a specific message (e.g. panel-level permission issue).

```ts
interface ErrorPayload {
  sessionId?: string;       // absent for panel-level errors
  category: ErrorChatMessage["category"] | "panel";
  message: string;
  retryable: boolean;
}
```

---

## 4. Webview → Extension messages

### 4.1 `agent-chat/ready`

Sent once after the webview mounts. Triggers the extension to send `agent-chat/session/loaded`.

```ts
interface ReadyPayload {
  sessionId: string;
}
```

### 4.2 `agent-chat/input/submit`

User submitted a follow-up message.

```ts
interface InputSubmitPayload {
  sessionId: string;
  content: string;
  /** Optional client-generated UUIDv4. Extension echoes it back in the `messages/appended` message so the
   *  webview can correlate its optimistic render with the canonical message id. */
  clientMessageId?: string;
}
```

**Extension flow** (resolves spec Edge Case "queued/delivered/rejected"):

1. Extension receives `agent-chat/input/submit`.
2. Extension MUST append a `UserChatMessage` to the transcript with `deliveryStatus = "pending"` and emit `agent-chat/messages/appended` so the message is visible immediately (optimistic render).
3. Extension routes the message based on session state:
   - **Rejected** — session is cloud (read-only), in a terminal state, or the agent has `acceptsFollowUp = false` after its initial turn. Extension emits `agent-chat/messages/updated` with `{ id, patch: { deliveryStatus: "rejected", rejectionReason } }` and does NOT invoke the agent.
   - **Queued** — session is ACP and currently mid-turn (`lifecycleState = "running"` with an in-flight turn). Extension emits `agent-chat/messages/updated` with `{ id, patch: { deliveryStatus: "queued" } }` and holds the message until the current turn finishes. On turn-finished, the extension forwards it via `AcpClient.sendPrompt`, then emits another `agent-chat/messages/updated` with `{ id, patch: { deliveryStatus: "delivered" } }` followed by the streamed agent output.
   - **Delivered immediately** — session is ACP and `lifecycleState = "waiting-for-input"`. Extension forwards to `AcpClient.sendPrompt` right away and emits `agent-chat/messages/updated` with `{ id, patch: { deliveryStatus: "delivered" } }`, then streams the agent output as `agent-chat/messages/appended`.
4. The extension MUST decide status transitions; the webview MUST NOT pre-empt (it only renders what it is told).

**At-most-one-in-flight**: the extension MUST NOT keep more than one follow-up in `"queued"` state per session. A second follow-up submitted while one is already queued MUST be `rejected` with reason "A follow-up is already queued. Wait for the current turn to complete before sending another." This keeps the UX predictable and matches the single-prompt-per-turn semantics of ACP.

### 4.3 `agent-chat/control/cancel`

User clicked cancel.

```ts
interface CancelPayload {
  sessionId: string;
}
```

**Applies to**: both ACP and Cloud sessions (FR-018).

### 4.4 `agent-chat/control/change-mode`

User picked a new mode. Takes effect on the next turn (data-model §5 invariant 6).

```ts
interface ChangeModePayload {
  sessionId: string;
  modeId: string;
}
```

### 4.5 `agent-chat/control/change-model`

User picked a new model. Takes effect on the next turn.

```ts
interface ChangeModelPayload {
  sessionId: string;
  modelId: string;
}
```

### 4.6 `agent-chat/control/change-target`

User picked a new execution target. Takes effect on the **next session**; the current session's target is immutable once a turn has been produced (data-model §1.4).

```ts
interface ChangeTargetPayload {
  sessionId: string;
  target: ExecutionTarget;
}
```

The extension replies with `agent-chat/error` if the session already has a produced turn; otherwise replies with a `agent-chat/session/loaded` reflecting the new target.

### 4.7 `agent-chat/control/cleanup-worktree`

User invoked the "Clean up worktree" action.

```ts
interface CleanupWorktreePayload {
  sessionId: string;
  /** True when the user has already been warned about uncommitted changes / unpushed commits and confirmed. */
  confirmedDestructive: boolean;
}
```

**Extension flow** (research R3):

1. If `confirmedDestructive = false`, inspect the worktree for uncommitted/unpushed changes.
2. If changes exist, respond with `agent-chat/worktree/cleanup-warning` (see §3 below, via the generic request/response below) and do nothing else.
3. If no changes OR `confirmedDestructive = true`, remove the worktree and emit `agent-chat/worktree/status { status: "cleaned" }`.

### 4.8 `agent-chat/control/retry`

User clicked retry on a failed session (FR-020, R9).

```ts
interface RetryPayload {
  sessionId: string;
}
```

Extension allocates a **new** session id (see research R9) and notifies the panel via a new `agent-chat/session/loaded` targeted at the new session id; the failed session remains in the manifest unchanged.

### 4.9 `agent-chat/control/open-external`

User clicked "Open in provider" (Cloud only).

```ts
interface OpenExternalPayload {
  sessionId: string;
  /** Extension resolves to the actual URL from CloudLinkage; the webview does not pass URLs directly to avoid open-url abuse. */
}
```

### 4.10 `agent-chat/transcript-archive/request`

Webview requests a page of archived messages when the user scrolls past the archive marker.

```ts
interface ArchiveRequestPayload {
  sessionId: string;
  offset: number;
  limit: number;
}
```

**Extension response**: `agent-chat/transcript-archive/chunk`.

---

## 5. Synchronous responses (generic request/response)

For messages that expect a single structured reply, the extension emits a message of the same `requestId` with a `type` of `agent-chat/<domain>/response`. Example:

- Request: `{ type: "agent-chat/control/cleanup-worktree", requestId: "r-42", payload: {...} }`
- Response: `{ type: "agent-chat/control/cleanup-worktree/response", requestId: "r-42", payload: { ok: boolean, warning?: WorktreeCleanupWarning, error?: string } }`

```ts
interface WorktreeCleanupWarning {
  uncommittedPaths: string[];
  unpushedCommits: number;
}
```

Webviews MUST NOT time out waiting for responses beyond 10 seconds for synchronous operations; longer-running operations MUST emit progress via notifications instead.

---

## 6. Versioning

- This contract is **v1**. All messages MAY carry an optional top-level `protocolVersion: 1` field in the payload when the bridge is upgraded; readers MUST reject messages whose `protocolVersion` is newer than they support with a single warning log.
- Adding new `type` discriminants is **non-breaking** as long as readers default-branch gracefully.
- Removing or renaming any existing `type` is **breaking** and requires a protocol-version bump with a migration test.

---

## 7. Test coverage (TDD)

The following cases MUST be red-test-first per Constitution III before implementation:

- `agent-chat/ready` → hydration message is emitted with the correct session view and transcript (including `hasArchivedTranscript` flag).
- `agent-chat/input/submit` on a cloud (read-only) session → `UserChatMessage` appended with `deliveryStatus: "pending"`, then immediately patched to `"rejected"` with `rejectionReason` set; agent NOT invoked.
- `agent-chat/input/submit` on an ACP session with `acceptsFollowUp: false` (after first turn) → `rejected` with `rejectionReason` set; agent NOT invoked.
- `agent-chat/input/submit` while the agent is mid-turn → patched to `"queued"`; on turn-finished, patched to `"delivered"`; agent then invoked.
- `agent-chat/input/submit` while another follow-up is already `"queued"` → second submission is `rejected` with the "already queued" reason.
- `agent-chat/input/submit` on a session in `"waiting-for-input"` → patched straight to `"delivered"`; agent invoked synchronously.
- `agent-chat/messages/appended` during a chunk burst → webview coalesces without losing messages.
- `agent-chat/control/change-target` on a session with a produced turn → rejected via error message.
- `agent-chat/control/cleanup-worktree` with pending changes → two-step flow: first reply has warning, second reply (with `confirmedDestructive = true`) cleans.
- `agent-chat/transcript-archive/request` returns in paged chunks with `hasMore` correctly terminating.

Contract tests live under `tests/unit/panels/agent-chat-panel.test.ts` (extension-side) and `tests/unit/webview/agent-chat/use-session-bridge.test.ts` (webview-side).
