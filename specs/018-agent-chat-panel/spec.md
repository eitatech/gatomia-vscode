# Feature Specification: Interactive Agent Chat Panel

**Feature Branch**: `018-agent-chat-panel`
**Created**: 2026-04-24
**Status**: Draft
**Input**: User description: "Currently, execution via ACP agents is displayed in the log window. I would like this execution to occur in a window, preferably a chat-style window, where I can interact with the model if necessary. When clicking on an item being executed by an agent, the agent's execution window should open, allowing interaction with the agent or monitoring the execution process. The chat window should allow selection of functions offered by the respective agent, such as 'Code,' 'Ask,' or 'Plan' modes, the model the agent is using, or the model I wish to execute, and whether it will be executed locally, via worktree, or in the cloud."

## Clarifications

### Session 2026-04-24

- Q: What does "Cloud" as an execution target actually mean? → A: Cloud dispatches the task to the configured cloud agent provider (Devin, GitHub Copilot coding agent) via the existing multi-provider adapters from spec 016; it does NOT mean running the local ACP agent on a remote host.
- Q: Which agent types does the chat panel apply to? → A: ACP agents get the full interactive chat (stream + follow-ups + mode/model/target). Cloud provider sessions from spec 016 open in the same chat panel as a read-only progress monitor with cancel-only controls. Non-ACP local agents (GitHub Copilot Chat participants, gh-copilot CLI) keep their current surfaces and are explicitly out of scope for this feature.
- Q: Worktree lifecycle — who owns creation, reuse, and cleanup? → A: One worktree per ACP session, auto-created from current HEAD into a gatomia-managed directory (e.g. `.gatomia/worktrees/<session-id>/`) on a session-scoped branch. Worktrees are never auto-deleted; the chat panel exposes an explicit "clean up worktree" action that the user invokes when done. Concurrent sessions get independent worktrees (true parallelism).
- Q: How does the extension discover an ACP agent's supported modes and models? → A: Hybrid discovery. First, consult the agent's ACP `initialize` response for any `modes`/`models` fields. If the agent does not report them, fall back to a gatomia-maintained catalog (extending `KNOWN_AGENTS`) keyed by agent id. If neither source provides values, hide the relevant selector. The extension never invents modes/models that the agent has not either reported or been cataloged for.
- Q: Do agent sessions and transcripts survive VS Code restarts? → A: Transcripts and session metadata (status, agent id, mode/model/target, timestamps, worktree path/branch, trigger origin) are persisted per workspace. On next launch, ACP sessions that were running at shutdown reappear in the running agents list with lifecycle state "ended by shutdown" and their transcript is available for review; their subprocesses are NOT respawned. Cloud sessions re-attach to their remote counterparts via spec 016's existing polling. Worktrees remain on disk (per the worktree clarification) and stay linked to their now-ended session.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch and Interact with a Running Agent in a Chat Panel (Priority: P1)

A user triggers an agent task (for example, from a hook, a spec action, or a command) and, instead of seeing output scroll past inside a read-only log window, the agent's turn-by-turn output appears in a dedicated chat-style panel. The user can read the agent's messages as they stream in, see which tools it is calling, and type a follow-up message to the agent mid-run whenever the agent is waiting for input or willing to accept a clarification.

**Why this priority**: This is the foundational capability. Without the chat panel replacing the passive log experience, none of the other features (mode/model selection, click-through, interaction) have a surface to live on. It immediately delivers value on its own by making existing agent output readable and actionable.

**Independent Test**: Start any agent session that currently writes to the log window. Confirm the output is rendered in a chat-style panel with a text input field. Type a follow-up message and confirm it is delivered to the running agent (or queued and visibly sent when the agent next accepts input).

**Acceptance Scenarios**:

