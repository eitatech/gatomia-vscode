/**
 * Type definitions for Spec Explorer review flow feature.
 * Defines Specification statuses, ChangeRequest, and TaskLink entities.
 */

/**
 * Spec status in the review flow: Current Specs → Review → Reopened → Archived (with optional unarchive)
 * NOTE: keep legacy "readyToReview" temporarily for backward compatibility until providers are migrated.
 */
export type SpecStatus =
	| "current"
	| "readyToReview"
	| "review"
	| "reopened"
	| "archived";

/**
 * Change request status: open → (blocked | inProgress) → addressed
 */
export type ChangeRequestStatus =
	| "open"
	| "blocked"
	| "inProgress"
	| "addressed";

/**
 * Task link status: open → inProgress → done
 */
export type TaskLinkStatus = "open" | "inProgress" | "done";

/**
 * Change request severity levels
 */
export type ChangeRequestSeverity = "low" | "medium" | "high" | "critical";

/**
 * Links for a spec document
 */
export interface SpecLinks {
	specPath: string;
	docUrl?: string;
}

/**
 * Specification entity: core document in SpecExplorer with review flow status
 */
export interface Specification {
	id: string;
	title: string;
	owner: string;
	status: SpecStatus;
	completedAt: Date | null;
	reviewEnteredAt?: Date | null;
	archivedAt?: Date | null;
	updatedAt: Date;
	links: SpecLinks;
	pendingTasks?: number;
	pendingChecklistItems?: number;
	changeRequests?: ChangeRequest[];
}

/**
 * Link to a task generated from a change request
 */
export interface TaskLink {
	taskId: string;
	source: "tasksPrompt";
	status: TaskLinkStatus;
	createdAt: Date;
}

/**
 * Change request: reviewer feedback on a spec that may generate tasks
 */
export interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: ChangeRequestSeverity;
	status: ChangeRequestStatus;
	tasks: TaskLink[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
	/**
	 * Flag indicating this change request currently blocks archiving/unarchiving actions.
	 */
	archivalBlocker?: boolean;
}
