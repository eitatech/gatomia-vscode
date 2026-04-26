/**
 * AcpChatRunner — drives one ACP chat session.
 *
 * Responsibilities:
 *   T027a (lifecycle + event mapping + submit):
 *     - Subscribe to the ACP client's per-session event stream via
 *       `AcpSessionManager.subscribe`, using the correct `(providerId, cwd)`
 *       pair (F1 remediation).
 *     - Map `AcpSessionEvent` into transcript mutations (`AgentChatMessage`,
 *       `ToolCallChatMessage`, `ErrorChatMessage`) and persist via the store.
 *     - Drive `SessionLifecycleState` transitions and keep the registry in
 *       sync.
 *     - Forward `submit(userMessage)` to `AcpClient.sendPrompt` when the
 *       session is ready to accept input.
 *
 *   T027b (follow-up queue + retry + cancel):
 *     - At-most-one in-flight queued follow-up per session
 *       (`contracts/agent-chat-panel-protocol.md §4.2`).
 *     - `retry()` creates a fresh session id while preserving mode / model /
 *       target.
 *     - `cancel()` routes to `AcpSessionManager.cancel()` and transitions the
 *       session to `cancelled`.
 *     - `dispose()` releases the subscription and is idempotent.
 *
 * Implements `AgentChatRunnerHandle` (forward-compat interface from T005) so
 * the registry can hold runners without a circular import.
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md §4.2
 * @see specs/018-agent-chat-panel/data-model.md §2
 */

import { randomUUID } from "node:crypto";
import type { Disposable } from "vscode";
import type {
	AcpSessionEvent,
	AcpSessionEventListener,
} from "../../services/acp/acp-client";
import type { AgentChatRegistry } from "./agent-chat-registry";
import type { AgentChatSessionStore } from "./agent-chat-session-store";
import { AGENT_CHAT_TELEMETRY_EVENTS, logTelemetry } from "./telemetry";
import {
	type AgentChatEvent,
	type AgentChatRunnerHandle,
	type AgentChatSession,
	type ChatMessage,
	type ErrorChatMessage,
	type ErrorChatMessageCategory,
	type ModelDescriptor,
	type SessionLifecycleState,
	TERMINAL_STATES,
	type ToolCallChatMessage,
	type UserChatMessage,
} from "./types";

// ============================================================================
// Injected dependencies
// ============================================================================

/**
 * Subset of {@link AcpSessionManager} that `AcpChatRunner` actually consumes.
 * Declaring it structurally keeps the runner unit-testable without spinning up
 * real ACP subprocesses — tests inject a fake.
 */
export interface AcpChatRunnerSessionManager {
	sendPrompt(
		providerId: string,
		cwd: string | undefined,
		sessionId: string,
		prompt: string
	): Promise<void>;
	cancel(
		providerId: string,
		cwd: string | undefined,
		sessionId: string
	): Promise<void>;
	subscribe(
		providerId: string,
		cwd: string | undefined,
		sessionId: string,
		listener: AcpSessionEventListener
	): Disposable;
	/**
	 * Optional pending-writes plumbing (Phase 4). When the manager
	 * exposes the buffer-then-apply API the runner forwards snapshot
	 * changes to the panel via `pending-writes/changed` events. Older
	 * managers that omit this method continue to work unchanged.
	 */
	subscribePendingWrites?(
		providerId: string,
		cwd: string | undefined,
		listener: (writes: readonly PendingWriteSnapshot[]) => void
	): Disposable;
	flushPendingWrites?(
		providerId: string,
		cwd: string | undefined,
		action: FlushPendingWritesAction
	): void;
}

/**
 * Locally-scoped projection of a pending file write — kept structural
 * so the runner does not need to import the concrete store type. The
 * `linesAdded` / `linesRemoved` fields mirror what the diff card uses
 * for tool-call cards, computed once when the write is enqueued.
 */
export interface PendingWriteSnapshot {
	id: string;
	path: string;
	proposedContent?: string;
	oldText?: string | null;
	linesAdded?: number;
	linesRemoved?: number;
	languageId?: string;
}

