import { describe, expect, it } from "vitest";
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
			"Cloud agent providers are unavailable."
		);
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
		expect(snapshot.degradedReasons).toContain(
			"Cloud agent status could not be read."
		);
		expect(snapshot.degradedReasons).toContain(
			"No active cloud agent provider is selected."
		);
	});
});
