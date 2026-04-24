# Quickstart: Interactive Agent Chat Panel

**Feature**: `018-agent-chat-panel`
**Audience**: Developers implementing or reviewing this feature
**Prerequisites**: Node 18+, VS Code 1.84+, git CLI, an ACP-capable agent (e.g. `opencode`, `claude-code`, `gemini-cli`) installed locally

This quickstart shows how to bring up the feature end-to-end during development and how to exercise each user story.

---

## 1. One-time setup

```bash
# From repo root
npm run install:all

# Build everything
npm run build

# Launch the extension in a dev host (F5 in VS Code), or alternatively
npm run watch   # TypeScript watch + Vite dev server
```

Then press `F5` inside VS Code to start the **Extension Development Host**.

In the dev host:

1. Open a workspace folder that is a git repository with at least one commit (required for the Worktree target).
2. Install at least one ACP agent on your PATH (e.g. `brew install opencode` or `npx @github/copilot-language-server@latest --help` to ensure it is reachable).
3. In the GatomIA activity bar, confirm the **Running Agents** tree view is present (even if empty initially).

---

## 2. Exercise User Story 1 (P1): Watch and interact with a running ACP agent

**Goal**: verify streaming, follow-ups, and the chat-style transcript.

1. Open the GatomIA activity bar → **Running Agents** view.
2. Click the toolbar action **"Start new agent session"** (command id: `gatomia.agentChat.startNew`).
3. Pick an ACP agent (e.g. `opencode`) and enter a prompt like *"List the TypeScript files in `src/features/agent-chat/`."*
4. Expect: a new entry appears in the tree under **Active** with state `running`; the chat panel auto-opens next to the editor; the agent's output streams in chat-style, with tool calls shown as distinct items.
5. While the agent is still running (e.g. mid-tool-call), type *"Also include any `.test.ts` files."* in the input bar and submit.
6. Expect: your follow-up appears in the transcript; the agent processes it as part of the turn (or the next turn, agent-dependent); no lag; no UI freeze.
7. When the agent finishes, the tree entry moves under **Recent** with state `completed`; the panel header shows duration and stop reason.

**Regression checks**:

- The **GatomIA** `OutputChannel` (View → Output → GatomIA) still receives the raw ACP output (FR-022).
- Closing the panel and clicking the tree entry reopens the **same** panel with the full conversation (FR-008, FR-019).

---

## 3. Exercise User Story 2 (P2): Reopen by clicking a running item

1. With one session still running from §2 (or trigger two in parallel), open the **Running Agents** tree.
2. Click each session entry in turn.
3. Expect: each click focuses (or opens) the chat panel for that specific session; panels do not duplicate; transcripts do not bleed across sessions.
4. Right-click a completed session that used the Worktree target → **"Clean up worktree"**. Confirm the warning flow (see §5).

---

## 4. Exercise User Story 3 (P3): Mode, model, and execution target selection

1. Start a new ACP session with an agent that has catalog-backed capabilities (the catalog ships pre-populated seeds — see `agent-capabilities-catalog.ts`).
2. In the chat panel, confirm the mode selector offers the agent's modes (e.g. Code / Ask / Plan). Change to **Plan**.
3. Confirm the model selector lists the agent's models (if any); pick a non-default one.
4. In the execution target selector:
   - **Local**: run as usual.
   - **Worktree**: on run-start, verify a new directory appears at `.gatomia/worktrees/<session-id>/`, a branch `gatomia/agent-chat/<session-id>` exists, and agent file edits land there (verify via `git status` in the primary checkout: it should remain clean).
   - **Cloud**: requires a spec 016 provider (Devin or GitHub Copilot coding agent) to be configured. If not, the panel guides you to configure it (FR-017). Once configured, run and verify the chat panel shows the cloud provider's progress as a read-only monitor with a cancel control.

---

## 5. Exercise Worktree cleanup flow

1. Start a session with target **Worktree**.
2. Make a small uncommitted change inside the worktree (e.g. open its directory and edit a file).
3. In the chat panel, click **Clean up worktree**.
4. Expect a warning dialog listing the uncommitted paths. Click **Cancel** — worktree remains intact.
5. Commit or discard the changes, then click **Clean up worktree** again. Expect success: directory removed, branch deleted, a `worktree-cleaned` system message in the transcript.

