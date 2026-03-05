/**
 * Spec Status Updater
 *
 * Updates task status in spec/tasks.md files when Devin sessions complete
 * or when a Devin PR is merged. Marks the corresponding tasks as completed
 * in the markdown checkbox format.
 *
 * @see specs/001-devin-integration/data-model.md:L108-L119
 */

import { Uri, workspace } from "vscode";
import { dirname, isAbsolute, join } from "node:path";
import type { DevinSession, PullRequest } from "./entities";
import { TaskStatus } from "./types";

// ============================================================================
// Session Completion Sync
// ============================================================================

/**
 * Update spec tasks.md when a Devin session completes.
 *
 * Reads the tasks file referenced by the session's specPath, finds each
 * completed task by its specTaskId, and marks it as [x] in one write.
 *
 * @param session - The completed Devin session
 */
export async function updateSpecTasksOnSessionComplete(
	session: DevinSession
): Promise<void> {
	const completedTaskIds = session.tasks
		.filter((t) => t.status === TaskStatus.COMPLETED)
		.map((t) => t.specTaskId);

	if (completedTaskIds.length === 0) {
		return;
	}

	const tasksPath = resolveTasksFilePath(session.specPath);
	if (!tasksPath) {
		return;
	}

	try {
		const fileUri = Uri.file(tasksPath);
		const fileContent = await workspace.fs.readFile(fileUri);
		let content = new TextDecoder().decode(fileContent);

		for (const taskId of completedTaskIds) {
			content = markTaskAsCompleted(content, taskId);
		}

		const original = new TextDecoder().decode(fileContent);
		if (content === original) {
			return;
		}

		await workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
	} catch {
		// File may not exist or be unreadable; silently skip
	}
}

// ============================================================================
// PR Merge Sync
// ============================================================================

/**
 * Update a spec task's checkbox status to completed when its PR is merged.
 *
 * @param specPath - Path to the spec/tasks file in the workspace
 * @param specTaskId - The spec task ID (e.g., "T001")
 * @param pullRequest - The merged pull request
 */
export async function updateSpecTaskStatusOnMerge(
	specPath: string,
	specTaskId: string,
	pullRequest: PullRequest
): Promise<void> {
	if (pullRequest.prState !== "merged") {
		return;
	}

	const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return;
	}

	try {
		const resolvedPath = isAbsolute(specPath)
			? specPath
			: join(workspaceRoot, specPath);
		const fileUri = Uri.file(resolvedPath);

		const fileContent = await workspace.fs.readFile(fileUri);
		const content = new TextDecoder().decode(fileContent);

		const updated = markTaskAsCompleted(content, specTaskId);
		if (updated === content) {
			return;
		}

		await workspace.fs.writeFile(fileUri, new TextEncoder().encode(updated));
	} catch {
		// File may not exist or be unreadable; silently skip
	}
}

// ============================================================================
// Markdown Task Manipulation
// ============================================================================

/**
 * Mark a task as completed in markdown content by changing `[ ]` to `[x]`.
 *
 * Matches patterns like:
 * - `- [ ] T001 Some task description`
 * - `- [ ] T001 [P] [US1] Some task description`
 *
 * @param content - The full markdown file content
 * @param specTaskId - The task ID to mark as completed
 * @returns The updated content (unchanged if task not found or already completed)
 */
export function markTaskAsCompleted(
	content: string,
	specTaskId: string
): string {
	const escapedId = specTaskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^(- \\[)( )(\\] ${escapedId}\\b)`, "m");

	return content.replace(pattern, "$1x$3");
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve a spec path to an absolute tasks.md file path.
 *
 * If the specPath already points to a tasks.md file, use it directly.
 * Otherwise, look for tasks.md in the same directory.
 */
function resolveTasksFilePath(specPath: string): string | undefined {
	const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return;
	}

	const absolute = isAbsolute(specPath)
		? specPath
		: join(workspaceRoot, specPath);

	if (absolute.endsWith("tasks.md")) {
		return absolute;
	}

	// specPath may point to spec.md or the spec directory; look for tasks.md sibling
	const dir = absolute.endsWith(".md") ? dirname(absolute) : absolute;
	return join(dir, "tasks.md");
}
