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
});
