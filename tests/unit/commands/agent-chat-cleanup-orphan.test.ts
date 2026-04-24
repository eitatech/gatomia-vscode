/**
 * Unit tests for `handleCleanupOrphanedWorktree` (T074, spec 018).
 *
 * Covers the two-step flow (inspect → optionally warn → cleanup + drop from
 * `workspaceState`) for orphaned worktrees surfaced in the "Orphaned
 * worktrees" group of the Running Agents tree.
 */

import { describe, expect, it, vi } from "vitest";
import {
	type AgentChatCommandsDeps,
	type CleanupOrphanedWorktreePayload,
	handleCleanupOrphanedWorktree,
} from "../../../src/commands/agent-chat-commands";
import { WorktreeCleanupWarningRequired } from "../../../src/features/agent-chat/agent-worktree-service";

function makeDeps(
	overrides: Partial<AgentChatCommandsDeps> = {}
): AgentChatCommandsDeps {
	const registry = {
		getSession: vi.fn(),
		getRunner: vi.fn(),
		getPanel: vi.fn(),
		focusPanel: vi.fn(),
		registerSession: vi.fn(),
		attachRunner: vi.fn(),
		attachPanel: vi.fn(),
	} as unknown as AgentChatCommandsDeps["registry"];
	const store = {
		listNonTerminal: vi.fn(() => Promise.resolve([])),
		getSession: vi.fn(),
		updateSession: vi.fn(),
		listOrphanedWorktrees: vi.fn(() => Promise.resolve([])),
		removeOrphanedWorktree: vi.fn(() => Promise.resolve()),
	} as unknown as AgentChatCommandsDeps["store"];
	return {
		registry,
		store,
		createPanel: vi.fn() as unknown as AgentChatCommandsDeps["createPanel"],
		startAcpSession:
			vi.fn() as unknown as AgentChatCommandsDeps["startAcpSession"],
		...overrides,
	};
}

const PAYLOAD: CleanupOrphanedWorktreePayload = {
	sessionId: "evicted-1",
	absolutePath: "/tmp/worktrees/evicted-1",
	branchName: "gatomia/agent-chat/evicted-1",
	confirmedDestructive: false,
};

describe("handleCleanupOrphanedWorktree (T074)", () => {
	it("returns an error result when the store does not expose removeOrphanedWorktree", async () => {
		const deps = makeDeps({
			store: {
				listNonTerminal: vi.fn(),
				getSession: vi.fn(),
				updateSession: vi.fn(),
			} as unknown as AgentChatCommandsDeps["store"],
		});
		const result = await handleCleanupOrphanedWorktree(deps, PAYLOAD);
		expect(result.kind).toBe("error");
	});

	it("returns a warning when the worktree service demands confirmation", async () => {
		const inspection = {
			uncommittedPaths: ["src/dirty.ts"],
			unpushedCommits: 1,
			isClean: false,
		};
		const worktreeService = {
			inspect: vi.fn(),
			cleanup: vi.fn(() =>
				Promise.reject(new WorktreeCleanupWarningRequired(inspection))
			),
		} as unknown as AgentChatCommandsDeps["worktreeService"];
		const deps = makeDeps({ worktreeService });

		const result = await handleCleanupOrphanedWorktree(deps, PAYLOAD);

		expect(result).toEqual({ kind: "warning", inspection });
		expect(deps.store.removeOrphanedWorktree).not.toHaveBeenCalled();
	});

	it("cleans the worktree and drops the entry when confirmed", async () => {
		const worktreeService = {
			inspect: vi.fn(),
			cleanup: vi.fn(() => Promise.resolve()),
		} as unknown as AgentChatCommandsDeps["worktreeService"];
		const deps = makeDeps({ worktreeService });

		const result = await handleCleanupOrphanedWorktree(deps, {
			...PAYLOAD,
			confirmedDestructive: true,
		});

		expect(result).toEqual({ kind: "ok" });
		expect(worktreeService?.cleanup).toHaveBeenCalledTimes(1);
		expect(deps.store.removeOrphanedWorktree).toHaveBeenCalledWith("evicted-1");
	});

	it("only drops the entry (no cleanup) when worktreeService is not configured", async () => {
		const deps = makeDeps();
		const result = await handleCleanupOrphanedWorktree(deps, {
			...PAYLOAD,
			confirmedDestructive: true,
		});
		expect(result).toEqual({ kind: "ok" });
		expect(deps.store.removeOrphanedWorktree).toHaveBeenCalledWith("evicted-1");
	});
});
