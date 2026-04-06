# Feature Specification: Multi-Provider Cloud Agent Support

**Feature Branch**: `016-multi-provider-agents`  
**Created**: 2025-07-14  
**Status**: Draft  
**Input**: User description: "Today we have Devin Process area where we show all tasks running in Devin, but we don't want vendor lock-in to Devin or any other cloud agent development platform. The main idea is to be more flexible and work with multiple providers (Devin, GitHub Copilot Agent, and others). The component must ask which cloud agent solution will be used, configure it accordingly, and show the progress of tasks running on that provider."

## Clarifications

### Session 2025-07-14

- Q: What is the GitHub Copilot Agent integration backed by? → A: GitHub Copilot coding agent (assigns issues to Copilot, tracks PRs created from issues via GitHub API)
- Q: How should the provider selection be presented to the user? → A: Tree view welcome content (welcome view in the Cloud Agents sidebar with provider buttons and descriptions)
- Q: Can a user have tasks running on multiple providers simultaneously? → A: Single active provider at a time; previous provider sessions become read-only
- Q: How should existing Devin users be migrated to the multi-provider version? → A: Auto-migrate silently (detect existing Devin credentials and set Devin as active provider automatically)
- Q: How long should read-only sessions from a previously active provider be retained? → A: Same retention policy as active sessions (7-day cleanup, consistent with existing cleanup service)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select and Configure a Cloud Agent Provider (Priority: P1)

A user opens the Cloud Agents area for the first time (or wants to change providers). The system presents a list of supported cloud agent providers (e.g., Devin, GitHub Copilot coding agent). The user selects their preferred provider and enters the required credentials or configuration. Once configured, the Cloud Agents area adapts its UI, commands, and behavior to work with the selected provider.

**Why this priority**: This is the foundational capability. Without provider selection, the system remains locked to a single provider. Every other story depends on knowing which provider is active.

**Independent Test**: Can be fully tested by opening the Cloud Agents area, selecting a provider, entering credentials, and verifying the area reflects the chosen provider's branding and configuration state.

**Acceptance Scenarios**:

1. **Given** no provider is configured, **When** the user opens the Cloud Agents area, **Then** the system displays a tree view welcome content with provider buttons and descriptions listing all supported providers.
2. **Given** the provider selection prompt is displayed, **When** the user selects "Devin", **Then** the system prompts for Devin-specific credentials (API token) and stores them securely.
3. **Given** the provider selection prompt is displayed, **When** the user selects "GitHub Copilot coding agent", **Then** the system prompts for GitHub-specific configuration (personal access token) and stores it securely.
4. **Given** a provider is already configured, **When** the user triggers the "Change Provider" action, **Then** the system displays the provider selection prompt again, allowing the user to switch.
5. **Given** a provider is configured, **When** the user opens the Cloud Agents area, **Then** the area displays the provider name and status without requiring re-selection.

---

### User Story 2 - View Task Progress for the Active Provider (Priority: P2)

A user has configured a cloud agent provider and dispatched one or more tasks. The Cloud Agents area displays active and recent sessions/tasks from the configured provider, showing real-time status updates, task details, and links to the provider's external UI.

**Why this priority**: Viewing task progress is the core value proposition of the Cloud Agents area. Once a provider is selected, users need to see what their cloud agent is doing.

**Independent Test**: Can be fully tested by configuring a provider, creating a task, and verifying that the tree view and webview panel display correct session status, task list, and external links.

**Acceptance Scenarios**:

1. **Given** Devin is the active provider and sessions exist, **When** the user views the Cloud Agents area, **Then** the system displays Devin sessions with their status, tasks, and pull requests.
2. **Given** GitHub Copilot coding agent is the active provider and tasks are running, **When** the user views the Cloud Agents area, **Then** the system displays GitHub Issues assigned to Copilot with their status, linked PRs, and output links.
3. **Given** the active provider has an active session, **When** the session status changes (e.g., running to completed), **Then** the Cloud Agents area updates automatically via polling or event notification.
4. **Given** a session is completed with a pull request, **When** the user views the session details, **Then** a link to the pull request is displayed and clickable.

---

