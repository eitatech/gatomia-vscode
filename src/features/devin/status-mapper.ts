/**
 * Session Status Mapper
 *
 * Maps Devin API status values to local session status values.
 * Provides a clean abstraction over API version differences.
 *
 * @see specs/001-devin-integration/data-model.md:L30-L35
 * @see specs/001-devin-integration/research.md:L144-L155
 */

import type { DevinApiStatus, DevinStatusDetail } from "./types";
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

const STATUS_DETAIL_MAP: Record<string, SessionStatus> = {
	working: SessionStatus.RUNNING,
	finished: SessionStatus.COMPLETED,
	blocked: SessionStatus.BLOCKED,
	waiting_for_user: SessionStatus.BLOCKED,
	error: SessionStatus.FAILED,
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

/**
 * Resolve the effective session status using both the base status and
 * the granular status detail (status_enum in v1, status_detail in v3).
 *
 * The statusDetail field is the source of truth when available because
 * the base status field can be stale (e.g. "suspended" when the session
 * is actually "finished").
 *
 * @param apiStatus - The raw status field from the API response
 * @param statusDetail - The granular status_enum/status_detail field
 * @returns The mapped local session status
 */
export function resolveSessionStatus(
	apiStatus: DevinApiStatus | string,
	statusDetail?: DevinStatusDetail | string
): SessionStatus {
	if (statusDetail) {
		const detailStatus = STATUS_DETAIL_MAP[statusDetail];
		if (detailStatus) {
			return detailStatus;
		}
	}
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
