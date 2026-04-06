import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitActionForm } from "../../../ui/src/features/hooks-view/components/git-action-form";
import type { ActionConfig } from "../../../ui/src/features/hooks-view/types";

const makeGitAction = (
	overrides?: Partial<ActionConfig["parameters"]>
): ActionConfig => ({
	type: "git",
	parameters: {
		operation: "commit",
		messageTemplate: "",
		pushToRemote: false,
		...overrides,
	},
});

describe("GitActionForm", () => {
	const mockOnActionChange = vi.fn();
	const mockOnClearActionError = vi.fn();

	beforeEach(() => {
		mockOnActionChange.mockClear();
		mockOnClearActionError.mockClear();
	});

	describe("commit operation (default)", () => {
		it("shows message template and push-to-remote fields for commit", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "commit" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Operation")).toHaveValue("commit");
			expect(screen.getByLabelText("Message Template")).toBeInTheDocument();
			expect(
				screen.getByLabelText("Push to remote after commit")
			).toBeInTheDocument();
		});

		it("does not show branch name field for commit", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "commit" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
		});
	});

	describe("push operation", () => {
		it("shows info text and no message template for push", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "push" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Operation")).toHaveValue("push");
			expect(
				screen.queryByLabelText("Message Template")
			).not.toBeInTheDocument();
		});
	});

	describe("create-branch operation", () => {
		it("shows branch name field for create-branch", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "create-branch" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Branch Name")).toBeInTheDocument();
			expect(
				screen.queryByLabelText("Message Template")
			).not.toBeInTheDocument();
		});

		it("renders all 8 operation options in the select", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "create-branch" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Operation");
			const options = Array.from(select.querySelectorAll("option")).map(
				(o) => o.value
			);
			expect(options).toContain("commit");
			expect(options).toContain("push");
			expect(options).toContain("create-branch");
			expect(options).toContain("checkout-branch");
			expect(options).toContain("pull");
			expect(options).toContain("merge");
			expect(options).toContain("tag");
			expect(options).toContain("stash");
		});
	});

	describe("checkout-branch operation", () => {
		it("shows branch name field for checkout-branch", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "checkout-branch" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Branch Name")).toBeInTheDocument();
		});
	});

	describe("pull operation", () => {
		it("shows no extra fields for pull", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "pull" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText("Message Template")
			).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Tag Name")).not.toBeInTheDocument();
		});
	});

	describe("merge operation", () => {
		it("shows branch name field for merge", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "merge" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Branch Name")).toBeInTheDocument();
		});
	});

	describe("tag operation", () => {
		it("shows tag name and tag message fields for tag", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "tag" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Tag Name")).toBeInTheDocument();
			expect(screen.getByLabelText("Tag Message")).toBeInTheDocument();
		});

		it("does not show branch name for tag", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "tag" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
		});
	});

	describe("stash operation", () => {
		it("shows stash message field for stash", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "stash" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Stash Message")).toBeInTheDocument();
		});

		it("does not show message template or branch name for stash", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "stash" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(
				screen.queryByLabelText("Message Template")
			).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
		});
	});

	describe("field interaction", () => {
		it("calls onActionChange when branch name is changed", async () => {
			const user = userEvent.setup();
			const action = makeGitAction({ operation: "create-branch" });

			render(
				<GitActionForm
					action={action}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const branchInput = screen.getByLabelText("Branch Name");
			await user.type(branchInput, "feature/my-branch");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onActionChange when tag name is changed", async () => {
			const user = userEvent.setup();
			const action = makeGitAction({ operation: "tag" });

			render(
				<GitActionForm
					action={action}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const tagInput = screen.getByLabelText("Tag Name");
			await user.type(tagInput, "v1.0.0");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onActionChange when stash message is changed", async () => {
			const user = userEvent.setup();
			const action = makeGitAction({ operation: "stash" });

			render(
				<GitActionForm
					action={action}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const stashInput = screen.getByLabelText("Stash Message");
			await user.type(stashInput, "WIP: my changes");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onClearActionError when any field changes", async () => {
			const user = userEvent.setup();
			const action = makeGitAction({ operation: "tag" });

			render(
				<GitActionForm
					action={action}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const tagInput = screen.getByLabelText("Tag Name");
			await user.type(tagInput, "v1.0.0");

			expect(mockOnClearActionError).toHaveBeenCalled();
		});

		it("renders with disabled state", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "create-branch" })}
					disabled={true}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Branch Name")).toBeDisabled();
		});

		it("shows action error when provided", () => {
			render(
				<GitActionForm
					action={makeGitAction({ operation: "commit" })}
					actionError="Commit message template is required"
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(
				screen.getByText("Commit message template is required")
			).toBeInTheDocument();
		});
	});

	describe("operation select", () => {
		it("calls onActionChange with new operation when selection changes", async () => {
			const user = userEvent.setup();
			const action = makeGitAction({ operation: "commit" });

			render(
				<GitActionForm
					action={action}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Operation");
			await user.selectOptions(select, "create-branch");

			expect(mockOnActionChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "git",
					parameters: expect.objectContaining({ operation: "create-branch" }),
				})
			);
		});
	});
});
