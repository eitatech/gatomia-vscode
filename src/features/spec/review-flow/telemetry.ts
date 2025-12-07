/**
 * Telemetry and logging for Spec Explorer review flow.
 * Emits events for status transitions, change requests, and task dispatch.
 *
 * Events:
 * - spec.status.changed: Spec transitions between statuses
 * - change_request.created: New change request filed
 * - change_request.status.changed: Change request status transitions
 * - tasks.dispatched: Tasks prompt dispatch succeeded
 * - tasks.dispatch.failed: Tasks prompt dispatch failed
 */

import type {
	SpecStatus,
	ChangeRequestStatus,
	ChangeRequestSeverity,
} from "./types";

/**
 * Telemetry event types for review flow
 */
export type ReviewFlowEventType =
	| "spec.status.changed"
	| "change_request.created"
	| "change_request.status.changed"
	| "tasks.dispatched"
	| "tasks.dispatch.failed"
	| "tasks.dispatch.blocked";

/**
 * Log a spec status transition
 * @param specId Spec identifier
 * @param fromStatus Previous status
 * @param toStatus New status
 */
export function logSpecStatusChange(
	specId: string,
	fromStatus: SpecStatus,
	toStatus: SpecStatus
): void {
	const event = {
		type: "spec.status.changed",
		timestamp: new Date().toISOString(),
		specId,
		fromStatus,
		toStatus,
	};

	console.log("[ReviewFlow Telemetry] Spec status change:", event);

	// TODO: Send to telemetry backend (e.g., Application Insights, custom analytics)
	// telemetryClient.trackEvent('review-flow:spec-status-change', {
	//   specId,
	//   fromStatus,
	//   toStatus,
	// });
}

/**
 * Log change request creation
 * @param options Change request creation details
 */
export function logChangeRequestCreated(options: {
	specId: string;
	changeRequestId: string;
	severity: ChangeRequestSeverity;
	title: string;
	submitter: string;
}): void {
	const { specId, changeRequestId, severity, title, submitter } = options;
	const event = {
		type: "change_request.created",
		timestamp: new Date().toISOString(),
		specId,
		changeRequestId,
		severity,
		titleLength: title.length,
		submitter,
	};

	console.log("[ReviewFlow Telemetry] Change request created:", event);

	// TODO: Send to telemetry backend
	// telemetryClient.trackEvent('review-flow:change-request-created', {
	//   specId,
	//   changeRequestId,
	//   severity,
	// });
}

/**
 * Log change request status update
 * @param changeRequestId Change request identifier
 * @param fromStatus Previous status
 * @param toStatus New status
 */
export function logChangeRequestStatusChange(
	changeRequestId: string,
	fromStatus: ChangeRequestStatus,
	toStatus: ChangeRequestStatus
): void {
	const event = {
		type: "change_request.status.changed",
		timestamp: new Date().toISOString(),
		changeRequestId,
		fromStatus,
		toStatus,
	};

	console.log("[ReviewFlow Telemetry] Change request status change:", event);

	// TODO: Send to telemetry backend
	// telemetryClient.trackEvent('review-flow:change-request-status-change', {
	//   changeRequestId,
	//   fromStatus,
	//   toStatus,
	// });
}

/**
 * Log successful tasks prompt dispatch
 * @param specId Spec identifier
 * @param changeRequestId Change request being dispatched
 * @param taskCount Number of tasks created
 * @param roundtripMs Time taken for dispatch roundtrip
 */
export function logTasksDispatchSuccess(
	specId: string,
	changeRequestId: string,
	taskCount: number,
	roundtripMs: number
): void {
	const event = {
		type: "tasks.dispatched",
		timestamp: new Date().toISOString(),
		specId,
		changeRequestId,
		taskCount,
		roundtripMs,
	};

	console.log("[ReviewFlow Telemetry] Tasks dispatch success:", event);

	// TODO: Send to telemetry backend with metrics
	// telemetryClient.trackEvent('review-flow:tasks-dispatch-success', {
	//   specId,
	//   changeRequestId,
	// }, {
	//   taskCount,
	//   roundtripMs,
	// });
}

/**
 * Log failed tasks prompt dispatch
 * @param specId Spec identifier
 * @param changeRequestId Change request that failed
 * @param error Error message or exception
 * @param retryable Whether the failure is retryable
 */
export function logTasksDispatchFailed(
	specId: string,
	changeRequestId: string,
	error: string,
	retryable: boolean
): void {
	const event = {
		type: retryable ? "tasks.dispatch.failed" : "tasks.dispatch.blocked",
		timestamp: new Date().toISOString(),
		specId,
		changeRequestId,
		error,
		retryable,
	};

	console.warn("[ReviewFlow Telemetry] Tasks dispatch failed:", event);

	// TODO: Send to telemetry backend with error tracking
	// telemetryClient.trackException(new Error(error), {
	//   specId,
	//   changeRequestId,
	//   retryable: retryable.toString(),
	// });
}
