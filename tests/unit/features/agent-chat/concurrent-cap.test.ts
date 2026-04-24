/**
 * Concurrent-cap tests (T070, spec 018 US4).
 *
 * TDD (Constitution III): red before T073.
 *
 * Contract:
 *   - `AgentChatRegistry.checkCapacity(source, cap)` returns `{ ok: true }`
 *     when cap would not be exceeded, otherwise `{ ok: false, idleSessions }`
 *     listing non-terminal ACP sessions already present (so T073a can build
 *     the QuickPick).
 *   - Cap counts only ACP sessions. Cloud sessions are exempt (they live on a
 *     provider, not in a local subprocess).
 *   - `ConcurrentCapExceededError` wraps the same payload for callers that
 *     prefer `throw`/`try`.
 *
 * @see specs/018-agent-chat-panel/research.md §R5
 */

import { describe, expect, it } from "vitest";
import {
	AgentChatRegistry,
	ConcurrentCapExceededError,
} from "../../../../src/features/agent-chat/agent-chat-registry";
import type { AgentChatSession } from "../../../../src/features/agent-chat/types";

function makeAcpSession(id: string, overrides: Partial<AgentChatSession> = {}) {
	return {
		id,
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
	} as AgentChatSession;
}

function makeCloudSession(
	id: string,
	overrides: Partial<AgentChatSession> = {}
) {
	return {
		id,
		source: "cloud",
		agentId: "devin",
		agentDisplayName: "Devin",
		capabilities: { source: "none" },
		executionTarget: { kind: "cloud", providerId: "devin" },
		lifecycleState: "running",
		trigger: { kind: "user" },
		worktree: null,
		cloud: { providerId: "devin", cloudSessionLocalId: "local-1" },
		createdAt: 1000,
		updatedAt: 1000,
		workspaceUri: "file:///fake/workspace",
		...overrides,
	} as AgentChatSession;
}

describe("AgentChatRegistry.checkCapacity (T070)", () => {
	it("allows the first ACP session when cap is 5", () => {
		const registry = new AgentChatRegistry();
		const result = registry.checkCapacity("acp", 5);
		expect(result.ok).toBe(true);
	});

	it("allows the Nth ACP session as long as count < cap", () => {
		const registry = new AgentChatRegistry();
		for (let i = 0; i < 4; i += 1) {
			registry.registerSession(makeAcpSession(`s-${i}`));
		}
		const result = registry.checkCapacity("acp", 5);
		expect(result.ok).toBe(true);
	});

	it("refuses a 6th ACP session when 5 ACP sessions are already active", () => {
		const registry = new AgentChatRegistry();
		for (let i = 0; i < 5; i += 1) {
			registry.registerSession(makeAcpSession(`s-${i}`));
		}
		const result = registry.checkCapacity("acp", 5);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.idleSessions.length).toBeGreaterThan(0);
		}
	});

	it("returns the idle-session list ordered by longest-idle first", () => {
		const registry = new AgentChatRegistry();
		registry.registerSession(
			makeAcpSession("s-old", {
				lifecycleState: "waiting-for-input",
				updatedAt: 100,
			})
		);
		registry.registerSession(
			makeAcpSession("s-mid", {
				lifecycleState: "waiting-for-input",
				updatedAt: 500,
			})
		);
		registry.registerSession(
			makeAcpSession("s-new", {
				lifecycleState: "waiting-for-input",
				updatedAt: 1000,
			})
		);
		registry.registerSession(
			makeAcpSession("s-busy", {
				lifecycleState: "running",
				updatedAt: 1500,
			})
		);
		registry.registerSession(
			makeAcpSession("s-dead", {
				lifecycleState: "completed",
				updatedAt: 50,
			})
		);
		const result = registry.checkCapacity("acp", 3);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			// Busy `running` sessions are eligible candidates too, but idle
			// ones (`waiting-for-input`) sort first; oldest idle first.
			const ids = result.idleSessions.map((s) => s.id);
			expect(ids[0]).toBe("s-old");
			expect(ids).toContain("s-mid");
			expect(ids).toContain("s-new");
			// Terminal sessions (completed/cancelled/failed) are NOT included.
			expect(ids).not.toContain("s-dead");
		}
	});

	it("does NOT count cloud sessions against the ACP cap", () => {
		const registry = new AgentChatRegistry();
		for (let i = 0; i < 5; i += 1) {
			registry.registerSession(makeCloudSession(`cloud-${i}`));
		}
		const result = registry.checkCapacity("acp", 5);
		expect(result.ok).toBe(true);
	});

	it("cloud sessions themselves are always allowed regardless of cap", () => {
		const registry = new AgentChatRegistry();
		for (let i = 0; i < 10; i += 1) {
			registry.registerSession(makeAcpSession(`s-${i}`));
		}
		const result = registry.checkCapacity("cloud", 5);
		expect(result.ok).toBe(true);
	});

	it("ConcurrentCapExceededError carries the idle-session list + cap", () => {
		const idle = [
			makeAcpSession("idle-1", { lifecycleState: "waiting-for-input" }),
		];
		const err = new ConcurrentCapExceededError({ idleSessions: idle, cap: 5 });
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("ConcurrentCapExceededError");
		expect(err.cap).toBe(5);
		expect(err.idleSessions).toHaveLength(1);
	});
});
