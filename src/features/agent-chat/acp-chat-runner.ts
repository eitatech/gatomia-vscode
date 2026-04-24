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
}

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
	private disposed = false;

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
			default:
				break;
		}
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
		await this.store.updateMessages(this.sessionId, [
			{
				id: messageId,
				patch: { status: nextStatus } as Partial<ChatMessage>,
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
