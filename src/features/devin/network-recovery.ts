/**
 * Network Interruption Recovery
 *
 * Handles network interruptions during polling by tracking consecutive
 * failures and adjusting behavior accordingly.
 *
 * @see specs/001-devin-integration/spec.md (Edge Case: Network interruption)
 */

import { logWarn, logInfo } from "./logging";

// ============================================================================
// Network Recovery Tracker
// ============================================================================

/**
 * Tracks consecutive network failures and determines recovery behavior.
 */
export class NetworkRecoveryTracker {
	private consecutiveFailures = 0;
	private readonly maxConsecutiveFailures: number;

	constructor(maxConsecutiveFailures = 5) {
		this.maxConsecutiveFailures = maxConsecutiveFailures;
	}

	/**
	 * Record a network failure.
	 *
	 * @returns true if the failure threshold has been exceeded
	 */
	recordFailure(): boolean {
		this.consecutiveFailures += 1;
		logWarn(
			`Network failure #${this.consecutiveFailures}/${this.maxConsecutiveFailures}`
		);
		return this.consecutiveFailures >= this.maxConsecutiveFailures;
	}

	/**
	 * Record a successful network operation, resetting the failure counter.
	 */
	recordSuccess(): void {
		if (this.consecutiveFailures > 0) {
			logInfo(
				`Network recovered after ${this.consecutiveFailures} consecutive failures`
			);
			this.consecutiveFailures = 0;
		}
	}

	/**
	 * Whether the failure threshold has been exceeded.
	 */
	get isThresholdExceeded(): boolean {
		return this.consecutiveFailures >= this.maxConsecutiveFailures;
	}

	/**
	 * Reset the failure counter.
	 */
	reset(): void {
		this.consecutiveFailures = 0;
	}
}
