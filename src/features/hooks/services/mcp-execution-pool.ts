/**
 * MCP Execution Pool Service
 *
 * Manages concurrent MCP action executions with semaphore-based queueing.
 * Limits the number of simultaneous MCP tool executions to prevent resource exhaustion.
 */

import { MCP_MAX_CONCURRENT_ACTIONS } from "../types";
import type { IMCPExecutionPool, PoolStatus } from "./mcp-contracts";

/**
 * Queued task waiting for execution
 */
interface QueuedTask<T> {
	task: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

/**
 * MCPExecutionPool implementation
 *
 * Implements a semaphore-based execution pool that limits concurrent
 * MCP action executions and queues additional requests.
 */
export class MCPExecutionPool implements IMCPExecutionPool {
	private readonly capacity: number;
	private activeCount = 0;
	private readonly queue: QueuedTask<unknown>[] = [];

	constructor(capacity = MCP_MAX_CONCURRENT_ACTIONS) {
		this.capacity = capacity;
	}

	/**
	 * Execute a task with concurrency control
	 * @param task - Async task to execute
	 * @returns Promise that resolves when task completes
	 */
	execute<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			// If we have available capacity, execute immediately
			if (this.activeCount < this.capacity) {
				this.executeTask(task, resolve, reject);
			} else {
				// Queue the task for later execution
				this.queue.push({
					task,
					resolve: resolve as (value: unknown) => void,
					reject,
				});
			}
		});
	}

	/**
	 * Get current pool status
	 */
	getStatus(): PoolStatus {
		return {
			active: this.activeCount,
			queued: this.queue.length,
			capacity: this.capacity,
		};
	}

	/**
	 * Wait for all queued tasks to complete
	 */
	async drain(): Promise<void> {
		// Wait until both active count and queue are empty
		while (this.activeCount > 0 || this.queue.length > 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	/**
	 * Execute a task and manage pool state
	 */
	private async executeTask<T>(
		task: () => Promise<T>,
		resolve: (value: T) => void,
		reject: (error: unknown) => void
	): Promise<void> {
		this.activeCount += 1;

		try {
			const result = await task();
			resolve(result);
		} catch (error) {
			reject(error);
		} finally {
			this.activeCount -= 1;
			this.processQueue();
		}
	}

	/**
	 * Process next task in queue if capacity is available
	 */
	private processQueue(): void {
		if (this.queue.length > 0 && this.activeCount < this.capacity) {
			const next = this.queue.shift();
			if (next) {
				this.executeTask(next.task, next.resolve, next.reject);
			}
		}
	}
}
