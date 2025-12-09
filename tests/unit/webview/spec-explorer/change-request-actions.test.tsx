/**
 * Unit tests for Change Request Actions component.
 * Tests UI states for dispatch, retry, in-progress, and addressed states.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangeRequestActions } from "../../../../webview-ui/src/components/spec-explorer/change-request-actions";

// Test constants
const BUTTON_DISPATCH = "Dispatch to Tasks";
const BUTTON_RETRY = "Retry";
const BUTTON_DISPATCHING = "Dispatching...";
const IN_PROGRESS_TEXT_REGEX = /In Progress \(\d+ tasks?\)/;
const IN_PROGRESS_2_TASKS = /In Progress \(2 tasks\)/;
const IN_PROGRESS_1_TASK = /In Progress \(1 tasks?\)/;
const IN_PROGRESS_0_TASKS = /In Progress \(0 tasks?\)/;
const IN_PROGRESS_50_TASKS = /In Progress \(50 tasks\)/;
const ADDRESSED_TEXT = "Addressed";
const INFO_MESSAGE_TEXT = /Tasks prompt unavailable/;

interface TaskLink {
	taskId: string;
	source: "tasksPrompt";
	status: "open" | "inProgress" | "done";
	createdAt: Date;
}

interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: "low" | "medium" | "high" | "critical";
	status: "open" | "blocked" | "inProgress" | "addressed";
	tasks: TaskLink[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
}

describe("Change Request Actions (Webview)", () => {
	let mockChangeRequest: ChangeRequest;
	let mockOnDispatch: ReturnType<typeof vi.fn>;
	let mockOnRetry: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockChangeRequest = {
			id: "cr-001",
			specId: "spec-001",
			title: "Add refund flow",
			description: "Missing refund functionality",
			severity: "high",
			status: "open",
			tasks: [],
			submitter: "reviewer@example.com",
			createdAt: new Date("2025-12-07T10:00:00Z"),
			updatedAt: new Date("2025-12-07T10:00:00Z"),
			sentToTasksAt: null,
		};

		mockOnDispatch = vi.fn().mockResolvedValue(undefined);
		mockOnRetry = vi.fn().mockResolvedValue(undefined);
	});

	describe("dispatch state (status: open)", () => {
		it("shows Dispatch to Tasks button when status is open", () => {
			mockChangeRequest.status = "open";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(BUTTON_DISPATCH)).toBeTruthy();
			expect(screen.queryByText(BUTTON_RETRY)).toBeNull();
			expect(screen.queryByText(ADDRESSED_TEXT)).toBeNull();
		});

		it("enables Dispatch button when status is open", () => {
			mockChangeRequest.status = "open";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			expect(button).not.toBeDisabled();
		});

		it("calls onDispatch when Dispatch button is clicked", async () => {
			mockChangeRequest.status = "open";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			await waitFor(() => {
				expect(mockOnDispatch).toHaveBeenCalledWith(mockChangeRequest.id);
			});
		});

		it("shows dispatching state during async dispatch", async () => {
			mockChangeRequest.status = "open";
			mockOnDispatch.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			expect(screen.getByText(BUTTON_DISPATCHING)).toBeTruthy();
			expect(screen.getByText(BUTTON_DISPATCHING)).toBeDisabled();

			await waitFor(() => {
				expect(mockOnDispatch).toHaveBeenCalled();
			});
		});
	});

	describe("blocked/retry state (status: blocked)", () => {
		it("shows Retry button when status is blocked", () => {
			mockChangeRequest.status = "blocked";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(BUTTON_RETRY)).toBeTruthy();
			expect(screen.queryByText(BUTTON_DISPATCH)).toBeNull();
		});

		it("shows info message when status is blocked", () => {
			mockChangeRequest.status = "blocked";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(INFO_MESSAGE_TEXT)).toBeTruthy();
		});

		it("calls onRetry when Retry button is clicked", async () => {
			mockChangeRequest.status = "blocked";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_RETRY);
			fireEvent.click(button);

			await waitFor(() => {
				expect(mockOnRetry).toHaveBeenCalledWith(mockChangeRequest.id);
			});
		});

		it("shows dispatching state during retry", async () => {
			mockChangeRequest.status = "blocked";
			mockOnRetry.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_RETRY);
			fireEvent.click(button);

			expect(screen.getByText(BUTTON_DISPATCHING)).toBeTruthy();
			expect(screen.getByText(BUTTON_DISPATCHING)).toBeDisabled();

			await waitFor(() => {
				expect(mockOnRetry).toHaveBeenCalled();
			});
		});
	});

	describe("in-progress state (status: inProgress)", () => {
		it("shows in-progress badge when status is inProgress", () => {
			mockChangeRequest.status = "inProgress";
			mockChangeRequest.tasks = [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
				{
					taskId: "task-2",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(IN_PROGRESS_2_TASKS)).toBeTruthy();
			expect(screen.queryByText(BUTTON_DISPATCH)).toBeNull();
			expect(screen.queryByText(BUTTON_RETRY)).toBeNull();
		});

		it("shows correct task count in progress badge", () => {
			mockChangeRequest.status = "inProgress";
			mockChangeRequest.tasks = [
				{
					taskId: "task-1",
					source: "tasksPrompt",
					status: "open",
					createdAt: new Date(),
				},
			];

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(IN_PROGRESS_1_TASK)).toBeTruthy();
		});

		it("shows progress badge with no tasks", () => {
			mockChangeRequest.status = "inProgress";
			mockChangeRequest.tasks = [];

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(IN_PROGRESS_0_TASKS)).toBeTruthy();
		});
	});

	describe("addressed state (status: addressed)", () => {
		it("shows addressed badge when status is addressed", () => {
			mockChangeRequest.status = "addressed";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(ADDRESSED_TEXT)).toBeTruthy();
			expect(screen.queryByText(BUTTON_DISPATCH)).toBeNull();
			expect(screen.queryByText(BUTTON_RETRY)).toBeNull();
		});

		it("does not show any action buttons when addressed", () => {
			mockChangeRequest.status = "addressed";

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.queryByText(BUTTON_DISPATCH)).toBeNull();
			expect(screen.queryByText(BUTTON_RETRY)).toBeNull();
			expect(screen.queryByText(INFO_MESSAGE_TEXT)).toBeNull();
		});
	});

	describe("error handling", () => {
		it("shows error message when dispatch fails", async () => {
			mockChangeRequest.status = "open";
			const errorMessage = "Network error: Failed to connect";
			mockOnDispatch.mockRejectedValue(new Error(errorMessage));

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			await waitFor(() => {
				expect(screen.getByText(errorMessage)).toBeTruthy();
			});

			const errorAlert = screen.getByRole("alert");
			expect(errorAlert).toBeTruthy();
		});

		it("shows error message when retry fails", async () => {
			mockChangeRequest.status = "blocked";
			const errorMessage = "Retry failed: Service unavailable";
			mockOnRetry.mockRejectedValue(new Error(errorMessage));

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_RETRY);
			fireEvent.click(button);

			await waitFor(() => {
				expect(screen.getByText(errorMessage)).toBeTruthy();
			});
		});

		it("shows generic error message for non-Error objects", async () => {
			mockChangeRequest.status = "open";
			mockOnDispatch.mockRejectedValue("String error");

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			await waitFor(() => {
				expect(
					screen.getByText("Failed to dispatch change request")
				).toBeTruthy();
			});
		});

		it("clears error message on successful retry after failure", async () => {
			mockChangeRequest.status = "open";
			const errorMessage = "First attempt failed";

			// First call fails, second succeeds
			mockOnDispatch
				.mockRejectedValueOnce(new Error(errorMessage))
				.mockResolvedValueOnce(undefined);

			const { rerender } = render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			// First attempt - fails
			let button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			await waitFor(() => {
				expect(screen.getByText(errorMessage)).toBeTruthy();
			});

			// Second attempt - succeeds
			button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			await waitFor(() => {
				expect(screen.queryByText(errorMessage)).toBeNull();
			});
		});
	});

	describe("edge cases", () => {
		it("handles change request with large task count", () => {
			mockChangeRequest.status = "inProgress";
			mockChangeRequest.tasks = Array.from({ length: 50 }, (_, i) => ({
				taskId: `task-${i}`,
				source: "tasksPrompt" as const,
				status: "open" as const,
				createdAt: new Date(),
			}));

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(IN_PROGRESS_50_TASKS)).toBeTruthy();
		});

		it("disables button during dispatch to prevent double-clicks", async () => {
			mockChangeRequest.status = "open";
			let resolveDispatch: () => void;
			const dispatchPromise = new Promise<void>((resolve) => {
				resolveDispatch = resolve;
			});
			mockOnDispatch.mockReturnValue(dispatchPromise);

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			const button = screen.getByText(BUTTON_DISPATCH);
			fireEvent.click(button);

			// Button should be disabled
			expect(screen.getByText(BUTTON_DISPATCHING)).toBeDisabled();

			// Try clicking again
			fireEvent.click(screen.getByText(BUTTON_DISPATCHING));

			// Should only call once
			expect(mockOnDispatch).toHaveBeenCalledTimes(1);

			// Resolve the promise
			resolveDispatch!();
			await waitFor(() => {
				expect(screen.getByText(BUTTON_DISPATCH)).not.toBeDisabled();
			});
		});

		it("handles empty task array for in-progress status", () => {
			mockChangeRequest.status = "inProgress";
			mockChangeRequest.tasks = [];

			render(
				<ChangeRequestActions
					changeRequest={mockChangeRequest}
					onDispatch={mockOnDispatch}
					onRetry={mockOnRetry}
				/>
			);

			expect(screen.getByText(IN_PROGRESS_0_TASKS)).toBeTruthy();
		});
	});
});
