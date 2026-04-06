/**
 * Session Cleanup Service
 *
 * Periodically removes sessions that exceed the 7-day retention period.
 * Runs on extension activation and periodically thereafter.
 *
 * @see specs/001-devin-integration/data-model.md:L37
 */

import type { DevinSessionStorage } from "./devin-session-storage";
import { logInfo } from "./logging";

/**
 * Cleanup interval: run every 6 hours (in ms).
 */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Manages periodic session cleanup.
 */
export class SessionCleanupService {
	private timerId: ReturnType<typeof setInterval> | undefined;
	private readonly storage: DevinSessionStorage;

	constructor(storage: DevinSessionStorage) {
		this.storage = storage;
	}

	/**
	 * Run cleanup once and start periodic cleanup.
	 */
	async start(): Promise<void> {
		await this.runCleanup();
		this.timerId = setInterval(() => {
			this.runCleanup().catch(() => {
				// Swallow cleanup errors
			});
		}, CLEANUP_INTERVAL_MS);
	}

	/**
	 * Stop periodic cleanup.
	 */
	stop(): void {
		if (this.timerId !== undefined) {
			clearInterval(this.timerId);
			this.timerId = undefined;
		}
	}

	/**
	 * Run a single cleanup pass.
	 */
	async runCleanup(): Promise<number> {
		const removed = await this.storage.cleanup();
		if (removed > 0) {
			logInfo(`Session cleanup: removed ${removed} expired session(s)`);
		}
		return removed;
	}
}
