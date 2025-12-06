import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPExecutionPool } from "../../../../../src/features/hooks/services/mcp-execution-pool";
import { MCP_MAX_CONCURRENT_ACTIONS } from "../../../../../src/features/hooks/types";

describe("MCPExecutionPool", () => {
	let pool: MCPExecutionPool;

	beforeEach(() => {
		vi.clearAllMocks();
		pool = new MCPExecutionPool();
	});

	describe("constructor", () => {
		it("uses default capacity when not specified", () => {
			const defaultPool = new MCPExecutionPool();
			const status = defaultPool.getStatus();

			expect(status.capacity).toBe(MCP_MAX_CONCURRENT_ACTIONS);
		});

		it("uses custom capacity when specified", () => {
			const customPool = new MCPExecutionPool(3);
			const status = customPool.getStatus();

			expect(status.capacity).toBe(3);
		});

		it("initializes with zero active and queued tasks", () => {
			const status = pool.getStatus();

			expect(status.active).toBe(0);
			expect(status.queued).toBe(0);
		});
	});

	describe("execute", () => {
		it("executes a single task successfully", async () => {
			const task = vi.fn().mockResolvedValue("result");

			const result = await pool.execute(task);

			expect(result).toBe("result");
			expect(task).toHaveBeenCalledTimes(1);
		});

		it("executes task immediately when capacity available", async () => {
			const task = vi.fn().mockResolvedValue("immediate");

			const promise = pool.execute(task);
			const status = pool.getStatus();

			// Task should be executing (active count = 1)
			expect(status.active).toBe(1);
			expect(status.queued).toBe(0);

			await promise;
		});

		it("queues task when at capacity", async () => {
			const customPool = new MCPExecutionPool(1);

			// First task - should execute immediately
			const task1 = vi.fn(
				() => new Promise((resolve) => setTimeout(() => resolve("task1"), 100))
			);
			const promise1 = customPool.execute(task1);

			// Second task - should be queued
			const task2 = vi.fn().mockResolvedValue("task2");
			const promise2 = customPool.execute(task2);

			const status = customPool.getStatus();
			expect(status.active).toBe(1);
			expect(status.queued).toBe(1);

			await Promise.all([promise1, promise2]);
		});

		it("processes queued task after active task completes", async () => {
			const customPool = new MCPExecutionPool(1);

			const task1 = vi.fn(
				() => new Promise((resolve) => setTimeout(() => resolve("task1"), 50))
			);
			const task2 = vi.fn().mockResolvedValue("task2");

			const promise1 = customPool.execute(task1);
			const promise2 = customPool.execute(task2);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(result1).toBe("task1");
			expect(result2).toBe("task2");
			expect(task1).toHaveBeenCalledTimes(1);
			expect(task2).toHaveBeenCalledTimes(1);
		});

		it("executes multiple tasks within capacity concurrently", async () => {
			const customPool = new MCPExecutionPool(3);

			const task1 = vi.fn().mockResolvedValue("task1");
			const task2 = vi.fn().mockResolvedValue("task2");
			const task3 = vi.fn().mockResolvedValue("task3");

			const promises = [
				customPool.execute(task1),
				customPool.execute(task2),
				customPool.execute(task3),
			];

			const status = customPool.getStatus();
			expect(status.active).toBe(3);
			expect(status.queued).toBe(0);

			await Promise.all(promises);
		});

		it("handles task that throws error", async () => {
			const error = new Error("Task failed");
			const task = vi.fn().mockRejectedValue(error);

			await expect(pool.execute(task)).rejects.toThrow("Task failed");
		});

		it("continues processing after task error", async () => {
			const customPool = new MCPExecutionPool(1);

			const failingTask = vi.fn().mockRejectedValue(new Error("Failed"));
			const successTask = vi.fn().mockResolvedValue("success");

			await expect(customPool.execute(failingTask)).rejects.toThrow("Failed");

			const result = await customPool.execute(successTask);
			expect(result).toBe("success");
		});

		it("preserves task execution order in queue", async () => {
			const customPool = new MCPExecutionPool(1);
			const executionOrder: number[] = [];

			const createTask = (id: number) =>
				vi.fn(() => {
					executionOrder.push(id);
					return Promise.resolve(`task${id}`);
				});

			const task1 = createTask(1);
			const task2 = createTask(2);
			const task3 = createTask(3);

			await Promise.all([
				customPool.execute(task1),
				customPool.execute(task2),
				customPool.execute(task3),
			]);

			expect(executionOrder).toEqual([1, 2, 3]);
		});

		it("handles tasks returning different types", async () => {
			const stringTask = vi.fn().mockResolvedValue("string");
			const numberTask = vi.fn().mockResolvedValue(42);
			const objectTask = vi.fn().mockResolvedValue({ key: "value" });
			const booleanTask = vi.fn().mockResolvedValue(true);

			const [str, num, obj, bool] = await Promise.all([
				pool.execute(stringTask),
				pool.execute(numberTask),
				pool.execute(objectTask),
				pool.execute(booleanTask),
			]);

			expect(str).toBe("string");
			expect(num).toBe(42);
			expect(obj).toEqual({ key: "value" });
			expect(bool).toBe(true);
		});

		it("handles task returning undefined", async () => {
			const task = vi.fn().mockResolvedValue(undefined);

			const result = await pool.execute(task);

			expect(result).toBeUndefined();
		});

		it("handles task returning null", async () => {
			const task = vi.fn().mockResolvedValue(null);

			const result = await pool.execute(task);

			expect(result).toBeNull();
		});
	});

	describe("getStatus", () => {
		it("returns correct status when idle", () => {
			const status = pool.getStatus();

			expect(status).toEqual({
				active: 0,
				queued: 0,
				capacity: MCP_MAX_CONCURRENT_ACTIONS,
			});
		});

		it("returns correct status with active tasks", async () => {
			const customPool = new MCPExecutionPool(2);

			const task1 = vi.fn(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);
			const task2 = vi.fn(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);

			const promise1 = customPool.execute(task1);
			const promise2 = customPool.execute(task2);

			const status = customPool.getStatus();
			expect(status.active).toBe(2);
			expect(status.queued).toBe(0);

			await Promise.all([promise1, promise2]);
		});

		it("returns correct status with queued tasks", async () => {
			const customPool = new MCPExecutionPool(1);

			const task1 = vi.fn(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);
			const task2 = vi.fn().mockResolvedValue("task2");
			const task3 = vi.fn().mockResolvedValue("task3");

			const promise1 = customPool.execute(task1);
			const promise2 = customPool.execute(task2);
			const promise3 = customPool.execute(task3);

			const status = customPool.getStatus();
			expect(status.active).toBe(1);
			expect(status.queued).toBe(2);

			await Promise.all([promise1, promise2, promise3]);
		});

		it("updates status as tasks complete", async () => {
			const customPool = new MCPExecutionPool(2);

			const task1 = vi.fn(
				() => new Promise((resolve) => setTimeout(() => resolve("task1"), 50))
			);
			const task2 = vi.fn(
				() => new Promise((resolve) => setTimeout(() => resolve("task2"), 100))
			);

			const promise1 = customPool.execute(task1);
			const promise2 = customPool.execute(task2);

			const initialStatus = customPool.getStatus();
			expect(initialStatus.active).toBe(2);

			await promise1;

			const midStatus = customPool.getStatus();
			expect(midStatus.active).toBe(1);

			await promise2;

			const finalStatus = customPool.getStatus();
			expect(finalStatus.active).toBe(0);
		});
	});

	describe("drain", () => {
		it("resolves immediately when pool is empty", async () => {
			await expect(pool.drain()).resolves.toBeUndefined();
		});

		it("waits for active tasks to complete", async () => {
			let taskCompleted = false;

			const task = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				taskCompleted = true;
				return "done";
			});

			pool.execute(task);

			await pool.drain();

			expect(taskCompleted).toBe(true);
		});

		it("waits for queued tasks to complete", async () => {
			const customPool = new MCPExecutionPool(1);
			const completedTasks: number[] = [];

			const createTask = (id: number) =>
				vi.fn(async () => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					completedTasks.push(id);
					return `task${id}`;
				});

			customPool.execute(createTask(1));
			customPool.execute(createTask(2));
			customPool.execute(createTask(3));

			await customPool.drain();

			expect(completedTasks).toEqual([1, 2, 3]);
		});

		it("waits for both active and queued tasks", async () => {
			const customPool = new MCPExecutionPool(2);
			const completedTasks: number[] = [];

			const createTask = (id: number) =>
				vi.fn(async () => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					completedTasks.push(id);
					return `task${id}`;
				});

			// 2 active, 2 queued
			customPool.execute(createTask(1));
			customPool.execute(createTask(2));
			customPool.execute(createTask(3));
			customPool.execute(createTask(4));

			await customPool.drain();

			expect(completedTasks).toEqual([1, 2, 3, 4]);
		});

		it("handles multiple concurrent drain calls", async () => {
			const customPool = new MCPExecutionPool(1);

			const task = vi.fn(
				() => new Promise((resolve) => setTimeout(() => resolve("done"), 100))
			);

			customPool.execute(task);

			const drain1 = customPool.drain();
			const drain2 = customPool.drain();
			const drain3 = customPool.drain();

			await expect(Promise.all([drain1, drain2, drain3])).resolves.toEqual([
				undefined,
				undefined,
				undefined,
			]);
		});
	});

	describe("concurrency scenarios", () => {
		it("respects capacity limit with many tasks", async () => {
			const customPool = new MCPExecutionPool(3);
			const maxActive: number[] = [];
			let currentActive = 0;

			const createTask = () =>
				vi.fn(async () => {
					currentActive += 1;
					maxActive.push(currentActive);
					await new Promise((resolve) => setTimeout(resolve, 50));
					currentActive -= 1;
					return "done";
				});

			const tasks = Array.from({ length: 10 }, () => createTask());
			await Promise.all(tasks.map((task) => customPool.execute(task)));

			// Max active should never exceed capacity
			expect(Math.max(...maxActive)).toBeLessThanOrEqual(3);
		});

		it("handles rapid task submission", async () => {
			const customPool = new MCPExecutionPool(2);
			const results: string[] = [];

			const tasks = Array.from({ length: 20 }, (_, i) =>
				vi.fn(async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					results.push(`task${i}`);
					return `task${i}`;
				})
			);

			await Promise.all(tasks.map((task) => customPool.execute(task)));

			expect(results).toHaveLength(20);
		});

		it("handles mix of fast and slow tasks", async () => {
			const customPool = new MCPExecutionPool(3);
			const completionOrder: string[] = [];

			const fastTask = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				completionOrder.push("fast");
				return "fast";
			});

			const slowTask = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				completionOrder.push("slow");
				return "slow";
			});

			await Promise.all([
				customPool.execute(slowTask),
				customPool.execute(fastTask),
				customPool.execute(fastTask),
			]);

			// Fast tasks should complete before slow task
			expect(completionOrder[0]).toBe("fast");
			expect(completionOrder[1]).toBe("fast");
			expect(completionOrder[2]).toBe("slow");
		});

		it("maintains correct state during high concurrency", async () => {
			const customPool = new MCPExecutionPool(5);

			const tasks = Array.from({ length: 50 }, (_, i) =>
				vi.fn(async () => {
					await new Promise((resolve) =>
						setTimeout(resolve, Math.random() * 50)
					);
					return `task${i}`;
				})
			);

			const promises = tasks.map((task) => customPool.execute(task));

			// Check status during execution
			const midStatus = customPool.getStatus();
			expect(midStatus.active).toBeGreaterThan(0);
			expect(midStatus.active).toBeLessThanOrEqual(5);

			await Promise.all(promises);

			// Pool should be empty after all complete
			const finalStatus = customPool.getStatus();
			expect(finalStatus.active).toBe(0);
			expect(finalStatus.queued).toBe(0);
		});
	});

	describe("edge cases", () => {
		it("handles capacity of 1 (sequential execution)", async () => {
			const sequentialPool = new MCPExecutionPool(1);
			const executionOrder: number[] = [];

			const tasks = Array.from({ length: 5 }, (_, i) =>
				vi.fn(() => {
					executionOrder.push(i);
					return Promise.resolve(`task${i}`);
				})
			);

			await Promise.all(tasks.map((task) => sequentialPool.execute(task)));

			expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
		});

		it("handles capacity equal to number of tasks", async () => {
			const customPool = new MCPExecutionPool(5);

			const tasks = Array.from({ length: 5 }, (_, i) =>
				vi.fn().mockResolvedValue(`task${i}`)
			);

			const results = await Promise.all(
				tasks.map((task) => customPool.execute(task))
			);

			expect(results).toHaveLength(5);
			const status = customPool.getStatus();
			expect(status.queued).toBe(0);
		});

		it("handles empty task (immediately resolved promise)", async () => {
			const task = vi.fn(async () => {
				// Intentionally empty - tests void return
			});

			await expect(pool.execute(task)).resolves.toBeUndefined();
		});

		it("decrements active count even when task throws", async () => {
			const customPool = new MCPExecutionPool(1);

			const failingTask = vi.fn().mockRejectedValue(new Error("Failed"));

			await expect(customPool.execute(failingTask)).rejects.toThrow();

			const status = customPool.getStatus();
			expect(status.active).toBe(0);
		});
	});
});
