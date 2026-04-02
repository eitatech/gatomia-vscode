/**
 * Devin Polling Service
 *
 * Periodically polls the Devin API for session status updates.
 * Emits events when session status changes so UI and storage can react.
 *
 * @see specs/001-devin-integration/research.md:L169-L172
 * @see specs/001-devin-integration/plan.md:L14
 */

import { DEFAULT_POLLING_INTERVAL_SECONDS } from "./config";
import type { DevinApiClientInterface } from "./devin-api-client";
import type { DevinCredentialsManager } from "./devin-credentials-manager";
import type { DevinSessionStorage } from "./devin-session-storage";
import type { DevinTask } from "./entities";
import { resolveSessionStatus, isTerminalStatus } from "./status-mapper";
import {
	type SessionStatus,
	SessionStatus as SessionStatusEnum,
	TaskStatus,
} from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Event emitted when a session's status changes.
 */
export interface StatusChangeEvent {
	readonly localId: string;
	readonly sessionId: string;
	readonly status: SessionStatus;
	readonly previousStatus: SessionStatus;
}

/**
 * Event emitted when a session becomes blocked and requires user action.
 */
export interface BlockedSessionEvent {
	readonly localId: string;
	readonly sessionId: string;
	readonly title: string;
}

/**
 * Event emitted when a PR state changes (e.g., open -> merged).
 */
export interface PrStateChangeEvent {
	readonly localId: string;
	readonly sessionId: string;
	readonly specPath: string;
	readonly specTaskId: string;
	readonly prUrl: string;
	readonly previousState: string | undefined;
	readonly newState: string;
}

/**
 * Options for configuring the polling service.
 */
export interface PollingServiceOptions {
	readonly intervalSeconds?: number;
}

/**
 * Number of extra poll cycles after all sessions become terminal.
 * Allows catching late PR state changes (e.g., merge after session completes).
 */
const GRACE_CYCLES_AFTER_TERMINAL = 6;

type StatusChangeListener = (event: StatusChangeEvent) => void;
type BlockedSessionListener = (event: BlockedSessionEvent) => void;
type PrStateChangeListener = (event: PrStateChangeEvent) => void;
type PollCycleListener = () => void;
type LogFn = (message: string) => void;

// ============================================================================
// Polling Service
// ============================================================================

/**
 * Polls active Devin sessions for status updates.
 *
 * Supports two construction modes:
 * - Direct: pass an API client (for tests)
 * - Lazy: pass a credentials manager, client resolved on first poll
 */
export class DevinPollingService {
	private apiClient: DevinApiClientInterface | undefined;
	private readonly credentials: DevinCredentialsManager | undefined;
	private readonly storage: DevinSessionStorage;
	private readonly intervalMs: number;
	private readonly listeners: Set<StatusChangeListener> = new Set();
	private readonly blockedListeners: Set<BlockedSessionListener> = new Set();
	private readonly prStateListeners: Set<PrStateChangeListener> = new Set();
	private readonly cycleListeners: Set<PollCycleListener> = new Set();
	private readonly log: LogFn;
	private timerId: ReturnType<typeof setInterval> | undefined;
	private graceCyclesRemaining = 0;

	constructor(
		storage: DevinSessionStorage,
		clientOrCredentials: DevinApiClientInterface | DevinCredentialsManager,
		options?: PollingServiceOptions,
		logger?: LogFn
	) {
		this.storage = storage;
		if ("hasCredentials" in clientOrCredentials) {
			this.credentials = clientOrCredentials;
		} else {
			this.apiClient = clientOrCredentials;
		}
		this.intervalMs =
			(options?.intervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS) * 1000;
		this.log =
			logger ??
			((_msg: string) => {
				// No-op default logger
			});
	}

	private async resolveApiClient(): Promise<DevinApiClientInterface | null> {
		if (this.apiClient) {
			return this.apiClient;
		}
		if (!this.credentials) {
			return null;
		}
		try {
			const creds = await this.credentials.getOrThrow();
			const { createDevinApiClient } = await import(
				"./devin-api-client-factory"
			);
			this.apiClient = createDevinApiClient({
				token: creds.apiKey,
				orgId: creds.orgId,
			});
			return this.apiClient;
		} catch {
			return null;
		}
	}

	/**
	 * Whether the polling service is actively running.
	 */
	get isRunning(): boolean {
		return this.timerId !== undefined;
	}

