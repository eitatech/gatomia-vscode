/**
 * Devin Session Storage Service
 *
 * Persists Devin session data in VS Code workspace state.
 * Implements 7-day retention policy for completed sessions.
 *
 * @see specs/001-devin-integration/data-model.md:L37
 * @see specs/001-devin-integration/data-model.md:L220-L228
 */

import type * as vscode from "vscode";
import { STORAGE_KEY_SESSIONS, SESSION_RETENTION_MS } from "./config";
import type { DevinSession } from "./entities";
import { DevinSessionNotFoundError } from "./errors";
import { SessionStatus } from "./types";

/**
 * Manages Devin session persistence in VS Code workspace state.
 */
export class DevinSessionStorage {
	private readonly workspaceState: vscode.Memento;

	constructor(workspaceState: vscode.Memento) {
		this.workspaceState = workspaceState;
	}

	/**
	 * Get all stored sessions.
	 */
	getAll(): DevinSession[] {
		const raw = this.workspaceState.get<string>(STORAGE_KEY_SESSIONS);
		if (!raw) {
			return [];
		}

		try {
			return JSON.parse(raw) as DevinSession[];
		} catch {
			return [];
		}
	}

	/**
	 * Get a session by its local ID.
	 *
	 * @throws {DevinSessionNotFoundError} If the session is not found
	 */
	getByLocalId(localId: string): DevinSession {
		const sessions = this.getAll();
		const session = sessions.find((s) => s.localId === localId);
		if (!session) {
			throw new DevinSessionNotFoundError(localId);
		}
		return session;
	}

	/**
	 * Get a session by its Devin session ID.
	 */
	getBySessionId(sessionId: string): DevinSession | undefined {
		const sessions = this.getAll();
		return sessions.find((s) => s.sessionId === sessionId);
	}

	/**
	 * Save a new session.
	 */
	async save(session: DevinSession): Promise<void> {
		const sessions = this.getAll();
		const existingIndex = sessions.findIndex(
			(s) => s.localId === session.localId
		);

		if (existingIndex >= 0) {
			sessions[existingIndex] = session;
		} else {
			sessions.push(session);
		}

		await this.persist(sessions);
	}

	/**
	 * Update an existing session by local ID.
	 * Merges the provided fields with the existing session.
	 *
	 * @throws {DevinSessionNotFoundError} If the session is not found
	 */
	async update(
		localId: string,
		updates: Partial<DevinSession>
	): Promise<DevinSession> {
		const sessions = this.getAll();
		const index = sessions.findIndex((s) => s.localId === localId);

		if (index < 0) {
			throw new DevinSessionNotFoundError(localId);
		}

		const updated: DevinSession = {
			...sessions[index],
			...updates,
			updatedAt: Date.now(),
		};
		sessions[index] = updated;

		await this.persist(sessions);
		return updated;
	}

	/**
	 * Delete a session by its local ID.
	 */
	async delete(localId: string): Promise<void> {
		const sessions = this.getAll();
		const filtered = sessions.filter((s) => s.localId !== localId);
		await this.persist(filtered);
	}

	/**
	 * Get all active (non-completed) sessions.
	 */
	getActive(): DevinSession[] {
		const sessions = this.getAll();
		const terminalStates: string[] = [
			SessionStatus.COMPLETED,
			SessionStatus.FAILED,
			SessionStatus.CANCELLED,
		];
		return sessions.filter((s) => !terminalStates.includes(s.status));
	}

	/**
	 * Remove sessions that have been completed for longer than the retention period.
	 *
	 * @returns The number of sessions cleaned up
	 */
	async cleanup(): Promise<number> {
		const sessions = this.getAll();
		const now = Date.now();
		const cutoff = now - SESSION_RETENTION_MS;

		const terminalStates: string[] = [
			SessionStatus.COMPLETED,
			SessionStatus.FAILED,
			SessionStatus.CANCELLED,
		];

		const retained = sessions.filter((s) => {
			if (!terminalStates.includes(s.status)) {
				return true;
			}
			const completionTime = s.completedAt ?? s.updatedAt;
			return completionTime > cutoff;
		});

		const removedCount = sessions.length - retained.length;
		if (removedCount > 0) {
			await this.persist(retained);
		}

		return removedCount;
	}

	/**
	 * Get the count of stored sessions.
	 */
	count(): number {
		const sessions = this.getAll();
		return sessions.length;
	}

	// ============================================================================
	// Private helpers
	// ============================================================================

	private async persist(sessions: DevinSession[]): Promise<void> {
		await this.workspaceState.update(
			STORAGE_KEY_SESSIONS,
			JSON.stringify(sessions)
		);
	}
}
