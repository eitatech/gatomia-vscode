/**
 * AgentChatViewProvider — the canonical Agent Chat sidebar webview view.
 *
 * Lives in its own activity-bar container (`gatomia-chat`) and owns a single
 * `vscode.WebviewView`. The view can show three states:
 *
 *   1. **Empty / idle** — no session bound. The webview composer doubles as a
 *      "new session" launcher: the user picks a provider, model, and agent
 *      file from the catalog dropdowns and submits an initial prompt. The
 *      view dispatches `gatomia.agentChat.startNew` and binds to the
 *      newly-created session as soon as the registry attaches it.
 *
 *   2. **Active session** — a session is bound. The view forwards transcript
 *      mutations from `AgentChatSessionStore` and lifecycle changes from the
 *      registry; the composer becomes a follow-up input bar.
 *
 *   3. **Restored** — after a reload the registry is empty until the user
 *      clicks a tree row; tree clicks dispatch `gatomia.agentChat.openForSession`
 *      which calls {@link AgentChatViewProvider.focusSession} so the sidebar
 *      view rebinds without going through the legacy editor-area panel.
 *
 * Multi-session UX: only one session is bound at a time (per the spec). The
 * webview header lists every session in the registry/store and dispatches
 * `agent-chat/control/switch-session` to swap bindings; the dropdown also
 * exposes a `+ New chat` action that unbinds the view back to the empty
 * state.
 *
 * @see ui/src/features/agent-chat/index.tsx for the matching React surface.
 */

import { randomUUID } from "node:crypto";
import {
	type CancellationToken,
	type Disposable,
	type ExtensionContext,
	type WebviewView,
	type WebviewViewProvider,
	type WebviewViewResolveContext,
	commands,
	window,
} from "vscode";
import type { AgentChatRegistry } from "../features/agent-chat/agent-chat-registry";
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
import {
	type AgentChatCatalog,
	buildAgentChatCatalog,
	type AgentChatCatalogSources,
} from "../features/agent-chat/agent-chat-catalog";
import { getWebviewContent } from "../utils/get-webview-content";

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface AgentChatViewProviderOptions {
	readonly context: ExtensionContext;
	readonly store: AgentChatSessionStore;
	readonly registry: AgentChatRegistry;
	readonly catalogSources: AgentChatCatalogSources;
	/**
	 * Fired when the catalog needs to be rebroadcast (e.g. when a remote
	 * registry fetch lands or workspace agent files change). The provider
	 * snapshots the catalog inside the listener.
	 */
	readonly onCatalogChanged?: (cb: () => void) => Disposable;
	/**
	 * Optional output channel for non-fatal logging. The provider never
	 * throws on a missing channel.
	 */
	readonly outputChannel?: { appendLine(value: string): void };
}

/**
 * Public command surface invoked by `extension.ts` and the running-agents
 * tree. Hides the inner `WebviewView` machinery from callers.
 */
