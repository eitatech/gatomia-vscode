import {
	type Command,
	type Event,
	EventEmitter,
	type TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	ThemeIcon,
} from "vscode";
import { ConfigManager } from "../utils/config-manager";
import { SPEC_SYSTEM_MODE } from "../constants";

interface QuickAccessGroupDefinition {
	id: string;
	label: string;
	description: string;
	icon: ThemeIcon;
}

const GROUPS: QuickAccessGroupDefinition[] = [
	{
		id: "spec-system",
		label: "Spec System",
		description: "Configure which specification system to use.",
		icon: new ThemeIcon("symbol-structure"),
	},
	{
		id: "configuration",
		label: "Configuration",
		description: "Extension settings and configuration files.",
		icon: new ThemeIcon("gear"),
	},
	{
		id: "resources",
		label: "Resources",
		description: "Help and documentation.",
		icon: new ThemeIcon("book"),
	},
];

type TreeEventPayload = QuickAccessTreeItem | undefined | null | void;

export class QuickAccessExplorerProvider
	implements TreeDataProvider<QuickAccessTreeItem>
{
	static readonly viewId = "gatomia.views.overview";

	private readonly changeEmitter = new EventEmitter<TreeEventPayload>();
	readonly onDidChangeTreeData: Event<TreeEventPayload> =
		this.changeEmitter.event;

	private readonly configManager: ConfigManager;

	constructor() {
		this.configManager = ConfigManager.getInstance();
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}

	refresh(): void {
		this.changeEmitter.fire();
	}

	getTreeItem(element: QuickAccessTreeItem): TreeItem {
		return element;
	}

	getChildren(element?: QuickAccessTreeItem): QuickAccessTreeItem[] {
		if (!element) {
			return GROUPS.map((group) => QuickAccessTreeItem.createGroup(group));
		}

		if (element.contextValue === "quick-access-group") {
			return this.getGroupChildren(element.groupId);
		}

		return [];
	}

	private getGroupChildren(groupId: string | undefined): QuickAccessTreeItem[] {
		if (groupId === "spec-system") {
			return this.getSpecSystemItems();
		}

		if (groupId === "configuration") {
			return this.getConfigurationItems();
		}

		if (groupId === "resources") {
			return this.getResourceItems();
		}

		return [];
	}

	private getSpecSystemItems(): QuickAccessTreeItem[] {
		const currentSystem = this.configManager.getSettings().specSystem;
		const systemLabel = this.formatSpecSystemLabel(currentSystem);

		return [
			QuickAccessTreeItem.createAction(
				"Select Spec Agent",
				{
					command: "gatomia.settings.selectSpecSystem",
					title: "Select Spec Agent",
				},
				new ThemeIcon("settings-gear"),
				`Current: ${systemLabel}. Click to change the active spec system.`
			),
			QuickAccessTreeItem.createAction(
				"Install Dependencies",
				{
					command: "gatomia.dependencies.check",
					title: "Install Dependencies",
				},
				new ThemeIcon("desktop-download"),
				"Check and install required dependencies for SpecKit and OpenSpec."
			),
		];
	}

	private getConfigurationItems(): QuickAccessTreeItem[] {
		return [
			QuickAccessTreeItem.createAction(
				"Open Settings",
				{
					command: "gatomia.settings.open",
					title: "Open Settings",
				},
				new ThemeIcon("gear"),
				"Open GatomIA extension settings."
			),
			QuickAccessTreeItem.createAction(
				"Open MCP Config",
				{
					command: "gatomia.settings.openGlobalConfig",
					title: "Open MCP Config",
				},
				new ThemeIcon("file-text"),
				"Open the MCP configuration file (mcp.json)."
			),
		];
	}

	private getResourceItems(): QuickAccessTreeItem[] {
		return [
			QuickAccessTreeItem.createAction(
				"Help",
				{
					command: "gatomia.help.open",
					title: "Help",
				},
				new ThemeIcon("question"),
				"Open GatomIA documentation and help."
			),
		];
	}

	private formatSpecSystemLabel(system: string): string {
		if (system === SPEC_SYSTEM_MODE.SPECKIT) {
			return "SpecKit";
		}
		if (system === SPEC_SYSTEM_MODE.OPENSPEC) {
			return "OpenSpec";
		}
		return "Auto-detect";
	}
}

export class QuickAccessTreeItem extends TreeItem {
	readonly groupId?: string;

	private constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
	}

	static createGroup(
		definition: QuickAccessGroupDefinition
	): QuickAccessTreeItem {
		const item = new QuickAccessTreeItem(
			definition.label,
			TreeItemCollapsibleState.Expanded,
			"quick-access-group"
		);
		item.iconPath = definition.icon;
		item.tooltip = definition.description;
		item.groupId = definition.id;
		return item;
	}

	static createAction(
		label: string,
		command: Command,
		icon: ThemeIcon,
		tooltip?: string
	): QuickAccessTreeItem {
		const item = new QuickAccessTreeItem(
			label,
			TreeItemCollapsibleState.None,
			"quick-access-action"
		);
		item.iconPath = icon;
		item.command = command;
		item.tooltip = tooltip;
		return item;
	}
}
