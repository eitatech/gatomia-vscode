import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";
import { OrchestrationReadModel } from "../../../../src/features/orchestration/orchestration-read-model";
import type { AgentChatRegistry } from "../../../../src/features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../../../../src/features/agent-chat/agent-chat-session-store";
import {
	type AgentChatSession,
	transcriptKeyFor,
	type ChatMessage,
} from "../../../../src/features/agent-chat/types";
import type { AgentSessionStorage } from "../../../../src/features/cloud-agents/agent-session-storage";
import type { ProviderRegistry } from "../../../../src/features/cloud-agents/provider-registry";
import {
	SessionStatus,
	type AgentSession,
} from "../../../../src/features/cloud-agents/types";

function makeAgentChatSession(
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id: "agent-1",
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "OpenCode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		lifecycleState: "running",
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		createdAt: 1,
		updatedAt: 10,
		workspaceUri: "file:///workspace",
		...overrides,
	};
}

function makeCloudSession(overrides: Partial<AgentSession> = {}): AgentSession {
	return {
		localId: "cloud-1",
		providerId: "devin",
		providerSessionId: "provider-1",
		status: SessionStatus.RUNNING,
		branch: "feature/test",
		specPath: "specs/001/tasks.md",
		tasks: [],
		pullRequests: [],
		createdAt: 2,
		updatedAt: 20,
		completedAt: undefined,
		isReadOnly: false,
		...overrides,
	};
}

