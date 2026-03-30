/**
 * Cloud Agent Provider Interface
 *
 * Defines the contract that all cloud agent provider adapters must implement.
 * This is the core abstraction enabling multi-provider support.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import type {
	AgentSession,
	ProviderAction,
	ProviderMetadata,
	SessionContext,
	SessionUpdate,
	SpecTask,
} from "./types";

// ============================================================================
// CloudAgentProvider Interface
// ============================================================================

/**
 * Core provider interface that all adapters must implement.
 *
 * To add a new provider:
 * 1. Create a new adapter file in `adapters/` implementing this interface
 * 2. Register the adapter in the `ProviderRegistry` during extension activation
 * 3. Add tests in `tests/unit/features/cloud-agents/adapters/`
 * 4. Use `createMockProviderAdapter()` from `tests/fixtures/mock-provider-adapter.ts` as a reference
 *
 * @example
 * ```typescript
 * import type { CloudAgentProvider } from "./cloud-agent-provider";
 *
 * export class MyAdapter implements CloudAgentProvider {
 *   readonly metadata = { id: "my-agent", displayName: "My Agent", description: "...", icon: "robot" };
 *   async hasCredentials() { return true; }
 *   async configureCredentials() { return true; }
 *   // ... implement remaining methods
 * }
 *
 * // In extension.ts:
 * registry.register(new MyAdapter(context.secrets));
 * ```
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */
export interface CloudAgentProvider {
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
	 * @param task - The spec task to dispatch
	 * @param context - Additional context (branch, spec path, etc.)
	 * @returns The created session
	 * @throws ProviderError if creation fails
	 */
	createSession(task: SpecTask, context: SessionContext): Promise<AgentSession>;

	/**
	 * Cancel a running session.
	 * @param sessionId - The local session ID to cancel
	 * @throws ProviderError if cancellation fails or session not found
	 */
	cancelSession(sessionId: string): Promise<void>;

	// ========================================================================
	// Status & Polling
	// ========================================================================

	/**
	 * Poll for status updates on multiple sessions.
	 * @param sessions - Sessions to poll (all belong to this provider)
	 * @returns Array of status updates (may be partial if some unchanged)
	 */
	pollSessions(sessions: AgentSession[]): Promise<SessionUpdate[]>;

	/**
	 * Get the external URL for a session (if available).
	 * @param session - The session to get URL for
	 * @returns URL to provider's UI, or undefined if not available
	 */
	getExternalUrl(session: AgentSession): string | undefined;

	/**
	 * Get human-readable status text for a session.
	 * @param session - The session
	 * @returns Provider-specific status description
	 */
	getStatusDisplay(session: AgentSession): string;

	// ========================================================================
	// Event Handlers
	// ========================================================================

	/**
	 * Handle a blocked session notification.
	 * @param session - The blocked session
	 * @returns Action to take (e.g., open external URL)
	 */
	handleBlockedSession(session: AgentSession): ProviderAction | null;

	/**
	 * Handle session completion.
	 * @param session - The completed session
	 */
	handleSessionComplete(session: AgentSession): Promise<void>;
}
