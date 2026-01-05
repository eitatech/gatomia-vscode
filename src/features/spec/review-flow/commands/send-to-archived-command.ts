/**
 * VS Code command handlers for Archive and Unarchive actions (User Story 3).
 * Handles spec transition between Review ↔ Archived ↔ Reopened statuses.
 */

import { window } from "vscode";
import { archiveSpec, unarchiveSpec, canArchive, getSpecState } from "../state";
import type { Specification } from "../types";
import { resolveSpecIdFromCommandArg } from "./spec-command-args";

export const SEND_TO_ARCHIVED_COMMAND_ID = "gatomia.spec.sendToArchived";
export const UNARCHIVE_COMMAND_ID = "gatomia.spec.unarchive";

/**
 * Helper to generate blocker messages for archival
 */
function isInReviewStatus(spec: Specification): boolean {
	return spec.status === "review" || spec.status === "readyToReview";
}

function addStatusBlocker(blockers: string[], spec: Specification): void {
	if (isInReviewStatus(spec)) {
		return;
	}
	blockers.push(`spec status is "${spec.status}" (must be in review)`);
}

function addPendingTasksBlocker(
	blockers: string[],
	pendingTasks: number
): void {
	if (pendingTasks <= 0) {
		return;
	}
	blockers.push(`${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"}`);
}

function addPendingChecklistItemsBlocker(
	blockers: string[],
	pendingChecklistItems: number
): void {
	if (pendingChecklistItems <= 0) {
		return;
	}
	blockers.push(
		`${pendingChecklistItems} pending checklist item${pendingChecklistItems === 1 ? "" : "s"}`
	);
}

function addOpenChangeRequestsBlocker(
	blockers: string[],
	openChangeRequests: number
): void {
	if (openChangeRequests <= 0) {
		return;
	}
	blockers.push(
		`${openChangeRequests} open change request${openChangeRequests === 1 ? "" : "s"}`
	);
}

function addIncompleteTasksInChangeRequestsBlocker(
	blockers: string[],
	incompleteTasksInChangeRequests: boolean
): void {
	if (!incompleteTasksInChangeRequests) {
		return;
	}
	blockers.push("incomplete tasks in change requests");
}

function getBlockerMessages(spec: Specification): string[] {
	const blockers: string[] = [];
	addStatusBlocker(blockers, spec);

	const pendingTasks = spec.pendingTasks ?? 0;
	addPendingTasksBlocker(blockers, pendingTasks);

	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	addPendingChecklistItemsBlocker(blockers, pendingChecklistItems);

	const openChangeRequests =
		spec.changeRequests?.filter((cr) => cr.status !== "addressed").length ?? 0;
	addOpenChangeRequestsBlocker(blockers, openChangeRequests);

	const incompleteTasksInChangeRequests =
		spec.changeRequests?.some(
			(cr) => cr.tasks?.some((t) => t.status !== "done") ?? false
		) ?? false;
	addIncompleteTasksInChangeRequestsBlocker(
		blockers,
		incompleteTasksInChangeRequests
	);

	return blockers;
}

/**
 * Handle Send to Archived action for a spec
 * @param specId Spec identifier
 * @param refreshCallback Optional callback to refresh the Spec Explorer
 */
export async function handleSendToArchived(
	specArg: unknown,
	refreshCallback?: () => void
): Promise<void> {
	const specId = resolveSpecIdFromCommandArg(specArg);
	if (!specId) {
		await window.showErrorMessage("Cannot archive spec: Spec not found");
		return;
	}

	const existingSpec = getSpecState(specId);
	if (!existingSpec) {
		await window.showErrorMessage("Cannot archive spec: Spec not found");
		return;
	}

	// Check gating conditions
	if (!canArchive(specId)) {
		// Get spec to build detailed error message
		const spec = existingSpec;
		let blockers: string[] = [];

		if (spec) {
			blockers = getBlockerMessages(spec);
		}

		const blockerMessage =
			blockers.length > 0
				? blockers.join(", ")
				: "blocked (please refresh and try again)";
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
	specArg: unknown,
	refreshCallback?: () => void,
	options?: { initiatedBy?: string; reason?: string }
): Promise<void> {
	const specId = resolveSpecIdFromCommandArg(specArg);
	if (!specId) {
		await window.showErrorMessage(
			"Spec not found. Please refresh and try again."
		);
		return;
	}

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
