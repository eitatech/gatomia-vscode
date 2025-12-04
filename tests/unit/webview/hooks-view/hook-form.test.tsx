import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HookForm } from "../../../../webview-ui/src/features/hooks-view/components/hook-form";
import type { Hook } from "../../../../webview-ui/src/features/hooks-view/types";

const CREATE_HOOK_BUTTON = /Create Hook/i;
const SAVE_CHANGES_BUTTON = /Save Changes/i;
const CANCEL_BUTTON = /Cancel/i;
const COMMAND_PLACEHOLDER = "/speckit.clarify or /openspec.analyze";

describe("HookForm", () => {
	const mockOnSubmit = vi.fn();
	const mockOnCancel = vi.fn();

	const mockHook: Hook = {
		id: "test-hook-1",
		name: "Test Hook",
		enabled: true,
		trigger: {
			agent: "speckit",
			operation: "specify",
			timing: "after",
		},
		action: {
			type: "agent",
			parameters: {
				command: "/speckit.clarify",
			},
		},
		createdAt: new Date().toISOString(),
		modifiedAt: new Date().toISOString(),
		executionCount: 0,
	};

	beforeEach(() => {
		mockOnSubmit.mockClear();
		mockOnCancel.mockClear();
	});

	describe("Create Mode", () => {
		it("renders create form with default values", () => {
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			expect(screen.getByText("Create Hook")).toBeInTheDocument();
			expect(screen.getByLabelText("Name")).toHaveValue("");
			expect(screen.getByLabelText("Enabled")).toBeChecked();
			expect(screen.getByLabelText("Agent")).toHaveValue("speckit");
			const [triggerOperationSelect] = screen.getAllByLabelText("Operation");
			expect(triggerOperationSelect).toHaveValue("specify");
			expect(screen.getByLabelText("Type")).toHaveValue("agent");
		});

		it("validates required name field", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText("Hook name is required")).toBeInTheDocument();
			});
			expect(mockOnSubmit).not.toHaveBeenCalled();
		});

		it("validates name length (max 100 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "a".repeat(101));

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Hook name must be 100 characters or less")
				).toBeInTheDocument();
			});
			expect(mockOnSubmit).not.toHaveBeenCalled();
		});

		it("creates hook with valid data", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Auto-clarify after specify");

			const commandInput = screen.getByPlaceholderText(COMMAND_PLACEHOLDER);
			await user.type(commandInput, "/speckit.clarify");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockOnSubmit).toHaveBeenCalledWith({
					name: "Auto-clarify after specify",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "agent",
						parameters: {
							command: "/speckit.clarify",
						},
					},
				});
			});
		});

		it("calls onCancel when cancel button is clicked", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const cancelButton = screen.getByRole("button", { name: CANCEL_BUTTON });
			await user.click(cancelButton);

			expect(mockOnCancel).toHaveBeenCalled();
		});
	});

	describe("Edit Mode", () => {
		it("renders edit form with initial data", () => {
			render(
				<HookForm
					initialData={mockHook}
					mode="edit"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			expect(screen.getByText("Edit Hook")).toBeInTheDocument();
			expect(screen.getByLabelText("Name")).toHaveValue("Test Hook");
			expect(screen.getByLabelText("Enabled")).toBeChecked();
			expect(screen.getByLabelText("Agent")).toHaveValue("speckit");
			const [triggerOperationSelect] = screen.getAllByLabelText("Operation");
			expect(triggerOperationSelect).toHaveValue("specify");
			expect(screen.getByLabelText("Type")).toHaveValue("agent");
		});

		it("updates hook with modified data", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					initialData={mockHook}
					mode="edit"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Hook Name");

			const submitButton = screen.getByRole("button", {
				name: SAVE_CHANGES_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockOnSubmit).toHaveBeenCalledWith(
					expect.objectContaining({
						name: "Updated Hook Name",
					})
				);
			});
		});
	});

	describe("Agent Action Type", () => {
		it("validates command is required", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText("Command is required")).toBeInTheDocument();
			});
		});

		it("validates command format (must start with /speckit. or /openspec.)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const commandInput = screen.getByPlaceholderText(COMMAND_PLACEHOLDER);
			await user.type(commandInput, "/invalid.command");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Command must start with /speckit. or /openspec.")
				).toBeInTheDocument();
			});
		});

		it("validates command length (max 200 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const commandInput = screen.getByPlaceholderText(COMMAND_PLACEHOLDER);
			await user.type(commandInput, `/speckit.${"a".repeat(200)}`);

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Command must be 200 characters or less")
				).toBeInTheDocument();
			});
		});
	});

	describe("Git Action Type", () => {
		it("renders git action fields when type is changed to git", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "git");

			await waitFor(() => {
				const [, actionOperationSelect] = screen.getAllByLabelText("Operation");
				expect(actionOperationSelect).toBeInTheDocument();
				expect(screen.getByLabelText("Message Template")).toBeInTheDocument();
				expect(
					screen.getByLabelText("Push to remote after commit")
				).toBeInTheDocument();
			});
		});

		it("validates message template is required for git action", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "git");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Commit message template is required")
				).toBeInTheDocument();
			});
		});

		it("validates message template length (max 500 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "git");

			const messageTemplateInput = screen.getByLabelText("Message Template");
			await user.type(messageTemplateInput, "a".repeat(501));

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Message template must be 500 characters or less")
				).toBeInTheDocument();
			});
		});

		it("creates hook with git action", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Auto-commit");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "git");

			const messageTemplateInput = screen.getByLabelText("Message Template");
			fireEvent.change(messageTemplateInput, {
				target: { value: "feat({feature}): automated update" },
			});

			const pushCheckbox = screen.getByLabelText("Push to remote after commit");
			await user.click(pushCheckbox);

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockOnSubmit).toHaveBeenCalledWith({
					name: "Auto-commit",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "git",
						parameters: {
							operation: "commit",
							messageTemplate: "feat({feature}): automated update",
							pushToRemote: true,
						},
					},
				});
			});
		});
	});

	describe("GitHub Action Type", () => {
		it("renders github action fields when type is changed to github", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			await waitFor(() => {
				const [, actionOperationSelect] = screen.getAllByLabelText("Operation");
				expect(actionOperationSelect).toBeInTheDocument();
				expect(screen.getByLabelText("Repository")).toBeInTheDocument();
			});
		});

		it("validates title is required for open-issue operation", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Title is required for this operation")
				).toBeInTheDocument();
			});
		});

		it("validates issue number is required for close-issue operation", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			const [, operationSelect] = screen.getAllByLabelText("Operation");
			await user.selectOptions(operationSelect, "close-issue");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Issue number is required for this operation")
				).toBeInTheDocument();
			});
		});

		it("validates title length (max 200 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			const titleInput = screen.getByLabelText("Title");
			fireEvent.change(titleInput, { target: { value: "a".repeat(201) } });

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Title must be 200 characters or less")
				).toBeInTheDocument();
			});
		});

		it("validates body length (max 5000 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Test Hook" } });

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			const titleInput = screen.getByLabelText("Title");
			fireEvent.change(titleInput, { target: { value: "Valid title" } });

			const bodyInput = screen.getByLabelText("Body");
			fireEvent.change(bodyInput, { target: { value: "a".repeat(5001) } });

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Body must be 5000 characters or less")
				).toBeInTheDocument();
			});
		});

		it("creates hook with github open-issue action", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			fireEvent.change(nameInput, { target: { value: "Auto-create-issue" } });

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "github");

			const titleInput = screen.getByLabelText("Title");
			fireEvent.change(titleInput, {
				target: { value: "Spec created for {feature}" },
			});

			const bodyInput = screen.getByLabelText("Body");
			fireEvent.change(bodyInput, {
				target: { value: "Created at {timestamp}" },
			});

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockOnSubmit).toHaveBeenCalledWith({
					name: "Auto-create-issue",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "github",
						parameters: {
							operation: "open-issue",
							titleTemplate: "Spec created for {feature}",
							bodyTemplate: "Created at {timestamp}",
						},
					},
				});
			});
		});
	});

	describe("Custom Action Type", () => {
		it("renders custom action fields when type is changed to custom", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "custom");

			await waitFor(() => {
				expect(screen.getByLabelText("Agent Name")).toBeInTheDocument();
				expect(screen.getByLabelText("Arguments")).toBeInTheDocument();
			});
		});

		it("validates agent name is required", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "custom");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText("Agent name is required")).toBeInTheDocument();
			});
		});

		it("validates agent name length (max 50 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "custom");

			const agentNameInput = screen.getByLabelText("Agent Name");
			await user.type(agentNameInput, "a".repeat(51));

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Agent name must be 50 characters or less")
				).toBeInTheDocument();
			});
		});

		it("validates arguments length (max 1000 characters)", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "custom");

			const agentNameInput = screen.getByLabelText("Agent Name");
			await user.type(agentNameInput, "my-agent");

			const argumentsInput = screen.getByLabelText("Arguments");
			await user.type(argumentsInput, "a".repeat(1001));

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Arguments must be 1000 characters or less")
				).toBeInTheDocument();
			});
		});

		it("creates hook with custom action", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Run custom agent");

			const actionTypeSelect = screen.getByLabelText("Type");
			await user.selectOptions(actionTypeSelect, "custom");

			const agentNameInput = screen.getByLabelText("Agent Name");
			await user.type(agentNameInput, "my-custom-agent");

			const argumentsInput = screen.getByLabelText("Arguments");
			fireEvent.change(argumentsInput, {
				target: { value: "--mode=auto --feature={feature}" },
			});

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockOnSubmit).toHaveBeenCalledWith({
					name: "Run custom agent",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "custom",
						parameters: {
							agentName: "my-custom-agent",
							arguments: "--mode=auto --feature={feature}",
						},
					},
				});
			});
		});
	});

	describe("Error Handling", () => {
		it("displays error message from props", () => {
			render(
				<HookForm
					error="Failed to create hook"
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			expect(screen.getByText("Failed to create hook")).toBeInTheDocument();
			expect(screen.getByRole("alert")).toBeInTheDocument();
		});

		it("clears field errors when input is corrected", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText("Hook name is required")).toBeInTheDocument();
			});

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Valid name");

			await waitFor(() => {
				expect(
					screen.queryByText("Hook name is required")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Form State", () => {
		it("disables form inputs while submitting", async () => {
			const user = userEvent.setup();
			const slowOnSubmit = vi.fn(
				() => new Promise((resolve) => setTimeout(resolve, 100))
			);

			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={slowOnSubmit}
				/>
			);

			const nameInput = screen.getByLabelText("Name");
			await user.type(nameInput, "Test Hook");

			const commandInput = screen.getByPlaceholderText(COMMAND_PLACEHOLDER);
			await user.type(commandInput, "/speckit.clarify");

			const submitButton = screen.getByRole("button", {
				name: CREATE_HOOK_BUTTON,
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toBeDisabled();
				expect(screen.getByLabelText("Enabled")).toBeDisabled();
				expect(submitButton).toBeDisabled();
				expect(submitButton).toHaveTextContent("Saving...");
			});
		});

		it("toggles enabled checkbox", async () => {
			const user = userEvent.setup();
			render(
				<HookForm
					mode="create"
					onCancel={mockOnCancel}
					onSubmit={mockOnSubmit}
				/>
			);

			const enabledCheckbox = screen.getByLabelText("Enabled");
			expect(enabledCheckbox).toBeChecked();

			await user.click(enabledCheckbox);
			expect(enabledCheckbox).not.toBeChecked();

			await user.click(enabledCheckbox);
			expect(enabledCheckbox).toBeChecked();
		});
	});
});
