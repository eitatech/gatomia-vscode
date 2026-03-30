# Data Model: Multi-Provider Cloud Agent Support

## Entities

### CloudAgentProvider

Represents a supported cloud agent platform.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., "devin", "github-copilot") |
| `displayName` | `string` | Human-readable name for UI |
| `description` | `string` | Brief description shown in selection UI |
| `icon` | `string` | Icon identifier for tree view |
| `adapterClass` | `string` | TypeScript class name implementing the adapter |

### ProviderConfiguration

Stores the selected provider preference and credentials for a workspace.

| Field | Type | Description |
|-------|------|-------------|
| `workspaceId` | `string` | VS Code workspace folder URI |
| `activeProviderId` | `string` | Currently active provider ID |
| `credentials` | `Map<string, string>` | Provider-specific credential keys (stored in secrets) |
| `options` | `Record<string, unknown>` | Provider-specific configuration options |
| `updatedAt` | `number` | Unix timestamp of last modification |

### AgentSession

A unit of work dispatched to a cloud agent provider. Provider-agnostic structure populated by adapters.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique session ID (provider-specific) |
| `localId` | `string` | Local tracking ID for this workspace |
| `providerId` | `string` | Provider that created this session |
| `status` | `SessionStatus` | Current session status |
| `branch` | `string` | Git branch associated with session |
| `specPath` | `string` | Path to spec file this session relates to |
| `externalUrl` | `string?` | URL to view session in provider's UI |
| `tasks` | `AgentTask[]` | Tasks within this session |
| `pullRequests` | `PullRequest[]` | PRs created by this session |
| `createdAt` | `number` | Unix timestamp |
| `updatedAt` | `number` | Unix timestamp |
| `completedAt` | `number?` | Unix timestamp when completed |
| `isReadOnly` | `boolean` | True if session is from inactive provider |

### AgentTask

A single task within a session, linked to a spec task.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Task ID (provider-specific) |
| `specTaskId` | `string` | ID of the spec task this maps to |
| `title` | `string` | Task title |
| `description` | `string` | Task description |
| `priority` | `string` | Priority (e.g., "high", "medium", "low") |
| `status` | `TaskStatus` | Current task status |
| `startedAt` | `number?` | Unix timestamp when task started |
| `completedAt` | `number?` | Unix timestamp when task completed |

### PullRequest

A pull request created by an agent session.

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | URL to the pull request |
| `state` | `string?` | PR state (e.g., "open", "merged", "closed") |
| `branch` | `string` | Branch name |
| `createdAt` | `number` | Unix timestamp |

---

## Enumerations

### SessionStatus

```
- pending    : Session created but not yet started
- running    : Session is actively processing tasks
- blocked    : Session is waiting for user input
- completed  : All tasks completed successfully
- failed     : Session failed with errors
- cancelled  : Session was cancelled by user
```

### TaskStatus

```
- pending    : Task queued but not started
- in_progress: Task is being worked on
- completed  : Task completed successfully
- failed     : Task failed
- skipped    : Task was skipped
```

---

## Relationships

```
ProviderConfiguration (1) ---> (N) AgentSession
AgentSession (1) ---> (N) AgentTask
AgentSession (1) ---> (N) PullRequest
AgentTask (N) ---> (1) SpecTask (via specTaskId)
```

---

## State Transitions

### Session State Machine

```
pending -> running -> completed
              |          ^
              v          |
           blocked -----+

pending -> running -> failed
pending -> running -> cancelled
```

### Provider Configuration State

```
unconfigured -> configuring -> configured
                           |
                           v
                     migration_needed
```

---

## Validation Rules

1. **Provider ID**: Must be non-empty string, must exist in registered providers
2. **Session Local ID**: Must be unique within the workspace
3. **Credentials**: Must be valid for the selected provider (validated on save)
4. **Status Transitions**: Must follow valid state machine paths (see above)

---

## Storage

- **Provider Configuration**: VS Code `workspaceState` with key `gatomia.cloud-agents.config`
- **Credentials**: VS Code `secrets` storage, keyed by `gatomia.cloud-agents.{providerId}`
- **Sessions**: VS Code `workspaceState` with key `gatomia.cloud-agents.sessions`
- **Cleanup**: Sessions older than 7 days are removed by `SessionCleanupService`
