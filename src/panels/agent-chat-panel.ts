/**
 * AgentChatPanel — extension-side webview wrapper for one agent chat session.
 *
 * Responsibilities (Phase 3 / US1 MVP):
 *   - Manage a single `vscode.WebviewPanel` instance per session (FR-008).
 *   - Load the `agent-chat` webview entry via the shared
 *     `getWebviewContent()` helper (registered as a SupportedPage in T004).
 *   - Handle the `agent-chat/*` protocol messages relevant to User Story 1:
 *     hydration (`ready` → `session/loaded`), input submission with
 *     `deliveryStatus` lifecycle, cancel / retry routing.
 *   - Forward `AgentChatSessionStore` mutations (manifest + transcript) and
 *     registry events to the webview as `messages/appended`,
 *     `messages/updated`, `session/lifecycle-changed`.
 *
 * Out of scope for US1 (deferred to later phases):
 *   - worktree banner + cleanup flow (T066, Phase 5)
 *   - mode / model / target selectors (T066, Phase 5)
 *   - transcript-archive paginated requests (can land later)
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md §4
 */

import { randomUUID } from "node:crypto";
import {
	type Disposable,
	type ExtensionContext,
	ViewColumn,
	type WebviewPanel,
	window,
} from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";
import type {
	AgentChatPanelLike,
	AgentChatRegistry,
} from "../features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../features/agent-chat/agent-chat-session-store";
import {
	AGENT_CHAT_TELEMETRY_EVENTS,
	logTelemetry,
} from "../features/agent-chat/telemetry";
import {
	type AgentChatSession,
	type ChatMessage,
	type SessionLifecycleState,
	TERMINAL_STATES,
	transcriptKeyFor,
	type UserChatMessage,
} from "../features/agent-chat/types";

// ============================================================================
// Host abstraction
// ============================================================================

/**
 * Host hook for panel creation. Production wires this to
 * `vscode.window.createWebviewPanel`; tests inject a fake so they don't need a
 * real VS Code environment.
 */
export interface AgentChatPanelHost {
	/**
	 * Create the underlying webview panel. The factory returns a minimal
	 * {@link AgentChatPanelLike} plus a `webview` handle the implementation can
	 * post messages to and listen for incoming messages.
	 */
	createPanel(options: { session: AgentChatSession }): HostedPanel;
}

/** Minimal webview surface the panel talks to. */
export interface HostedWebview {
	postMessage(message: unknown): Thenable<boolean>;
	onDidReceiveMessage(listener: (message: unknown) => void): {
		dispose: () => void;
	};
}

/**
 * A panel plus its attached webview. Structural so tests can provide a fake
 * without importing `vscode.WebviewPanel`.
 */
export interface HostedPanel extends AgentChatPanelLike {
	webview: HostedWebview;
}

/**
 * Default host implementation that uses VS Code's real `createWebviewPanel`.
 * Exposed so the extension entry point can wire it up in one place.
 */
export function createDefaultAgentChatPanelHost(
	context: ExtensionContext
): AgentChatPanelHost {
	return {
		createPanel: ({ session }): HostedPanel => {
			const panel: WebviewPanel = window.createWebviewPanel(
				AgentChatPanel.viewType,
				`Agent Chat — ${session.agentDisplayName}`,
				ViewColumn.Beside,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [context.extensionUri],
				}
			);
			panel.webview.html = getWebviewContent(
				panel.webview,
				context.extensionUri,
				"agent-chat",
				{ "session-id": session.id }
			);
			return wrapVscodePanel(panel);
		},
	};
}

/** Adapt a real `vscode.WebviewPanel` to the minimal `HostedPanel` surface. */
function wrapVscodePanel(panel: WebviewPanel): HostedPanel {
	const webview: HostedWebview = {
		postMessage: (message: unknown) => panel.webview.postMessage(message),
		onDidReceiveMessage: (
			listener: (message: unknown) => void
		): { dispose: () => void } => {
			const sub = panel.webview.onDidReceiveMessage(listener);
			return { dispose: () => sub.dispose() };
		},
	};
	return {
		viewType: panel.viewType,
		webview,
		dispose: () => panel.dispose(),
		reveal: (...args: unknown[]) => {
			const col = args[0] as ViewColumn | undefined;
			panel.reveal(col);
		},
		onDidDispose: (cb: () => void) => {
			const sub = panel.onDidDispose(cb);
			return { dispose: () => sub.dispose() };
		},
	};
}

