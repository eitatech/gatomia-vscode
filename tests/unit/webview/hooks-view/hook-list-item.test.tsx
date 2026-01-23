import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HookListItem } from "../../../../ui/src/features/hooks-view/components/hook-list-item";
import type {
	Hook,
	HookExecutionStatusEntry,
} from "../../../../ui/src/features/hooks-view/types";

const baseHook: Hook = {
	id: "status-hook",
	name: "Status Hook",
	enabled: true,
	trigger: {
		agent: "speckit",
		operation: "specify",
		timing: "after",
	},
	action: {
		type: "agent",
		parameters: { command: "/speckit.clarify" },
	},
	createdAt: Date.now(),
	modifiedAt: Date.now(),
	executionCount: 0,
};

const noop = vi.fn();

const renderWithStatus = (status?: HookExecutionStatusEntry) => {
	render(
		<HookListItem
			executionStatus={status}
			hook={baseHook}
			onDelete={noop}
			onEdit={noop}
			onToggle={noop}
		/>
	);
};

describe("HookListItem - execution status indicator", () => {
	it("shows running indicator with spinner", () => {
		renderWithStatus({
			hookId: baseHook.id,
			status: "executing",
			updatedAt: Date.now(),
		});

		const badge = screen.getByTestId("hook-status-status-hook");
		expect(badge).toHaveTextContent("Running");
	});

	it("shows completion indicator when hook finishes", () => {
		renderWithStatus({
			hookId: baseHook.id,
			status: "completed",
			updatedAt: Date.now(),
		});

		const badge = screen.getByTestId("hook-status-status-hook");
		expect(badge).toHaveTextContent("Completed");
	});

	it("shows failure indicator with tooltip message", () => {
		renderWithStatus({
			hookId: baseHook.id,
			status: "failed",
			errorMessage: "boom",
			updatedAt: Date.now(),
		});

		const badge = screen.getByTestId("hook-status-status-hook");
		expect(badge).toHaveTextContent("Failed");
		expect(badge).toHaveAttribute("title", "boom");
	});
});
