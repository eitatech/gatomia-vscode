/**
 * Integration tests for Archive Flow (User Story 3).
 * Tests complete workflow: Review → Archived → Reopened.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	getSpecState,
	archiveSpec,
	unarchiveSpec,
	canArchive,
	updateSpecStatus,
	__testInitSpec,
} from "../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../src/features/spec/review-flow/types";

describe("Archive Flow (Integration)", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-archive-flow-001",
			title: "Archive Flow Test Spec",
			owner: "alice@example.com",
			status: "review",
			completedAt: new Date("2025-12-07T10:00:00Z"),
			reviewEnteredAt: new Date("2025-12-07T10:00:00Z"),
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/archive-test/spec.md",
				docUrl: "https://doc.example.com/archive-test",
			},
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	describe("Archive workflow", () => {
		it("archives spec from Review and removes it from Review lane", () => {
			// Verify spec is in review
			let spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");

			// Archive the spec
			const archived = archiveSpec(mockSpec.id);
			expect(archived).not.toBeNull();
			expect(archived?.status).toBe("archived");
			expect(archived?.archivedAt).not.toBeNull();

			// Verify spec is now archived
			spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("archived");
			expect(spec?.archivedAt).not.toBeNull();
		});

		it("sets archivedAt timestamp when archiving", () => {
			const beforeArchive = new Date();
			const archived = archiveSpec(mockSpec.id);

			expect(archived?.archivedAt).not.toBeNull();
			expect(archived?.archivedAt?.getTime()).toBeGreaterThanOrEqual(
				beforeArchive.getTime()
			);
		});

		it("preserves completedAt and reviewEnteredAt when archiving", () => {
			const originalCompletedAt = mockSpec.completedAt;
			const originalReviewEnteredAt = mockSpec.reviewEnteredAt;

			const archived = archiveSpec(mockSpec.id);

			expect(archived?.completedAt).toEqual(originalCompletedAt);
			expect(archived?.reviewEnteredAt).toEqual(originalReviewEnteredAt);
		});

		it("cannot archive spec with pending tasks", () => {
			mockSpec.pendingTasks = 2;
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();

			// Verify spec remains in review
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
			expect(spec?.archivedAt).toBeNull();
		});

		it("cannot archive spec with pending checklist items", () => {
			mockSpec.pendingChecklistItems = 3;
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();

			// Verify spec remains in review
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
		});

		it("cannot archive spec with open change requests", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Critical bug",
					severity: "critical",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();

			// Verify spec remains in review
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
		});

		it("cannot archive spec with addressed change requests that have incomplete tasks", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Critical bug",
					severity: "critical",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: new Date(),
					archivalBlocker: true,
					tasks: [
						{
							taskId: "task-1",
							source: "tasksPrompt" as const,
							status: "open",
							createdAt: new Date(),
						},
					],
				},
			];
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();

			// Verify spec remains in review
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
		});

		it("can archive spec with addressed change requests and completed tasks", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Critical bug",
					severity: "critical",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: new Date(),
					archivalBlocker: true,
					tasks: [
						{
							taskId: "task-1",
							source: "tasksPrompt" as const,
							status: "done",
							createdAt: new Date(),
						},
					],
				},
			];
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(true);

			const result = archiveSpec(mockSpec.id);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("archived");
		});
	});

	describe("Unarchive workflow", () => {
		beforeEach(() => {
			// Archive the spec first
			archiveSpec(mockSpec.id);
		});

		it("unarchives spec and moves to reopened status", () => {
			const unarchived = unarchiveSpec(mockSpec.id);
			expect(unarchived).not.toBeNull();
			expect(unarchived?.status).toBe("reopened");
			expect(unarchived?.archivedAt).toBeNull();

			// Verify state
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");
			expect(spec?.archivedAt).toBeNull();
		});

		it("clears archivedAt timestamp when unarchiving", () => {
			const archived = getSpecState(mockSpec.id);
			expect(archived?.archivedAt).not.toBeNull();

			const unarchived = unarchiveSpec(mockSpec.id);
			expect(unarchived?.archivedAt).toBeNull();
		});

		it("updates updatedAt timestamp when unarchiving", () => {
			const beforeUnarchive = new Date();
			const unarchived = unarchiveSpec(mockSpec.id);

			expect(unarchived?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeUnarchive.getTime()
			);
		});

		it("accepts initiatedBy and reason options", () => {
			const unarchived = unarchiveSpec(mockSpec.id, {
				initiatedBy: "admin@example.com",
				reason: "change-request-filed",
			});

			expect(unarchived).not.toBeNull();
			expect(unarchived?.status).toBe("reopened");
		});

		it("cannot unarchive spec that is not archived", () => {
			// Unarchive once
			const first = unarchiveSpec(mockSpec.id);
			expect(first?.status).toBe("reopened");

			// Try to unarchive again
			const second = unarchiveSpec(mockSpec.id);
			expect(second).toBeNull();

			// Verify still reopened
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");
		});

		it("preserves completedAt and reviewEnteredAt when unarchiving", () => {
			const originalCompletedAt = mockSpec.completedAt;
			const originalReviewEnteredAt = mockSpec.reviewEnteredAt;

			const unarchived = unarchiveSpec(mockSpec.id);

			expect(unarchived?.completedAt).toEqual(originalCompletedAt);
			expect(unarchived?.reviewEnteredAt).toEqual(originalReviewEnteredAt);
		});
	});

	describe("Complete round-trip workflow", () => {
		it("completes full workflow: Review → Archived → Reopened → Review", () => {
			// Start in review
			let spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");

			// Archive
			const archived = archiveSpec(mockSpec.id);
			expect(archived?.status).toBe("archived");

			// Unarchive
			const unarchived = unarchiveSpec(mockSpec.id);
			expect(unarchived?.status).toBe("reopened");

			// Return to review
			const returned = updateSpecStatus(mockSpec.id, "review");
			expect(returned?.status).toBe("review");

			// Verify final state
			spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("review");
			expect(spec?.archivedAt).toBeNull();
		});

		it("handles multiple change requests as blockers", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Issue 1",
					description: "Description 1",
					severity: "high",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [
						{
							taskId: "task-1",
							source: "tasksPrompt" as const,
							status: "done",
							createdAt: new Date(),
						},
					],
				},
				{
					id: "cr-2",
					specId: mockSpec.id,
					title: "Issue 2",
					description: "Description 2",
					severity: "medium",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			__testInitSpec(mockSpec);

			// Cannot archive with one open change request
			expect(canArchive(mockSpec.id)).toBe(false);
			expect(archiveSpec(mockSpec.id)).toBeNull();

			// Address the second change request
			const spec = getSpecState(mockSpec.id);
			if (spec?.changeRequests) {
				spec.changeRequests[1].status = "addressed";
				__testInitSpec(spec);
			}

			// Now can archive
			expect(canArchive(mockSpec.id)).toBe(true);
			const archived = archiveSpec(mockSpec.id);
			expect(archived?.status).toBe("archived");
		});
	});

	describe("Edge cases", () => {
		it("handles archiving spec with no change requests", () => {
			expect(mockSpec.changeRequests).toEqual([]);

			const archived = archiveSpec(mockSpec.id);
			expect(archived).not.toBeNull();
			expect(archived?.status).toBe("archived");
		});

		it("handles archiving spec with undefined change requests", () => {
			mockSpec.changeRequests = undefined;
			__testInitSpec(mockSpec);

			const archived = archiveSpec(mockSpec.id);
			expect(archived).not.toBeNull();
			expect(archived?.status).toBe("archived");
		});

		it("handles unarchiving non-existent spec", () => {
			const result = unarchiveSpec("non-existent-spec");
			expect(result).toBeNull();
		});

		it("handles archiving non-existent spec", () => {
			const result = archiveSpec("non-existent-spec");
			expect(result).toBeNull();
		});

		it("handles archiving spec from non-review status", () => {
			mockSpec.status = "current";
			__testInitSpec(mockSpec);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();

			// Verify unchanged
			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("current");
		});
	});
});
