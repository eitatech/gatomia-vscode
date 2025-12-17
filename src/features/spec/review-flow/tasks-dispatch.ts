/**
 * Service for dispatching change requests to the tasks prompt.
 * Simulates API interaction with latency and error handling.
 */

import { logTasksDispatchSuccess, logTasksDispatchFailed } from "./telemetry";
import type { Specification, ChangeRequest, TaskLink } from "./types";

export interface TasksPromptPayload {
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

export interface TasksPromptResponse {
	tasks: Array<{
		taskId: string;
		title: string;
		description: string;
	}>;
	success: boolean;
	message?: string;
}

/**
 * Converts API response tasks to TaskLink objects for storage.
 */
export function convertResponseToTaskLinks(
	response: TasksPromptResponse
): TaskLink[] {
	return response.tasks.map((t) => ({
		taskId: t.taskId,
		source: "tasksPrompt",
		status: "open",
		createdAt: new Date(),
	}));
}

/**
 * Builds the payload for the tasks prompt from spec and change request.
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
		},
		notes: changeRequest.notes,
	};
}

/**
 * Dispatches a change request to the tasks prompt.
 * Currently a mock implementation simulating network latency and potential failures.
 */
export async function dispatchToTasksPrompt(
	payload: TasksPromptPayload
): Promise<TasksPromptResponse> {
	const startTime = Date.now();

	// Simulate network latency (500-1500ms)
	const latency = 500 + Math.random() * 1000;
	await new Promise((resolve) => setTimeout(resolve, latency));

	try {
		// Mock logic: 10% chance of failure to test error handling
		// In production, this would be a real API call
		// For demo/dev purposes, we might want to control this via config or environment
		const shouldFail = Math.random() < 0.1;

		if (shouldFail) {
			throw new Error("Tasks prompt service unavailable (simulated)");
		}

		// Mock successful response
		const response: TasksPromptResponse = {
			success: true,
			tasks: [
				{
					taskId: `task-${Date.now()}-1`,
					title: `Fix: ${payload.changeRequestTitle}`,
					description: `Address the feedback: ${payload.changeRequestDescription}`,
				},
				{
					taskId: `task-${Date.now()}-2`,
					title: "Verify changes",
					description: "Verify that the changes meet the requirements",
				},
			],
		};

		logTasksDispatchSuccess(
			payload.specId,
			payload.changeRequestId,
			response.tasks.length,
			Date.now() - startTime
		);

		return response;
	} catch (error: any) {
		const errorMessage = error.message || "Unknown error";
		logTasksDispatchFailed(
			payload.specId,
			payload.changeRequestId,
			errorMessage,
			true // retryable
		);

		return {
			success: false,
			tasks: [],
			message: errorMessage,
		};
	}
}
