import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubActionForm } from "../../../ui/src/features/hooks-view/components/github-action-form";
import type {
	ActionConfig,
	GitHubActionParams,
} from "../../../ui/src/features/hooks-view/types";

const makeGitHubAction = (
	overrides?: Partial<GitHubActionParams>
): ActionConfig => ({
	type: "github",
	parameters: {
		operation: "open-issue",
		...overrides,
	} as GitHubActionParams,
});

describe("GitHubActionForm", () => {
	const mockOnActionChange = vi.fn();
	const mockOnClearActionError = vi.fn();

	beforeEach(() => {
		mockOnActionChange.mockClear();
		mockOnClearActionError.mockClear();
	});

	describe("operation select", () => {
		it("renders all 11 operation options", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction()}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Operation");
			const options = Array.from(select.querySelectorAll("option")).map(
				(o) => o.value
			);
			expect(options).toContain("open-issue");
			expect(options).toContain("close-issue");
			expect(options).toContain("create-pr");
			expect(options).toContain("add-comment");
			expect(options).toContain("merge-pr");
			expect(options).toContain("close-pr");
			expect(options).toContain("add-label");
			expect(options).toContain("remove-label");
			expect(options).toContain("request-review");
			expect(options).toContain("assign-issue");
			expect(options).toContain("create-release");
		});

		it("always shows the Repository field", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction()}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Repository")).toBeInTheDocument();
		});
	});

	describe("open-issue operation", () => {
		it("shows title and body fields for open-issue", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "open-issue" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Title")).toBeInTheDocument();
			expect(screen.getByLabelText("Body")).toBeInTheDocument();
		});

		it("does not show PR Number for open-issue", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "open-issue" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("PR Number")).not.toBeInTheDocument();
		});
	});

	describe("create-pr operation", () => {
		it("shows title and body fields for create-pr", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "create-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Title")).toBeInTheDocument();
			expect(screen.getByLabelText("Body")).toBeInTheDocument();
		});
	});

	describe("close-issue operation", () => {
		it("shows issue number for close-issue", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "close-issue" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Issue Number")).toBeInTheDocument();
		});
	});

	describe("add-comment operation", () => {
		it("shows issue number for add-comment", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "add-comment" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Issue Number")).toBeInTheDocument();
		});
	});

	describe("merge-pr operation", () => {
		it("shows PR number and merge method for merge-pr", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "merge-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("PR Number")).toBeInTheDocument();
			expect(screen.getByLabelText("Merge Method")).toBeInTheDocument();
		});

		it("does not show issue number for merge-pr", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "merge-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("Issue Number")).not.toBeInTheDocument();
		});
	});

	describe("close-pr operation", () => {
		it("shows PR number for close-pr", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "close-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("PR Number")).toBeInTheDocument();
		});
	});

	describe("request-review operation", () => {
		it("shows PR number and reviewers for request-review", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "request-review" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("PR Number")).toBeInTheDocument();
			expect(screen.getByLabelText("Reviewers")).toBeInTheDocument();
		});
	});

	describe("add-label operation", () => {
		it("shows issue number and labels for add-label", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "add-label" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Issue Number")).toBeInTheDocument();
			expect(screen.getByLabelText("Labels")).toBeInTheDocument();
		});
	});

	describe("remove-label operation", () => {
		it("shows issue number and label name for remove-label", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "remove-label" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Issue Number")).toBeInTheDocument();
			expect(screen.getByLabelText("Label Name")).toBeInTheDocument();
		});
	});

	describe("assign-issue operation", () => {
		it("shows issue number and assignees for assign-issue", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "assign-issue" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Issue Number")).toBeInTheDocument();
			expect(screen.getByLabelText("Assignees")).toBeInTheDocument();
		});
	});

	describe("create-release operation", () => {
		it("shows tag name, release name, release body, draft, and prerelease for create-release", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "create-release" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Tag Name")).toBeInTheDocument();
			expect(screen.getByLabelText("Release Name")).toBeInTheDocument();
			expect(screen.getByLabelText("Release Body")).toBeInTheDocument();
			expect(screen.getByLabelText("Draft")).toBeInTheDocument();
			expect(screen.getByLabelText("Pre-release")).toBeInTheDocument();
		});

		it("does not show issue number for create-release", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "create-release" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.queryByLabelText("Issue Number")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("PR Number")).not.toBeInTheDocument();
		});
	});

	describe("field interaction", () => {
		it("calls onActionChange when PR number is changed", async () => {
			const user = userEvent.setup();

			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "merge-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const prInput = screen.getByLabelText("PR Number");
			await user.type(prInput, "42");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onActionChange when tag name is changed", async () => {
			const user = userEvent.setup();

			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "create-release" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const tagInput = screen.getByLabelText("Tag Name");
			await user.type(tagInput, "v2.0.0");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onClearActionError when a field changes", async () => {
			const user = userEvent.setup();

			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "merge-pr" })}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const prInput = screen.getByLabelText("PR Number");
			await user.type(prInput, "10");

			expect(mockOnClearActionError).toHaveBeenCalled();
		});

		it("renders with disabled state", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "create-release" })}
					disabled={true}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Tag Name")).toBeDisabled();
		});

		it("shows action error when provided", () => {
			render(
				<GitHubActionForm
					action={makeGitHubAction({ operation: "open-issue" })}
					actionError="Title is required for this operation"
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(
				screen.getByText("Title is required for this operation")
			).toBeInTheDocument();
		});
	});
});
