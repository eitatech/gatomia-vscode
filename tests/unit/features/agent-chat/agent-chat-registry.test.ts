/**
 * AgentChatRegistry unit tests.
 *
 * TDD (Constitution III): red before T011.
 *
 * Covers the FR-008 "one panel per session" invariant, active vs. recent
 * partitioning, shutdown flush, and runner attachment via the forward-compatible
 * `AgentChatRunnerHandle` interface introduced in T005.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentChatRegistry,
	type AgentChatPanelLike,
} from "../../../../src/features/agent-chat/agent-chat-registry";
import type {
	AgentChatRunnerHandle,
	AgentChatSession,
} from "../../../../src/features/agent-chat/types";

// Top-level regex constants (biome lint/performance/useTopLevelRegex).
const PANEL_ALREADY_EXISTS_REGEX = /already has a panel/i;
const RUNNER_ALREADY_EXISTS_REGEX = /already has a runner/i;

const NOOP = (): void => {
	// Intentionally empty.
};

// ============================================================================
// Fakes
// ============================================================================

type FakePanel = AgentChatPanelLike & {
	_fireDispose: () => void;
	dispose: ReturnType<typeof vi.fn>;
	reveal: ReturnType<typeof vi.fn>;
};

function createFakePanel(): FakePanel {
	let disposer: (() => void) | undefined;
	const dispose = vi.fn(() => {
		disposer?.();
	});
	const reveal = vi.fn();
	return {
		viewType: "gatomia.agentChatPanel",
		dispose: dispose as FakePanel["dispose"],
		reveal: reveal as FakePanel["reveal"],
		onDidDispose: (cb: () => void) => {
			disposer = cb;
			return { dispose: NOOP };
		},
		_fireDispose: () => disposer?.(),
	};
}

type FakeRunner = AgentChatRunnerHandle & {
	cancel: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
};

function createFakeRunner(sessionId: string): FakeRunner {
	const cancel = vi.fn().mockResolvedValue(undefined);
	const dispose = vi.fn();
	return {
		sessionId,
		cancel: cancel as FakeRunner["cancel"],
		dispose: dispose as FakeRunner["dispose"],
	};
}

function session(
	id: string,
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id,
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "opencode",
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

// ============================================================================
// Suite
// ============================================================================

describe("AgentChatRegistry", () => {
	let registry: AgentChatRegistry;

	beforeEach(() => {
		registry = new AgentChatRegistry();
	});

	describe("one panel per session (FR-008)", () => {
		it("registers a panel for a session and retrieves it by id", () => {
			const panel = createFakePanel();
			registry.registerSession(session("s-1"));
			registry.attachPanel("s-1", panel);

			expect(registry.getPanel("s-1")).toBe(panel);
		});

		it("never creates a duplicate panel for the same session", () => {
			const first = createFakePanel();
			const second = createFakePanel();
			registry.registerSession(session("s-1"));
			registry.attachPanel("s-1", first);

			expect(() => registry.attachPanel("s-1", second)).toThrowError(
				PANEL_ALREADY_EXISTS_REGEX
			);
			expect(registry.getPanel("s-1")).toBe(first);
		});

		it("forgets the panel when it disposes", () => {
			const panel = createFakePanel();
			registry.registerSession(session("s-1"));
			registry.attachPanel("s-1", panel);

			// simulate user closing the panel
			panel._fireDispose();

			expect(registry.getPanel("s-1")).toBeUndefined();
		});
	});

	describe("runner attachment", () => {
		it("attaches and returns a runner implementing AgentChatRunnerHandle", () => {
			const runner = createFakeRunner("s-1");
			registry.registerSession(session("s-1"));
			registry.attachRunner("s-1", runner);

			expect(registry.getRunner("s-1")).toBe(runner);
		});

		it("refuses to attach a second runner for the same session", () => {
			const first = createFakeRunner("s-1");
			const second = createFakeRunner("s-1");
			registry.registerSession(session("s-1"));
			registry.attachRunner("s-1", first);

			expect(() => registry.attachRunner("s-1", second)).toThrowError(
				RUNNER_ALREADY_EXISTS_REGEX
			);
		});
	});

	describe("active vs. recent partitioning", () => {
		it("lists sessions in initializing/running/waiting-for-input as active", () => {
			registry.registerSession(
				session("s-initializing", { lifecycleState: "initializing" })
			);
			registry.registerSession(
				session("s-running", { lifecycleState: "running" })
			);
			registry.registerSession(
				session("s-waiting", { lifecycleState: "waiting-for-input" })
			);
			registry.registerSession(
				session("s-done", { lifecycleState: "completed" })
			);

			const activeIds = registry
				.listActive()
				.map((s: AgentChatSession) => s.id);
			expect(activeIds).toContain("s-initializing");
			expect(activeIds).toContain("s-running");
			expect(activeIds).toContain("s-waiting");
			expect(activeIds).not.toContain("s-done");
		});

		it("lists sessions in terminal states as recent", () => {
			registry.registerSession(
				session("s-done", { lifecycleState: "completed" })
			);
			registry.registerSession(
				session("s-failed", { lifecycleState: "failed" })
			);
			registry.registerSession(
				session("s-running", { lifecycleState: "running" })
			);

			const recentIds = registry
				.listRecent()
				.map((s: AgentChatSession) => s.id);
			expect(recentIds).toContain("s-done");
			expect(recentIds).toContain("s-failed");
			expect(recentIds).not.toContain("s-running");
		});
	});

	describe("shutdown flush", () => {
		it("transitions non-terminal ACP sessions and invokes flushSink exactly once", async () => {
			const flushSink = vi
				.fn<(sessions: AgentChatSession[]) => Promise<void>>()
				.mockResolvedValue(undefined);
			registry.registerSession(
				session("s-1", { source: "acp", lifecycleState: "running" })
			);
			registry.registerSession(
				session("s-2", { source: "acp", lifecycleState: "waiting-for-input" })
			);
			registry.registerSession(
				session("s-3", { source: "cloud", lifecycleState: "running" })
			);

			await registry.shutdown(flushSink);

			expect(flushSink).toHaveBeenCalledTimes(1);
			const [flushed] = flushSink.mock.calls[0] as [AgentChatSession[]];
			const acpFlushed = flushed.filter(
				(s: AgentChatSession) => s.source === "acp"
			);
			expect(acpFlushed).toHaveLength(2);
			for (const s of acpFlushed) {
				expect(s.lifecycleState).toBe("ended-by-shutdown");
			}
			// Cloud stays unchanged.
			const cloudFlushed = flushed.find(
				(s: AgentChatSession) => s.id === "s-3"
			);
			expect(cloudFlushed?.lifecycleState).toBe("running");
		});

		it("disposes attached runners on shutdown", async () => {
			const runner = createFakeRunner("s-1");
			registry.registerSession(session("s-1"));
			registry.attachRunner("s-1", runner);

			await registry.shutdown(() => Promise.resolve());
			expect(runner.dispose).toHaveBeenCalledTimes(1);
		});
	});

	describe("removal", () => {
		it("removes a session and clears its runner + panel", () => {
			const panel = createFakePanel();
			const runner = createFakeRunner("s-1");
			registry.registerSession(session("s-1"));
			registry.attachPanel("s-1", panel);
			registry.attachRunner("s-1", runner);

			registry.removeSession("s-1");
			expect(registry.getPanel("s-1")).toBeUndefined();
			expect(registry.getRunner("s-1")).toBeUndefined();
			expect(
				registry.listActive().map((s: AgentChatSession) => s.id)
			).not.toContain("s-1");
		});
	});
});