1. **Given** an agent has just been triggered and no chat panel is open, **When** the agent begins producing output, **Then** a chat panel opens automatically (or a notification offers to open it) and the first message from the agent appears in the conversation history.
2. **Given** an agent is streaming output into the chat panel, **When** the agent emits a tool call or status change, **Then** the panel displays that activity inline with the conversation (clearly distinguishable from plain assistant text).
3. **Given** the agent is awaiting input or running, **When** the user types a message and submits it, **Then** the message is appended to the conversation and delivered to the agent; if the agent cannot currently accept input, the user is informed and the message is either queued or rejected with a clear reason.
4. **Given** the agent finishes its turn, **When** the final response is complete, **Then** the panel shows the end-of-turn state (e.g. "completed", "stopped", duration) and the input remains available so the user can continue the session if the agent supports it.
5. **Given** the agent fails or times out, **When** the error occurs, **Then** the panel shows an actionable error message in the conversation thread (not only in a detached log) and offers a retry control.

---

### User Story 2 - Reopen an Agent's Execution Window by Clicking the Running Item (Priority: P2)

A user has several hook executions, dispatched spec tasks, or background agent runs visible in the extension (e.g. in the Hooks view, in a "running agents" list, or in a spec tree node with an active status). The user clicks on one of these running or recently completed items and is taken directly to that agent's chat panel, restoring the full conversation, current execution state, and input controls for that specific run.

**Why this priority**: Users typically have more than one agent session at once, or come back to an agent after switching context. Being able to click a running/recent item and jump to its chat is what makes the chat panel a durable work surface instead of a transient window.

**Independent Test**: Trigger two agent runs in parallel. In the extension UI (Hooks view or wherever running agents are listed), click the first one, confirm its chat panel opens with its conversation. Then click the second one, confirm a different panel (or the same panel rescoped to the second run) opens with the correct conversation.

**Acceptance Scenarios**:

1. **Given** two or more agent runs exist (running or recently completed), **When** the user clicks a specific run in the Hooks view / running agents list, **Then** the chat panel for that exact run opens with its full conversation history restored.
2. **Given** the user clicks a run that is already visible in a chat panel, **When** the click occurs, **Then** the existing panel is focused rather than duplicated.
3. **Given** the user clicks a run that has completed, **When** the chat panel opens, **Then** the full transcript is visible in read-only or read-write mode consistent with whether the underlying agent still accepts input.
4. **Given** a run was terminated or the agent process is gone, **When** the user opens its chat panel, **Then** the panel clearly indicates the run is no longer live and disables input, while still preserving the conversation for review.

---

### User Story 3 - Configure Mode, Model, and Execution Target Before or During a Run (Priority: P3)

Before starting a run (or when editing the next prompt inside an active chat), the user can choose the agent's operating mode (for example, "Code", "Ask", or "Plan"), the model the agent should use, and where the work should run: locally on the developer's machine, inside an isolated worktree, or in the cloud via an existing cloud agent provider. Options that the selected agent does not support are hidden or disabled with a clear explanation.

**Why this priority**: Mode and model selection is core to making the chat panel feel like a first-class agent experience rather than a passive viewer. Execution target selection extends the feature to support safer local isolation (worktree) and remote execution (cloud) without forcing users to leave the chat. It depends on P1 for the chat surface and P2 for session identity, so it comes last in the MVP ordering.

**Independent Test**: Open the chat panel for a new agent run. Confirm the mode selector lists only the modes the agent actually supports, the model selector lists only the models the agent exposes, and the execution target selector lists at least Local, Worktree, and Cloud (with Cloud only available when a cloud provider is configured). Start a run with a non-default mode/model/target combination and confirm the agent is invoked accordingly.

**Acceptance Scenarios**:

1. **Given** an agent exposes modes ("Code", "Ask", "Plan"), **When** the user opens the chat panel for that agent, **Then** a mode selector is visible with those options and a default pre-selected.
2. **Given** an agent exposes multiple models, **When** the user opens the model selector, **Then** it lists the models available to that agent and shows which one the agent would use by default.
3. **Given** the user chooses "Worktree" as the execution target, **When** the run is started, **Then** the agent operates against an isolated worktree of the current repository and any file changes are written there, not directly in the primary checkout.
4. **Given** the user chooses "Cloud" as the execution target and a cloud provider is already configured, **When** the run is started, **Then** the run is dispatched to that cloud provider and the chat panel follows its output.
5. **Given** the user chooses "Cloud" as the execution target and no cloud provider is configured, **When** the user attempts to start the run, **Then** the panel guides the user to configure a provider first and the run is not silently downgraded to local.
6. **Given** the selected agent does not support a given mode, model, or execution target, **When** the selectors are rendered, **Then** unsupported options are hidden or disabled with a tooltip explaining why.
7. **Given** a user changed mode or model between turns in an ongoing conversation, **When** the next message is sent, **Then** the chat panel clearly records which mode/model were used for each turn (so the transcript stays truthful).