### User Story 3 - Dispatch a Task to the Active Provider (Priority: P3)

A user wants to send a spec task to the active cloud agent provider for execution. The system uses the active provider's dispatch mechanism to create a session/task, and the Cloud Agents area begins tracking its progress.

**Why this priority**: Dispatching tasks is the action that triggers cloud agent work. It builds on provider selection (P1) and progress viewing (P2) to complete the core workflow loop.

**Independent Test**: Can be fully tested by selecting a spec task, triggering "Run with Cloud Agent", and verifying the provider receives the task and the Cloud Agents area starts tracking the new session.

**Acceptance Scenarios**:

1. **Given** Devin is the active provider, **When** the user triggers "Run with Cloud Agent" on a spec task, **Then** the system creates a Devin session via the Devin API and begins tracking it.
2. **Given** GitHub Copilot coding agent is the active provider, **When** the user triggers "Run with Cloud Agent" on a spec task, **Then** the system creates a GitHub Issue assigned to Copilot via the GraphQL API and begins tracking it.
3. **Given** no provider is configured, **When** the user triggers "Run with Cloud Agent", **Then** the system redirects the user to the provider selection flow before proceeding.

---

### User Story 4 - Cancel or Manage a Running Task (Priority: P4)

A user wants to cancel a running task or manage session lifecycle (e.g., respond to a blocked session). The system routes the cancel/manage action to the active provider's API.

**Why this priority**: Task management is important but secondary to the core workflow of select-dispatch-view. It ensures users are not stuck with runaway tasks.

**Independent Test**: Can be fully tested by starting a task, triggering cancel, and verifying the provider receives the cancellation and the Cloud Agents area reflects the cancelled state.

**Acceptance Scenarios**:

1. **Given** a Devin session is running, **When** the user cancels the session from the Cloud Agents area, **Then** the system calls the Devin API to cancel and updates the session status to "cancelled".
2. **Given** a GitHub Copilot coding agent task is running, **When** the user cancels the task from the Cloud Agents area, **Then** the system unassigns Copilot from the GitHub Issue via the GraphQL API and updates the task status to "cancelled".
3. **Given** a Devin session is blocked, **When** the system detects the blocked state, **Then** the user is notified with an option to open the session in the provider's external UI.

---

### User Story 5 - Add a New Provider in the Future (Priority: P5)

A developer wants to add support for a new cloud agent provider (e.g., a hypothetical "AgentX"). They implement a provider adapter following the established contract, register it, and the new provider appears in the selection prompt without modifying core logic.

**Why this priority**: Extensibility is the long-term goal that motivates the entire refactor. It ensures the architecture supports future providers without re-engineering.

**Independent Test**: Can be fully tested by creating a new adapter that implements the provider contract, registering it, and verifying it appears in the provider selection list and can be configured/used.

**Acceptance Scenarios**:

1. **Given** a new provider adapter is implemented and registered, **When** the user opens the provider selection prompt, **Then** the new provider appears in the list alongside existing providers.
2. **Given** the new provider is selected and configured, **When** the user dispatches a task, **Then** the task is routed to the new provider's dispatch mechanism.

---

### Edge Cases

