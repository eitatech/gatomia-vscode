/**
 * Devin Integration Telemetry
 *
 * Tracks significant Devin operations for observability.
 * Uses VS Code output channel for logging telemetry events.
 *
 * @see specs/001-devin-integration/plan.md (Observability requirement)
 */

import { TELEMETRY_PREFIX } from "./config";
import type { SessionStatus } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Telemetry event data for Devin operations.
 */
export interface DevinTelemetryEvent {
	readonly eventName: string;
	readonly properties: Record<string, string | number | boolean>;
	readonly timestamp: number;
}

// ============================================================================
// Event Names
// ============================================================================

export const TELEMETRY_EVENTS = {
	TASK_START: `${TELEMETRY_PREFIX}.taskStart`,
	TASK_START_SUCCESS: `${TELEMETRY_PREFIX}.taskStartSuccess`,
	TASK_START_FAILURE: `${TELEMETRY_PREFIX}.taskStartFailure`,
	SESSION_CANCEL: `${TELEMETRY_PREFIX}.sessionCancel`,
	SESSION_STATUS_CHANGE: `${TELEMETRY_PREFIX}.sessionStatusChange`,
	CREDENTIALS_CONFIGURED: `${TELEMETRY_PREFIX}.credentialsConfigured`,
	API_ERROR: `${TELEMETRY_PREFIX}.apiError`,
	BATCH_START: `${TELEMETRY_PREFIX}.batchStart`,
	BATCH_COMPLETE: `${TELEMETRY_PREFIX}.batchComplete`,
	POLL_CYCLE: `${TELEMETRY_PREFIX}.pollCycle`,
	SESSION_CLEANUP: `${TELEMETRY_PREFIX}.sessionCleanup`,
	PR_CREATED: `${TELEMETRY_PREFIX}.prCreated`,
} as const;

// ============================================================================
// Telemetry Logger
// ============================================================================

/**
 * Log a telemetry event. Currently writes to console for debugging.
 * Can be extended to send to a telemetry service.
 */
export function logTelemetryEvent(event: DevinTelemetryEvent): void {
	console.log(
		`[${TELEMETRY_PREFIX}] ${event.eventName}`,
		JSON.stringify(event.properties)
	);
}

/**
 * Log a task start attempt.
 */
export function logTaskStart(taskId: string, branch: string): void {
	logTelemetryEvent({
		eventName: TELEMETRY_EVENTS.TASK_START,
		properties: { taskId, branch },
		timestamp: Date.now(),
	});
}

/**
 * Log a successful task start.
 */
export function logTaskStartSuccess(
	taskId: string,
	sessionId: string,
	apiVersion: string
): void {
	logTelemetryEvent({
		eventName: TELEMETRY_EVENTS.TASK_START_SUCCESS,
		properties: { taskId, sessionId, apiVersion },
		timestamp: Date.now(),
	});
}

/**
 * Log a failed task start.
 */
export function logTaskStartFailure(
	taskId: string,
	errorCode: string,
	errorMessage: string
): void {
	logTelemetryEvent({
		eventName: TELEMETRY_EVENTS.TASK_START_FAILURE,
		properties: { taskId, errorCode, errorMessage },
		timestamp: Date.now(),
	});
}

/**
 * Log a session cancellation.
 */
export function logSessionCancel(localId: string): void {
	logTelemetryEvent({
		eventName: TELEMETRY_EVENTS.SESSION_CANCEL,
		properties: { localId },
		timestamp: Date.now(),
	});
}

/**
 * Log a session status change.
 */
export function logSessionStatusChange(
	localId: string,
	fromStatus: SessionStatus,
	toStatus: SessionStatus
): void {
	logTelemetryEvent({
		eventName: TELEMETRY_EVENTS.SESSION_STATUS_CHANGE,
		properties: { localId, fromStatus, toStatus },
		timestamp: Date.now(),
	});
}
