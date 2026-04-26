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
	ConfigurationTarget,
	type Disposable,
	type ExtensionContext,
	type WebviewView,
	type WebviewViewProvider,
	type WebviewViewResolveContext,
	commands,
	window,
	workspace,
} from "vscode";
import type { PendingWriteSnapshot } from "../features/agent-chat/acp-chat-runner";
import type { AgentChatRegistry } from "../features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../features/agent-chat/agent-chat-session-store";
import type {
	DiscoveredModels,
	ModelDiscoveryService,
} from "../features/agent-chat/model-discovery-service";
import {
	AGENT_CHAT_TELEMETRY_EVENTS,
	logTelemetry,
} from "../features/agent-chat/telemetry";
import {
	type AgentChatEvent,
	type AgentChatSession,
	type ChatMessage,
	type ModelDescriptor,
	type SessionLifecycleState,
	TERMINAL_STATES,
	transcriptKeyFor,
	type UserChatMessage,
} from "../features/agent-chat/types";
import {
	type AgentChatCatalog,
	buildAgentChatCatalog,
	type AgentChatCatalogSources,
	type AgentChatProviderOption,
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
	 * Optional discovery service used to overlay dynamic per-provider
	 * model lists onto the static catalog. When omitted (e.g. in unit
	 * tests) the provider falls back to the catalog-only behaviour.
	 */
	readonly modelDiscovery?: ModelDiscoveryService;
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
	/**
	 * Push the current `gatomia.acp.permissionDefault` value to the
	 * webview. Used both eagerly (on resolve) and reactively whenever
	 * `onDidChangeConfiguration` fires for the key.
	 */
	pushPermissionDefault(): void;
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

	/** Per-provider in-flight probe markers, surfaced to the webview via `catalog/loaded`. */
	private readonly modelsLoading = new Map<string, boolean>();

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

		// Re-broadcast the permission default whenever the user (or this
		// extension itself, via the chat UI) mutates the setting. The
		// in-process `AcpSessionManager` is updated separately in
		// `extension.ts`; this listener only handles the webview state.
		this.disposables.push(
			workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("gatomia.acp.permissionDefault")) {
					this.pushPermissionDefault();
				}
			})
		);

		// Whenever a provider's dynamic model list lands (or refreshes),
		// rebroadcast the catalog so the picker `<select>` switches from
		// the loading placeholder to the real list. Also clear the
		// in-flight marker for that provider.
		if (options.modelDiscovery) {
			this.disposables.push(
				options.modelDiscovery.onDidChange((evt) => {
					this.modelsLoading.delete(evt.providerId);
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
		this.pushPermissionDefault();

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
			payload: {
				catalog,
				modelsLoading: this.snapshotModelsLoading(),
			},
		}).catch(noop);
		// Kick off (or piggy-back on) an async probe refresh so the next
		// rebroadcast can replace the optimistic source-based heuristic
		// with the real `descriptor.probe()` result.
		this.scheduleProbeRefresh();
	}

	/**
	 * Build the per-provider `modelsLoading` map shipped with every
	 * `agent-chat/catalog/loaded` payload so the webview can render a
	 * loading placeholder while a probe is in flight.
	 */
	private snapshotModelsLoading(): Record<string, boolean> {
		const out: Record<string, boolean> = {};
		for (const [providerId, loading] of this.modelsLoading) {
			if (loading) {
				out[providerId] = true;
			}
		}
		return out;
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

	pushPermissionDefault(): void {
		if (!this.view) {
			return;
		}
		this.postMessage({
			type: "agent-chat/permission-default/changed",
			payload: { mode: readPermissionDefaultFromConfig() },
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
				this.pushPermissionDefault();
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
			case "agent-chat/control/change-permission-default": {
				await this.handleChangePermissionDefault(
					msg.payload as { mode?: string } | undefined
				);
				return;
			}
			case "agent-chat/control/probe-models": {
				const providerId = (msg.payload as { providerId?: string } | undefined)
					?.providerId;
				if (providerId) {
					this.triggerModelProbe(providerId, { invalidate: true });
				}
				return;
			}
			default:
				if (this.binding) {
					await this.binding.handleWebviewMessage(msg);
				}
				return;
		}
	}

	/**
	 * Kick off a {@link ModelDiscoveryService.getModels} probe for a
	 * provider, marking the per-provider loading state and rebroadcasting
	 * the catalog so the webview can render the placeholder while the
	 * probe is in flight. When `invalidate` is true the cached entry is
	 * discarded first so the user-facing refresh button always re-queries
	 * the agent.
	 */
	private triggerModelProbe(
		providerId: string,
		opts: { invalidate?: boolean } = {}
	): void {
		const discovery = this.options.modelDiscovery;
		if (!discovery) {
			return;
		}
		if (opts.invalidate) {
			discovery.invalidate(providerId);
		}
		this.modelsLoading.set(providerId, true);
		this.pushCatalog();
		discovery
			.getModels(providerId)
			.catch((err: unknown) => {
				this.options.outputChannel?.appendLine(
					`[AgentChatView] model probe failed for ${providerId}: ${
						err instanceof Error ? err.message : String(err)
					}`
				);
			})
			.finally(() => {
				this.modelsLoading.delete(providerId);
				// `onDidChange` already rebroadcasts the catalog on success;
				// we only force a push here to clear the loading marker
				// when the probe rejects without firing a change event.
				if (this.view) {
					this.pushCatalog();
				}
			});
	}

	/**
	 * Persists the requested permission default to the global VS Code
	 * configuration. The change-of-config listener registered above will
	 * pick up the update and rebroadcast `permission-default/changed`,
	 * keeping the webview in sync without a manual round-trip from here.
	 *
	 * Unknown / malformed values are ignored — the webview remains
	 * authoritative for its own UX state.
	 */
	private async handleChangePermissionDefault(
		payload: { mode?: string } | undefined
	): Promise<void> {
		const mode = payload?.mode;
		if (mode !== "ask" && mode !== "allow" && mode !== "deny") {
			return;
		}
		try {
			await workspace
				.getConfiguration("gatomia")
				.update("acp.permissionDefault", mode, ConfigurationTarget.Global);
		} catch (err) {
			this.options.outputChannel?.appendLine(
				`[AgentChatView] permissionDefault update failed: ${err instanceof Error ? err.message : String(err)}`
			);
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
		const baseCatalog = buildAgentChatCatalog({
			...this.options.catalogSources,
			probeCache: this.probeCache,
		});
		const discovery = this.options.modelDiscovery;
		if (!discovery) {
			return baseCatalog;
		}
		const projectedProviders = baseCatalog.providers.map((provider) =>
			this.applyDiscoveredModels(provider, discovery.peek(provider.id))
		);
		return { ...baseCatalog, providers: projectedProviders };
	}

	/**
	 * Overlay a {@link DiscoveredModels} cache hit on top of a static
	 * catalog projection. When the source is `"vscode-lm"` or
	 * `"agent"` we replace the static models entirely; `"catalog"` and
	 * `"none"` defer to the catalog snapshot the picker already had.
	 */
	private applyDiscoveredModels(
		provider: AgentChatProviderOption,
		discovered: DiscoveredModels | undefined
	): AgentChatProviderOption {
		if (!discovered) {
			return provider;
		}
		if (discovered.source === "vscode-lm" || discovered.source === "agent") {
			return { ...provider, models: discovered.models as ModelDescriptor[] };
		}
		if (discovered.source === "none") {
			// Honour the redesign: when no source has any models, the
			// picker hides the `<select>` entirely. We pass an empty
			// list so the webview can detect the empty state.
			return { ...provider, models: [] };
		}
		// `catalog` — keep the static list the base projector already used.
		return provider;
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
				title: this.deriveSessionTitle(session.id),
			});
		}
		items.sort((a, b) => b.updatedAt - a.updatedAt);
		return items;
	}

	/**
	 * Look up the first {@link UserChatMessage} of a session and return a
	 * truncated label suitable for the sidebar history list. Returns
	 * `undefined` when no user message has been recorded yet.
	 */
	private deriveSessionTitle(sessionId: string): string | undefined {
		const transcript = this.readTranscriptForSession(sessionId);
		for (const message of transcript) {
			if (message.role === "user" && typeof message.content === "string") {
				const text = message.content.trim().replace(/\s+/g, " ");
				if (text.length === 0) {
					continue;
				}
				return text.length > SESSION_TITLE_MAX_LENGTH
					? `${text.slice(0, SESSION_TITLE_MAX_LENGTH - 1).trimEnd()}\u2026`
					: text;
			}
		}
		return;
	}

	/**
	 * Read the persisted transcript for `sessionId` straight from the
	 * store's workspaceState. Mirrors {@link SidebarSessionBinding.readTranscript}
	 * but lives at the provider level so {@link snapshotSessionList} can
	 * peek at sessions that are not bound to the active webview.
	 */
	private readTranscriptForSession(sessionId: string): ChatMessage[] {
		const key = transcriptKeyFor(sessionId);
		const mem = (
			this.options.store as unknown as {
				workspaceState?: { get<T>(k: string): T | undefined };
			}
		).workspaceState;
		if (!mem) {
			return [];
		}
		const raw = mem.get<{ messages: ChatMessage[] }>(key);
		return raw?.messages ?? [];
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
	private lastAvailableModelIds: string[] = [];
	private lastCurrentModelId: string | undefined;
	private disposed = false;

	constructor(options: SidebarSessionBindingOptions) {
		this.session = options.session;
		this.sessionId = options.session.id;
		this.store = options.store;
		this.registry = options.registry;
		this.postMessage = options.postMessage;
		this.outputChannel = options.outputChannel;
		this.lastLifecycleState = options.session.lifecycleState;
		this.lastAvailableModelIds = (options.session.availableModels ?? []).map(
			(m) => m.id
		);
		this.lastCurrentModelId =
			options.session.currentModelId ?? options.session.selectedModelId;

		this.subscriptions.push(
			this.store.onDidChangeManifest(() => {
				this.onManifestChanged().catch((err) => {
					this.outputChannel?.appendLine(
						`[AgentChatView] manifest sync failed: ${err instanceof Error ? err.message : String(err)}`
					);
				});
			})
		);

		// Phase 4 — wire the runner's pending-writes feed (if it
		// exposes one) to the webview so the Cursor-style Accept/Reject
		// bar can mirror the in-flight `writeTextFile` queue.
		const runner = this.registry.getRunner(this.sessionId) as
			| {
					onPendingWritesChanged?: (
						listener: (writes: readonly PendingWriteSnapshot[]) => void
					) => Disposable;
					onEvent?: (listener: (event: AgentChatEvent) => void) => Disposable;
			  }
			| undefined;
		const subscribe = runner?.onPendingWritesChanged;
		if (subscribe) {
			this.subscriptions.push(
				subscribe.call(runner, (writes) => {
					this.sendPendingWrites(writes).catch((err) => {
						this.outputChannel?.appendLine(
							`[AgentChatView] pending-writes push failed: ${err instanceof Error ? err.message : String(err)}`
						);
					});
				})
			);
		}
	}

	/**
	 * Forward an `AgentChatEvent` to the webview. Currently scoped to
	 * the `session/models-changed` variant — the runner emits this when
	 * the agent surfaces a new {@link AcpSessionModelState}, which the
	 * webview consumes to refresh the model chip without a full
	 * `session/loaded` round-trip.
	 */
	async sendModelsChanged(event: {
		availableModels: ReadonlyArray<{
			id: string;
			displayName: string;
			invocation: "initial-prompt" | "cli-flag";
			invocationTemplate?: string;
		}>;
		currentModelId: string;
	}): Promise<void> {
		await this.postMessage({
			type: "agent-chat/session/models-changed",
			payload: {
				sessionId: this.sessionId,
				availableModels: event.availableModels,
				currentModelId: event.currentModelId,
			},
		});
	}

	private async sendPendingWrites(
		writes: readonly PendingWriteSnapshot[]
	): Promise<void> {
		await this.postMessage({
			type: "agent-chat/pending-writes/changed",
			payload: {
				sessionId: this.sessionId,
				writes: writes.map((w) => ({
					id: w.id,
					path: w.path,
					linesAdded: w.linesAdded ?? 0,
					linesRemoved: w.linesRemoved ?? 0,
					languageId: w.languageId,
				})),
			},
		});
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
		const availableModels = current.availableModels ?? [];
		const currentModelId = current.currentModelId ?? current.selectedModelId;
		await this.postMessage({
			type: "agent-chat/session/loaded",
			payload: {
				session: {
					id: current.id,
					source: current.source,
					agentId: current.agentId,
					agentDisplayName: current.agentDisplayName,
					selectedModeId: current.selectedModeId,
					selectedModelId: current.selectedModelId,
					availableModels,
					currentModelId,
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
				availableModels,
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
			case "agent-chat/pending-writes/accept-all":
				this.flushPendingWrites({ kind: "accept-all" });
				return;
			case "agent-chat/pending-writes/reject-all":
				this.flushPendingWrites({ kind: "reject-all" });
				return;
			case "agent-chat/pending-writes/accept-one":
				this.flushPendingWrites({
					kind: "accept-one",
					id: (message.payload as { id?: string } | undefined)?.id ?? "",
				});
				return;
			case "agent-chat/pending-writes/reject-one":
				this.flushPendingWrites({
					kind: "reject-one",
					id: (message.payload as { id?: string } | undefined)?.id ?? "",
				});
				return;
			default:
				return;
		}
	}

	/**
	 * Forwards an Accept/Reject decision to the runner. The runner owns
	 * the manager reference and translates the action into a flush on
	 * the underlying ACP client's pending-writes store.
	 */
	private flushPendingWrites(action: {
		kind: "accept-all" | "reject-all" | "accept-one" | "reject-one";
		id?: string;
	}): void {
		const runner = this.registry.getRunner(this.sessionId) as
			| {
					flushPendingWrites?: (a: typeof action) => void;
			  }
			| undefined;
		runner?.flushPendingWrites?.(action);
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
		await this.maybePushModelsChanged(current);
		await this.flushTranscriptDeltas();
	}

	/**
	 * Detect changes to the session's `availableModels` / `currentModelId`
	 * payload and forward them to the webview via
	 * `agent-chat/session/models-changed`. The runner persists the new
	 * state through the store, which fires `onDidChangeManifest`; this
	 * binding then diffs the snapshot to avoid spurious posts.
	 */
	private async maybePushModelsChanged(
		current: AgentChatSession
	): Promise<void> {
		const nextIds = (current.availableModels ?? []).map((m) => m.id);
		const nextCurrent = current.currentModelId ?? current.selectedModelId;
		const idsChanged =
			nextIds.length !== this.lastAvailableModelIds.length ||
			nextIds.some((id, idx) => this.lastAvailableModelIds[idx] !== id);
		const currentChanged = nextCurrent !== this.lastCurrentModelId;
		if (!(idsChanged || currentChanged)) {
			return;
		}
		this.lastAvailableModelIds = nextIds;
		this.lastCurrentModelId = nextCurrent;
		await this.sendModelsChanged({
			availableModels: current.availableModels ?? [],
			currentModelId: nextCurrent ?? "",
		});
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
	/**
	 * Short, human-readable label derived from the session's first user
	 * prompt. Falls back to `agentDisplayName` in the webview when this
	 * is `undefined` (no user message has been recorded yet).
	 */
	readonly title?: string;
}

/** Maximum length of the derived `title` field (characters). */
const SESSION_TITLE_MAX_LENGTH = 60;

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

/**
 * Mirrors `extension.ts#readPermissionDefault`. Kept local so the view
 * provider can broadcast the value without importing extension internals.
 */
function readPermissionDefaultFromConfig(): "ask" | "allow" | "deny" {
	const raw = workspace
		.getConfiguration("gatomia")
		.get<string>("acp.permissionDefault", "ask");
	if (raw === "allow" || raw === "deny") {
		return raw;
	}
	return "ask";
}
