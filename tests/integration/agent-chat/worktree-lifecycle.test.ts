/**
 * Integration test: worktree lifecycle (T056).
 *
 * Covers contracts/worktree-lifecycle.md §4-§6 end-to-end:
 *   1. Create a worktree session → handle persisted on the store.
 *   2. Inspect reports commits-since-base for new local commits without a remote.
 *   3. Cleanup two-step flow — first call returns warning, second call (confirmed)
 *      removes the worktree.
 *   4. Session manifest retains `worktree.status = "cleaned"` after cleanup.
 *
 * Uses the real `AgentWorktreeService` with a fake `GitRunner` + `FsLike` so
 * we can drive the full state machine deterministically.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCleanupWorktree } from "../../../src/commands/agent-chat-commands";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	type AgentChatArchiveWriter,
	type AgentChatMemento,
	AgentChatSessionStore,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import {
	AgentWorktreeService,
	type FsLike,
	type GitRunResult,
	type GitRunner,
} from "../../../src/features/agent-chat/agent-worktree-service";
import type {
	AgentChatSession,
	ChatMessage,
	WorktreeHandle,
} from "../../../src/features/agent-chat/types";

const REPO_ROOT = "/tmp/it-repo";
const SESSION_ID = "wt-session-1";
const BASE_SHA = "abc1234567890000000000000000000000001234";

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
		appendLines: vi.fn(() => Promise.resolve("archive.jsonl")) as (
			sessionId: string,
			messages: ChatMessage[]
		) => Promise<string>,
		readLines: vi.fn(() => Promise.resolve([])) as (
			sessionId: string,
			offset: number,
			limit: number
		) => Promise<ChatMessage[]>,
	};
}

function ok(stdout = ""): GitRunResult {
	return { stdout, stderr: "", code: 0 };
}

function fail(stderr = "fail"): GitRunResult {
	return { stdout: "", stderr, code: 128 };
}

interface FsState {
	files: Map<string, string>;
	dirs: Set<string>;
}

function createFakeFs(): { fs: FsLike; state: FsState } {
	const state: FsState = { files: new Map(), dirs: new Set() };
	const fs: FsLike = {
		exists: (p) => Promise.resolve(state.files.has(p) || state.dirs.has(p)),
		readFile: (p) => {
			const c = state.files.get(p);
			return c === undefined
				? Promise.reject(new Error(`ENOENT: ${p}`))
				: Promise.resolve(c);
		},
		writeFile: (p, c) => {
			state.files.set(p, c);
			return Promise.resolve();
		},
		stat: (p) => {
			if (state.dirs.has(p)) {
				return Promise.resolve({ isDirectory: true });
			}
			if (state.files.has(p)) {
				return Promise.resolve({ isDirectory: false });
			}
			return Promise.resolve(null);
		},
	};
	return { fs, state };
}

describe("worktree lifecycle (T056)", () => {
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let fsHandle: { fs: FsLike; state: FsState };
	let git: GitRunner;
	let service: AgentWorktreeService;
	let invocations: string[][];
	let revListCount: string;
	let session: AgentChatSession;
	let worktree: WorktreeHandle;

	beforeEach(async () => {
		store = new AgentChatSessionStore({
			workspaceState: createMemento(),
			archive: createArchive(),
		});
		await store.initialize();
		registry = new AgentChatRegistry();

		fsHandle = createFakeFs();
		invocations = [];
		revListCount = "0";
		git = {
			run: (args: string[], _cwd: string) => {
				invocations.push(args);
				if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
					return Promise.resolve(ok(REPO_ROOT));
				}
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return Promise.resolve(ok(BASE_SHA));
				}
				if (args[0] === "show-ref") {
					return Promise.resolve(fail(""));
				}
				if (args[0] === "worktree" && args[1] === "add") {
					fsHandle.state.dirs.add(
						`${REPO_ROOT}/.gatomia/worktrees/${SESSION_ID}/`
					);
					return Promise.resolve(ok());
				}
				if (args[0] === "worktree" && args[1] === "remove") {
					fsHandle.state.dirs.delete(
						`${REPO_ROOT}/.gatomia/worktrees/${SESSION_ID}/`
					);
					return Promise.resolve(ok());
				}
				if (args[0] === "branch" && args[1] === "-D") {
					return Promise.resolve(ok());
				}
				if (args[0] === "status" && args.includes("--porcelain")) {
					return Promise.resolve(ok(""));
				}
				if (args[0] === "rev-list" && args[1] === "--count") {
					return Promise.resolve(ok(revListCount));
				}
				return Promise.resolve(ok());
			},
		};
		service = new AgentWorktreeService({
			git,
			fs: fsHandle.fs,
			resolver: {
				resolve: () => Promise.resolve({ kind: "ok", root: REPO_ROOT }),
			},
		});

		worktree = await service.create(SESSION_ID);
		session = await store.createSession({
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "worktree", worktreeId: worktree.id },
			trigger: { kind: "user" },
			worktree,
			cloud: null,
		});
		registry.registerSession(session);
	});

	it("creates the worktree and the handle is persisted on the session", () => {
		expect(worktree.status).toBe("created");
		expect(worktree.absolutePath).toBe(
			`${REPO_ROOT}/.gatomia/worktrees/${SESSION_ID}/`
		);
		expect(invocations).toContainEqual([
			"worktree",
			"add",
			"-b",
			worktree.branchName,
			worktree.absolutePath,
			BASE_SHA,
		]);
		expect(session.worktree).not.toBeNull();
	});

	it("inspect reports commits-since-base for new local commits without a remote", async () => {
		revListCount = "2";
		const inspection = await service.inspect(worktree);
		expect(inspection.unpushedCommits).toBe(2);
		expect(inspection.isClean).toBe(false);
	});

	it("cleanup refuses the first attempt when dirty and proceeds on confirmation", async () => {
		revListCount = "1";
		const first = await handleCleanupWorktree(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
				worktreeService: service,
			},
			{ sessionId: session.id, confirmedDestructive: false }
		);
		expect(first.kind).toBe("warning");
		if (first.kind === "warning") {
			expect(first.inspection.unpushedCommits).toBe(1);
		}

		const second = await handleCleanupWorktree(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
				worktreeService: service,
			},
			{ sessionId: session.id, confirmedDestructive: true }
		);
		expect(second.kind).toBe("ok");
		expect(invocations).toContainEqual([
			"worktree",
			"remove",
			"--force",
			worktree.absolutePath,
		]);

		const after = await store.getSession(session.id);
		expect(after?.worktree?.status).toBe("cleaned");
	});

	it("cleanup on a clean tree succeeds in a single call", async () => {
		revListCount = "0";
		const result = await handleCleanupWorktree(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
				worktreeService: service,
			},
			{ sessionId: session.id, confirmedDestructive: false }
		);
		expect(result.kind).toBe("ok");

		const after = await store.getSession(session.id);
		expect(after?.worktree?.status).toBe("cleaned");
	});
});
