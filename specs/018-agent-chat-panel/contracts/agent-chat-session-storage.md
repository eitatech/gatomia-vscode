# Contract: Agent Chat Session Storage

**Feature**: `018-agent-chat-panel`
**Status**: Frozen for v1
**Consumers**: `src/features/agent-chat/agent-chat-session-store.ts`, `src/features/agent-chat/agent-chat-registry.ts`
**References**: spec FR-005, FR-019a/b/c; research.md §R4, §R6; data-model.md §3

This contract defines the persisted session manifest, transcript storage, archival, and restart-restore semantics for the chat panel.

---

## 1. Storage surface

All persisted state lives in VS Code `workspaceState` (per-workspace, per-extension) with the following keys:

| Key | Type | Purpose |
|-----|------|---------|
| `gatomia.agentChat.sessions.index` | `SessionManifest` | Lightweight per-session metadata |
| `gatomia.agentChat.sessions.transcript.<session-id>` | `TranscriptFile` | Full (or head-window) transcript for one session |
| `gatomia.agentChat.worktreesOrphaned` | `OrphanedWorktreeList` | Worktrees whose session was evicted from the manifest |
| `gatomia.agentChat.settings` | `AgentChatSettings` | User settings cache |

Archived transcript pages live on disk under `<globalStorageUri>/agent-chat/<session-id>/transcript-<epoch>.jsonl`.

---

## 2. Schemas

### 2.1 SessionManifest

```ts
interface SessionManifest {
  schemaVersion: 1;
  sessions: SessionManifestEntry[];
  /** ISO timestamp of last write. */
  updatedAt: number;
}

interface SessionManifestEntry {
  id: string;                              // UUIDv4
  source: "acp" | "cloud";
  agentId: string;
  agentDisplayName: string;
  lifecycleState: SessionLifecycleState;
  executionTargetKind: "local" | "worktree" | "cloud";
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
  transcriptArchived: boolean;
  worktreePath?: string;
  cloudSessionLocalId?: string;
}
```

**Invariants**:

- `sessions` is ordered by `updatedAt` descending (most-recent first).
- `sessions.length ≤ 100` (manifest retention cap, research R4).
- When an entry is removed from `sessions`, its `transcript.<session-id>` key MUST be deleted in the same atomic batch.

### 2.2 TranscriptFile

```ts
interface TranscriptFile {
  schemaVersion: 1;
  sessionId: string;
  /** Messages in ascending sequence order. */
  messages: ChatMessage[];
  /** When true, older messages have been archived to disk and removed from this file. */
  hasArchive: boolean;
  /** Latest archive file name (relative to <globalStorage>/agent-chat/<session-id>/). */
  latestArchiveFile?: string;
  updatedAt: number;
}
```

**Invariants**:

- `messages` sequence numbers are strictly monotonic starting from the earliest kept message.
- `messages.length ≤ 10000` AND `JSON.stringify(messages).length ≤ ~2 MB` (archival thresholds, research R4).
- When either threshold is hit, archival MUST run before the next `save()` returns.

### 2.3 Archive file (on-disk JSONL)

Each archive file is append-only, one JSON object per line, encoded UTF-8.

```text
{"id":"<uuid>","sessionId":"<uuid>","sequence":0,"timestamp":1745...,"role":"user","content":"..."}
{"id":"<uuid>","sessionId":"<uuid>","sequence":1,"timestamp":1745...,"role":"agent",...}
```

Multiple archive files per session are allowed (rotation at ~5 MB). File naming pattern: `transcript-<epochMs>.jsonl`.

### 2.4 OrphanedWorktreeList

```ts
interface OrphanedWorktreeList {
  schemaVersion: 1;
  orphans: Array<{
    sessionId: string;                   // the now-evicted session
    absolutePath: string;
    branchName: string;
    recordedAt: number;
    cleanedAt?: number;                  // set when user runs cleanup on the orphan
  }>;
}
```

Orphans are surfaced in the Running Agents tree under a dedicated "Orphaned worktrees" group so the user can clean them up even after their original session is gone (research R4, FR-015a).

### 2.5 AgentChatSettings

```ts
interface AgentChatSettings {
  schemaVersion: 1;
  autoOpenPanelOnNewSession: boolean;    // default: true
  maxConcurrentAcpSessions: number;      // default: 5 (research R5)
}
```

Defaults are applied when the key is missing. User changes are persisted immediately.

---

## 3. Public API

