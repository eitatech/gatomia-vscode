/**
 * Unit tests for Archive functionality (User Story 3).
 * Tests canArchive gating, archiveSpec transition, and archivedAt timestamp.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	canArchive,
	archiveSpec,
	unarchiveSpec,
	__testInitSpec,
} from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

describe("Archive Spec (Unit)", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-archive-001",
			title: "Authentication Service",
			owner: "alice@example.com",
			status: "review",
			completedAt: new Date("2025-12-07T10:00:00Z"),
			reviewEnteredAt: new Date("2025-12-07T10:00:00Z"),
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/auth/spec.md",
				docUrl: "https://doc.example.com/auth",
			},
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	describe("canArchive", () => {
		it("returns true when spec is in review with no blockers", () => {
			expect(canArchive(mockSpec.id)).toBe(true);
		});

		it("returns false when spec has pending tasks", () => {
			mockSpec.pendingTasks = 3;
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 2;
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec has open change requests", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					archivalBlocker: true,
					tasks: [],
				},
			];
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec has change requests with pending tasks", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
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
		});

		it("returns true when all change requests are addressed with completed tasks", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
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
		});

		it("returns false when spec is not in review status", () => {
			mockSpec.status = "current";
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec is in reopened status", () => {
			mockSpec.status = "reopened";
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec is already archived", () => {
			mockSpec.status = "archived";
			mockSpec.archivedAt = new Date();
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
		});

		it("returns false when spec does not exist", () => {
			expect(canArchive("non-existent-spec")).toBe(false);
		});
	});

	describe("archiveSpec", () => {
		it("transitions spec from review to archived", () => {
			const result = archiveSpec(mockSpec.id);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("archived");
		});

		it("sets archivedAt timestamp", () => {
			const beforeArchive = new Date();
			const result = archiveSpec(mockSpec.id);

			expect(result?.archivedAt).not.toBeNull();
			expect(result?.archivedAt?.getTime()).toBeGreaterThanOrEqual(
				beforeArchive.getTime()
			);
		});

		it("updates updatedAt timestamp", () => {
			const beforeArchive = new Date();
			const result = archiveSpec(mockSpec.id);

			expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeArchive.getTime()
			);
		});

		it("returns null when spec has pending tasks", () => {
			mockSpec.pendingTasks = 1;
			__testInitSpec(mockSpec);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();
		});

		it("returns null when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 1;
			__testInitSpec(mockSpec);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();
		});

		it("returns null when spec has blocking change requests", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					archivalBlocker: true,
					tasks: [],
				},
			];
			__testInitSpec(mockSpec);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();
		});

		it("returns null when spec is not in review status", () => {
			mockSpec.status = "current";
			__testInitSpec(mockSpec);

			const result = archiveSpec(mockSpec.id);
			expect(result).toBeNull();
		});

		it("preserves completedAt and reviewEnteredAt timestamps", () => {
			const originalCompletedAt = mockSpec.completedAt;
			const originalReviewEnteredAt = mockSpec.reviewEnteredAt;

			const result = archiveSpec(mockSpec.id);

			expect(result?.completedAt).toEqual(originalCompletedAt);
			expect(result?.reviewEnteredAt).toEqual(originalReviewEnteredAt);
		});
	});

	describe("unarchiveSpec", () => {
		beforeEach(() => {
			mockSpec.status = "archived";
			mockSpec.archivedAt = new Date("2025-12-08T10:00:00Z");
			__testInitSpec(mockSpec);
		});

		it("transitions spec from archived to reopened", () => {
			const result = unarchiveSpec(mockSpec.id);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("reopened");
		});

		it("clears archivedAt timestamp", () => {
			const result = unarchiveSpec(mockSpec.id);

			expect(result?.archivedAt).toBeNull();
		});

		it("updates updatedAt timestamp", () => {
			const beforeUnarchive = new Date();
			const result = unarchiveSpec(mockSpec.id);

			expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeUnarchive.getTime()
			);
		});

		it("accepts initiatedBy and reason options", () => {
			const result = unarchiveSpec(mockSpec.id, {
				initiatedBy: "admin@example.com",
				reason: "change-request-filed",
			});

			expect(result).not.toBeNull();
			expect(result?.status).toBe("reopened");
		});

		it("returns null when spec is not archived", () => {
			mockSpec.status = "review";
			mockSpec.archivedAt = null;
			__testInitSpec(mockSpec);

			const result = unarchiveSpec(mockSpec.id);
			expect(result).toBeNull();
		});

		it("returns null when spec does not exist", () => {
			const result = unarchiveSpec("non-existent-spec");
			expect(result).toBeNull();
		});
	});

	describe("Multi-change-request blocker detection", () => {
		it("blocks archival when any change request is not addressed", () => {
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

			expect(canArchive(mockSpec.id)).toBe(false);
			expect(archiveSpec(mockSpec.id)).toBeNull();
		});

		it("blocks archival when change request has incomplete tasks", () => {
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
						{
							taskId: "task-2",
							source: "tasksPrompt" as const,
							status: "open",
							createdAt: new Date(),
						},
					],
				},
			];
			__testInitSpec(mockSpec);

			expect(canArchive(mockSpec.id)).toBe(false);
			expect(archiveSpec(mockSpec.id)).toBeNull();
		});

		it("allows archival when all change requests are addressed with completed tasks", () => {
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
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [
						{
							taskId: "task-2",
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
});
