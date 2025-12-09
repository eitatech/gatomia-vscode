/**
 * Unit tests for Archive button component (User Story 3).
 * Tests button enable/disable states and blocker messaging.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

// Test regex patterns
const PENDING_TASKS_PATTERN = /2 pending tasks/;
const PENDING_CHECKLIST_ITEMS_PATTERN = /3 pending checklist items/;
const OPEN_CHANGE_REQUESTS_PATTERN = /2 open change requests/;
const SINGLE_TASK_PATTERN = /1 pending task$/;
const SINGLE_CHECKLIST_ITEM_PATTERN = /1 pending checklist item$/;
const SINGLE_CHANGE_REQUEST_PATTERN = /1 open change request$/;

// Mock component for testing structure
const MockArchiveButton = ({
	spec,
	onArchive,
}: {
	spec: Specification;
	onArchive: (specId: string) => void;
}) => {
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const openChangeRequests =
		spec.changeRequests?.filter((cr) => cr.status !== "addressed").length ?? 0;

	const isDisabled =
		pendingTasks > 0 || pendingChecklistItems > 0 || openChangeRequests > 0;

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
	if (openChangeRequests > 0) {
		blockers.push(
			`${openChangeRequests} open change request${openChangeRequests === 1 ? "" : "s"}`
		);
	}

	const tooltip = isDisabled
		? `Cannot archive: ${blockers.join(", ")}`
		: "Archive this spec";

	return (
		<button
			data-testid="archive-button"
			disabled={isDisabled}
			onClick={() => onArchive(spec.id)}
			title={tooltip}
			type="button"
		>
			Send to Archived
			{isDisabled && (
				<span data-testid="blocker-message">{blockers.join(", ")}</span>
			)}
		</button>
	);
};

describe("Archive Button (Webview)", () => {
	let mockSpec: Specification;
	let mockOnArchive: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockSpec = {
			id: "spec-review-001",
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

		mockOnArchive = vi.fn();
	});

	describe("button enable/disable states", () => {
		it("enables button when no blockers exist", () => {
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).not.toBeDisabled();
		});

		it("disables button when spec has pending tasks", () => {
			mockSpec.pendingTasks = 2;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).toBeDisabled();
		});

		it("disables button when spec has pending checklist items", () => {
			mockSpec.pendingChecklistItems = 3;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).toBeDisabled();
		});

		it("disables button when spec has open change requests", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
				{
					id: "cr-2",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Fix critical bug",
					severity: "critical",
					status: "inProgress",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).toBeDisabled();
		});

		it("enables button when all change requests are addressed", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).not.toBeDisabled();
		});

		it("disables button when spec has multiple blocker types", () => {
			mockSpec.pendingTasks = 2;
			mockSpec.pendingChecklistItems = 3;
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).toBeDisabled();
		});
	});

	describe("blocker messaging", () => {
		it("shows pending tasks message when tasks exist", () => {
			mockSpec.pendingTasks = 2;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(PENDING_TASKS_PATTERN)).toBeTruthy();
		});

		it("shows pending checklist items message when items exist", () => {
			mockSpec.pendingChecklistItems = 3;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(PENDING_CHECKLIST_ITEMS_PATTERN)).toBeTruthy();
		});

		it("shows open change requests message when change requests exist", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
				{
					id: "cr-2",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Fix critical bug",
					severity: "critical",
					status: "inProgress",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(OPEN_CHANGE_REQUESTS_PATTERN)).toBeTruthy();
		});

		it("shows all blockers when multiple types exist", () => {
			mockSpec.pendingTasks = 2;
			mockSpec.pendingChecklistItems = 3;
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
				{
					id: "cr-2",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Fix critical bug",
					severity: "critical",
					status: "inProgress",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const blockerMessage = screen.getByTestId("blocker-message");
			expect(blockerMessage.textContent).toContain("2 pending tasks");
			expect(blockerMessage.textContent).toContain("3 pending checklist items");
			expect(blockerMessage.textContent).toContain("2 open change requests");
		});

		it("uses singular form for single task", () => {
			mockSpec.pendingTasks = 1;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(SINGLE_TASK_PATTERN)).toBeTruthy();
		});

		it("uses singular form for single checklist item", () => {
			mockSpec.pendingChecklistItems = 1;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(SINGLE_CHECKLIST_ITEM_PATTERN)).toBeTruthy();
		});

		it("uses singular form for single change request", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			expect(screen.getByText(SINGLE_CHANGE_REQUEST_PATTERN)).toBeTruthy();
		});

		it("shows tooltip with blocker information when disabled", () => {
			mockSpec.pendingTasks = 2;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button.title).toContain("Cannot archive");
			expect(button.title).toContain("2 pending tasks");
		});

		it("shows helpful tooltip when enabled", () => {
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button.title).toBe("Archive this spec");
		});
	});

	describe("interactions", () => {
		it("calls onArchive with spec ID when enabled button is clicked", () => {
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			fireEvent.click(button);

			expect(mockOnArchive).toHaveBeenCalledWith(mockSpec.id);
		});

		it("does not call onArchive when disabled button is clicked", () => {
			mockSpec.pendingTasks = 2;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			fireEvent.click(button);

			expect(mockOnArchive).not.toHaveBeenCalled();
		});
	});

	describe("edge cases", () => {
		it("handles undefined pending counts as zero", () => {
			mockSpec.pendingTasks = undefined;
			mockSpec.pendingChecklistItems = undefined;
			mockSpec.changeRequests = undefined;
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).not.toBeDisabled();
		});

		it("handles zero pending counts correctly", () => {
			mockSpec.pendingTasks = 0;
			mockSpec.pendingChecklistItems = 0;
			mockSpec.changeRequests = [];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).not.toBeDisabled();
			expect(screen.queryByTestId("blocker-message")).toBeNull();
		});

		it("handles empty change requests array", () => {
			mockSpec.changeRequests = [];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).not.toBeDisabled();
		});

		it("counts only non-addressed change requests as blockers", () => {
			mockSpec.changeRequests = [
				{
					id: "cr-1",
					specId: mockSpec.id,
					title: "Add MFA",
					description: "Missing MFA",
					severity: "high",
					status: "addressed",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
				{
					id: "cr-2",
					specId: mockSpec.id,
					title: "Fix bug",
					description: "Fix critical bug",
					severity: "critical",
					status: "open",
					submitter: "reviewer@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
					sentToTasksAt: null,
					archivalBlocker: true,
					tasks: [],
				},
			];
			render(<MockArchiveButton onArchive={mockOnArchive} spec={mockSpec} />);

			const button = screen.getByTestId("archive-button");
			expect(button).toBeDisabled();
			expect(screen.getByText(SINGLE_CHANGE_REQUEST_PATTERN)).toBeTruthy();
		});
	});
});
