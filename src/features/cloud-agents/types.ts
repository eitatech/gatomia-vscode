/**
 * Cloud Agent Type Definitions
 *
 * Provider-agnostic types for the multi-provider cloud agent system.
 * These types are used across all cloud agent modules.
 *
 * @see specs/016-multi-provider-agents/data-model.md
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

// ============================================================================
// Session Status
// ============================================================================

/**
 * Canonical session status values shared across all providers
 * @see specs/016-multi-provider-agents/data-model.md:L79-L88
 */
export const SessionStatus = {
	PENDING: "pending",
	RUNNING: "running",
	BLOCKED: "blocked",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// ============================================================================
// Task Status
// ============================================================================

/**
 * Canonical task status values shared across all providers
 * @see specs/016-multi-provider-agents/data-model.md:L92-L98
 */
export const TaskStatus = {
	PENDING: "pending",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
	FAILED: "failed",
	SKIPPED: "skipped",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// ============================================================================
// Task Priority
// ============================================================================

/**
 * Task priority levels
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export const TaskPriority = {
	LOW: "low",
	MEDIUM: "medium",
	HIGH: "high",
	CRITICAL: "critical",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

// ============================================================================
// Provider Metadata
// ============================================================================

/**
 * Provider metadata and capability information.
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export interface ProviderMetadata {
	/** Unique provider identifier (kebab-case, e.g., "devin", "github-copilot") */
	readonly id: string;
	/** Human-readable name displayed in UI */
	readonly displayName: string;
	/** Brief description for provider selection UI */
	readonly description: string;
	/** Icon identifier for tree view rendering */
	readonly icon: string;
}

// ============================================================================
// Agent Session
// ============================================================================

/**
 * A unit of work dispatched to a cloud agent provider.
 * Provider-agnostic structure populated by adapters.
 *
 * @see specs/016-multi-provider-agents/data-model.md:L29-L48
 */
export interface AgentSession {
	/** Local unique identifier (UUID v4) */
	readonly localId: string;
	/** Provider that owns this session */
	readonly providerId: string;
	/** Provider's external session identifier */
	readonly providerSessionId: string | undefined;
	/** Current session status */
	status: SessionStatus;
	/** Associated git branch */
	readonly branch: string;
	/** Path to related spec file */
	readonly specPath: string;
	/** Tasks within this session */
	readonly tasks: AgentTask[];
	/** Pull requests created */
	readonly pullRequests: PullRequest[];
	/** Creation timestamp (ms) */
	readonly createdAt: number;
	/** Last update timestamp (ms) */
	updatedAt: number;
	/** Completion timestamp (ms) */
	completedAt: number | undefined;
	/** True if from inactive provider */
	isReadOnly: boolean;
	/** URL to view session in provider's UI */
	externalUrl?: string;
	/** Error message if failed */
	errorMessage?: string;
}

// ============================================================================
// Agent Task
// ============================================================================

/**
 * A single task within a session, linked to a spec task.
 *
 * @see specs/016-multi-provider-agents/data-model.md:L49-L63
 */
export interface AgentTask {
	/** Task ID (provider-specific) */
	readonly id: string;
	/** ID of the spec task this maps to */
	readonly specTaskId: string;
	/** Task title */
	readonly title: string;
	/** Task description */
	readonly description: string;
	/** Priority level */
	readonly priority: TaskPriority;
	/** Current task status */
	readonly status: TaskStatus;
	/** Unix timestamp when task started */
	readonly startedAt?: number;
	/** Unix timestamp when task completed */
	readonly completedAt?: number;
}

// ============================================================================
// Pull Request
// ============================================================================

/**
 * A pull request created by an agent session.
 *
 * @see specs/016-multi-provider-agents/data-model.md:L65-L73
 */
export interface PullRequest {
	/** URL to the pull request */
	readonly url: string;
	/** PR state (e.g., "open", "merged", "closed") */
	readonly state?: string;
	/** Branch name */
	readonly branch: string;
	/** PR creation timestamp */
	readonly createdAt: number;
}

// ============================================================================
// Spec Task (input for dispatch)
// ============================================================================

/**
 * A spec task to be dispatched to a provider.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export interface SpecTask {
	/** Task identifier from spec (e.g., "T-001") */
	readonly id: string;
	/** Task title */
	readonly title: string;
	/** Task description */
	readonly description: string;
	/** Priority level */
	readonly priority: TaskPriority;
}

