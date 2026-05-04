/**
 * Normalized Task Execution Metadata
 * Maps to [[Autonomous-Execution-States]]
 */
export type ExecutionState =
	| "queued" // Task is ready but waiting for resources
	| "ready" // Task has all prerequisites met
	| "running" // Agent is actively working on the task
	| "blocked" // Task is waiting on a dependency
	| "completed" // Task finished successfully
	| "failed" // Task encountered a fatal error
	| "skipped"; // Task is intentionally bypassed

export interface TaskExecutionMetadata {
	state: ExecutionState;
	intent?: string; // Detailed description or prompt for the agent
	suggestedRole?: string; // Role of the agent (e.g., 'frontend', 'backend', 'qa')
	parallelizable?: boolean; // Whether this task can run concurrently with others in its group
	dependsOn?: string[]; // Array of task IDs that must complete first
	errorMessage?: string; // Reason for failure, if applicable
	startedAt?: number; // Timestamp when the task started running
	completedAt?: number; // Timestamp when the task finished
}

/**
 * Common Task Status
 */
export type NormalizedTaskStatus =
	| "completed"
	| "in-progress"
	| "not-started"
	| "failed"
	| "blocked"
	| "skipped";

/**
 * Normalized Task representation across SpecKit, OpenSpec, etc.
 * Maps to [[Task-Normalization-Contract]]
 */
export interface NormalizedTask {
	id: string; // Global or spec-scoped unique ID
	title: string; // Short description
	status: NormalizedTaskStatus;
	source: {
		system: string; // e.g., "SpecKit", "OpenSpec"
		filePath: string; // Absolute path to the source file
		line?: number; // Original line number for navigation
		isUnsupported?: boolean; // True if the task couldn't be fully parsed
	};
	metadata: {
		phase?: string; // Phase or grouping
		priority?: string;
		complexity?: string;
	};
	execution?: TaskExecutionMetadata;
}

export interface TaskProvider {
	/**
	 * Unique identifier for the provider (e.g., 'speckit', 'openspec').
	 */
	readonly name: string;

	/**
	 * Determine if this provider handles the specified file.
	 */
	canHandle(filePath: string): boolean;

	/**
	 * Read and normalize tasks from a given file.
	 */
	getTasks(specId: string, filePath: string): Promise<NormalizedTask[]>;
}
