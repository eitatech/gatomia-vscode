/**
 * Unit Tests for AcpAgentForm (T049)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * @see ui/src/features/hooks-view/components/acp-agent-form.tsx
 * @feature 001-hooks-refactor Phase 6
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcpAgentForm } from "../../../ui/src/features/hooks-view/components/acp-agent-form";
import type { ACPActionParams } from "../../../ui/src/features/hooks-view/types";
import type { ActionConfig } from "../../../ui/src/features/hooks-view/types";

// ---------------------------------------------------------------------------
// Top-level regex constants (required by useTopLevelRegex rule)
// ---------------------------------------------------------------------------

const MODE_LABEL_PATTERN = /mode/i;
const AGENT_DISPLAY_NAME_LABEL_PATTERN = /agent display name/i;
const WORKING_DIRECTORY_LABEL_PATTERN = /working directory/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAcpAction = (overrides?: Partial<ACPActionParams>): ActionConfig => ({
	type: "acp",
	parameters: {
		mode: "local",
		agentCommand: "",
		taskInstruction: "",
		...overrides,
	} as ACPActionParams,
});

const DISCOVERED_AGENTS = [
	{
		agentCommand: "npx my-acp-agent --acp",
		agentDisplayName: "My ACP Agent",
		source: "workspace" as const,
	},
	{
		agentCommand: "npx other-agent --acp",
		agentDisplayName: "Other Agent",
		source: "workspace" as const,
	},
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AcpAgentForm", () => {
	const mockOnActionChange = vi.fn();
	const mockOnClearActionError = vi.fn();

	beforeEach(() => {
		mockOnActionChange.mockClear();
		mockOnClearActionError.mockClear();
	});

	// -----------------------------------------------------------------------
	// Mode display
	// -----------------------------------------------------------------------

	describe("mode display", () => {
		it("shows 'Local Agent' as the mode (locked)", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			// Mode should be displayed but not editable
			expect(screen.getByText("Local Agent")).toBeInTheDocument();
		});

		it("does not allow changing the mode", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			// There should be no dropdown/select for mode that can be changed to another value
			const modeSelect = screen.queryByRole("combobox", {
				name: MODE_LABEL_PATTERN,
			});
			if (modeSelect) {
				// If present it should be disabled or have only one option
				const options = Array.from(
					(modeSelect as HTMLSelectElement).querySelectorAll("option")
				);
				expect(options.length).toBeLessThanOrEqual(1);
			} else {
				// Static text display — acceptable
				expect(screen.getByText("Local Agent")).toBeInTheDocument();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Agent command field
	// -----------------------------------------------------------------------

	describe("agentCommand field", () => {
		it("shows agentCommand dropdown when discovered agents are provided", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Agent Command");
			expect(select).toBeInTheDocument();
		});

		it("includes discovered agent options in the dropdown", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Agent Command");
			expect(
				within(select as HTMLElement).getByText("My ACP Agent")
			).toBeInTheDocument();
			expect(
				within(select as HTMLElement).getByText("Other Agent")
			).toBeInTheDocument();
		});

		it("includes a 'Custom command' option in the dropdown", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Agent Command");
			const options = Array.from(
				(select as HTMLSelectElement).querySelectorAll("option")
			).map((o) => o.textContent ?? "");
			expect(options.some((t) => t.toLowerCase().includes("custom"))).toBe(
				true
			);
		});

		it("shows custom text input when no discovered agents and empty agentCommand", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction({ agentCommand: "" })}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			// Should show a text input for the command
			expect(screen.getByLabelText("Agent Command")).toBeInTheDocument();
		});

		it("calls onActionChange when agentCommand select changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Agent Command");
			await user.selectOptions(select, "npx my-acp-agent --acp");

			expect(mockOnActionChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "acp",
					parameters: expect.objectContaining({
						agentCommand: "npx my-acp-agent --acp",
					}),
				})
			);
		});

		it("calls onClearActionError when agentCommand changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const select = screen.getByLabelText("Agent Command");
			await user.selectOptions(select, "npx my-acp-agent --acp");

			expect(mockOnClearActionError).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Task instruction textarea
	// -----------------------------------------------------------------------

	describe("taskInstruction field", () => {
		it("renders a taskInstruction textarea", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Task Instruction")).toBeInTheDocument();
		});

		it("shows current taskInstruction value", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction({ taskInstruction: "Do something useful" })}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const textarea = screen.getByLabelText("Task Instruction");
			expect((textarea as HTMLTextAreaElement).value).toBe(
				"Do something useful"
			);
		});

		it("calls onActionChange when taskInstruction changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const textarea = screen.getByLabelText("Task Instruction");
			await user.type(textarea, "Review the spec");

			expect(mockOnActionChange).toHaveBeenCalled();
			const lastCall = mockOnActionChange.mock.calls.at(-1)?.[0];
			expect(
				(lastCall.parameters as ACPActionParams).taskInstruction
			).toContain("Review the spec");
		});

		it("calls onClearActionError when taskInstruction changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const textarea = screen.getByLabelText("Task Instruction");
			await user.type(textarea, "A");

			expect(mockOnClearActionError).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Optional fields
	// -----------------------------------------------------------------------

	describe("optional fields", () => {
		it("renders agentDisplayName input", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(
				screen.getByLabelText(AGENT_DISPLAY_NAME_LABEL_PATTERN)
			).toBeInTheDocument();
		});

		it("renders cwd input", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(
				screen.getByLabelText(WORKING_DIRECTORY_LABEL_PATTERN)
			).toBeInTheDocument();
		});

		it("calls onActionChange when agentDisplayName changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const input = screen.getByLabelText(AGENT_DISPLAY_NAME_LABEL_PATTERN);
			await user.type(input, "My Agent");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("calls onActionChange when cwd changes", async () => {
			const user = userEvent.setup();
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const input = screen.getByLabelText(WORKING_DIRECTORY_LABEL_PATTERN);
			await user.type(input, "/my/project");

			expect(mockOnActionChange).toHaveBeenCalled();
		});

		it("shows current cwd value", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction({ cwd: "/my/project" })}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			const input = screen.getByLabelText(WORKING_DIRECTORY_LABEL_PATTERN);
			expect((input as HTMLInputElement).value).toBe("/my/project");
		});
	});

	// -----------------------------------------------------------------------
	// Disabled state
	// -----------------------------------------------------------------------

	describe("disabled state", () => {
		it("disables taskInstruction textarea when disabled prop is true", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					disabled={true}
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Task Instruction")).toBeDisabled();
		});

		it("disables agentCommand field when disabled prop is true", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					disabled={true}
					discoveredAgents={DISCOVERED_AGENTS}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByLabelText("Agent Command")).toBeDisabled();
		});
	});

	// -----------------------------------------------------------------------
	// Error display
	// -----------------------------------------------------------------------

	describe("error display", () => {
		it("shows actionError when provided", () => {
			render(
				<AcpAgentForm
					action={makeAcpAction()}
					actionError="Agent command is required"
					discoveredAgents={[]}
					onActionChange={mockOnActionChange}
					onClearActionError={mockOnClearActionError}
				/>
			);

			expect(screen.getByText("Agent command is required")).toBeInTheDocument();
		});
	});
});
