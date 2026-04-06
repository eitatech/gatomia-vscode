# Feature Specification: Hooks Refactor - Model Selection, MCP Grouping, Git/GitHub Expansion, and ACP Integration

**Feature Branch**: `001-hooks-refactor`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "Refactor Hooks to improve their structure and organization. Specifically: 1. Model Selection Menu - dynamic model list from user subscription. 2. MCP Tools Grouping by provider. 3. Git/GitHub Operations Enhancement. 4. ACP (Agent Client Protocol) integration for delegating tasks to external coding agents."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dynamic Model Selection from Subscription (Priority: P1)

A developer configuring a hook's "Custom Tools" or "Custom Agent" action wants to select the AI model that will power the execution. Currently the model list is hardcoded and may show models unavailable to their subscription tier, causing confusion. The model dropdown should automatically reflect only the models the user can actually use.

**Why this priority**: This is the most immediate friction point — users see and potentially select models they don't have access to, leading to failed hook executions with cryptic errors. Fixing this builds trust and reduces support requests.

**Independent Test**: Can be fully tested by opening any hook with a model selection field, verifying the dropdown shows models matching the user's subscription, and confirming unavailable models are absent — delivering immediate clarity on what the user can use.

**Acceptance Scenarios**:

1. **Given** a user with a GitHub Copilot Individual subscription, **When** they open the model selection dropdown in a hook's action configuration, **Then** only models included in their active subscription tier are listed.
2. **Given** a user whose subscription does not include a previously selected model, **When** they open an existing hook that references that model, **Then** the model field shows a warning and prompts re-selection from the current available list.
3. **Given** the model list cannot be fetched (offline or API unavailable), **When** the user opens the model dropdown, **Then** the last known list is shown with a notice indicating it may be outdated, and a fallback default model is pre-selected.
4. **Given** the user's subscription changes (upgrade or downgrade), **When** they next open the hook configuration panel, **Then** the model list refreshes to reflect the new subscription state.

---

### User Story 2 - MCP Tools Grouped by Provider (Priority: P2)

A developer adding a "Custom Tools" hook action needs to select which MCP tools the hook will use. Currently all tools appear under a generic "Other Tools" group regardless of their origin. Grouping tools by the MCP server/provider they belong to makes it far easier to find the right tool and understand its context.

**Why this priority**: High discoverability impact. Workspaces with many MCP servers produce large flat lists that are hard to navigate. Grouping by provider is a pure UX improvement with no breaking changes.

**Independent Test**: Can be fully tested by opening the MCP tool selection interface in a hook action and verifying that tools from different servers appear under distinct labeled groups matching their provider names — delivering clear organization without any functional regression.

**Acceptance Scenarios**:

1. **Given** a workspace with three configured MCP servers (e.g., GitHub, Jira, Slack), **When** the user opens the MCP tool picker in a hook action, **Then** tools are organized into collapsible groups, each labeled with its provider name.
2. **Given** a workspace where all discovered tools come from a single MCP server, **When** the user opens the tool picker, **Then** a single group is shown with that server's name as the heading.
3. **Given** a tool that cannot be assigned a server (orphaned/unknown origin), **When** the tool picker is displayed, **Then** it appears under an "Other" group at the bottom of the list.
4. **Given** the user has previously selected tools from multiple providers, **When** they re-open the hook configuration, **Then** the previously selected tools are pre-checked in their respective provider groups.

---

### User Story 3 - Expanded Git and GitHub Operation Options (Priority: P3)

A developer using hook automation for their feature development workflow finds the current Git and GitHub actions too limited. Git only supports "commit" and "push". GitHub only supports "open-issue", "close-issue", "create-pr", and "add-comment". A richer set of operations would allow hooks to drive more of the development lifecycle automatically.

**Why this priority**: Important for power users and CI-like automation scenarios, but does not block basic usage. Expanding operations is additive and backward compatible.

**Independent Test**: Can be fully tested by creating a hook using each new operation type, confirming configuration fields appear correctly, and verifying the action executes as expected — delivering measurably more workflow automation options.

