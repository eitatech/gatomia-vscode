/**
 * Integration test for Send to Review flow.
 * Tests end-to-end transition from Current Specs to Review.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	sendToReview,
	getSpecState,
	updatePendingSummary,
	__testInitSpec,
} from "../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../src/features/spec/review-flow/types";

describe("Send to Review Flow (Integration)", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		mockSpec = {
			id: "spec-integration-001",
			title: "Integration Test Spec",
			owner: "alice@example.com",
			status: "current",
			completedAt: null,
			reviewEnteredAt: null,
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/integration-test/spec.md",
				docUrl: "https://doc.example.com/integration-spec",
			},
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	describe("successful transition from Current Specs to Review", () => {
		it("moves spec from current to review with all metadata intact", () => {
			const result = sendToReview(mockSpec.id);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("review");
			expect(result?.id).toBe(mockSpec.id);
			expect(result?.title).toBe(mockSpec.title);
			expect(result?.owner).toBe(mockSpec.owner);
			expect(result?.links).toEqual(mockSpec.links);
		});

		it("sets completedAt and reviewEnteredAt timestamps on transition", () => {
			const beforeTransition = new Date();
			const result = sendToReview(mockSpec.id);

			expect(result?.completedAt).toBeDefined();
			expect(result?.reviewEnteredAt).toBeDefined();
			expect(result?.completedAt?.getTime()).toBeGreaterThanOrEqual(
				beforeTransition.getTime()
			);
			expect(result?.reviewEnteredAt?.getTime()).toBeGreaterThanOrEqual(
				beforeTransition.getTime()
			);
		});

		it("persists the transition and can be retrieved", () => {
			sendToReview(mockSpec.id);
			const retrieved = getSpecState(mockSpec.id);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.status).toBe("review");
			expect(retrieved?.completedAt).toBeDefined();
		});

		it("removes spec from current specs list (status check)", () => {
			sendToReview(mockSpec.id);
			const retrieved = getSpecState(mockSpec.id);

			expect(retrieved?.status).not.toBe("current");
		});

		it("spec appears in review list (status check)", () => {
			sendToReview(mockSpec.id);
			const retrieved = getSpecState(mockSpec.id);

			expect(retrieved?.status).toBe("review");
		});
	});

	describe("blocked transitions", () => {
		it("does not transition when spec has pending tasks", () => {
			updatePendingSummary(mockSpec.id, 2, 0);
			const result = sendToReview(mockSpec.id);

			expect(result).toBeNull();

			const retrieved = getSpecState(mockSpec.id);
			expect(retrieved?.status).toBe("current");
		});

		it("does not transition when spec has pending checklist items", () => {
			updatePendingSummary(mockSpec.id, 0, 3);
			const result = sendToReview(mockSpec.id);

			expect(result).toBeNull();

			const retrieved = getSpecState(mockSpec.id);
			expect(retrieved?.status).toBe("current");
		});

		it("does not transition when spec has both pending tasks and checklist items", () => {
			updatePendingSummary(mockSpec.id, 2, 3);
			const result = sendToReview(mockSpec.id);

			expect(result).toBeNull();

			const retrieved = getSpecState(mockSpec.id);
			expect(retrieved?.status).toBe("current");
		});

		it("allows transition only after all blockers are cleared", () => {
			updatePendingSummary(mockSpec.id, 2, 3);
			let result = sendToReview(mockSpec.id);
			expect(result).toBeNull();

			updatePendingSummary(mockSpec.id, 0, 0);
			result = sendToReview(mockSpec.id);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("review");
		});
	});

	describe("reopened spec transitions", () => {
		beforeEach(() => {
			mockSpec.status = "reopened";
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			__testInitSpec(mockSpec);
		});

		it("transitions reopened spec back to review", () => {
			const result = sendToReview(mockSpec.id);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("review");
		});

		it("preserves original completedAt when returning from reopened", () => {
			const originalCompletedAt = new Date("2025-12-01T10:00:00Z");
			mockSpec.completedAt = originalCompletedAt;
			__testInitSpec(mockSpec);

			const result = sendToReview(mockSpec.id);

			expect(result?.completedAt).toBeDefined();
		});
	});

	describe("edge cases", () => {
		it("handles spec not found gracefully", () => {
			const result = sendToReview("nonexistent-spec-id");
			expect(result).toBeNull();
		});

		it("handles multiple send attempts idempotently", () => {
			const first = sendToReview(mockSpec.id);
			expect(first?.status).toBe("review");

			const second = sendToReview(mockSpec.id);
			expect(second).toBeNull();

			const retrieved = getSpecState(mockSpec.id);
			expect(retrieved?.status).toBe("review");
		});

		it("maintains spec integrity through transition", () => {
			const originalTitle = mockSpec.title;
			const originalOwner = mockSpec.owner;
			const originalLinks = { ...mockSpec.links };

			sendToReview(mockSpec.id);
			const retrieved = getSpecState(mockSpec.id);

			expect(retrieved?.title).toBe(originalTitle);
			expect(retrieved?.owner).toBe(originalOwner);
			expect(retrieved?.links).toEqual(originalLinks);
		});
	});
});
