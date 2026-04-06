# Storage Interface Contract

**Version**: 1.0  
**Feature**: 016-multi-provider-agents  
**Date**: 2025-07-14

---

## Overview

Defines the storage layer contracts for persisting cloud agent configuration, sessions, and related data. This abstraction allows for testing and potential future storage backend changes.

---

## ProviderConfigurationStore

Manages the active provider preference and configuration per workspace.

```typescript
interface ProviderConfigurationStore {
  /**
   * Get the currently active provider ID for this workspace.
   * @returns Provider ID or undefined if not configured
   */
  getActiveProvider(): Promise<string | undefined>;

  /**
   * Set the active provider for this workspace.
   * @param providerId The provider to activate
   * @throws StoreError if save fails
   */
  setActiveProvider(providerId: string): Promise<void>;

  /**
   * Clear the active provider configuration.
   * Used when switching providers or resetting.
   */
  clearActiveProvider(): Promise<void>;

  /**
   * Get provider-specific configuration options.
   * @param providerId The provider to get options for
   * @returns Options object or empty object if none stored
   */
  getProviderOptions(providerId: string): Promise<Record<string, unknown>>;

  /**
   * Set provider-specific configuration options.
   * @param providerId The provider to configure
   * @param options Options to store
   */
  setProviderOptions(
    providerId: string,
    options: Record<string, unknown>
  ): Promise<void>;
}
```

### Storage Keys

```typescript
const STORAGE_KEYS = {
  ACTIVE_PROVIDER: 'gatomia.cloudAgent.activeProvider',
  PROVIDER_OPTIONS_PREFIX: 'gatomia.cloudAgent.options.'
} as const;
```

---

## SessionStore

Manages cloud agent sessions and their lifecycle.

```typescript
interface SessionStore {
  /**
   * Get all sessions for the current workspace.
   * @returns Array of all sessions (active and read-only)
   */
  getAll(): Promise<AgentSession[]>;

  /**
   * Get sessions filtered by provider ID.
   * @param providerId Filter by this provider
   * @returns Sessions belonging to the provider
   */
  getByProvider(providerId: string): Promise<AgentSession[]>;

  /**
   * Get active (non-read-only) sessions.
   * @returns Sessions that can be cancelled/polled
   */
  getActive(): Promise<AgentSession[]>;

  /**
   * Get a single session by local ID.
   * @param localId The session's local ID
   * @returns Session or undefined if not found
   */
  getById(localId: string): Promise<AgentSession | undefined>;

  /**
   * Save a new session.
   * @param session The session to save
   * @throws StoreError if localId already exists
   */
  create(session: AgentSession): Promise<void>;

  /**
   * Update an existing session.
   * @param localId The session to update
   * @param updates Partial session fields to update
   * @throws StoreError if session not found
   */
  update(
    localId: string,
    updates: Partial<AgentSession>
  ): Promise<void>;

  /**
   * Delete a session.
   * @param localId The session to delete
   */
  delete(localId: string): Promise<void>;

  /**
   * Mark all sessions from a provider as read-only.
   * Used when switching providers.
   * @param providerId The provider to mark read-only
   */
  markProviderReadOnly(providerId: string): Promise<void>;

  /**
   * Get sessions that need cleanup (older than retention period).
   * @param cutoffTime Sessions updated before this time are candidates
   * @returns Sessions eligible for cleanup
   */
  getForCleanup(cutoffTime: number): Promise<AgentSession[]>;
}
```

### Session Query Filters

```typescript
interface SessionQuery {
  /** Filter by provider */
  providerId?: string;
  
  /** Filter by status */
  status?: SessionStatus | SessionStatus[];
  
  /** Filter by read-only flag */
  isReadOnly?: boolean;
  
  /** Filter sessions created after this time */
  createdAfter?: number;
  
  /** Filter sessions updated before this time */
  updatedBefore?: number;
}

interface SessionStore {
  /**
   * Query sessions with filters.
   * @param query Filter criteria
   * @returns Matching sessions
   */
  query(query: SessionQuery): Promise<AgentSession[]>;
}
```

---

## CredentialStore

Manages secure storage of provider credentials using VS Code secrets API.

