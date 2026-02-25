/**
 * Task Initiation Confirmation Dialog
 *
 * Shows a confirmation dialog before starting a Devin session.
 * Displays task details, branch info, and lets the user confirm or cancel.
 *
 * @see specs/001-devin-integration/quickstart.md:L42-L47
 */

import { window } from "vscode";

// ============================================================================
// Types
// ============================================================================

/**
 * Details shown in the confirmation dialog.
 */
export interface TaskConfirmationDetails {
	readonly taskId: string;
	readonly title: string;
	readonly branch: string;
	readonly repoUrl: string;
}

// ============================================================================
// Confirmation Dialog
// ============================================================================

/**
 * Show a confirmation dialog before delegating a task to Devin.
 *
 * @param details - Task and branch details to display
 * @returns true if the user confirmed, false if cancelled
 */
export async function confirmTaskInitiation(
	details: TaskConfirmationDetails
): Promise<boolean> {
	const message = [
		`Delegate task ${details.taskId} to Devin?`,
		"",
		`Task: ${details.title}`,
		`Branch: ${details.branch}`,
		`Repo: ${details.repoUrl}`,
	].join("\n");

	const result = await window.showInformationMessage(
		message,
		{ modal: true },
		"Start Devin Session"
	);

	return result === "Start Devin Session";
}

/**
 * Show an error message to the user about git validation failure.
 */
export async function showGitValidationError(errors: string[]): Promise<void> {
	const message = `Cannot start Devin session:\n${errors.join("\n")}`;
	await window.showErrorMessage(message);
}

/**
 * Show a notification that a Devin session has started.
 */
export async function showSessionStartedNotification(
	taskId: string,
	devinUrl?: string
): Promise<void> {
	const actions: string[] = [];
	if (devinUrl) {
		actions.push("Open in Devin");
	}

	const result = await window.showInformationMessage(
		`Devin session started for task ${taskId}.`,
		...actions
	);

	if (result === "Open in Devin" && devinUrl) {
		const { env } = await import("vscode");
		const { Uri } = await import("vscode");
		await env.openExternal(Uri.parse(devinUrl));
	}
}