```ts
interface AgentChatSessionStore {
  /** Load manifest + lazy-load transcripts on demand. Called at activation. */
  initialize(): Promise<void>;

  /** Create a new session, persist manifest + empty transcript atomically. */
  createSession(input: CreateSessionInput): Promise<AgentChatSession>;

  /** Append messages to a session's transcript; coalesce + archive as needed. */
  appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;

  /** Replace messages in place (for tool-call status updates, etc.). */
  updateMessages(sessionId: string, updates: Array<{ id: string; patch: Partial<ChatMessage> }>): Promise<void>;

  /** Update manifest entry fields (lifecycleState, endedAt, worktree status). */
  updateSession(sessionId: string, patch: Partial<AgentChatSession>): Promise<void>;

  /** Delete session from manifest AND transcript; worktree reference, if any, migrates to the orphan list. */
  deleteSession(sessionId: string): Promise<void>;

  /** Read a page of archived messages from disk. */
  readArchive(sessionId: string, offset: number, limit: number): Promise<ChatMessage[]>;

  /** All non-terminal sessions for on-activation restore. */
  listNonTerminal(): Promise<AgentChatSession[]>;

  /**
   * Flush pending writes and stamp `ended-by-shutdown` on non-terminal ACP sessions.
   * Called from `extension.deactivate`. Returns a Promise that MUST be awaited by
   * `deactivate`'s own return value so VS Code honors it (see VS Code Extension API:
   * https://code.visualstudio.com/api/references/vscode-api#extensions).
   *
   * Contract:
   *   - Issues exactly ONE `workspaceState.update("gatomia.agentChat.sessions.index", ...)` call
   *     containing the final manifest with the stamped `ended-by-shutdown` entries.
   *   - Resolves after that single update settles, or rejects with the underlying error.
   *   - Does NOT write per-session transcript keys (those are already up-to-date from
   *     prior `appendMessages`/`updateMessages` calls).
   *   - Does NOT rely on microtask batching — it awaits the single update directly.
   *
   * Rationale: VS Code imposes a short timeout on `deactivate` (platform-dependent,
   * typically a few seconds). A single atomic `workspaceState.update` comfortably
   * fits within that window even for large manifests (<1 MB). Multiple key writes
   * during deactivate risk partial persistence if the timeout fires mid-batch; this
   * contract keeps the flush down to one atomic write.
   */
  flushForDeactivation(): Promise<void>;

  /** Event emitted when the manifest changes (tree view subscribes). */
  readonly onDidChangeManifest: vscode.Event<SessionManifest>;
}

interface CreateSessionInput {
  source: "acp" | "cloud";
  agentId: string;
  agentDisplayName: string;
  capabilities: ResolvedCapabilities;
  selectedModeId?: string;
  selectedModelId?: string;
  executionTarget: ExecutionTarget;
  trigger: SessionTrigger;
  worktree: WorktreeHandle | null;
  cloud: CloudLinkage | null;
}
```

All write operations MUST be **atomic** from the VS Code API's perspective (single `update()` call per key). Batching across keys uses an in-memory queue flushed at the end of the microtask so tree-view subscribers see a consistent state.

---

## 4. Archival algorithm

```text
appendMessages(sessionId, newMessages):

1. file := load transcript.<sessionId>                    // or empty if absent
2. file.messages.push(...newMessages)
3. if file.messages.length > 10000 OR JSON size > 2 MB:
     a. pivot := file.messages.length * 0.25                   // oldest quarter
     b. chunk := file.messages.slice(0, pivot)
     c. archivePath := `${globalStorage}/agent-chat/${sessionId}/transcript-${now}.jsonl`
     d. append chunk as JSONL to archivePath                    // atomic append-or-create
     e. file.messages = file.messages.slice(pivot)              // keep newest 75%
     f. file.messages.unshift(archiveMarkerSystemMessage(archivePath))
     g. file.hasArchive = true
     h. file.latestArchiveFile = relative(archivePath)
     i. manifest.entry.transcriptArchived = true
4. persist file + manifest in one batch
```

Archive markers are regular `SystemChatMessage` entries with `kind = "restored-from-persistence"` and a content string pointing to the archive file for the UI to render a "Load earlier messages" affordance.

---

## 5. Retention & eviction

On every manifest write:

1. If `manifest.sessions.length > 100`, evict the oldest entries until length == 100.
2. For each evicted entry:
   - Delete `transcript.<id>` from `workspaceState`.
   - If the entry had `worktreePath` and that worktree still exists on disk, copy it into `worktreesOrphaned`.
   - Do **not** delete on-disk archive files here — they are reaped by `session-cleanup-service.ts` 30 days after the session's `endedAt`.

---

## 6. Restart behavior (FR-019a/b/c)

### 6.1 On activation

```text
1. manifest := load gatomia.agentChat.sessions.index
2. for each entry in manifest.sessions where lifecycleState NOT in TERMINAL_STATES:
     if entry.source == "acp":
       entry.lifecycleState = "ended-by-shutdown"
       entry.endedAt = entry.endedAt ?? now()
       transcript := load transcript.<entry.id>
       tail := transcript.messages[transcript.messages.length - 1]
       if NOT (tail?.role == "system" AND tail.kind == "ended-by-shutdown"):
         // Idempotent append: only write the shutdown marker if it isn't already the tail.
         // This covers the case where a previous deactivation stamped the manifest but
         // crashed before (or instead of) the expected next-activation append.
         appendMessage(entry.id, SystemChatMessage { kind: "ended-by-shutdown", ... })
     else if entry.source == "cloud":
       cloud-chat-adapter.attach(entry.cloudSessionLocalId)   // no state change; polling drives updates
3. for each entry with executionTargetKind == "worktree":
     if NOT fs.exists(entry.worktreePath):
       appendMessage(entry.id, SystemChatMessage { kind: "worktree-cleaned", ... })  // self-repair
4. persist manifest in one batch
5. register all sessions in AgentChatRegistry
6. fire onDidChangeManifest
```

