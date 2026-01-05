import { describe, it, expect, beforeEach, vi } from "vitest";
import { window } from "vscode";
import { handleSendToReview } from "../../../../src/features/spec/review-flow/commands/send-to-review-command";
import { sendToReviewWithTrigger } from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

vi.mock("../../../../src/features/spec/review-flow/state", () => ({
	sendToReviewWithTrigger: vi.fn(),
}));

describe("Send to Review Command", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
		vi.spyOn(window, "showInformationMessage").mockResolvedValue(undefined);
	});

	it("shows blockers when command is executed with unmet conditions", async () => {
		vi.mocked(sendToReviewWithTrigger).mockReturnValue({
			result: null,
			blockers: ["Spec not in current status"],
		});

		await handleSendToReview("spec-blocked");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Cannot send spec to review: Spec not in current status"
		);
	});

	it("blocks duplicate sends when spec is already in review", async () => {
		vi.mocked(sendToReviewWithTrigger).mockReturnValue({
			result: null,
			blockers: ["Spec already in review"],
		});

		await handleSendToReview("spec-review");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Cannot send spec to review: Spec already in review"
		);
	});

	it("shows failure notification when sendToReview fails", async () => {
		vi.mocked(sendToReviewWithTrigger).mockReturnValue({
			result: null,
			blockers: [],
		});

		await handleSendToReview("spec-fail");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Failed to send spec to review. Please try again."
		);
	});

	it("shows success notification and refreshes on success", async () => {
		const spec: Specification = {
			id: "spec-123",
			title: "Command Success Spec",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-123/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(sendToReviewWithTrigger).mockReturnValue({
			result: spec,
			blockers: [],
		});

		const refreshCallback = vi.fn();
		await handleSendToReview("spec-123", refreshCallback);

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			'Spec "Command Success Spec" sent to review successfully.'
		);
		expect(refreshCallback).toHaveBeenCalled();
	});

	it("accepts a Spec Explorer item argument", async () => {
		const spec: Specification = {
			id: "spec-123",
			title: "Command Success Spec",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-123/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(sendToReviewWithTrigger).mockReturnValue({
			result: spec,
			blockers: [],
		});

		await handleSendToReview({ specName: "spec-123" });

		expect(sendToReviewWithTrigger).toHaveBeenCalledWith(
			expect.objectContaining({
				specId: "spec-123",
				triggerType: "manual",
				initiatedBy: "manual-command",
			})
		);
	});
});
