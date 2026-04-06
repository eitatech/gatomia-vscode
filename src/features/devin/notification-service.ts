/**
 * Notification Service for Devin Completion Events
 *
 * Shows VS Code notifications when Devin sessions complete, fail, or
 * produce pull requests. Provides actionable buttons for next steps.
 *
 * @see specs/001-devin-integration/quickstart.md:L67-L73
 */

import { env, Uri, window } from "vscode";
import type { StatusChangeEvent } from "./devin-polling-service";
import { SessionStatus } from "./types";
import { DEVIN_COMMANDS } from "./config";

// ============================================================================
// Notification Service
// ============================================================================

/**
 * Handle a status change event and show appropriate notifications.
 */
export async function notifyStatusChange(
	event: StatusChangeEvent,
	devinUrl?: string
): Promise<void> {
	if (event.status === SessionStatus.COMPLETED) {
		await notifySessionCompleted(event.localId, devinUrl);
	} else if (event.status === SessionStatus.FAILED) {
		await notifySessionFailed(event.localId);
	}
}

/**
 * Notify the user that a session completed successfully.
 */
async function notifySessionCompleted(
	localId: string,
	devinUrl?: string
): Promise<void> {
	const actions: string[] = ["View Progress"];
	if (devinUrl) {
		actions.push("Open in Devin");
	}

	const result = await window.showInformationMessage(
		"Devin session completed successfully!",
		...actions
	);

	if (result === "View Progress") {
		const { commands } = await import("vscode");
		await commands.executeCommand(DEVIN_COMMANDS.OPEN_PROGRESS);
	} else if (result === "Open in Devin" && devinUrl) {
		await env.openExternal(Uri.parse(devinUrl));
	}
}

/**
 * Notify the user that a session failed.
 */
async function notifySessionFailed(localId: string): Promise<void> {
	const result = await window.showErrorMessage(
		"Devin session failed. Check the progress panel for details.",
		"View Progress"
	);

	if (result === "View Progress") {
		const { commands } = await import("vscode");
		await commands.executeCommand(DEVIN_COMMANDS.OPEN_PROGRESS);
	}
}

/**
 * Notify that a PR was created by Devin.
 */
export async function notifyPrCreated(prUrl: string): Promise<void> {
	const result = await window.showInformationMessage(
		"Devin created a pull request!",
		"Open PR"
	);

	if (result === "Open PR") {
		await env.openExternal(Uri.parse(prUrl));
	}
}
