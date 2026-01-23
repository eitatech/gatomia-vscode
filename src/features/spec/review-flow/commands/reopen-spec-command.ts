/**
 * VS Code command handler for Reopen action.
 * Moves a spec from Review back to Current Specs (status: reopened).
 */

import { window } from "vscode";
import { getSpecState, updateSpecStatus } from "../state";
import { resolveSpecIdFromCommandArg } from "./spec-command-args";

export const REOPEN_SPEC_COMMAND_ID = "gatomia.spec.reopen";

export async function handleReopenSpec(
	specArg: unknown,
	refreshCallback?: () => void
): Promise<void> {
	const specId = resolveSpecIdFromCommandArg(specArg);
	if (!specId) {
		await window.showErrorMessage(
			"Spec not found. Please refresh and try again."
		);
		return;
	}

	const spec = getSpecState(specId);
	if (!spec) {
		await window.showErrorMessage(
			"Spec not found. Please refresh and try again."
		);
		return;
	}

	if (spec.status !== "review") {
		await window.showErrorMessage(
			"Cannot reopen: spec is not in review status."
		);
		return;
	}

	const result = updateSpecStatus(specId, "reopened");
	if (!result) {
		await window.showErrorMessage("Failed to reopen spec. Please try again.");
		return;
	}

	await window.showInformationMessage(
		`Spec "${result.title}" reopened and moved to Current Specs.`
	);

	refreshCallback?.();
}
