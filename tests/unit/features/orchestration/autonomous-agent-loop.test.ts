import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventEmitter } from "vscode";
import { AutonomousAgentLoopService } from "../../../../src/features/orchestration/autonomous-agent-loop";
import type { AgentChatRegistry } from "../../../../src/features/agent-chat/agent-chat-registry";
import type { TriggerRegistry } from "../../../../src/features/hooks/trigger-registry";
import type { NormalizedTask } from "../../../../src/features/tasks/task-model";
import type { AgentChatSession } from "../../../../src/features/agent-chat/types";

describe("AutonomousAgentLoopService", () => {
	let mockChatRegistry: any;
	let mockTriggerRegistry: any;
	let loopService: AutonomousAgentLoopService;
	let registryEventEmitter: EventEmitter<void>;

	beforeEach(() => {
		registryEventEmitter = new EventEmitter<void>();
		mockChatRegistry = {
			onDidChange: registryEventEmitter.event,
			listRecent: vi.fn().mockReturnValue([]),
			registerSession: vi.fn(),
		};

		mockTriggerRegistry = {
			fireTrigger: vi.fn(),
		};

		loopService = new AutonomousAgentLoopService(
			mockChatRegistry as unknown as AgentChatRegistry,
			mockTriggerRegistry as unknown as TriggerRegistry
		);
	});

	it("claims a valid task and marks it queued", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: { state: "ready" },
		};

		const result = loopService.claimTask(task);
		expect(result).toBe(true);

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks.length).toBe(1);
		expect(trackedTasks[0].execution?.state).toBe("queued");
	});

	it("refuses to claim task if another task is running and not parallelizable", () => {
		// Mock an active running task
		const runningTask: NormalizedTask = {
			id: "task-1",
			title: "Running",
			status: "in-progress",
			source: { system: "test", externalId: "1" },
			execution: { state: "running" },
		};
		loopService.activeTasks.set(runningTask.id, runningTask);

		const newTask: NormalizedTask = {
			id: "task-2",
			title: "New",
			status: "not-started",
			source: { system: "test", externalId: "2" },
			execution: { state: "ready", parallelizable: false },
		};

		const result = loopService.claimTask(newTask);
		expect(result).toBe(false);
	});

	it("allows claiming if marked parallelizable even if another is running", () => {
		const runningTask: NormalizedTask = {
			id: "task-1",
			title: "Running",
			status: "in-progress",
			source: { system: "test", externalId: "1" },
			execution: { state: "running" },
		};
		loopService.activeTasks.set(runningTask.id, runningTask);

		const newTask: NormalizedTask = {
			id: "task-2",
			title: "New",
			status: "not-started",
			source: { system: "test", externalId: "2" },
			execution: { state: "ready", parallelizable: true },
		};

		const result = loopService.claimTask(newTask);
		expect(result).toBe(true);
	});

	it("starts a claimed task by creating an agent session", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: {
				state: "ready",
				suggestedRole: "frontend",
				intent: "Fix UI",
			},
		};

		loopService.claimTask(task);
		const sessionId = loopService.startTask("task-1");

		expect(sessionId).toBeDefined();
		expect(mockChatRegistry.registerSession).toHaveBeenCalledWith(
			expect.objectContaining({
				agentName: "frontend",
				systemPrompt: expect.stringContaining("Fix UI"),
			})
		);

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks[0].execution?.state).toBe("running");
		expect(trackedTasks[0].execution?.startedAt).toBeDefined();
	});

	it("completes task and fires trigger", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: { state: "ready" },
		};

		loopService.claimTask(task);
		loopService.completeTask("task-1", true);

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks[0].execution?.state).toBe("completed");
		expect(trackedTasks[0].execution?.completedAt).toBeDefined();
		expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
			"orchestration",
			"task-completed",
			"after",
			expect.any(Object)
		);
	});

	it("fails task and fires trigger with error message", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: { state: "ready" },
		};

		loopService.claimTask(task);
		loopService.completeTask("task-1", false, "Compile error");

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks[0].execution?.state).toBe("failed");
		expect(trackedTasks[0].execution?.errorMessage).toBe("Compile error");
		expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
			"orchestration",
			"task-failed",
			"after",
			expect.any(Object)
		);
	});

	it("syncs state from chat registry on didChange event", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: { state: "ready" },
		};

		loopService.claimTask(task);
		const sessionId = loopService.startTask("task-1");

		const completedSession: Partial<AgentChatSession> = {
			id: sessionId,
			lifecycleState: "shutdown",
			endedAt: Date.now(),
		};

		mockChatRegistry.listRecent.mockReturnValue([completedSession]);

		// Fire the event from registry
		registryEventEmitter.fire();

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks[0].execution?.state).toBe("completed");
		expect(trackedTasks[0].execution?.completedAt).toBeDefined();
	});

	it("syncs state as failed from chat registry if session errored", () => {
		const task: NormalizedTask = {
			id: "task-1",
			title: "Do something",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			execution: { state: "ready" },
		};

		loopService.claimTask(task);
		const sessionId = loopService.startTask("task-1");

		const erroredSession: Partial<AgentChatSession> = {
			id: sessionId,
			lifecycleState: "error",
			endedAt: Date.now(),
		};

		mockChatRegistry.listRecent.mockReturnValue([erroredSession]);

		registryEventEmitter.fire();

		const trackedTasks = loopService.getTrackedTasks();
		expect(trackedTasks[0].execution?.state).toBe("failed");
	});
});
