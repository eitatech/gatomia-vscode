import type { Event } from "vscode";
import type { AgentChatRegistry } from "../agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../agent-chat/agent-chat-session-store";
import {
	transcriptKeyFor,
	type AgentChatSession,
	type ChatMessage,
	type SessionLifecycleState,
	type UserChatMessage,
} from "../agent-chat/types";
import type { AgentSessionStorage } from "../cloud-agents/agent-session-storage";
import type { ProviderRegistry } from "../cloud-agents/provider-registry";
import { SessionStatus, type AgentSession } from "../cloud-agents/types";

export type OrchestrationSessionSource = "agent-chat" | "cloud-agent";

export type OrchestrationSessionBucket =
	| "active"
	| "waiting"
	| "completed"
	| "failed";

export interface OrchestrationSessionProjection {
	readonly id: string;
	readonly source: OrchestrationSessionSource;
	readonly sourceSessionId: string;
	readonly title: string;
	readonly agentName: string;
	readonly state: string;
	readonly bucket: OrchestrationSessionBucket;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly endedAt?: number;
	readonly lastVisibleActivityAt: number;
	readonly isBlocked: boolean;
	readonly worktreeStatus?: string;
	readonly executionTargetLabel?: string;
	readonly externalUrl?: string;
	readonly cloudProviderId?: string;
	readonly openSessionCommand:
		| { readonly kind: "agent-chat"; readonly sessionId: string }
		| {
				readonly kind: "cloud-agent";
				readonly localId: string;
				readonly externalUrl?: string;
		  };
}

export interface OrchestrationSnapshot {
	readonly sessions: readonly OrchestrationSessionProjection[];
	readonly activeProvider:
		| {
				readonly id: string;
				readonly displayName: string;
		  }
		| undefined;
	readonly generatedAt: number;
	readonly degradedReasons: readonly string[];
}

export interface OrchestrationReadModelOptions {
	readonly store: AgentChatSessionStore;
	readonly registry: AgentChatRegistry;
	readonly cloudSessionStorage?: AgentSessionStorage;
	readonly cloudProviderRegistry?: ProviderRegistry;
	readonly agentChatStoreChangeEvent: Event<unknown>;
	readonly onCloudSessionsChanged?: (listener: () => void) => {
		dispose(): void;
	};
	readonly onCloudProviderChanged?: (listener: () => void) => {
		dispose(): void;
	};
	readonly now?: () => number;
}

export class OrchestrationReadModel {
	private readonly store: AgentChatSessionStore;
	private readonly registry: AgentChatRegistry;
	private readonly cloudSessionStorage?: AgentSessionStorage;
	private readonly cloudProviderRegistry?: ProviderRegistry;
	private readonly now: () => number;
	private readonly subscriptions: Array<{ dispose(): void }> = [];
	private readonly listeners = new Set<() => void>();

	constructor(options: OrchestrationReadModelOptions) {
		this.store = options.store;
		this.registry = options.registry;
		this.cloudSessionStorage = options.cloudSessionStorage;
		this.cloudProviderRegistry = options.cloudProviderRegistry;
		this.now = options.now ?? Date.now;

		this.subscriptions.push(
			options.agentChatStoreChangeEvent(() => {
				this.emitChanged();
			})
		);
		this.subscriptions.push(
			this.registry.onDidChange(() => {
				this.emitChanged();
			})
		);
		if (options.onCloudSessionsChanged) {
			this.subscriptions.push(
				options.onCloudSessionsChanged(() => {
					this.emitChanged();
				})
			);
		}
		if (options.onCloudProviderChanged) {
			this.subscriptions.push(
				options.onCloudProviderChanged(() => {
					this.emitChanged();
				})
			);
		}
	}

	onDidChange(listener: () => void): { dispose(): void } {
		this.listeners.add(listener);
		return {
			dispose: () => {
				this.listeners.delete(listener);
			},
		};
	}

	async snapshot(): Promise<OrchestrationSnapshot> {
		const sessions: OrchestrationSessionProjection[] = [];
		const degradedReasons: string[] = [];

		const [agentChatSessions, cloudSessions] = await Promise.all([
			this.collectAgentChatSessions(),
			this.collectCloudSessions(degradedReasons),
		]);

		sessions.push(...agentChatSessions, ...cloudSessions);
		sessions.sort(compareSessions);

		const activeProvider = this.cloudProviderRegistry?.getActive();

		return {
			sessions,
			activeProvider: activeProvider
				? {
						id: activeProvider.metadata.id,
						displayName: activeProvider.metadata.displayName,
					}
				: undefined,
			generatedAt: this.now(),
			degradedReasons,
		};
	}

	dispose(): void {
		for (const subscription of this.subscriptions) {
			try {
				subscription.dispose();
			} catch {
				// best-effort
			}
		}
		this.subscriptions.length = 0;
		this.listeners.clear();
	}

	private emitChanged(): void {
		for (const listener of [...this.listeners]) {
			try {
				listener();
			} catch {
				// best-effort
			}
		}
	}

	private async collectAgentChatSessions(): Promise<
		OrchestrationSessionProjection[]
	> {
		const [active, recent] = await Promise.all([
			this.store.listActive(),
			this.store.listRecent(),
		]);
		const byId = new Map<string, AgentChatSession>();
		for (const session of [...active, ...recent]) {
			byId.set(session.id, session);
		}
		for (const session of [
			...this.registry.listActive(),
			...this.registry.listRecent(),
		]) {
			byId.set(session.id, session);
		}
		return [...byId.values()].map((session) =>
			toAgentChatProjection(session, this.readTranscript(session.id))
		);
	}