### 6.2 On deactivation

VS Code's `ExtensionActivate` contract allows `deactivate()` to return a `Promise<void>`. VS Code will await that promise up to its platform-specific deactivation timeout (typically a few seconds) before force-terminating the extension host. `flushForDeactivation()` is designed to comfortably fit inside that window.

```text
1. manifest := current in-memory manifest
2. for each entry in manifest.sessions where source == "acp" AND lifecycleState NOT in TERMINAL_STATES:
     entry.lifecycleState = "ended-by-shutdown"
     entry.endedAt = now()
     // The corresponding SystemChatMessage is written on next activation (step 6.1)
     //   because we cannot reliably perform async I/O during dispose.
3. await workspaceState.update("gatomia.agentChat.sessions.index", manifest)
     - This is the ONLY `workspaceState.update` call issued during deactivation.
     - `workspaceState.update` is atomic per key: it either fully commits or does not
       commit at all — partial writes of a single key are impossible by VS Code's
       contract. So even if the deactivate timeout fires, persisted state is never
       inconsistent.
4. dispose all AcpClient subprocesses (existing behavior)
5. deactivate() returns the awaited promise to VS Code
```

**Rationale**:

- Exactly **one** `workspaceState.update` call is issued, so the platform deactivate
  timeout (seconds) is never a race between multiple key writes.
- The `ended-by-shutdown` `SystemChatMessage` is intentionally deferred to the next
  activation (step 6.1) so we don't issue a second write during deactivate. The
  activation-time write is idempotent: step 6.1 checks whether the message is already
  the tail message for the session before appending.
- If VS Code terminates before the promise resolves, the previously-persisted manifest
  remains intact (atomic-per-key guarantee). The next activation will still see the
  session as non-terminal and will transition it to `ended-by-shutdown` via the normal
  restore path, giving us a safety net for the extreme case.

---

## 7. Concurrency & consistency

- The store uses a single in-process mutex (simple async queue) so concurrent `appendMessages` calls for the same session serialize correctly.
- Writes across different sessions may interleave; the manifest is the only shared key and its updates are always `read-modify-write` within the mutex.
- The store is the **sole writer** of its keys; tests assert that no other module mutates them.

---

## 8. Versioning

- `schemaVersion: 1` is written on every key.
- Future schema v2 migrations live in `agent-chat-session-store.ts` with one migration function per (oldVersion → newVersion) edge. Migration MUST be non-destructive: the original key is copied to `<key>.v1.backup` before rewrite.
- Missing `schemaVersion` is treated as `1` (forward compatibility with the first release).

---

## 9. Test coverage (TDD)

- **Create → append → read**: append 3 messages; read back; sequence numbers 0, 1, 2.
- **Archival threshold by count**: append 10,001 messages; oldest 2,500 moved to on-disk archive; in-memory retains 7,500 + marker.
- **Archival threshold by size**: append 2.1 MB of messages; same pivoting behavior.
- **Retention**: create 101 sessions; manifest trims to 100; evicted session's transcript key is deleted; its worktree (if any) migrated to orphaned list.
- **Restart restore**:
  - An `acp` session in `running` state → reappears as `ended-by-shutdown` on next load with a `SystemChatMessage { kind: "ended-by-shutdown" }` at the tail.
  - A `cloud` session in `running` state → stays `running`; `cloud-chat-adapter.attach` is called exactly once.
  - A worktree-targeted session whose worktree path no longer exists → self-repair message appended.
- **Deactivation (happy path)**: `flushForDeactivation()` while a session is `running` → resolves after exactly one `workspaceState.update` on `sessions.index`; mocked `workspaceState.update` is invoked once and only once; on re-init the session state is `ended-by-shutdown` with consistent timestamps.
- **Deactivation (update rejection)**: simulate `workspaceState.update` rejecting (disk full, VS Code shutting down) → `flushForDeactivation()` rejects with the same error; test asserts no second write is attempted.
- **Deactivation (idempotent activation)**: a manifest that was already stamped `ended-by-shutdown` in a previous deactivation (e.g. VS Code crashed before step 6.1 could run) is loaded on activation → step 6.1 detects the tail `SystemChatMessage { kind: "ended-by-shutdown" }` is already present and does NOT append a duplicate.
- **Concurrency**: two concurrent `appendMessages(sessionId, ...)` calls interleave without lost writes or duplicate sequence numbers.
- **Settings**: missing `settings` key defaults to `{ autoOpenPanelOnNewSession: true, maxConcurrentAcpSessions: 5 }`.

Location: `tests/unit/features/agent-chat/agent-chat-session-store.test.ts`.
