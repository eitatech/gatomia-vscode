/**
 * Devin Integration Entity Interfaces
 *
 * Core data structures for the Devin remote implementation integration.
 * These interfaces define the shape of all persistent and in-memory entities.
 *
 * @see specs/001-devin-integration/data-model.md
 * @see specs/001-devin-integration/contracts/extension-api.ts
 */

import type {
	ApiVersion,
	ArtifactType,
	EventType,
	PullRequestState,
	SessionStatus,
	TaskPriority,
	TaskStatus,
} from "./types";

// ============================================================================
// DevinSession
// ============================================================================

/**
 * Represents an active or completed Devin implementation session.
 * Stored in VS Code workspace state with 7-day retention after completion.
 *
 * @see specs/001-devin-integration/data-model.md:L8-L37
 */
export interface DevinSession {
	/** Unique Devin session identifier (from API) */
	readonly sessionId: string;
	/** Local UUID for VS Code tracking */
	readonly localId: string;
	/** Current session state */
	readonly status: SessionStatus;
	/** Git branch being worked on */
	readonly branch: string;
	/** Path to spec file in workspace */
	readonly specPath: string;
	/** Tasks sent to Devin */
	readonly tasks: DevinTask[];
	/** Timestamp (ms since epoch) */
	readonly createdAt: number;
	/** Last update timestamp */
	readonly updatedAt: number;
	/** Completion timestamp */
	readonly completedAt?: number;
	/** URL to Devin web interface */
	readonly devinUrl?: string;
	/** PRs created by Devin */
	readonly pullRequests: PullRequest[];
	/** API version used */
	readonly apiVersion: ApiVersion;
	/** Organization ID (v3 only) */
	readonly orgId?: string;
	/** Error details if failed */
	readonly errorMessage?: string;
	/** Number of retry attempts (default: 0) */
	readonly retryCount: number;
}

// ============================================================================
// DevinTask
// ============================================================================

/**
 * Represents an individual task sent to Devin.
 *
 * @see specs/001-devin-integration/data-model.md:L41-L59
 */
export interface DevinTask {
	/** Unique task identifier (local) */
	readonly taskId: string;
	/** Reference to spec task ID */
	readonly specTaskId: string;
	/** Task title */
	readonly title: string;
	/** Task description/prompt */
	readonly description: string;
	/** Criteria for task completion */
	readonly acceptanceCriteria?: string[];
	/** Task priority */
	readonly priority: TaskPriority;
	/** Current task state */
	readonly status: TaskStatus;
	/** Associated Devin session (if started) */
	readonly devinSessionId?: string;
	/** Output files, logs, etc. */
	readonly artifacts?: TaskArtifact[];
	/** When task was sent to Devin */
	readonly startedAt?: number;
	/** When task completed */
	readonly completedAt?: number;
}

// ============================================================================
// DevinCredentials
// ============================================================================

/**
 * Stores authentication credentials for Devin API access.
 * Persisted in VS Code SecretStorage (encrypted at rest).
 *
 * @see specs/001-devin-integration/data-model.md:L63-L82
 */
export interface DevinCredentials {
	/** API token (encrypted at rest) */
	readonly apiKey: string;
	/** Detected API version from key prefix */
	readonly apiVersion: ApiVersion;
	/** Organization ID (v3 only) */
	readonly orgId?: string;
	/** When credentials were added */
	readonly createdAt: number;
	/** Last successful API call */
	readonly lastUsedAt?: number;
	/** Validation status */
	readonly isValid: boolean;
}

// ============================================================================
// DevinProgressEvent
// ============================================================================

/**
 * Represents a status update or log entry from Devin.
 * Stored in-memory with recent history retained for session lifetime.
 *
 * @see specs/001-devin-integration/data-model.md:L85-L105
 */
export interface DevinProgressEvent {
	/** Unique event identifier */
	readonly eventId: string;
	/** Parent session reference */
	readonly sessionId: string;
	/** Event timestamp */
	readonly timestamp: number;
	/** Category of event */
	readonly eventType: EventType;
	/** Human-readable description */
	readonly message: string;
	/** Structured event data */
	readonly data?: Record<string, unknown>;
}

// ============================================================================
// PullRequest
// ============================================================================

/**
 * Represents a pull request created by Devin.
 * Embedded in DevinSession.
 *
 * @see specs/001-devin-integration/data-model.md:L108-L119
 */
export interface PullRequest {
	/** URL to pull request */
	readonly prUrl: string;
	/** PR state */
	readonly prState?: PullRequestState;
	/** Branch name */
	readonly branch: string;
	/** PR creation timestamp */
	readonly createdAt: number;
	/** When PR was merged */
	readonly mergedAt?: number;
}

// ============================================================================
// TaskArtifact
// ============================================================================

/**
 * Output produced by Devin during task execution.
 * Embedded in DevinTask.
 *
 * @see specs/001-devin-integration/data-model.md:L122-L134
 */
export interface TaskArtifact {
	/** Unique identifier */
	readonly artifactId: string;
	/** Artifact type */
	readonly type: ArtifactType;
	/** Display name */
	readonly name: string;
	/** File path (if applicable) */
	readonly path?: string;
	/** Content or URL to content */
	readonly content?: string;
	/** Timestamp */
	readonly createdAt: number;
}