**Acceptance Scenarios**:

1. **Given** a developer configuring a Git hook action, **When** they select the operation type, **Then** they can choose from: commit, push, create-branch, checkout-branch, pull, merge, tag, and stash.
2. **Given** a developer configuring a GitHub hook action, **When** they select the operation type, **Then** they can choose from: open-issue, close-issue, create-pr, merge-pr, close-pr, add-comment, add-label, remove-label, request-review, assign-issue, and create-release.
3. **Given** a developer selects "create-branch" as a Git operation in a hook, **When** the hook fires, **Then** a new branch is created using a name derived from the configured template variables (e.g., feature name, timestamp).
4. **Given** a developer selects "create-release" as a GitHub operation, **When** the hook fires, **Then** a GitHub release is created with a tag and release notes populated from the configured templates.
5. **Given** an existing hook configured with a legacy operation (e.g., "commit" or "open-issue"), **When** the extension loads, **Then** the hook continues to function without modification.

---

### User Story 4 - ACP Agent Integration for Task Delegation (Priority: P2)

A developer wants to configure a hook that, when triggered, delegates a coding task to an external ACP-compatible agent (such as a remote cloud agent or a locally running agent process). This is analogous to the existing "Custom Agent" option but leverages the standardized Agent Client Protocol, providing more flexibility: the user can target both local ACP agents (running in-process or via the editor chat window) and remote ACP agents (cloud-hosted), and can pass structured task context to them.

**Why this priority**: This is a strategic capability that unlocks interoperability with the growing ecosystem of ACP-compatible agents. It shares priority with MCP grouping because it directly addresses the user's explicit request and provides novel value unavailable today.

**Independent Test**: Can be fully tested by creating a hook with an "ACP Agent" action type, pointing it at a running local ACP agent, firing the trigger, and confirming the agent receives the task payload and responds — delivering verifiable cross-agent task delegation.

**Acceptance Scenarios**:

1. **Given** a developer creating a new hook action of type "ACP Agent", **When** they configure it, **Then** they can choose between two execution modes: "Local Agent" (communicates with an in-process or chat-window agent via stdio/JSON-RPC) and "Remote Agent" (communicates with a cloud-hosted agent over HTTP/WebSocket).
2. **Given** a developer selects "Local Agent" mode and specifies an ACP-compatible agent, **When** the hook fires, **Then** the task payload (including trigger context, template variables, and user-defined instructions) is sent to the local agent using the ACP protocol, and the agent's response is captured and logged.
3. **Given** a developer selects "Remote Agent" mode and provides an endpoint URL, **When** the hook fires, **Then** the task is dispatched to the remote agent over HTTP/WebSocket using the ACP protocol format, with configurable authentication credentials.
4. **Given** an ACP agent is unavailable (local process not running or remote endpoint unreachable), **When** the hook fires, **Then** the hook execution is marked as failed with a clear, actionable error message, and the developer is not left with a silent failure.
5. **Given** a developer configures the ACP agent hook, **When** they select the agent, **Then** the extension discovers and lists available local ACP agents from the workspace (similar to how custom agents are discovered from `.github/agents/`) alongside any manually entered remote endpoints.
6. **Given** the ACP hook executes successfully, **When** the hook log is viewed, **Then** the agent's response content is captured and available as a template variable (`$acpAgentOutput`) for downstream hooks.

---

### Edge Cases

- What happens when the subscription API returns an empty model list? Show the fallback default model and an explanatory notice; do not leave the field blank.
- What happens if an MCP server is discovered with no tools? The server group is omitted from the tool picker to avoid showing empty groups.
- What happens when a Git operation (e.g., "create-branch") fails because the branch already exists? The hook logs the conflict error and does not re-try automatically; user is notified.
- What happens when a GitHub operation fails due to insufficient repository permissions? The hook logs an authorization error with guidance to check repository access.
- What happens if an ACP agent takes longer than the configured timeout to respond? The hook execution is cancelled and marked as timed out; partial responses are discarded.
- What happens when a user downgrades their subscription and existing hooks reference models or operations no longer available? Hooks are preserved but flagged as having an invalid configuration; they do not execute until reconfigured.

