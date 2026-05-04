/**
 * PermissionToggle tests.
 *
 * The toggle is the segmented control rendered on the empty-state
 * composer. It surfaces the current `gatomia.acp.permissionDefault`
 * value and persists user picks through the bridge.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PermissionToggle } from "@/features/agent-chat/components/permission-toggle";

const ASK_LABEL_RE = /^Ask$/;
const ALLOW_LABEL_RE = /^Auto-approve$/;
const REJECT_LABEL_RE = /^Reject$/;

afterEach(() => {
	cleanup();
});

describe("PermissionToggle", () => {
	it("renders the three permission options", () => {
		render(<PermissionToggle onChange={vi.fn()} value="ask" />);

		expect(screen.getByRole("button", { name: ASK_LABEL_RE })).toBeDefined();
		expect(screen.getByRole("button", { name: ALLOW_LABEL_RE })).toBeDefined();
		expect(screen.getByRole("button", { name: REJECT_LABEL_RE })).toBeDefined();
	});

	it("marks the active option with aria-pressed=true", () => {
		render(<PermissionToggle onChange={vi.fn()} value="allow" />);

		const allow = screen.getByRole("button", { name: ALLOW_LABEL_RE });
		expect(allow.getAttribute("aria-pressed")).toBe("true");

		const ask = screen.getByRole("button", { name: ASK_LABEL_RE });
		expect(ask.getAttribute("aria-pressed")).toBe("false");
	});

	it("falls back to ask when value is undefined", () => {
		render(<PermissionToggle onChange={vi.fn()} value={undefined} />);

		const ask = screen.getByRole("button", { name: ASK_LABEL_RE });
		expect(ask.getAttribute("aria-pressed")).toBe("true");
	});

	it("invokes onChange with the picked mode", () => {
		const onChange = vi.fn();
		render(<PermissionToggle onChange={onChange} value="ask" />);

		fireEvent.click(screen.getByRole("button", { name: ALLOW_LABEL_RE }));

		expect(onChange).toHaveBeenCalledWith("allow");
	});

	it("disables every option when the disabled prop is true", () => {
		render(<PermissionToggle disabled={true} onChange={vi.fn()} value="ask" />);

		expect(
			(screen.getByRole("button", { name: ASK_LABEL_RE }) as HTMLButtonElement)
				.disabled
		).toBe(true);
		expect(
			(
				screen.getByRole("button", {
					name: ALLOW_LABEL_RE,
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
	});
});
