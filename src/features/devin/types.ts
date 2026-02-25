/**
 * Devin Integration Type Definitions
 *
 * Core enums and type aliases for the Devin remote implementation integration.
 * These types are used across all Devin feature modules.
 *
 * @see specs/001-devin-integration/data-model.md
 * @see specs/001-devin-integration/contracts/devin-api.ts
 */

// ============================================================================
// API Version
// ============================================================================

/**
 * Supported Devin API versions
 * @see specs/001-devin-integration/research.md:L8-L14
 */
export const ApiVersion = {
	V1: "v1",
	V2: "v2",
	V3: "v3",
} as const;
export type ApiVersion = (typeof ApiVersion)[keyof typeof ApiVersion];

// ============================================================================
// Session Status (Devin API)
// ============================================================================

/**
 * Raw session status values returned by the Devin API
 * @see specs/001-devin-integration/research.md:L144-L155
 */
export const DevinApiStatus = {
	NEW: "new",
	CLAIMED: "claimed",
	RUNNING: "running",
	EXIT: "exit",
	ERROR: "error",
	SUSPENDED: "suspended",
	RESUMING: "resuming",
} as const;
export type DevinApiStatus =
	(typeof DevinApiStatus)[keyof typeof DevinApiStatus];

/**
 * Granular status detail from v3 API
 * @see specs/001-devin-integration/research.md:L156
 */
export type DevinStatusDetail =
	| "working"
	| "waiting_for_user"
	| "finished"
	| (string & {});

// ============================================================================
// Local Session Status (Mapped)
// ============================================================================

/**
 * Local session status values mapped from Devin API status
 * @see specs/001-devin-integration/data-model.md:L30-L35
 */
export const SessionStatus = {
	QUEUED: "queued",
	INITIALIZING: "initializing",
	RUNNING: "running",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// ============================================================================
// Task Status
// ============================================================================

/**
 * Status values for individual tasks sent to Devin
 * @see specs/001-devin-integration/data-model.md:L59
 */
export const TaskStatus = {
	PENDING: "pending",
	QUEUED: "queued",
	IN_PROGRESS: "in-progress",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// ============================================================================
// Event Types
// ============================================================================

/**
 * Categories of progress events from Devin sessions
 * @see specs/001-devin-integration/data-model.md:L98-L104
 */
export const EventType = {
	STATUS_CHANGE: "status_change",
	LOG_OUTPUT: "log_output",
	PR_CREATED: "pr_created",
	ERROR: "error",
	MILESTONE: "milestone",
	ARTIFACT: "artifact",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

// ============================================================================
// Task Priority
// ============================================================================

/**
 * Task priority levels
 * @see specs/001-devin-integration/data-model.md:L52
 */
export type TaskPriority = "P1" | "P2" | "P3";

// ============================================================================
// Artifact Types
// ============================================================================

/**
 * Types of artifacts produced by Devin during task execution
 * @see specs/001-devin-integration/data-model.md:L129
 */
export type ArtifactType = "file" | "log" | "test_result";

// ============================================================================
// PR State
// ============================================================================

/**
 * Pull request state values
 * @see specs/001-devin-integration/data-model.md:L115
 */
export type PullRequestState = "open" | "closed" | "merged";
