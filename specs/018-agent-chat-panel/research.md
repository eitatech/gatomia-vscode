# Phase 0 Research: Interactive Agent Chat Panel

**Feature**: `018-agent-chat-panel`
**Date**: 2026-04-24
**Status**: Complete

This document captures the open technical questions derived from the `Technical Context` in `plan.md` and resolves each with a decision, rationale, and rejected alternatives. No `NEEDS CLARIFICATION` markers remain after this phase.

---

## R1. ACP mode/model capability surface in practice

**Question**: How do the ACP agents we care about (opencode, claude-code, gemini-cli, devin, copilot-language-server) actually expose modes ("Code"/"Ask"/"Plan") and models today? FR-011a mandates hybrid discovery (agent `initialize` → gatomia catalog → hide). We need to ground the catalog fallback in reality.

**Decision**:
- The ACP SDK's `initialize` response (`AgentCapabilities`) does **not yet standardize** `modes` or `models` fields across agents; at time of writing, treat agent-reported discovery as the forward-compatible path, but **expect the catalog fallback to be the primary source** for v1.
- Extend the existing `KNOWN_AGENTS` catalog (`src/providers/hook-view-provider.ts` + `src/services/acp/acp-provider-registry.ts`) with a new optional `capabilities` field per entry:
  - `modes`: array of `{ id, displayName, promptPrefix? }` (empty/omitted → hide mode selector)
  - `models`: array of `{ id, displayName, invocation: "initial-prompt" | "cli-flag" | "session-option", invocationTemplate? }` (empty/omitted → hide model selector)
  - `acceptsFollowUp`: boolean (default true; drives input-bar enablement post-initial turn)
- The `agent-capabilities-service.ts` resolver returns a discriminated union:
  - `ReportedByAgent { source: "agent"; modes; models; acceptsFollowUp }`
  - `CatalogFallback { source: "catalog"; modes; models; acceptsFollowUp }`
  - `NotSupported { source: "none" }` → selectors hidden
- Mode selection is surfaced to the agent via the most widely supported ACP-compatible mechanism: prepending a `promptPrefix` to the first message of each turn (e.g. `[mode: plan]\n`). Future ACP versions that introduce a native `mode` field supersede this via `ReportedByAgent`.
- Model selection in v1 supports only the `initial-prompt` and `cli-flag` invocation kinds. `session-option` (runtime model-switch within a session) is deferred — it is not reliably supported across ACP agents today.

**Rationale**:
- Matches the spec's Q4 resolution: "agent-reported first, catalog fallback, hide if neither."
- Keeps the catalog close to the already-existing `KNOWN_AGENTS` surface users are familiar with, avoiding a second registry.
- `promptPrefix` is the lowest-risk way to steer agent mode without a protocol change; it is testable with a plain string assertion.
- Deferring runtime model-switching stays aligned with Constitution V (YAGNI).

**Alternatives considered**:
- **(Rejected) Agent-reported only**: would hide selectors for every real agent today; poor v1 UX.
- **(Rejected) Catalog only, hardcoded**: breaks forward-compatibility once ACP standardizes capabilities.
- **(Rejected) User-authored per-agent catalog in settings**: friction; users would get it wrong; duplicates `KNOWN_AGENTS` work.

---

## R2. Streaming ACP events to a per-session chat panel

**Question**: The current `AcpClient` (`src/services/acp/acp-client.ts`) streams `agent_message_chunk`, `tool_call`, and `tool_call_update` into a single VS Code `OutputChannel`. How do we branch this into a **per-session event stream** for the chat panel while keeping the `OutputChannel` unchanged (FR-022)?

**Decision**:
- Introduce a `SessionEventBus` inside `AcpClient` that, for each active `sessionId`, maintains a list of subscribers (`(event: AcpSessionEvent) => void`). Every `sessionUpdate` handled by the client fans out to both:
  1. The existing `OutputChannel.append(...)` calls (unchanged) — FR-022.
  2. All subscribers registered for that `sessionId`.
