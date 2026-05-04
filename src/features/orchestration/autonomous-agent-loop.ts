import { EventEmitter } from "vscode";
import type { NormalizedTask } from "../tasks/task-model";
import type { AgentChatRegistry } from "../agent-chat/agent-chat-registry";
import { randomUUID } from "node:crypto";
import type { AgentChatSession } from "../agent-chat/types";

/**
 * Service to manage the autonomous execution of tasks.
 * Connects the task model (Kanban board) with the Agent Chat sessions (running agents).
 */
export class AutonomousAgentLoopService {
	private readonly _onDidChange = new EventEmitter<void>();
	readonly onDidChange = this._onDidChange.event;

	private readonly activeTasks = new Map<string, NormalizedTask>();
	private readonly sessionToTaskMap = new Map<string, string>(); // sessionId -> taskId

	private readonly chatRegistry: AgentChatRegistry;

	constructor(chatRegistry: AgentChatRegistry) {
		this.chatRegistry = chatRegistry;
		// Observe registry changes to complete/fail tasks based on agent session completion
		this.chatRegistry.onDidChange(() => this.handleRegistryChange());
	}

	/**
	 * Claim a task for autonomous execution if eligible.
	 */
	claimTask(task: NormalizedTask): boolean {
		// Must not already be running or completed
		if (
			task.execution?.state === "running" ||
			task.execution?.state === "completed"
		) {
			return false;
		}

		// Support parallelization only if explicitly marked as parallel-safe
		const isRunningOthers = Array.from(this.activeTasks.values()).some(
			(t) => t.execution?.state === "running"
		);

		if (isRunningOthers && !task.execution?.parallelizable) {
			return false;
		}

		const clonedTask: NormalizedTask = JSON.parse(JSON.stringify(task));
		if (!clonedTask.execution) {
			clonedTask.execution = { state: "ready" };
		}

		clonedTask.execution.state = "queued";
		this.activeTasks.set(clonedTask.id, clonedTask);
		this._onDidChange.fire();
		return true;
	}

	/**
	 * Start a claimed task by spawning an agent session.
	 */
	startTask(taskId: string): string | undefined {
		const task = this.activeTasks.get(taskId);
		if (!task || task.execution?.state !== "queued") {
			return;
		}

		// Create a session in the registry
		const sessionId = randomUUID();

		const session: AgentChatSession = {
			id: sessionId,
			source: "acp",
			agentName: task.execution?.suggestedRole || "General Agent",
			lifecycleState: "waiting-for-input",
			messages: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			systemPrompt: `You are an autonomous agent executing the task: ${task.title}. Intent: ${task.execution?.intent || ""}`,
			capabilities: {},
		};

		this.chatRegistry.registerSession(session);
		this.sessionToTaskMap.set(sessionId, taskId);

		task.execution.state = "running";
		task.execution.startedAt = Date.now();
		this.activeTasks.set(taskId, task);

		this._onDidChange.fire();

		return sessionId;
	}

	/**
	 * Mark task as completed or failed manually
	 */
	completeTask(taskId: string, success: boolean, errorMessage?: string): void {
		const task = this.activeTasks.get(taskId);
		if (!task) {
			return;
		}

		task.execution!.state = success ? "completed" : "failed";
		task.execution!.completedAt = Date.now();
		if (errorMessage) {
			task.execution!.errorMessage = errorMessage;
		}

		this.activeTasks.set(taskId, task);
		this._onDidChange.fire();
	}

	/**
	 * Get all active tasks being tracked by the loop.
	 */
	getTrackedTasks(): NormalizedTask[] {
		return Array.from(this.activeTasks.values());
	}

	private handleRegistryChange() {
		// Sync terminal agent sessions to task completion
		const recentSessions = this.chatRegistry.listRecent();
		let changed = false;

		for (const session of recentSessions) {
			const taskId = this.sessionToTaskMap.get(session.id);
			if (taskId) {
				const task = this.activeTasks.get(taskId);
				if (task && task.execution?.state === "running") {
					// Check if session ended in failure or success (assuming ended-by-shutdown or similar means done for now)
					const isSuccess = session.lifecycleState !== "error";

					task.execution.state = isSuccess ? "completed" : "failed";
					task.execution.completedAt = session.endedAt || Date.now();

					changed = true;
				}
			}
		}

		if (changed) {
			this._onDidChange.fire();
		}
	}
}
