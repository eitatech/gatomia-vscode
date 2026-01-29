import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HooksList } from "../../../../ui/src/features/hooks-view/components/hooks-list";
import type { Hook } from "../../../../ui/src/features/hooks-view/types";

let counter = 0;
const baseHook = (overrides: Partial<Hook>): Hook => {
	const id = overrides.id ?? `hook-${counter}`;
	counter += 1;
	return {
		id,
		name: overrides.name ?? "Test Hook",
		enabled: overrides.enabled ?? true,
		trigger: overrides.trigger ?? {
			agent: "speckit",
			operation: "specify",
			timing: "after",
		},
		action:
			overrides.action ??
			({
				type: "agent",
				parameters: { command: "/speckit.plan" },
			} as Hook["action"]),
		createdAt: Date.now(),
		modifiedAt: Date.now(),
		executionCount: overrides.executionCount ?? 0,
		lastExecutedAt: overrides.lastExecutedAt,
	};
};

describe("HooksList", () => {
	const noop = vi.fn();

	it("groups hooks by action type", () => {
		render(
			<HooksList
				executionStatuses={{}}
				hooks={[
					baseHook({
						id: "agent",
						name: "Agent Hook",
						action: {
							type: "agent",
							parameters: { command: "/speckit.plan" },
						},
					}),
					baseHook({
						id: "git",
						name: "Git Hook",
						action: {
							type: "git",
							parameters: { operation: "commit", messageTemplate: "feat" },
						},
					}),
				]}
				isLoading={false}
				onDelete={noop}
				onEdit={noop}
				onToggle={noop}
			/>
		);

		const agentSection = screen
			.getByText("Agent Commands")
			.closest("div[role='treeitem']");
		const gitSection = screen
			.getByText("Git Operations")
			.closest("div[role='treeitem']");
		const githubSection = screen
			.getByText("GitHub Tools")
			.closest("div[role='treeitem']");

		expect(agentSection).not.toBeNull();
		expect(gitSection).not.toBeNull();
		expect(githubSection).not.toBeNull();

		expect(
			within(agentSection as HTMLElement).getByText("Agent Hook")
		).toBeInTheDocument();
		expect(
			within(gitSection as HTMLElement).getByText("Git Hook")
		).toBeInTheDocument();
		expect(
			within(githubSection as HTMLElement).getByText(
				"No hooks configured for this action type yet."
			)
		).toBeInTheDocument();
	});

	it("shows empty state when no hooks exist", () => {
		render(
			<HooksList
				executionStatuses={{}}
				hooks={[]}
				isLoading={false}
				onDelete={noop}
				onEdit={noop}
				onToggle={noop}
			/>
		);

		expect(screen.getByText("No hooks configured")).toBeInTheDocument();
	});
});
