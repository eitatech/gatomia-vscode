/**
 * Progress Event Handler
 *
 * Processes status change events from the polling service and generates
 * progress events for the UI. Bridges polling data to DevinProgressEvent entities.
 *
 * @see specs/001-devin-integration/data-model.md:L85-L105
 */

import type { DevinProgressEvent } from "./entities";
import type { StatusChangeEvent } from "./devin-polling-service";
import { EventType } from "./types";

// ============================================================================
// Event Handler
// ============================================================================

/**
 * Convert a polling status change into a DevinProgressEvent.
 */
export function createProgressEventFromStatusChange(
	event: StatusChangeEvent
): DevinProgressEvent {
	return {
		eventId: crypto.randomUUID(),
		sessionId: event.sessionId,
		timestamp: Date.now(),
		eventType: EventType.STATUS_CHANGE,
		message: `Session status changed from ${event.previousStatus} to ${event.status}`,
		data: {
			previousStatus: event.previousStatus,
			newStatus: event.status,
		},
	};
}

/**
 * Create a progress event for PR creation.
 */
export function createPrCreatedEvent(
	sessionId: string,
	prUrl: string
): DevinProgressEvent {
	return {
		eventId: crypto.randomUUID(),
		sessionId,
		timestamp: Date.now(),
		eventType: EventType.PR_CREATED,
		message: `Pull request created: ${prUrl}`,
		data: { prUrl },
	};
}

/**
 * Create a progress event for errors.
 */
export function createErrorEvent(
	sessionId: string,
	errorMessage: string
): DevinProgressEvent {
	return {
		eventId: crypto.randomUUID(),
		sessionId,
		timestamp: Date.now(),
		eventType: EventType.ERROR,
		message: errorMessage,
	};
}
