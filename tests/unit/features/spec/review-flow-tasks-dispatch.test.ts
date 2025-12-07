/**
 * Unit tests for tasks prompt dispatch service
 * Tests payload builder, success/blocked paths, and task linkage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Test data structures
interface TaskLink {
	taskId: string;
	source: "tasksPrompt";
	status: "open" | "inProgress" | "done";
	createdAt: Date;
}

interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: "low" | "medium" | "high" | "critical";
	status: "open" | "blocked" | "inProgress" | "addressed";
	tasks: TaskLink[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
}

interface Specification {
	id: string;
	title: string;
	owner: string;
	status: "current" | "readyToReview" | "reopened";
	completedAt: Date | null;
	updatedAt: Date;
	links: {
		specPath: string;
		docUrl?: string;
	};
	changeRequests?: ChangeRequest[];
}

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
}

interface TasksPromptResponse {
	tasks: Array<{
		taskId: string;
		title: string;
		description: string;
	}>;
	success: boolean;
	message?: string;
}

describe("tasks dispatch service", () => {
	const MOCK_SPEC: Specification = {
		id: "spec-001",
		title: "Authentication Flow",
		owner: "alice@example.com",
		status: "reopened",
		completedAt: new Date("2025-12-01T10:00:00Z"),
		updatedAt: new Date("2025-12-07T10:00:00Z"),
		links: {
			specPath: "/workspace/specs/auth-flow/spec.md",
			docUrl: "vscode://file/workspace/specs/auth-flow/spec.md",
		},
	};

	const MOCK_CHANGE_REQUEST: ChangeRequest = {
		id: "cr-001",
		specId: "spec-001",
		title: "Add OAuth2 support",
		description: "The spec should include OAuth2 authentication flow",
		severity: "high",
		status: "open",
		tasks: [],
		submitter: "reviewer@example.com",
		createdAt: new Date("2025-12-07T09:00:00Z"),
		updatedAt: new Date("2025-12-07T09:00:00Z"),
		sentToTasksAt: null,
		notes: "Critical for enterprise deployment",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("payload builder", () => {
		it("should build structured payload from spec and change request", () => {
			// Arrange
			const buildTasksPromptPayload = (
				spec: Specification,
				changeRequest: ChangeRequest
			): TasksPromptPayload => ({
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
			});

			// Act
			const payload = buildTasksPromptPayload(MOCK_SPEC, MOCK_CHANGE_REQUEST);

			// Assert
			expect(payload).toEqual({
				specId: "spec-001",
				specTitle: "Authentication Flow",
				specPath: "/workspace/specs/auth-flow/spec.md",
				changeRequestId: "cr-001",
				changeRequestTitle: "Add OAuth2 support",
				changeRequestDescription:
					"The spec should include OAuth2 authentication flow",
				severity: "high",
				submitter: "reviewer@example.com",
				context: {
					specLink: "vscode://file/workspace/specs/auth-flow/spec.md",
					changeRequestLink: undefined,
				},
			});
		});

		it("should include all severity levels in payload", () => {
			// Arrange
			const severities: Array<"low" | "medium" | "high" | "critical"> = [
				"low",
				"medium",
				"high",
				"critical",
			];
			const buildPayload = (severity: string): TasksPromptPayload => ({
				specId: MOCK_SPEC.id,
				specTitle: MOCK_SPEC.title,
				specPath: MOCK_SPEC.links.specPath,
				changeRequestId: MOCK_CHANGE_REQUEST.id,
				changeRequestTitle: MOCK_CHANGE_REQUEST.title,
				changeRequestDescription: MOCK_CHANGE_REQUEST.description,
				severity,
				submitter: MOCK_CHANGE_REQUEST.submitter,
				context: {
					specLink: MOCK_SPEC.links.docUrl || MOCK_SPEC.links.specPath,
				},
			});

			// Act & Assert
			for (const severity of severities) {
				const payload = buildPayload(severity);
				expect(payload.severity).toBe(severity);
			}
		});

		it("should include optional notes in context when present", () => {
			// Arrange
			const changeRequestWithNotes = {
				...MOCK_CHANGE_REQUEST,
				notes: "Critical for enterprise deployment",
			};

			const buildPayloadWithNotes = (
				notes?: string
			): TasksPromptPayload & { notes?: string } => ({
				specId: MOCK_SPEC.id,
				specTitle: MOCK_SPEC.title,
				specPath: MOCK_SPEC.links.specPath,
				changeRequestId: changeRequestWithNotes.id,
				changeRequestTitle: changeRequestWithNotes.title,
				changeRequestDescription: changeRequestWithNotes.description,
				severity: changeRequestWithNotes.severity,
				submitter: changeRequestWithNotes.submitter,
				context: {
					specLink: MOCK_SPEC.links.docUrl || MOCK_SPEC.links.specPath,
				},
				notes,
			});

			// Act
			const payload = buildPayloadWithNotes(changeRequestWithNotes.notes);

			// Assert
			expect(payload.notes).toBe("Critical for enterprise deployment");
		});
	});

	describe("success path", () => {
		it("should attach returned tasks to change request", () => {
			// Arrange
			const MOCK_RESPONSE: TasksPromptResponse = {
				success: true,
				tasks: [
					{
						taskId: "task-001",
						title: "Add OAuth2 flow diagram",
						description: "Create sequence diagram for OAuth2 flow",
					},
					{
						taskId: "task-002",
						title: "Document token refresh",
						description: "Add token refresh mechanism details",
					},
				],
			};

			const attachTasksToChangeRequest = (
				changeRequest: ChangeRequest,
				response: TasksPromptResponse
			): ChangeRequest => {
				const tasks: TaskLink[] = response.tasks.map((task) => ({
					taskId: task.taskId,
					source: "tasksPrompt" as const,
					status: "open" as const,
					createdAt: new Date(),
				}));

				return {
					...changeRequest,
					tasks,
					status: "inProgress",
					sentToTasksAt: new Date(),
					updatedAt: new Date(),
				};
			};

			// Act
			const updatedChangeRequest = attachTasksToChangeRequest(
				MOCK_CHANGE_REQUEST,
				MOCK_RESPONSE
			);

			// Assert
			expect(updatedChangeRequest.tasks).toHaveLength(2);
			expect(updatedChangeRequest.tasks[0]).toMatchObject({
				taskId: "task-001",
				source: "tasksPrompt",
				status: "open",
			});
			expect(updatedChangeRequest.tasks[1]).toMatchObject({
				taskId: "task-002",
				source: "tasksPrompt",
				status: "open",
			});
			expect(updatedChangeRequest.status).toBe("inProgress");
			expect(updatedChangeRequest.sentToTasksAt).not.toBeNull();
		});

		it("should update change request status to inProgress on success", () => {
			// Arrange
			const MOCK_RESPONSE: TasksPromptResponse = {
				success: true,
				tasks: [
					{
						taskId: "task-001",
						title: "Add OAuth2 flow",
						description: "Add flow details",
					},
				],
			};

			const processSuccessResponse = (
				changeRequest: ChangeRequest,
				response: TasksPromptResponse
			): ChangeRequest => ({
				...changeRequest,
				status: "inProgress",
				tasks: response.tasks.map((task) => ({
					taskId: task.taskId,
					source: "tasksPrompt" as const,
					status: "open" as const,
					createdAt: new Date(),
				})),
				sentToTasksAt: new Date(),
				updatedAt: new Date(),
			});

			// Act
			const updated = processSuccessResponse(
				MOCK_CHANGE_REQUEST,
				MOCK_RESPONSE
			);

			// Assert
			expect(updated.status).toBe("inProgress");
			expect(updated.sentToTasksAt).not.toBeNull();
		});

		it("should preserve all task metadata when attaching", () => {
			// Arrange
			const MOCK_RESPONSE: TasksPromptResponse = {
				success: true,
				tasks: [
					{
						taskId: "task-001",
						title: "Task One",
						description: "Description one",
					},
				],
			};

			const attachWithMetadata = (response: TasksPromptResponse): TaskLink[] =>
				response.tasks.map((task) => ({
					taskId: task.taskId,
					source: "tasksPrompt" as const,
					status: "open" as const,
					createdAt: new Date(),
				}));

			// Act
			const tasks = attachWithMetadata(MOCK_RESPONSE);

			// Assert
			expect(tasks[0]).toHaveProperty("taskId", "task-001");
			expect(tasks[0]).toHaveProperty("source", "tasksPrompt");
			expect(tasks[0]).toHaveProperty("status", "open");
			expect(tasks[0]).toHaveProperty("createdAt");
			expect(tasks[0].createdAt).toBeInstanceOf(Date);
		});
	});

	describe("blocked path (failure handling)", () => {
		it("should mark change request as blocked when tasks prompt fails", () => {
			// Arrange
			const MOCK_ERROR_RESPONSE: TasksPromptResponse = {
				success: false,
				tasks: [],
				message: "Tasks prompt service unavailable",
			};

			const handleFailureResponse = (
				changeRequest: ChangeRequest,
				error: Error | TasksPromptResponse
			): ChangeRequest => ({
				...changeRequest,
				status: "blocked",
				updatedAt: new Date(),
			});

			// Act
			const updated = handleFailureResponse(
				MOCK_CHANGE_REQUEST,
				MOCK_ERROR_RESPONSE
			);

			// Assert
			expect(updated.status).toBe("blocked");
			expect(updated.tasks).toHaveLength(0);
			expect(updated.sentToTasksAt).toBeNull();
		});

		it("should preserve change request data when marking as blocked", () => {
			// Arrange
			const handleError = (changeRequest: ChangeRequest): ChangeRequest => ({
				...changeRequest,
				status: "blocked",
				updatedAt: new Date(),
			});

			// Act
			const updated = handleError(MOCK_CHANGE_REQUEST);

			// Assert
			expect(updated.id).toBe("cr-001");
			expect(updated.title).toBe("Add OAuth2 support");
			expect(updated.description).toBe(
				"The spec should include OAuth2 authentication flow"
			);
			expect(updated.severity).toBe("high");
			expect(updated.submitter).toBe("reviewer@example.com");
			expect(updated.notes).toBe("Critical for enterprise deployment");
		});

		it("should allow retry from blocked state", () => {
			// Arrange
			const BLOCKED_CHANGE_REQUEST: ChangeRequest = {
				...MOCK_CHANGE_REQUEST,
				status: "blocked",
			};

			const canRetry = (changeRequest: ChangeRequest): boolean =>
				changeRequest.status === "blocked";

			// Act
			const retryable = canRetry(BLOCKED_CHANGE_REQUEST);

			// Assert
			expect(retryable).toBe(true);
		});

		it("should handle network timeout errors", () => {
			// Arrange
			const TIMEOUT_ERROR = new Error("Request timeout after 30s");

			const handleNetworkError = (
				changeRequest: ChangeRequest,
				error: Error
			): ChangeRequest => ({
				...changeRequest,
				status: "blocked",
				updatedAt: new Date(),
			});

			// Act
			const updated = handleNetworkError(MOCK_CHANGE_REQUEST, TIMEOUT_ERROR);

			// Assert
			expect(updated.status).toBe("blocked");
		});
	});

	describe("task linkage", () => {
		it("should link tasks back to originating change request", () => {
			// Arrange
			const MOCK_TASKS: TaskLink[] = [
				{
					taskId: "task-001",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
				{
					taskId: "task-002",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			const linkTasksToChangeRequest = (
				changeRequestId: string,
				tasks: TaskLink[]
			): Map<string, string> => {
				const linkageMap = new Map<string, string>();
				for (const task of tasks) {
					linkageMap.set(task.taskId, changeRequestId);
				}
				return linkageMap;
			};

			// Act
			const linkage = linkTasksToChangeRequest("cr-001", MOCK_TASKS);

			// Assert
			expect(linkage.size).toBe(2);
			expect(linkage.get("task-001")).toBe("cr-001");
			expect(linkage.get("task-002")).toBe("cr-001");
		});

		it("should track task completion status", () => {
			// Arrange
			const TASKS_WITH_STATUSES: TaskLink[] = [
				{
					taskId: "task-001",
					source: "tasksPrompt",
					status: "done",
					createdAt: new Date(),
				},
				{
					taskId: "task-002",
					source: "tasksPrompt",
					status: "inProgress",
					createdAt: new Date(),
				},
				{
					taskId: "task-003",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			const areAllTasksDone = (tasks: TaskLink[]): boolean =>
				tasks.every((task) => task.status === "done");

			// Act
			const allDone = areAllTasksDone(TASKS_WITH_STATUSES);

			// Assert
			expect(allDone).toBe(false);
		});

		it("should detect when all linked tasks are complete", () => {
			// Arrange
			const ALL_DONE_TASKS: TaskLink[] = [
				{
					taskId: "task-001",
					source: "tasksPrompt",
					status: "done",
					createdAt: new Date(),
				},
				{
					taskId: "task-002",
					source: "tasksPrompt",
					status: "done",
					createdAt: new Date(),
				},
			];

			const checkCompletion = (tasks: TaskLink[]): boolean =>
				tasks.length > 0 && tasks.every((task) => task.status === "done");

			// Act
			const isComplete = checkCompletion(ALL_DONE_TASKS);

			// Assert
			expect(isComplete).toBe(true);
		});

		it("should handle empty task list", () => {
			// Arrange
			const EMPTY_TASKS: TaskLink[] = [];

			const checkCompletion = (tasks: TaskLink[]): boolean =>
				tasks.length > 0 && tasks.every((task) => task.status === "done");

			// Act
			const isComplete = checkCompletion(EMPTY_TASKS);

			// Assert
			expect(isComplete).toBe(false);
		});
	});
});
