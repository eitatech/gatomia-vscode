import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Specification } from "../../../src/features/spec/review-flow/types";
import {
	__testInitSpec,
	initializeAutoReviewTransitions,
	updatePendingSummary,
	getSpecState,
} from "../../../src/features/spec/review-flow/state";

vi.mock("../../../src/features/spec/review-flow/telemetry", () => ({
	logSpecStatusChange: vi.fn(),
	logSendToReviewAction: vi.fn(),
	logOutstandingBlockerCount: vi.fn(),
	logReviewTransitionEvent: vi.fn(),
}));

vi.mock("../../../src/utils/notification-utils", () => ({
	NotificationUtils: {
		showReviewAlert: vi.fn(),
		showError: vi.fn(),
	},
}));

describe("Auto Review Transition (Integration)", () => {
	const specId = "spec-auto-integration-001";

	beforeEach(() => {
		const mockSpec: Specification = {
			id: specId,
			title: "Auto Integration Spec",
			owner: "owner@example.com",
			status: "current",
			completedAt: null,
			reviewEnteredAt: null,
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 1,
			pendingChecklistItems: 0,
			links: { specPath: "/path/to/spec.md" },
		};

		__testInitSpec(mockSpec);
		initializeAutoReviewTransitions();
	});

	it("moves specs to Review within 10 seconds after last task completes", () => {
		const start = performance.now();
		updatePendingSummary(specId, 0, 0);
		const end = performance.now();

		const updated = getSpecState(specId);
		expect(updated?.status).toBe("review");
		expect(end - start).toBeLessThan(10_000);
	});
});
