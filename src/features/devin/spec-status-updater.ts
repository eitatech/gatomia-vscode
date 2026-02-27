/**
 * Spec Status Updater
 *
 * Updates task status in spec/tasks.md files when a Devin PR is merged.
 * Marks the corresponding task as completed in the markdown checkbox format.
 *
 * @see specs/001-devin-integration/data-model.md:L108-L119
 */

import { Uri, workspace } from "vscode";
import { isAbsolute, join } from "node:path";
import type { PullRequest } from "./entities";

// ============================================================================
// Spec Task Status Update
// ============================================================================

/**
 * Update a spec task's checkbox status to completed when its PR is merged.
 *
 * Reads the tasks file, finds the task line by ID, and marks it as [x].
 *
 * @param specPath - Relative path to the tasks file in the workspace
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
