# CloudAgentProvider Interface Contract

**Version**: 1.0  
**Feature**: 016-multi-provider-agents  
**Date**: 2025-07-14

---

## Interface Definition

The `CloudAgentProvider` interface defines the contract that all cloud agent provider adapters must implement to integrate with the multi-provider system.

```typescript
/**
 * Provider metadata and capability information.
 */
interface ProviderMetadata {
  /** Unique provider identifier (kebab-case, e.g., "devin", "github-copilot") */
  readonly id: string;
  
  /** Human-readable name displayed in UI */
  readonly displayName: string;
  
  /** Brief description for provider selection UI */
  readonly description: string;
  
  /** Icon identifier for tree view rendering */
  readonly icon: string;
}

/**
 * Core provider interface that all adapters must implement.
 */
interface CloudAgentProvider {
  /**
   * Provider identification metadata.
   */
  readonly metadata: ProviderMetadata;

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Check if this provider has valid credentials configured.
   * @returns True if credentials exist and are valid
   */
  hasCredentials(): Promise<boolean>;

  /**
   * Configure or update credentials for this provider.
   * Should prompt user for input and store in VS Code secrets.
   * @returns True if configuration was successful
   */
  configureCredentials(): Promise<boolean>;

  // ========================================================================
  // Session Lifecycle
  // ========================================================================

  /**
   * Create a new agent session with this provider.
   * @param task The spec task to dispatch
   * @param context Additional context (branch, spec path, etc.)
   * @returns The created session
   * @throws ProviderError if creation fails
   */
  createSession(
    task: SpecTask,
    context: SessionContext
  ): Promise<AgentSession>;

  /**
   * Cancel a running session.
   * @param sessionId The local session ID to cancel
   * @throws ProviderError if cancellation fails or session not found
   */
  cancelSession(sessionId: string): Promise<void>;

  // ========================================================================
  // Status & Polling
  // ========================================================================

  /**
   * Poll for status updates on multiple sessions.
   * @param sessions Sessions to poll (all belong to this provider)
   * @returns Array of status updates (may be partial if some unchanged)
   */
  pollSessions(sessions: AgentSession[]): Promise<SessionUpdate[]>;

  /**
   * Get the external URL for a session (if available).
   * @param session The session to get URL for
   * @returns URL to provider's UI, or undefined if not available
   */
  getExternalUrl(session: AgentSession): string | undefined;

  /**
   * Get human-readable status text for a session.
   * @param session The session
   * @returns Provider-specific status description
   */
  getStatusDisplay(session: AgentSession): string;
}
```

---

## Supporting Types

### SessionContext

```typescript
interface SessionContext {
  /** Git branch for this session */
  readonly branch: string;
  
  /** Absolute path to the spec file */
  readonly specPath: string;
  
  /** Workspace folder URI */
  readonly workspaceUri: string;
}
```

### SpecTask

```typescript
interface SpecTask {
  /** Task identifier from spec (e.g., "T-001") */
  readonly id: string;
  
  /** Task title */
  readonly title: string;
  
  /** Task description */
  readonly description: string;
  
  /** Priority level */
  readonly priority: TaskPriority;
}
```

### AgentSession

```typescript
interface AgentSession {
  /** Local unique identifier (UUID v4) */
  readonly localId: string;
  
  /** Provider that owns this session */
  readonly providerId: string;
  
  /** Provider's external session identifier */
  readonly providerSessionId: string | undefined;
  
  /** Current session status */
  status: SessionStatus;
  
  /** Associated git branch */
  readonly branch: string;
  
  /** Path to related spec file */
  readonly specPath: string;
  
  /** Tasks within this session */
  readonly tasks: AgentTask[];
  
  /** Pull requests created */
  readonly pullRequests: PullRequest[];
  
  /** Creation timestamp (ms) */
  readonly createdAt: number;
  
  /** Last update timestamp (ms) */
  updatedAt: number;
  
  /** Completion timestamp (ms) */
  completedAt: number | undefined;
  
  /** True if from inactive provider */
  isReadOnly: boolean;
}
```

