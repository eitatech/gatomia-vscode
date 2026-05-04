/**
 * AgentWorktreeService — per-session git worktrees for Agent Chat Panel (T059).
 *
 * @see specs/018-agent-chat-panel/contracts/worktree-lifecycle.md
 *
 * Responsibilities:
 *   - T059a — create + multi-root resolve + .gitignore seed
 *   - T059b — inspect (uncommitted paths + commits since base)
 *   - T059c — cleanup + self-repair for directories deleted out of band
 *
 * The service is fully dependency-injected so unit tests can exercise the
 * full state machine without spawning git or touching the real filesystem.
 */

import { AGENT_CHAT_TELEMETRY_EVENTS, logTelemetry } from "./telemetry";
import type { WorktreeHandle } from "./types";

// ----------------------------------------------------------------------------
// Injection surface
// ----------------------------------------------------------------------------

export interface GitRunResult {
	stdout: string;
	stderr: string;
	code: number;
}

export interface GitRunner {
	/**
	 * Run `git <args>` in `cwd`. MUST NOT throw on non-zero exit; return the
	 * result and let the caller decide. This matches child_process.spawn
	 * semantics and keeps the service free of exception-handling boilerplate.
	 */
	run(args: string[], cwd: string): Promise<GitRunResult>;
}

export interface FsLike {
	exists(absolutePath: string): Promise<boolean>;
	readFile(absolutePath: string): Promise<string>;
	writeFile(absolutePath: string, content: string): Promise<void>;
	stat(absolutePath: string): Promise<{ isDirectory: boolean } | null>;
}

/**
 * Resolves the repo root to use for a session. Consumers with a trigger
 * context pass it to the resolver; the resolver decides whether the context
 * disambiguates a multi-root workspace, defaults to the sole root, or surfaces
 * ambiguity.
 */
export interface WorkspaceRootResolver {
	resolve(triggerWorkspaceFolder?: string): Promise<WorkspaceRootResolution>;
}

export type WorkspaceRootResolution =
	| { kind: "ok"; root: string }
	| { kind: "ambiguous" }
	| { kind: "not-in-repo" };

export type TelemetryFn = (
	event: string,
	properties: Record<string, string | number | boolean>
) => void;

export interface AgentWorktreeServiceOptions {
	git: GitRunner;
	fs: FsLike;
	resolver: WorkspaceRootResolver;
	telemetry?: TelemetryFn;
	/** Override Date.now() for deterministic tests. */
	now?: () => number;
}

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

export type WorktreeCreateErrorCode =
	| "ambiguous-workspace-root"
	| "not-a-git-repo"
	| "no-head"
	| "path-occupied"
	| "branch-exists"
	| "git-worktree-add-failed";

export class WorktreeCreateError extends Error {
	readonly code: WorktreeCreateErrorCode;

	constructor(code: WorktreeCreateErrorCode, message: string) {
		super(message);
		this.name = "WorktreeCreateError";
		this.code = code;
	}
}

export type WorktreeCleanupErrorCode = "git-worktree-remove-failed";

export class WorktreeCleanupError extends Error {
	readonly code: WorktreeCleanupErrorCode;

	constructor(code: WorktreeCleanupErrorCode, message: string) {
		super(message);
		this.name = "WorktreeCleanupError";
		this.code = code;
	}
}

export interface WorktreeInspection {
	uncommittedPaths: string[];
	unpushedCommits: number;
	isClean: boolean;
}

export class WorktreeCleanupWarningRequired extends Error {
	readonly inspection: WorktreeInspection;

	constructor(inspection: WorktreeInspection) {
		super("Worktree has uncommitted changes or unpushed commits");
		this.name = "WorktreeCleanupWarningRequired";
		this.inspection = inspection;
	}
}

