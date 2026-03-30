/**
 * Batch Task Processor
 *
 * Processes multiple spec tasks sequentially, creating one Devin session
 * per task. Handles partial failures gracefully and emits progress events.
 *
 * @see specs/001-devin-integration/spec.md (User Story 2)
 */

import type { DevinApiClientInterface } from "./devin-api-client";
import type { DevinCredentialsManager } from "./devin-credentials-manager";
import type { DevinSessionStorage } from "./devin-session-storage";
import {
	DevinSessionManager,
	type StartTaskParams,
} from "./devin-session-manager";
import type { DevinSession } from "./entities";
import type { RateLimiter } from "./rate-limiter";
import type { TaskPriority } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * A single task in a batch request.
 */
export interface BatchTaskItem {
	readonly taskId: string;
	readonly title: string;
	readonly description: string;
	readonly priority: TaskPriority;
	readonly acceptanceCriteria?: string[];
}

/**
 * Parameters for processing a batch of tasks.
 */
export interface BatchRequest {
	readonly specPath: string;
	readonly branch: string;
	readonly repoUrl: string;
	readonly tasks: BatchTaskItem[];
}

/**
 * Result of batch processing.
 */
export interface BatchResult {
	readonly totalRequested: number;
	readonly successful: BatchSuccessItem[];
	readonly failed: BatchFailureItem[];
}

export interface BatchSuccessItem {
	readonly taskId: string;
	readonly session: DevinSession;
}

export interface BatchFailureItem {
	readonly taskId: string;
	readonly error: string;
}

/**
 * Progress event emitted during batch processing.
 */
export interface BatchProgressEvent {
	readonly taskId: string;
	readonly index: number;
	readonly total: number;
	readonly status: "starting" | "success" | "failed";
}

type ProgressListener = (event: BatchProgressEvent) => void;

// ============================================================================
// Batch Processor
// ============================================================================

/**
 * Processes a batch of spec tasks by creating one Devin session per task.
 * Tasks are processed sequentially to avoid overwhelming the API.
 */
export class BatchProcessor {
	private readonly sessionManager: DevinSessionManager;
	private readonly rateLimiter: RateLimiter | undefined;
	private readonly listeners: Set<ProgressListener> = new Set();

	constructor(
		apiClient: DevinApiClientInterface,
		storage: DevinSessionStorage,
		credentials: DevinCredentialsManager,
		rateLimiter?: RateLimiter
	) {
		this.sessionManager = new DevinSessionManager(
			storage,
			credentials,
			apiClient
		);
		this.rateLimiter = rateLimiter;
	}

	/**
	 * Register a listener for batch progress events.
	 *
	 * @returns A dispose function to unregister the listener
	 */
	onProgress(listener: ProgressListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Process a batch of tasks sequentially.
	 *
	 * Creates one Devin session per task. If a task fails, processing
	 * continues with the remaining tasks.
	 */
	async processBatch(request: BatchRequest): Promise<BatchResult> {
		const successful: BatchSuccessItem[] = [];
		const failed: BatchFailureItem[] = [];
		const total = request.tasks.length;

		for (let i = 0; i < request.tasks.length; i++) {
			const task = request.tasks[i];

			this.emit({
				taskId: task.taskId,
				index: i,
				total,
				status: "starting",
			});

			try {
				this.rateLimiter?.acquire();

				const params: StartTaskParams = {
					specPath: request.specPath,
					taskId: task.taskId,
					title: task.title,
					description: task.description,
					priority: task.priority,
					branch: request.branch,
					repoUrl: request.repoUrl,
					acceptanceCriteria: task.acceptanceCriteria,
				};

				const session = await this.sessionManager.startTask(params);
				successful.push({ taskId: task.taskId, session });

				this.emit({
					taskId: task.taskId,
					index: i,
					total,
					status: "success",
				});
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				failed.push({ taskId: task.taskId, error: errorMessage });

				this.emit({
					taskId: task.taskId,
					index: i,
					total,
					status: "failed",
				});
			}
		}

		return {
			totalRequested: total,
			successful,
			failed,
		};
	}

	// ============================================================================
	// Private
	// ============================================================================

	private emit(event: BatchProgressEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}
}
