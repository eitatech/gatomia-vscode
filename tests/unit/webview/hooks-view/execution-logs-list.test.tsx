import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionLogsList } from "../../../../ui/src/features/hooks-view/components/execution-logs-list";
import type {
	Hook,
	HookExecutionLog,
} from "../../../../ui/src/features/hooks-view/types";

const NO_LOGS_REGEX = /No execution logs yet/i;
const AUTO_CLARIFY_REGEX = /Auto Clarify/;
const SUCCESS_REGEX = /Success/;
const REFRESH_BUTTON = /Refresh/i;
const CLOSE_BUTTON = /Close/i;
const FILTER_BY_HOOK_LABEL = /Filter by hook/i;

const hooks: Hook[] = [
	{
		id: "hook-1",
		name: "Auto Clarify",
		enabled: true,
		trigger: { agent: "speckit", operation: "specify", timing: "after" },
		action: {
			type: "agent",
			parameters: { command: "/speckit.clarify" },
		},
		createdAt: Date.now(),
		modifiedAt: Date.now(),
		executionCount: 0,
	},
];

const logs: HookExecutionLog[] = [
	{
		id: "log-1",
		hookId: "hook-1",
		executionId: "exec-1",
		chainDepth: 0,
		triggeredAt: Date.now(),
		completedAt: Date.now(),
		duration: 1200,
		status: "success",
		contextSnapshot: {},
	},
];

describe("ExecutionLogsList", () => {
	it("renders placeholder when no logs", () => {
		render(
			<ExecutionLogsList
				hooks={hooks}
				isLoading={false}
				logs={[]}
				onClose={vi.fn()}
				onRefresh={vi.fn()}
				onSelectHook={vi.fn()}
				selectedHookId={undefined}
			/>
		);

		expect(screen.getByText(NO_LOGS_REGEX)).toBeInTheDocument();
	});

	it("renders log entries with hook names", () => {
		render(
			<ExecutionLogsList
				hooks={hooks}
				isLoading={false}
				logs={logs}
				onClose={vi.fn()}
				onRefresh={vi.fn()}
				onSelectHook={vi.fn()}
				selectedHookId={undefined}
			/>
		);

		expect(screen.getAllByText(AUTO_CLARIFY_REGEX).length).toBeGreaterThan(0);
		expect(screen.getByText(SUCCESS_REGEX)).toBeInTheDocument();
	});

	it("invokes handlers for refresh, close, and filter change", () => {
		const onRefresh = vi.fn();
		const onClose = vi.fn();
		const onSelectHook = vi.fn();

		render(
			<ExecutionLogsList
				hooks={hooks}
				isLoading={false}
				logs={logs}
				onClose={onClose}
				onRefresh={onRefresh}
				onSelectHook={onSelectHook}
				selectedHookId={undefined}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: REFRESH_BUTTON }));
		fireEvent.click(screen.getByRole("button", { name: CLOSE_BUTTON }));
		fireEvent.change(screen.getByLabelText(FILTER_BY_HOOK_LABEL), {
			target: { value: "hook-1" },
		});

		expect(onRefresh).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
		expect(onSelectHook).toHaveBeenCalledWith("hook-1");
	});
});