	/**
	 * Start periodic polling.
	 */
	start(): void {
		if (this.timerId !== undefined) {
			return;
		}
		this.timerId = setInterval(() => {
			this.pollOnce().catch((error: unknown) => {
				const msg = error instanceof Error ? error.message : String(error);
				this.log(`[Polling] Unhandled poll error: ${msg}`);
			});
		}, this.intervalMs);
	}

	/**
	 * Stop periodic polling.
	 */
	stop(): void {
		if (this.timerId !== undefined) {
			clearInterval(this.timerId);
			this.timerId = undefined;
		}
	}

	/**
	 * Register a listener for status change events.
	 *
	 * @returns A dispose function to unregister the listener
	 */
	onStatusChange(listener: StatusChangeListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Register a listener for blocked session events.
	 *
	 * Called when a session transitions to BLOCKED status, indicating
	 * Devin needs user input to continue.
	 *
	 * @returns A dispose function to unregister the listener
	 */
	onBlocked(listener: BlockedSessionListener): () => void {
		this.blockedListeners.add(listener);
		return () => {
			this.blockedListeners.delete(listener);
		};
	}

	/**
	 * Register a listener for PR state change events.
	 *
	 * Called when a PR transitions state (e.g., open -> merged),
	 * enabling downstream actions like marking tasks.md checkboxes.
	 *
	 * @returns A dispose function to unregister the listener
	 */
	onPrStateChange(listener: PrStateChangeListener): () => void {
		this.prStateListeners.add(listener);
		return () => {
			this.prStateListeners.delete(listener);
		};
	}

	/**
	 * Register a listener called after every poll cycle completes.
	 *
	 * @returns A dispose function to unregister the listener
	 */
	onPollCycleComplete(listener: PollCycleListener): () => void {
		this.cycleListeners.add(listener);
		return () => {
			this.cycleListeners.delete(listener);
		};
	}

	/**
	 * Poll all active sessions once and update their statuses.
	 */
	async pollOnce(): Promise<void> {
		const activeSessions = this.storage.getActive();
		const recentlyCompleted = this.getRecentlyCompletedSessions();
		const sessionsToPoll = [...activeSessions, ...recentlyCompleted];

		if (sessionsToPoll.length === 0) {
			if (this.graceCyclesRemaining > 0) {
				this.graceCyclesRemaining -= 1;
				this.log(
					`[Polling] Grace period: ${this.graceCyclesRemaining} cycles remaining`
				);
			} else {
				this.log("[Polling] No active sessions, stopping poller");
				this.stop();
				return;
			}
		}

		if (activeSessions.length === 0 && recentlyCompleted.length === 0) {
			for (const listener of this.cycleListeners) {
				listener();
			}
			return;
		}

		const client = await this.resolveApiClient();
		if (!client) {
			this.log("[Polling] Could not resolve API client (no credentials?)");
			return;
		}

		this.log(
			`[Polling] Polling ${activeSessions.length} active + ${recentlyCompleted.length} recently-completed session(s)...`
		);

		if (activeSessions.length > 0) {
			this.graceCyclesRemaining = GRACE_CYCLES_AFTER_TERMINAL;
		}

		for (const session of sessionsToPoll) {
			await this.pollSession(
				client,
				session.localId,
				session.sessionId,
				session.status
			);
		}

		for (const listener of this.cycleListeners) {
			listener();
		}
	}

	// ============================================================================
	// Private
	// ============================================================================

	private getRecentlyCompletedSessions() {
		if (this.graceCyclesRemaining <= 0) {
			return [];
		}
		const all = this.storage.getAll();
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
		return all.filter(
			(s) =>
				isTerminalStatus(s.status) &&
				s.updatedAt > fiveMinutesAgo &&
				s.pullRequests.length > 0
		);
	}

	private async pollSession(
		client: DevinApiClientInterface,
		localId: string,
		sessionId: string,
		currentStatus: SessionStatus
	): Promise<void> {
		try {
			const response = await client.getSession(sessionId);
			const newStatus = resolveSessionStatus(
				response.status,
				response.statusDetail
			);

			// Re-read session by localId right before update to minimize stale-read window
			let freshSession: import("./entities").DevinSession;
			try {
				freshSession = this.storage.getByLocalId(localId);
			} catch {
				return;
			}

			const updates: Record<string, unknown> = {
				status: newStatus,
			};

			if (isTerminalStatus(newStatus)) {
				updates.completedAt = Date.now();
			}

			if (response.pullRequests.length > 0) {
				updates.pullRequests = response.pullRequests.map((pr) => {
					const existing = freshSession.pullRequests.find(
						(p) => p.prUrl === pr.prUrl
					);
					return {
						prUrl: pr.prUrl,
						prState: pr.prState,
						branch: existing?.branch || freshSession.branch,
						createdAt: existing?.createdAt ?? Date.now(),
					};
				});

				this.detectPrStateChanges(freshSession, response.pullRequests);
			}

			// For terminal sessions being re-polled (grace period),
			// only update PR data, not status or tasks
			if (isTerminalStatus(freshSession.status)) {
				if (response.pullRequests.length > 0) {
					await this.storage.update(localId, {
						pullRequests:
							updates.pullRequests as import("./entities").PullRequest[],
					});
				}
				return;
			}

			updates.tasks = syncTaskStatuses(freshSession.tasks, newStatus);

			if (!freshSession.devinUrl) {
				const url =
					response.url || `https://app.devin.ai/sessions/${sessionId}`;
				updates.devinUrl = url;
			}

			await this.storage.update(localId, updates);

			if (newStatus !== currentStatus) {
				this.emit({
					localId,
					sessionId,
					status: newStatus,
					previousStatus: currentStatus,
				});
			}

			if (
				newStatus === SessionStatusEnum.BLOCKED &&
				currentStatus !== SessionStatusEnum.BLOCKED
			) {
				const title = response.title ?? sessionId;
				this.log(
					`[Polling] Session ${sessionId} is BLOCKED and requires user action`
				);
				this.emitBlocked({ localId, sessionId, title });
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			this.log(`[Polling] Error polling session ${sessionId}: ${msg}`);
		}
	}

	private detectPrStateChanges(
		session: import("./entities").DevinSession,
		newPrs: import("./devin-api-client").PullRequestInfo[]
	): void {
		const specTaskId =
			session.tasks.length > 0 ? session.tasks[0].specTaskId : "";

		for (const newPr of newPrs) {
			const existing = session.pullRequests.find(
				(p) => p.prUrl === newPr.prUrl
			);
			const previousState = existing?.prState;
			const newState = newPr.prState;

			if (newState && previousState !== newState) {
				this.log(
					`[Polling] PR state changed: ${previousState ?? "(new)"} -> ${newState} for ${newPr.prUrl}`
				);
				this.emitPrStateChange({
					localId: session.localId,
					sessionId: session.sessionId,
					specPath: session.specPath,
					specTaskId,
					prUrl: newPr.prUrl,
					previousState,
					newState,
				});
			}
		}
	}

	private emit(event: StatusChangeEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	private emitBlocked(event: BlockedSessionEvent): void {
		for (const listener of this.blockedListeners) {
			listener(event);
		}
	}

	private emitPrStateChange(event: PrStateChangeEvent): void {
		for (const listener of this.prStateListeners) {
			listener(event);
		}
	}
}

// ============================================================================
// Task Status Sync
// ============================================================================

const SESSION_TO_TASK_STATUS: Partial<Record<SessionStatus, TaskStatus>> = {
	[SessionStatusEnum.RUNNING]: TaskStatus.IN_PROGRESS,
	[SessionStatusEnum.COMPLETED]: TaskStatus.COMPLETED,
	[SessionStatusEnum.FAILED]: TaskStatus.FAILED,
	[SessionStatusEnum.CANCELLED]: TaskStatus.CANCELLED,
	[SessionStatusEnum.BLOCKED]: TaskStatus.IN_PROGRESS,
};

const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
	TaskStatus.COMPLETED,
	TaskStatus.FAILED,
	TaskStatus.CANCELLED,
];

function syncTaskStatuses(
	tasks: readonly DevinTask[],
	sessionStatus: SessionStatus
): DevinTask[] {
	const targetTaskStatus = SESSION_TO_TASK_STATUS[sessionStatus];
	if (!targetTaskStatus) {
		return [...tasks];
	}

	const now = Date.now();

	return tasks.map((task): DevinTask => {
		if (TERMINAL_TASK_STATUSES.includes(task.status)) {
			return task;
		}
		const isTerminal = TERMINAL_TASK_STATUSES.includes(targetTaskStatus);
		return {
			...task,
			status: targetTaskStatus,
			...(isTerminal ? { completedAt: now } : {}),
		};
	});
}