### SessionUpdate

```typescript
interface SessionUpdate {
  /** Session being updated */
  readonly localId: string;
  
  /** New status (if changed) */
  status?: SessionStatus;
  
  /** Updated tasks */
  tasks?: AgentTask[];
  
  /** Updated PRs */
  pullRequests?: PullRequest[];
  
  /** External URL (if now available) */
  externalUrl?: string;
  
  /** Error message (if status failed) */
  errorMessage?: string;
  
  /** Update timestamp */
  readonly timestamp: number;
}
```

### Enums

```typescript
enum SessionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

---

## Error Handling

### ProviderError

All provider methods must throw `ProviderError` on failure:

```typescript
class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly providerId: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
  }
}

enum ErrorCode {
  // Configuration errors
  CREDENTIALS_MISSING = 'CREDENTIALS_MISSING',
  CREDENTIALS_INVALID = 'CREDENTIALS_INVALID',
  
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',
  SESSION_CANCEL_FAILED = 'SESSION_CANCEL_FAILED',
  
  // API errors
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_ERROR = 'API_ERROR',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT'
}
```

---

## Provider Registration

Providers must register themselves via the `ProviderRegistry`:

```typescript
class ProviderRegistry {
  static register(provider: CloudAgentProvider): void;
  static get(id: string): CloudAgentProvider | undefined;
  static getAll(): CloudAgentProvider[];
  static getActive(): CloudAgentProvider | undefined;
  static setActive(id: string): Promise<void>;
}
```

**Registration Pattern**:
```typescript
// In extension activation
import { DevinProvider } from './providers/devin-provider';
import { GitHubCopilotProvider } from './providers/github-copilot-provider';

ProviderRegistry.register(new DevinProvider());
ProviderRegistry.register(new GitHubCopilotProvider());
```

---

## Implementation Requirements

### 1. Idempotency
- `createSession` must be idempotent for the same task/branch combination
- `cancelSession` must succeed if session already cancelled (no-op)

### 2. Error Recovery
- All errors must include actionable context for users
- Network errors should trigger retry logic at the polling service level
- Invalid credentials should prompt re-configuration

### 3. Status Consistency
- `pollSessions` should return only changed sessions (optimization)
- Status transitions must follow valid state machine (see data-model.md)
- External URL may become available asynchronously (after initial creation)

### 4. Telemetry
- All provider methods should emit telemetry events
- Error events must include error code and provider ID
- Performance metrics for API calls (latency, success rate)

---

## Provider-Specific Contracts

### Devin Provider

See existing implementation: `src/features/devin/`

Additional contract for Devin:
- Uses Devin API v1
- Requires `DEVIN_API_TOKEN` in secrets
- Polling interval: 30 seconds
- Session status mapping from Devin API response

### GitHub Copilot Provider

GitHub-specific contract:

```typescript
interface GitHubCopilotProvider extends CloudAgentProvider {
  /**
   * Create a GitHub Issue assigned to Copilot.
   * @param title Issue title
   * @param body Issue body (task description)
   * @param repo Repository in format "owner/repo"
   * @returns Created issue number
   */
  createCopilotIssue(
    title: string,
    body: string,
    repo: string
  ): Promise<number>;

  /**
   * Get linked PRs for an issue.
   * @param issueNumber The issue number
   * @param repo Repository in format "owner/repo"
   * @returns Array of linked PRs
   */
  getLinkedPullRequests(
    issueNumber: number,
    repo: string
  ): Promise<PullRequest[]>;
}
```

**GitHub API Requirements**:
- Token scope: `repo` (classic) or `issues:write`, `pull_requests:read` (fine-grained)
- Repository must be specified in provider configuration
- Issue events timeline endpoint for tracking Copilot assignment

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-07-14 | Initial contract definition |
