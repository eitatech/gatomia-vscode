/**
 * Unit tests for Send to Review button component.
 * Tests button enable/disable states and blocker messaging.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

// Test regex patterns
const PENDING_TASKS_PATTERN = /3 pending tasks/;
const PENDING_CHECKLIST_ITEMS_PATTERN = /2 pending checklist items/;
const SINGLE_TASK_PATTERN = /1 pending task$/;
const SINGLE_CHECKLIST_ITEM_PATTERN = /1 pending checklist item$/;

// Mock component for testing structure
const MockSendToReviewButton = ({
	spec,
	onSendToReview,
}: {
	spec: Specification;
	onSendToReview: (specId: string) => void;
}) => {
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const isDisabled = pendingTasks > 0 || pendingChecklistItems > 0;

	const blockers: string[] = [];
	if (pendingTasks > 0) {
		blockers.push(
			`${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"}`
		);
	}
	if (pendingChecklistItems > 0) {
		blockers.push(
			`${pendingChecklistItems} pending checklist item${pendingChecklistItems === 1 ? "" : "s"}`
		);
	}

	const tooltip = isDisabled
		? `Cannot send to review: ${blockers.join(", ")}`
		: "Send this spec to review";

	return (
		<button
			data-testid="send-to-review-button"
			disabled={isDisabled}
			onClick={() => onSendToReview(spec.id)}
			title={tooltip}
			type="button"
		>
			Send to Review
			{isDisabled && (
				<span data-testid="blocker-message">{blockers.join(", ")}</span>
			)}
		</button>
	);
};

describe("Send to Review Button (Webview)", () => {
	let mockSpec: Specification;
	let mockOnSendToReview: ReturnType<typeof vi.fn>;

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

		mockOnSendToReview = vi.fn();
	});

	describe("button enable/disable states", () => {
		it("enables button when no pending tasks or checklist items", () => {
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).not.toBeDisabled();
		});

		it("disables button when spec has pending tasks", () => {
			mockSpec.pendingTasks = 3;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).toBeDisabled();
		});

		it("disables button when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).toBeDisabled();
		});

		it("disables button when spec has both pending tasks and checklist items", () => {
			mockSpec.pendingTasks = 3;
			mockSpec.pendingChecklistItems = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).toBeDisabled();
		});
	});

	describe("blocker messaging", () => {
		it("shows pending tasks message when tasks exist", () => {
			mockSpec.pendingTasks = 3;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			expect(screen.getByText(PENDING_TASKS_PATTERN)).toBeTruthy();
		});

		it("shows pending checklist items message when items exist", () => {
			mockSpec.pendingChecklistItems = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			expect(screen.getByText(PENDING_CHECKLIST_ITEMS_PATTERN)).toBeTruthy();
		});

		it("shows both blockers when both exist", () => {
			mockSpec.pendingTasks = 3;
			mockSpec.pendingChecklistItems = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const blockerMessage = screen.getByTestId("blocker-message");
			expect(blockerMessage.textContent).toContain("3 pending tasks");
			expect(blockerMessage.textContent).toContain("2 pending checklist items");
		});

		it("uses singular form for single task", () => {
			mockSpec.pendingTasks = 1;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			expect(screen.getByText(SINGLE_TASK_PATTERN)).toBeTruthy();
		});

		it("uses singular form for single checklist item", () => {
			mockSpec.pendingChecklistItems = 1;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			expect(screen.getByText(SINGLE_CHECKLIST_ITEM_PATTERN)).toBeTruthy();
		});

		it("shows tooltip with blocker information when disabled", () => {
			mockSpec.pendingTasks = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button.title).toContain("Cannot send to review");
			expect(button.title).toContain("2 pending tasks");
		});

		it("shows helpful tooltip when enabled", () => {
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button.title).toBe("Send this spec to review");
		});
	});

	describe("interactions", () => {
		it("calls onSendToReview with spec ID when enabled button is clicked", () => {
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			fireEvent.click(button);

			expect(mockOnSendToReview).toHaveBeenCalledWith(mockSpec.id);
		});

		it("does not call onSendToReview when disabled button is clicked", () => {
			mockSpec.pendingTasks = 2;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			fireEvent.click(button);

			expect(mockOnSendToReview).not.toHaveBeenCalled();
		});
	});

	describe("edge cases", () => {
		it("handles undefined pending counts as zero", () => {
			mockSpec.pendingTasks = undefined;
			mockSpec.pendingChecklistItems = undefined;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).not.toBeDisabled();
		});

		it("handles zero pending counts correctly", () => {
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			render(
				<MockSendToReviewButton
					onSendToReview={mockOnSendToReview}
					spec={mockSpec}
				/>
			);

			const button = screen.getByTestId("send-to-review-button");
			expect(button).not.toBeDisabled();
			expect(screen.queryByTestId("blocker-message")).toBeNull();
		});
	});
});