## Requirements *(mandatory)*

### Functional Requirements

**Model Selection**

- **FR-001**: The model selection field in hook actions MUST query the user's active GitHub Copilot subscription to retrieve the list of available models at configuration time.
- **FR-002**: The model dropdown MUST display only models confirmed as available for the authenticated user's subscription tier.
- **FR-003**: If a hook references a model no longer available in the user's subscription, the system MUST surface a visible warning in the hook configuration and prevent **saving** the hook until a valid model is selected. (This aligns with SC-001: zero hooks can be saved referencing an unavailable model. Execution-time blocking is a secondary safeguard but save-time prevention is the primary enforcement point.)
- **FR-004**: The model list MUST be refreshed whenever the hook configuration panel is opened; the previous list MAY be cached for a short period (up to 5 minutes) to avoid repeated API calls.
- **FR-005**: When the model list cannot be fetched, the system MUST fall back to the last known cached list and display an "offline" indicator, never showing an empty selector.

**MCP Tools Grouping**

- **FR-006**: The MCP tool picker MUST group available tools by their originating MCP server/provider, using the server's display name as the group label.
- **FR-007**: Tools from unknown or unassignable servers MUST be collected under an "Other" group rendered at the bottom of the picker.
- **FR-008**: Provider groups MUST be presented in alphabetical order by server name; tools within each group MUST also be sorted alphabetically.
- **FR-009**: The tool picker MUST preserve previously selected tools across provider groups when the hook configuration is re-opened.
- **FR-010**: Empty provider groups (servers with no available tools) MUST NOT be shown in the picker.

**Git Operations Enhancement**

- **FR-011**: The Git action type MUST support the following operations: commit, push, create-branch, checkout-branch, pull, merge, tag, stash.
- **FR-012**: Each new Git operation MUST expose a configuration form with the fields relevant to that operation (e.g., branch name template for create-branch, tag name template for tag).
- **FR-013**: Git operations MUST support template variables (e.g., `$branch`, `$timestamp`, `$specId`) in all name and message fields.
- **FR-014**: Existing hooks using legacy Git operations (commit, push) MUST continue to work without any migration required.

**GitHub Operations Enhancement**

- **FR-015**: The GitHub action type MUST support the following operations: open-issue, close-issue, create-pr, merge-pr, close-pr, add-comment, add-label, remove-label, request-review, assign-issue, create-release.
- **FR-016**: Each GitHub operation MUST expose only the configuration fields required for that operation (e.g., reviewer username for request-review, release tag and notes template for create-release).
- **FR-017**: GitHub operations MUST support template variables in all text fields (title, body, labels, tag names).
- **FR-018**: Existing hooks using legacy GitHub operations MUST continue to work without any migration required.

**ACP Agent Integration**

- **FR-019**: A new hook action type "ACP Agent" MUST be available alongside existing action types (Agent Commands, Git Operations, GitHub Tools, Custom Agents, Custom Tools).
- **FR-020**: The ACP Agent action MUST support two execution modes: "Local Agent" and "Remote Agent". *(Iteration 1 scope: only "Local Agent" mode is implemented. "Remote Agent" mode is deferred — see research.md Decision 5. The UI MAY display the mode field but MUST lock it to "Local Agent" with a "Remote — coming soon" disabled option.)*
- **FR-021**: In "Local Agent" mode, the system MUST communicate with the selected agent using the ACP protocol over stdio/JSON-RPC, consistent with ACP's local agent specification.
- **FR-022**: In "Remote Agent" mode, the system MUST dispatch tasks to the configured endpoint URL using the ACP protocol over HTTP or WebSocket. *(Out of scope for Iteration 1 — remote ACP transport spec is still in draft. Deferred to a follow-up feature.)*
- **FR-023**: The ACP Agent configuration form MUST include: execution mode selector, agent/endpoint selector, task instruction field (supports template variables), and optional authentication configuration for remote agents. *(Iteration 1 scope: authentication configuration fields are omitted; endpoint selector is omitted. Only agentCommand, agentDisplayName, taskInstruction, and cwd fields are required in this iteration.)*
- **FR-024**: The system MUST discover available local ACP agents from the workspace (e.g., from `.github/agents/` or equivalent ACP discovery paths) and present them in a dropdown alongside manually entered remote endpoints.
- **FR-025**: ACP hook execution MUST capture the agent's response and expose it as `$acpAgentOutput` for use in subsequent downstream hooks or logging.
- **FR-026**: Failed ACP executions MUST be logged with actionable error messages; silent failures are not permitted.
- **FR-027**: The ACP Agent action MUST respect the global hook timeout setting, cancelling the agent call if it exceeds the configured limit.

