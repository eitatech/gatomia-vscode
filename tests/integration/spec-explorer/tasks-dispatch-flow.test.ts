/**
 * Integration tests for Tasks Dispatch Flow (User Story 4).
 * Tests complete flow: Dispatch → Tasks Attached → Task Completion → Auto-return to Review.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	attachTasksToChangeRequest,
	getSpecState,
	updateChangeRequestStatus,
	shouldReturnToReview,
	returnSpecToReview,
	__testInitSpec,
} from "../../../src/features/spec/review-flow/state";
import { createChangeRequest } from "../../../src/features/spec/review-flow/change-requests-service";
import type {
	Specification,
	TaskLink,
} from "../../../src/features/spec/review-flow/types";

describe("Tasks Dispatch Flow (Integration)", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-dispatch-flow-001",
			title: "Payment Integration",
			owner: "alice@example.com",
			status: "review",
			completedAt: new Date("2025-12-07T10:00:00Z"),
			reviewEnteredAt: new Date("2025-12-07T10:00:00Z"),
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/payment/spec.md",
				docUrl: "https://doc.example.com/payment",
			},
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	describe("complete dispatch → completion → return flow", () => {
		it("dispatches tasks, completes them, and returns spec to review", () => {
			// Step 1: Create change request (transitions spec to reopened)
			const crResult = createChangeRequest(mockSpec.id, {
				title: "Add refund flow",
				description: "Missing refund functionality",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			expect(crResult).not.toBeNull();
			expect(crResult.changeRequest.status).toBe("open");

			let spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");
			expect(spec?.changeRequests).toHaveLength(1);

			// Step 2: Dispatch tasks to change request
			const tasks: TaskLink[] = [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
				{
					taskId: "task-2",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			const crWithTasks = attachTasksToChangeRequest(
				mockSpec.id,
				crResult.changeRequest.id,
				tasks
			);

			expect(crWithTasks).not.toBeNull();
			expect(crWithTasks?.tasks).toHaveLength(2);
			expect(crWithTasks?.status).toBe("inProgress");
			expect(crWithTasks?.sentToTasksAt).not.toBeNull();

			// Step 3: Complete tasks
			spec = getSpecState(mockSpec.id);
			if (spec?.changeRequests) {
				spec.changeRequests[0].tasks[0].status = "done";
				spec.changeRequests[0].tasks[1].status = "done";
				__testInitSpec(spec);
			}

			// Step 4: Mark change request as addressed
			// This automatically returns spec to review if all conditions are met
			updateChangeRequestStatus(
				mockSpec.id,
				crResult.changeRequest.id,
				"addressed"
			);

			// Step 5: Verify spec automatically returned to review
			spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
			expect(spec?.changeRequests[0].status).toBe("addressed");
			expect(spec?.changeRequests[0].tasks[0].status).toBe("done");
			expect(spec?.changeRequests[0].tasks[1].status).toBe("done");
		});

		it("blocks return to review when tasks are incomplete", () => {
			// Create change request
			const crResult = createChangeRequest(mockSpec.id, {
				title: "Add webhook support",
				description: "Missing webhook callbacks",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			// Dispatch tasks
			const tasks: TaskLink[] = [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			attachTasksToChangeRequest(mockSpec.id, crResult.changeRequest.id, tasks);

			// Mark CR as addressed but leave task incomplete
			updateChangeRequestStatus(
				mockSpec.id,
				crResult.changeRequest.id,
				"addressed"
			);

			// Should not return to review
			expect(shouldReturnToReview(mockSpec.id)).toBe(false);
		});

		it("handles multiple change requests with tasks", () => {
			// Create first change request
			const cr1 = createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "high",
				submitter: "reviewer1@example.com",
			});

			// Create second change request
			const cr2 = createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "medium",
				submitter: "reviewer2@example.com",
			});

			// Dispatch tasks to both
			attachTasksToChangeRequest(mockSpec.id, cr1.changeRequest.id, [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			]);

			attachTasksToChangeRequest(mockSpec.id, cr2.changeRequest.id, [
				{
					taskId: "task-2",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			]);

			// Complete all tasks
			const spec = getSpecState(mockSpec.id);
			if (spec?.changeRequests) {
				spec.changeRequests[0].tasks[0].status = "done";
				spec.changeRequests[0].status = "addressed";
				spec.changeRequests[1].tasks[0].status = "done";
				spec.changeRequests[1].status = "addressed";
				__testInitSpec(spec);
			}

			// Should allow return to review
			expect(shouldReturnToReview(mockSpec.id)).toBe(true);

			const returned = returnSpecToReview(mockSpec.id);
			expect(returned?.status).toBe("review");
		});
	});

	describe("retry flow", () => {
		it("allows retrying task dispatch after failure", () => {
			// Create change request
			const crResult = createChangeRequest(mockSpec.id, {
				title: "Add metrics",
				description: "Missing metrics tracking",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			// First dispatch
			const firstTasks: TaskLink[] = [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			const first = attachTasksToChangeRequest(
				mockSpec.id,
				crResult.changeRequest.id,
				firstTasks
			);

			expect(first?.tasks).toHaveLength(1);

			// Retry with different tasks
			const retryTasks: TaskLink[] = [
				{
					taskId: "task-retry-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
				{
					taskId: "task-retry-2",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			const retry = attachTasksToChangeRequest(
				mockSpec.id,
				crResult.changeRequest.id,
				retryTasks
			);

			expect(retry?.tasks).toHaveLength(2);
			expect(retry?.tasks[0].taskId).toBe("task-retry-1");
			expect(retry?.status).toBe("inProgress");
		});
	});

	describe("edge cases", () => {
		it("handles spec with pending tasks blocking return to review", () => {
			// Create and complete change request
			const crResult = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			attachTasksToChangeRequest(mockSpec.id, crResult.changeRequest.id, [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			]);

			// Complete CR tasks
			const spec = getSpecState(mockSpec.id);
			if (spec?.changeRequests) {
				spec.changeRequests[0].tasks[0].status = "done";
				spec.changeRequests[0].status = "addressed";
				spec.pendingTasks = 2; // Add pending spec tasks
				__testInitSpec(spec);
			}

			// Should not return due to pending spec tasks
			expect(shouldReturnToReview(mockSpec.id)).toBe(false);
		});

		it("handles empty tasks array", () => {
			const crResult = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			const result = attachTasksToChangeRequest(
				mockSpec.id,
				crResult.changeRequest.id,
				[]
			);

			expect(result).not.toBeNull();
			expect(result?.tasks).toEqual([]);
			expect(result?.status).toBe("inProgress");
		});
	});
});