	private async collectCloudSessions(
		degradedReasons: string[]
	): Promise<OrchestrationSessionProjection[]> {
		if (!this.cloudSessionStorage) {
			degradedReasons.push("Cloud agent session storage is unavailable.");
			return [];
		}
		const sessions = await this.cloudSessionStorage.getAll();
		return sessions.map((session) =>
			toCloudProjection(session, this.cloudProviderRegistry)
		);
	}

	private readTranscript(sessionId: string): ChatMessage[] {
		const workspaceState = (
			this.store as unknown as {
				workspaceState?: { get<T>(key: string): T | undefined };
			}
		).workspaceState;
		if (!workspaceState) {
			return [];
		}
		const raw = workspaceState.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(sessionId)
		);
		return raw?.messages ?? [];
	}
}

function toAgentChatProjection(
	session: AgentChatSession,
	transcript: readonly ChatMessage[]
): OrchestrationSessionProjection {
	const title = deriveAgentChatTitle(session, transcript);
	const lastVisibleActivityAt = deriveLastVisibleActivityAt(
		session,
		transcript
	);
	return {
		id: `agent-chat:${session.id}`,
		source: "agent-chat",
		sourceSessionId: session.id,
		title,
		agentName: session.agentDisplayName,
		state: session.lifecycleState,
		bucket: bucketForAgentChat(session.lifecycleState),
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		endedAt: session.endedAt,
		lastVisibleActivityAt,
		isBlocked: session.lifecycleState === "waiting-for-input",
		worktreeStatus: session.worktree?.status,
		executionTargetLabel: executionTargetLabel(session.executionTarget.kind),
		externalUrl: session.cloud?.externalUrl,
		cloudProviderId: session.cloud?.providerId,
		openSessionCommand: { kind: "agent-chat", sessionId: session.id },
	};
}

function toCloudProjection(
	session: AgentSession,
	providerRegistry: ProviderRegistry | undefined
): OrchestrationSessionProjection {
	const firstTask = session.tasks[0];
	const title = firstTask
		? `${firstTask.specTaskId}: ${firstTask.title}`
		: session.specPath;
	const providerDisplayName =
		providerRegistry?.get(session.providerId)?.metadata.displayName ??
		session.providerId;
	const lastVisibleActivityAt = firstTask?.startedAt ?? session.updatedAt;
	return {
		id: `cloud-agent:${session.localId}`,
		source: "cloud-agent",
		sourceSessionId: session.localId,
		title,
		agentName: providerDisplayName,
		state: session.status,
		bucket: bucketForCloud(session.status),
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		endedAt: session.completedAt,
		lastVisibleActivityAt,
		isBlocked: session.status === SessionStatus.BLOCKED,
		worktreeStatus: session.isReadOnly ? "read-only" : undefined,
		executionTargetLabel: "Cloud",
		externalUrl: session.externalUrl,
		cloudProviderId: session.providerId,
		openSessionCommand: {
			kind: "cloud-agent",
			localId: session.localId,
			externalUrl: session.externalUrl,
		},
	};
}

function deriveAgentChatTitle(
	session: AgentChatSession,
	transcript: readonly ChatMessage[]
): string {
	const promptTitle = firstUserMessageText(transcript);
	if (promptTitle) {
		return promptTitle;
	}
	if (session.selectedModeId) {
		return `${session.agentDisplayName} (${session.selectedModeId})`;
	}
	return session.agentDisplayName;
}

function deriveLastVisibleActivityAt(
	session: AgentChatSession,
	transcript: readonly ChatMessage[]
): number {
	let latest = session.updatedAt;
	for (const message of transcript) {
		if (message.timestamp > latest) {
			latest = message.timestamp;
		}
	}
	return latest;
}

function firstUserMessageText(
	transcript: readonly ChatMessage[]
): string | undefined {
	for (const message of transcript) {
		if (message.role !== "user") {
			continue;
		}
		const content = normalizePromptTitle(message);
		if (content) {
			return content;
		}
	}
	return;
}

function normalizePromptTitle(message: UserChatMessage): string | undefined {
	const text = message.content.trim().replace(/\s+/g, " ");
	return text.length > 0 ? text : undefined;
}

function bucketForAgentChat(
	state: SessionLifecycleState
): OrchestrationSessionBucket {
	if (state === "waiting-for-input") {
		return "waiting";
	}
	if (state === "completed") {
		return "completed";
	}
	if (
		state === "failed" ||
		state === "cancelled" ||
		state === "ended-by-shutdown"
	) {
		return "failed";
	}
	return "active";
}

function bucketForCloud(
	status: AgentSession["status"]
): OrchestrationSessionBucket {
	if (status === SessionStatus.BLOCKED) {
		return "waiting";
	}
	if (status === SessionStatus.COMPLETED) {
		return "completed";
	}
	if (status === SessionStatus.FAILED || status === SessionStatus.CANCELLED) {
		return "failed";
	}
	return "active";
}

function executionTargetLabel(kind: "local" | "worktree" | "cloud"): string {
	if (kind === "worktree") {
		return "Worktree";
	}
	if (kind === "cloud") {
		return "Cloud";
	}
	return "Local";
}

function compareSessions(
	a: OrchestrationSessionProjection,
	b: OrchestrationSessionProjection
): number {
	if (a.bucket !== b.bucket) {
		return bucketRank(a.bucket) - bucketRank(b.bucket);
	}
	return b.lastVisibleActivityAt - a.lastVisibleActivityAt;
}

function bucketRank(bucket: OrchestrationSessionBucket): number {
	if (bucket === "active") {
		return 0;
	}
	if (bucket === "waiting") {
		return 1;
	}
	if (bucket === "completed") {
		return 2;
	}
	return 3;
}
