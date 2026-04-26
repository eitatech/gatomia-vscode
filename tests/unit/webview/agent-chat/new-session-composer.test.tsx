/**
 * NewSessionComposer tests.
 *
 * Validates that the empty-state composer integrates the
 * {@link PermissionToggle} and forwards user picks back to the bridge,
 * plus the existing submit/start path keeps working with the new
 * required props in place.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewSessionComposer } from "@/features/agent-chat/components/new-session-composer";
import type {
	AgentChatProviderOption,
	NewSessionRequest,
} from "@/features/agent-chat/types";

const ALLOW_BUTTON_RE = /^Auto-approve$/;
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
	it("renders the permission toggle alongside the picker", () => {
		render(
			<NewSessionComposer
				agentFiles={[]}
				onChangePermissionDefault={vi.fn()}
				onStart={vi.fn()}
				permissionDefault="ask"
				providers={PROVIDERS}
			/>
		);

		// PermissionToggle is rendered with its three-options segmented
		// control. The "Auto-approve" option is the easiest to assert
		// against because the regex doesn't collide with anything else
		// in the composer chrome.
		expect(screen.getByRole("button", { name: ALLOW_BUTTON_RE })).toBeDefined();
	});

	it("forwards toggle picks to onChangePermissionDefault", () => {
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

		fireEvent.click(screen.getByRole("button", { name: ALLOW_BUTTON_RE }));

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
});
