/**
 * PR Review Integration
 *
 * Provides functionality for reviewing Devin-created pull requests
 * directly from VS Code, including approve, request changes, and merge actions.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L170-L179
 */

import { Uri, env, window } from "vscode";
import type { DevinSession } from "./entities";
import type { PullRequestState } from "./types";
import { openPullRequest, getPrActionLabel } from "./pr-link-handler";

// ============================================================================
// PR Review Actions
// ============================================================================

/**
 * Available actions for a pull request based on its current state.
 */
export type PrAction =
	| "review"
	| "approve"
	| "request-changes"
	| "merge"
	| "view";

/**
 * Get available actions for a PR based on its state.
 *
 * @param state - The current PR state
 * @returns Array of available actions
 */
export function getAvailablePrActions(
	state: PullRequestState | undefined
): PrAction[] {
	if (state === "merged" || state === "closed") {
		return ["view"];
	}
	return ["review", "approve", "request-changes", "merge"];
}

/**
 * Get a human-readable label for a PR action.
 *
 * @param action - The PR action
 * @returns A display label
 */
export function getPrActionDisplayLabel(action: PrAction): string {
	const labels: Record<PrAction, string> = {
		review: "Review PR",
		approve: "Approve",
		"request-changes": "Request Changes",
		merge: "Merge",
		view: "View PR",
	};
	return labels[action];
}

// ============================================================================
// PR Review Flow
// ============================================================================

/**
 * Show a quick pick menu with available PR actions for a session.
 *
 * @param session - The Devin session containing PRs
 * @returns The selected action, or undefined if cancelled
 */
export async function showPrActionMenu(
	session: DevinSession
): Promise<PrAction | undefined> {
	if (session.pullRequests.length === 0) {
		await window.showWarningMessage("No pull requests found for this session.");
		return;
	}

	const firstPr = session.pullRequests[0];
	const actions = getAvailablePrActions(firstPr.prState);

	const items = actions.map((action) => ({
		label: getPrActionDisplayLabel(action),
		action,
	}));

	const selected = await window.showQuickPick(items, {
		placeHolder: `PR: ${firstPr.prUrl}`,
		title: "Pull Request Actions",
	});

	return selected?.action;
}

/**
 * Execute a PR action for a session.
 *
 * All actions currently open the PR URL in the browser since
 * GitHub/GitLab review operations require the web interface.
 * This provides a consistent entry point that can be extended
 * with deeper VCS integration in the future.
 *
 * @param session - The Devin session
 * @param action - The action to execute
 */
export async function executePrAction(
	session: DevinSession,
	action: PrAction
): Promise<void> {
	if (session.pullRequests.length === 0) {
		return;
	}

	const firstPr = session.pullRequests[0];

	switch (action) {
		case "review":
		case "approve":
		case "request-changes":
		case "merge":
		case "view": {
			await openPullRequest(firstPr.prUrl);
			break;
		}
		default:
			break;
	}
}

/**
 * Show PR review notification with action buttons.
 * Used when a session completes with a PR ready for review.
 *
 * @param session - The completed Devin session
 */
export async function showPrReviewNotification(
	session: DevinSession
): Promise<void> {
	if (session.pullRequests.length === 0) {
		return;
	}

	const firstPr = session.pullRequests[0];
	const label = getPrActionLabel(firstPr.prState);
	const taskTitle =
		session.tasks.length > 0 ? session.tasks[0].title : "Devin task";

	const choice = await window.showInformationMessage(
		`Devin completed "${taskTitle}" and created a pull request.`,
		label,
		"Open in Devin"
	);

	if (choice === label) {
		await openPullRequest(firstPr.prUrl);
	} else if (choice === "Open in Devin" && session.devinUrl) {
		await env.openExternal(Uri.parse(session.devinUrl));
	}
}
