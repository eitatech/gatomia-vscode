/**
 * NewSessionComposer tests.
 *
 * Validates that the empty-state composer integrates the
 * {@link PermissionChip} (Copilot-style integrated toolbar) and forwards
 * user picks back to the bridge, plus the existing submit/start path
 * keeps working with the new required props in place.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewSessionComposer } from "@/features/agent-chat/components/new-session-composer";
import type {
	AgentChatProviderOption,
	NewSessionRequest,
} from "@/features/agent-chat/types";

// Each ChipDropdown toggle button exposes its current selection via the
// accessible name `<Prefix>: <Label>`. Menu options carry their own
// short label as accessible name.
const PERMISSION_CHIP_RE = /^Permission:/i;
const AGENT_CHIP_RE = /^Agent:/i;
const AGENT_FILE_CHIP_RE = /^Agent file:/i;
const MODEL_CHIP_RE = /^Model:/i;
const THINKING_CHIP_RE = /^Thinking:/i;
const AGENT_ROLE_CHIP_RE = /^Agent role:/i;
const ALLOW_OPTION_RE = /^Auto-approve$/;
const START_CHAT_RE = /Start chat/i;
const PROMPT_PLACEHOLDER_RE = /Describe the task/i;

afterEach(() => {
	cleanup();
});

const PROVIDERS: readonly AgentChatProviderOption[] = [
	{
		id: "claude",
		displayName: "Claude",
		availability: "installed",
		enabled: true,
		source: "built-in",
		models: [
			{
				id: "claude-sonnet-4.6",
				displayName: "Sonnet 4.6",
				invocation: "initial-prompt",
			},
		],
		thinkingLevels: [
			{ id: "off", displayName: "Off" },
			{ id: "on", displayName: "On" },
		],
		agentRoles: [
			{ id: "agent", displayName: "Agent" },
			{ id: "plan", displayName: "Plan" },
		],
	},
];

describe("NewSessionComposer", () => {
	it("renders the permission chip in the integrated toolbar", () => {
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		// The chip toggle button exposes the current mode via its
		// accessible name (`Permission: Ask`). The dropdown options are
		// only mounted lazily once the toggle is opened.
		expect(
			screen.getByRole("button", { name: PERMISSION_CHIP_RE })
		).toBeDefined();
	});

	it("forwards permission picks made through the chip menu", () => {
		const onChangePermissionDefault = vi.fn();
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={onChangePermissionDefault}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: PERMISSION_CHIP_RE }));
		fireEvent.click(screen.getByRole("menuitem", { name: ALLOW_OPTION_RE }));

		expect(onChangePermissionDefault).toHaveBeenCalledWith("allow");
	});

	it("dispatches onStart with the picker selection on submit", () => {
		const onStart = vi.fn<(request: NewSessionRequest) => void>();
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={onStart}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		const textarea = screen.getByPlaceholderText(
			PROMPT_PLACEHOLDER_RE
		) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "do the thing" } });
		fireEvent.click(screen.getByRole("button", { name: START_CHAT_RE }));

		expect(onStart).toHaveBeenCalledTimes(1);
		const startedWith = onStart.mock.calls[0][0];
		expect(startedWith.providerId).toBe("claude");
		expect(startedWith.taskInstruction).toBe("do the thing");
	});

	it("disables Start chat when the prompt is empty", () => {
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		const submit = screen.getByRole("button", {
			name: START_CHAT_RE,
		}) as HTMLButtonElement;
		expect(submit.disabled).toBe(true);
	});

	it("renders Agent / Agent file / Model / Thinking / Agent role chips when supported", () => {
		// Agent chip + Agent file chip render unconditionally; Model,
		// Thinking and Agent role chips render only when the active
		// provider exposes at least one option.
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		expect(screen.getByRole("button", { name: AGENT_CHIP_RE })).toBeDefined();
		expect(
			screen.getByRole("button", { name: AGENT_FILE_CHIP_RE })
		).toBeDefined();
		expect(screen.getByRole("button", { name: MODEL_CHIP_RE })).toBeDefined();
		expect(
			screen.getByRole("button", { name: THINKING_CHIP_RE })
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: AGENT_ROLE_CHIP_RE })
		).toBeDefined();
	});

	it("hides the Model / Thinking / Agent-role chips when the active provider exposes none", () => {
		const minimalProviders: readonly AgentChatProviderOption[] = [
			{
				...PROVIDERS[0],
				id: "minimal",
				displayName: "Minimal",
				models: [],
				thinkingLevels: [],
				agentRoles: [],
			},
		];
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={minimalProviders}
			/>
		);

		expect(screen.queryByRole("button", { name: MODEL_CHIP_RE })).toBeNull();
		expect(screen.queryByRole("button", { name: THINKING_CHIP_RE })).toBeNull();
		expect(
			screen.queryByRole("button", { name: AGENT_ROLE_CHIP_RE })
		).toBeNull();
	});

	it("includes thinking-level and agent-role picks in the start payload", () => {
		// Pre-selected defaults are the first option of each list, so a
		// straight submit must echo them back to the bridge.
		const onStart = vi.fn<(request: NewSessionRequest) => void>();
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={onStart}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		const textarea = screen.getByPlaceholderText(
			PROMPT_PLACEHOLDER_RE
		) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "ship it" } });
		fireEvent.click(screen.getByRole("button", { name: START_CHAT_RE }));

		expect(onStart).toHaveBeenCalledTimes(1);
		const startedWith = onStart.mock.calls[0][0];
		expect(startedWith.thinkingLevelId).toBe("off");
		expect(startedWith.agentRoleId).toBe("agent");
	});
});
