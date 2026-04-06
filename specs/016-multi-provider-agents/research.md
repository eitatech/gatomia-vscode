# Research: Multi-Provider Cloud Agent Support

## Decisions & Rationale

### Decision 1: GitHub Copilot Integration Mechanism

**Decision**: GitHub Copilot coding agent (assigns issues to Copilot, tracks PRs created from issues via GitHub API)

**Rationale**: This is the most mature, publicly available autonomous coding agent from GitHub, with clear API surfaces for tracking issue-to-PR workflows. It aligns directly with the spec's "show progress of a task running on GitHub" description.

**Alternatives considered**:
- GitHub Actions workflows: Would require custom workflow definitions, more complex setup
- GitHub Copilot Extensions: Less mature, more complex to implement

---

### Decision 2: Provider Selection UX

**Decision**: Tree view welcome content in the Cloud Agents sidebar

**Rationale**: Consistent with existing extension UX patterns, follows VS Code UX guidelines for empty-state views, and keeps the experience within the sidebar where users already interact with cloud agents. The existing Devin area shows a "Configure Credentials" welcome when no credentials are set - this pattern is extended for provider selection.

**Alternatives considered**:
- VS Code Quick Pick: Less discoverable, doesn't provide rich provider descriptions
- Webview panel: More development effort, less consistent with sidebar UX

---

### Decision 3: Multi-Provider Concurrency Model

**Decision**: Single active provider at a time; previous provider sessions become read-only

**Rationale**: Keeps the UX simple, avoids complex multi-provider state management, and aligns with the YAGNI principle. Users can still see historical sessions from a previous provider, but new dispatches always go to the active one. Multi-provider concurrency can be added later if demand emerges.

**Alternatives considered**:
- Multiple concurrent providers: Would require significant additional complexity to group sessions by provider in the UI and manage separate polling cycles

---

### Decision 4: Migration Strategy for Existing Devin Users

**Decision**: Auto-migrate silently (detect existing Devin credentials and set Devin as active provider automatically)

**Rationale**: Ensures zero friction for existing users - they see no change in behavior after upgrading. Respects the no-regression requirement (FR-012) and avoids forcing users through provider selection when their intent is obvious.

**Alternatives considered**:
- Auto-migrate with notification: Adds complexity for minimal benefit
- Force re-selection: Creates unnecessary friction for existing users

---

### Decision 5: Session Retention Policy

**Decision**: 7-day cleanup for read-only sessions (same as active sessions)

**Rationale**: Consistent with how active sessions are already managed (existing `SessionCleanupService` uses 7-day retention), avoids unbounded storage growth, and provides enough time for users to reference previous work without cluttering the tree view permanently.

**Alternatives considered**:
- Indefinite retention: Would lead to unbounded storage growth
- Clear on provider switch: Would lose valuable historical context

---

## Architecture Pattern: Provider Adapter

The feature implements a **Provider Adapter Pattern** to achieve multi-provider support:

```
Cloud Agents Area (UI Layer)
         |
         v
Cloud Agent Service (Orchestration)
         |
    +----+----+
    |         |
DevinAdapter  GitHubCopilotAdapter
    |              |
    v              v
Devin API      GitHub API
```

**Key components**:
1. **Provider Interface** (`CloudAgentProvider`): Defines the contract all adapters must implement
2. **Provider Registry**: Manages available providers and their registration
3. **Provider Configuration Store**: Persists provider preference and credentials per workspace
4. **Session Aggregator**: Combines sessions from active and read-only providers for display

This pattern allows:
- Adding new providers by implementing the interface without modifying core logic
- Single active provider with read-only access to previous provider sessions
- Clean separation of provider-specific logic from UI/orchestration

---

## Provider API Details

### Devin API (Existing)

**Authentication**: API token (v1/v2: `apk_*` prefix, v3: `cog_*` prefix with orgId)

**Key Operations**:
- Create session: `POST /sessions` with prompt
- Get session status: `GET /sessions/{sessionId}` returns status, statusDetail, pullRequests
- Cancel session: `POST /sessions/{sessionId}/cancel`

**Status Mapping**:
- Devin statuses: `running`, `blocked`, `completed`, `failed`, `cancelled`
- Mapped to unified `SessionStatus` enum via `status-mapper.ts`

**Polling**: `DevinPollingService` polls active sessions every 30 seconds

**Session Storage**: `DevinSessionStorage` stores sessions in `workspaceState` with 7-day cleanup via `SessionCleanupService`

---

### GitHub Copilot Coding Agent API (New)

**Authentication**: GitHub PAT (personal access token) or GitHub App token

**Key Operations**:
- **Assign issue to Copilot**: GraphQL mutation `createIssue` or `updateIssue` with `assigneeIds: ["copilot-swe-agent"]`
- **Track session progress**: Query issue for linked PRs via `issue.linkedPullRequests`
- **Check status**: PR status (open/draft/closed) indicates session progress
- **Cancel**: Close the PR or unassign Copilot from the issue

**GraphQL API Requirements**:
- Header: `GraphQL-Features: issues_copilot_assignment_api_support,coding_agent_model_selection`
- Permissions: `repo` scope (classic PAT) or `issues:write`, `pull_requests:write` (fine-grained PAT)

**Session Model**:
- Issue assigned to Copilot = session start
- PR created by Copilot = session output
- PR merged/closed = session completed
- Issue comments = session progress updates

**Agent Assignment Options**:
```graphql
agentAssignment: {
  targetRepositoryId: "REPO_ID",
  baseRef: "main",
  customInstructions: "Add test coverage",
  customAgent: "",  # Optional: custom agent profile
  model: ""         # Optional: AI model selection
}
```

**Discovery**: Query `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` to check if Copilot is enabled for the repo

---

## References

- Existing Devin integration: `src/features/devin/` (session management, polling, credentials)
- VS Code Tree View API: `providers/devin-progress-provider.ts`
- VS Code Secrets API: `DevinCredentialsManager`
- GitHub Issues API: For Copilot coding agent integration
- GitHub GraphQL API: For Copilot assignment and session tracking
- GitHub Copilot coding agent docs: https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent
