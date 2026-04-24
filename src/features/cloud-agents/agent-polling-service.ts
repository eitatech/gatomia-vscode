/**
 * Agent Polling Service
 *
 * Delegates polling to the active provider adapter.
 * Manages polling intervals and session update distribution.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import type { Disposable } from "vscode";
import type { AgentSessionStorage } from "./agent-session-storage";
import { logDebug, logError, logWarn } from "./logging";
import type { ProviderRegistry } from "./provider-registry";
import {
	ErrorCode,
	ProviderError,
	SessionStatus,
	TaskStatus,
	type AgentSession,
	type AgentTask,
	type SessionUpdate,
} from "./types";

// ============================================================================
// Event types (T017 — spec 018 bridge)
// ============================================================================

/**
 * Payload fanned out by {@link AgentPollingService.onSessionUpdated} whenever
 * a poll cycle commits a change to a stored {@link AgentSession}.
 *
 * Subscribers receive this event for every mutated session — downstream
 * consumers (e.g. spec 018's cloud-chat-adapter) use it to drive chat-panel
 * updates without duplicating the polling loop.
 */
export interface AgentSessionUpdatedEvent {
	readonly localId: string;
	readonly session: AgentSession;
}

export type AgentSessionUpdatedListener = (
	event: AgentSessionUpdatedEvent
) => void;

// ============================================================================
// Constants
// ============================================================================

const MAX_CONSECUTIVE_FAILURES = 3;
const PR_GRACE_PERIOD_MS = 5 * 60 * 1000;
const PR_UNKNOWN_STATE_GRACE_PERIOD_MS = 60 * 60 * 1000;

const TERMINAL_PR_STATES = new Set(["merged", "closed"]);

// ============================================================================
// AgentPollingService
// ============================================================================

