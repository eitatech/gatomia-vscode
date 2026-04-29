# Contract: Per-Session Worktree Lifecycle

**Feature**: `018-agent-chat-panel`
**Status**: Frozen for v1
**Consumers**: `src/features/agent-chat/agent-worktree-service.ts`, `src/commands/agent-chat-commands.ts`
**References**: spec FR-012, FR-015, FR-015a, FR-015b, FR-015c; research.md §R3

This contract defines how per-session git worktrees are created, tracked, and cleaned up, including error handling and user interaction.

---

## 1. Layout

| Element | Value |
|---------|-------|
| Root | `<repoRoot>/.gatomia/worktrees/` |
| Per-session directory | `<repoRoot>/.gatomia/worktrees/<session-id>/` |
| Per-session branch | `gatomia/agent-chat/<session-id>` |
| Base commit | current `HEAD` of the primary checkout at `create()` time, captured as `handle.baseCommitSha` |

Where `<session-id>` is the UUIDv4 assigned to the `AgentChatSession`.

**Ignore rule**: On first successful `create()`, if `.gitignore` does not already contain `.gatomia/worktrees/`, the service appends that line. This makes the rule idempotent and visible to the user via git diff.

### 1.1 Multi-root workspace resolution

VS Code supports multi-root workspaces (`workspace.workspaceFolders` may have more than one entry). The worktree service resolves **which repo root to use** per session, in this order:

1. **Session trigger context** (preferred): the triggering context (hook execution, spec file location, active editor) carries a `workspaceFolder` that the service uses to resolve the enclosing git repo via `git rev-parse --show-toplevel` from that folder.
2. **Fallback**: when no triggering context is available (e.g. the user started a session from the command palette with no active editor), the service uses the **first** `workspace.workspaceFolders` entry whose folder is inside a git repo and surfaces a `SystemChatMessage { kind: "worktree-created" }` that names the chosen root so the user can verify.
3. **Ambiguity**: if two or more workspace folders live in different git repositories AND the trigger context does not disambiguate, the service MUST fail with `WorktreeCreateError("ambiguous-workspace-root", "Choose which repository to target for the worktree session.")` rather than silently picking one.

The resolved root is stored in `handle.absolutePath`'s prefix; all git commands in this contract run from (or with `-C`) that root.


---

## 2. Public API

```ts
interface AgentWorktreeService {
  /** Create a fresh worktree for a session. */
  create(sessionId: string): Promise<WorktreeHandle>;

  /** Look up the worktree handle for a session, if any. */
  get(sessionId: string): Promise<WorktreeHandle | null>;

  /** Inspect the worktree for uncommitted changes and unpushed commits. */
  inspect(handle: WorktreeHandle): Promise<WorktreeInspection>;

  /** Remove the worktree and delete the branch. */
  cleanup(handle: WorktreeHandle, options: CleanupOptions): Promise<void>;

  /** Enumerate worktrees created by this service (regardless of session). */
  listAll(): Promise<WorktreeHandle[]>;
}

interface WorktreeInspection {
  uncommittedPaths: string[];
  unpushedCommits: number;
  isClean: boolean;
}

interface CleanupOptions {
  /** Confirm the user has acknowledged destructive changes. */
  confirmedDestructive: boolean;
}
```

All operations are async and shell out to the git CLI in the repo root.

---

## 3. State machine

```text
         create()
   ┌───────────────────┐
   │                   ▼
[none]            [created]
                      │
                      │ first prompt dispatched
                      ▼
                  [in-use]
                      │
          ┌───────────┼───────────┐
          │           │           │
session  done        user        git fs
(no      (no         requests    error
cleanup)  cleanup)   cleanup     during use
          │           │           │
          ▼           ▼           ▼
      [in-use]   cleanup()   [abandoned]
                     │            (surfaced in
                     │             Orphaned tree)
                     ▼
                [cleaned]
```

**Rules**:

- `created → in-use` happens on first agent activity (first tool call or first user message).
- `in-use → abandoned` happens when the worktree directory or branch becomes inaccessible (e.g. user manually deleted it) while its session is still non-terminal. The session transitions to `failed` and a `SystemChatMessage { kind: "worktree-cleaned" }` is appended.
- `* → cleaned` happens only via `cleanup()`. There is no automatic path to `cleaned` (FR-015a).
- The worktree state is independent of the `AgentChatSession.lifecycleState`. A session can be `completed` while its worktree is still `in-use` awaiting user cleanup.

---

## 4. `create()` algorithm

