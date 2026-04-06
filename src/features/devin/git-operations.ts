/**
 * Git Operations for Devin Integration
 *
 * Provides git commit and push operations used by the "Run with Devin"
 * workflow. Commits all staged/unstaged changes and pushes to remote
 * before delegating implementation to Devin.
 */

import { workspace } from "vscode";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logInfo, logError } from "./logging";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface GitCommitPushResult {
	readonly success: boolean;
	readonly branch: string;
	readonly commitSha?: string;
	readonly error?: string;
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Stage all changes, commit with a descriptive message, and push to remote.
 *
 * @param taskId - The spec task ID (used in commit message)
 * @param taskTitle - The task title (used in commit message)
 * @returns Result of the git operations
 */
export async function commitAndPush(
	taskId: string,
	taskTitle: string
): Promise<GitCommitPushResult> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		return {
			success: false,
			branch: "",
			error: "No workspace folder open.",
		};
	}

	const execOpts = { cwd: workspaceRoot };

	try {
		const branchResult = await execAsync(
			"git rev-parse --abbrev-ref HEAD",
			execOpts
		);
		const branch = branchResult.stdout.trim();

		logInfo(`[Run with Devin] Starting git commit+push on branch '${branch}'`);

		await execAsync("git add -A", execOpts);

		const statusResult = await execAsync("git status --porcelain", execOpts);
		const hasChanges = statusResult.stdout.trim().length > 0;

		if (hasChanges) {
			const commitMessage = `chore(${taskId}): prepare for Devin - ${taskTitle}`;
			await execAsync(
				`git commit -m ${escapeShellArg(commitMessage)}`,
				execOpts
			);
			logInfo(`[Run with Devin] Committed changes: ${commitMessage}`);
		} else {
			logInfo("[Run with Devin] No changes to commit, pushing existing HEAD");
		}

		const shaResult = await execAsync("git rev-parse HEAD", execOpts);
		const commitSha = shaResult.stdout.trim();

		await execAsync(`git push origin ${branch}`, execOpts);
		logInfo(`[Run with Devin] Pushed branch '${branch}' to origin`);

		return { success: true, branch, commitSha };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		logError("[Run with Devin] Git operation failed", error);
		return { success: false, branch: "", error: message };
	}
}

// ============================================================================
// Helpers
// ============================================================================

function getWorkspaceRoot(): string | undefined {
	const folders = workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return;
	}
	return folders[0].uri.fsPath;
}

function escapeShellArg(arg: string): string {
	return `'${arg.replace(/'/g, "'\\''")}'`;
}
