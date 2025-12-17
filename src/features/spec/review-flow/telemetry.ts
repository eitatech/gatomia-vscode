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
 * Canonical telemetry event names for the review flow domain.
 * Using constants keeps instrumentation consistent across commands and UI.
 */
export const REVIEW_FLOW_EVENTS = {
	SPEC_STATUS_CHANGED: "spec.status.changed",
	SEND_TO_REVIEW: "review.send_to_review",
	SEND_TO_ARCHIVED: "review.send_to_archived",
	SPEC_UNARCHIVED: "review.spec_unarchived",
	SPEC_REOPENED: "review.spec_reopened",
	CHANGE_REQUEST_CREATED: "change_request.created",
	CHANGE_REQUEST_STATUS_CHANGED: "change_request.status.changed",
	TASKS_DISPATCHED: "tasks.dispatched",
	TASKS_DISPATCH_FAILED: "tasks.dispatch.failed",
	TASKS_DISPATCH_BLOCKED: "tasks.dispatch.blocked",
} as const;

/**
 * Telemetry event types for review flow
 */
export type ReviewFlowEventType =
	(typeof REVIEW_FLOW_EVENTS)[keyof typeof REVIEW_FLOW_EVENTS];

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
		type: REVIEW_FLOW_EVENTS.SPEC_STATUS_CHANGED,
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
		type: REVIEW_FLOW_EVENTS.CHANGE_REQUEST_CREATED,
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
		type: REVIEW_FLOW_EVENTS.CHANGE_REQUEST_STATUS_CHANGED,
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
		type: REVIEW_FLOW_EVENTS.TASKS_DISPATCHED,
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
		type: retryable
			? REVIEW_FLOW_EVENTS.TASKS_DISPATCH_FAILED
			: REVIEW_FLOW_EVENTS.TASKS_DISPATCH_BLOCKED,
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

/**
 * Log a Send to Review action after the button becomes available.
 */
export function logSendToReviewAction(options: {
	specId: string;
	pendingTasks: number;
	pendingChecklistItems: number;
	latencyMs?: number;
}): void {
	const event = {
		type: REVIEW_FLOW_EVENTS.SEND_TO_REVIEW,
		timestamp: new Date().toISOString(),
		...options,
	};
	console.log("[ReviewFlow Telemetry] Send to Review:", event);
}

/**
 * Log a Send to Archived action once blockers are cleared.
 */
export function logSendToArchivedAction(options: {
	specId: string;
	blockerChangeRequestIds: string[];
	latencyMs?: number;
}): void {
	const event = {
		type: REVIEW_FLOW_EVENTS.SEND_TO_ARCHIVED,
		timestamp: new Date().toISOString(),
		...options,
	};
	console.log("[ReviewFlow Telemetry] Send to Archived:", event);
}

/**
 * Log unarchive actions when archived specs must re-enter Current Specs.
 */
export function logSpecUnarchived(options: {
	specId: string;
	initiatedBy: string;
	reason: string;
}): void {
	const event = {
		type: REVIEW_FLOW_EVENTS.SPEC_UNARCHIVED,
		timestamp: new Date().toISOString(),
		...options,
	};
	console.log("[ReviewFlow Telemetry] Spec unarchived:", event);
}

/**
 * Log explicit reopen actions triggered by change requests.
 */
export function logSpecReopenedFromChangeRequest(options: {
	specId: string;
	changeRequestId: string;
	reason?: string;
}): void {
	const event = {
		type: REVIEW_FLOW_EVENTS.SPEC_REOPENED,
		timestamp: new Date().toISOString(),
		...options,
	};
	console.log("[ReviewFlow Telemetry] Spec reopened:", event);
}

/**
 * Log outstanding blocker counts when a spec status changes.
 * Tracks how many change requests are blocking archival.
 */
export function logOutstandingBlockerCount(options: {
	specId: string;
	status: SpecStatus;
	totalChangeRequests: number;
	openChangeRequests: number;
	blockingChangeRequests: number;
}): void {
	const event = {
		type: "review.blocker_count",
		timestamp: new Date().toISOString(),
		...options,
	};
	console.log("[ReviewFlow Telemetry] Outstanding blocker count:", event);
}
