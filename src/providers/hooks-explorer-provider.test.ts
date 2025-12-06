import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";
import type { HookManager } from "../features/hooks/hook-manager";
import type { Hook } from "../features/hooks/types";
import {
	type HookTreeItem,
	HooksExplorerProvider,
} from "./hooks-explorer-provider";

describe("HooksExplorerProvider", () => {
	let provider: HooksExplorerProvider;
	let hookManager: HookManager;
	let currentHooks: Hook[];
	const changeEmitter = new EventEmitter<void>();

	beforeEach(() => {
		currentHooks = [];
		hookManager = {
			getAllHooks: vi.fn(() => currentHooks),
			onHooksChanged: vi.fn((callback) => changeEmitter.event(callback)),
		} as unknown as HookManager;

		provider = new HooksExplorerProvider(hookManager);
		provider.initialize();
	});

	it("shows placeholder plus action items when there are no hooks", async () => {
		const children = await provider.getChildren();
		expect(children).toHaveLength(3);
		expect(children[0].contextValue).toBe("hook-empty");
		expect(children[1].command?.command).toBe("gatomia.hooks.addHook");
		expect(children[2].command?.command).toBe("gatomia.hooks.import");
	});

	it("returns grouped root nodes when hooks exist", async () => {
		currentHooks = createHooksFixture();
		changeEmitter.fire();

		const rootItems = await provider.getChildren();
		expect(rootItems).toHaveLength(4);
		expect(rootItems.every((item) => item.contextValue === "hook-group")).toBe(
			true
		);
	});

	it("lists hooks under their action group in alphabetical order", async () => {
		currentHooks = createHooksFixture();
		changeEmitter.fire();

		const rootItems = await provider.getChildren();
		const agentGroup = rootItems.find(
			(item) => item.contextValue === "hook-group" && item.groupType === "agent"
		) as HookTreeItem;

		const agentHooks = await provider.getChildren(agentGroup);
		expect(agentHooks).toHaveLength(2);
		expect(agentHooks[0].label).toBe("Auto Clarify");
		expect(agentHooks[1].label).toBe("Validate Plan");
		expect(agentHooks[0].contextValue).toBe("hook-enabled");
	});

	it("shows placeholder when a group has no hooks", async () => {
		currentHooks = createHooksFixture().filter(
			(hook) => hook.action.type === "agent"
		);
		changeEmitter.fire();

		const rootItems = await provider.getChildren();
		const gitGroup = rootItems.find(
			(item) => item.contextValue === "hook-group" && item.groupType === "git"
		) as HookTreeItem;
		const gitChildren = await provider.getChildren(gitGroup);
		expect(gitChildren).toHaveLength(1);
		expect(gitChildren[0].contextValue).toBe("hook-group-empty");
	});
});

function createHooksFixture(): Hook[] {
	return [
		{
			id: "1",
			name: "Validate Plan",
			enabled: true,
			trigger: { agent: "speckit", operation: "plan", timing: "after" },
			action: { type: "agent", parameters: { command: "/speckit.checklist" } },
			createdAt: 1,
			modifiedAt: 1,
			executionCount: 0,
		},
		{
			id: "2",
			name: "Auto Clarify",
			enabled: true,
			trigger: { agent: "speckit", operation: "specify", timing: "after" },
			action: { type: "agent", parameters: { command: "/speckit.clarify" } },
			createdAt: 2,
			modifiedAt: 2,
			executionCount: 0,
		},
		{
			id: "3",
			name: "Push draft branch",
			enabled: false,
			trigger: { agent: "openspec", operation: "plan", timing: "after" },
			action: {
				type: "git",
				parameters: { operation: "push", messageTemplate: "{feature}" },
			},
			createdAt: 3,
			modifiedAt: 3,
			executionCount: 0,
		},
	];
}