// ============================================================================
// Panel options
// ============================================================================

export interface AgentChatPanelOptions {
	session: AgentChatSession;
	store: AgentChatSessionStore;
	registry: AgentChatRegistry;
	host: AgentChatPanelHost;
}

// ============================================================================
// Panel implementation
// ============================================================================

export class AgentChatPanel {
	static readonly viewType = "gatomia.agentChatPanel";

	private readonly session: AgentChatSession;
	private readonly store: AgentChatSessionStore;
	private readonly registry: AgentChatRegistry;
	private readonly host: AgentChatPanelHost;

	private panel: HostedPanel | undefined;
	private readonly disposables: Disposable[] = [];
	private opened = false;
	private lastLifecycleState: SessionLifecycleState;

	constructor(options: AgentChatPanelOptions) {
		this.session = options.session;
		this.store = options.store;
		this.registry = options.registry;
		this.host = options.host;
		this.lastLifecycleState = options.session.lifecycleState;
	}

	// ------------------------------------------------------------------
	// Lifecycle
	// ------------------------------------------------------------------

	/**
	 * Create (or reveal) the webview panel, wire message plumbing, and
	 * subscribe to store/registry updates. Idempotent — subsequent calls
	 * focus the existing panel.
	 */
	open(): void {
		if (this.opened && this.panel) {
			this.panel.reveal(ViewColumn.Beside);
			return;
		}
		this.panel = this.host.createPanel({ session: this.session });
		this.opened = true;

		this.registry.attachPanel(this.session.id, this.panel);

		this.disposables.push(
			this.panel.webview.onDidReceiveMessage((msg) => {
				this.handleWebviewMessage(msg).catch(noop);
			})
		);

		this.disposables.push(
			this.panel.onDidDispose(() => {
				this.dispose();
			})
		);

		// Forward manifest changes (lifecycle transitions, session updates).
		this.disposables.push(
			this.store.onDidChangeManifest(() => {
				this.onManifestChanged().catch(noop);
			})
		);

		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.PANEL_OPENED, {
			sessionId: this.session.id,
			agentId: this.session.agentId,
		});
	}

	/**
	 * Forward a transcript mutation (appendMessages / updateMessages) from
	 * external callers. Internal callers never go through this method — they
	 * mutate the store directly and the onDidChangeManifest handler fans out
	 * to the webview.
	 */
	async notifyMessagesAppended(messages: ChatMessage[]): Promise<void> {
		if (!this.panel || messages.length === 0) {
			return;
		}
		await this.panel.webview.postMessage({
			type: "agent-chat/messages/appended",
			payload: { sessionId: this.session.id, messages },
		});
	}

	async notifyMessagesUpdated(
		updates: Array<{ id: string; patch: Partial<ChatMessage> }>
	): Promise<void> {
		if (!this.panel || updates.length === 0) {
			return;
		}
		await this.panel.webview.postMessage({
			type: "agent-chat/messages/updated",
			payload: { sessionId: this.session.id, updates },
		});
	}

	dispose(): void {
		if (!this.opened) {
			return;
		}
		this.opened = false;
		for (const d of this.disposables) {
			try {
				d.dispose();
			} catch {
				// best-effort
			}
		}
		this.disposables.length = 0;
		if (this.panel) {
			try {
				this.panel.dispose();
			} catch {
				// best-effort
			}
			this.panel = undefined;
		}
	}

	// ------------------------------------------------------------------
	// Incoming protocol messages
	// ------------------------------------------------------------------

	private async handleWebviewMessage(raw: unknown): Promise<void> {
		const message = raw as { type?: string; payload?: unknown };
		if (!message.type) {
			return;
		}
		switch (message.type) {
			case "agent-chat/ready":
				await this.sendSessionLoaded();
				break;
			case "agent-chat/input/submit":
				await this.handleInputSubmit(
					message.payload as {
						sessionId: string;
						content: string;
						clientMessageId?: string;
					}
				);
				break;
			case "agent-chat/control/cancel":
				await this.routeToRunner("cancel");
				break;
			case "agent-chat/control/retry":
				await this.routeToRunner("retry");
				break;
			default:
				// Unknown / deferred message types log but never crash.
				break;
		}
	}

	private async sendSessionLoaded(): Promise<void> {
		if (!this.panel) {
			return;
		}
		const current =
			(await this.store.getSession(this.session.id)) ?? this.session;
		const transcript = this.readTranscript(current.id);
		const isReadOnly = current.source === "cloud";
		await this.panel.webview.postMessage({
			type: "agent-chat/session/loaded",
			payload: {
				session: {
					id: current.id,
					source: current.source,
					agentDisplayName: current.agentDisplayName,
					selectedModeId: current.selectedModeId,
					selectedModelId: current.selectedModelId,
					executionTarget: {
						kind: current.executionTarget.kind,
						label: executionTargetLabel(current.executionTarget.kind),
					},
					lifecycleState: current.lifecycleState,
					acceptsFollowUp: computeAcceptsFollowUp(current),
					isReadOnly,
					worktree: current.worktree
						? {
								path: current.worktree.absolutePath,
								branch: current.worktree.branchName,
								status: current.worktree.status,
							}
						: undefined,
					cloud: current.cloud
						? {
								providerId: current.cloud.providerId,
								providerDisplayName: current.cloud.providerId,
								externalUrl: current.cloud.externalUrl,
							}
						: undefined,
				},
				messages: transcript,
				availableModes: [],
				availableModels: [],
				availableTargets: [
					{ kind: "local", label: "Local", enabled: true },
					{ kind: "worktree", label: "Worktree", enabled: true },
					{ kind: "cloud", label: "Cloud", enabled: true },
				],
				hasArchivedTranscript: false,
			},
		});
	}

	private async handleInputSubmit(payload: {
		sessionId: string;
		content: string;
		clientMessageId?: string;
	}): Promise<void> {
		const current =
			(await this.store.getSession(this.session.id)) ?? this.session;
		const userMessageId = payload.clientMessageId ?? randomUUID();

		// Optimistic render: append a pending user message immediately.
		const pendingMessage: UserChatMessage = {
			id: userMessageId,
			sessionId: this.session.id,
			timestamp: Date.now(),
			sequence: 0, // store assigns canonical sequence on read; UI just needs ordering
			role: "user",
			content: payload.content,
			isInitialPrompt: false,
			deliveryStatus: "pending",
		};

		// For cloud (read-only) sessions, immediately reject.
		if (current.source === "cloud") {
			await this.emitUserMessageWithStatus(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason:
					"This is a read-only cloud session. Follow-up input is not supported in v1.",
			});
			return;
		}

		// Terminal sessions cannot accept more input.
		if (TERMINAL_STATES.has(current.lifecycleState)) {
			await this.emitUserMessageWithStatus(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason: `Session is in terminal state (${current.lifecycleState}); cannot accept follow-up input.`,
			});
			return;
		}

		const runner = this.registry.getRunner(this.session.id);
		if (!runner) {
			await this.emitUserMessageWithStatus(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason: "No active runner attached to this session.",
			});
			return;
		}

		// Emit the pending message up-front.
		await this.sendMessagesAppended([pendingMessage]);

		if (!runner.submit) {
			await this.sendMessagesUpdated([
				{
					id: pendingMessage.id,
					patch: {
						deliveryStatus: "rejected",
						rejectionReason: "This runner does not accept follow-up input.",
					} as Partial<ChatMessage>,
				},
			]);
			return;
		}
		try {
			await runner.submit(payload.content);
			await this.sendMessagesUpdated([
				{
					id: pendingMessage.id,
					patch: { deliveryStatus: "delivered" } as Partial<ChatMessage>,
				},
			]);
		} catch (err) {
			await this.sendMessagesUpdated([
				{
					id: pendingMessage.id,
					patch: {
						deliveryStatus: "rejected",
						rejectionReason: err instanceof Error ? err.message : String(err),
					} as Partial<ChatMessage>,
				},
			]);
		}
	}

	private async routeToRunner(method: "cancel" | "retry"): Promise<void> {
		const runner = this.registry.getRunner(this.session.id);
		if (!runner) {
			return;
		}
		try {
			if (method === "cancel") {
				await runner.cancel();
			} else if (runner.retry) {
				await runner.retry();
			}
		} catch (err) {
			logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.ERROR, {
				sessionId: this.session.id,
				stage: method,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	// ------------------------------------------------------------------
	// Outgoing protocol messages
	// ------------------------------------------------------------------

	private async emitUserMessageWithStatus(
		base: UserChatMessage,
		patch: Partial<UserChatMessage>
	): Promise<void> {
		await this.sendMessagesAppended([base]);
		await this.sendMessagesUpdated([{ id: base.id, patch }]);
	}

	private async sendMessagesAppended(messages: ChatMessage[]): Promise<void> {
		if (!this.panel) {
			return;
		}
		await this.panel.webview.postMessage({
			type: "agent-chat/messages/appended",
			payload: { sessionId: this.session.id, messages },
		});
	}

	private async sendMessagesUpdated(
		updates: Array<{ id: string; patch: Partial<ChatMessage> }>
	): Promise<void> {
		if (!this.panel) {
			return;
		}
		await this.panel.webview.postMessage({
			type: "agent-chat/messages/updated",
			payload: { sessionId: this.session.id, updates },
		});
	}

	private async onManifestChanged(): Promise<void> {
		if (!this.panel) {
			return;
		}
		const current = await this.store.getSession(this.session.id);
		if (!current) {
			return;
		}
		if (current.lifecycleState !== this.lastLifecycleState) {
			const from = this.lastLifecycleState;
			this.lastLifecycleState = current.lifecycleState;
			await this.panel.webview.postMessage({
				type: "agent-chat/session/lifecycle-changed",
				payload: {
					sessionId: this.session.id,
					from,
					to: current.lifecycleState,
					at: Date.now(),
				},
			});
		}
		// Transcript changes are surfaced via messages/appended when the runner
		// calls store.appendMessages. The panel re-reads the transcript from
		// memento and diffs in a minimal way.
		await this.flushTranscriptDeltas();
	}

	private readonly knownMessageIds = new Set<string>();

	private async flushTranscriptDeltas(): Promise<void> {
		if (!this.panel) {
			return;
		}
		const transcript = this.readTranscript(this.session.id);
		const fresh: ChatMessage[] = [];
		for (const msg of transcript) {
			if (!this.knownMessageIds.has(msg.id)) {
				this.knownMessageIds.add(msg.id);
				fresh.push(msg);
			}
		}
		if (fresh.length > 0) {
			await this.sendMessagesAppended(fresh);
		}
	}

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	private readTranscript(sessionId: string): ChatMessage[] {
		// Reach into the store's backing memento keys. The store owns its
		// schema; this helper is a tightly-scoped read path that avoids
		// introducing a public API just for this case.
		const key = transcriptKeyFor(sessionId);
		const mem = (
			this.store as unknown as {
				workspaceState: {
					get<T>(k: string): T | undefined;
				};
			}
		).workspaceState;
		const raw = mem.get<{ messages: ChatMessage[] }>(key);
		return raw?.messages ?? [];
	}
}

// ============================================================================
// Small helpers
// ============================================================================

function executionTargetLabel(kind: "local" | "worktree" | "cloud"): string {
	switch (kind) {
		case "local":
			return "Local";
		case "worktree":
			return "Worktree";
		case "cloud":
			return "Cloud";
		default:
			return "Local";
	}
}

function noop(): void {
	// Intentionally empty — used as a silent .catch handler.
}

function computeAcceptsFollowUp(session: AgentChatSession): boolean {
	if (session.source === "cloud") {
		return false;
	}
	if (session.capabilities.source === "none") {
		return true;
	}
	return session.capabilities.acceptsFollowUp;
}
