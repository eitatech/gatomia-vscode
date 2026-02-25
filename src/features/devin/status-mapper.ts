/**
 * Session Status Mapper
 *
 * Maps Devin API status values to local session status values.
 * Provides a clean abstraction over API version differences.
 *
 * @see specs/001-devin-integration/data-model.md:L30-L35
 * @see specs/001-devin-integration/research.md:L144-L155
 */

import type { DevinApiStatus } from "./types";
import { SessionStatus } from "./types";

// ============================================================================
// Status Mapping
// ============================================================================

const STATUS_MAP: Record<string, SessionStatus> = {
	new: SessionStatus.INITIALIZING,
	claimed: SessionStatus.INITIALIZING,
	running: SessionStatus.RUNNING,
	exit: SessionStatus.COMPLETED,
	error: SessionStatus.FAILED,
	suspended: SessionStatus.RUNNING,
	resuming: SessionStatus.RUNNING,
};

/**
 * Map a Devin API status to a local session status.
 *
 * @param apiStatus - The raw status from the Devin API
 * @returns The mapped local session status
 */
export function mapDevinApiStatusToSessionStatus(
	apiStatus: DevinApiStatus | string
): SessionStatus {
	return STATUS_MAP[apiStatus] ?? SessionStatus.RUNNING;
}

// ============================================================================
// Terminal Status Check
// ============================================================================

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
	SessionStatus.COMPLETED,
	SessionStatus.FAILED,
	SessionStatus.CANCELLED,
]);

/**
 * Check if a session status is terminal (no further transitions possible).
 */
export function isTerminalStatus(status: SessionStatus): boolean {
	return TERMINAL_STATUSES.has(status);
}
