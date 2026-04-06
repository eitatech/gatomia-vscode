/**
 * Merge Conflict Detection and Notification
 *
 * Detects potential merge conflicts by checking if the working branch
 * has diverged from the remote after Devin creates commits.
 *
 * @see specs/001-devin-integration/spec.md (Edge Case: Merge conflicts)
 */

import { window } from "vscode";
import { logWarn } from "./logging";

/**
 * Notify the user about a potential merge conflict after Devin session completes.
 *
 * @param branch - The branch Devin was working on
 * @param prUrl - The PR URL if available
 */
export async function notifyPotentialMergeConflict(
	branch: string,
	prUrl?: string
): Promise<void> {
	logWarn(`Potential merge conflict on branch '${branch}'`);

	const actions: string[] = ["Dismiss"];
	if (prUrl) {
		actions.unshift("View PR");
	}

	const result = await window.showWarningMessage(
		`Devin's changes on branch '${branch}' may have merge conflicts. Please review before merging.`,
		...actions
	);

	if (result === "View PR" && prUrl) {
		const { env, Uri } = await import("vscode");
		await env.openExternal(Uri.parse(prUrl));
	}
}