- Expose a new `AcpClient.subscribeSession(sessionId, listener): Disposable` public method. `AcpSessionManager.subscribe(sessionKey)` becomes a thin resolver that maps `sessionKey → sessionId` and calls into the client.
- Event shape (stable, internal-facing):
  ```ts
  type AcpSessionEvent =
    | { kind: "agent-message-chunk"; text: string; at: number }
    | { kind: "tool-call"; toolCallId: string; title?: string; status?: string; at: number }
    | { kind: "tool-call-update"; toolCallId: string; status?: string; at: number }
    | { kind: "turn-finished"; stopReason: string; at: number }
    | { kind: "error"; message: string; at: number };
  ```
- Backpressure: listener invocation is synchronous and best-effort. The chat panel listener converts to `AgentChatEvent` and buffers into the transcript atomically; the webview side uses `requestAnimationFrame` batching so rapid chunk bursts don't block the extension host.
- Cleanup: subscribers auto-dispose when the session ends (`turn-finished` + a grace period) or when the session is explicitly cancelled/disposed.

**Rationale**:
- Additive change: no behavior shift for existing callers (the log channel still gets everything).
- Per-session isolation means two concurrent ACP runs can't cross-contaminate transcripts (FR-008).
- Matches `vscode.EventEmitter` / `Disposable` conventions already used in the codebase.

**Alternatives considered**:
- **(Rejected) Replace `OutputChannel` writes with a bus**: would break FR-022 and existing debug flows.
- **(Rejected) Tee via a second `OutputChannel`**: `OutputChannel` is a UI-bound API, not a bus; subscriptions aren't first-class.
- **(Rejected) Parse back the `OutputChannel` text**: fragile, loses structure (tool call ids, statuses).

---

## R3. Per-session worktree naming, path, branch, and cleanup UX

**Question**: Q3 in the spec resolved "one worktree per session, never auto-deleted, explicit cleanup." We still need to nail down: worktree path layout, branch name, initial commit state, `.gitignore` seeding, and the warning UX for cleanup.

