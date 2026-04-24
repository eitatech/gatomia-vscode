/**
 * RunningAgentsTreeProvider unit tests (T042, spec 018).
 *
 * TDD (Constitution III): red before T044.
 *
 * Contract coverage:
 *   - Root level emits three groups ("Active", "Recent", "Orphaned worktrees").
 *   - Active group lists sessions with non-terminal lifecycle state.
 *   - Recent group lists sessions with terminal lifecycle state.
 *   - Leaves carry `agent · mode · target · status` metadata + a click command
 *     targeting `gatomia.agentChat.openForSession`.
 *   - Worktree-backed sessions carry a `*-worktree` contextValue so the
 *     view/item/context menu can expose "Clean up worktree".
 *   - The provider refreshes when `AgentChatSessionStore.onDidChangeManifest`
 *     or `AgentChatRegistry.onDidChange` fires.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter, TreeItemCollapsibleState } from "vscode";
import type { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../../../src/features/agent-chat/agent-chat-session-store";
import {
	RunningAgentsTreeProvider,
	type RunningAgentsTreeItem,
} from "../../../src/providers/running-agents-tree-provider";
import type {
	AgentChatSession,
	OrphanedWorktreeEntry,
	SessionManifest,
} from "../../../src/features/agent-chat/types";

// Top-level regexes (biome lint/performance/useTopLevelRegex).
const MODE_RE = /code/;
const TARGET_RE = /local/;
const STATUS_RE = /waiting-for-input/;
const PATH_RE = /tmp\/worktree-1/;

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeSession(
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id: "session-a",
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "OpenCode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		lifecycleState: "running",
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		createdAt: 1000,
		updatedAt: 1000,
		workspaceUri: "file:///fake/workspace",
		...overrides,
	};
}

interface FakeStore {
	manifestEmitter: EventEmitter<SessionManifest>;
	active: AgentChatSession[];
	recent: AgentChatSession[];
	orphans: OrphanedWorktreeEntry[];
	listActive(): Promise<AgentChatSession[]>;
	listRecent(): Promise<AgentChatSession[]>;
	listOrphanedWorktrees(): Promise<OrphanedWorktreeEntry[]>;
}

function createFakeStore(): FakeStore {
	const manifestEmitter = new EventEmitter<SessionManifest>();
	const fake: FakeStore = {
		manifestEmitter,
		active: [],
		recent: [],
		orphans: [],
		listActive: () => Promise.resolve(fake.active),
		listRecent: () => Promise.resolve(fake.recent),
		listOrphanedWorktrees: () => Promise.resolve(fake.orphans),
	};
	return fake;
}

interface FakeRegistry {
	registryEmitter: EventEmitter<void>;
	onDidChange: EventEmitter<void>["event"];
}

function createFakeRegistry(): FakeRegistry {
	const emitter = new EventEmitter<void>();
	return {
		registryEmitter: emitter,
		onDidChange: emitter.event,
	};
}

function assertGroupShape(
	item: RunningAgentsTreeItem,
	expectedLabel: string,
	expectedContextValue: string
): { labelOk: boolean; stateOk: boolean; contextOk: boolean } {
	return {
		labelOk: item.label === expectedLabel,
		stateOk: item.collapsibleState === TreeItemCollapsibleState.Expanded,
		contextOk: item.contextValue === expectedContextValue,
	};
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("RunningAgentsTreeProvider (T042)", () => {
	let store: FakeStore;
	let registry: FakeRegistry;
	let provider: RunningAgentsTreeProvider;

	beforeEach(() => {
		store = createFakeStore();
		registry = createFakeRegistry();
		provider = new RunningAgentsTreeProvider({
			store: store as unknown as AgentChatSessionStore,
			registry: registry as unknown as AgentChatRegistry,
			storeChangeEvent: store.manifestEmitter.event,
		});
	});

	describe("root groups", () => {
		it("emits three groups: Active, Recent, Orphaned worktrees", async () => {
			const children = await provider.getChildren();
			expect(children.map((c: RunningAgentsTreeItem) => c.label)).toEqual([
				"Active",
				"Recent",
				"Orphaned worktrees",
			]);

			const active = assertGroupShape(
				children[0],
				"Active",
				"agent-chat-group-active"
			);
			const recent = assertGroupShape(
				children[1],
				"Recent",
				"agent-chat-group-recent"
			);
			const orphans = assertGroupShape(
				children[2],
				"Orphaned worktrees",
				"agent-chat-group-orphans"
			);
			expect(active).toEqual({
				labelOk: true,
				stateOk: true,
				contextOk: true,
			});
			expect(recent).toEqual({
				labelOk: true,
				stateOk: true,
				contextOk: true,
			});
			expect(orphans).toEqual({
				labelOk: true,
				stateOk: true,
				contextOk: true,
			});
		});
	});

	describe("session leaves", () => {
		it("puts non-terminal sessions under Active and terminal ones under Recent", async () => {
			const running = makeSession({
				id: "s-run",
				lifecycleState: "running",
				selectedModeId: "code",
			});
			const done = makeSession({
				id: "s-done",
				lifecycleState: "completed",
			});
			store.active = [running];
			store.recent = [done];

			const [activeGroup, recentGroup] = await provider.getChildren();
			const activeChildren = await provider.getChildren(activeGroup);
			const recentChildren = await provider.getChildren(recentGroup);

			expect(
				activeChildren.map((c: RunningAgentsTreeItem) => c.sessionId)
			).toEqual(["s-run"]);
			expect(
				recentChildren.map((c: RunningAgentsTreeItem) => c.sessionId)
			).toEqual(["s-done"]);
		});

		it("renders leaves with 'agent · mode · target · status' in the description", async () => {
			const s = makeSession({
				id: "s-desc",
				selectedModeId: "code",
				lifecycleState: "waiting-for-input",
				executionTarget: { kind: "local" },
			});
			store.active = [s];

			const [activeGroup] = await provider.getChildren();
			const [leaf] = await provider.getChildren(activeGroup);

			// Label is the agent display name; description carries the metadata.
			expect(leaf.label).toBe("OpenCode");
			expect(leaf.description).toMatch(MODE_RE);
			expect(leaf.description).toMatch(TARGET_RE);
			expect(leaf.description).toMatch(STATUS_RE);
		});

		it("attaches a click command targeting gatomia.agentChat.openForSession with the session id", async () => {
			const s = makeSession({ id: "s-cmd" });
			store.active = [s];

			const [activeGroup] = await provider.getChildren();
			const [leaf] = await provider.getChildren(activeGroup);

			expect(leaf.command).toMatchObject({
				command: "gatomia.agentChat.openForSession",
				arguments: ["s-cmd"],
			});
		});

		it("uses a worktree-specific contextValue for worktree-backed sessions", async () => {
			const worktreeSession = makeSession({
				id: "s-wt",
				executionTarget: { kind: "worktree", worktreeId: "wt-1" },
				worktree: {
					id: "wt-1",
					absolutePath: "/tmp/worktree",
					branchName: "gatomia/agent-chat/s-wt",
					baseCommitSha: "abc",
					createdAt: 1000,
					status: "in-use",
				},
			});
			store.active = [worktreeSession];

			const [activeGroup] = await provider.getChildren();
			const [leaf] = await provider.getChildren(activeGroup);

			expect(leaf.contextValue).toBe("agent-chat-session-worktree");
		});

		it("uses the plain session contextValue for local sessions", async () => {
			store.active = [makeSession({ id: "s-local" })];
			const [activeGroup] = await provider.getChildren();
			const [leaf] = await provider.getChildren(activeGroup);
			expect(leaf.contextValue).toBe("agent-chat-session");
		});
	});

	describe("orphaned worktrees group", () => {
		it("renders each orphaned worktree entry as a leaf", async () => {
			store.orphans = [
				{
					sessionId: "evicted-1",
					absolutePath: "/tmp/worktree-1",
					branchName: "gatomia/agent-chat/evicted-1",
					recordedAt: 1000,
				},
			];
			const children = await provider.getChildren();
			const [, , orphanGroup] = children;
			const orphanChildren = await provider.getChildren(orphanGroup);

			expect(orphanChildren).toHaveLength(1);
			expect(orphanChildren[0].contextValue).toBe("agent-chat-orphan-worktree");
			expect(orphanChildren[0].description).toMatch(PATH_RE);
		});
	});

	describe("reactivity", () => {
		it("fires onDidChangeTreeData when the store manifest changes", () => {
			const listener = vi.fn();
			provider.onDidChangeTreeData(listener);
			store.manifestEmitter.fire({
				schemaVersion: 1,
				sessions: [],
				updatedAt: Date.now(),
			});
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires onDidChangeTreeData when the registry changes", () => {
			const listener = vi.fn();
			provider.onDidChangeTreeData(listener);
			registry.registryEmitter.fire();
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("lifecycle", () => {
		it("dispose stops forwarding store and registry events", () => {
			const listener = vi.fn();
			provider.onDidChangeTreeData(listener);
			provider.dispose();
			store.manifestEmitter.fire({
				schemaVersion: 1,
				sessions: [],
				updatedAt: Date.now(),
			});
			registry.registryEmitter.fire();
			expect(listener).not.toHaveBeenCalled();
		});
	});
});