// ============================================================================
// Session Context
// ============================================================================

/**
 * Context provided when creating a session.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export interface SessionContext {
	/** Git branch for this session */
	readonly branch: string;
	/** Relative path to the spec/tasks file (e.g., "specs/001-auth/tasks.md") */
	readonly specPath: string;
	/** Workspace folder URI */
	readonly workspaceUri: string;
	/** Repository remote URL */
	readonly repoUrl?: string;
	/** Relative path to the feature spec dir (e.g., "specs/001-auth") */
	readonly featurePath?: string;
	/** Whether this dispatches the entire feature (true) or specific tasks (false) */
	readonly isFullFeature?: boolean;
	/** Specific task IDs to execute (when not full feature) */
	readonly taskIds?: string[];
}

// ============================================================================
// Session Update
// ============================================================================

/**
 * Partial session update returned by polling.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export interface SessionUpdate {
	/** Session being updated */
	readonly localId: string;
	/** New status (if changed) */
	status?: SessionStatus;
	/** Updated tasks */
	tasks?: AgentTask[];
	/** Updated PRs */
	pullRequests?: PullRequest[];
	/** External URL (if now available) */
	externalUrl?: string;
	/** Error message (if status failed) */
	errorMessage?: string;
	/** Update timestamp */
	readonly timestamp: number;
}

// ============================================================================
// Provider Action
// ============================================================================

/**
 * An action returned by a provider for blocked session handling.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */
export type ProviderAction =
	| { type: "openUrl"; url: string }
	| { type: "notify"; message: string }
	| { type: "none" };

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for provider operations
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export const ErrorCode = {
	CREDENTIALS_MISSING: "CREDENTIALS_MISSING",
	CREDENTIALS_INVALID: "CREDENTIALS_INVALID",
	SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
	SESSION_CREATION_FAILED: "SESSION_CREATION_FAILED",
	SESSION_CANCEL_FAILED: "SESSION_CANCEL_FAILED",
	API_UNAVAILABLE: "API_UNAVAILABLE",
	API_RATE_LIMITED: "API_RATE_LIMITED",
	API_ERROR: "API_ERROR",
	NETWORK_ERROR: "NETWORK_ERROR",
	TIMEOUT: "TIMEOUT",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Custom error class for provider-related errors.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export class ProviderError extends Error {
	readonly code: ErrorCode;
	readonly providerId: string;
	readonly recoverable: boolean;

	constructor(
		message: string,
		code: ErrorCode,
		providerId: string,
		recoverable = false
	) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = "ProviderError";
		this.code = code;
		this.providerId = providerId;
		this.recoverable = recoverable;
	}
}

// ============================================================================
// Store Error Types
// ============================================================================

/**
 * Error codes for storage operations
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */
export const StoreErrorCode = {
	NOT_FOUND: "NOT_FOUND",
	ALREADY_EXISTS: "ALREADY_EXISTS",
	SERIALIZATION_ERROR: "SERIALIZATION_ERROR",
	STORAGE_FULL: "STORAGE_FULL",
	PERMISSION_DENIED: "PERMISSION_DENIED",
	UNKNOWN: "UNKNOWN",
} as const;
export type StoreErrorCode =
	(typeof StoreErrorCode)[keyof typeof StoreErrorCode];

/**
 * Custom error class for storage operations.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */
export class StoreError extends Error {
	readonly code: StoreErrorCode;
	readonly operation: string;

	constructor(message: string, code: StoreErrorCode, operation: string) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = "StoreError";
		this.code = code;
		this.operation = operation;
	}
}
