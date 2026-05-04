/**
 * Integration test: clicking a Running Agents tree leaf opens (or focuses)
 * the right panel exactly once (T043, spec 018).
 *
 * Setup: two persisted sessions in the store, simulate the tree-click
 * command flow by invoking `handleOpenForSession` from the commands module
 * (which is what the tree's leaf `command` dispatches to).
 *
 * Assertions:
 *   1. Click on session A → panel factory called with session A.
 *   2. Click on session B → panel factory called with session B.
 *   3. Click on session A again → factory NOT called again; `reveal()` called
 *      on the existing panel (one-panel-per-session invariant / FR-008).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleOpenForSession } from "../../../src/commands/agent-chat-commands";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	AgentChatSessionStore,
	type AgentChatArchiveWriter,
	type AgentChatMemento,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatSession,
	ChatMessage,
} from "../../../src/features/agent-chat/types";

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

function seedSession(store: AgentChatSessionStore): Promise<AgentChatSession> {
	return store.createSession({
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
}

describe("click a Running Agents tree leaf (T043)", () => {
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;

	beforeEach(async () => {
		store = new AgentChatSessionStore({
			workspaceState: createMemento(),
			archive: createArchive(),
		});
		await store.initialize();
		registry = new AgentChatRegistry();
	});

	it("opens the correct panel for each session and focuses (not duplicates) on repeat click", async () => {
		const a = await seedSession(store);
		const b = await seedSession(store);
		registry.registerSession(a);
		registry.registerSession(b);

		// Track factory invocations and panel-level reveal calls.
		const factory = vi.fn();
		const reveals: Record<string, number> = {};
		factory.mockImplementation((session: AgentChatSession) => {
			const id = session.id;
			reveals[id] = 0;
			return {
				sessionId: id,
				viewType: "gatomia.agentChatPanel",
				reveal: () => {
					reveals[id] = (reveals[id] ?? 0) + 1;
				},
				dispose: () => {
					// no-op in test
				},
				onDidDispose: () => ({
					dispose: () => {
						// no-op
					},
				}),
			};
		});

		const deps = {
			registry,
			store,
			createPanel: factory,
			startAcpSession: vi.fn(),
		};

		// (1) First click on A → factory creates panel A.
		await handleOpenForSession(deps, a.id);
		expect(factory).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: a.id })
		);
		expect(reveals[a.id]).toBeGreaterThanOrEqual(1);

		// (2) First click on B → factory creates panel B.
		await handleOpenForSession(deps, b.id);
		expect(factory).toHaveBeenCalledTimes(2);
		expect(factory).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: b.id })
		);
		expect(reveals[b.id]).toBeGreaterThanOrEqual(1);

		// (3) Second click on A → factory is NOT invoked again; reveal is.
		const priorReveals = reveals[a.id];
		await handleOpenForSession(deps, a.id);
		expect(factory).toHaveBeenCalledTimes(2); // unchanged
		expect(reveals[a.id]).toBeGreaterThan(priorReveals);
	});

	it("falls through (no-op) when the session id is unknown", async () => {
		const factory = vi.fn();
		const deps = {
			registry,
			store,
			createPanel: factory,
			startAcpSession: vi.fn(),
		};
		await handleOpenForSession(deps, "nonexistent");
		expect(factory).not.toHaveBeenCalled();
	});

	it("resolves sessions from the store when they are not yet in the registry (restart case)", async () => {
		// Simulate a restart: session is persisted in the store but NOT yet
		// registered in the in-memory registry. Tree clicks must still open
		// the panel; handleOpenForSession should fetch from the store as a
		// fallback so recent (terminal) sessions are clickable.
		const s = await seedSession(store);
		// Intentionally skip registry.registerSession(s)

		const factory = vi.fn();
		factory.mockImplementation((session: AgentChatSession) => ({
			sessionId: session.id,
			viewType: "gatomia.agentChatPanel",
			reveal: () => {
				// no-op
			},
			dispose: () => {
				// no-op
			},
			onDidDispose: () => ({
				dispose: () => {
					// no-op
				},
			}),
		}));

		const deps = {
			registry,
			store,
			createPanel: factory,
			startAcpSession: vi.fn(),
		};

		await handleOpenForSession(deps, s.id);
		expect(factory).toHaveBeenCalledTimes(1);
	});
});