```typescript
interface CredentialStore {
  /**
   * Store credentials for a provider.
   * @param providerId The provider to store credentials for
   * @param credentials The credential data (encrypted by VS Code)
   * @throws StoreError if storage fails
   */
  set(
    providerId: string,
    credentials: ProviderCredentials
  ): Promise<void>;

  /**
   * Retrieve credentials for a provider.
   * @param providerId The provider to get credentials for
   * @returns Credentials or undefined if not found
   */
  get(providerId: string): Promise<ProviderCredentials | undefined>;

  /**
   * Check if credentials exist for a provider.
   * @param providerId The provider to check
   * @returns True if credentials exist
   */
  has(providerId: string): Promise<boolean>;

  /**
   * Delete credentials for a provider.
   * @param providerId The provider to clear credentials for
   */
  delete(providerId: string): Promise<void>;
}

/**
 * Provider-specific credential shapes.
 */
type ProviderCredentials =
  | DevinCredentials
  | GitHubCredentials;

interface DevinCredentials {
  apiToken: string;
}

interface GitHubCredentials {
  token: string;
  tokenType: 'classic' | 'fine-grained';
}
```

### Secret Key Patterns

```typescript
const SECRET_KEYS = {
  DEVIN: 'gatomia.devin.apiToken',      // Legacy key (preserved)
  GITHUB: 'gatomia.github.token'          // New key
} as const;

function getSecretKey(providerId: string): string {
  return `gatomia.${providerId}.credentials`;
}
```

---

## VS Code Storage Implementation

### Default Implementation

```typescript
class VSCodeProviderConfigurationStore implements ProviderConfigurationStore {
  constructor(
    private workspaceState: vscode.Memento
  ) {}
  
  // Implementation using workspaceState
}

class VSCodeSessionStore implements SessionStore {
  constructor(
    private workspaceState: vscode.Memento
  ) {}
  
  // Implementation using workspaceState
}

class VSCodeCredentialStore implements CredentialStore {
  constructor(
    private secrets: vscode.SecretStorage
  ) {}
  
  // Implementation using secrets
}
```

### Storage Schema

#### workspaceState Structure

```typescript
interface CloudAgentStorage {
  // Provider configuration
  'gatomia.cloudAgent.activeProvider': string | undefined;
  'gatomia.cloudAgent.options.{providerId}': Record<string, unknown>;
  
  // Sessions
  'gatomia.cloudAgent.sessions': AgentSession[];
  
  // Legacy (for migration detection)
  'gatomia.devin.sessions': AgentSession[] | undefined;  // Legacy Devin storage
}
```

#### Migration Detection

```typescript
async function detectLegacyDevinStorage(
  workspaceState: vscode.Memento
): Promise<boolean> {
  return workspaceState.get('gatomia.devin.sessions') !== undefined ||
         await secrets.get('gatomia.devin.apiToken') !== undefined;
}
```

---

## Events

Storage implementations must emit events for state changes:

```typescript
interface StorageEvents {
  /**
   * Emitted when active provider changes.
   */
  onDidChangeActiveProvider: Event<string | undefined>;
  
  /**
   * Emitted when a session is created, updated, or deleted.
   */
  onDidChangeSessions: Event<SessionChangeEvent>;
  
  /**
   * Emitted when provider options change.
   */
  onDidChangeProviderOptions: Event<{
    providerId: string;
    options: Record<string, unknown>;
  }>;
}

interface SessionChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  session: AgentSession;
}
```

---

## Error Handling

```typescript
class StoreError extends Error {
  constructor(
    message: string,
    public readonly code: StoreErrorCode,
    public readonly operation: string
  ) {
    super(message);
  }
}

enum StoreErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  STORAGE_FULL = 'STORAGE_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN'
}
```

---

## Constraints & Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max sessions stored | 100 | Retention policy keeps this bounded |
| Session data size | 1MB | workspaceState limit |
| Credential size | 4KB | secrets storage limit |
| Max providers | 10 | UI/design constraint |

---

## Testing

### Mock Implementations

```typescript
class MockProviderConfigurationStore implements ProviderConfigurationStore {
  private activeProvider: string | undefined;
  private options = new Map<string, Record<string, unknown>>();
  
  // Implementation for unit testing
}

class MockSessionStore implements SessionStore {
  private sessions = new Map<string, AgentSession>();
  
  // Implementation for unit testing
}

class MockCredentialStore implements CredentialStore {
  private credentials = new Map<string, ProviderCredentials>();
  
  // Implementation for unit testing
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-07-14 | Initial contract definition |
