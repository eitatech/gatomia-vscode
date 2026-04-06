/**
 * Unit Tests for AcpKnownAgentsPanel (T085)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * Covers:
 *   - Renders all 7 known agents in a checklist
 *   - Checkbox state reflects `enabled` from KnownAgentStatus
 *   - Detected badge rendered for detected agents
 *   - Toggle fires onToggle callback with correct id + enabled value
 *   - Disabled when the parent is disabled
 *
 * @feature 001-hooks-refactor Phase 8
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcpKnownAgentsPanel } from "../../../../ui/src/features/hooks-view/components/acp-known-agents-panel";
import type { KnownAgentStatus } from "../../../../ui/src/features/hooks-view/types";

// ---------------------------------------------------------------------------
// Top-level regex constants (Constitution: no inline regex)
// ---------------------------------------------------------------------------
const DETECTED_PATTERN = /detected/i;
const NOT_INSTALLED_PATTERN = /not installed/i;
const GEMINI_PATTERN = /gemini/i;
const OPENCODE_PATTERN = /opencode/i;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEVEN_AGENTS: KnownAgentStatus[] = [
	{
		id: "claude-acp",
		displayName: "Claude Code",
		agentCommand: "npx @zed-industries/claude-agent-acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
	{
		id: "kimi",
		displayName: "Kimi Code CLI",
		agentCommand: "kimi acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
	{
		id: "gemini",
		displayName: "Gemini CLI",
		agentCommand: "npx @google/gemini-cli --experimental-acp",
		enabled: true,
		isDetected: true,
		descriptor: {
			agentCommand: "npx @google/gemini-cli --experimental-acp",
			agentDisplayName: "Gemini CLI",
			source: "known",
			knownAgentId: "gemini",
		},
	},
	{
		id: "github-copilot",
		displayName: "GitHub Copilot",
		agentCommand: "npx @github/copilot-language-server --acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
	{
		id: "codex-acp",
		displayName: "OpenAI Codex",
		agentCommand: "npx @zed-industries/codex-acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
	{
		id: "mistral-vibe",
		displayName: "Mistral Vibe",
		agentCommand: "vibe-acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
	{
		id: "opencode",
		displayName: "OpenCode",
		agentCommand: "opencode acp",
		enabled: false,
		isDetected: false,
		descriptor: null,
	},
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AcpKnownAgentsPanel", () => {
	const mockOnToggle = vi.fn();

	beforeEach(() => {
		mockOnToggle.mockClear();
	});

	describe("rendering", () => {
		it("renders all 7 known agent names", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			for (const agent of SEVEN_AGENTS) {
				expect(screen.getByText(agent.displayName)).toBeInTheDocument();
			}
		});

		it("renders a checkbox for each agent", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			const checkboxes = screen.getAllByRole("checkbox");
			expect(checkboxes).toHaveLength(7);
		});

		it("marks enabled agents as checked", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			const geminiCheckbox = screen.getByRole("checkbox", {
				name: GEMINI_PATTERN,
			});
			expect(geminiCheckbox).toBeChecked();
		});

		it("marks disabled agents as unchecked", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			const opencodeCheckbox = screen.getByRole("checkbox", {
				name: OPENCODE_PATTERN,
			});
			expect(opencodeCheckbox).not.toBeChecked();
		});

		it("shows a 'detected' indicator for detected agents", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			expect(screen.getByTestId("detected-gemini")).toBeInTheDocument();
			expect(screen.getByTestId("detected-gemini").textContent).toMatch(
				DETECTED_PATTERN
			);
		});

		it("shows a 'not installed' indicator for undetected agents", () => {
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			expect(screen.getByTestId("detected-opencode")).toBeInTheDocument();
			expect(screen.getByTestId("detected-opencode").textContent).toMatch(
				NOT_INSTALLED_PATTERN
			);
		});
	});

	describe("interactions", () => {
		it("calls onToggle with id=gemini and enabled=false when gemini is unchecked", async () => {
			const user = userEvent.setup();
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			const geminiCheckbox = screen.getByRole("checkbox", {
				name: GEMINI_PATTERN,
			});
			await user.click(geminiCheckbox);

			expect(mockOnToggle).toHaveBeenCalledWith("gemini", false);
		});

		it("calls onToggle with id=opencode and enabled=true when opencode is checked", async () => {
			const user = userEvent.setup();
			render(
				<AcpKnownAgentsPanel agents={SEVEN_AGENTS} onToggle={mockOnToggle} />
			);

			const opencodeCheckbox = screen.getByRole("checkbox", {
				name: OPENCODE_PATTERN,
			});
			await user.click(opencodeCheckbox);

			expect(mockOnToggle).toHaveBeenCalledWith("opencode", true);
		});
	});

	describe("disabled state", () => {
		it("disables all checkboxes when disabled prop is true", () => {
			render(
				<AcpKnownAgentsPanel
					agents={SEVEN_AGENTS}
					disabled={true}
					onToggle={mockOnToggle}
				/>
			);

			const checkboxes = screen.getAllByRole("checkbox");
			for (const cb of checkboxes) {
				expect(cb).toBeDisabled();
			}
		});
	});

	describe("empty state", () => {
		it("renders nothing when agents array is empty", () => {
			const { container } = render(
				<AcpKnownAgentsPanel agents={[]} onToggle={mockOnToggle} />
			);

			expect(container.firstChild).toBeNull();
		});
	});
});
