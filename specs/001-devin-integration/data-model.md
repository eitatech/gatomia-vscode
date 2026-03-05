# Data Model: Devin Integration

**Date**: 2026-02-24  
**Feature**: Devin Remote Implementation Integration

## Entities

### DevinSession

Represents an active or completed Devin implementation session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Unique Devin session identifier (from API) |
| `localId` | string | Yes | Local UUID for VS Code tracking |
| `status` | SessionStatus | Yes | Current session state |
| `branch` | string | Yes | Git branch being worked on |
| `specPath` | string | Yes | Path to spec file in workspace |
| `tasks` | DevinTask[] | Yes | Tasks sent to Devin |
| `createdAt` | number | Yes | Timestamp (ms since epoch) |
| `updatedAt` | number | Yes | Last update timestamp |
| `completedAt` | number | No | Completion timestamp |
| `devinUrl` | string | No | URL to Devin web interface |
| `pullRequests` | PullRequest[] | No | PRs created by Devin |
| `apiVersion` | "v1" \| "v2" \| "v3" | Yes | API version used |
| `orgId` | string | No | Organization ID (v3 only) |
| `errorMessage` | string | No | Error details if failed |
| `retryCount` | number | Yes | Number of retry attempts (default: 0) |

**State Transitions**:
```
queued → initializing → running → [completed | failed | cancelled]
                    ↓
              retry (max 3) → failed
```

**Persistence**: Stored in VS Code workspace state, retained for 7 days after completion.

---

### DevinTask

Represents an individual task sent to Devin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | string | Yes | Unique task identifier (local) |
| `specTaskId` | string | Yes | Reference to spec task ID |
| `title` | string | Yes | Task title |
| `description` | string | Yes | Task description/prompt |
| `acceptanceCriteria` | string[] | No | Criteria for task completion |
| `priority` | "P1" \| "P2" \| "P3" | Yes | Task priority |
| `status` | TaskStatus | Yes | Current task state |
| `devinSessionId` | string | No | Associated Devin session (if started) |
| `artifacts` | TaskArtifact[] | No | Output files, logs, etc. |
| `startedAt` | number | No | When task was sent to Devin |
| `completedAt` | number | No | When task completed |

**State Values**: `pending`, `queued`, `in-progress`, `completed`, `failed`, `cancelled`

---

### DevinCredentials

Stores authentication credentials for Devin API access.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | Yes | API token (encrypted) |
| `apiVersion` | "v1" \| "v2" \| "v3" | Yes | Detected from key prefix |
| `orgId` | string | No | Organization ID (v3 only) |
| `createdAt` | number | Yes | When credentials were added |
| `lastUsedAt` | number | No | Last successful API call |
| `isValid` | boolean | Yes | Validation status |

**Storage**: VS Code SecretStorage API (encrypted at rest)

**Key Prefix Detection**:
- `cog_*` → v3
- `apk_user_*` → v1/v2 (personal)
- `apk_*` → v1/v2 (service)

---

### DevinProgressEvent

Represents a status update or log entry from Devin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | Yes | Unique event identifier |
| `sessionId` | string | Yes | Parent session reference |
| `timestamp` | number | Yes | Event timestamp |
| `eventType` | EventType | Yes | Category of event |
| `message` | string | Yes | Human-readable description |
| `data` | object | No | Structured event data |

**Event Types**:
- `status_change`: Session status updated
- `log_output`: Console/log output from Devin
- `pr_created`: Pull request created
- `error`: Error occurred
- `milestone`: Significant progress milestone
- `artifact`: File/artifact produced

---

### PullRequest

Represents a pull request created by Devin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prUrl` | string | Yes | URL to pull request |
| `prState` | string | No | PR state (open, closed, merged) |
| `branch` | string | Yes | Branch name |
| `createdAt` | number | Yes | PR creation timestamp |
| `mergedAt` | number | No | When PR was merged |

---

### TaskArtifact

Output produced by Devin during task execution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artifactId` | string | Yes | Unique identifier |
| `type` | "file" \| "log" \| "test_result" | Yes | Artifact type |
| `name` | string | Yes | Display name |
| `path` | string | No | File path (if applicable) |
| `content` | string | No | Content or URL to content |
| `createdAt` | number | Yes | Timestamp |

---

## TypeScript Interfaces

```typescript
// Session status values from Devin API
enum DevinApiStatus {
  NEW = "new",
  CLAIMED = "claimed",
  RUNNING = "running",
  EXIT = "exit",
  ERROR = "error",
  SUSPENDED = "suspended",
  RESUMING = "resuming"
}

// Local session status (mapped from API)
enum SessionStatus {
  QUEUED = "queued",
  INITIALIZING = "initializing",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

enum TaskStatus {
  PENDING = "pending",
  QUEUED = "queued",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

enum EventType {
  STATUS_CHANGE = "status_change",
  LOG_OUTPUT = "log_output",
  PR_CREATED = "pr_created",
  ERROR = "error",
  MILESTONE = "milestone",
  ARTIFACT = "artifact"
}

enum ApiVersion {
  V1 = "v1",
  V2 = "v2",
  V3 = "v3"
}
```

---

## Relationships

```
DevinSession 1---* DevinTask
DevinSession 1---* DevinProgressEvent
DevinSession 1---* PullRequest
DevinTask 1---* TaskArtifact
DevinCredentials 1---* DevinSession (via API calls)
```

---

## Validation Rules

1. **DevinSession**:
   - `sessionId` must be non-empty when status is not `QUEUED`
   - `branch` must match current git branch at creation time
   - `retryCount` must be 0-3 (inclusive)
   - `completedAt` must be >= `createdAt`

2. **DevinTask**:
   - `priority` must be one of: P1, P2, P3
   - `status` transitions must follow valid state machine
   - `devinSessionId` required when status is `IN_PROGRESS` or later

3. **DevinCredentials**:
   - `apiKey` must match known prefix patterns
   - `orgId` required when `apiVersion` is V3
   - `apiVersion` auto-detected from key prefix

---

## Storage Strategy

| Entity | Storage | TTL | Encryption |
|--------|---------|-----|------------|
| DevinSession | VS Code workspace state | 7 days post-completion | No |
| DevinTask | Embedded in DevinSession | Same as parent | No |
| DevinCredentials | VS Code SecretStorage | Until manually removed | Yes (OS-level) |
| DevinProgressEvent | In-memory + recent history | Session lifetime | No |
| PullRequest | Embedded in DevinSession | Same as parent | No |