export type FlushPendingWritesAction =
	| { kind: "accept-all" }
	| { kind: "reject-all" }
	| { kind: "accept-one"; id: string }
	| { kind: "reject-one"; id: string };

export interface AcpChatRunnerOptions {
	/** The session this runner drives. Must already be registered in the store. */
	session: AgentChatSession;
	store: AgentChatSessionStore;
	registry: AgentChatRegistry;
	manager: AcpChatRunnerSessionManager;
	/** Pre-resolved ACP session id for subscription routing. */
	acpSessionId: string;
	/** Optional event sink for panel consumers (webview bridge hooks in here). */
	onEvent?: (event: AgentChatEvent) => void;
	/** Clock injection for deterministic tests. */
	now?: () => number;
}

// ============================================================================
// Runner
// ============================================================================

interface QueuedFollowUp {
	readonly content: string;
	readonly userMessageId: string;
}

export class AcpChatRunner implements AgentChatRunnerHandle {
	readonly sessionId: string;

	private readonly session: AgentChatSession;
	private readonly store: AgentChatSessionStore;
	private readonly registry: AgentChatRegistry;
	private readonly manager: AcpChatRunnerSessionManager;
	private readonly acpSessionId: string;
	private readonly onEvent?: (event: AgentChatEvent) => void;
	private readonly now: () => number;

	private subscription?: Disposable;
	private pendingWritesSubscription?: Disposable;
	private disposed = false;

	/**
	 * Latest pending-writes snapshot received from the manager. Cached
	 * so that {@link onPendingWritesChanged} can replay the current
	 * state to a freshly-attached listener (e.g. when the webview
	 * binds to this session after the agent already queued some
	 * writes).
	 */
	private latestPendingWrites: readonly PendingWriteSnapshot[] = [];

	/** Listeners registered via {@link onPendingWritesChanged}. */
	private readonly pendingWritesListeners = new Set<
		(writes: readonly PendingWriteSnapshot[]) => void
	>();

	/**
	 * True while a turn is in flight with the ACP agent (we've called
	 * `sendPrompt` and are waiting for either `turn-finished` or the promise
	 * to resolve/reject).
	 */
	private turnInFlight = false;

	/** At-most-one queued follow-up while `turnInFlight === true`. */
	private queuedFollowUp: QueuedFollowUp | undefined;

	/** Monotonic sequence across all transcript writes by this runner. */
	private nextSequence = 0;

	/** Current turn id (assigned on session/started and each turn-finished). */
	private currentTurnId: string | undefined;

	/**
	 * Latest chunk accumulator for the in-flight turn. We coalesce streamed
	 * `agent-message-chunk` events into a single `AgentChatMessage` per turn
	 * (per data-model §1.2), materialised when the turn finishes.
	 */
	private turnBuffer = "";

	/**
	 * The ephemeral agent-message entry we maintain during streaming so the UI
	 * can render partial content. Updated in place via `store.updateMessages`.
	 */
	private inFlightAgentMessageId: string | undefined;

	/**
	 * Tool-call message id lookup so subsequent `tool-call-update` events
	 * patch the same transcript entry in place.
	 */
	private readonly toolCallMessageIdByToolCallId = new Map<string, string>();

	constructor(options: AcpChatRunnerOptions) {
		this.session = options.session;
		this.sessionId = options.session.id;
		this.store = options.store;
		this.registry = options.registry;
		this.manager = options.manager;
		this.acpSessionId = options.acpSessionId;
		this.onEvent = options.onEvent;
		this.now = options.now ?? Date.now;
	}

	// ------------------------------------------------------------------
	// T027a: lifecycle + event mapping + submit
	// ------------------------------------------------------------------

