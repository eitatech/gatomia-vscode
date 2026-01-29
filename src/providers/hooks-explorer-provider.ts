import {
	type Command,
	type Event,
	EventEmitter,
	type TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	ThemeIcon,
} from "vscode";
import type {
	Hook,
	ActionType,
	AgentActionParams,
	GitActionParams,
	GitHubActionParams,
	CustomActionParams,
	MCPActionParams,
} from "../features/hooks/types";
import type { HookManager } from "../features/hooks/hook-manager";

interface HookGroupDefinition {
	type: ActionType;
	label: string;
	description: string;
	icon: ThemeIcon;
}

const GROUPS: HookGroupDefinition[] = [
	{
		type: "agent",
		label: "Agent Commands",
		description: "Automatically trigger SpecKit or OpenSpec commands.",
		icon: new ThemeIcon("symbol-event"),
	},
	{
		type: "git",
		label: "Git Operations",
		description: "Commit or push code with templated messages.",
		icon: new ThemeIcon("git-commit"),
	},
	{
		type: "github",
		label: "GitHub Tools",
		description: "Create issues, PRs, or comments via MCP.",
		icon: new ThemeIcon("github"),
	},
	{
		type: "custom",
		label: "Custom Agents",
		description: "Invoke workspace-specific automations.",
		icon: new ThemeIcon("variable-group"),
	},
	{
		type: "mcp",
		label: "Custom Tools",
		description: "Execute custom MCP tools with natural language instructions.",
		icon: new ThemeIcon("tools"),
	},
];

type TreeEventPayload = HookTreeItem | undefined | null | void;

export class HooksExplorerProvider implements TreeDataProvider<HookTreeItem> {
	static readonly viewId = "gatomia.views.hooksExplorer";

	private readonly changeEmitter = new EventEmitter<TreeEventPayload>();
	readonly onDidChangeTreeData: Event<TreeEventPayload> =
		this.changeEmitter.event;

	private readonly hookManager: HookManager;
	private hooks: Hook[] = [];
	private readonly disposables: Array<{ dispose(): void }> = [];

	constructor(hookManager: HookManager) {
		this.hookManager = hookManager;
	}

	initialize(): void {
		this.hooks = this.hookManager.getAllHooks();
		this.disposables.push(
			this.hookManager.onHooksChanged(() => {
				this.hooks = this.hookManager.getAllHooks();
				this.refresh();
			})
		);
	}

	dispose(): void {
		this.changeEmitter.dispose();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	refresh(): void {
		this.changeEmitter.fire();
	}

	getTreeItem(element: HookTreeItem): TreeItem {
		return element;
	}

	getChildren(element?: HookTreeItem): HookTreeItem[] {
		if (!element) {
			if (this.hooks.length === 0) {
				return HookTreeItem.createEmptyState();
			}
			return GROUPS.map((group) =>
				HookTreeItem.createGroup(
					group,
					this.hooks.filter((hook) => hook.action.type === group.type).length
				)
			);
		}

		if (element.contextValue === "hook-group" && element.groupType) {
			const hooks = this.hooks
				.filter((hook) => hook.action.type === element.groupType)
				.sort((a, b) => a.name.localeCompare(b.name));

			if (hooks.length === 0) {
				return [HookTreeItem.createGroupPlaceholder(element.groupType)];
			}

			return hooks.map((hook) => HookTreeItem.fromHook(hook));
		}

		return [];
	}
}

export class HookTreeItem extends TreeItem {
	readonly hookId?: string;
	readonly groupType?: ActionType;

	private constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
	}

	static createEmptyMessage(): HookTreeItem {
		const item = new HookTreeItem(
			"No hooks configured yet",
			TreeItemCollapsibleState.None,
			"hook-empty"
		);
		item.iconPath = new ThemeIcon("info");
		item.tooltip = "Use Add Hook to create your first automation.";
		return item;
	}

	static createEmptyState(): HookTreeItem[] {
		return [
			HookTreeItem.createEmptyMessage(),
			HookTreeItem.createAction(
				"Add Hook",
				{
					command: "gatomia.hooks.addHook",
					title: "Add Hook",
				},
				new ThemeIcon("plus"),
				"Create a new automation hook."
			),
			HookTreeItem.createAction(
				"Import Hooks",
				{
					command: "gatomia.hooks.import",
					title: "Import Hooks",
				},
				new ThemeIcon("cloud-download"),
				"Import hooks from a JSON export."
			),
		];
	}

