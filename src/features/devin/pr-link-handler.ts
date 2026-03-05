/**
 * PR Link Handler
 *
 * Handles opening pull request URLs in the browser and providing
 * user-facing actions for Devin-created pull requests.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L72-L78
 */

import { Uri, env, window } from "vscode";
import type { PullRequest } from "./entities";
import type { PullRequestState } from "./types";

// ============================================================================
// PR URL Operations
// ============================================================================

/**
 * Open a pull request URL in the user's default browser.
 *
 * @param prUrl - The pull request URL to open
 * @returns true if the URL was opened successfully, false otherwise
 */
export async function openPullRequest(prUrl: string): Promise<boolean> {
	if (!prUrl || prUrl.trim().length === 0) {
		return false;
	}

	try {
		const uri = Uri.parse(prUrl);
		return await env.openExternal(uri);
	} catch {
		return false;
	}
}

// ============================================================================
// PR Data Extraction
// ============================================================================

/**
 * Extract valid PR URLs from a list of pull requests.
 *
 * @param pullRequests - Array of PullRequest entities
 * @returns Array of non-empty PR URLs
 */
export function extractPullRequestUrls(pullRequests: PullRequest[]): string[] {
	return pullRequests.map((pr) => pr.prUrl).filter((url) => url.length > 0);
}

/**
 * Get a human-readable action label for a PR based on its state.
 *
 * @param state - The pull request state
 * @returns A label string suitable for buttons/notifications
 */
export function getPrActionLabel(state: PullRequestState | undefined): string {
	if (!state) {
		return "Open PR";
	}

	const labels: Record<PullRequestState, string> = {
		open: "Review PR",
		merged: "View Merged PR",
		closed: "View Closed PR",
	};

	return labels[state] ?? "Open PR";
}

// ============================================================================
// PR User Prompts
// ============================================================================

/**
 * Show a notification prompting the user to take action on available PRs.
 *
 * @param pullRequests - Available pull requests
 * @param taskId - The spec task ID for context
 */
export async function promptUserForPrAction(
	pullRequests: PullRequest[],
	taskId: string
): Promise<void> {
	if (pullRequests.length === 0) {
		return;
	}

	const firstPr = pullRequests[0];
	const label = getPrActionLabel(firstPr.prState);

	const choice = await window.showInformationMessage(
		`Devin completed task ${taskId} and created a pull request.`,
		label
	);

	if (choice === label) {
		await openPullRequest(firstPr.prUrl);
	}
}