export interface CleanupOptions {
	confirmedDestructive: boolean;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

const WORKTREE_DIR_SEGMENT = ".gatomia/worktrees/";
const BRANCH_PREFIX = "gatomia/agent-chat/";
const GITIGNORE_ENTRY = ".gatomia/worktrees/";
const GITIGNORE_LINE_SPLIT_PATTERN = /\r?\n/;

export class AgentWorktreeService {
	private readonly git: GitRunner;
	private readonly fs: FsLike;
	private readonly resolver: WorkspaceRootResolver;
	private readonly telemetry: TelemetryFn;
	private readonly now: () => number;

	constructor(options: AgentWorktreeServiceOptions) {
		this.git = options.git;
		this.fs = options.fs;
		this.resolver = options.resolver;
		this.telemetry = options.telemetry ?? logTelemetry;
		this.now = options.now ?? Date.now;
	}

	async create(
		sessionId: string,
		triggerWorkspaceFolder?: string
	): Promise<WorktreeHandle> {
		try {
			return await this.createInner(sessionId, triggerWorkspaceFolder);
		} catch (error) {
			if (error instanceof WorktreeCreateError) {
				this.telemetry(AGENT_CHAT_TELEMETRY_EVENTS.WORKTREE_FAILED, {
					sessionId,
					code: error.code,
				});
			}
			throw error;
		}
	}

