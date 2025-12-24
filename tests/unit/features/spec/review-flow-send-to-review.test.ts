/**
 * Unit tests for Send to Review functionality.
 * Tests canSendToReview gating logic and current → review transitions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	canSendToReview,
	sendToReview,
	__testInitSpec,
} from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

describe("Send to Review - Gating and Transitions", () => {
	let mockSpec: Specification;

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

		__testInitSpec(mockSpec);
	});

	describe("canSendToReview gating logic", () => {
		it("returns true when spec has zero pending tasks and checklist items", () => {
			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(true);
			expect(result.blockers).toEqual([]);
		});

		it("blocks when spec has pending tasks", () => {
			mockSpec.pendingTasks = 3;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(false);
			expect(result.blockers).toContain("3 pending tasks");
		});

		it("blocks when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 2;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(false);
			expect(result.blockers).toContain("2 pending checklist items");
		});

		it("blocks when spec has both pending tasks and checklist items", () => {
			mockSpec.pendingTasks = 3;
			mockSpec.pendingChecklistItems = 2;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(false);
			expect(result.blockers).toContain("3 pending tasks");
			expect(result.blockers).toContain("2 pending checklist items");
		});

		it("blocks when spec is not in current status", () => {
			mockSpec.status = "review";
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(false);
			expect(result.blockers).toContain("Spec already in review");
		});

		it("allows reopened specs to be sent to review", () => {
			mockSpec.status = "reopened";
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(true);
			expect(result.blockers).toEqual([]);
		});

		it("returns spec not found error when spec doesn't exist", () => {
			const result = canSendToReview("nonexistent-spec");
			expect(result.canSend).toBe(false);
			expect(result.blockers).toContain("Spec not found");
		});
	});

	describe("sendToReview transition", () => {
		it("transitions spec from current to review with timestamps", () => {
			const result = sendToReview(mockSpec.id);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("review");
			expect(result?.completedAt).toBeDefined();
			expect(result?.reviewEnteredAt).toBeDefined();
		});

		it("preserves spec metadata during transition", () => {
			const result = sendToReview(mockSpec.id);
			expect(result?.id).toBe(mockSpec.id);
			expect(result?.title).toBe(mockSpec.title);
			expect(result?.owner).toBe(mockSpec.owner);
			expect(result?.links).toEqual(mockSpec.links);
		});

		it("fails when spec has pending tasks", () => {
			mockSpec.pendingTasks = 2;
			__testInitSpec(mockSpec);

			const result = sendToReview(mockSpec.id);
			expect(result).toBeNull();
		});

		it("fails when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 1;
			__testInitSpec(mockSpec);

			const result = sendToReview(mockSpec.id);
			expect(result).toBeNull();
		});

		it("fails when spec is in wrong status", () => {
			mockSpec.status = "archived";
			__testInitSpec(mockSpec);

			const result = sendToReview(mockSpec.id);
			expect(result).toBeNull();
		});

		it("transitions reopened spec back to review", () => {
			mockSpec.status = "reopened";
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			__testInitSpec(mockSpec);

			const result = sendToReview(mockSpec.id);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("review");
		});

		it("updates updatedAt timestamp on transition", () => {
			const beforeTime = new Date();
			const result = sendToReview(mockSpec.id);
			expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeTime.getTime()
			);
		});
	});

	describe("edge cases", () => {
		it("handles spec with undefined pending counts as zero", () => {
			mockSpec.pendingTasks = undefined;
			mockSpec.pendingChecklistItems = undefined;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(true);
		});

		it("handles spec with null pending counts as zero", () => {
			// @ts-expect-error Testing null handling
			mockSpec.pendingTasks = null;
			// @ts-expect-error Testing null handling
			mockSpec.pendingChecklistItems = null;
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(true);
		});

		it("handles spec with empty change requests array", () => {
			mockSpec.changeRequests = [];
			__testInitSpec(mockSpec);

			const result = canSendToReview(mockSpec.id);
			expect(result.canSend).toBe(true);
		});
	});
});
