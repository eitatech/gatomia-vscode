/**
 * PR Notification Handler
 *
 * Manages notifications for pull request events from Devin sessions.
 * Shows user-friendly notifications when PRs are created or merged,
 * with action buttons to open PRs in the browser.
 *
 * @see specs/001-devin-integration/data-model.md:L98-L104
 */

import { Uri, env, window } from "vscode";
import type { DevinSession } from "./entities";
import { openPullRequest, getPrActionLabel } from "./pr-link-handler";

// ============================================================================
// PR Notification
// ============================================================================

/**
 * Show a notification when a completed session has pull requests available.
 *
 * @param session - The Devin session to check for PRs
 */
export async function handlePrNotification(
	session: DevinSession
): Promise<void> {
	if (session.pullRequests.length === 0) {
		return;
	}

	const firstPr = session.pullRequests[0];
	const taskTitle =
		session.tasks.length > 0 ? session.tasks[0].title : "Devin task";

	const label = getPrActionLabel(firstPr.prState);
	const actions = [label];

	if (session.devinUrl) {
		actions.push("Open in Devin");
	}

	const choice = await window.showInformationMessage(
		`Pull request available for "${taskTitle}".`,
		...actions
	);

	if (choice === label) {
		await openPullRequest(firstPr.prUrl);
	} else if (choice === "Open in Devin" && session.devinUrl) {
		await env.openExternal(Uri.parse(session.devinUrl));
	}
}

/**
 * Show a notification when a PR state changes (e.g., merged).
 *
 * @param session - The Devin session
 * @param previousState - The previous PR state
 * @param newState - The new PR state
 */
export async function handlePrStateChange(
	session: DevinSession,
	previousState: string | undefined,
	newState: string
): Promise<void> {
	if (session.pullRequests.length === 0) {
		return;
	}

	const taskTitle =
		session.tasks.length > 0 ? session.tasks[0].title : "Devin task";

	if (newState === "merged" && previousState !== "merged") {
		await window.showInformationMessage(
			`Pull request for "${taskTitle}" has been merged.`
		);
	}
}