---

### User Story 4 - Monitor Multiple Concurrent Agent Sessions (Priority: P4)

A user has more than one agent session running at the same time (for example, one Code-mode run in a worktree and one Plan-mode run in the cloud). The user can see them listed, switch between their chat panels, and tell at a glance which are active, blocked, completed, or failed.

**Why this priority**: Multi-session monitoring is a natural extension of P2 but is not required for the MVP. Without it, a single-session user still gets the full benefit of the chat panel.

**Independent Test**: Start three agent runs with different modes and targets. Confirm each is individually listed and reachable, and that their status indicators correctly reflect active vs. completed vs. failed.

**Acceptance Scenarios**:

1. **Given** three agent sessions are running, **When** the user views the running agents list, **Then** each session shows its agent name, mode, execution target, and status.
2. **Given** one session is blocked waiting for input, **When** the user looks at the list, **Then** that session is visibly flagged so it is not lost in the crowd.
3. **Given** one session fails, **When** the user clicks it, **Then** the chat panel opens with the failure explanation and recent transcript.

---

### Edge Cases

- The agent does not support mid-session interaction at all (one-shot prompt). The chat panel still renders the transcript but the input field is clearly disabled after the initial send, with an explanation ("This agent does not accept follow-up messages in the same session").
- The agent does not expose mode selection and is not in the gatomia catalog. The mode selector is hidden (not shown as an empty dropdown) so the user is not misled about available options.
- The agent does not expose model selection and is not in the gatomia catalog. Same behavior as missing modes: the selector is hidden.
- The agent's reported modes/models disagree with the gatomia catalog. The agent's reported set wins; the catalog is only used as a fallback when the agent is silent.
- The user closes the chat panel while the agent is still running. The agent continues to run in the background and the session remains clickable in the running agents list; reopening the panel restores its conversation.
- The user sends a follow-up message while the agent is mid-turn. The behavior is agent-specific, so the panel shows a clear indicator (queued, delivered, rejected) for each submitted follow-up.
- The worktree execution target fails to create a worktree (e.g. uncommitted conflicts, worktree directory already occupied, git not available). The chat panel shows the failure in the transcript before the agent is invoked and does not silently fall back to running against the primary checkout.
- Disk pressure from many un-cleaned-up worktrees. Because worktrees are never auto-deleted, the chat panel and/or the running agents list MUST make it easy to see which sessions still have a live worktree on disk and MUST offer the cleanup action without forcing the user to hunt for it.
- The cloud execution target loses connectivity mid-run. The chat panel shows a disconnected state and, when connectivity returns, attempts to reattach to the same remote session rather than starting a new one.
- An agent emits output much faster than the chat panel can render (high-throughput code generation). The panel remains responsive and does not lose messages.
- VS Code is closed or reloads while an ACP session is still running. The subprocess is killed (expected), the session's final in-memory state is flushed to persisted storage, and the session reappears on next launch as "ended by shutdown" with its transcript intact and its worktree still on disk for inspection.
- Very long runs produce very large transcripts. The panel remains usable (e.g. search, scrollback, selective expansion of large tool outputs) without freezing.
- The underlying log output channel is still emitted for debug/telemetry purposes. Users can opt to open it but it is no longer the primary surface.
- A non-ACP local agent run is triggered (e.g. a Copilot Chat participant, a gh-copilot CLI hook). The chat panel MUST NOT try to render it and MUST NOT redirect the user away from the agent's existing surface; that agent keeps its current UI per the Scope clarification.

## Requirements *(mandatory)*

### Functional Requirements

#### Scope

- **FR-000**: The chat panel feature applies to exactly two session sources: (1) **ACP agents**, which receive the full interactive chat experience (streaming output, follow-up input, mode/model/target selection); and (2) **Cloud provider sessions** from the multi-provider registry (spec 016), which open in the same chat panel as a **read-only progress monitor** with a cancel-only control and no follow-up input. Non-ACP local agents (GitHub Copilot Chat participants, gh-copilot CLI background executions, any other existing local agent surfaces) are **explicitly out of scope** and MUST retain their current UI unchanged.

