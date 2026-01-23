/**
 * VS Code command handler for Send to Review action (User Story 1).
 * Handles spec transition from Current Specs to Review.
 */

import { window } from "vscode";
import { sendToReviewWithTrigger } from "../state";
import { resolveSpecIdFromCommandArg } from "./spec-command-args";

export const SEND_TO_REVIEW_COMMAND_ID = "gatomia.spec.sendToReview";

/**
 * Handle Send to Review action for a spec
 * @param specId Spec identifier
 * @param refreshCallback Optional callback to refresh the Spec Explorer
 */
export async function handleSendToReview(
	specArg: unknown,
	refreshCallback?: () => void
): Promise<void> {
	const specId = resolveSpecIdFromCommandArg(specArg);
	if (!specId) {
		await window.showErrorMessage("Cannot send spec to review: Spec not found");
		return;
	}

	const { result, blockers } = sendToReviewWithTrigger({
		specId,
		triggerType: "manual",
		initiatedBy: "manual-command",
	});

	if (!result) {
		if (blockers.length > 0) {
			const blockerMessage = blockers.join(", ");
			await window.showErrorMessage(
				`Cannot send spec to review: ${blockerMessage}`
			);
			return;
		}

		await window.showErrorMessage(
			"Failed to send spec to review. Please try again."
		);
		return;
	}

	// Show success message
	await window.showInformationMessage(
		`Spec "${result.title}" sent to review successfully.`
	);

	// Refresh the Spec Explorer view to show updated status
	if (refreshCallback) {
		refreshCallback();
	}
}
