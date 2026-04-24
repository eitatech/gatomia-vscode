/**
 * Integration test: multi-session concurrent monitoring (T072, spec 018 US4).
 *
 * Scenarios covered:
 *   1. Three simultaneous ACP sessions render under the Active group and each
 *      carries the right `agent · mode · target · status` description.
 *   2. A session in `waiting-for-input` is visibly flagged `(blocked)` per
 *      spec US4 acceptance scenario 2 (T071).
 *   3. Lifecycle transitions propagate to the tree: changing a session's
 *      state from `running` → `completed` moves it from Active to Recent and
 *      fires `onDidChangeTreeData` so the UI refreshes without a manual reload.
 *   4. Per-session transcripts remain isolated: appending a message to one
 *      session does not mutate any other session's transcript (SC-009).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	type AgentChatArchiveWriter,
	type AgentChatMemento,
	AgentChatSessionStore,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import {
	type AgentChatSession,
	type ChatMessage,
	type UserChatMessage,
	transcriptKeyFor,
} from "../../../src/features/agent-chat/types";
import {
	RunningAgentsTreeProvider,
	type RunningAgentsTreeItem,
} from "../../../src/providers/running-agents-tree-provider";

// -- Fakes -------------------------------------------------------------------

function createMemento(): AgentChatMemento {
	const map = new Map<string, unknown>();
	return {
		get: <T>(key: string, defaultValue?: T): T | undefined =>
			map.has(key) ? (map.get(key) as T) : defaultValue,
		update: (key, value) => {
			if (value === undefined) {
				map.delete(key);
			} else {
				map.set(key, value);
			}
			return Promise.resolve();
		},
		keys: () => [...map.keys()],
	};
}

function createArchive(): AgentChatArchiveWriter {
	return {
		appendLines: () => Promise.resolve("archive.jsonl") as never,
		readLines: () => Promise.resolve([] as ChatMessage[]) as never,
	};
}

function seedSession(
	store: AgentChatSessionStore,
	overrides: Parameters<AgentChatSessionStore["createSession"]>[0]
): Promise<AgentChatSession> {
	return store.createSession(overrides);
}

// -- Regex ------------------------------------------------------------------

const BLOCKED_RE = /\(blocked\)/;
const LOCAL_RE = /local/;
const WORKTREE_RE = /worktree/;
const CLOUD_RE = /cloud/;

// ---------------------------------------------------------------------------

describe("multi-session concurrent monitoring (T072)", () => {
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let provider: RunningAgentsTreeProvider;
	let memento: AgentChatMemento;

	beforeEach(async () => {
		memento = createMemento();
		store = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await store.initialize();
		registry = new AgentChatRegistry();
		provider = new RunningAgentsTreeProvider({
			store,
			registry,
			storeChangeEvent: store.onDidChangeManifest,
		});
	});

	it("renders three simultaneous sessions with distinct targets and flags the blocked one", async () => {
		const codeRun = await seedSession(store, {
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "worktree", worktreeId: "wt-1" },
			trigger: { kind: "user" },
			worktree: {
				id: "wt-1",
				absolutePath: "/tmp/worktree-1",
				branchName: "gatomia/agent-chat/code-run",
				baseCommitSha: "abc",
				createdAt: 1,
				status: "in-use",
			},
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		const planRun = await seedSession(store, {
			source: "acp",
			agentId: "claude",
			agentDisplayName: "Claude",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		const cloudRun = await seedSession(store, {
			source: "cloud",
			agentId: "devin",
			agentDisplayName: "Devin",
			capabilities: { source: "none" },
			executionTarget: {
				kind: "cloud",
				providerId: "devin",
				cloudSessionId: "rs-1",
			},
			trigger: { kind: "user" },
			worktree: null,
			cloud: { providerId: "devin", cloudSessionLocalId: "rs-1" },
			workspaceUri: "file:///fake/workspace",
		});

		// Transition one session into waiting-for-input to exercise the
		// blocked flag (T071).
		await store.updateSession(planRun.id, {
			lifecycleState: "waiting-for-input",
		});

		const [activeGroup] = await provider.getChildren();
		const leaves = await provider.getChildren(activeGroup);

		const ids = leaves.map((l: RunningAgentsTreeItem) => l.sessionId).sort();
		expect(ids).toEqual([codeRun.id, planRun.id, cloudRun.id].sort());

		const byId = new Map(
			leaves.map((l: RunningAgentsTreeItem) => [l.sessionId, l])
		);
		expect(String(byId.get(codeRun.id)?.description ?? "")).toMatch(
			WORKTREE_RE
		);
		expect(String(byId.get(planRun.id)?.description ?? "")).toMatch(LOCAL_RE);
		expect(String(byId.get(planRun.id)?.description ?? "")).toMatch(BLOCKED_RE);
		expect(String(byId.get(cloudRun.id)?.description ?? "")).toMatch(CLOUD_RE);
	});

	it("propagates lifecycle transitions from the store to the tree (Active → Recent)", async () => {
		const a = await seedSession(store, {
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});

		// Subscribe to the tree refresh signal.
		const refresh = vi.fn();
		provider.onDidChangeTreeData(refresh);

		// Before: session is Active.
		let [activeGroup, recentGroup] = await provider.getChildren();
		let activeLeaves = await provider.getChildren(activeGroup);
		let recentLeaves = await provider.getChildren(recentGroup);
		expect(activeLeaves.map((l: RunningAgentsTreeItem) => l.sessionId)).toEqual(
			[a.id]
		);
		expect(recentLeaves).toHaveLength(0);

		// Transition: running → completed.
		await store.updateSession(a.id, { lifecycleState: "completed" });

		// After: session moved to Recent and the tree refresh fired.
		expect(refresh).toHaveBeenCalled();
		[activeGroup, recentGroup] = await provider.getChildren();
		activeLeaves = await provider.getChildren(activeGroup);
		recentLeaves = await provider.getChildren(recentGroup);
		expect(activeLeaves).toHaveLength(0);
		expect(recentLeaves.map((l: RunningAgentsTreeItem) => l.sessionId)).toEqual(
			[a.id]
		);
	});

	it("keeps per-session transcripts isolated when messages are appended to one session (SC-009)", async () => {
		const a = await seedSession(store, {
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		const b = await seedSession(store, {
			source: "acp",
			agentId: "claude",
			agentDisplayName: "Claude",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});

		const makeMsg = (
			id: string,
			sessionId: string,
			content: string
		): UserChatMessage => ({
			id,
			sessionId,
			role: "user",
			content,
			isInitialPrompt: true,
			deliveryStatus: "delivered",
			timestamp: Date.now(),
			sequence: 0,
		});

		await store.appendMessages(a.id, [makeMsg("m-a-1", a.id, "hello from A")]);
		await store.appendMessages(b.id, [makeMsg("m-b-1", b.id, "hello from B")]);

		const aTranscript =
			memento.get<{ messages: ChatMessage[] }>(transcriptKeyFor(a.id))
				?.messages ?? [];
		const bTranscript =
			memento.get<{ messages: ChatMessage[] }>(transcriptKeyFor(b.id))
				?.messages ?? [];
		expect(aTranscript.map((m) => m.id)).toEqual(["m-a-1"]);
		expect(bTranscript.map((m) => m.id)).toEqual(["m-b-1"]);
	});
});
