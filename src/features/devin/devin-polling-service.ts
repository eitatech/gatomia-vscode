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
import {
	mapDevinApiStatusToSessionStatus,
	isTerminalStatus,
} from "./status-mapper";
import type { SessionStatus } from "./types";

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
 * Options for configuring the polling service.
 */
export interface PollingServiceOptions {
	readonly intervalSeconds?: number;
}

type StatusChangeListener = (event: StatusChangeEvent) => void;
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
	private readonly cycleListeners: Set<PollCycleListener> = new Set();
	private readonly log: LogFn;
	private timerId: ReturnType<typeof setInterval> | undefined;

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
			this.pollOnce().catch(() => {
				// Swallow polling errors silently
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

		if (activeSessions.length === 0) {
			this.log("[Polling] No active sessions, stopping poller");
			this.stop();
			return;
		}

		const client = await this.resolveApiClient();
		if (!client) {
			this.log("[Polling] Could not resolve API client (no credentials?)");
			return;
		}

		this.log(`[Polling] Polling ${activeSessions.length} active session(s)...`);

		for (const session of activeSessions) {
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

	private async pollSession(
		client: DevinApiClientInterface,
		localId: string,
		sessionId: string,
		currentStatus: SessionStatus
	): Promise<void> {
		try {
			const response = await client.getSession(sessionId);
			const newStatus = mapDevinApiStatusToSessionStatus(response.status);

			const updates: Record<string, unknown> = {
				status: newStatus,
			};

			if (isTerminalStatus(newStatus)) {
				updates.completedAt = Date.now();
			}

			if (response.pullRequests.length > 0) {
				updates.pullRequests = response.pullRequests.map((pr) => ({
					prUrl: pr.prUrl,
					prState: pr.prState,
					branch: "",
					createdAt: Date.now(),
				}));
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
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			this.log(`[Polling] Error polling session ${sessionId}: ${msg}`);
		}
	}

	private emit(event: StatusChangeEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}
}
