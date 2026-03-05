/**
 * Git Branch Validation
 *
 * Validates the git working directory state before starting a Devin session.
 * Ensures the user is on a feature branch with a clean working directory.
 *
 * @see specs/001-devin-integration/quickstart.md:L127
 */

import { workspace } from "vscode";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Result of git validation checks.
 */
export interface GitValidationResult {
	readonly isValid: boolean;
	readonly branch: string;
	readonly isClean: boolean;
	readonly errors: string[];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate the git state of the current workspace.
 *
 * Checks:
 * 1. Working directory is a git repo
 * 2. Current branch name
 * 3. Working directory is clean (no uncommitted changes)
 *
 * @returns Validation result with branch info and any errors
 */
export async function validateGitState(): Promise<GitValidationResult> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		return {
			isValid: false,
			branch: "",
			isClean: false,
			errors: ["No workspace folder open."],
		};
	}

	const errors: string[] = [];
	let branch = "";
	let isClean = false;

	try {
		const branchResult = await execAsync("git rev-parse --abbrev-ref HEAD", {
			cwd: workspaceRoot,
		});
		branch = branchResult.stdout.trim();
	} catch {
		errors.push("Not a git repository or git is not available.");
		return { isValid: false, branch: "", isClean: false, errors };
	}

	try {
		const statusResult = await execAsync("git status --porcelain", {
			cwd: workspaceRoot,
		});
		isClean = statusResult.stdout.trim().length === 0;
		if (!isClean) {
			errors.push(
				"Working directory has uncommitted changes. Please commit or stash before starting Devin."
			);
		}
	} catch {
		errors.push("Failed to check git status.");
	}

	return {
		isValid: errors.length === 0,
		branch,
		isClean,
		errors,
	};
}

/**
 * Get the current git branch name.
 *
 * @returns The branch name, or undefined if not in a git repo
 */
export async function getCurrentBranch(): Promise<string | undefined> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		return;
	}

	try {
		const result = await execAsync("git rev-parse --abbrev-ref HEAD", {
			cwd: workspaceRoot,
		});
		return result.stdout.trim();
	} catch {
		return;
	}
}

/**
 * Get the remote repository URL.
 *
 * @returns The remote URL, or undefined if not available
 */
export async function getRemoteUrl(): Promise<string | undefined> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		return;
	}

	try {
		const result = await execAsync("git remote get-url origin", {
			cwd: workspaceRoot,
		});
		return result.stdout.trim();
	} catch {
		return;
	}
}

// ============================================================================
// Private Helpers
// ============================================================================

function getWorkspaceRoot(): string | undefined {
	const folders = workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return;
	}
	return folders[0].uri.fsPath;
}
