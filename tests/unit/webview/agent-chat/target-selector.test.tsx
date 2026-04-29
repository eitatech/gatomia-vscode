/**
 * TargetSelector tests (T053).
 * TDD: red before T063.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TargetSelector } from "@/features/agent-chat/components/target-selector";
import type { ExecutionTargetOption } from "@/features/agent-chat/types";

const TARGET_LABEL_RE = /execution target/i;
const CLOUD_PROVIDER_RE = /provider/i;
const CLOUD_OPTION_RE = /cloud/i;

const OPTIONS: ExecutionTargetOption[] = [
	{ kind: "local", label: "Local workspace", enabled: true },
	{ kind: "worktree", label: "Worktree", enabled: true },
	{
		kind: "cloud",
		label: "Cloud",
		enabled: false,
		disabledReason: "No cloud provider configured",
	},
];

afterEach(() => {
	cleanup();
});

describe("TargetSelector", () => {
	it("renders one <option> per available target", () => {
		render(
			<TargetSelector
				availableTargets={OPTIONS}
				onChange={vi.fn()}
				selectedTargetKind="local"
			/>
		);
		const select = screen.getByRole("combobox", { name: TARGET_LABEL_RE });
		expect(select.querySelectorAll("option")).toHaveLength(OPTIONS.length);
	});

	it("disables the Cloud option when no provider is configured", () => {
		render(
			<TargetSelector
				availableTargets={OPTIONS}
				onChange={vi.fn()}
				selectedTargetKind="local"
			/>
		);
		const cloudOption = screen.getByRole("option", {
			name: CLOUD_OPTION_RE,
		}) as HTMLOptionElement;
		expect(cloudOption.disabled).toBe(true);
	});

	it("shows the disabledReason hint when the Cloud option is disabled", () => {
		render(
			<TargetSelector
				availableTargets={OPTIONS}
				onChange={vi.fn()}
				selectedTargetKind="local"
			/>
		);
		expect(screen.getByText(CLOUD_PROVIDER_RE)).toBeInTheDocument();
	});

	it("invokes onChange with the new target kind on selection", () => {
		const handleChange = vi.fn();
		render(
			<TargetSelector
				availableTargets={OPTIONS}
				onChange={handleChange}
				selectedTargetKind="local"
			/>
		);
		const select = screen.getByRole("combobox", { name: TARGET_LABEL_RE });
		fireEvent.change(select, { target: { value: "worktree" } });
		expect(handleChange).toHaveBeenCalledWith("worktree");
	});
});