---

## 6. Exercise restart persistence (FR-019a/b/c)

1. Start two ACP sessions and one Cloud session.
2. Close the VS Code dev host window.
3. Reopen the workspace in the dev host.
4. Open the **Running Agents** view.
5. Expect:
   - Both ACP sessions appear under **Recent** with state `ended by shutdown`, full transcripts preserved, worktrees still on disk.
   - The Cloud session reappears with its current remote state (whatever the provider reports on the next poll), transcript re-attached via spec 016's polling.
6. Click an ACP session → panel opens in read-only mode with its transcript intact.

---

## 7. Run the tests

```bash
# Unit + integration tests for this feature
npm test -- tests/unit/features/agent-chat/
npm test -- tests/unit/panels/agent-chat-panel.test.ts
npm test -- tests/unit/providers/running-agents-tree-provider.test.ts
npm test -- tests/unit/webview/agent-chat/
npm test -- tests/integration/agent-chat/

# Full test suite (required before PR)
npm test
npm run check
```

TDD is mandatory (Constitution III). New implementation code must be preceded by red tests. See each contract's §"Test coverage (TDD)" section for the exact required cases.

---

## 8. Where to poke when something breaks

| Symptom | Likely culprit | Diagnostic |
|---------|----------------|------------|
| Panel does not open on session start | `AgentChatRegistry` did not register the session, or `autoOpenPanelOnNewSession = false` | Check `gatomia.agentChat.settings`; open the `GatomIA` output channel for errors |
| Agent output visible in log but not in panel | `AcpClient.subscribeSession()` not wired; panel listener not firing | Breakpoint in `acp-chat-runner.ts`; check webview `use-session-bridge.ts` receives `agent-chat/messages/appended` |
| Mode selector missing for a known agent | Capability discovery returned `source: "none"` | Inspect `agent-capabilities-service.ts` resolve result; verify catalog entry exists |
| Worktree creation silently not happening | Target selector defaulted to Local | Inspect `AgentChatSession.executionTarget.kind` in the session store |
| Changes landing in primary checkout despite Worktree target | Subprocess `cwd` not set to worktree path | `AcpChatRunner` must pass `cwd = handle.absolutePath` when spawning |
| After restart, ACP session still shows `running` | `extension.deactivate` did not flush manifest | Ensure `flushForDeactivation()` is awaited by `deactivate`'s return value; check `workspaceState.update` settled |
| Cloud session doesn't re-attach on launch | `cloud-chat-adapter.attach` not called during activation | Check `AgentChatSessionStore.listNonTerminal()` output and the for-loop in activation |
| Tree view empty after restart | Manifest key missing or corrupted | `workspaceState.get("gatomia.agentChat.sessions.index")`; recover by deleting the key (lose history) |

---

## 9. Telemetry to watch during development

The feature emits events via the existing telemetry pipeline. During the dev host session, tail the GatomIA output channel for:

- `agent-chat.session.started` — new session dispatched
- `agent-chat.session.ended-by-shutdown` — on reactivation for previously running ACP sessions
- `agent-chat.worktree.created` / `.cleaned` / `.failed`
- `agent-chat.capabilities.resolved` — with `source: "agent" | "catalog" | "none"`
- `agent-chat.panel.opened` / `.reopened`
- `agent-chat.error` — any failure

No PII is emitted (paths are anonymized; user-provided model ids are excluded).

---

## 10. Ship checklist before opening a PR

- [ ] All tests pass (`npm test`)
- [ ] Lint and format clean (`npm run check`)
- [ ] All new files are kebab-case
- [ ] TDD respected (no implementation file without a corresponding `.test.ts`)
- [ ] Spec 016 cloud-agents module receives only additive changes
- [ ] `OutputChannel` still works for ACP debug output (manual smoke check)
- [ ] `.gatomia/worktrees/` entry appears in `.gitignore` after first worktree is created
- [ ] Restart persistence exercised at least once manually (see §6)
- [ ] Telemetry events emit as listed in §9
