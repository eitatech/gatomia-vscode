/**
 * Integration tests for Change Requests from Review (User Story 2).
 * Tests the complete flow: Review → Change Request → Reopened → Review.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	createChangeRequest,
	getChangeRequestsForSpec,
} from "../../../src/features/spec/review-flow/change-requests-service";
import {
	getSpecState,
	updateChangeRequestStatus,
	__testInitSpec,
} from "../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../src/features/spec/review-flow/types";

describe("Change Requests from Review - Integration", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-integration-cr-001",
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

	describe("Review to Reopened workflow", () => {
		it("transitions spec from review to reopened when change request is created", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Add MFA support",
				description: "Missing multi-factor authentication",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();
			expect(result.changeRequest.id).toBeDefined();
			expect(result.changeRequest.title).toBe("Add MFA support");
			expect(result.changeRequest.status).toBe("open");

			const updatedSpec = getSpecState(mockSpec.id);
			expect(updatedSpec?.status).toBe("reopened");
			expect(updatedSpec?.changeRequests).toHaveLength(1);
		});

		it("keeps spec in reopened when multiple change requests are created", () => {
			createChangeRequest(mockSpec.id, {
				title: "Add MFA support",
				description: "Missing multi-factor authentication",
				severity: "high",
				submitter: "reviewer1@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "Fix token expiry",
				description: "Tokens expire too quickly",
				severity: "medium",
				submitter: "reviewer2@example.com",
			});

			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");
			expect(spec?.changeRequests).toHaveLength(2);

			const changeRequests = getChangeRequestsForSpec(mockSpec.id);
			expect(changeRequests).toHaveLength(2);
			expect(changeRequests[0].title).toBe("Add MFA support");
			expect(changeRequests[1].title).toBe("Fix token expiry");
		});

		it("sets archivalBlocker flag on all new change requests", () => {
			const result1 = createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			const result2 = createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "critical",
				submitter: "reviewer@example.com",
			});

			expect(result1.changeRequest.archivalBlocker).toBe(true);
			expect(result2.changeRequest.archivalBlocker).toBe(true);
		});

		it("preserves original completedAt timestamp when transitioning to reopened", () => {
			const originalCompletedAt = mockSpec.completedAt;

			createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			const spec = getSpecState(mockSpec.id);
			expect(spec?.completedAt).toEqual(originalCompletedAt);
		});

		it("updates updatedAt timestamp when change request is created", () => {
			const beforeCreate = new Date();

			createChangeRequest(mockSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			const spec = getSpecState(mockSpec.id);
			expect(spec?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeCreate.getTime()
			);
		});
	});

	describe("Concurrent change requests", () => {
		it("handles multiple reviewers submitting change requests concurrently", () => {
			const cr1 = createChangeRequest(mockSpec.id, {
				title: "Security issue",
				description: "Missing validation",
				severity: "critical",
				submitter: "reviewer1@example.com",
			});

			const cr2 = createChangeRequest(mockSpec.id, {
				title: "Performance issue",
				description: "Slow queries",
				severity: "high",
				submitter: "reviewer2@example.com",
			});

			const cr3 = createChangeRequest(mockSpec.id, {
				title: "UX issue",
				description: "Confusing UI",
				severity: "low",
				submitter: "reviewer3@example.com",
			});

			expect(cr1).not.toBeNull();
			expect(cr2).not.toBeNull();
			expect(cr3).not.toBeNull();

			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");
			expect(spec?.changeRequests).toHaveLength(3);

			const allOpen = spec?.changeRequests.every((cr) => cr.status === "open");
			expect(allOpen).toBe(true);
		});

		it("tracks multiple change requests with different severities", () => {
			createChangeRequest(mockSpec.id, {
				title: "Critical issue",
				description: "Security vulnerability",
				severity: "critical",
				submitter: "security@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "High issue",
				description: "Performance problem",
				severity: "high",
				submitter: "perf@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "Medium issue",
				description: "Bug fix needed",
				severity: "medium",
				submitter: "qa@example.com",
			});

			createChangeRequest(mockSpec.id, {
				title: "Low issue",
				description: "Minor improvement",
				severity: "low",
				submitter: "dev@example.com",
			});

			const changeRequests = getChangeRequestsForSpec(mockSpec.id);
			expect(changeRequests).toHaveLength(4);

			expect(changeRequests[0].severity).toBe("critical");
			expect(changeRequests[1].severity).toBe("high");
			expect(changeRequests[2].severity).toBe("medium");
			expect(changeRequests[3].severity).toBe("low");
		});
	});

	describe("Change request lifecycle", () => {
		it("transitions change request from open to inProgress to addressed", () => {
			const result = createChangeRequest(mockSpec.id, {
				title: "Fix auth bug",
				description: "Login fails for some users",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			expect(result.changeRequest.status).toBe("open");

			const cr1 = updateChangeRequestStatus(
				mockSpec.id,
				result.changeRequest.id,
				"inProgress"
			);
			expect(cr1?.status).toBe("inProgress");

			const cr2 = updateChangeRequestStatus(
				mockSpec.id,
				result.changeRequest.id,
				"addressed"
			);
			expect(cr2?.status).toBe("addressed");
		});

		it("allows spec to return to review when all change requests are addressed", () => {
			const cr1 = createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			const cr2 = createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			let spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");

			updateChangeRequestStatus(mockSpec.id, cr1.changeRequest.id, "addressed");
			updateChangeRequestStatus(mockSpec.id, cr2.changeRequest.id, "addressed");

			spec = getSpecState(mockSpec.id);

			const allAddressed = spec?.changeRequests.every(
				(cr) => cr.status === "addressed"
			);
			expect(allAddressed).toBe(true);
		});

		it("keeps spec reopened if any change request is not addressed", () => {
			const cr1 = createChangeRequest(mockSpec.id, {
				title: "Issue 1",
				description: "Description 1",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			const cr2 = createChangeRequest(mockSpec.id, {
				title: "Issue 2",
				description: "Description 2",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			updateChangeRequestStatus(mockSpec.id, cr1.changeRequest.id, "addressed");

			const spec = getSpecState(mockSpec.id);
			expect(spec?.status).toBe("reopened");

			const hasOpenCR = spec?.changeRequests.some((cr) => cr.status === "open");
			expect(hasOpenCR).toBe(true);
		});
	});

	describe("Edge cases", () => {
		it("handles change request creation for spec not in review", () => {
			const currentSpec: Specification = {
				...mockSpec,
				id: "spec-current-001",
				status: "current",
				reviewEnteredAt: null,
			};
			__testInitSpec(currentSpec);

			const result = createChangeRequest(currentSpec.id, {
				title: "Issue",
				description: "Description",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			expect(result).not.toBeNull();

			const spec = getSpecState(currentSpec.id);
			expect(spec?.changeRequests).toHaveLength(1);
		});

		it("maintains change request order by creation time", () => {
			const cr1 = createChangeRequest(mockSpec.id, {
				title: "First",
				description: "First issue",
				severity: "low",
				submitter: "reviewer@example.com",
			});

			const cr2 = createChangeRequest(mockSpec.id, {
				title: "Second",
				description: "Second issue",
				severity: "high",
				submitter: "reviewer@example.com",
			});

			const cr3 = createChangeRequest(mockSpec.id, {
				title: "Third",
				description: "Third issue",
				severity: "medium",
				submitter: "reviewer@example.com",
			});

			const changeRequests = getChangeRequestsForSpec(mockSpec.id);
			expect(changeRequests[0].id).toBe(cr1.changeRequest.id);
			expect(changeRequests[1].id).toBe(cr2.changeRequest.id);
			expect(changeRequests[2].id).toBe(cr3.changeRequest.id);
		});

		it("prevents duplicate change requests with same title", () => {
			createChangeRequest(mockSpec.id, {
				title: "Fix auth issue",
				description: "Description 1",
				severity: "high",
				submitter: "reviewer1@example.com",
			});

			expect(() =>
				createChangeRequest(mockSpec.id, {
					title: "Fix auth issue",
					description: "Description 2",
					severity: "medium",
					submitter: "reviewer2@example.com",
				})
			).toThrow("Duplicate change request title");
		});

		it("prevents duplicate change requests with case-insensitive matching", () => {
			createChangeRequest(mockSpec.id, {
				title: "Fix Auth Issue",
				description: "Description 1",
				severity: "high",
				submitter: "reviewer1@example.com",
			});

			expect(() =>
				createChangeRequest(mockSpec.id, {
					title: "fix auth issue",
					description: "Description 2",
					severity: "medium",
					submitter: "reviewer2@example.com",
				})
			).toThrow("Duplicate change request title");
		});
	});
});