export interface AgentChatViewController {
	readonly viewType: string;
	/** Reveal the sidebar view (focus the GatomIA Chat container). */
	reveal(): Promise<void>;
	/** Reveal the sidebar AND bind to the given session. */
	focusSession(sessionId: string): Promise<void>;
	/** Reveal the sidebar in the empty/new-session state. */
	startNewSessionFlow(): Promise<void>;
	/** Force a catalog rebroadcast (used by remote-registry fetches). */
	pushCatalog(): void;
	/** Push the running session list to the webview. */
	pushSessionList(): void;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AgentChatViewProvider
	implements WebviewViewProvider, AgentChatViewController
{
	static readonly viewType = "gatomia.views.agentChat";

	readonly viewType = AgentChatViewProvider.viewType;

	private readonly options: AgentChatViewProviderOptions;
	private view: WebviewView | undefined;
	private readonly disposables: Disposable[] = [];
	private binding: SidebarSessionBinding | undefined;
	private pendingFocusSessionId: string | undefined;
	/**
	 * Cache of the most recent {@link AcpProviderDescriptor.probe} result
	 * per provider id. Populated asynchronously by `refreshProbes()` and
	 * fed into {@link buildAgentChatCatalog} so the picker can mark
	 * locally-installed providers as `installed` and locally-missing
	 * known agents as `install-required` regardless of `descriptor.source`.
	 */
	private readonly probeCache: Map<string, { installed: boolean }> = new Map();
	private probeRefreshInFlight: Promise<void> | undefined;

	constructor(options: AgentChatViewProviderOptions) {
		this.options = options;

		// Whenever the registry mutates we rebroadcast the session list so
		// the header dropdown stays in sync without polling.
		this.disposables.push(
			options.registry.onDidChange(() => {
				this.pushSessionList();
			})
		);
		this.disposables.push(
			options.store.onDidChangeManifest(() => {
				this.pushSessionList();
			})
		);
		if (options.onCatalogChanged) {
			this.disposables.push(
				options.onCatalogChanged(() => {
					this.pushCatalog();
				})
			);
		}
	}

	// ------------------------------------------------------------------
	// vscode.WebviewViewProvider
	// ------------------------------------------------------------------

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext,
		_token: CancellationToken
	): void | Thenable<void> {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.options.context.extensionUri],
		};
		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this.options.context.extensionUri,
			"agent-chat",
			{
				surface: "sidebar",
				// `session-id` is intentionally absent here: the sidebar
				// starts in the empty/new-session state and binds to a
				// session via `agent-chat/session/switched` once the user
				// either submits the initial prompt or picks a session
				// from the history dropdown.
			}
		);

		this.disposables.push(
			webviewView.webview.onDidReceiveMessage((message) => {
				this.handleWebviewMessage(message).catch((err) => {
					this.options.outputChannel?.appendLine(
						`[AgentChatView] message handling failed: ${err instanceof Error ? err.message : String(err)}`
					);
				});
			})
		);

		this.disposables.push(
			webviewView.onDidDispose(() => {
				this.binding?.dispose();
				this.binding = undefined;
				this.view = undefined;
			})
		);

		// Push catalog + session list eagerly so the React app does not need
		// a synthetic round-trip after `agent-chat/ready`.
		this.pushCatalog();
		this.pushSessionList();

		// Re-bind any session that was queued while the view was not yet
		// resolved (the most common case is a tree click immediately after
		// activation).
		if (this.pendingFocusSessionId) {
			const id = this.pendingFocusSessionId;
			this.pendingFocusSessionId = undefined;
			this.bindSession(id).catch((err) => {
				this.options.outputChannel?.appendLine(
					`[AgentChatView] deferred focusSession failed: ${err instanceof Error ? err.message : String(err)}`
				);
			});
		}
	}

	// ------------------------------------------------------------------
	// AgentChatViewController
	// ------------------------------------------------------------------

	async reveal(): Promise<void> {
		await commands.executeCommand("workbench.view.extension.gatomia-chat");
		// If the view exists, also bring it forward (no-op when it isn't
		// resolved yet — the workbench command above will resolve it).
		this.view?.show?.(true);
	}

	async focusSession(sessionId: string): Promise<void> {
		await this.reveal();
		if (!this.view) {
			// View was not resolved yet — `resolveWebviewView` will pick up
			// the pending id once it runs.
			this.pendingFocusSessionId = sessionId;
			return;
		}
		await this.bindSession(sessionId);
	}

	async startNewSessionFlow(): Promise<void> {
		await this.reveal();
		this.binding?.dispose();
		this.binding = undefined;
		await this.postMessage({
			type: "agent-chat/session/cleared",
			payload: { reason: "new-session-requested" },
		});
		this.pushSessionList();
	}

	pushCatalog(): void {
		if (!this.view) {
			return;
		}
		const catalog = this.snapshotCatalog();
		this.postMessage({
			type: "agent-chat/catalog/loaded",
			payload: { catalog },
		}).catch(noop);
		// Kick off (or piggy-back on) an async probe refresh so the next
		// rebroadcast can replace the optimistic source-based heuristic
		// with the real `descriptor.probe()` result.
		this.scheduleProbeRefresh();
	}

	pushSessionList(): void {
		if (!this.view) {
			return;
		}
		this.postMessage({
			type: "agent-chat/sessions/list-changed",
			payload: { sessions: this.snapshotSessionList() },
		}).catch(noop);
	}

	dispose(): void {
		this.binding?.dispose();
		this.binding = undefined;
		for (const d of this.disposables) {
			try {
				d.dispose();
			} catch {
				// best-effort
			}
		}
		this.disposables.length = 0;
	}

	// ------------------------------------------------------------------
	// Inbound webview message routing
	// ------------------------------------------------------------------

	private async handleWebviewMessage(raw: unknown): Promise<void> {
		const msg = raw as { type?: string; payload?: unknown };
		if (!msg?.type) {
			return;
		}
		switch (msg.type) {
			case "agent-chat/ready":
				this.pushCatalog();
				this.pushSessionList();
				if (this.binding) {
					await this.binding.sendSessionLoaded();
				} else {
					await this.postMessage({
						type: "agent-chat/session/cleared",
						payload: { reason: "ready-no-binding" },
					});
				}
				return;
			case "agent-chat/control/switch-session": {
				const sessionId = (msg.payload as { sessionId?: string } | undefined)
					?.sessionId;
				if (sessionId) {
					await this.bindSession(sessionId);
				}
				return;
			}
			case "agent-chat/control/new-session": {
				await this.dispatchNewSessionFromComposer(
					msg.payload as NewSessionRequestPayload | undefined
				);
				return;
			}
			case "agent-chat/control/request-new-chat": {
				await this.startNewSessionFlow();
				return;
			}
			default:
				if (this.binding) {
					await this.binding.handleWebviewMessage(msg);
				}
				return;
		}
	}

	// ------------------------------------------------------------------
	// Binding
	// ------------------------------------------------------------------

	private async bindSession(sessionId: string): Promise<void> {
		if (this.binding && this.binding.sessionId === sessionId) {
			await this.binding.sendSessionLoaded();
			return;
		}
		this.binding?.dispose();
		this.binding = undefined;

		const session =
			this.options.registry.getSession(sessionId) ??
			(await this.options.store.getSession(sessionId));
		if (!session) {
			await this.postMessage({
				type: "agent-chat/session/cleared",
				payload: { reason: "session-not-found" },
			});
			return;
		}
		// Make sure the registry knows about the session so cancel/runner
		// lookups still work after a reload.
		if (!this.options.registry.getSession(sessionId)) {
			this.options.registry.registerSession(session);
		}

		this.binding = new SidebarSessionBinding({
			session,
			store: this.options.store,
			registry: this.options.registry,
			postMessage: (m) => this.postMessage(m),
			outputChannel: this.options.outputChannel,
		});
		await this.binding.sendSessionLoaded();
		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.PANEL_OPENED, {
			sessionId: session.id,
			agentId: session.agentId,
			surface: "sidebar",
		});
	}

	private async dispatchNewSessionFromComposer(
		payload: NewSessionRequestPayload | undefined
	): Promise<void> {
		if (!payload) {
			return;
		}
		const trimmed = (payload.taskInstruction ?? "").trim();
		if (trimmed.length === 0) {
			window.showWarningMessage(
				"Type a message before starting a new agent chat session."
			);
			return;
		}
		const provider = this.findProvider(payload.providerId);
		if (!provider) {
			window.showErrorMessage(
				"Pick a provider before starting a new agent chat session."
			);
			return;
		}
		try {
			await commands.executeCommand("gatomia.agentChat.startNew", {
				agentId: provider.id,
				agentDisplayName: provider.displayName,
				agentCommand: "",
				mode: payload.modelId,
				taskInstruction: composePromptWithAgentFile(
					trimmed,
					payload.agentFileId,
					this.snapshotCatalog().agentFiles
				),
			});
			// `startNew` will register the new session and the registry
			// onDidChange listener will rebroadcast the session list. The
			// view binds to the newest session (last by createdAt) below.
			const newest = this.findNewestRegisteredSession();
			if (newest) {
				await this.bindSession(newest.id);
			}
		} catch (err) {
			this.options.outputChannel?.appendLine(
				`[AgentChatView] startNew failed: ${err instanceof Error ? err.message : String(err)}`
			);
			window.showErrorMessage(
				`Failed to start agent chat: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}

	private findProvider(
		id: string | undefined
	): AgentChatCatalog["providers"][number] | undefined {
		if (!id) {
			return;
		}
		return this.snapshotCatalog().providers.find((p) => p.id === id);
	}

	private findNewestRegisteredSession(): AgentChatSession | undefined {
		const sessions = this.options.registry.listActive();
		if (sessions.length === 0) {
			return;
		}
		return sessions.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
	}

	private snapshotCatalog(): AgentChatCatalog {
		return buildAgentChatCatalog({
			...this.options.catalogSources,
			probeCache: this.probeCache,
		});
	}

	/**
	 * Probes every registered ACP provider in parallel and stores the
	 * `installed` flag in {@link probeCache}. When at least one entry
	 * changes the catalog is rebroadcast so the picker reflects reality.
	 *
	 * Re-entrant: concurrent calls share the same in-flight promise so
	 * fast-firing events (registry update + tree click + new chat) do
	 * not spawn multiple probe storms.
	 */
	private scheduleProbeRefresh(): void {
		if (this.probeRefreshInFlight) {
			return;
		}
		this.probeRefreshInFlight = this.refreshProbes()
			.catch((err: unknown) => {
				this.options.outputChannel?.appendLine(
					`[AgentChatView] probe refresh failed: ${err instanceof Error ? err.message : String(err)}`
				);
			})
			.finally(() => {
				this.probeRefreshInFlight = undefined;
			});
	}

	private async refreshProbes(): Promise<void> {
		const registry = this.options.catalogSources.acpProviderRegistry;
		if (!registry) {
			return;
		}
		const descriptors = registry.list();
		const results = await Promise.allSettled(
			descriptors.map(async (descriptor) => {
				const probe = await descriptor.probe();
				return { id: descriptor.id, installed: probe.installed };
			})
		);
		let mutated = false;
		for (const outcome of results) {
			if (outcome.status !== "fulfilled") {
				continue;
			}
			const { id, installed } = outcome.value;
			const previous = this.probeCache.get(id);
			if (!previous || previous.installed !== installed) {
				this.probeCache.set(id, { installed });
				mutated = true;
			}
		}
		if (mutated && this.view) {
			const catalog = buildAgentChatCatalog({
				...this.options.catalogSources,
				probeCache: this.probeCache,
			});
			await this.postMessage({
				type: "agent-chat/catalog/loaded",
				payload: { catalog },
			}).catch(noop);
		}
	}

	private snapshotSessionList(): SidebarSessionListItem[] {
		const all = [
			...this.options.registry.listActive(),
			...this.options.registry.listRecent(),
		];
		const seen = new Set<string>();
		const items: SidebarSessionListItem[] = [];
		for (const session of all) {
			if (seen.has(session.id)) {
				continue;
			}
			seen.add(session.id);
			items.push({
				id: session.id,
				agentDisplayName: session.agentDisplayName,
				lifecycleState: session.lifecycleState,
				updatedAt: session.updatedAt,
				selectedModeId: session.selectedModeId,
				selectedModelId: session.selectedModelId,
				isTerminal: TERMINAL_STATES.has(session.lifecycleState),
			});
		}
		items.sort((a, b) => b.updatedAt - a.updatedAt);
		return items;
	}

	private async postMessage(message: unknown): Promise<void> {
		if (!this.view) {
			return;
		}
		try {
			await this.view.webview.postMessage(message);
		} catch (err) {
			this.options.outputChannel?.appendLine(
				`[AgentChatView] postMessage failed: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Inner: per-session binding (mirrors AgentChatPanel's session-bound subset)
// ---------------------------------------------------------------------------

interface SidebarSessionBindingOptions {
	readonly session: AgentChatSession;
	readonly store: AgentChatSessionStore;
	readonly registry: AgentChatRegistry;
	readonly postMessage: (message: unknown) => Promise<void>;
	readonly outputChannel?: { appendLine(value: string): void };
}

class SidebarSessionBinding {
	readonly sessionId: string;
	private readonly session: AgentChatSession;
	private readonly store: AgentChatSessionStore;
	private readonly registry: AgentChatRegistry;
	private readonly postMessage: (message: unknown) => Promise<void>;
	private readonly outputChannel?: { appendLine(value: string): void };
	private readonly subscriptions: Disposable[] = [];
	private readonly knownMessageIds = new Set<string>();
	private lastLifecycleState: SessionLifecycleState;
	private disposed = false;

	constructor(options: SidebarSessionBindingOptions) {
		this.session = options.session;
		this.sessionId = options.session.id;
		this.store = options.store;
		this.registry = options.registry;
		this.postMessage = options.postMessage;
		this.outputChannel = options.outputChannel;
		this.lastLifecycleState = options.session.lifecycleState;

		this.subscriptions.push(
			this.store.onDidChangeManifest(() => {
				this.onManifestChanged().catch((err) => {
					this.outputChannel?.appendLine(
						`[AgentChatView] manifest sync failed: ${err instanceof Error ? err.message : String(err)}`
					);
				});
			})
		);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		for (const d of this.subscriptions) {
			try {
				d.dispose();
			} catch {
				// best-effort
			}
		}
		this.subscriptions.length = 0;
	}

	async sendSessionLoaded(): Promise<void> {
		const current =
			(await this.store.getSession(this.sessionId)) ?? this.session;
		const transcript = this.readTranscript(current.id);
		for (const msg of transcript) {
			this.knownMessageIds.add(msg.id);
		}
		const isReadOnly = current.source === "cloud";
		await this.postMessage({
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

	async handleWebviewMessage(message: {
		type?: string;
		payload?: unknown;
	}): Promise<void> {
		switch (message.type) {
			case "agent-chat/input/submit":
				await this.handleInputSubmit(
					message.payload as {
						sessionId: string;
						content: string;
						clientMessageId?: string;
					}
				);
				return;
			case "agent-chat/control/cancel":
				await this.routeToRunner("cancel");
				return;
			case "agent-chat/control/retry":
				await this.routeToRunner("retry");
				return;
			default:
				return;
		}
	}

	private async handleInputSubmit(payload: {
		sessionId: string;
		content: string;
		clientMessageId?: string;
	}): Promise<void> {
		if (payload.sessionId !== this.sessionId) {
			return;
		}
		const current =
			(await this.store.getSession(this.sessionId)) ?? this.session;
		const userMessageId = payload.clientMessageId ?? randomUUID();
		const pendingMessage: UserChatMessage = {
			id: userMessageId,
			sessionId: this.sessionId,
			timestamp: Date.now(),
			sequence: 0,
			role: "user",
			content: payload.content,
			isInitialPrompt: false,
			deliveryStatus: "pending",
		};

		if (current.source === "cloud") {
			await this.emitMessage(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason:
					"This is a read-only cloud session. Follow-up input is not supported.",
			});
			return;
		}

		if (TERMINAL_STATES.has(current.lifecycleState)) {
			await this.emitMessage(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason: `Session is in terminal state (${current.lifecycleState}); cannot accept follow-up input.`,
			});
			return;
		}

		const runner = this.registry.getRunner(this.sessionId);
		if (!runner) {
			await this.emitMessage(pendingMessage, {
				deliveryStatus: "rejected",
				rejectionReason: "No active runner attached to this session.",
			});
			return;
		}
		await this.sendMessagesAppended([pendingMessage]);
		this.knownMessageIds.add(pendingMessage.id);

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
		const runner = this.registry.getRunner(this.sessionId);
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
				sessionId: this.sessionId,
				stage: method,
				error: err instanceof Error ? err.message : String(err),
				surface: "sidebar",
			});
		}
	}

	private async onManifestChanged(): Promise<void> {
		const current = await this.store.getSession(this.sessionId);
		if (!current) {
			return;
		}
		if (current.lifecycleState !== this.lastLifecycleState) {
			const from = this.lastLifecycleState;
			this.lastLifecycleState = current.lifecycleState;
			await this.postMessage({
				type: "agent-chat/session/lifecycle-changed",
				payload: {
					sessionId: this.sessionId,
					from,
					to: current.lifecycleState,
					at: Date.now(),
				},
			});
		}
		await this.flushTranscriptDeltas();
	}

	private async flushTranscriptDeltas(): Promise<void> {
		const transcript = this.readTranscript(this.sessionId);
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

	private async emitMessage(
		base: UserChatMessage,
		patch: Partial<UserChatMessage>
	): Promise<void> {
		await this.sendMessagesAppended([base]);
		await this.sendMessagesUpdated([{ id: base.id, patch }]);
	}

	private async sendMessagesAppended(messages: ChatMessage[]): Promise<void> {
		await this.postMessage({
			type: "agent-chat/messages/appended",
			payload: { sessionId: this.sessionId, messages },
		});
	}

	private async sendMessagesUpdated(
		updates: Array<{ id: string; patch: Partial<ChatMessage> }>
	): Promise<void> {
		await this.postMessage({
			type: "agent-chat/messages/updated",
			payload: { sessionId: this.sessionId, updates },
		});
	}

	private readTranscript(sessionId: string): ChatMessage[] {
		const key = transcriptKeyFor(sessionId);
		const mem = (
			this.store as unknown as {
				workspaceState: { get<T>(k: string): T | undefined };
			}
		).workspaceState;
		const raw = mem.get<{ messages: ChatMessage[] }>(key);
		return raw?.messages ?? [];
	}
}

// ---------------------------------------------------------------------------
// Helpers + outbound payload shapes
// ---------------------------------------------------------------------------

interface NewSessionRequestPayload {
	readonly providerId?: string;
	readonly modelId?: string;
	readonly agentFileId?: string;
	readonly taskInstruction?: string;
}

interface SidebarSessionListItem {
	readonly id: string;
	readonly agentDisplayName: string;
	readonly lifecycleState: SessionLifecycleState;
	readonly updatedAt: number;
	readonly selectedModeId?: string;
	readonly selectedModelId?: string;
	readonly isTerminal: boolean;
}

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

function computeAcceptsFollowUp(session: AgentChatSession): boolean {
	if (session.source === "cloud") {
		return false;
	}
	if (session.capabilities.source === "none") {
		return true;
	}
	return session.capabilities.acceptsFollowUp;
}

function composePromptWithAgentFile(
	prompt: string,
	agentFileId: string | undefined,
	agentFiles: AgentChatCatalog["agentFiles"]
): string {
	if (!agentFileId) {
		return prompt;
	}
	const match = agentFiles.find((entry) => entry.id === agentFileId);
	if (!match) {
		return prompt;
	}
	const reference = match.absolutePath
		? `[agent-file: ${match.displayName} — ${match.absolutePath}]`
		: `[agent-file: ${match.displayName}]`;
	return `${reference}\n\n${prompt}`;
}

function noop(): void {
	// best-effort fire-and-forget for postMessage failures
}
