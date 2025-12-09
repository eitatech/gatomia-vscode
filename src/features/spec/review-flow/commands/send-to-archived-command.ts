/**
 * VS Code command handlers for Archive and Unarchive actions (User Story 3).
 * Handles spec transition between Review ↔ Archived ↔ Reopened statuses.
 */

import { window } from "vscode";
import { archiveSpec, unarchiveSpec, canArchive, getSpecState } from "../state";
import type { Specification } from "../types";

export const SEND_TO_ARCHIVED_COMMAND_ID = "gatomia.spec.sendToArchived";
export const UNARCHIVE_COMMAND_ID = "gatomia.spec.unarchive";

/**
 * Helper to generate blocker messages for archival
 */
function getBlockerMessages(spec: Specification): string[] {
	const blockers: string[] = [];
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const openChangeRequests =
		spec.changeRequests?.filter((cr) => cr.status !== "addressed").length ?? 0;
	const incompleteTasksInChangeRequests =
		spec.changeRequests?.some((cr) =>
			cr.tasks.some((t) => t.status !== "done")
		) ?? false;

	if (pendingTasks > 0) {
		blockers.push(
			`${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"}`
		);
	}
	if (pendingChecklistItems > 0) {
		blockers.push(
			`${pendingChecklistItems} pending checklist item${pendingChecklistItems === 1 ? "" : "s"}`
		);
	}
	if (openChangeRequests > 0) {
		blockers.push(
			`${openChangeRequests} open change request${openChangeRequests === 1 ? "" : "s"}`
		);
	}
	if (incompleteTasksInChangeRequests) {
		blockers.push("incomplete tasks in change requests");
	}

	return blockers;
}

/**
 * Handle Send to Archived action for a spec
 * @param specId Spec identifier
 * @param refreshCallback Optional callback to refresh the Spec Explorer
 */
export async function handleSendToArchived(
	specId: string,
	refreshCallback?: () => void
): Promise<void> {
	// Check gating conditions
	if (!canArchive(specId)) {
		// Get spec to build detailed error message
		const spec = getSpecState(specId);
		let blockers: string[] = [];

		if (spec) {
			blockers = getBlockerMessages(spec);
		}

		const blockerMessage =
			blockers.length > 0 ? blockers.join(", ") : "unknown blockers";
		await window.showErrorMessage(`Cannot archive spec: ${blockerMessage}`);
		return;
	}

	// Attempt to archive
	const result = archiveSpec(specId);

	if (!result) {
		await window.showErrorMessage("Failed to archive spec. Please try again.");
		return;
	}

	// Show success message
	await window.showInformationMessage(
		`Spec "${result.title}" archived successfully.`
	);

	// Refresh the Spec Explorer view to show updated status
	if (refreshCallback) {
		refreshCallback();
	}
}

/**
 * Handle Unarchive action for a spec
 * @param specId Spec identifier
 * @param refreshCallback Optional callback to refresh the Spec Explorer
 * @param options Optional unarchive options (initiatedBy, reason)
 */
export async function handleUnarchive(
	specId: string,
	refreshCallback?: () => void,
	options?: { initiatedBy?: string; reason?: string }
): Promise<void> {
	// Get spec to show title in messages
	const spec = getSpecState(specId);

	if (!spec) {
		await window.showErrorMessage(
			"Spec not found. Please refresh and try again."
		);
		return;
	}

	if (spec.status !== "archived") {
		await window.showErrorMessage(
			"Cannot unarchive: spec is not in archived status."
		);
		return;
	}

	// Attempt to unarchive
	const result = unarchiveSpec(specId, options);

	if (!result) {
		await window.showErrorMessage(
			"Failed to unarchive spec. Please try again."
		);
		return;
	}

	// Show success message
	await window.showInformationMessage(
		`Spec "${result.title}" unarchived successfully. Status: ${result.status}`
	);

	// Refresh the Spec Explorer view to show updated status
	if (refreshCallback) {
		refreshCallback();
	}
}
