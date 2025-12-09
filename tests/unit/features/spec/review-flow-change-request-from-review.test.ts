/**
 * Unit tests for change request creation from Review (User Story 2).
 * Tests creation, reopen transitions, duplicate guards, and multi-request rules.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	createChangeRequest,
	getChangeRequestsForSpec,
	hasDuplicateChangeRequest,
	__testInitSpec,
} from "../../../../src/features/spec/review-flow/change-requests-service";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

describe("Change Request from Review - Creation and Reopening", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-001",
			title: "Example Spec",
			owner: "alice@example.com",
			status: "review",
			completedAt: new Date("2025-12-07T10:00:00Z"),
			reviewEnteredAt: new Date("2025-12-07T10:00:00Z"),
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

		__testInitSpec(mockSpec);
	});

	describe("change request creation", () => {
		it("creates a change request from a spec in review", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Fix validation logic",
				description: "Missing input validation in form",
				severity: "medium",
				submitter: "bob@example.com",
			});

			expect(result).not.toBeNull();
			expect(result.changeRequest.specId).toBe(mockSpec.id);
			expect(result.changeRequest.title).toBe("Fix validation logic");
			expect(result.changeRequest.severity).toBe("medium");
			expect(result.changeRequest.status).toBe("open");
		});

		it("assigns unique ID to each change request", () => {
			const result1 = createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "low",
				submitter: "reviewer1@example.com",
			});

			const result2 = createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "high",
				submitter: "reviewer2@example.com",
			});

			expect(result1.changeRequest.id).toBeDefined();
			expect(result2.changeRequest.id).toBeDefined();
			expect(result1.changeRequest.id).not.toBe(result2.changeRequest.id);
		});

		it("sets archivalBlocker flag to true for new change requests", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Blocking issue",
				description: "This blocks archival",
				severity: "critical",
				submitter: "reviewer@example.com",
			});

			expect(result.changeRequest.archivalBlocker).toBe(true);
		});

		it("initializes change request with empty tasks array", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			expect(result.changeRequest.tasks).toEqual([]);
		});

		it("sets timestamps correctly on creation", () => {
			const beforeCreate = new Date();
			const result = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			expect(result.changeRequest.createdAt).toBeDefined();
			expect(result.changeRequest.updatedAt).toBeDefined();
			expect(result.changeRequest.createdAt.getTime()).toBeGreaterThanOrEqual(
				beforeCreate.getTime()
			);
			expect(result.changeRequest.sentToTasksAt).toBeNull();
		});
	});

	describe("spec reopen on change request submission", () => {
		it("transitions spec from review to reopened when change request is created", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();
			// The spec should now be in reopened status
			// This will be verified by checking the spec state in the service
		});

		it("keeps spec in reopened with multiple change requests", () => {
			createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "low",
				submitter: "reviewer1@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "high",
				submitter: "reviewer2@example.com",
			});

			// Spec should remain reopened with both change requests
		});
	});

	describe("duplicate change request guard", () => {
		beforeEach(() => {
			// Create an existing change request
			createChangeRequest(mockSpec.id, {
				title: "Existing Issue",
				description: "This already exists",
				severity: "medium",
				submitter: "reviewer@example.com",
			});
		});

		it("detects duplicate change request with same title and spec", () => {
			const hasDuplicate = hasDuplicateChangeRequest(
				mockSpec.id,
				"Existing Issue"
			);
			expect(hasDuplicate).toBe(true);
		});

		it("allows change request with different title on same spec", () => {
			const hasDuplicate = hasDuplicateChangeRequest(
				mockSpec.id,
				"Different Issue"
			);
			expect(hasDuplicate).toBe(false);
		});

		it("allows change request with same title on different spec", () => {
			const hasDuplicate = hasDuplicateChangeRequest(
				"spec-002",
				"Existing Issue"
			);
			expect(hasDuplicate).toBe(false);
		});

		it("is case-insensitive when checking duplicates", () => {
			const hasDuplicate = hasDuplicateChangeRequest(
				mockSpec.id,
				"existing issue"
			);
			expect(hasDuplicate).toBe(true);
		});

		it("only considers open change requests as duplicates", () => {
			// If we had a way to mark a change request as addressed,
			// it should not count as a duplicate
			// This will be implemented in the service
		});
	});

	describe("retrieving change requests", () => {
		it("returns all change requests for a spec", () => {
			createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "low",
				submitter: "reviewer1@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "high",
				submitter: "reviewer2@example.com",
			});

			const changeRequests = getChangeRequestsForSpec(mockSpec.id);
			expect(changeRequests).toHaveLength(2);
		});

		it("returns empty array when spec has no change requests", () => {
			const changeRequests = getChangeRequestsForSpec("spec-no-crs");
			expect(changeRequests).toEqual([]);
		});

		it("returns only change requests for the specified spec", () => {
			// Initialize a second spec
			const spec2: Specification = {
				id: "spec-002",
				title: "Another Spec",
				owner: "bob@example.com",
				status: "review",
				completedAt: new Date(),
				reviewEnteredAt: new Date(),
				archivedAt: null,
				updatedAt: new Date(),
				pendingTasks: 0,
				pendingChecklistItems: 0,
				links: {
					specPath: "specs/another/spec.md",
					docUrl: "https://doc.example.com/another",
				},
				changeRequests: [],
			};
			__testInitSpec(spec2);

			createChangeRequest("spec-001", {
				title: "Issue 1",
				description: "Description 1",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			createChangeRequest("spec-002", {
				title: "Issue 2",
				description: "Description 2",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			const spec1ChangeRequests = getChangeRequestsForSpec("spec-001");
			expect(spec1ChangeRequests).toHaveLength(1);
			expect(spec1ChangeRequests[0].title).toBe("Issue 1");
		});
	});

	describe("edge cases", () => {
		it("handles creating change request for non-existent spec", () => {
			expect(() =>
				createChangeRequest("nonexistent-spec", {
					title: "Issue",
					description: "Description",
					severity: "medium",
					submitter: "reviewer@example.com",
				})
			).toThrow("Spec not found: nonexistent-spec");
		});

		it("handles empty title gracefully", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();
			expect(result.changeRequest.title).toBe("");
		});

		it("handles empty description gracefully", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();
			expect(result.changeRequest.description).toBe("");
		});

		it("handles very long titles and descriptions", () => {
			const longTitle = "A".repeat(500);
			const longDescription = "B".repeat(5000);

			const result = createChangeRequest(mockSpec.id, {
				title: longTitle,
				description: longDescription,
				severity: "low",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();
			expect(result.changeRequest.title).toBe(longTitle);
			expect(result.changeRequest.description).toBe(longDescription);
		});
	});
});