	/**
	 * Subscribe to the ACP event stream and dispatch the initial prompt.
	 *
	 * Resolves when the first sendPrompt call settles (success or error).
	 * The caller typically awaits this to know the handshake succeeded.
	 */
	async start(initialPrompt: string): Promise<void> {
		this.subscribeEvents();
		await this.transitionLifecycle("running");
		// T068: surface the worktree choice in the transcript so users can
		// verify the session is targeting the expected path/branch. This is
		// additive to the explicit `worktree-created` message the caller may
		// emit when the directory was first created.
		if (
			this.session.worktree &&
			this.session.executionTarget.kind === "worktree"
		) {
			const ts = this.now();
			const sequence = this.nextSequence;
			this.nextSequence += 1;
			await this.store.appendMessages(this.sessionId, [
				{
					id: randomUUID(),
					sessionId: this.sessionId,
					timestamp: ts,
					sequence,
					role: "system",
					kind: "worktree-created",
					content: `Using worktree at ${this.session.worktree.absolutePath} on branch ${this.session.worktree.branchName}.`,
				},
			]);
		}
		await this.appendUserMessage(initialPrompt, {
			isInitial: true,
			deliveryStatus: "delivered",
		});

		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.SESSION_STARTED, {
			sessionId: this.sessionId,
			agentId: this.session.agentId,
			executionTargetKind: this.session.executionTarget.kind,
		});

