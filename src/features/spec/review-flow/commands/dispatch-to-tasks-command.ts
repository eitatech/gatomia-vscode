/**
 * Command: Dispatch change request to tasks prompt
 * Integrates tasks-dispatch service with state management
 */

import {
	commands,
	type ExtensionContext,
	window,
	ProgressLocation,
} from "vscode";
import {
	getSpecState,
	attachTasksToChangeRequest,
	updateChangeRequestStatus,
} from "../state";
import {
	dispatchToTasksPrompt,
	convertResponseToTaskLinks,
	buildTasksPromptPayload,
} from "../tasks-dispatch";

export const DISPATCH_TO_TASKS_COMMAND_ID = "gatomia.spec.dispatchToTasks";

/**
 * Register the dispatch to tasks command
 */
export function registerDispatchToTasksCommand(
	context: ExtensionContext
): void {
	const command = commands.registerCommand(
		DISPATCH_TO_TASKS_COMMAND_ID,
		async (specId: string, changeRequestId: string) => {
			try {
				await dispatchToTasksHandler(specId, changeRequestId);
				window.showInformationMessage(
					"Successfully dispatched change request to tasks"
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error occurred";
				window.showErrorMessage(`Failed to dispatch to tasks: ${message}`);
			}
		}
	);

	context.subscriptions.push(command);
}

/**
 * Handler for dispatching change request to tasks prompt
 */
export async function dispatchToTasksHandler(
	specId: string,
	changeRequestId: string
): Promise<void> {
	// Get spec and change request
	const spec = getSpecState(specId);
	if (!spec) {
		throw new Error(`Spec not found: ${specId}`);
	}

	const changeRequest = spec.changeRequests?.find(
		(cr) => cr.id === changeRequestId
	);
	if (!changeRequest) {
		throw new Error(`Change request not found: ${changeRequestId}`);
	}

	// Verify change request can be dispatched
	if (changeRequest.status !== "open" && changeRequest.status !== "blocked") {
		throw new Error(
			`Change request cannot be dispatched from status: ${changeRequest.status}`
		);
	}

	// Show progress
	await window.withProgress(
		{
			location: ProgressLocation.Notification,
			title: "Dispatching to tasks prompt...",
			cancellable: false,
		},
		async (progress) => {
			progress.report({ increment: 0 });

			// Call tasks prompt API
			const payload = buildTasksPromptPayload(spec, changeRequest);
			const response = await dispatchToTasksPrompt(payload);

			progress.report({ increment: 50 });

			if (!response.success) {
				// Mark as blocked if dispatch failed
				updateChangeRequestStatus(specId, changeRequestId, "blocked");
				throw new Error(response.message || "Tasks prompt service unavailable");
			}

			// Convert response to task links
			const taskLinks = convertResponseToTaskLinks(response);

			progress.report({ increment: 75 });

			// Attach tasks to change request
			const updatedCR = attachTasksToChangeRequest(
				specId,
				changeRequestId,
				taskLinks
			);

			if (!updatedCR) {
				throw new Error("Failed to attach tasks to change request");
			}

			progress.report({ increment: 100 });
		}
	);
}

/**
 * Retry handler for blocked change requests
 */
export function retryDispatchHandler(
	specId: string,
	changeRequestId: string
): Promise<void> {
	// Retry uses the same logic as initial dispatch
	return dispatchToTasksHandler(specId, changeRequestId);
}
