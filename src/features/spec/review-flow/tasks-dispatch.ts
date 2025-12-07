/**
 * Tasks prompt dispatch service
 * Handles sending change requests to tasks prompt and processing responses
 */

import type { ChangeRequest, Specification, TaskLink } from "./types";
import { logTasksDispatchFailed, logTasksDispatchSuccess } from "./telemetry";

/**
 * Payload structure for tasks prompt
 */
interface TasksPromptPayload {
	specId: string;
	specTitle: string;
	specPath: string;
	changeRequestId: string;
	changeRequestTitle: string;
	changeRequestDescription: string;
	severity: string;
	submitter: string;
	context: {
		specLink: string;
		changeRequestLink?: string;
	};
	notes?: string;
}

/**
 * Response from tasks prompt
 */
interface TasksPromptResponse {
	success: boolean;
	tasks: Array<{
		taskId: string;
		title: string;
		description: string;
	}>;
	message?: string;
}

/**
 * Build structured payload for tasks prompt from spec and change request
 */
export function buildTasksPromptPayload(
	spec: Specification,
	changeRequest: ChangeRequest
): TasksPromptPayload {
	return {
		specId: spec.id,
		specTitle: spec.title,
		specPath: spec.links.specPath,
		changeRequestId: changeRequest.id,
		changeRequestTitle: changeRequest.title,
		changeRequestDescription: changeRequest.description,
		severity: changeRequest.severity,
		submitter: changeRequest.submitter,
		context: {
			specLink: spec.links.docUrl || spec.links.specPath,
			changeRequestLink: undefined,
		},
		notes: changeRequest.notes,
	};
}

/**
 * Dispatch change request to tasks prompt
 * @param spec Specification context
 * @param changeRequest Change request to dispatch
 * @returns Promise with tasks or error
 */
export function dispatchToTasksPrompt(
	spec: Specification,
	changeRequest: ChangeRequest
): Promise<TasksPromptResponse> {
	const payload = buildTasksPromptPayload(spec, changeRequest);
	const startTime = Date.now();

	try {
		// TODO: Integrate with actual tasks prompt API
		// For now, simulate a successful response
		// const response = await callTasksPromptAPI(payload);

		// Simulated response for testing
		const mockResponse: TasksPromptResponse = {
			success: true,
			tasks: [
				{
					taskId: `task-${changeRequest.id}-001`,
					title: `Address: ${changeRequest.title}`,
					description: changeRequest.description,
				},
			],
		};

		const roundtripMs = Date.now() - startTime;
		logTasksDispatchSuccess(
			spec.id,
			changeRequest.id,
			mockResponse.tasks.length,
			roundtripMs
		);

		return Promise.resolve(mockResponse);
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Tasks prompt service unavailable";

		logTasksDispatchFailed(spec.id, changeRequest.id, errorMessage, true);

		// Handle network errors, timeouts, etc.
		return Promise.resolve({
			success: false,
			tasks: [],
			message: errorMessage,
		});
	}
}

/**
 * Convert tasks prompt response to TaskLink array
 */
export function convertResponseToTaskLinks(
	response: TasksPromptResponse
): TaskLink[] {
	if (!response.success) {
		return [];
	}

	return response.tasks.map((task) => ({
		taskId: task.taskId,
		source: "tasksPrompt" as const,
		status: "open" as const,
		createdAt: new Date(),
	}));
}

/**
 * Check if change request can be retried (is in blocked state)
 */
export function canRetry(changeRequest: ChangeRequest): boolean {
	return changeRequest.status === "blocked";
}
