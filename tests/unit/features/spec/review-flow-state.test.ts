import { describe, it, expect, beforeEach } from "vitest";
import {
	getSpecState,
	updateSpecStatus,
	shouldReturnToReview,
	addChangeRequest,
	updatePendingSummary,
	archiveSpec,
	unarchiveSpec,
	__testInitSpec,
} from "../../../../src/features/spec/review-flow/state";
import type {
	Specification,
	ChangeRequest,
} from "../../../../src/features/spec/review-flow/types";

describe("Spec Review Flow - State Management", () => {
	let mockSpec: Specification;
	let mockChangeRequest: ChangeRequest;

	beforeEach(() => {
		mockSpec = {
			id: "spec-001",
			title: "Example Spec",
			owner: "alice@example.com",
			status: "current",
			completedAt: null,
			reviewEnteredAt: null,
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/example/spec.md",
				docUrl: "https://doc.example.com/spec",
			},
			changeRequests: [],
		};

		mockChangeRequest = {
			id: "cr-001",
			specId: "spec-001",
			title: "Fix validation logic",
			description: "Missing input validation in form",
			severity: "medium",
			status: "open",
			tasks: [],
			submitter: "bob@example.com",
			createdAt: new Date(),
			updatedAt: new Date(),
			sentToTasksAt: null,
		};

		__testInitSpec(mockSpec);
	});

	describe("current → review transition", () => {
		it("moves spec to review and sets completed timestamps", () => {
			const result = updateSpecStatus(mockSpec.id, "review");
			expect(result?.status).toBe("review");
			expect(result?.completedAt).toBeDefined();
			expect(result?.reviewEnteredAt).toBeDefined();
		});

		it("preserves metadata across transition", () => {
			const result = updateSpecStatus(mockSpec.id, "review");
			expect(result?.title).toBe(mockSpec.title);
			expect(result?.owner).toBe(mockSpec.owner);
		});
	});

	describe("review → reopened", () => {
		beforeEach(() => {
			mockSpec.status = "review";
			mockSpec.completedAt = new Date();
			mockSpec.reviewEnteredAt = mockSpec.completedAt;
			__testInitSpec(mockSpec);
		});

		it("reopens spec when change request added", () => {
			const result = addChangeRequest(mockSpec.id, mockChangeRequest);
			expect(result?.status).toBe("reopened");
			expect(result?.changeRequests).toHaveLength(1);
		});
	});

	describe("reopened → review", () => {
		beforeEach(() => {
			mockSpec.status = "reopened";
			mockSpec.changeRequests = [
				{
					...mockChangeRequest,
					status: "addressed",
					tasks: [
						{
							taskId: "task-001",
							source: "tasksPrompt",
							status: "done",
							createdAt: new Date(),
						},
					],
				},
			];
			__testInitSpec(mockSpec);
		});

		it("requires all change requests and tasks to be complete", () => {
			expect(shouldReturnToReview(mockSpec.id)).toBe(true);
		});

		it("blocks return when pending task counters exist", () => {
			updatePendingSummary(mockSpec.id, 2, 0);
			expect(shouldReturnToReview(mockSpec.id)).toBe(false);

			updatePendingSummary(mockSpec.id, 0, 1);
			expect(shouldReturnToReview(mockSpec.id)).toBe(false);

			updatePendingSummary(mockSpec.id, 0, 0);
			expect(shouldReturnToReview(mockSpec.id)).toBe(true);
		});

		it("handles multiple change requests that close at different times", () => {
			mockSpec.changeRequests?.push({
				...mockChangeRequest,
				id: "cr-002",
				status: "addressed",
				tasks: [],
			});
			__testInitSpec(mockSpec);
			expect(shouldReturnToReview(mockSpec.id)).toBe(true);

			mockSpec.changeRequests![1].status = "open";
			__testInitSpec(mockSpec);
			expect(shouldReturnToReview(mockSpec.id)).toBe(false);
		});
	});

	describe("archiving lifecycle", () => {
		beforeEach(() => {
			mockSpec.status = "review";
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			mockSpec.changeRequests = [];
			__testInitSpec(mockSpec);
		});

		it("blocks archiving when blockers exist", () => {
			mockSpec.changeRequests = [
				{
					...mockChangeRequest,
					status: "open",
					tasks: [],
				},
			];
			__testInitSpec(mockSpec);
			expect(archiveSpec(mockSpec.id)).toBeNull();
		});

		it("archives spec when no blockers remain", () => {
			const result = archiveSpec(mockSpec.id);
			expect(result?.status).toBe("archived");
			expect(result?.archivedAt).toBeDefined();
		});

		it("unarchives spec back to reopened", () => {
			archiveSpec(mockSpec.id);
			const result = unarchiveSpec(mockSpec.id, {
				initiatedBy: "tests",
				reason: "new blocker",
			});
			expect(result?.status).toBe("reopened");
			expect(result?.archivedAt).toBeNull();
		});
	});

	describe("review → current/reopened when blockers return", () => {
		beforeEach(() => {
			mockSpec.status = "review";
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			mockSpec.changeRequests = [];
			__testInitSpec(mockSpec);
		});

		it("reverts review status when pending tasks return", () => {
			updatePendingSummary(mockSpec.id, 1, 0);
			const updated = getSpecState(mockSpec.id);
			expect(updated?.status).toBe("current");
		});

		it("moves to reopened when blockers return and change requests exist", () => {
			mockSpec.changeRequests = [mockChangeRequest];
			__testInitSpec(mockSpec);

			updatePendingSummary(mockSpec.id, 1, 0);
			const updated = getSpecState(mockSpec.id);
			expect(updated?.status).toBe("reopened");
		});
	});
});
