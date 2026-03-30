/**
 * Session Cleanup Service
 *
 * Implements 7-day retention for all provider sessions.
 * Removes expired sessions from storage on a regular schedule.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/data-model.md
 */

import type { AgentSessionStorage } from "./agent-session-storage";
import { logInfo, logError } from "./logging";

// ============================================================================
// Constants
// ============================================================================

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// SessionCleanupService
// ============================================================================

/**
 * 7-day session retention cleanup for all provider sessions.
 *
 * @see specs/016-multi-provider-agents/data-model.md
 */
export class SessionCleanupService {
	private readonly sessionStorage: AgentSessionStorage;

	constructor(sessionStorage: AgentSessionStorage) {
		this.sessionStorage = sessionStorage;
	}

	/**
	 * Remove sessions older than the retention period (7 days).
	 * @returns Number of sessions removed
	 */
	async cleanup(): Promise<number> {
		try {
			const cutoff = Date.now() - SEVEN_DAYS_MS;
			const expired = await this.sessionStorage.getForCleanup(cutoff);
			for (const session of expired) {
				await this.sessionStorage.delete(session.localId);
			}
			if (expired.length > 0) {
				logInfo(`Cleaned up ${expired.length} expired session(s)`);
			}
			return expired.length;
		} catch (error) {
			logError("Session cleanup failed", error);
			return 0;
		}
	}
}
