import { describe, it, expect, beforeEach } from "vitest";
import type { Specification } from "../../../src/features/spec/review-flow/types";
import {
	__testInitSpec,
	updatePendingSummary,
	getSpecState,
} from "../../../src/features/spec/review-flow/state";

describe("Review Flow Reopen (Integration)", () => {
	const specId = "spec-reopen-001";

	beforeEach(() => {
		const mockSpec: Specification = {
			id: specId,
			title: "Reopen Flow Spec",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			pendingTasks: 0,
			pendingChecklistItems: 0,
			links: { specPath: "/path/to/spec.md" },
			changeRequests: [],
		};

		__testInitSpec(mockSpec);
	});

	it("removes spec from Review when a task reopens", () => {
		updatePendingSummary(specId, 1, 0);
		const updated = getSpecState(specId);
		expect(updated?.status).toBe("current");
	});
});
