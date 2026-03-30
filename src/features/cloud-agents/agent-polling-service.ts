/**
 * Agent Polling Service
 *
 * Delegates polling to the active provider adapter.
 * Manages polling intervals and session update distribution.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import type { AgentSessionStorage } from "./agent-session-storage";
import { logDebug, logError, logWarn } from "./logging";
import type { ProviderRegistry } from "./provider-registry";
import { ErrorCode, ProviderError, SessionStatus } from "./types";

// ============================================================================
// Constants
// ============================================================================

const MAX_CONSECUTIVE_FAILURES = 3;

// ============================================================================
// AgentPollingService
// ============================================================================

/**
 * Polling orchestration that delegates to the active provider.
 * Includes retry behavior and credential-expiry detection (FR-020).
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export class AgentPollingService {
	private readonly registry: ProviderRegistry;
	private readonly sessionStorage: AgentSessionStorage;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private consecutiveFailures = 0;
	private onCredentialExpiry: (() => void) | undefined;

	/**
	 * Whether interval-based polling is currently running.
	 */
	get isRunning(): boolean {
		return this.intervalId !== undefined;
	}

	constructor(registry: ProviderRegistry, sessionStorage: AgentSessionStorage) {
		this.registry = registry;
		this.sessionStorage = sessionStorage;
	}

	/**
	 * Register a callback for credential-expiry events (FR-020).
	 */
	setOnCredentialExpiry(handler: () => void): void {
		this.onCredentialExpiry = handler;
	}

	/**
	 * Execute a single poll cycle with retry and credential-expiry detection.
	 */
	async pollOnce(): Promise<void> {
		const provider = this.registry.getActive();
		if (!provider) {
			logDebug("No active provider, skipping poll");
			return;
		}

		try {
			const sessions = await this.sessionStorage.getActive();
			if (sessions.length === 0) {
				return;
			}

			const updates = await provider.pollSessions(sessions);
			for (const update of updates) {
				const { localId, ...fields } = update;
				await this.sessionStorage.update(localId, fields);

				if (
					update.status === SessionStatus.COMPLETED ||
					update.status === SessionStatus.FAILED ||
					update.status === SessionStatus.CANCELLED
				) {
					await this.sessionStorage.update(localId, {
						completedAt: Date.now(),
					});
				}
			}

			this.consecutiveFailures = 0;
			if (updates.length > 0) {
				logDebug(`Applied ${updates.length} session update(s)`);
			}
		} catch (error) {
			this.consecutiveFailures += 1;

			if (this.isCredentialError(error)) {
				logWarn("Credential expiry detected during polling");
				this.onCredentialExpiry?.();
				return;
			}

			logError("Polling cycle failed", error);

			if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
				logWarn(
					`Polling paused after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
				);
				this.stop();
			}
		}
	}

	/**
	 * Start interval-based polling.
	 * @param intervalMs - Polling interval in milliseconds
	 */
	start(intervalMs: number): void {
		if (this.intervalId) {
			return;
		}
		this.consecutiveFailures = 0;
		this.intervalId = setInterval(() => {
			this.pollOnce().catch((error) => {
				logError("Interval poll failed", error);
			});
		}, intervalMs);
		logDebug(`Polling started with ${intervalMs}ms interval`);
	}

	/**
	 * Stop interval-based polling.
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
			logDebug("Polling stopped");
		}
	}

	private isCredentialError(error: unknown): boolean {
		if (error instanceof ProviderError) {
			return (
				error.code === ErrorCode.CREDENTIALS_INVALID ||
				error.code === ErrorCode.CREDENTIALS_MISSING
			);
		}
		return false;
	}
}