	static createGroup(
		definition: HookGroupDefinition,
		count: number
	): HookTreeItem {
		const item = new HookTreeItem(
			definition.label,
			TreeItemCollapsibleState.Expanded,
			"hook-group"
		);
		item.iconPath = definition.icon;
		item.tooltip = definition.description;
		item.description = count === 1 ? "1 hook" : `${count} hooks`;
		item.groupType = definition.type;
		return item;
	}

	static createGroupPlaceholder(groupType: ActionType): HookTreeItem {
		const item = new HookTreeItem(
			"No hooks configured for this action type",
			TreeItemCollapsibleState.None,
			"hook-group-empty"
		);
		item.iconPath = new ThemeIcon("circle-slash");
		item.tooltip = "Create a hook to see it in this group.";
		item.groupType = groupType;
		return item;
	}

	static createAction(
		label: string,
		command: Command,
		icon: ThemeIcon,
		tooltip?: string
	): HookTreeItem {
		const item = new HookTreeItem(
			label,
			TreeItemCollapsibleState.None,
			"hook-action"
		);
		item.iconPath = icon;
		item.command = command;
		item.tooltip = tooltip;
		return item;
	}

	static fromHook(hook: Hook): HookTreeItem {
		const item = new HookTreeItem(
			hook.name,
			TreeItemCollapsibleState.None,
			hook.enabled ? "hook-enabled" : "hook-disabled"
		);
		item.hookId = hook.id;
		item.iconPath = hook.enabled
			? new ThemeIcon("play")
			: new ThemeIcon("debug-pause");
		item.description = HookTreeItem.formatDescription(hook);
		item.tooltip = HookTreeItem.buildTooltip(hook);
		item.command = HookTreeItem.buildEditCommand(hook.id);
		return item;
	}

	private static buildEditCommand(hookId: string): Command {
		return {
			command: "gatomia.hooks.edit",
			title: "Edit Hook",
			arguments: [hookId],
		};
	}

	private static formatDescription(hook: Hook): string {
		const trigger = `${hook.trigger.agent}.${hook.trigger.operation}`;
		const actionSummary = HookTreeItem.describeAction(hook);
		const status = hook.enabled ? "Active" : "Paused";
		return `${trigger} → ${actionSummary} • ${status}`;
	}

	private static describeAction(hook: Hook): string {
		switch (hook.action.type) {
			case "agent": {
				const params = hook.action.parameters as AgentActionParams;
				return params.command;
			}
			case "git": {
				const params = hook.action.parameters as GitActionParams;
				return params.operation === "commit" ? "Git Commit" : "Git Push";
			}
			case "github": {
				const params = hook.action.parameters as GitHubActionParams;
				return `GitHub ${params.operation}`;
			}
			case "custom": {
				const params = hook.action.parameters as CustomActionParams;
				return params.agentName
					? `Custom: ${params.agentName}`
					: "Custom Agent";
			}
			case "mcp": {
				const params = hook.action.parameters as MCPActionParams;
				const toolCount = params.selectedTools?.length || 0;
				return toolCount > 0 ? `MCP Tools (${toolCount})` : "MCP Action";
			}
			default:
				return "Action";
		}
	}

	private static buildTooltip(hook: Hook): string {
		const parts = [
			`Trigger: ${hook.trigger.agent}.${hook.trigger.operation}`,
			`Action: ${HookTreeItem.describeAction(hook)}`,
		];
		if (hook.action.type === "git") {
			const params = hook.action.parameters as GitActionParams;
			if (params.operation === "commit") {
				parts.push(`Message template: ${params.messageTemplate}`);
			}
		}
		if (hook.action.type === "github") {
			const params = hook.action.parameters as GitHubActionParams;
			parts.push(`Repository: ${params.repository}`);
		}
		parts.push(`Status: ${hook.enabled ? "Active" : "Paused"}`);
		return parts.join("\n");
	}
}