	private async createInner(
		sessionId: string,
		triggerWorkspaceFolder?: string
	): Promise<WorktreeHandle> {
		// Step 0: multi-root resolve.
		const resolution = await this.resolver.resolve(triggerWorkspaceFolder);
		if (resolution.kind === "ambiguous") {
			throw new WorktreeCreateError(
				"ambiguous-workspace-root",
				"Choose which repository to target for the worktree session."
			);
		}
		if (resolution.kind === "not-in-repo") {
			throw new WorktreeCreateError(
				"not-a-git-repo",
				"Run this inside a git repository."
			);
		}
		const repoRoot = resolution.root;

		// Step 1: ensure git repo.
		const topLevel = await this.git.run(
			["rev-parse", "--show-toplevel"],
			repoRoot
		);
		if (topLevel.code !== 0) {
			throw new WorktreeCreateError(
				"not-a-git-repo",
				"Run this inside a git repository."
			);
		}

		// Step 2: resolve HEAD.
		const head = await this.git.run(["rev-parse", "HEAD"], repoRoot);
		if (head.code !== 0) {
			throw new WorktreeCreateError(
				"no-head",
				"Commit at least once before using worktree mode."
			);
		}
		const baseCommitSha = head.stdout.trim();

		// Step 4: compose paths (we do this before .gitignore so error surface is
		// correct if the path conflicts).
		const absolutePath = `${repoRoot}/${WORKTREE_DIR_SEGMENT}${sessionId}/`;
		const branchName = `${BRANCH_PREFIX}${sessionId}`;

		if (await this.fs.exists(absolutePath)) {
			throw new WorktreeCreateError(
				"path-occupied",
				`Worktree path already exists: ${absolutePath}. Delete it or choose a different session id.`
			);
		}

		const showRef = await this.git.run(
			["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
			repoRoot
		);
		if (showRef.code === 0) {
			throw new WorktreeCreateError(
				"branch-exists",
				`Branch already exists: ${branchName}.`
			);
		}

		// Step 3: ensure .gitignore has the entry (non-fatal).
		await this.ensureGitignore(repoRoot);

		// Step 5: git worktree add.
		const add = await this.git.run(
			["worktree", "add", "-b", branchName, absolutePath, baseCommitSha],
			repoRoot
		);
		if (add.code !== 0) {
			throw new WorktreeCreateError(
				"git-worktree-add-failed",
				add.stderr.trim().length > 0
					? add.stderr
					: "git worktree add failed with no output."
			);
		}

		const handle: WorktreeHandle = {
			id: sessionId,
			absolutePath,
			branchName,
			baseCommitSha,
			status: "created",
			createdAt: this.now(),
		};

		// Step 7: telemetry.
		this.telemetry(AGENT_CHAT_TELEMETRY_EVENTS.WORKTREE_CREATED, {
			sessionId,
			branchName,
			baseCommitSha,
		});

		return handle;
	}

	async inspect(handle: WorktreeHandle): Promise<WorktreeInspection> {
		// Self-repair: if the directory is gone, return clean without shelling
		// out (git would fail with "not a working tree" and mask the anomaly).
		const present = await this.fs.exists(handle.absolutePath);
		if (!present) {
			return {
				uncommittedPaths: [],
				unpushedCommits: 0,
				isClean: true,
			};
		}

		const status = await this.git.run(
			["status", "--porcelain"],
			handle.absolutePath
		);
		if (status.code !== 0) {
			throw new Error(
				`git status --porcelain failed: ${status.stderr || status.stdout}`
			);
		}
		const uncommittedPaths = status.stdout
			.split("\n")
			.map((line) => line.trimEnd())
			.filter((line) => line.length > 0);

		const revList = await this.git.run(
			["rev-list", "--count", `${handle.baseCommitSha}..HEAD`],
			handle.absolutePath
		);
		if (revList.code !== 0) {
			throw new Error(
				`git rev-list --count failed: ${revList.stderr || revList.stdout}`
			);
		}
		const unpushedCommits = Number.parseInt(revList.stdout.trim(), 10);
		if (!Number.isFinite(unpushedCommits)) {
			throw new Error(
				`git rev-list returned non-numeric output: ${revList.stdout}`
			);
		}

		return {
			uncommittedPaths,
			unpushedCommits,
			isClean: uncommittedPaths.length === 0 && unpushedCommits === 0,
		};
	}

	async cleanup(
		handle: WorktreeHandle,
		options: CleanupOptions
	): Promise<void> {
		const inspection = await this.inspect(handle);
		const needsConfirmation =
			!inspection.isClean && options.confirmedDestructive === false;
		if (needsConfirmation) {
			throw new WorktreeCleanupWarningRequired(inspection);
		}

		const directoryPresent = await this.fs.exists(handle.absolutePath);
		if (directoryPresent) {
			const remove = await this.git.run(
				["worktree", "remove", "--force", handle.absolutePath],
				handle.absolutePath
			);
			if (remove.code !== 0) {
				throw new WorktreeCleanupError(
					"git-worktree-remove-failed",
					remove.stderr.trim().length > 0
						? remove.stderr
						: "git worktree remove failed with no output."
				);
			}
		} else {
			// Self-repair: surface the abandonment before running branch -D.
			this.telemetry(AGENT_CHAT_TELEMETRY_EVENTS.WORKTREE_ABANDONED, {
				sessionId: handle.id,
			});
		}

		// Branch removal is best-effort. If the branch is already gone (e.g. the
		// user ran `git branch -D` manually), log and continue.
		await this.git.run(
			["branch", "-D", handle.branchName],
			handle.absolutePath
		);

		this.telemetry(AGENT_CHAT_TELEMETRY_EVENTS.WORKTREE_CLEANED, {
			sessionId: handle.id,
			hadUncommittedChanges: !inspection.isClean,
		});
	}

	// -----------------------------------------------------------------------
	// helpers
	// -----------------------------------------------------------------------

	private async ensureGitignore(repoRoot: string): Promise<void> {
		const gitignorePath = `${repoRoot}/.gitignore`;
		let contents = "";
		try {
			contents = await this.fs.readFile(gitignorePath);
		} catch {
			// Missing file is fine — we'll create it.
		}
		if (
			contents
				.split(GITIGNORE_LINE_SPLIT_PATTERN)
				.some((line) => line === GITIGNORE_ENTRY)
		) {
			return;
		}
		const needsNewline = contents.length > 0 && !contents.endsWith("\n");
		const suffix = needsNewline ? "\n" : "";
		await this.fs.writeFile(
			gitignorePath,
			`${contents}${suffix}${GITIGNORE_ENTRY}\n`
		);
	}
}