```text
0. Resolve repoRoot (multi-root-aware; see §1.1)
   - Use the session's trigger-context workspaceFolder if provided
   - Else use the single workspace folder when unambiguous
   - Else if ambiguous (multiple folders in different repos, no trigger), throw
     WorktreeCreateError("ambiguous-workspace-root", "Choose which repository to target ...")

1. Ensure repoRoot is a git repository
   - Run `git rev-parse --show-toplevel` from repoRoot
   - Failure ⇒ throw WorktreeCreateError("not-a-git-repo", "Run this inside a git repository.")

2. Resolve HEAD
   - Run `git rev-parse HEAD`
   - Capture baseCommitSha
   - Failure ⇒ throw WorktreeCreateError("no-head", "Commit at least once before using worktree mode.")

3. Ensure `.gatomia/worktrees/` is git-ignored
   - If `.gitignore` missing or does not contain `.gatomia/worktrees/`, append the line
   - Non-fatal: log a warning and continue

4. Compose paths
   - absolutePath = `<repoRoot>/.gatomia/worktrees/<sessionId>/`
   - branchName = `gatomia/agent-chat/<sessionId>`
   - Pre-condition: absolutePath MUST NOT exist
     - If it does, throw WorktreeCreateError("path-occupied", ...)
   - Pre-condition: branchName MUST NOT exist locally
     - If it does, throw WorktreeCreateError("branch-exists", ...)

5. Run `git worktree add -b <branchName> <absolutePath> <baseCommitSha>`
   - Failure ⇒ capture stderr, throw WorktreeCreateError("git-worktree-add-failed", <stderr>)
   - On failure, ensure no leftover directory at absolutePath (cleanup any partial result)

6. Persist handle
   - Return WorktreeHandle {
       id: sessionId (v1: 1:1 with session),
       absolutePath,
       branchName,
       baseCommitSha,
       status: "created",
       createdAt: now(),
     }

7. Emit telemetry "agent-chat.worktree.created" { sessionId, branchName, baseCommitSha }
```

On any failure, the service MUST **not** spawn the ACP agent and MUST surface the `WorktreeCreateError` as an `ErrorChatMessage { category: "worktree-create-failed" }` in the session transcript (FR-015c). The session transitions to `failed`.

---

## 5. `inspect()` algorithm

```text
1. Run `git -C <absolutePath> status --porcelain`
   - Each non-empty output line is a changed path → collected in `uncommittedPaths`

2. Count commits made on the session branch on top of the recorded base:
   - Run `git -C <absolutePath> rev-list --count <handle.baseCommitSha>..HEAD`
   - This counts every commit the agent (or the user) produced on the session branch since
     it was created. It is independent of remotes (`origin/<branchName>` may not exist for
     session-scoped branches that were never pushed, which is the common case).
   - On command error (corrupt repo, missing baseCommitSha), throw the error — do NOT silently
     treat as 0, because that would cause `cleanup()` to skip the destructive-change warning
     and risk data loss.
   - Store the count as `unpushedCommits` (name preserved for backward compatibility with the
     warning dialog copy, even though "new commits since base" is the more precise meaning).

3. isClean = uncommittedPaths.length == 0 AND unpushedCommits == 0
```

**Why `baseCommitSha..HEAD` and not `origin/<branchName>`**: session branches named `gatomia/agent-chat/<id>` are local-only by default. A remote-tracking-branch comparison would fail or return 0 on a fresh session branch, which would mask agent-made commits from the cleanup warning and let `git branch -D` destroy them silently. Comparing against the recorded base commit captures every new commit unconditionally.

---

## 6. `cleanup()` algorithm

```text
1. inspection := inspect(handle)
2. If NOT inspection.isClean AND NOT options.confirmedDestructive:
     throw WorktreeCleanupWarningRequired(inspection)

3. Run `git worktree remove --force <handle.absolutePath>`
   - Failure ⇒ throw WorktreeCleanupError("git-worktree-remove-failed", <stderr>)

4. Run `git branch -D <handle.branchName>`
   - Failure (e.g. branch no longer exists) ⇒ log warning, continue

5. Update handle: { status: "cleaned", cleanedAt: now() }
6. Persist via AgentChatSessionStore.updateSession({ worktree: handle })
7. Emit SystemChatMessage { kind: "worktree-cleaned" } into the session transcript
8. Emit telemetry "agent-chat.worktree.cleaned" { sessionId, hadUncommittedChanges: !inspection.isClean }
```

The caller (webview flow, research R3) uses the two-step request/response pattern:

