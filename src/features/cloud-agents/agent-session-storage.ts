/**
 * Agent Session Storage
 *
 * Provider-agnostic session CRUD and read-only marking.
 * Stores sessions in VS Code workspace state.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 * @see specs/016-multi-provider-agents/data-model.md
 */

import { logInfo, logDebug } from "./logging";
import type { Memento } from "./provider-config-store";
import {
	SessionStatus,
	TaskStatus,
	type AgentSession,
	type AgentTask,
	type PullRequest,
	StoreError,
	StoreErrorCode,
} from "./types";

// ============================================================================
// Storage Key
// ============================================================================

const SESSIONS_KEY = "gatomia.cloudAgent.sessions";

// ============================================================================
// AgentSessionStorage
// ============================================================================

/**
 * Provider-agnostic session storage using VS Code workspace state.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */
export class AgentSessionStorage {
	private readonly workspaceState: Memento;

	constructor(workspaceState: Memento) {
		this.workspaceState = workspaceState;
	}

	/**
	 * Get all sessions for the current workspace.
	 */
	getAll(): Promise<AgentSession[]> {
		const raw = this.workspaceState.get<unknown[]>(SESSIONS_KEY);
		if (!Array.isArray(raw)) {
			return Promise.resolve([]);
		}
		const valid: AgentSession[] = [];
		for (const entry of raw) {
			if (isValidAgentSession(entry)) {
				valid.push(normalizeSession(entry as AgentSession));
			} else {
				logDebug(
					`Skipping invalid session entry: ${JSON.stringify(entry).slice(0, 200)}`
				);
			}
		}
		return Promise.resolve(valid);
	}

	/**
	 * Get a single session by local ID.
	 */
	async getById(localId: string): Promise<AgentSession | undefined> {
		const sessions = await this.getAll();
		return sessions.find((s) => s.localId === localId);
	}

	/**
	 * Get sessions filtered by provider ID.
	 */
	async getByProvider(providerId: string): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => s.providerId === providerId);
	}

	/**
	 * Get active (non-terminal, non-read-only) sessions.
	 */
	async getActive(): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => {
			if (s.isReadOnly) {
				return false;
			}
			switch (s.status) {
				case SessionStatus.COMPLETED:
				case SessionStatus.FAILED:
				case SessionStatus.CANCELLED:
					return false;
				default:
					return true;
			}
		});
	}

	/**
	 * Check if a task (by specTaskId) is already in a non-terminal session.
	 * Returns the running session if found, undefined otherwise.
	 */
	async findActiveBySpecTaskId(
		specTaskId: string
	): Promise<AgentSession | undefined> {
		const active = await this.getActive();
		return active.find((s) => s.tasks.some((t) => t.specTaskId === specTaskId));
	}

	/**
	 * Save a new session.
	 * @throws StoreError if localId already exists
	 */
	async create(session: AgentSession): Promise<void> {
		const sessions = await this.getAll();
		if (sessions.some((s) => s.localId === session.localId)) {
			throw new StoreError(
				`Session "${session.localId}" already exists`,
				StoreErrorCode.ALREADY_EXISTS,
				"create"
			);
		}
		sessions.push(session);
		await this.persist(sessions);
		logInfo(`Session created: ${session.localId} (${session.providerId})`);
	}

	/**
	 * Update an existing session.
	 * @throws StoreError if session not found
	 */
	async update(localId: string, updates: Partial<AgentSession>): Promise<void> {
		const sessions = await this.getAll();
		const index = sessions.findIndex((s) => s.localId === localId);
		if (index === -1) {
			throw new StoreError(
				`Session "${localId}" not found`,
				StoreErrorCode.NOT_FOUND,
				"update"
			);
		}
		const cleaned = stripUndefined(updates);
		sessions[index] = { ...sessions[index], ...cleaned, updatedAt: Date.now() };
		await this.persist(sessions);
		logDebug(`Session updated: ${localId}`);
	}

	/**
	 * Delete a session.
	 */
	async delete(localId: string): Promise<void> {
		const sessions = await this.getAll();
		const filtered = sessions.filter((s) => s.localId !== localId);
		await this.persist(filtered);
		logInfo(`Session deleted: ${localId}`);
	}

	/**
	 * Mark all sessions from a provider as read-only.
	 */
	async markProviderReadOnly(providerId: string): Promise<void> {
		const sessions = await this.getAll();
		for (const session of sessions) {
			if (session.providerId === providerId) {
				session.isReadOnly = true;
			}
		}
		await this.persist(sessions);
		logInfo(`All sessions for provider "${providerId}" marked read-only`);
	}

	/**
	 * Get terminal sessions that need cleanup (updated before cutoff time).
	 * Only returns sessions in completed/failed/cancelled state.
	 */
	async getForCleanup(cutoffTime: number): Promise<AgentSession[]> {
		const sessions = await this.getAll();
		return sessions.filter((s) => {
			const isTerminal =
				s.status === SessionStatus.COMPLETED ||
				s.status === SessionStatus.FAILED ||
				s.status === SessionStatus.CANCELLED;
			if (!isTerminal) {
				return false;
			}
			const completionTime = s.completedAt ?? s.updatedAt;
			return completionTime < cutoffTime;
		});
	}

	private async persist(sessions: AgentSession[]): Promise<void> {
		await this.workspaceState.update(SESSIONS_KEY, sessions);
	}
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Runtime check that a deserialized value has the minimum required shape of an AgentSession.
 * Filters out corrupted or schema-incompatible entries after deserialization.
 */
