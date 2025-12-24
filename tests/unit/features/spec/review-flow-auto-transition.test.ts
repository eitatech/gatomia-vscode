/**
 * Unit tests for automatic review transitions.
 * Validates eligibility checks, notifications, and failure handling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Specification } from "../../../../src/features/spec/review-flow/types";
import {
	__testInitSpec,
	__testAutoSendToReview,
} from "../../../../src/features/spec/review-flow/state";
import { NotificationUtils } from "../../../../src/utils/notification-utils";

vi.mock("../../../../src/utils/notification-utils", () => ({
	NotificationUtils: {
		showReviewAlert: vi.fn(),
		showError: vi.fn(),
		showInfo: vi.fn(),
		showWarning: vi.fn(),
		showAutoDismissNotification: vi.fn(),
	},
}));

describe("Auto Review Transition", () => {
	let mockSpec: Specification;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSpec = {
			id: "spec-auto-001",
			title: "Auto Review Spec",
			owner: "owner@example.com",
			status: "current",
			completedAt: null,
			reviewEnteredAt: null,
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: {
				specPath: "specs/auto/spec.md",
			},
			watchers: ["reviewer@example.com"],
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	it("moves eligible specs to review automatically", () => {
		const result = __testAutoSendToReview(mockSpec.id);
		expect(result?.status).toBe("review");
		expect(result?.reviewEnteredAt).toBeInstanceOf(Date);
	});

	it("does not transition when spec is already in review", () => {
		mockSpec.status = "review";
		__testInitSpec(mockSpec);

		const result = __testAutoSendToReview(mockSpec.id);
		expect(result).toBeNull();
		expect(NotificationUtils.showReviewAlert).not.toHaveBeenCalled();
	});

	it("notifies watchers when auto transition succeeds", () => {
		__testAutoSendToReview(mockSpec.id);
		expect(NotificationUtils.showReviewAlert).toHaveBeenCalledWith(
			expect.stringContaining(mockSpec.title)
		);
	});

	it("surfaces a user error when auto transition fails", () => {
		const result = __testAutoSendToReview(mockSpec.id, {
			forceFailure: true,
		});
		expect(result).toBeNull();
		expect(NotificationUtils.showError).toHaveBeenCalled();
	});
});