- What happens when the user switches providers while tasks from the previous provider are still active? The system should warn the user that switching will make those sessions read-only (no new dispatches or cancellations), but they remain visible in the tree view for reference.
- What happens when a provider's API credentials expire or become invalid mid-session? The system should detect authentication failures, notify the user, and offer to re-configure credentials without losing session history.
- What happens when a provider's external service is temporarily unavailable? The system should handle network/API errors gracefully, show a degraded state indicator, and retry on the next poll cycle.
- What happens when the user has never configured any provider and tries to dispatch a task from the Spec Explorer? The system should intercept the action and redirect to provider selection first.
- What happens when stored provider configuration references a provider that has been removed from the supported list (e.g., after an extension update)? The system should detect the orphaned configuration, notify the user, and prompt them to select a new provider.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a provider selection mechanism via tree view welcome content in the Cloud Agents sidebar, listing all supported cloud agent providers with descriptions and allowing the user to choose one.
- **FR-002**: System MUST support at least two providers at launch: Devin and GitHub Copilot coding agent (which assigns GitHub Issues to Copilot and tracks the resulting PRs via GitHub API).
- **FR-003**: System MUST store the selected provider preference persistently per workspace. Only one provider may be active at a time; sessions from a previously active provider remain visible in read-only mode.
- **FR-004**: System MUST store provider-specific credentials securely (using the existing secrets storage mechanism).
- **FR-005**: System MUST adapt the Cloud Agents tree view to display sessions/tasks from the active provider, plus read-only sessions from previously active providers in a separate section.
- **FR-006**: System MUST adapt the Cloud Agents webview panel to display progress data from the active provider using provider-appropriate labels and structure.
- **FR-007**: System MUST route task dispatch actions ("Run with Cloud Agent") to the active provider's task creation mechanism.
- **FR-008**: System MUST route session/task cancellation actions to the active provider's cancellation mechanism.
- **FR-009**: System MUST poll or subscribe to the active provider for session/task status updates and reflect changes in the UI.
- **FR-010**: System MUST notify the user when a running session encounters a blocking condition (e.g., Devin session blocked, GitHub workflow waiting for approval).
- **FR-011**: System MUST allow the user to switch providers at any time via a dedicated command or UI action.
- **FR-012**: System MUST preserve the existing Devin integration behavior as-is when Devin is the selected provider (no regression).
- **FR-013**: System MUST define a provider adapter contract that new providers can implement to integrate into the system.
- **FR-014**: System MUST display provider-specific external links (e.g., Devin session URL, GitHub Actions run URL) in session details.
- **FR-015**: System MUST handle provider API errors gracefully, displaying user-friendly error messages and retry options.
- **FR-016**: System MUST log significant provider operations (selection, configuration, dispatch, polling, errors) with sufficient context for debugging.
- **FR-017**: System MUST sync completed task results back to spec task files regardless of which provider completed the work.
- **FR-018**: System MUST auto-migrate existing Devin users by detecting stored Devin credentials and silently setting Devin as the active provider on first activation after upgrade, requiring no user action.
- **FR-019**: System MUST apply the same retention policy (7-day cleanup) to read-only sessions from previously active providers as it does to active provider sessions.
- **FR-020**: System MUST detect authentication failures during polling or dispatch (e.g., expired tokens, revoked credentials), notify the user with an actionable error message, and offer to re-configure credentials without losing session history.
- **FR-021**: System MUST detect when the stored active provider ID references a provider that is no longer registered (e.g., removed after an extension update), notify the user, and redirect to the provider selection flow.

### Key Entities

- **Cloud Agent Provider**: Represents a supported cloud agent platform (e.g., Devin, GitHub Copilot coding agent). Has a unique identifier, display name, required configuration fields, and adapter logic.
- **Provider Configuration**: The stored settings and credentials for a specific provider within a workspace. Includes provider identifier, credential references, and provider-specific options.
- **Agent Session**: A unit of work dispatched to a cloud agent provider. Contains status, associated tasks, timestamps, external URLs, and pull request references. Provider-agnostic in structure but populated by provider-specific adapters.
- **Agent Task**: A single task within a session, linked to a spec task. Contains title, description, priority, status, and timing information.
- **Provider Adapter**: The contract/interface that each provider implements to integrate with the system. Defines methods for credential management, session creation, session polling, session cancellation, and status mapping.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select and configure a cloud agent provider within 60 seconds of first interaction with the Cloud Agents area.
- **SC-002**: All existing Devin integration functionality works identically when Devin is the selected provider (zero regression).
- **SC-003**: Users can view real-time task progress from any configured provider with status updates reflected within the polling interval (default 30 seconds).
- **SC-004**: Users can dispatch a spec task to the active provider with no more interaction steps than the current Devin-only flow (plus the one-time provider selection).
- **SC-005**: A new provider adapter can be added by implementing the provider contract and registering it, without modifying core Cloud Agents area logic.
- **SC-006**: The system handles provider API failures without crashing, displaying actionable error messages within 5 seconds of failure detection.
- **SC-007**: Provider switching preserves workspace state and does not lose session history from previously active providers. Read-only sessions are retained for 7 days, consistent with the active session cleanup policy.
