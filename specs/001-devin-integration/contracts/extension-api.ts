/**
 * Extension Internal API Contract
 *
 * Interfaces for VS Code extension internal communication
 * between extension host and webview.
 */

// ============================================================================
// Webview <-> Extension Messages
// ============================================================================

export type MessageType =
	| "start-task"
	| "start-all-tasks"
	| "cancel-session"
	| "refresh-status"
	| "open-pr"
	| "session-update"
	| "progress-event"
	| "error";

export interface WebviewMessage {
	readonly type: MessageType;
	readonly payload: unknown;
	readonly timestamp: number;
}

// ============================================================================
// Command Messages (Webview -> Extension)
// ============================================================================

export interface StartTaskMessage extends WebviewMessage {
	readonly type: "start-task";
	readonly payload: {
		/** Spec file path */
		readonly specPath: string;
		/** Task ID from spec */
		readonly taskId: string;
		/** Current git branch */
		readonly branch: string;
	};
}

export interface StartAllTasksMessage extends WebviewMessage {
	readonly type: "start-all-tasks";
	readonly payload: {
		/** Spec file path */
		readonly specPath: string;
		/** Current git branch */
		readonly branch: string;
		/** Task IDs to implement (optional - defaults to all uncompleted) */
		readonly taskIds?: string[];
	};
}

export interface CancelSessionMessage extends WebviewMessage {
	readonly type: "cancel-session";
	readonly payload: {
		/** Local session ID */
		readonly localId: string;
	};
}

export interface RefreshStatusMessage extends WebviewMessage {
	readonly type: "refresh-status";
	readonly payload: {
		/** Local session ID */
		readonly localId: string;
	};
}

export interface OpenPrMessage extends WebviewMessage {
	readonly type: "open-pr";
	readonly payload: {
		/** Pull request URL */
		readonly prUrl: string;
	};
}

// ============================================================================
// Event Messages (Extension -> Webview)
// ============================================================================

export interface SessionUpdateMessage extends WebviewMessage {
	readonly type: "session-update";
	readonly payload: {
		/** Full session state */
		readonly session: SessionViewModel;
	};
}

export interface ProgressEventMessage extends WebviewMessage {
	readonly type: "progress-event";
	readonly payload: {
		/** Local session ID */
		readonly localId: string;
		/** Event details */
		readonly event: ProgressEventViewModel;
	};
}

export interface ErrorMessage extends WebviewMessage {
	readonly type: "error";
	readonly payload: {
		/** Error code */
		readonly code: string;
		/** Human-readable message */
		readonly message: string;
		/** Associated session ID (if any) */
		readonly localId?: string;
	};
}

// ============================================================================
// View Models (for UI)
// ============================================================================

export interface SessionViewModel {
	/** Local session ID */
	readonly localId: string;
	/** Devin session ID (if assigned) */
	readonly devinSessionId?: string;
	/** Display title */
	readonly title: string;
	/** Current status */
	readonly status: SessionStatus;
	/** Detailed status description */
	readonly statusDetail?: string;
	/** Git branch */
	readonly branch: string;
	/** Spec file name */
	readonly specName: string;
	/** Associated tasks */
	readonly tasks: TaskViewModel[];
	/** Progress percentage (0-100) */
	readonly progress: number;
	/** When session started */
	readonly startedAt: number;
	/** Estimated completion time */
	readonly estimatedCompletion?: number;
	/** Pull requests created */
	readonly pullRequests: PullRequestViewModel[];
	/** Recent activity log */
	readonly recentEvents: ProgressEventViewModel[];
	/** URL to Devin web interface */
	readonly devinUrl?: string;
	/** Error message (if failed) */
	readonly errorMessage?: string;
	/** Number of retry attempts */
	readonly retryCount: number;
}

export interface TaskViewModel {
	/** Task ID */
	readonly taskId: string;
	/** Display title */
	readonly title: string;
	/** Task description */
	readonly description: string;
	/** Priority level */
	readonly priority: "P1" | "P2" | "P3";
	/** Current status */
	readonly status: TaskStatus;
	/** When task was sent to Devin */
	readonly startedAt?: number;
	/** When task completed */
	readonly completedAt?: number;
}

export interface PullRequestViewModel {
	/** PR URL */
	readonly url: string;
	/** PR state */
	readonly state: "open" | "closed" | "merged";
	/** Branch name */
	readonly branch: string;
	/** When PR was created */
	readonly createdAt: number;
}

export interface ProgressEventViewModel {
	/** Event ID */
	readonly eventId: string;
	/** Event timestamp */
	readonly timestamp: number;
	/** Event type */
	readonly type: EventType;
	/** Display message */
	readonly message: string;
	/** Additional data (type-specific) */
	readonly data?: object;
}

// ============================================================================
// Status Types
// ============================================================================

export type SessionStatus =
	| "queued"
	| "initializing"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export type TaskStatus =
	| "pending"
	| "queued"
	| "in-progress"
	| "completed"
	| "failed"
	| "cancelled";

export type EventType =
	| "status_change"
	| "log_output"
	| "pr_created"
	| "error"
	| "milestone"
	| "artifact";

// ============================================================================
// Configuration
// ============================================================================

export interface DevinConfiguration {
	/** API token (stored in SecretStorage) */
	readonly apiKey?: string;
	/** Organization ID (v3 only) */
	readonly orgId?: string;
	/** Polling interval in seconds (default: 5) */
	readonly pollingInterval: number;
	/** Maximum retry attempts (default: 3) */
	readonly maxRetries: number;
	/** Enable verbose logging */
	readonly verboseLogging: boolean;
}

// ============================================================================
// Commands (VS Code Command Palette)
// ============================================================================

export const enum DevinCommand {
	START_TASK = "gatomia.devin.startTask",
	START_ALL_TASKS = "gatomia.devin.startAllTasks",
	OPEN_PROGRESS = "gatomia.devin.openProgress",
	CANCEL_SESSION = "gatomia.devin.cancelSession",
	CONFIGURE_CREDENTIALS = "gatomia.devin.configureCredentials"
}

// ============================================================================
// Storage Keys
// ============================================================================

export const enum StorageKey {
	SESSIONS = "gatomia.devin.sessions",
	CREDENTIALS = "gatomia.devin.credentials",
	CONFIGURATION = "gatomia.devin.configuration"
}
