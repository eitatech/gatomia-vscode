# Provider Adapter Contract

## Overview

This document defines the contract that all cloud agent provider adapters must implement to integrate with the Multi-Provider Cloud Agent Support feature.

## Interface: CloudAgentProvider

```typescript
interface CloudAgentProvider {
  // ========================================
  // Identification
  // ========================================

  /** Unique identifier for this provider */
  readonly id: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Brief description for selection UI */
  readonly description: string;

  /** Icon identifier for tree view */
  readonly icon: string;

  // ========================================
  // Credential Management
  // ========================================

  /**
   * Check if valid credentials are configured for this provider
   */
  hasCredentials(): Promise<boolean>;

  /**
   * Prompt user to configure credentials for this provider
   * Returns true if configuration was successful
   */
  configureCredentials(): Promise<boolean>;

  /**
   * Clear stored credentials
   */
  clearCredentials(): Promise<void>;

  // ========================================
  // Session Management
  // ========================================

  /**
   * Create a new session/task with this provider
   * @param specTask - The spec task to execute
   * @param options - Provider-specific options
   * @returns The created session with provider-specific ID
   */
  createSession(
    specTask: SpecTask,
    options?: Record<string, unknown>
  ): Promise<AgentSession>;

  /**
   * Get the current status of a session
   * @param sessionId - Provider-specific session ID
   * @returns Updated session with current status
   */
  getSessionStatus(sessionId: string): Promise<AgentSession>;

  /**
   * Cancel a running session
   * @param sessionId - Provider-specific session ID
   */
  cancelSession(sessionId: string): Promise<void>;

  /**
   * Get all active sessions for this provider
   */
  getActiveSessions(): Promise<AgentSession[]>;

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Handle a blocked session notification
   * @param session - The blocked session
   * @returns Action to take (e.g., open external URL)
   */
  handleBlockedSession(session: AgentSession): ProviderAction | null;

  /**
   * Handle session completion
   * @param session - The completed session
   */
  handleSessionComplete(session: AgentSession): Promise<void>;
}

// ========================================
// Supporting Types
// ========================================

interface AgentSession {
  readonly id: string;
  readonly localId: string;
  readonly status: SessionStatus;
  readonly branch: string;
  readonly specPath: string;
  readonly externalUrl?: string;
  readonly tasks: AgentTask[];
  readonly pullRequests: PullRequest[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
}

interface AgentTask {
  readonly id: string;
  readonly specTaskId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
  readonly status: TaskStatus;
  readonly startedAt?: number;
  readonly completedAt?: number;
}

interface PullRequest {
  readonly url: string;
  readonly state?: string;
  readonly branch: string;
  readonly createdAt: number;
}

interface SpecTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
}

type SessionStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

type ProviderAction =
  | { type: "openUrl"; url: string }
  | { type: "notify"; message: string }
  | { type: "none" };
```

## Adapter Registration

Adapters must be registered with the provider registry to be available for selection:

```typescript
// In src/extension.ts (during activation)
import { ProviderRegistry } from "./features/cloud-agents/provider-registry";
import { DevinAdapter } from "./features/cloud-agents/adapters/devin-adapter";
import { GitHubCopilotAdapter } from "./features/cloud-agents/adapters/github-copilot-adapter";

const registry = new ProviderRegistry(configStore);
registry.register(new DevinAdapter(devinCredentialsManager, sessionStorage));
registry.register(new GitHubCopilotAdapter(context.secrets, sessionStorage));
```

## Implementation Checklist

When implementing a new provider adapter, ensure:

- [ ] Implements `CloudAgentProvider` interface
- [ ] Handles all credential lifecycle (configure, validate, clear)
- [ ] Maps provider-specific session states to canonical `SessionStatus`
- [ ] Maps provider-specific task states to canonical `TaskStatus`
- [ ] Provides external URLs for session viewing in provider's UI
- [ ] Handles blocked sessions appropriately
- [ ] Cleans up resources on session completion
- [ ] Follows kebab-case naming for source files
- [ ] Includes unit tests for adapter logic
- [ ] Includes integration tests for API interactions

## Error Handling

Adapters must handle errors gracefully:

1. **Authentication failures**: Clear credentials and prompt re-configuration
2. **Network errors**: Log error, return degraded state, allow retry
3. **Rate limiting**: Implement exponential backoff, notify user
4. **Unknown errors**: Log with context, return generic error to user