		await this.dispatchToAcp(initialPrompt);
	}

	/**
	 * Submit a follow-up from the user. Resolves when the message has been
	 * routed (either forwarded to ACP or queued). Rejects when a queued
	 * follow-up already exists (§4.2 at-most-one-in-flight rule).
	 */
	async submit(content: string): Promise<void> {
		if (this.disposed) {
			throw new Error("[acp-chat-runner] runner is disposed");
		}
		const current = await this.store.getSession(this.sessionId);
		const state = current?.lifecycleState ?? this.session.lifecycleState;

		if (TERMINAL_STATES.has(state)) {
			throw new Error(
				`[acp-chat-runner] session is in terminal state (${state}); submit disallowed`
			);
		}

		if (this.turnInFlight) {
			if (this.queuedFollowUp) {
				throw new Error(
					"[acp-chat-runner] a follow-up is already queued; wait for the current turn to complete"
				);
			}
			const userMessageId = await this.appendUserMessage(content, {
				isInitial: false,
				deliveryStatus: "queued",
			});
			this.queuedFollowUp = { content, userMessageId };
			return;
		}

		const userMessageId = await this.appendUserMessage(content, {
			isInitial: false,
			deliveryStatus: "delivered",
		});
		await this.dispatchToAcp(content, userMessageId);
	}

	private subscribeEvents(): void {
		if (this.subscription) {
			return;
		}
		const cwd = this.resolveCwd();
		this.subscription = this.manager.subscribe(
			this.session.agentId,
			cwd,
			this.acpSessionId,
			(event) => {
				this.onAcpEvent(event).catch((err: unknown) => {
					logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
						sessionId: this.sessionId,
						stage: "event-handler",
						error: err instanceof Error ? err.message : String(err),
					});
				});
			}
		);
		this.subscribePendingWrites();
	}

	/**
	 * Hook into the manager's buffer-then-apply queue. Each snapshot
	 * change is fanned out to host-level listeners (the chat view
	 * provider) so the webview can keep its Accept/Reject bar in sync.
	 * The manager exposes the API as optional so older builds without
	 * buffering keep working.
	 */
	private subscribePendingWrites(): void {
		if (this.pendingWritesSubscription) {
			return;
		}
		const subscribe = this.manager.subscribePendingWrites;
		if (!subscribe) {
			return;
		}
		const cwd = this.resolveCwd();
		this.pendingWritesSubscription = subscribe.call(
			this.manager,
			this.session.agentId,
			cwd,
			(writes) => {
				this.latestPendingWrites = writes;
				for (const listener of this.pendingWritesListeners) {
					try {
						listener(writes);
					} catch (error) {
						logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
							sessionId: this.sessionId,
							stage: "pending-writes-listener",
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}
			}
		);
	}

	/**
	 * Subscribe to pending-writes snapshot changes for this runner.
	 * Replays the current snapshot synchronously on attach so the
	 * caller can render the bar immediately.
	 */
	onPendingWritesChanged(
		listener: (writes: readonly PendingWriteSnapshot[]) => void
	): Disposable {
		this.pendingWritesListeners.add(listener);
		listener(this.latestPendingWrites);
		return {
			dispose: () => {
				this.pendingWritesListeners.delete(listener);
			},
		};
	}

	/** Snapshot of the currently buffered writes (host-side reads). */
	getPendingWrites(): readonly PendingWriteSnapshot[] {
		return this.latestPendingWrites;
	}

	/**
	 * Settle the pending file-write buffer for this session's provider.
	 * No-ops when the manager does not expose the optional API (legacy
	 * paths without the buffer-then-apply feature flag).
	 */
	flushPendingWrites(action: FlushPendingWritesAction): void {
		const flush = this.manager.flushPendingWrites;
		if (!flush) {
			return;
		}
		flush.call(this.manager, this.session.agentId, this.resolveCwd(), action);
	}

	private resolveCwd(): string | undefined {
		if (this.session.executionTarget.kind === "worktree") {
			return this.session.worktree?.absolutePath;
		}
		// Local / cloud — let the manager use its constructor cwd.
		return;
	}

	private async dispatchToAcp(
		content: string,
		userMessageId?: string
	): Promise<void> {
		this.turnInFlight = true;
		this.turnBuffer = "";
		this.inFlightAgentMessageId = undefined;
		this.currentTurnId = this.currentTurnId ?? randomUUID();

		try {
			await this.manager.sendPrompt(
				this.session.agentId,
				this.resolveCwd(),
				this.acpSessionId,
				content
			);

			// If the promise resolves without us having seen an explicit
			// turn-finished (agents vary), treat that as a completion.
			if (this.turnInFlight) {
				await this.handleTurnFinished("end_turn");
			}
			if (userMessageId) {
				logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.SESSION_FOLLOW_UP_SENT, {
					sessionId: this.sessionId,
					userMessageId,
				});
			}
		} catch (error) {
			const category = this.classifyError(error);
			await this.emitErrorMessage(category, error);
			await this.transitionLifecycle("failed");
			this.turnInFlight = false;
		}
	}

	// ------------------------------------------------------------------
	// Event handling
	// ------------------------------------------------------------------

	private async onAcpEvent(event: AcpSessionEvent): Promise<void> {
		switch (event.kind) {
			case "agent-message-chunk":
				await this.handleAgentChunk(event.text, event.at);
				break;
			case "tool-call":
				await this.handleToolCallStarted(event);
				break;
			case "tool-call-update":
				await this.handleToolCallUpdated(event);
				break;
			case "turn-finished":
				await this.handleTurnFinished(event.stopReason);
				break;
			case "error":
				await this.handleRuntimeError(event.message);
				break;
			case "session-models-changed":
				await this.handleSessionModelsChanged(
					event.availableModels,
					event.currentModelId,
					event.at
				);
				break;
			default:
				break;
		}
	}

	/**
	 * Persist the agent-reported model state on the session and fan
	 * out a runner-level event so the host can rebroadcast the new
	 * `availableModels` / `currentModelId` to the webview without a
	 * full session reload.
	 */
	private async handleSessionModelsChanged(
		availableModels: ReadonlyArray<{
			modelId: string;
			name: string;
			description?: string | null;
		}>,
		currentModelId: string,
		at: number
	): Promise<void> {
		const projected: ModelDescriptor[] = availableModels.map((m) => ({
			id: m.modelId,
			displayName: m.name,
			invocation: "initial-prompt",
		}));
		const patch: Partial<AgentChatSession> = {
			availableModels: projected,
			currentModelId,
			selectedModelId: currentModelId,
		};
		try {
			await this.store.updateSession(this.sessionId, patch);
			this.registry.updateSession(this.sessionId, patch);
		} catch (error) {
			logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
				sessionId: this.sessionId,
				stage: "models-changed-persist",
				error: error instanceof Error ? error.message : String(error),
			});
		}
		this.fireEvent({
			type: "session/models-changed",
			sessionId: this.sessionId,
			availableModels: projected,
			currentModelId,
			at,
		});
	}

	private async handleAgentChunk(
		textDelta: string,
		_at: number
	): Promise<void> {
		this.turnBuffer += textDelta;
		const turnId = this.currentTurnId ?? randomUUID();
		this.currentTurnId = turnId;

		if (this.inFlightAgentMessageId) {
			await this.store.updateMessages(this.sessionId, [
				{
					id: this.inFlightAgentMessageId,
					patch: { content: this.turnBuffer },
				},
			]);
			return;
		}

		const id = randomUUID();
		const message: ChatMessage = {
			id,
			sessionId: this.sessionId,
			timestamp: this.now(),
			sequence: this.nextSequence,
			role: "agent",
			content: this.turnBuffer,
			turnId,
			isTurnComplete: false,
		};
		this.inFlightAgentMessageId = id;
		this.nextSequence += 1;
		await this.store.appendMessages(this.sessionId, [message]);

		this.fireEvent({
			type: "message/agent-chunk",
			sessionId: this.sessionId,
			turnId,
			textDelta,
			at: this.now(),
		});
	}

	private async handleToolCallStarted(
		event: AcpSessionEvent & {
			kind: "tool-call";
		}
	): Promise<void> {
		const id = randomUUID();
		this.toolCallMessageIdByToolCallId.set(event.toolCallId, id);
		this.nextSequence += 1;
		const message: ToolCallChatMessage = {
			id,
			sessionId: this.sessionId,
			timestamp: event.at,
			sequence: this.nextSequence,
			role: "tool",
			toolCallId: event.toolCallId,
			title: event.title,
			status: (event.status as ToolCallChatMessage["status"]) ?? "pending",
			toolKind: event.toolKind,
			affectedFiles: event.affectedFiles,
		};
		await this.store.appendMessages(this.sessionId, [message]);

		this.fireEvent({
			type: "tool/call-started",
			sessionId: this.sessionId,
			toolCallId: event.toolCallId,
			title: event.title,
			at: event.at,
		});
	}

	private async handleToolCallUpdated(
		event: AcpSessionEvent & {
			kind: "tool-call-update";
		}
	): Promise<void> {
		const messageId = this.toolCallMessageIdByToolCallId.get(event.toolCallId);
		if (!messageId) {
			return;
		}
		const nextStatus =
			(event.status as ToolCallChatMessage["status"]) ?? "running";
		// Updates may carry a richer `affectedFiles` payload than the
		// initial `tool_call` (the agent often emits the diff body in a
		// follow-up notification). Merge both so the card stays in sync.
		const patch: Partial<ChatMessage> = { status: nextStatus };
		if (event.toolKind !== undefined) {
			(patch as Partial<ToolCallChatMessage>).toolKind = event.toolKind;
		}
		if (event.affectedFiles !== undefined) {
			(patch as Partial<ToolCallChatMessage>).affectedFiles =
				event.affectedFiles;
		}
		await this.store.updateMessages(this.sessionId, [
			{
				id: messageId,
				patch,
			},
		]);

		this.fireEvent({
			type: "tool/call-updated",
			sessionId: this.sessionId,
			toolCallId: event.toolCallId,
			status: nextStatus,
			at: event.at,
		});
	}

	private async handleTurnFinished(stopReason: string): Promise<void> {
		if (this.inFlightAgentMessageId) {
			await this.store.updateMessages(this.sessionId, [
				{
					id: this.inFlightAgentMessageId,
					patch: {
						content: this.turnBuffer,
						isTurnComplete: true,
						stopReason,
					} as Partial<ChatMessage>,
				},
			]);
		}

		// T078 — coalesce per-turn stream telemetry: one event per completed
		// turn (not per chunk) with the coalesced character count so we can
		// trend output volume without fanning out high-frequency events.
		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.SESSION_STREAMED, {
			sessionId: this.sessionId,
			chars: this.turnBuffer.length,
			stopReason,
		});

		const finishedTurnId = this.currentTurnId ?? randomUUID();
		this.fireEvent({
			type: "message/agent-turn-finished",
			sessionId: this.sessionId,
			turnId: finishedTurnId,
			stopReason,
			at: this.now(),
		});

		this.turnInFlight = false;
		this.turnBuffer = "";
		this.inFlightAgentMessageId = undefined;
		this.currentTurnId = undefined;

		const queued = this.queuedFollowUp;
		if (queued) {
			this.queuedFollowUp = undefined;
			await this.store.updateMessages(this.sessionId, [
				{
					id: queued.userMessageId,
					patch: { deliveryStatus: "delivered" } as Partial<ChatMessage>,
				},
			]);
			await this.dispatchToAcp(queued.content, queued.userMessageId);
			return;
		}

		await this.transitionLifecycle("waiting-for-input");
	}

	private async handleRuntimeError(message: string): Promise<void> {
		await this.emitErrorMessage("unknown", new Error(message));
	}

	// ------------------------------------------------------------------
	// T027b: retry + cancel + dispose
	// ------------------------------------------------------------------

	/**
	 * Cancel the in-flight turn and transition the session to `cancelled`.
	 * Idempotent; subsequent calls after a terminal state are no-ops.
	 */
	async cancel(): Promise<void> {
		const current = await this.store.getSession(this.sessionId);
		const state = current?.lifecycleState ?? this.session.lifecycleState;
		if (TERMINAL_STATES.has(state)) {
			return;
		}

		try {
			await this.manager.cancel(
				this.session.agentId,
				this.resolveCwd(),
				this.acpSessionId
			);
		} catch (err) {
			logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
				sessionId: this.sessionId,
				stage: "cancel",
				error: err instanceof Error ? err.message : String(err),
			});
		}

		this.turnInFlight = false;
		this.queuedFollowUp = undefined;
		await this.transitionLifecycle("cancelled");
		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.SESSION_CANCELLED, {
			sessionId: this.sessionId,
		});
	}

	/**
	 * Create a fresh session preserving mode / model / target. Returns the new
	 * session id. The caller is responsible for creating a new runner bound to
	 * it.
	 */
	async retry(): Promise<string> {
		const fresh = await this.store.createSession({
			source: this.session.source,
			agentId: this.session.agentId,
			agentDisplayName: this.session.agentDisplayName,
			capabilities: this.session.capabilities,
			selectedModeId: this.session.selectedModeId,
			selectedModelId: this.session.selectedModelId,
			executionTarget: this.session.executionTarget,
			trigger: { kind: "user" },
			worktree: this.session.worktree,
			cloud: this.session.cloud,
			workspaceUri: this.session.workspaceUri,
		});
		this.registry.registerSession(fresh);
		return fresh.id;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.subscription?.dispose();
		this.subscription = undefined;
		this.pendingWritesSubscription?.dispose();
		this.pendingWritesSubscription = undefined;
	}

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	private async transitionLifecycle(to: SessionLifecycleState): Promise<void> {
		const current = await this.store.getSession(this.sessionId);
		const from = current?.lifecycleState ?? this.session.lifecycleState;
		if (from === to) {
			return;
		}

		const patch: Partial<AgentChatSession> = { lifecycleState: to };
		if (TERMINAL_STATES.has(to)) {
			patch.endedAt = this.now();
		}
		await this.store.updateSession(this.sessionId, patch);
		this.registry.updateSession(this.sessionId, patch);

		this.fireEvent({
			type: "lifecycle/transitioned",
			sessionId: this.sessionId,
			from,
			to,
			at: this.now(),
		});
	}

	private async appendUserMessage(
		content: string,
		options: {
			isInitial: boolean;
			deliveryStatus: UserChatMessage["deliveryStatus"];
		}
	): Promise<string> {
		const id = randomUUID();
		this.nextSequence += 1;
		const message: UserChatMessage = {
			id,
			sessionId: this.sessionId,
			timestamp: this.now(),
			sequence: this.nextSequence,
			role: "user",
			content,
			isInitialPrompt: options.isInitial,
			deliveryStatus: options.deliveryStatus,
		};
		await this.store.appendMessages(this.sessionId, [message]);
		this.fireEvent({
			type: "message/user-submitted",
			sessionId: this.sessionId,
			message,
		});
		return id;
	}

	private async emitErrorMessage(
		category: ErrorChatMessageCategory,
		error: unknown
	): Promise<void> {
		this.nextSequence += 1;
		const message: ErrorChatMessage = {
			id: randomUUID(),
			sessionId: this.sessionId,
			timestamp: this.now(),
			sequence: this.nextSequence,
			role: "error",
			content: error instanceof Error ? error.message : String(error),
			category,
			retryable: true,
		};
		await this.store.appendMessages(this.sessionId, [message]);

		this.fireEvent({
			type: "error",
			sessionId: this.sessionId,
			category,
			message: message.content,
			retryable: true,
			at: this.now(),
		});

		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
			sessionId: this.sessionId,
			category,
			retryable: true,
		});
	}

	// ------------------------------------------------------------------
	// T067 — mode/model change records
	// ------------------------------------------------------------------

	/**
	 * Append a `SystemChatMessage { kind: "mode-changed" }` to the transcript
	 * and notify event listeners. No-op when the new mode equals the session's
	 * current mode. Mode changes take effect on the *next* turn
	 * (data-model §5 invariant 6); this method only records the user's
	 * selection for auditability and UI feedback.
	 */
	async recordModeChange(modeId: string): Promise<void> {
		if (this.disposed) {
			return;
		}
		if (this.session.selectedModeId === modeId) {
			return;
		}
		const ts = this.now();
		const sequence = this.nextSequence;
		this.nextSequence += 1;
		await this.store.appendMessages(this.sessionId, [
			{
				id: randomUUID(),
				sessionId: this.sessionId,
				timestamp: ts,
				sequence,
				role: "system",
				kind: "mode-changed",
				content: `Mode changed to ${modeId}.`,
			},
		]);
	}

	/**
	 * Append a `SystemChatMessage { kind: "model-changed" }` to the transcript.
	 * Applies on the next turn for `initial-prompt`-invocation models; for
	 * `cli-flag` models the UI MUST offer to start a new session (§4.2 of the
	 * capabilities contract). The runner does not decide which — it only
	 * records the selection.
	 */
	async recordModelChange(modelId: string): Promise<void> {
		if (this.disposed) {
			return;
		}
		if (this.session.selectedModelId === modelId) {
			return;
		}
		const ts = this.now();
		const sequence = this.nextSequence;
		this.nextSequence += 1;
		await this.store.appendMessages(this.sessionId, [
			{
				id: randomUUID(),
				sessionId: this.sessionId,
				timestamp: ts,
				sequence,
				role: "system",
				kind: "model-changed",
				content: `Model changed to ${modelId}.`,
			},
		]);
	}

	private classifyError(error: unknown): ErrorChatMessageCategory {
		const raw = error instanceof Error ? error.message : String(error);
		if (raw.includes("timed out")) {
			return "acp-timeout";
		}
		if (raw.includes("handshake") || raw.includes("initialize")) {
			return "acp-handshake";
		}
		if (raw.includes("spawn")) {
			return "acp-spawn-failed";
		}
		if (raw.includes("empty") || raw.includes("no response")) {
			return "acp-empty-response";
		}
		return "unknown";
	}

	private fireEvent(event: AgentChatEvent): void {
		if (!this.onEvent) {
			return;
		}
		try {
			this.onEvent(event);
		} catch {
			// Best-effort; listener errors must not affect the runner.
		}
	}
}

// ============================================================================
// Helpers for other callers
// ============================================================================

/**
 * Convenience: resolve the expected ACP session id for a given
 * {@link AcpSessionContext} the runner uses to key subscriptions. Not used by
 * the runner itself, but exposed for callers that mint session ids externally.
 */
export function deriveAcpSessionId(session: AgentChatSession): string {
	// The runner's lifecycle currently expects an externally-minted id; this
	// helper is a centralised place to change that in the future without
	// touching every caller. For now, mirror the session id prefixed so the
	// two namespaces don't collide.
	return `acp-${session.id}`;
}