describe("OrchestrationReadModel", () => {
	it("merges agent-chat and cloud sessions into grouped projections", async () => {
		const storeEmitter = new EventEmitter<unknown>();
		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([makeAgentChatSession()]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			cloudSessionStorage: {
				getAll: () =>
					Promise.resolve([
						makeCloudSession({ status: SessionStatus.BLOCKED }),
					]),
			} as unknown as AgentSessionStorage,
			cloudProviderRegistry: {
				getAll: () => [{ metadata: { id: "devin", displayName: "Devin" } }],
				getActive: () => ({
					metadata: { id: "devin", displayName: "Devin" },
				}),
				get: (id: string) =>
					id === "devin"
						? { metadata: { id: "devin", displayName: "Devin" } }
						: undefined,
			} as unknown as ProviderRegistry,
			agentChatStoreChangeEvent: storeEmitter.event,
		});

		const snapshot = await model.snapshot();

		expect(snapshot.sessions).toHaveLength(2);
		expect(snapshot.cloudProviderRegistryAvailable).toBe(true);
		expect(snapshot.cloudProviderCount).toBe(1);
		expect(snapshot.sessions[0]).toMatchObject({
			source: "agent-chat",
			bucket: "active",
		});
		expect(snapshot.sessions[1]).toMatchObject({
			source: "cloud-agent",
			bucket: "waiting",
			agentName: "Devin",
		});
		expect(snapshot.activeProvider).toEqual({
			id: "devin",
			displayName: "Devin",
		});
	});

	it("normalizes lifecycle buckets and sorts sessions by bucket then activity", async () => {
		const model = new OrchestrationReadModel({
			store: {
				listActive: () =>
					Promise.resolve([
						makeAgentChatSession({
							id: "agent-running",
							updatedAt: 30,
							lifecycleState: "running",
						}),
						makeAgentChatSession({
							id: "agent-failed",
							updatedAt: 15,
							lifecycleState: "failed",
						}),
					]),
				listRecent: () =>
					Promise.resolve([
						makeAgentChatSession({
							id: "agent-completed",
							updatedAt: 12,
							lifecycleState: "completed",
						}),
					]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: new EventEmitter<unknown>().event,
			cloudSessionStorage: {
				getAll: () =>
					Promise.resolve([
						makeCloudSession({
							localId: "cloud-running",
							status: SessionStatus.RUNNING,
							updatedAt: 40,
						}),
						makeCloudSession({
							localId: "cloud-blocked",
							status: SessionStatus.BLOCKED,
							updatedAt: 25,
						}),
						makeCloudSession({
							localId: "cloud-completed",
							status: SessionStatus.COMPLETED,
							updatedAt: 22,
						}),
						makeCloudSession({
							localId: "cloud-cancelled",
							status: SessionStatus.CANCELLED,
							updatedAt: 18,
						}),
					]),
			} as unknown as AgentSessionStorage,
			cloudProviderRegistry: {
				getAll: () => [{ metadata: { id: "devin", displayName: "Devin" } }],
				getActive: () => ({
					metadata: { id: "devin", displayName: "Devin" },
				}),
				get: () => ({
					metadata: { id: "devin", displayName: "Devin" },
				}),
			} as unknown as ProviderRegistry,
		});

		const snapshot = await model.snapshot();

		expect(
			snapshot.sessions.map((session) => [
				session.sourceSessionId,
				session.bucket,
			])
		).toEqual([
			["cloud-running", "active"],
			["agent-running", "active"],
			["cloud-blocked", "waiting"],
			["cloud-completed", "completed"],
			["agent-completed", "completed"],
			["cloud-cancelled", "failed"],
			["agent-failed", "failed"],
		]);
	});

	it("prefers live registry sessions and derives title plus last activity from transcript data", async () => {
		const storeSession = makeAgentChatSession({
			id: "agent-live",
			updatedAt: 10,
			lifecycleState: "running",
			selectedModeId: "code",
		});
		const registrySession = makeAgentChatSession({
			id: "agent-live",
			updatedAt: 20,
			lifecycleState: "waiting-for-input",
			selectedModeId: "code",
			executionTarget: { kind: "worktree", worktreeId: "wt-1" },
			worktree: {
				id: "wt-1",
				absolutePath: "/tmp/wt-1",
				branchName: "gatomia/agent-live",
				baseCommitSha: "abc123",
				status: "in-use",
				createdAt: 1,
			},
		});
		const transcript: ChatMessage[] = [
			{
				id: "msg-1",
				sessionId: "agent-live",
				timestamp: 30,
				sequence: 0,
				role: "user",
				content:
					"Investigate the orchestration refresh race in the sidebar view.",
				isInitialPrompt: true,
				deliveryStatus: "delivered",
			},
		];

		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([storeSession]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: (key: string) =>
						key === transcriptKeyFor("agent-live")
							? { messages: transcript }
							: undefined,
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [registrySession],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: new EventEmitter<unknown>().event,
			cloudSessionStorage: {
				getAll: () => Promise.resolve([]),
			} as unknown as AgentSessionStorage,
		});

		const snapshot = await model.snapshot();
		const [session] = snapshot.sessions;

		expect(snapshot.sessions).toHaveLength(1);
		expect(session).toMatchObject({
			source: "agent-chat",
			sourceSessionId: "agent-live",
			state: "waiting-for-input",
			bucket: "waiting",
			isBlocked: true,
			worktreeStatus: "in-use",
			executionTargetLabel: "Worktree",
			updatedAt: 20,
			lastVisibleActivityAt: 30,
			title: "Investigate the orchestration refresh race in the sidebar view.",
		});
	});

	it("reports degraded state when cloud storage is unavailable", async () => {
		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: new EventEmitter<unknown>().event,
		});

		const snapshot = await model.snapshot();

		expect(snapshot.sessions).toEqual([]);
		expect(snapshot.degradedReasons).toContain(
			"Cloud agent session storage is unavailable."
		);
		expect(snapshot.degradedReasons).toContain(
			"Cloud agent provider wiring is unavailable. Open Agent Chat or refresh Cloud Agents after the provider surface is restored."
		);
		expect(snapshot.cloudProviderRegistryAvailable).toBe(false);
		expect(snapshot.cloudProviderCount).toBe(0);
	});

	it("reports degraded state when cloud status reads fail or no provider is active", async () => {
		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: new EventEmitter<unknown>().event,
			cloudSessionStorage: {
				getAll: () => Promise.reject(new Error("boom")),
			} as unknown as AgentSessionStorage,
			cloudProviderRegistry: {
				getAll: () => [{ metadata: { id: "devin", displayName: "Devin" } }],
				getActive: () => null,
				get: () => null,
			} as unknown as ProviderRegistry,
		});

		const snapshot = await model.snapshot();

		expect(snapshot.sessions).toEqual([]);
		expect(snapshot.cloudProviderRegistryAvailable).toBe(true);
		expect(snapshot.cloudProviderCount).toBe(1);
		expect(snapshot.degradedReasons).toContain(
			"Cloud agent status could not be read."
		);
	});

	it("emits change notifications for store, registry, and cloud updates until disposed", () => {
		const storeEmitter = new EventEmitter<unknown>();
		const registryEmitter = new EventEmitter<void>();
		const cloudSessionsEmitter = new EventEmitter<void>();
		const cloudProviderEmitter = new EventEmitter<void>();
		const listener = vi.fn();

		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: registryEmitter.event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: storeEmitter.event,
			onCloudSessionsChanged: (callback) =>
				cloudSessionsEmitter.event(callback),
			onCloudProviderChanged: (callback) =>
				cloudProviderEmitter.event(callback),
		});

		model.onDidChange(listener);

		storeEmitter.fire(undefined);
		registryEmitter.fire();
		cloudSessionsEmitter.fire();
		cloudProviderEmitter.fire();

		expect(listener).toHaveBeenCalledTimes(4);

		model.dispose();
		storeEmitter.fire(undefined);
		registryEmitter.fire();
		cloudSessionsEmitter.fire();
		cloudProviderEmitter.fire();

		expect(listener).toHaveBeenCalledTimes(4);
	});

	it("falls back to provider id and spec path when cloud session details are minimal", async () => {
		const model = new OrchestrationReadModel({
			store: {
				listActive: () => Promise.resolve([]),
				listRecent: () => Promise.resolve([]),
				workspaceState: {
					get: () => {
						return;
					},
				},
			} as unknown as AgentChatSessionStore,
			registry: {
				onDidChange: new EventEmitter<void>().event,
				listActive: () => [],
				listRecent: () => [],
			} as unknown as AgentChatRegistry,
			agentChatStoreChangeEvent: new EventEmitter<unknown>().event,
			cloudSessionStorage: {
				getAll: () =>
					Promise.resolve([
						makeCloudSession({
							localId: "cloud-minimal",
							providerId: "custom-provider",
							specPath: "specs/018-agent-chat-panel/tasks.md",
							tasks: [],
							status: SessionStatus.COMPLETED,
							completedAt: 33,
							isReadOnly: true,
						}),
					]),
			} as unknown as AgentSessionStorage,
			cloudProviderRegistry: {
				getAll: () => [{ metadata: { id: "devin", displayName: "Devin" } }],
				getActive: () => {
					return;
				},
				get: () => {
					return;
				},
			} as unknown as ProviderRegistry,
		});

		const snapshot = await model.snapshot();
		const [session] = snapshot.sessions;

		expect(session).toMatchObject({
			source: "cloud-agent",
			sourceSessionId: "cloud-minimal",
			title: "specs/018-agent-chat-panel/tasks.md",
			agentName: "custom-provider",
			bucket: "completed",
			endedAt: 33,
			worktreeStatus: "read-only",
			executionTargetLabel: "Cloud",
		});
	});
});
