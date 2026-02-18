import { join } from "node:path";
import {
	type Command,
	type Event,
	EventEmitter,
	type ExtensionContext,
	FileType,
	type OutputChannel,
	ThemeIcon,
	type TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	workspace,
} from "vscode";
import type { SteeringManager } from "../features/steering/steering-manager";
import { ConfigManager } from "../utils/config-manager";
import { SPEC_SYSTEM_MODE } from "../constants";
import { ensureGlobalResourceAccessConsent } from "../features/steering/global-resource-access-consent";

import { homedir } from "node:os";

const INSTRUCTION_RULE_SUFFIX = ".instructions.md";
const homeDir = homedir() || process.env.USERPROFILE || "";

const { joinPath } = Uri;

// Regex: ^name:\s*['"]?(.*?)['"]?$ (multiline)
const FRONTMATTER_REGEXP = /^name:\s*['"]?(.+?)['"]?$/m;
const H1_REGEXP = /^#\s+(.+)$/m;
const SEPARATOR_REGEXP = /[-_.]/;

export class SteeringExplorerProvider
	implements TreeDataProvider<SteeringItem>
{
	static readonly viewId = "gatomia.views.steeringExplorer";
	static readonly createProjectRuleCommandId =
		"gatomia.steering.createProjectRule";

	private readonly _onDidChangeTreeData = new EventEmitter<
		SteeringItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<SteeringItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private steeringManager!: SteeringManager;
	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;
	private readonly outputChannel?: OutputChannel;

	constructor(context: ExtensionContext, outputChannel?: OutputChannel) {
		this.context = context;
		this.configManager = ConfigManager.getInstance();
		this.outputChannel = outputChannel;
	}

	setSteeringManager(steeringManager: SteeringManager) {
		this.steeringManager = steeringManager;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SteeringItem): TreeItem {
		return element;
	}

	async getChildren(element?: SteeringItem): Promise<SteeringItem[]> {
		if (!element) {
			return this.getRootItems();
		}

		const ws = workspace.workspaceFolders?.[0];
		if (!ws) {
			return [];
		}

		if (element.contextValue === "group-user") {
			return await this.getGroupUserItems();
		}

		if (element.contextValue === "group-project") {
			return await this.getGroupProjectItems(ws.uri.fsPath);
		}

		if (element.contextValue === "group-rules") {
			return await this.getGroupRulesItems(ws.uri);
		}

		return [];
	}

	private getRootItems(): SteeringItem[] {
		return [
			new SteeringItem({
				label: "Rules",
				collapsibleState: TreeItemCollapsibleState.Expanded,
				contextValue: "group-project",
				resourcePath: "",
				context: this.context,
			}),
			new SteeringItem({
				label: "Custom Instructions",
				collapsibleState: TreeItemCollapsibleState.Expanded,
				contextValue: "group-rules",
				resourcePath: "",
				context: this.context,
			}),
			new SteeringItem({
				label: "User Instructions",
				collapsibleState: TreeItemCollapsibleState.Expanded,
				contextValue: "group-user",
				resourcePath: "",
				context: this.context,
			}),
		];
	}

	private async getGroupUserItems(): Promise<SteeringItem[]> {
		const hasGlobalAccess = await ensureGlobalResourceAccessConsent(
			this.context,
			this.outputChannel
		);
		if (!hasGlobalAccess) {
			return [
				new SteeringItem({
					label: "Global access disabled for this workspace",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "global-access-disabled",
					resourcePath: "",
					context: this.context,
				}),
			];
		}

		const items: SteeringItem[] = [];
		const globalCopilotMd = join(homeDir, ".github", "copilot-instructions.md");
		if (await this.exists(globalCopilotMd)) {
			items.push(
				new SteeringItem({
					label: "Global Instructions",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "instruction-file",
					resourcePath: globalCopilotMd,
					context: this.context,
					command: {
						command: "vscode.open",
						title: "Open",
						arguments: [Uri.file(globalCopilotMd)],
					},
					filename: "copilot-instructions.md",
				})
			);
		}

		const rulesRoot = joinPath(Uri.file(homeDir), ".github", "instructions");
		items.push(...(await this.getInstructionRules(rulesRoot)));
		return items;
	}

	private async getGroupProjectItems(
		workspaceRoot: string
	): Promise<SteeringItem[]> {
		const items: SteeringItem[] = [];
		const specSystem = this.configManager.getSettings().specSystem;

		// Project Copilot Instructions
		const projectCopilotMd = join(
			workspaceRoot,
			".github",
			"copilot-instructions.md"
		);
		if (await this.exists(projectCopilotMd)) {
			items.push(
				new SteeringItem({
					label: "Project Instructions",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "instruction-file",
					resourcePath: projectCopilotMd,
					context: this.context,
					command: {
						command: "vscode.open",
						title: "Open",
						arguments: [Uri.file(projectCopilotMd)],
					},
					filename: ".github/copilot-instructions.md",
				})
			);
		}

		// Constitution
		const constitutionMd = join(workspaceRoot, ".github", "constitution.md");
		if (await this.exists(constitutionMd)) {
			items.push(
				new SteeringItem({
					label: "Constitution",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "constitution-file",
					resourcePath: constitutionMd,
					context: this.context,
					command: {
						command: "vscode.open",
						title: "Open",
						arguments: [Uri.file(constitutionMd)],
					},
					filename: "constitution.md",
				})
			);
		}

		// AGENTS.md
		const agentsMd = join(workspaceRoot, "AGENTS.md");
		if (await this.exists(agentsMd)) {
			items.push(
				new SteeringItem({
					label: "Rules (General)",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "agent-file",
					resourcePath: agentsMd,
					context: this.context,
					command: {
						command: "vscode.open",
						title: "Open",
						arguments: [Uri.file(agentsMd)],
					},
					filename: "AGENTS.md",
				})
			);
		}

		// OpenSpec AGENTS.md
		const osAgentsMd = join(workspaceRoot, "openspec", "AGENTS.md");
		if (
			specSystem === SPEC_SYSTEM_MODE.OPENSPEC &&
			(await this.exists(osAgentsMd))
		) {
			items.push(
				new SteeringItem({
					label: "Rules (OpenSpec)",
					collapsibleState: TreeItemCollapsibleState.None,
					contextValue: "agent-file",
					resourcePath: osAgentsMd,
					context: this.context,
					command: {
						command: "vscode.open",
						title: "Open",
						arguments: [Uri.file(osAgentsMd)],
					},
					filename: "openspec/AGENTS.md",
				})
			);
		}

		return items;
	}

	private async getGroupRulesItems(workspaceUri: Uri): Promise<SteeringItem[]> {
		const items: SteeringItem[] = [];
		// Project Instruction Rules (*.instructions.md)
		const rulesRoot = joinPath(workspaceUri, ".github", "instructions");
		items.push(...(await this.getInstructionRules(rulesRoot)));
		return items;
	}

	private async exists(path: string): Promise<boolean> {
		try {
			await workspace.fs.stat(Uri.file(path));
			return true;
		} catch {
			return false;
		}
	}

	private async getInstructionRules(root: Uri): Promise<SteeringItem[]> {
		const items: SteeringItem[] = [];
		try {
			const entries = await workspace.fs.readDirectory(root);
			for (const [name, type] of entries) {
				if (type === FileType.File && name.endsWith(INSTRUCTION_RULE_SUFFIX)) {
					const displayName = await this.readDisplayName(
						joinPath(root, name),
						name
					);
					items.push(
						new SteeringItem({
							label: displayName,
							collapsibleState: TreeItemCollapsibleState.None,
							contextValue: "instruction-rule",
							resourcePath: join(root.fsPath, name),
							context: this.context,
							command: {
								command: "vscode.open",
								title: "Open",
								arguments: [joinPath(root, name)],
							},
							filename: name,
						})
					);
				}
			}
		} catch {
			/* ignore */
		}
		return items;
	}

	private async readDisplayName(uri: Uri, filename: string): Promise<string> {
		try {
			// Read first 1KB to find frontmatter or H1
			const fileData = await workspace.fs.readFile(uri);
			const content = new TextDecoder().decode(fileData.slice(0, 1024));

			// 1. Try Frontmatter name: ...
			const frontmatterMatch = FRONTMATTER_REGEXP.exec(content);
			if (frontmatterMatch?.[1]) {
				return frontmatterMatch[1].trim();
			}

			// 2. Try H1: # Title
			const h1Match = H1_REGEXP.exec(content);
			if (h1Match?.[1]) {
				return h1Match[1].trim();
			}

			// 3. Fallback: Normalize filename
			return this.normalizeName(filename);
		} catch {
			return this.normalizeName(filename);
		}
	}

	private normalizeName(name: string): string {
		// Remove suffix and extension
		const normalized = name.replace(INSTRUCTION_RULE_SUFFIX, "");
		// Kebab/Snake to Title Case
		return normalized
			.split(SEPARATOR_REGEXP)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}
}

interface SteeringItemOptions {
	label: string;
	collapsibleState: TreeItemCollapsibleState;
	contextValue: string;
	resourcePath: string;
	context: ExtensionContext;
	command?: Command;
	filename?: string;
}

class SteeringItem extends TreeItem {
	readonly label: string;
	readonly collapsibleState: TreeItemCollapsibleState;
	readonly contextValue: string;
	readonly resourcePath: string;
	readonly command?: Command;
	readonly filename?: string;
	private readonly context: ExtensionContext;

	constructor(options: SteeringItemOptions) {
		super(options.label, options.collapsibleState);
		this.label = options.label;
		this.collapsibleState = options.collapsibleState;
		this.contextValue = options.contextValue;
		this.resourcePath = options.resourcePath;
		this.context = options.context;
		this.command = options.command;
		this.filename = options.filename;

		this.resourceUri = options.resourcePath
			? Uri.file(options.resourcePath)
			: undefined;
		this.description = options.filename;

		if (options.contextValue === "group-user") {
			this.iconPath = new ThemeIcon("account");
		} else if (options.contextValue === "group-project") {
			this.iconPath = new ThemeIcon("folder-active");
		} else if (options.contextValue === "group-rules") {
			this.iconPath = new ThemeIcon("folder-library");
		} else if (
			options.contextValue === "instruction-file" ||
			options.contextValue === "instruction-rule"
		) {
			this.iconPath = new ThemeIcon("book");
		} else if (options.contextValue === "agent-file") {
			this.iconPath = new ThemeIcon("robot");
		} else if (options.contextValue === "constitution-file") {
			this.iconPath = new ThemeIcon("law");
		} else if (options.contextValue === "global-access-disabled") {
			this.iconPath = new ThemeIcon("shield");
		}
	}
}