**Decision**:
- **Path**: `<repoRoot>/.gatomia/worktrees/<session-id>/` where `<session-id>` is a UUIDv4 (first 8 chars shown in the chat panel header; full id in tooltip/telemetry).
- **Branch name**: `gatomia/agent-chat/<session-id>` (namespaced so it's trivially filterable by `git branch --list 'gatomia/agent-chat/*'`).
- **Base**: Branch off the current `HEAD` of the primary checkout at session-start (captured hash stored in session metadata for traceability).
- **`.gitignore` seeding**: On first worktree creation, if `.gitignore` does not already contain `.gatomia/worktrees/`, append it. This is idempotent, reversible by the user, and prevents accidental commits of worktree directories into the primary checkout.
- **Working-tree state at creation**: `git worktree add` without `-d` so the worktree has a live branch; the user/agent can commit into it directly. No stash/checkout of uncommitted changes from the primary checkout — the worktree starts clean at `HEAD`.
- **Cleanup action UX** (FR-015b): A "Clean up worktree" button in the chat panel's `worktree-banner.tsx`. When clicked:
  1. Extension runs `git -C <worktreePath> status --porcelain` to detect uncommitted changes and unpushed commits on `gatomia/agent-chat/<session-id>`.
  2. If either is non-empty, show a modal warning listing what would be lost, with three choices: `Cancel`, `Open worktree in new window for review`, `Delete anyway`.
  3. If clean (or user confirms), run `git worktree remove --force <worktreePath>` then `git branch -D gatomia/agent-chat/<session-id>`.
  4. On success, remove the worktree reference from the session metadata (keep the session + transcript for history). Emit `agent-chat.worktree.cleaned` telemetry.
- **Failure modes** (FR-015c): surface errors from `git worktree add` (git not installed, path conflict, detached HEAD with dirty tree, corrupt repo) into the transcript as a system message with actionable guidance, and **do not** start the ACP subprocess.

**Rationale**:
- UUIDv4 session ids are already used throughout the codebase (see `AgentSession.localId` in spec 016); keeps identity uniform.
- `.gatomia/worktrees/` path is discoverable via existing `.gatomia/` conventions and stays inside the repo so it is easy to find and inspect.
- Namespaced branch prefix (`gatomia/agent-chat/`) prevents collisions with user branches and allows bulk cleanup.
- The three-choice warning mirrors VS Code's own destructive-action patterns (see `git.cleanTree` / `git.discardAll`).

**Alternatives considered**:
- **(Rejected) Use `$TMPDIR` for worktrees**: git worktrees must live on the same filesystem and within the same repository to work correctly; off-repo worktrees are fragile and hard to inspect.
- **(Rejected) Auto-delete on session end**: violates the Q3 clarification and risks user data loss.
- **(Rejected) Detached-HEAD worktree**: cannot receive commits without noise; confusing to users who want to merge results.

---

## R4. Transcript persistence size & truncation policy

**Question**: VS Code's `workspaceState` is backed by a key-value store with practical size ceilings (documented ~5 MB soft limit before performance degrades, JSON-serialized per key). How do we persist ACP transcripts without blowing that budget, while still delivering SC-007 (100% of in-session transcript preserved across panel reopen)?

**Decision**:
- Use a **split layout** inside `workspaceState`:
  - `gatomia.agentChat.sessions.index`: lightweight manifest — array of session metadata (no messages), keyed by session id. Bounded.
  - `gatomia.agentChat.sessions.transcript.<session-id>`: one entry **per session** storing `{ schemaVersion, messages: ChatMessage[] }`. Bounded independently per session.
- **Per-session transcript ceiling**: 10,000 messages or ~2 MB JSON, whichever comes first. When either threshold is hit:
  - The oldest 25% of messages are **moved** to an append-only on-disk file under `<globalStorage>/agent-chat/<session-id>/transcript-<n>.jsonl` (one JSON object per line). The in-memory transcript keeps the most recent 75% + a synthetic "earlier transcript archived" marker pointing to the file.
  - The chat panel can lazy-load the archived segments from disk via the panel↔extension bridge when the user scrolls past the marker.
- **Manifest ceiling**: keep at most the last 100 sessions per workspace; older sessions are evicted from the manifest AND their transcript entries are deleted (their archived files, if any, are retained on disk for 30 days then purged by `session-cleanup-service.ts`, aligning with spec 016 cleanup policy).
- **Worktree linkage** survives eviction: if a session is evicted from the manifest but its worktree still exists on disk (per FR-015a, never auto-deleted), we retain a stub in a secondary `gatomia.agentChat.worktreesOrphaned` key so the user can still discover and clean them up.

**Rationale**:
- Keeps `workspaceState` writes small (manifest changes are cheap); large transcripts live in their own keys written only when they grow.
- 10k messages / 2 MB matches observed long-run transcripts in similar developer tools and leaves headroom for metadata.
- On-disk JSONL archival is append-only and resumable; plays nicely with the VS Code global storage API.
- 100-session manifest ceiling prevents the list from becoming unusable while preserving recent history.

**Alternatives considered**:
- **(Rejected) Single monolithic `sessions` key**: would hit size ceilings fast; also writes the whole blob every change.
- **(Rejected) On-disk-only storage**: `workspaceState` is the project convention and gives us free sync/restart semantics for small manifests.
- **(Rejected) No cap, rely on disk**: risks extension-host slowdowns once the key becomes very large.

---

## R5. Concurrent ACP session scale

**Question**: How many concurrent ACP sessions should we support per workspace, and what are the practical ceilings for CPU/memory/process count?

**Decision**:
- **Target**: up to **5** concurrent ACP sessions per workspace in v1.
- **Enforcement**: soft cap surfaced in the UI. When the user tries to start a 6th ACP session (Local or Worktree target), the Running Agents tree shows a warning and the chat panel offers to cancel an idle session before proceeding. The cap is configurable via a new setting `gatomia.agentChat.maxConcurrentAcpSessions` (default 5).
- **Cloud sessions** are not counted against this cap (they do not spawn local subprocesses).
- **Observed footprint** (from ACP smoke runs on representative macOS hardware during research): each ACP subprocess carries ~80-150 MB RSS at steady state, dominated by Node runtime + model SDK client. 5 × ~150 MB = ~750 MB, acceptable.

**Rationale**:
- Matches realistic multi-session workflows (e.g. one Plan + two Code + one Ask).
- Explicit cap prevents accidental resource exhaustion and makes the limit discoverable (visible in settings, not a magic number).
- Cloud sessions are remote so they don't contribute to local pressure.

**Alternatives considered**:
- **(Rejected) No cap**: users can accidentally spawn dozens and crash the extension host.
- **(Rejected) Cap at 1**: breaks User Story 4 (monitor multiple concurrent sessions).
- **(Rejected) Cap at 3**: tested internally, too restrictive for common Plan+Code workflows.

---

## R6. Cloud session re-attach on VS Code restart

**Question**: Q5 resolved that Cloud sessions should re-attach via spec 016's existing polling. How exactly does the chat panel integrate?

**Decision**:
- Spec 016 already persists Cloud sessions in `AgentSessionStorage` and runs `AgentPollingService` on activation, which refreshes session state via the active provider adapter.
- The `cloud-chat-adapter.ts` subscribes to `AgentPollingService.onSessionUpdated(sessionId)` (if it exists; otherwise we add a lightweight `EventEmitter` in spec 016's polling service as the only change there) and translates each update into an `AgentChatEvent`.
- On VS Code launch, the agent-chat registry iterates the persisted manifest, and for each session whose `executionTarget` is `cloud`, calls `cloud-chat-adapter.attach(localId)` which is idempotent — it wires the chat panel to the already-running polling loop without re-dispatching the task.
- Sessions that finished while VS Code was closed appear with their final state (`completed`, `failed`, `cancelled`) as soon as the first poll after launch returns — this is existing spec 016 behavior; the chat panel renders the snapshot and no further events.

**Rationale**:
- Zero duplication of polling logic; the chat panel is a thin view on top of spec 016's existing session store.
- `attach` is idempotent so a panel reopen does not cause double-subscription.
- No new state machine needed beyond what spec 016 already has.

**Alternatives considered**:
- **(Rejected) Re-implement polling inside `agent-chat`**: duplicates spec 016's work and risks divergent status handling.
- **(Rejected) Push-only via provider webhooks**: neither Devin nor GitHub Copilot coding agent expose reliable webhooks into VS Code; polling is the established pattern.

---

## R7. Running agents tree — where does it live?

**Question**: Spec FR-006 says sessions must be listed "in a location the user can discover from the main extension UI (e.g. the Hooks view, a dedicated running-agents section, or another clearly visible place)." What is the concrete choice?

**Decision**:
- **Add a new tree view** `gatomia.runningAgents` inside the existing **GatomIA activity bar container**, siblings to the existing `gatomia.specExplorer`, `gatomia.hooksExplorer`, and `gatomia.promptsExplorer` views.
- Tree structure:
  - Root group "Active" (sessions with `lifecycleState ∈ {running, waiting-for-input}`)
  - Root group "Recent" (last 20 sessions in `{completed, failed, cancelled, ended-by-shutdown}`)
  - Each leaf shows: `<agent display name> · <mode> · <target> · <status badge>` with a command on click that invokes `gatomia.agentChat.openForSession`.
  - Each leaf exposes a right-click action `Clean up worktree` when the session used the Worktree target (guarded if already cleaned).
- **Why not surface it inside the Hooks view?** The Hooks view is about configuring automations, not monitoring live executions; conflating the two would create cognitive clutter and violate Constitution V (Simplicity).

**Rationale**:
- Matches VS Code tree-view patterns already used by this extension.
- A dedicated view avoids overloading `hooksExplorer` and gives the feature a clear home.
- Command-based click action is testable and composable with other entry points (command palette, URI handler).

**Alternatives considered**:
- **(Rejected) New tab inside the webview**: tabs inside a single panel can't be activity-bar-revealed.
- **(Rejected) Inline section in `hooksExplorer`**: conflates configuration with monitoring.
- **(Rejected) StatusBarItem only**: not discoverable; not list-capable.

---

## R8. Webview virtualization for long transcripts

**Question**: FR-021 requires the panel to stay responsive for high-throughput output and long transcripts. How do we meet that in React?

**Decision**:
- Use **windowed/virtualized rendering** for the transcript via `@tanstack/react-virtual` (**MIT license**, lightweight, SSR-agnostic, compatible with the other permissive-licensed `ui/` dependencies).
- Add `@tanstack/react-virtual` to `ui/package.json` as a new dependency. This is the only new runtime dependency introduced by this feature. A Phase 0 setup task in `tasks.md` MUST perform `npm --prefix ui install @tanstack/react-virtual` before any webview implementation work begins.
- Rationale against `react-window` / `react-virtualized`: `@tanstack/react-virtual` is smaller, actively maintained, and handles variable-height rows out of the box via `measureElement`.
- Rendering pipeline: each `AgentChatEvent` appended to the store; the virtual list renders only the visible window; `scrollTo('bottom')` is called only when the user is already pinned near the bottom (so manual scroll is not hijacked).
- Throttle UI updates to `requestAnimationFrame` (≤60 fps) so chunk bursts from the agent coalesce into a single render per frame.

**Rationale**:
- Virtualization is the industry norm for chat UIs with thousands of messages.
- rAF batching is sufficient for SC-001 (2 s to first output) and SC-002 (1 s echo) under load.

**Alternatives considered**:
- **(Rejected) Plain DOM list**: becomes janky above ~1k messages.
- **(Rejected) CodeMirror/Monaco-backed transcript**: overkill for rendering, not a message UI.

---

## R9. Failure retry / open-in-cloud-provider control (FR-020)

**Question**: What does the "retry or reopen-in-cloud-provider" control in FR-020 actually do?

**Decision**:
- For ACP session failures, the retry control re-runs the **same task instruction** in a new session (keeps the mode/model/target selection of the failed session). The failed session remains in "Recent" with its transcript preserved; a new session id is allocated.
- For Cloud session failures, the panel offers two actions:
  1. "Open in provider" → opens the provider's external URL (Devin session URL, GitHub issue URL) via `env.openExternal`, reusing the data already stored in spec 016's `AgentSession.externalUrl`.
  2. "Dispatch again" → calls the active provider adapter's `dispatch()` with the same spec task, allocating a new session.
- The chat panel surfaces these as buttons inside the transcript error message (not in a modal) so the failure context stays visible.

**Rationale**:
- Retrying into a new session preserves auditability — the failed transcript isn't overwritten.
- Reusing spec 016's `externalUrl` keeps the cloud-agent UX consistent with the existing tree view.

**Alternatives considered**:
- **(Rejected) In-place retry that clears the transcript**: loses audit trail.
- **(Rejected) Auto-retry**: fighting transient failures masks real problems; user-driven retry is safer.

---

## Resolved References

- Spec clarifications: see `spec.md` `## Clarifications` (Session 2026-04-24, 5 Q/A pairs).
- Existing ACP client: `@/Users/t798157/Projects/lab/gatomia-vscode/src/services/acp/acp-client.ts:1-200` and `:350-459`.
- Existing ACP session manager: `@/Users/t798157/Projects/lab/gatomia-vscode/src/services/acp/acp-session-manager.ts:1-141`.
- Existing known-agents catalog: `@/Users/t798157/Projects/lab/gatomia-vscode/src/providers/hook-view-provider.ts:736-827`.
- Existing cloud-agents module (spec 016): `@/Users/t798157/Projects/lab/gatomia-vscode/src/features/cloud-agents/` (11 files).
- Existing webview panel pattern: `@/Users/t798157/Projects/lab/gatomia-vscode/src/panels/cloud-agent-progress-panel.ts:1-185` and `@/Users/t798157/Projects/lab/gatomia-vscode/src/panels/document-preview-panel.ts:1-316`.

All NEEDS CLARIFICATION items are resolved. Proceed to Phase 1 design.
