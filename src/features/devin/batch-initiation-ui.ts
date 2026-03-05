/**
 * Batch Initiation Confirmation Dialog
 *
 * Shows a confirmation dialog before delegating all tasks to Devin.
 * Displays task count, branch info, and lets the user confirm or cancel.
 *
 * @see specs/001-devin-integration/quickstart.md:L49-L54
 */

import { window } from "vscode";

// ============================================================================
// Types
// ============================================================================

/**
 * Details shown in the batch confirmation dialog.
 */
export interface BatchConfirmationDetails {
	readonly taskCount: number;
	readonly taskIds: string[];
	readonly branch: string;
	readonly repoUrl: string;
	readonly specPath: string;
}

// ============================================================================
// Confirmation Dialog
// ============================================================================

/**
 * Show a confirmation dialog before delegating all tasks to Devin.
 *
 * @param details - Batch details to display
 * @returns true if the user confirmed, false if cancelled
 */
export async function confirmBatchInitiation(
	details: BatchConfirmationDetails
): Promise<boolean> {
	const message = [
		`Delegate ${details.taskCount} tasks to Devin?`,
		"",
		`Tasks: ${details.taskIds.join(", ")}`,
		`Branch: ${details.branch}`,
		`Repo: ${details.repoUrl}`,
	].join("\n");

	const result = await window.showInformationMessage(
		message,
		{ modal: true },
		"Start All"
	);

	return result === "Start All";
}

/**
 * Show a notification with batch results.
 */
export async function showBatchResultNotification(
	successCount: number,
	failCount: number
): Promise<void> {
	if (failCount === 0) {
		await window.showInformationMessage(
			`All ${successCount} Devin sessions started successfully.`
		);
	} else {
		await window.showWarningMessage(
			`Batch complete: ${successCount} succeeded, ${failCount} failed. Check the progress panel for details.`
		);
	}
}