#### Chat panel surface

- **FR-001**: System MUST render output from in-scope session sources (ACP agents, Cloud provider sessions) in a chat-style panel with a conversation history, clearly distinguishing user messages, agent messages, tool calls, and status/error events.
- **FR-002**: For ACP agent sessions, system MUST stream the agent's output into the chat panel as it arrives, so the user sees progress before the turn is complete. For Cloud provider sessions, system MUST surface new events in the chat panel at the cloud provider's existing update cadence (polling or push), with no extra perceptible lag on top of that cadence.
- **FR-003**: For ACP agent sessions, system MUST expose a text input that lets the user send a follow-up message to the running or paused agent whenever the agent can accept input. For Cloud provider sessions, system MUST NOT expose a follow-up input field in v1 (the panel is a read-only monitor) and MUST clearly label the panel as read-only.
- **FR-004**: System MUST clearly communicate to the user when the input field is unavailable or not offered (e.g. agent finished, ACP agent does not support follow-ups, run terminated, cloud session) with an explanation, never leaving the field silently unresponsive.
- **FR-005**: System MUST preserve the conversation history of a run after it ends, so users can review completed runs from the chat panel.

#### Session navigation

- **FR-006**: System MUST list currently running and recently completed agent sessions in a location the user can discover from the main extension UI (e.g. the Hooks view, a dedicated running-agents section, or another clearly visible place).
- **FR-007**: Users MUST be able to click an item representing a running or recent agent session and have that session's chat panel open (or come to focus if already open), restoring its full conversation and controls.
- **FR-008**: System MUST associate exactly one chat panel instance per agent session, avoiding duplicate panels for the same run and preventing cross-contamination of transcripts between sessions.
- **FR-009**: System MUST show the lifecycle state of each session (running, waiting for input, completed, failed, cancelled, ended by shutdown) both in the list of sessions and inside the chat panel header.

#### Mode, model, and target controls

