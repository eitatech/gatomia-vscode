/**
 * AgentWorktreeService unit tests (T051).
 *
 * TDD (Constitution III): red before T059a/T059b/T059c.
 *
 * Covers every case listed in
 * contracts/worktree-lifecycle.md §10. Organised into three `describe`
 * blocks matching the T059a/T059b/T059c implementation split.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	FsLike,
	GitRunner,
	GitRunResult,
	WorkspaceRootResolver,
	WorkspaceRootResolution,
} from "../../../../src/features/agent-chat/agent-worktree-service";
import {
	AgentWorktreeService,
	WorktreeCleanupError,
	WorktreeCleanupWarningRequired,
	WorktreeCreateError,
} from "../../../../src/features/agent-chat/agent-worktree-service";

type GitResponder = (args: string[], cwd: string) => GitRunResult;

interface FakeGitRunnerOptions {
	responder: GitResponder;
	onInvocation?: (args: string[], cwd: string) => void;
}

function createFakeGitRunner(options: FakeGitRunnerOptions): GitRunner {
	return {
		run(args: string[], cwd: string): Promise<GitRunResult> {
			options.onInvocation?.(args, cwd);
			return Promise.resolve(options.responder(args, cwd));
		},
	};
}

function ok(stdout = ""): GitRunResult {
	return { stdout, stderr: "", code: 0 };
}

function err(stderr: string, code = 128): GitRunResult {
	return { stdout: "", stderr, code };
}

interface FakeFsState {
	files: Map<string, string>;
	dirs: Set<string>;
}

function createFakeFs(initial?: Partial<FakeFsState>): {
	fs: FsLike;
	state: FakeFsState;
} {
	const state: FakeFsState = {
		files: new Map(initial?.files ?? []),
		dirs: new Set(initial?.dirs ?? []),
	};
	const fs: FsLike = {
		exists(path) {
			return Promise.resolve(state.files.has(path) || state.dirs.has(path));
		},
		readFile(path) {
			const contents = state.files.get(path);
			if (contents === undefined) {
				return Promise.reject(new Error(`ENOENT: ${path}`));
			}
			return Promise.resolve(contents);
		},
		writeFile(path, content) {
			state.files.set(path, content);
			return Promise.resolve();
		},
		stat(path) {
			if (state.dirs.has(path)) {
				return Promise.resolve({ isDirectory: true });
			}
			if (state.files.has(path)) {
				return Promise.resolve({ isDirectory: false });
			}
			return Promise.resolve(null);
		},
	};
	return { fs, state };
}

function createResolver(
	resolution: WorkspaceRootResolution
): WorkspaceRootResolver {
	return { resolve: () => Promise.resolve(resolution) };
}

const REPO_ROOT = "/tmp/repo";
const SESSION_ID = "session-abc-123";
const BASE_SHA = "deadbeef0000000000000000000000000000beef";

function buildPaths(
	sessionId = SESSION_ID,
	repoRoot = REPO_ROOT
): {
	absolutePath: string;
	branchName: string;
	gitignorePath: string;
} {
	return {
		absolutePath: `${repoRoot}/.gatomia/worktrees/${sessionId}/`,
		branchName: `gatomia/agent-chat/${sessionId}`,
		gitignorePath: `${repoRoot}/.gitignore`,
	};
}

// Default responder for the happy path. Tests may override specific calls by
// wrapping with an adapter.
function defaultResponder(
	ctx: {
		baseSha?: string;
		revListCount?: string;
		statusPorcelain?: string;
	} = {}
): GitResponder {
	return (args, _cwd) => {
		if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
			return ok(REPO_ROOT);
		}
		if (args[0] === "rev-parse" && args[1] === "HEAD") {
			return ok(ctx.baseSha ?? BASE_SHA);
		}
		if (args[0] === "show-ref") {
			// Branch does not exist by default; tests override for "branch-exists".
			return err("", 1);
		}
		if (args[0] === "worktree" && args[1] === "add") {
			return ok();
		}
		if (args[0] === "worktree" && args[1] === "remove") {
			return ok();
		}
		if (args[0] === "branch" && args[1] === "-D") {
			return ok();
		}
		if (args[0] === "status" && args.includes("--porcelain")) {
			return ok(ctx.statusPorcelain ?? "");
		}
		if (args[0] === "rev-list" && args[1] === "--count") {
			return ok(ctx.revListCount ?? "0");
		}
		return ok();
	};
}

// ----------------------------------------------------------------------------
// T059a — create + multi-root resolve + .gitignore seed
// ----------------------------------------------------------------------------

describe("AgentWorktreeService.create()", () => {
	let telemetry: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		telemetry = vi.fn();
	});

	it("happy path: creates worktree, writes .gitignore entry, emits telemetry", async () => {
		const invocations: string[][] = [];
		const { fs, state } = createFakeFs();
		const git = createFakeGitRunner({
			responder: defaultResponder(),
			onInvocation: (args) => invocations.push(args),
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		const handle = await service.create(SESSION_ID);

		const { absolutePath, branchName, gitignorePath } = buildPaths();
		expect(handle).toStrictEqual({
			id: SESSION_ID,
			absolutePath,
			branchName,
			baseCommitSha: BASE_SHA,
			status: "created",
			createdAt: expect.any(Number),
		});
		expect(invocations).toContainEqual([
			"worktree",
			"add",
			"-b",
			branchName,
			absolutePath,
			BASE_SHA,
		]);
		expect(state.files.get(gitignorePath)).toContain(".gatomia/worktrees/");
		expect(telemetry).toHaveBeenCalledWith(
			"agent-chat.worktree.created",
			expect.objectContaining({ sessionId: SESSION_ID, branchName })
		);
	});

	it("leaves .gitignore untouched when it already has the entry", async () => {
		const { gitignorePath } = buildPaths();
		const { fs, state } = createFakeFs({
			files: new Map([[gitignorePath, "node_modules\n.gatomia/worktrees/\n"]]),
		});
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await service.create(SESSION_ID);

		const contents = state.files.get(gitignorePath);
		expect(contents).toBe("node_modules\n.gatomia/worktrees/\n");
	});

	it("creates .gitignore when missing", async () => {
		const { gitignorePath } = buildPaths();
		const { fs, state } = createFakeFs();
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await service.create(SESSION_ID);

		expect(state.files.get(gitignorePath)).toContain(".gatomia/worktrees/");
	});

	it("throws WorktreeCreateError('path-occupied') when the target directory already exists", async () => {
		const { absolutePath } = buildPaths();
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "path-occupied",
		});
	});

	it("throws WorktreeCreateError('branch-exists') when the branch already exists", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({
			responder: (args) => {
				if (args[0] === "show-ref") {
					return ok("refs/heads/gatomia/agent-chat/session-abc-123");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "branch-exists",
		});
	});

	it("throws WorktreeCreateError('not-a-git-repo') when rev-parse --show-toplevel fails", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({
			responder: (args) => {
				if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
					return err("fatal: not a git repository");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "not-a-git-repo",
		});
	});

	it("throws WorktreeCreateError('ambiguous-workspace-root') when resolver returns ambiguous", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ambiguous" }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "ambiguous-workspace-root",
		});
	});

	it("single-root workspace: resolver returns ok, worktree created", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});
		const handle = await service.create(SESSION_ID);
		expect(handle.absolutePath.startsWith(REPO_ROOT)).toBe(true);
	});

	it("trigger-resolved multi-root: resolver's root wins even if 'first' folder is elsewhere", async () => {
		// The resolver is responsible for disambiguation; the service simply
		// uses whatever root the resolver returns.
		const otherRoot = "/tmp/other-repo";
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: otherRoot }),
			telemetry,
		});
		const handle = await service.create(SESSION_ID);
		expect(handle.absolutePath).toBe(
			`${otherRoot}/.gatomia/worktrees/${SESSION_ID}/`
		);
	});

	it("throws WorktreeCreateError('no-head') when rev-parse HEAD fails", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({
			responder: (args) => {
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return err("fatal: bad revision");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "no-head",
		});
	});

	it("emits worktree.failed telemetry when git worktree add fails", async () => {
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({
			responder: (args) => {
				if (args[0] === "worktree" && args[1] === "add") {
					return err("fatal: could not create worktree");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(service.create(SESSION_ID)).rejects.toMatchObject({
			name: "WorktreeCreateError",
			code: "git-worktree-add-failed",
		});
		expect(telemetry).toHaveBeenCalledWith(
			"agent-chat.worktree.failed",
			expect.objectContaining({
				sessionId: SESSION_ID,
				code: "git-worktree-add-failed",
			})
		);
	});
});

// ----------------------------------------------------------------------------
// T059b — inspect
// ----------------------------------------------------------------------------

describe("AgentWorktreeService.inspect()", () => {
	let telemetry: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		telemetry = vi.fn();
	});

	const { absolutePath, branchName } = buildPaths();
	const HANDLE = {
		id: SESSION_ID,
		absolutePath,
		branchName,
		baseCommitSha: BASE_SHA,
		status: "in-use" as const,
		createdAt: 0,
	};

	it("reports uncommittedPaths from `git status --porcelain`", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({
			responder: defaultResponder({
				statusPorcelain: " M src/a.ts\n?? src/b.ts\n",
			}),
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		const result = await service.inspect(HANDLE);
		expect(result.uncommittedPaths).toEqual([" M src/a.ts", "?? src/b.ts"]);
		expect(result.isClean).toBe(false);
	});

	it("reports unpushedCommits from `git rev-list --count <base>..HEAD`", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({
			responder: defaultResponder({ revListCount: "3" }),
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		const result = await service.inspect(HANDLE);
		expect(result.unpushedCommits).toBe(3);
		expect(result.isClean).toBe(false);
	});

	it("returns isClean=true when no uncommitted files and branch at base", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		const result = await service.inspect(HANDLE);
		expect(result).toStrictEqual({
			uncommittedPaths: [],
			unpushedCommits: 0,
			isClean: true,
		});
	});

	it("self-repair: returns isClean with unpushedCommits=0 when the directory is gone", async () => {
		const { fs } = createFakeFs(); // directory absent
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		const result = await service.inspect(HANDLE);
		expect(result.isClean).toBe(true);
		expect(result.unpushedCommits).toBe(0);
	});
});

// ----------------------------------------------------------------------------
// T059c — cleanup + self-repair
// ----------------------------------------------------------------------------

describe("AgentWorktreeService.cleanup()", () => {
	let telemetry: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		telemetry = vi.fn();
	});

	const { absolutePath, branchName } = buildPaths();
	const HANDLE = {
		id: SESSION_ID,
		absolutePath,
		branchName,
		baseCommitSha: BASE_SHA,
		status: "in-use" as const,
		createdAt: 0,
	};

	it("throws WorktreeCleanupWarningRequired on dirty tree without confirmation", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({
			responder: defaultResponder({ revListCount: "2" }),
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(
			service.cleanup(HANDLE, { confirmedDestructive: false })
		).rejects.toMatchObject({
			name: "WorktreeCleanupWarningRequired",
			inspection: { isClean: false, unpushedCommits: 2 },
		});
	});

	it("succeeds on dirty tree when the caller confirms destructive cleanup", async () => {
		const invocations: string[][] = [];
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({
			responder: defaultResponder({ revListCount: "1" }),
			onInvocation: (args) => invocations.push(args),
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await service.cleanup(HANDLE, { confirmedDestructive: true });

		expect(invocations).toContainEqual([
			"worktree",
			"remove",
			"--force",
			absolutePath,
		]);
		expect(invocations).toContainEqual(["branch", "-D", branchName]);
		expect(telemetry).toHaveBeenCalledWith(
			"agent-chat.worktree.cleaned",
			expect.objectContaining({
				sessionId: SESSION_ID,
				hadUncommittedChanges: true,
			})
		);
	});

	it("succeeds on a clean tree without confirmation", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({ responder: defaultResponder() });
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(
			service.cleanup(HANDLE, { confirmedDestructive: false })
		).resolves.toBeUndefined();
	});

	it("self-repair: cleanup succeeds when worktree dir was deleted out of band", async () => {
		// Directory absent → inspect returns clean → cleanup proceeds.
		const { fs } = createFakeFs();
		const git = createFakeGitRunner({
			responder: (args) => {
				// Simulate `git worktree remove` failing because the dir is gone,
				// but `git branch -D` still needs to run for the orphan branch.
				if (args[0] === "worktree" && args[1] === "remove") {
					return err("fatal: not a working tree");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(
			service.cleanup(HANDLE, { confirmedDestructive: false })
		).resolves.toBeUndefined();
		expect(telemetry).toHaveBeenCalledWith(
			"agent-chat.worktree.abandoned",
			expect.objectContaining({ sessionId: SESSION_ID })
		);
	});

	it("throws WorktreeCleanupError when git worktree remove fails on a present directory", async () => {
		const { fs } = createFakeFs({ dirs: new Set([absolutePath]) });
		const git = createFakeGitRunner({
			responder: (args) => {
				if (args[0] === "worktree" && args[1] === "remove") {
					return err("fatal: contains modified or untracked files");
				}
				return defaultResponder()(args, REPO_ROOT);
			},
		});
		const service = new AgentWorktreeService({
			git,
			fs,
			resolver: createResolver({ kind: "ok", root: REPO_ROOT }),
			telemetry,
		});

		await expect(
			service.cleanup(HANDLE, { confirmedDestructive: true })
		).rejects.toMatchObject({
			name: "WorktreeCleanupError",
			code: "git-worktree-remove-failed",
		});
	});
});

// ----------------------------------------------------------------------------
// Error class smoke tests (avoid dead-code drift in exports)
// ----------------------------------------------------------------------------

describe("Worktree error classes", () => {
	it("WorktreeCreateError preserves code and message", () => {
		const e = new WorktreeCreateError("not-a-git-repo", "msg");
		expect(e.name).toBe("WorktreeCreateError");
		expect(e.code).toBe("not-a-git-repo");
		expect(e.message).toBe("msg");
	});

	it("WorktreeCleanupError preserves code and message", () => {
		const e = new WorktreeCleanupError("git-worktree-remove-failed", "msg");
		expect(e.name).toBe("WorktreeCleanupError");
		expect(e.code).toBe("git-worktree-remove-failed");
	});

	it("WorktreeCleanupWarningRequired carries the inspection", () => {
		const inspection = {
			uncommittedPaths: [" M a.ts"],
			unpushedCommits: 1,
			isClean: false,
		};
		const e = new WorktreeCleanupWarningRequired(inspection);
		expect(e.name).toBe("WorktreeCleanupWarningRequired");
		expect(e.inspection).toEqual(inspection);
	});
});