### Key Entities

- **Hook Action (ACP Agent)**: A new variant of `ActionConfig` with type `"acp"`, containing execution mode, endpoint/agent reference, task instruction template, and optional auth credentials.
- **ACP Execution Mode**: Enumerated as `"local"` (stdio/JSON-RPC) or `"remote"` (HTTP/WebSocket), determining how the ACP task payload is dispatched.
- **ACP Agent Descriptor**: A discoverable agent entry combining a display name, discovery source (file-based or manual entry), and the communication endpoint or process command.
- **Model Availability Record**: A cached record of models available to the authenticated user, including the subscription tier they belong to and their fetch timestamp.
- **MCP Provider Group**: A logical grouping of MCP tools under a single server/provider, used only for UI presentation; does not affect stored hook data.
- **Git/GitHub Extended Operations**: Extensions of existing `GitOperation` and `GitHubOperation` union types with additional operation variants and their corresponding parameter shapes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users configuring hook model selection see only models available to their subscription — zero hooks can be saved referencing an unavailable model.
- **SC-002**: Time to find and select a specific MCP tool in a workspace with 5+ MCP servers is reduced by at least 50% compared to the current flat list, as measured by task completion time in usability review.
- **SC-003**: Developers can automate at least 80% of common feature development lifecycle events using hook actions without leaving the extension. The following 10 events are the measurable baseline — 8 or more must be automatable: (1) create feature branch, (2) commit changes, (3) push branch, (4) open pull request, (5) merge pull request, (6) close pull request, (7) open issue, (8) close issue, (9) add label to issue/PR, (10) create release. Verified by manual acceptance task T067b.
- **SC-004**: ACP agent hook executions complete end-to-end (task sent, response received, logged) within the configured timeout in at least 95% of cases. "Normal network conditions" for this criterion means: local agent mode (no network involved), OR remote agent over a connection with latency ≤ 200ms and packet loss ≤ 1%, measured in integration tests using a mocked local subprocess.
- **SC-005**: Zero regressions in existing hook configurations — all hooks created before this refactor continue to execute correctly after the update.
- **SC-006**: Hook configuration errors due to stale or invalid model references are surfaced to the user at configuration time, reducing failed hook executions caused by model unavailability by 100%.
- **SC-007**: Developers can discover and connect to a local ACP agent in under 60 seconds from first opening the ACP agent configuration form.

## Assumptions

- The GitHub Copilot API (or VS Code Copilot extension API) exposes a method to enumerate models available for the authenticated user's subscription; if this API does not exist, a fallback of fetching from a known endpoint and filtering by subscription tier will be used.
- ACP local agent discovery will follow the same workspace scanning conventions used by the existing Custom Agent feature (`.github/agents/` directory) but filtered to ACP-compatible descriptors.
- Remote ACP agent authentication will support Bearer token auth as a minimum; OAuth flows are out of scope for this iteration.
- The expanded Git operations (pull, merge, create-branch, etc.) will be executed via the existing `git-utils.ts` module, which wraps the VS Code Git extension API.
- Backward compatibility is non-negotiable: all existing hook configurations must continue to work after this refactor with no user intervention.
- MCP provider grouping is a presentation-only change; the underlying `SelectedMCPTool` data structure remains unchanged, ensuring stored hook data requires no migration.