/**
 * Polling orchestration that delegates to the active provider.
 * Includes retry behavior and credential-expiry detection (FR-020).
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export class AgentPollingService {
	private readonly registry: ProviderRegistry;
	private readonly sessionStorage: AgentSessionStorage;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private consecutiveFailures = 0;
	private readonly callbacks = {
		onCredentialExpiry: undefined as (() => void) | undefined,
		onSessionCompleted: undefined as
			| ((localId: string, specPath: string) => void)
			| undefined,
		onError: undefined as ((message: string) => void) | undefined,
		onUpdated: undefined as (() => void) | undefined,
	};

	/**
	 * Subscribers for per-session update events (T017, spec 018 bridge).
	 * Additive to the existing single-callback `onUpdated` hook — both fire on
	 * the same commit path.
	 */
	private readonly sessionUpdatedListeners =
		new Set<AgentSessionUpdatedListener>();

	/**
	 * Whether interval-based polling is currently running.
	 */
	get isRunning(): boolean {
		return this.intervalId !== undefined;
	}

	constructor(registry: ProviderRegistry, sessionStorage: AgentSessionStorage) {
		this.registry = registry;
		this.sessionStorage = sessionStorage;
	}

	/**
	 * Register a callback for credential-expiry events (FR-020).
	 */
	setOnCredentialExpiry(handler: () => void): void {
		this.callbacks.onCredentialExpiry = handler;
	}

	/**
	 * Register a callback for provider errors (SC-006).
	 * Called with a user-facing error message when an API failure is detected.
	 */
	setOnError(handler: (message: string) => void): void {
		this.callbacks.onError = handler;
	}

	/**
	 * Register a callback fired after each poll cycle that applied updates.
	 * Used to refresh the tree view UI.
	 */
	setOnUpdated(handler: () => void): void {
		this.callbacks.onUpdated = handler;
	}

	/**
	 * Register a callback for session completion events (FR-017).
	 * Called with (localId, specPath) when a session reaches a terminal state.
	 */
	setOnSessionCompleted(
		handler: (localId: string, specPath: string) => void
	): void {
		this.callbacks.onSessionCompleted = handler;
	}

	/**
	 * Subscribe to per-session update events (T017, spec 018 bridge). Fires
	 * once per mutated session after each poll cycle commits.
	 *
	 * Returns a {@link Disposable} that removes the subscription without
	 * affecting other listeners.
	 */
	onSessionUpdated(listener: AgentSessionUpdatedListener): Disposable {
		this.sessionUpdatedListeners.add(listener);
		return {
			dispose: () => {
				this.sessionUpdatedListeners.delete(listener);
			},
		};
	}

	/**
	 * Execute a single poll cycle with retry and credential-expiry detection.
	 * @param force - When true, poll all non-read-only sessions regardless of status or grace period.
	 *               Use for user-initiated refresh to always query the provider.
	 */
	async pollOnce(force = false): Promise<void> {
		const provider = this.registry.getActive();
		if (!provider) {
			logDebug("No active provider, skipping poll");
			return;
		}

		try {
			const sessions = force
				? await this.getAllPollableSessions()
				: await this.getSessionsToPoll();
			if (sessions.length === 0) {
				return;
			}

			const updates = await provider.pollSessions(sessions);
			for (const update of updates) {
				await this.applyUpdate(update);
			}

			this.consecutiveFailures = 0;
			if (updates.length > 0) {
				logDebug(`Applied ${updates.length} session update(s)`);
				this.callbacks.onUpdated?.();
			}
		} catch (error) {
			this.handlePollError(error);
		}
	}

	/**
	 * Start interval-based polling.
	 * @param intervalMs - Polling interval in milliseconds
	 */
	start(intervalMs: number): void {
		if (this.intervalId) {
			return;
		}
		this.consecutiveFailures = 0;
		this.intervalId = setInterval(() => {
			this.pollOnce().catch((error) => {
				logError("Interval poll failed", error);
			});
		}, intervalMs);
		logDebug(`Polling started with ${intervalMs}ms interval`);
	}

	/**
	 * Stop interval-based polling.
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
			logDebug("Polling stopped");
		}
	}

	private async getAllPollableSessions(): Promise<AgentSession[]> {
		const all = await this.sessionStorage.getAll();
		return all.filter((s) => !s.isReadOnly);
	}

	private async getSessionsToPoll(): Promise<AgentSession[]> {
		const active = await this.sessionStorage.getActive();
		const all = await this.sessionStorage.getAll();
		const now = Date.now();
		const activeIds = new Set(active.map((s) => s.localId));
		const gracePeriodSessions: AgentSession[] = [];

		for (const session of all) {
			if (activeIds.has(session.localId)) {
				continue;
			}
			if (session.isReadOnly) {
				continue;
			}
			const completedAt = session.completedAt ?? session.updatedAt;
			const hasUnknownPrState = session.pullRequests.some((pr) => !pr.state);
			const effectiveGracePeriod = hasUnknownPrState
				? PR_UNKNOWN_STATE_GRACE_PERIOD_MS
				: PR_GRACE_PERIOD_MS;
			if (now - completedAt >= effectiveGracePeriod) {
				continue;
			}
			if (session.pullRequests.length === 0) {
				continue;
			}
			if (
				session.pullRequests.every((pr) =>
					TERMINAL_PR_STATES.has(pr.state ?? "")
				)
			) {
				continue;
			}
			gracePeriodSessions.push(session);
		}

		return [...active, ...gracePeriodSessions];
	}

	private async applyUpdate(update: SessionUpdate): Promise<void> {
		const { localId, timestamp: _timestamp, ...fields } = update;
		const isTerminal =
			update.status === SessionStatus.COMPLETED ||
			update.status === SessionStatus.FAILED ||
			update.status === SessionStatus.CANCELLED;

		let derivedTasks: AgentTask[] | undefined;
		if (isTerminal && !update.tasks) {
			const current = await this.sessionStorage.getById(localId);
			if (current && current.tasks.length > 0) {
				derivedTasks = deriveTerminalTaskStatuses(current.tasks, update.status);
			}
		}

		await this.sessionStorage.update(localId, {
			...fields,
			...(derivedTasks ? { tasks: derivedTasks } : {}),
			...(isTerminal ? { completedAt: Date.now() } : {}),
		});

		// Fan out to spec 018 subscribers AFTER the commit so readers see the
		// new state. Non-terminal updates also fire so the chat panel can
		// reflect incremental status/blocked transitions.
		if (this.sessionUpdatedListeners.size > 0) {
			const snapshot = await this.sessionStorage.getById(localId);
			if (snapshot) {
				this.fireSessionUpdated({ localId, session: snapshot });
			}
		}

		if (isTerminal && update.status === SessionStatus.COMPLETED) {
			const session = await this.sessionStorage.getById(localId);
			if (session) {
				this.callbacks.onSessionCompleted?.(localId, session.specPath);
			}
		}
	}

	private fireSessionUpdated(event: AgentSessionUpdatedEvent): void {
		// Snapshot so listeners that dispose during delivery don't mutate the
		// iteration.
		for (const listener of [...this.sessionUpdatedListeners]) {
			try {
				listener(event);
			} catch (error) {
				logError("onSessionUpdated listener threw", error);
			}
		}
	}

	private handlePollError(error: unknown): void {
		this.consecutiveFailures += 1;

		if (this.isCredentialError(error)) {
			logWarn("Credential expiry detected during polling");
			this.callbacks.onCredentialExpiry?.();
			return;
		}

		logError("Polling cycle failed", error);

		const errorMsg =
			error instanceof ProviderError
				? error.message
				: "Cloud agent polling failed. Check the output channel for details.";
		this.callbacks.onError?.(errorMsg);

		if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
			logWarn(
				`Polling paused after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
			);
			this.stop();
		}
	}

	private isCredentialError(error: unknown): boolean {
		if (error instanceof ProviderError) {
			return (
				error.code === ErrorCode.CREDENTIALS_INVALID ||
				error.code === ErrorCode.CREDENTIALS_MISSING
			);
		}
		return false;
	}
}

// ============================================================================
// Helpers
// ============================================================================

function deriveTerminalTaskStatuses(
	tasks: readonly AgentTask[],
	sessionStatus: SessionStatus | undefined
): AgentTask[] {
	let targetStatus: TaskStatus = TaskStatus.SKIPPED;
	if (sessionStatus === SessionStatus.COMPLETED) {
		targetStatus = TaskStatus.COMPLETED;
	} else if (sessionStatus === SessionStatus.FAILED) {
		targetStatus = TaskStatus.FAILED;
	}

	const now = Date.now();
	return tasks.map((task) => {
		if (
			task.status === TaskStatus.COMPLETED ||
			task.status === TaskStatus.FAILED ||
			task.status === TaskStatus.SKIPPED
		) {
			return task;
		}
		return { ...task, status: targetStatus, completedAt: now };
	});
}