1. Webview sends `agent-chat/control/cleanup-worktree { confirmedDestructive: false }`.
2. If extension replies with a warning, the webview shows a confirmation dialog.
3. Webview re-sends with `confirmedDestructive: true`.

---

## 7. Errors

```ts
class WorktreeCreateError extends Error {
  constructor(
    public readonly code:
      | "ambiguous-workspace-root"
      | "not-a-git-repo"
      | "no-head"
      | "path-occupied"
      | "branch-exists"
      | "git-worktree-add-failed",
    message: string,
  ) { super(message); }
}

class WorktreeCleanupError extends Error {
  constructor(
    public readonly code: "git-worktree-remove-failed",
    message: string,
  ) { super(message); }
}

class WorktreeCleanupWarningRequired extends Error {
  constructor(public readonly inspection: WorktreeInspection) {
    super("Worktree has uncommitted changes or unpushed commits");
  }
}
```

All errors are user-actionable; their messages (suitable for transcript display) MUST include concrete next steps (e.g. "Install git and re-run", "Delete `<path>` or choose a different worktree name").

---

## 8. Interaction with restart restore

On activation (see `agent-chat-session-storage.md` §6):

- For each `executionTargetKind == "worktree"` session, verify the worktree still exists on disk via `fs.stat(handle.absolutePath)`.
- If missing, transition handle to `cleaned` (self-repair) and emit `SystemChatMessage { kind: "worktree-cleaned" }`.
- The worktree's branch MAY still exist even if the directory was deleted out-of-band; in that case a subsequent explicit `cleanup()` call will still run `git branch -D` and succeed.

---

## 9. Telemetry

- `agent-chat.worktree.created` — `{ sessionId, branchName }` (no absolute path to avoid leaking PII / path info).
- `agent-chat.worktree.failed` — `{ sessionId, code }` where `code` is the error code.
- `agent-chat.worktree.cleaned` — `{ sessionId, hadUncommittedChanges: boolean }`.
- `agent-chat.worktree.abandoned` — `{ sessionId }` emitted when self-repair detects the directory is gone.

---

## 10. Test coverage (TDD)

The following tests MUST exist before implementation:

- **Happy path**: `create()` on a clean repo → worktree directory exists, branch exists, handle status = `created`.
- **Already git-ignored**: `.gitignore` already contains the entry → no mutation.
- **Missing gitignore**: no `.gitignore` file → created with the entry.
- **Path conflict**: directory already exists at absolutePath → `WorktreeCreateError("path-occupied")`.
- **Branch conflict**: branch already exists → `WorktreeCreateError("branch-exists")`.
- **Not a git repo**: `create()` outside a repo → `WorktreeCreateError("not-a-git-repo")`.
- **Ambiguous multi-root workspace**: two workspace folders in different git repos, no trigger context → `WorktreeCreateError("ambiguous-workspace-root")`; no worktree created.
- **Single-root workspace**: one workspace folder → service resolves the repo root without user interaction; worktree created under that root.
- **Trigger-resolved multi-root**: a hook in repo A's folder triggers a session → worktree is created under repo A regardless of which workspace folder VS Code considers "first".
- **No HEAD**: fresh repo with no commits → `WorktreeCreateError("no-head")`.
- **`inspect()` with uncommitted files** → `uncommittedPaths` non-empty, `isClean = false`.
- **`inspect()` with new commits since base** (one or more local commits on the session branch since `baseCommitSha`, no remote configured) → `unpushedCommits > 0`, `isClean = false`. Proves the `baseCommitSha..HEAD` comparison triggers the warning even without a remote.
- **`inspect()` when branch is exactly at base** → `unpushedCommits = 0`.
- **`cleanup()` on dirty tree without confirmation** → throws `WorktreeCleanupWarningRequired` with the inspection; worktree still present.
- **`cleanup()` on dirty tree with confirmation** → worktree and branch removed; handle transitions to `cleaned`.
- **`cleanup()` on clean tree without confirmation** → succeeds (no warning needed).
- **Self-repair**: worktree directory deleted out-of-band, `inspect()` called → returns clean with `unpushedCommits = 0` and `isClean = true` (and logs the anomaly); `cleanup()` still succeeds to remove the orphan branch.
- **Failure does not start the agent**: a create failure raises before any ACP spawn occurs (integration test with a mock `AcpChatRunner`).

Location: `tests/unit/features/agent-chat/agent-worktree-service.test.ts` (unit) and `tests/integration/agent-chat/worktree-lifecycle.test.ts` (integration).