/**
 * Remove undefined values from an object to prevent overwriting
 * existing fields (especially arrays like tasks/pullRequests) with undefined
 * during a partial update spread.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(obj)) {
		if (obj[key] !== undefined) {
			result[key] = obj[key];
		}
	}
	return result as Partial<T>;
}

const TERMINAL_SESSION_STATUSES: ReadonlySet<string> = new Set([
	SessionStatus.COMPLETED,
	SessionStatus.FAILED,
	SessionStatus.CANCELLED,
]);

const TERMINAL_TASK_STATUSES: ReadonlySet<string> = new Set([
	TaskStatus.COMPLETED,
	TaskStatus.FAILED,
	TaskStatus.SKIPPED,
]);

const SESSION_TO_TASK_STATUS: Record<string, TaskStatus> = {
	[SessionStatus.COMPLETED]: TaskStatus.COMPLETED,
	[SessionStatus.FAILED]: TaskStatus.FAILED,
	[SessionStatus.CANCELLED]: TaskStatus.SKIPPED,
};

function normalizeSession(session: AgentSession): AgentSession {
	if (!TERMINAL_SESSION_STATUSES.has(session.status)) {
		return session;
	}

	let tasks: AgentTask[] | undefined;
	const hasStaleTask = session.tasks.some(
		(t) => !TERMINAL_TASK_STATUSES.has(t.status)
	);
	if (hasStaleTask) {
		const targetStatus =
			SESSION_TO_TASK_STATUS[session.status] ?? TaskStatus.SKIPPED;
		const now = Date.now();
		tasks = session.tasks.map((task) => {
			if (TERMINAL_TASK_STATUSES.has(task.status)) {
				return task;
			}
			return { ...task, status: targetStatus, completedAt: now };
		});
	}

	let pullRequests: PullRequest[] | undefined;
	const hasUnknownPrState = session.pullRequests.some((pr) => !pr.state);
	if (hasUnknownPrState) {
		const defaultState =
			session.status === SessionStatus.COMPLETED ? "merged" : "open";
		pullRequests = session.pullRequests.map((pr) =>
			pr.state ? pr : { ...pr, state: defaultState }
		);
	}

	if (tasks || pullRequests) {
		return {
			...session,
			...(tasks ? { tasks } : {}),
			...(pullRequests ? { pullRequests } : {}),
		};
	}
	return session;
}

function isValidAgentSession(value: unknown): boolean {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.localId === "string" &&
		typeof obj.providerId === "string" &&
		typeof obj.status === "string" &&
		typeof obj.branch === "string" &&
		typeof obj.specPath === "string" &&
		typeof obj.createdAt === "number" &&
		typeof obj.updatedAt === "number" &&
		Array.isArray(obj.tasks) &&
		Array.isArray(obj.pullRequests)
	);
}
