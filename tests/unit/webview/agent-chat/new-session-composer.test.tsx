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

	it("renders Agent / Agent file / Model as chip dropdowns matching the permission chip", () => {
		// Agent chip + Agent file chip render unconditionally; Model chip
		// only renders when the active provider has at least one model
		// (Claude in this fixture surfaces `claude-sonnet-4.6`).
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
	});

	it("hides the Model chip when the active provider exposes no models", () => {
		const noModelProviders: readonly AgentChatProviderOption[] = [
			{
				...PROVIDERS[0],
				id: "no-models",
				displayName: "No models",
				models: [],
			},
		];
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={noModelProviders}
			/>
		);

		expect(screen.queryByRole("button", { name: MODEL_CHIP_RE })).toBeNull();
	});
});
