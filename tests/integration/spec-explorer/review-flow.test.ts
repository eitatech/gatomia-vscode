/**
 * Integration test for review flow: from change request dispatch to spec returning to Ready to Review
 * Tests the complete cycle: dispatch → tasks created → tasks completed → spec moves back
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
	Specification,
	ChangeRequest,
	TaskLink,
} from "../../../src/features/spec/review-flow/types";
import {
	getSpecState,
	addChangeRequest,
	updateChangeRequestStatus,
	shouldReturnToReadyToReview,
	__testInitSpec,
} from "../../../src/features/spec/review-flow/state";

describe("review flow integration", () => {
	const MOCK_SPEC: Specification = {
		id: "spec-integration-001",
		title: "User Authentication",
		owner: "alice@example.com",
		status: "readyToReview",
		completedAt: new Date("2025-12-01T10:00:00Z"),
		updatedAt: new Date("2025-12-07T10:00:00Z"),
		links: {
			specPath: "/workspace/specs/user-auth/spec.md",
			docUrl: "vscode://file/workspace/specs/user-auth/spec.md",
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		// Initialize spec in test state
		__testInitSpec({ ...MOCK_SPEC });
	});

	describe("change request dispatch to return to Ready to Review", () => {
		it("should complete full cycle: dispatch → tasks → addressed → return", () => {
			// Step 1: Spec starts in readyToReview
			let spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("readyToReview");

			// Step 2: Create change request → spec moves to reopened
			const changeRequest: ChangeRequest = {
				id: "cr-int-001",
				specId: "spec-integration-001",
				title: "Add 2FA documentation",
				description: "Spec should document two-factor authentication",
				severity: "high",
				status: "open",
				tasks: [],
				submitter: "reviewer@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: null,
			};

			spec = addChangeRequest("spec-integration-001", changeRequest);
			expect(spec?.status).toBe("reopened");
			expect(spec?.changeRequests).toHaveLength(1);

			// Step 3: Dispatch to tasks prompt (mock success) → status becomes inProgress
			const mockTasksFromPrompt: TaskLink[] = [
				{
					taskId: "task-int-001",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
				{
					taskId: "task-int-002",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			// Attach tasks to change request (simulating dispatch success)
			if (spec?.changeRequests?.[0]) {
				spec.changeRequests[0].tasks = mockTasksFromPrompt;
				spec.changeRequests[0].status = "inProgress";
				spec.changeRequests[0].sentToTasksAt = new Date();
			}

			const updatedCR = updateChangeRequestStatus(
				"spec-integration-001",
				"cr-int-001",
				"inProgress"
			);
			expect(updatedCR?.status).toBe("inProgress");
			expect(updatedCR?.tasks).toHaveLength(2);

			// Spec should still be reopened
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("reopened");

			// Step 4: Mark all tasks as done
			if (spec?.changeRequests?.[0]) {
				for (const task of spec.changeRequests[0].tasks) {
					task.status = "done";
				}
			}

			// Step 5: Mark change request as addressed
			const addressedCR = updateChangeRequestStatus(
				"spec-integration-001",
				"cr-int-001",
				"addressed"
			);
			expect(addressedCR?.status).toBe("addressed");

			// Step 6: Spec should automatically return to readyToReview
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("readyToReview");
		});

		it("should handle multiple change requests before returning", () => {
			// Step 1: Create first change request
			const changeRequest1: ChangeRequest = {
				id: "cr-multi-001",
				specId: "spec-integration-001",
				title: "Add password requirements",
				description: "Document password complexity rules",
				severity: "medium",
				status: "open",
				tasks: [],
				submitter: "reviewer1@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: null,
			};

			let spec = addChangeRequest("spec-integration-001", changeRequest1);
			expect(spec?.status).toBe("reopened");

			// Step 2: Create second change request
			const changeRequest2: ChangeRequest = {
				id: "cr-multi-002",
				specId: "spec-integration-001",
				title: "Add session timeout details",
				description: "Document session timeout behavior",
				severity: "low",
				status: "open",
				tasks: [],
				submitter: "reviewer2@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: null,
			};

			if (spec?.changeRequests) {
				spec.changeRequests.push(changeRequest2);
			}

			spec = getSpecState("spec-integration-001");
			expect(spec?.changeRequests).toHaveLength(2);

			// Step 3: Resolve first change request
			if (spec?.changeRequests?.[0]) {
				spec.changeRequests[0].tasks = [
					{
						taskId: "task-m1-001",
						source: "tasksPrompt",
						status: "done",
						createdAt: new Date(),
					},
				];
			}
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-multi-001",
				"inProgress"
			);
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-multi-001",
				"addressed"
			);

			// Spec should NOT return yet (second CR not addressed)
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("reopened");

			// Step 4: Resolve second change request
			if (spec?.changeRequests?.[1]) {
				spec.changeRequests[1].tasks = [
					{
						taskId: "task-m2-001",
						source: "tasksPrompt",
						status: "done",
						createdAt: new Date(),
					},
				];
			}
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-multi-002",
				"inProgress"
			);
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-multi-002",
				"addressed"
			);

			// Now spec should return to readyToReview
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("readyToReview");
		});

		it("should remain reopened if any task is incomplete", () => {
			// Step 1: Create change request
			const changeRequest: ChangeRequest = {
				id: "cr-incomplete-001",
				specId: "spec-integration-001",
				title: "Add session management",
				description: "Document session lifecycle",
				severity: "high",
				status: "open",
				tasks: [],
				submitter: "reviewer@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: null,
			};

			let spec = addChangeRequest("spec-integration-001", changeRequest);
			expect(spec?.status).toBe("reopened");

			// Step 2: Attach tasks (one done, one open)
			if (spec?.changeRequests?.[0]) {
				spec.changeRequests[0].tasks = [
					{
						taskId: "task-inc-001",
						source: "tasksPrompt",
						status: "done",
						createdAt: new Date(),
					},
					{
						taskId: "task-inc-002",
						source: "tasksPrompt",
						status: "open",
						createdAt: new Date(),
					},
				];
			}

			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-incomplete-001",
				"inProgress"
			);

			// Step 3: Try to mark as addressed (should not return to readyToReview)
			const shouldReturn = shouldReturnToReadyToReview("spec-integration-001");
			expect(shouldReturn).toBe(false);

			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("reopened");
		});

		it("should handle tasks prompt failure with retry", () => {
			// Step 1: Create change request
			const changeRequest: ChangeRequest = {
				id: "cr-blocked-001",
				specId: "spec-integration-001",
				title: "Add OAuth flow",
				description: "Document OAuth authentication",
				severity: "critical",
				status: "open",
				tasks: [],
				submitter: "reviewer@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: null,
			};

			let spec = addChangeRequest("spec-integration-001", changeRequest);
			expect(spec?.status).toBe("reopened");

			// Step 2: Tasks prompt fails → mark as blocked
			const blockedCR = updateChangeRequestStatus(
				"spec-integration-001",
				"cr-blocked-001",
				"blocked"
			);
			expect(blockedCR?.status).toBe("blocked");
			expect(blockedCR?.tasks).toHaveLength(0);

			// Spec remains reopened
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("reopened");

			// Step 3: Retry succeeds → attach tasks
			if (spec?.changeRequests?.[0]) {
				spec.changeRequests[0].tasks = [
					{
						taskId: "task-retry-001",
						source: "tasksPrompt",
						status: "open",
						createdAt: new Date(),
					},
				];
			}

			const retriedCR = updateChangeRequestStatus(
				"spec-integration-001",
				"cr-blocked-001",
				"inProgress"
			);
			expect(retriedCR?.status).toBe("inProgress");
			expect(retriedCR?.tasks).toHaveLength(1);

			// Step 4: Complete tasks and mark addressed
			if (spec?.changeRequests?.[0]?.tasks[0]) {
				spec.changeRequests[0].tasks[0].status = "done";
			}

			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-blocked-001",
				"addressed"
			);

			// Spec should return to readyToReview
			spec = getSpecState("spec-integration-001");
			expect(spec?.status).toBe("readyToReview");
		});
	});

	describe("shouldReturnToReadyToReview helper", () => {
		it("should return true when all change requests addressed and tasks done", () => {
			// Arrange
			const changeRequest: ChangeRequest = {
				id: "cr-helper-001",
				specId: "spec-integration-001",
				title: "Test CR",
				description: "Test description",
				severity: "low",
				status: "open",
				tasks: [
					{
						taskId: "task-helper-001",
						source: "tasksPrompt",
						status: "done",
						createdAt: new Date(),
					},
				],
				submitter: "test@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: new Date(),
			};

			addChangeRequest("spec-integration-001", changeRequest);
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-helper-001",
				"addressed"
			);

			// Act
			const shouldReturn = shouldReturnToReadyToReview("spec-integration-001");

			// Assert
			expect(shouldReturn).toBe(true);
		});

		it("should return false when change request not addressed", () => {
			// Arrange
			const changeRequest: ChangeRequest = {
				id: "cr-notdone-001",
				specId: "spec-integration-001",
				title: "Incomplete CR",
				description: "Test description",
				severity: "medium",
				status: "open",
				tasks: [
					{
						taskId: "task-notdone-001",
						source: "tasksPrompt",
						status: "done",
						createdAt: new Date(),
					},
				],
				submitter: "test@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
				sentToTasksAt: new Date(),
			};

			addChangeRequest("spec-integration-001", changeRequest);
			updateChangeRequestStatus(
				"spec-integration-001",
				"cr-notdone-001",
				"inProgress"
			);

			// Act
			const shouldReturn = shouldReturnToReadyToReview("spec-integration-001");

			// Assert
			expect(shouldReturn).toBe(false);
		});
	});
});
