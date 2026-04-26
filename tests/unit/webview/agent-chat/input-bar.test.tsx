/**
 * InputBar tests (T022).
 * TDD: red before T031.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InputBar } from "@/features/agent-chat/components/input-bar";

const SEND_BUTTON_RE = /send/i;
const NO_FOLLOW_UP_RE = /does not accept follow-up/i;
const READ_ONLY_RE = /read-only cloud session/i;
const ATTACH_BUTTON_RE = /add attachment/i;
const CODE_MODE_RE = /code mode/i;
const DICTATION_RE = /dictation/i;
const STOP_BUTTON_RE = /stop/i;
const ASK_PLACEHOLDER_RE = /Ask anything/i;

afterEach(() => {
	cleanup();
});

describe("InputBar", () => {
	it("invokes onSubmit with the content when the submit control is clicked", () => {
		const onSubmit = vi.fn();
		render(<InputBar acceptsFollowUp={true} onSubmit={onSubmit} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "hello" } });
		fireEvent.click(screen.getByRole("button", { name: SEND_BUTTON_RE }));
		expect(onSubmit).toHaveBeenCalledWith("hello");
	});

	it("disables the input with an explanation when acceptsFollowUp is false", () => {
		const onSubmit = vi.fn();
		render(<InputBar acceptsFollowUp={false} onSubmit={onSubmit} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.disabled).toBe(true);
		expect(screen.getByText(NO_FOLLOW_UP_RE)).toBeInTheDocument();
	});

	it("disables the input with an explanation when session is read-only", () => {
		const onSubmit = vi.fn();
		render(
			<InputBar
				acceptsFollowUp={true}
				onSubmit={onSubmit}
				readOnly={true}
				readOnlyReason="read-only cloud session"
			/>
		);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.disabled).toBe(true);
		expect(screen.getByText(READ_ONLY_RE)).toBeInTheDocument();
	});

	it("disables the input when the session is in a terminal state", () => {
		const onSubmit = vi.fn();
		render(
			<InputBar acceptsFollowUp={true} onSubmit={onSubmit} terminal={true} />
		);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.disabled).toBe(true);
	});

	it("renders the toolbar chrome (attach + Code chip + mic) regardless of state", () => {
		// The toolbar buttons are placeholders that mirror the Cursor-
		// style mockup. They are rendered but disabled until follow-up
		// UX work wires real handlers — the test pins the chrome so the
		// redesign cannot accidentally drop them.
		render(<InputBar acceptsFollowUp={true} onSubmit={vi.fn()} />);
		expect(
			screen.getByRole("button", { name: ATTACH_BUTTON_RE })
		).toBeDisabled();
		expect(screen.getByRole("button", { name: CODE_MODE_RE })).toBeDisabled();
		expect(screen.getByRole("button", { name: DICTATION_RE })).toBeDisabled();
	});

	it("shows the model label in the toolbar when provided", () => {
		render(
			<InputBar
				acceptsFollowUp={true}
				modelLabel="claude-sonnet-4.6"
				onSubmit={vi.fn()}
			/>
		);
		expect(screen.getByText("claude-sonnet-4.6")).toBeInTheDocument();
	});

	it("renders the activity spinner when busy is true", () => {
		render(<InputBar acceptsFollowUp={true} busy={true} onSubmit={vi.fn()} />);
		expect(screen.getByTestId("input-activity")).toBeInTheDocument();
	});

	it("swaps Send for a Stop button when busy with a cancel handler", () => {
		const onCancel = vi.fn();
		render(
			<InputBar
				acceptsFollowUp={true}
				busy={true}
				onCancel={onCancel}
				onSubmit={vi.fn()}
			/>
		);
		// Send button is hidden while the agent is running.
		expect(screen.queryByRole("button", { name: SEND_BUTTON_RE })).toBeNull();
		const stopButton = screen.getByRole("button", { name: STOP_BUTTON_RE });
		fireEvent.click(stopButton);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("uses the new Cursor-style placeholder when enabled", () => {
		render(<InputBar acceptsFollowUp={true} onSubmit={vi.fn()} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.placeholder).toMatch(ASK_PLACEHOLDER_RE);
	});
});
