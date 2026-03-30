/**
 * Agent Session Storage
 *
 * Provider-agnostic session CRUD and read-only marking.
 * Stores sessions in VS Code workspace state.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 * @see specs/016-multi-provider-agents/data-model.md
 */

import { logInfo, logDebug } from "./logging";
import type { Memento } from "./provider-config-store";
import { type AgentSession, StoreError, StoreErrorCode } from "./types";

// ============================================================================
// Storage Key
// ============================================================================

const SESSIONS_KEY = "gatomia.cloudAgent.sessions";

// ============================================================================
// AgentSessionStorage
// ============================================================================

/**
 * Provider-agnostic session storage using VS Code workspace state.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */
export class AgentSessionStorage {
	private readonly workspaceState: Memento;

	constructor(workspaceState: Memento) {
		this.workspaceState = workspaceState;
	}

	/**
	 * Get all sessions for the current workspace.
	 */
	getAll(): Promise<AgentSession[]> {
		return Promise.resolve(
			this.workspaceState.get<AgentSession[]>(SESSIONS_KEY) ?? []
		);
	}

	/**
	 * Get a single session by local ID.
	 */
	async getById(localId: string): Promise<AgentSession | undefined> {
		const sessions = await this.getAll();
		return sessions.find((s) => s.localId === localId);
	}

	/**
	 * Get sessions filtered by provider ID.
	 */
	async getByProvider(providerId: string): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => s.providerId === providerId);
	}

	/**
	 * Get active (non-read-only) sessions.
	 */
	async getActive(): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => !s.isReadOnly);
	}

	/**
	 * Save a new session.
	 * @throws StoreError if localId already exists
	 */
	async create(session: AgentSession): Promise<void> {
		const sessions = await this.getAll();
		if (sessions.some((s) => s.localId === session.localId)) {
			throw new StoreError(
				`Session "${session.localId}" already exists`,
				StoreErrorCode.ALREADY_EXISTS,
				"create"
			);
		}
		sessions.push(session);
		await this.persist(sessions);
		logInfo(`Session created: ${session.localId} (${session.providerId})`);
	}

	/**
	 * Update an existing session.
	 * @throws StoreError if session not found
	 */
	async update(localId: string, updates: Partial<AgentSession>): Promise<void> {
		const sessions = await this.getAll();
		const index = sessions.findIndex((s) => s.localId === localId);
		if (index === -1) {
			throw new StoreError(
				`Session "${localId}" not found`,
				StoreErrorCode.NOT_FOUND,
				"update"
			);
		}
		sessions[index] = { ...sessions[index], ...updates };
		await this.persist(sessions);
		logDebug(`Session updated: ${localId}`);
	}

	/**
	 * Delete a session.
	 */
	async delete(localId: string): Promise<void> {
		const sessions = await this.getAll();
		const filtered = sessions.filter((s) => s.localId !== localId);
		await this.persist(filtered);
		logInfo(`Session deleted: ${localId}`);
	}

	/**
	 * Mark all sessions from a provider as read-only.
	 */
	async markProviderReadOnly(providerId: string): Promise<void> {
		const sessions = await this.getAll();
		for (const session of sessions) {
			if (session.providerId === providerId) {
				session.isReadOnly = true;
			}
		}
		await this.persist(sessions);
		logInfo(`All sessions for provider "${providerId}" marked read-only`);
	}

	/**
	 * Get sessions that need cleanup (updated before cutoff time).
	 */
	async getForCleanup(cutoffTime: number): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => s.updatedAt < cutoffTime);
	}

	private async persist(sessions: AgentSession[]): Promise<void> {
		await this.workspaceState.update(SESSIONS_KEY, sessions);
	}
}
