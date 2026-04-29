/**
 * PermissionChip tests.
 *
 * The chip lives on the InputBar toolbar and exposes a dropdown menu so
 * the user can switch between Ask / Auto / Reject mid-conversation.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PermissionChip } from "@/features/agent-chat/components/permission-chip";

const ASK_TOGGLE_RE = /Permission:\s*Ask\s*\(Default\)/;
const AUTO_TOGGLE_RE = /Permission:\s*Auto/;
const REJECT_TOGGLE_RE = /Permission:\s*Reject/;
// "Ask" option label was renamed to "Ask (Default)" in the redesign so
// users can tell at a glance which permission mode is the fallback.
const ASK_OPTION_RE = /^Ask\s*\(Default\)$/;
const ALLOW_OPTION_RE = /^Auto-approve$/;
const REJECT_OPTION_RE = /^Reject$/;

afterEach(() => {
	cleanup();
});

describe("PermissionChip", () => {
	it("shows the short label for the active mode", () => {
		render(<PermissionChip onChange={vi.fn()} value="allow" />);

		const toggle = screen.getByRole("button", { name: AUTO_TOGGLE_RE });
		expect(toggle).toBeDefined();
	});

	it("falls back to Ask when the value is undefined", () => {
		render(<PermissionChip onChange={vi.fn()} value={undefined} />);

		expect(screen.getByRole("button", { name: ASK_TOGGLE_RE })).toBeDefined();
	});

	it("toggles the menu open and closed when the chip is clicked", () => {
		render(<PermissionChip onChange={vi.fn()} value="ask" />);

		const toggle = screen.getByRole("button", { name: ASK_TOGGLE_RE });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("menu")).toBeDefined();

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
	});

	it("calls onChange with the selected mode and closes the menu", () => {
		const onChange = vi.fn();
		render(<PermissionChip onChange={onChange} value="ask" />);

		fireEvent.click(screen.getByRole("button", { name: ASK_TOGGLE_RE }));
		fireEvent.click(screen.getByRole("menuitem", { name: ALLOW_OPTION_RE }));

		expect(onChange).toHaveBeenCalledWith("allow");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("does not call onChange when the user picks the already-active mode", () => {
		const onChange = vi.fn();
		render(<PermissionChip onChange={onChange} value="deny" />);

		fireEvent.click(screen.getByRole("button", { name: REJECT_TOGGLE_RE }));
		fireEvent.click(screen.getByRole("menuitem", { name: REJECT_OPTION_RE }));

		expect(onChange).not.toHaveBeenCalled();
	});

	it("renders one menuitem per option when open", () => {
		render(<PermissionChip onChange={vi.fn()} value="ask" />);

		fireEvent.click(screen.getByRole("button", { name: ASK_TOGGLE_RE }));

		expect(screen.getByRole("menuitem", { name: ASK_OPTION_RE })).toBeDefined();
		expect(
			screen.getByRole("menuitem", { name: ALLOW_OPTION_RE })
		).toBeDefined();
		expect(
			screen.getByRole("menuitem", { name: REJECT_OPTION_RE })
		).toBeDefined();
	});
});