- **FR-010**: System MUST offer a mode selector in the chat panel for ACP agent sessions when the active agent exposes multiple operating modes (such as "Code", "Ask", "Plan"). Cloud provider sessions MUST NOT show a mode selector (they inherit whatever mode the cloud provider is using).
- **FR-011**: System MUST offer a model selector in the chat panel for ACP agent sessions when the active agent exposes multiple models (including any custom or user-provided model it supports). Cloud provider sessions MUST NOT show a model selector in v1.
- **FR-011a**: System MUST discover an ACP agent's supported modes and models using **hybrid discovery**: (1) first, read any `modes`/`models` fields the agent reports in its ACP `initialize` response; (2) if the agent does not report those fields, fall back to a gatomia-maintained catalog (extending `KNOWN_AGENTS`) keyed by agent id; (3) if neither source provides values, hide the relevant selector. The extension MUST NOT invent modes or models that the agent has not either reported or been cataloged for.
- **FR-011b**: When the gatomia-maintained catalog declares modes/models for a known agent but the agent's `initialize` response reports a *different* set, the agent's reported set wins (it is more current than the catalog). The catalog is a fallback, never an override.
- **FR-012**: System MUST offer an execution target selector with exactly three options: run locally in the current workspace, run in an isolated git worktree of the current repository, or dispatch to a configured cloud agent provider (reusing the multi-provider adapters from spec 016, e.g. Devin or GitHub Copilot coding agent). "Cloud" MUST NOT be interpreted as running the local ACP agent against a remote host.
- **FR-013**: System MUST hide or clearly disable mode/model/execution-target options that the selected agent does not support, and MUST NOT silently rewrite the user's selection to a different option.
- **FR-014**: System MUST record, in the conversation transcript, which mode, model, and execution target were used for each turn so the history stays accurate. Mode and model MAY change between turns within a session (the next turn adopts the new selection, previous turns keep their original values in the transcript). Execution target is **fixed for the lifetime of a session** once the first turn has been produced (changing target requires starting a new session); the per-turn transcript field still carries the target so the format is uniform across all three fields.
- **FR-015**: When the user picks "Worktree" as the execution target for an ACP agent session, system MUST auto-create a **new isolated worktree per session** branched off the current HEAD, placed in a gatomia-managed directory (e.g. `.gatomia/worktrees/<session-id>/`) on a session-scoped branch, and run the agent there. Sessions MUST NOT share worktrees. The chat panel MUST display the worktree path and branch, and MUST NOT write anything into the primary checkout.
- **FR-015a**: System MUST NOT auto-delete a session's worktree at any point (not on session end, not on panel close, not on time-based TTL). Worktrees persist until the user explicitly cleans them up.
- **FR-015b**: The chat panel MUST expose a "clean up worktree" action for each session whose target was Worktree. The action MUST warn about uncommitted changes and let the user cancel before any destructive step occurs.
- **FR-015c**: When worktree creation fails (e.g. the target path already exists, the repository has blocking conflicts, git is not available), the chat panel MUST surface the failure in the transcript and MUST NOT start the agent against the primary checkout as a silent fallback.
- **FR-016**: When the user picks "Cloud" as the execution target, system MUST dispatch the run through the currently active cloud agent provider adapter (from spec 016's multi-provider registry) and reflect that provider's progress in the chat panel without forcing the user to leave it to monitor the run. The chat panel in this case follows the cloud provider's session, not a local ACP agent subprocess.
- **FR-017**: System MUST guide the user to configure a cloud provider first when "Cloud" is chosen but no provider is configured, rather than silently falling back to local execution.

#### Interaction, lifecycle, and safety

- **FR-018**: System MUST allow the user to cancel a running agent session from the chat panel. Cancel MUST be available for both ACP agent sessions and Cloud provider sessions (the latter routing the cancel through the cloud provider adapter per spec 016).
- **FR-019**: System MUST continue running the agent in the background when the user closes the chat panel, and MUST let the user reopen the same session later to resume monitoring or interacting.
- **FR-019a**: System MUST persist each session's transcript and metadata (agent id, mode, model, execution target, lifecycle state, timestamps, worktree path/branch where applicable, trigger origin) to per-workspace storage so the session survives VS Code restarts for review.
- **FR-019b**: On the next VS Code launch, system MUST reappear each persisted session in the running agents list. ACP sessions that were running at shutdown MUST be shown with lifecycle state "ended by shutdown" and their transcript MUST be re-openable in the chat panel in read-only mode. System MUST NOT attempt to respawn ACP subprocesses on launch.
- **FR-019c**: On the next VS Code launch, Cloud provider sessions that are still live remotely MUST re-attach via spec 016's existing multi-provider polling and resume reflecting updates in the chat panel. Cloud sessions that finished while VS Code was closed MUST appear with their final lifecycle state and full transcript retrieved from the provider where the provider supports it.
- **FR-020**: System MUST show a visibly actionable error state in the chat panel when the agent fails, times out, or loses its connection, including a retry or reopen-in-cloud-provider control where appropriate.
- **FR-021**: System MUST remain usable (responsive scrolling, no UI freeze) for high-throughput output and long transcripts, within reason for the user's machine.
- **FR-022**: System MUST still expose the existing agent log output channel for debugging and telemetry purposes, so advanced users and support tooling retain access to raw output, even though the chat panel is now the primary surface.

### Key Entities

- **Agent Session**: A single end-to-end run of an agent triggered by the user or by an automation (such as a hook). Has an identifier, the originating agent, selected mode, selected model, selected execution target, lifecycle state (including `ended_by_shutdown` for ACP sessions interrupted by VS Code exit), timestamps, worktree path/branch (when the execution target is Worktree), a link back to the thing that triggered it, and is persisted per workspace so it survives VS Code restarts for review.
- **Chat Message**: A single entry in the Agent Session's conversation. Has an author role (user, agent, system/tool), content, timestamp, and optionally a reference to the mode/model in effect when it was produced. Tool calls and errors are represented as specialized message kinds so they render distinctly.
- **Agent Capabilities**: A per-agent description of what the agent supports: which modes, which models, which execution targets, and whether it accepts follow-up input. Resolved by hybrid discovery — agent-reported (via ACP `initialize`) first, gatomia-maintained catalog (extending `KNOWN_AGENTS`) as fallback, "no selector" when neither source has a value. Drives which controls are shown or hidden in the chat panel.
- **Execution Target**: The location where the agent actually runs. One of: local workspace, isolated worktree (per-session, gatomia-managed directory + session-scoped branch, never auto-deleted), or a configured cloud provider. Carries enough context (worktree path and branch, or cloud session URL) for the chat panel to let the user inspect or jump to the underlying artifacts and trigger cleanup actions where applicable.
- **Running Agents List Entry**: A discoverable, clickable item representing an active or recent Agent Session, visible in the main extension UI and used as the entry point to re-open a session's chat panel.

## Assumptions

- The existing agent log output channel is retained as a diagnostic surface; the chat panel supersedes it as the primary user-facing surface but does not delete it. This keeps existing debugging and support workflows working.
- "Worktree" refers to a git worktree of the current repository, created and managed by the extension so the agent can work in an isolated checkout without disturbing the primary one. Per the 2026-04-24 clarification, each ACP session receives its own fresh worktree branched off current HEAD in `.gatomia/worktrees/<session-id>/`, and worktrees are never auto-deleted — cleanup is an explicit user action from the chat panel.
- "Cloud" execution is defined (see Clarifications, 2026-04-24) as dispatch to a configured cloud agent provider (Devin, GitHub Copilot coding agent, any future provider registered in spec 016's multi-provider registry). No new cloud provider and no new remote-execution transport are introduced by this feature; the chat panel acts as a unified front-end over the existing multi-provider adapters.
- Mode/model options follow the hybrid discovery resolved in the 2026-04-24 clarification: agent-reported first (ACP `initialize`), gatomia catalog (extending `KNOWN_AGENTS`) as fallback, hidden selector when neither source has a value. The extension never fabricates modes or models.
- By default, the chat panel auto-opens the first time an agent run begins in a session, but the user can dismiss it and reopen on demand from the running agents list.
- Agent session transcripts and metadata are persisted per workspace (per the 2026-04-24 clarification). ACP subprocesses die with the VS Code window and are not respawned on next launch; their transcripts reappear in lifecycle state "ended by shutdown" and are re-openable read-only. Cloud provider sessions re-attach via spec 016's existing polling on next launch. Worktrees remain on disk and stay linked to their (now-ended) session until the user explicitly cleans them up.
- Only one chat panel is active per Agent Session; a user may view multiple sessions by switching between their respective panels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When an agent run begins, users can see the agent's output appearing in a chat-style conversation within 2 seconds of the run starting (no need to open a separate log window to understand progress).
- **SC-002**: For agents that accept follow-up input, users can successfully send a follow-up message and see it delivered to the agent within 1 second of submission in at least 95% of attempts.
- **SC-003**: Users can locate and re-open the chat panel of any running or recently completed agent session in no more than two interactions (e.g. one click on a running-item, one keyboard shortcut).
- **SC-004**: For agents that expose modes, models, or execution targets, users can change the selection and start a run with their chosen configuration without editing configuration files or using the command palette.
- **SC-005**: When the user selects "Worktree" as the execution target, 100% of resulting agent file changes land in the isolated worktree and none in the primary workspace checkout.
- **SC-006**: When the user selects "Cloud" as the execution target with a configured provider, the chat panel shows live status updates from the cloud provider with no more than a 30-second lag (matching the existing cloud polling cadence).
- **SC-007**: Closing and reopening the chat panel while the agent is still running preserves 100% of the conversation already accumulated (no data loss, no duplicate messages on reopen).
- **SC-008**: When an agent does not support a given control (mode / model / execution target), 0% of users see an enabled-but-non-functional control for that capability in usability review.
- **SC-009**: Switching focus between two concurrent agent sessions takes no more than 1 interaction (click on the target session's list entry) and displays the correct transcript with no bleed-through from the other session.
- **SC-010**: Support tickets or logged issues attributable to "agent output hidden in log window" drop meaningfully after launch, demonstrating that the chat panel has become the primary user-facing surface for agent interaction.
- **SC-011**: After a VS Code restart, 100% of previously persisted agent sessions reappear in the running agents list with the correct final state (ACP sessions that were running at shutdown appear as "ended by shutdown"; cloud sessions re-attach if still live remotely), and 0% of transcripts are silently lost.
