/**
 * VS Code command handler for Send to Review action (User Story 1).
 * Handles spec transition from Current Specs to Review.
 */

import { window } from "vscode";
import { sendToReview, canSendToReview } from "../state";

export const SEND_TO_REVIEW_COMMAND_ID = "gatomia.spec.sendToReview";

/**
 * Handle Send to Review action for a spec
 * @param specId Spec identifier
 * @param refreshCallback Optional callback to refresh the Spec Explorer
 */
export async function handleSendToReview(
	specId: string,
	refreshCallback?: () => void
): Promise<void> {
	// Check gating conditions
	const gatingResult = canSendToReview(specId);

	if (!gatingResult.canSend) {
		// Show error message with blockers
		const blockerMessage = gatingResult.blockers.join(", ");
		await window.showErrorMessage(
			`Cannot send spec to review: ${blockerMessage}`
		);
		return;
	}

	// Attempt to send to review
	const result = sendToReview(specId);

	if (!result) {
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
